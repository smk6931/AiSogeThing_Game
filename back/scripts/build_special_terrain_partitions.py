"""
특수 지형 파티션 교체 스크립트
— 수계(water): 도로가 강을 잘라 생긴 작은 조각들 → OSM polygon 기반 큰 세그먼트로 교체
— 공원/산림(park/forest): 주요 OSM 공원 polygon 기반 파티션으로 교체
— 묘지(cemetery): OSM 묘지 polygon 기반 파티션으로 교체

기존 road-polygonize 파티션 중 해당 landuse만 골라서 삭제하고 새 파티션 삽입.

전제 조건:
  1. build_partitions_from_osm.py 로 기본 파티션이 이미 생성되어 있어야 함
  2. fetch_osm_features.py 로 OSM 캐시가 있어야 함

사용법:
  python back/scripts/build_special_terrain_partitions.py --dong-osm-id 3879474 --dry-run
  python back/scripts/build_special_terrain_partitions.py --dong-osm-id 3879474 --types water park forest
  python back/scripts/build_special_terrain_partitions.py --dong-osm-id 3879474  # 전체 처리
"""

import asyncio
import argparse
import json
import math
import sys
import re
from pathlib import Path
from collections import defaultdict

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
CACHE_DIR = BACK_DIR / "world" / "data" / "osm_cache"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from shapely.geometry import shape, mapping, LineString
from shapely.ops import unary_union
from shapely.affinity import rotate
from sqlalchemy import text
from core.database import async_session_factory

LAT_TO_M = 111000
LNG_TO_M = 88000

# ── 크기 기준 ─────────────────────────────────────────────────────────────────
# 수계: 강처럼 넓은 면적은 크게 → 80,000m² (~280m × 280m) 세그먼트
WATER_TARGET_M2     = 80_000
# 공원/산림: 15,000m² 이하로 분할
PARK_TARGET_MAX_M2  = 15_000
# 이 이상인 OSM feature만 처리 (작은 공원/연못은 기존 방식 유지)
SPECIAL_MIN_CLIP_M2 = 8_000
# 슬리버 흡수
ABSORB_MIN_M2       = 500
SPLIT_MAX_DEPTH     = 8

# 기존 파티션을 교체 대상으로 보는 겹침 비율 (OSM feature 안에 40% 이상이면 교체)
OVERLAP_RATIO = 0.40

SPECIAL_LANDUSE_TYPES = ["water", "park", "forest", "cemetery"]

THEME_MAP = {
    "water":    "ancient_waterway",
    "park":     "sanctuary_green",
    "forest":   "sanctuary_green",
    "cemetery": "sanctuary_green",
}

LANDUSE_KR = {
    "water": "수계", "park": "공원", "forest": "산림",
    "cemetery": "묘지", "residential": "주거",
    "commercial": "상업", "educational": "교육",
    "medical": "의료", "industrial": "산업", "military": "군사",
}


def area_m2(geom) -> float:
    c = geom.centroid
    return geom.area * LAT_TO_M * (math.cos(math.radians(c.y)) * LAT_TO_M)


def centroid_latng(geom):
    c = geom.centroid
    return c.y, c.x


def _flatten(geom) -> list:
    if geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom] if geom.is_valid else [geom.buffer(0)]
    if geom.geom_type == "MultiPolygon":
        return [g if g.is_valid else g.buffer(0) for g in geom.geoms]
    return [g for g in getattr(geom, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")]


# ── 장축 분할 (build_partitions_from_osm 와 동일 로직) ───────────────────────
def longest_axis_split(geom, target_max: float, depth: int = 0) -> list:
    if area_m2(geom) <= target_max or depth >= SPLIT_MAX_DEPTH:
        return [geom]
    try:
        rect = geom.minimum_rotated_rectangle
        coords = list(rect.exterior.coords)
        dx0 = coords[1][0] - coords[0][0]; dy0 = coords[1][1] - coords[0][1]
        dx1 = coords[2][0] - coords[1][0]; dy1 = coords[2][1] - coords[1][1]
        len0 = math.sqrt(dx0**2 + dy0**2)
        len1 = math.sqrt(dx1**2 + dy1**2)

        if len0 >= len1:
            mid_x = (coords[0][0] + coords[1][0]) / 2
            mid_y = (coords[0][1] + coords[1][1]) / 2
            cut_dx = coords[2][0] - coords[1][0]
            cut_dy = coords[2][1] - coords[1][1]
        else:
            mid_x = (coords[1][0] + coords[2][0]) / 2
            mid_y = (coords[1][1] + coords[2][1]) / 2
            cut_dx = coords[1][0] - coords[0][0]
            cut_dy = coords[1][1] - coords[0][1]

        scale = 10.0
        from shapely.ops import split as shapely_split
        cut_line = LineString([
            (mid_x - cut_dx * scale, mid_y - cut_dy * scale),
            (mid_x + cut_dx * scale, mid_y + cut_dy * scale),
        ])
        pieces = list(shapely_split(geom, cut_line).geoms)
        if len(pieces) < 2:
            return [geom]

        result = []
        for piece in pieces:
            if piece.geom_type == "Polygon" and area_m2(piece) > ABSORB_MIN_M2:
                result.extend(longest_axis_split(piece, target_max, depth + 1))
        return result if result else [geom]
    except Exception:
        return [geom]


def absorb_slivers(items: list[dict], min_area: float) -> list[dict]:
    geoms = [shape(p["boundary_geojson"]) for p in items]
    changed = True
    while changed:
        changed = False
        keep = []
        absorbed = set()
        for i in range(len(items)):
            if i in absorbed:
                continue
            if area_m2(geoms[i]) >= min_area:
                keep.append(i)
                continue
            best_j, best_len = None, 0.0
            for j in range(len(items)):
                if j == i or j in absorbed:
                    continue
                try:
                    shared = geoms[i].intersection(geoms[j]).length
                    if shared > best_len:
                        best_len = shared; best_j = j
                except Exception:
                    continue
            if best_j is not None and best_len > 0:
                geoms[best_j] = geoms[best_j].union(geoms[i])
                absorbed.add(i); changed = True
            else:
                keep.append(i)
        new_items = []
        for i in keep:
            p = dict(items[i])
            g = geoms[i]
            if not g.is_valid: g = g.buffer(0)
            p["boundary_geojson"] = mapping(g)
            lat, lng = centroid_latng(g)
            p["centroid_lat"] = lat; p["centroid_lng"] = lng; p["area_m2"] = area_m2(g)
            new_items.append(p)
        items = new_items
        geoms = [shape(p["boundary_geojson"]) for p in items]
    return items


# ── 메인 ──────────────────────────────────────────────────────────────────────

async def build_special_partitions(
    dong_osm_id: int,
    dry_run: bool,
    target_types: list[str],
) -> None:
    async with async_session_factory() as session:
        # ── 동 정보 조회 ─────────────────────────────────────────────────
        row = await session.execute(
            text("""
                SELECT dong.id, dong.name as dong_name, dong.boundary_geojson,
                       dist.name as district_name, city.name as city_name
                FROM world_area dong
                LEFT JOIN world_area dist ON dong.parent_id = dist.id
                LEFT JOIN world_area city ON dist.parent_id = city.id
                WHERE dong.osm_id=:osm_id AND dong.area_level='dong' LIMIT 1
            """),
            {"osm_id": dong_osm_id},
        )
        area = row.mappings().first()
        if not area:
            print(f"[ERROR] dong osm_id={dong_osm_id} not found"); return

        admin_area_id = area["id"]
        dong_name     = area["dong_name"]
        city_name     = area["city_name"] or "서울특별시"
        district_name = area["district_name"] or "동작구"

        raw_boundary = area["boundary_geojson"]
        if isinstance(raw_boundary, str):
            raw_boundary = json.loads(raw_boundary)
        dong_geom = shape(raw_boundary)
        if not dong_geom.is_valid:
            dong_geom = dong_geom.buffer(0)

        dong_key = re.sub(r"[^a-z0-9._]", "",
                          f"seoul.{district_name}.{dong_name}".lower().replace(" ", "_"))
        print(f"[INFO] 동: {dong_name} (id={admin_area_id}), 처리 대상: {target_types}")

        # ── OSM 캐시 로드 ─────────────────────────────────────────────────
        feat_path = CACHE_DIR / f"{dong_osm_id}_features.geojson"
        if not feat_path.exists():
            print(f"[ERROR] OSM 캐시 없음. 먼저 실행:")
            print(f"  python back/scripts/fetch_osm_features.py --dong-osm-id {dong_osm_id}")
            return
        features = json.loads(feat_path.read_text(encoding="utf-8"))["features"]
        print(f"[INFO] OSM feature {len(features)}개 로드")

        # ── 현재 파티션 로드 (geometry 포함) ─────────────────────────────
        cur_rows = await session.execute(
            text("""
                SELECT id, partition_key, dominant_landuse,
                       boundary_geojson, area_m2
                FROM world_partition
                WHERE admin_area_id = :aid
            """),
            {"aid": admin_area_id},
        )
        cur_partitions = []
        for r in cur_rows.mappings():
            bj = r["boundary_geojson"]
            if isinstance(bj, str): bj = json.loads(bj)
            try:
                g = shape(bj)
                if not g.is_valid: g = g.buffer(0)
                cur_partitions.append({
                    "id": r["id"],
                    "partition_key": r["partition_key"],
                    "dominant_landuse": r["dominant_landuse"],
                    "geom": g,
                    "area_m2": r["area_m2"],
                })
            except Exception:
                pass

        print(f"[INFO] 현재 파티션 {len(cur_partitions)}개 로드")

        # ── max seq 확인 ─────────────────────────────────────────────────
        max_seq_row = await session.execute(
            text("SELECT COALESCE(MAX(partition_seq), 0) FROM world_partition WHERE admin_area_id=:aid"),
            {"aid": admin_area_id},
        )
        next_seq = max_seq_row.scalar() + 1
        max_id_row = await session.execute(text("SELECT COALESCE(MAX(id), 0) FROM world_partition"))
        next_id = max_id_row.scalar() + 1

        # ── landuse별 처리 ────────────────────────────────────────────────
        all_delete_ids: list[int] = []
        all_new_items: list[dict] = []

        for lu in target_types:
            target_m2 = WATER_TARGET_M2 if lu == "water" else PARK_TARGET_MAX_M2
            theme = THEME_MAP.get(lu, "residential_zone")

            print(f"\n[{lu.upper()}] 처리 시작 (target_max={target_m2:,}m²)")

            # OSM feature 중 해당 landuse의 유의미한 것만 수집
            osm_candidates = []
            for feat in features:
                if feat["properties"].get("dominant_landuse") != lu:
                    continue
                try:
                    fg = shape(feat["geometry"])
                    if not fg.is_valid: fg = fg.buffer(0)
                    clipped = fg.intersection(dong_geom)
                    if clipped.is_empty: continue
                    clipped_area = area_m2(clipped)
                    if clipped_area < SPECIAL_MIN_CLIP_M2: continue
                    osm_candidates.append({
                        "geom": clipped,
                        "area": clipped_area,
                        "name": feat["properties"].get("name", ""),
                        "tags": feat["properties"].get("tags", {}),
                    })
                except Exception:
                    continue

            if not osm_candidates:
                print(f"  → 유의미한 OSM feature 없음 (>{SPECIAL_MIN_CLIP_M2:,}m² 기준), 건너뜀")
                continue

            print(f"  OSM feature {len(osm_candidates)}개 (클립 후 {SPECIAL_MIN_CLIP_M2:,}m² 이상)")
            for c in osm_candidates:
                print(f"    - {c['name'] or '(unnamed)'}: {c['area']:,.0f}m²")

            # OSM feature union → 겹치는 파티션 교체
            osm_union = unary_union([c["geom"] for c in osm_candidates])
            if not osm_union.is_valid:
                osm_union = osm_union.buffer(0)

            # 교체 대상 파티션 찾기
            delete_ids = []
            for p in cur_partitions:
                if p["dominant_landuse"] != lu:
                    continue
                try:
                    inter_area = p["geom"].intersection(osm_union).area
                    ratio = inter_area / p["geom"].area if p["geom"].area > 0 else 0
                    if ratio >= OVERLAP_RATIO:
                        delete_ids.append(p["id"])
                except Exception:
                    pass

            print(f"  교체 대상 기존 파티션: {len(delete_ids)}개")

            # OSM feature별 분할
            new_geoms = []
            for c in osm_candidates:
                pieces = longest_axis_split(c["geom"], target_m2)
                # ※ unary_union 금지 — 나눈 조각들을 다시 합쳐버림
                for piece in pieces:
                    for flat_piece in _flatten(piece):
                        if area_m2(flat_piece) >= ABSORB_MIN_M2:
                            new_geoms.append({
                                "geom": flat_piece,
                                "name": c["name"],
                                "dominant_landuse": lu,
                                "theme_code": theme,
                                "source_layer": f"osm_{lu}",
                                "is_road": False,
                                "area_m2": area_m2(flat_piece),
                                "centroid_lat": centroid_latng(flat_piece)[0],
                                "centroid_lng": centroid_latng(flat_piece)[1],
                                "boundary_geojson": mapping(flat_piece),
                            })

            # 슬리버 흡수
            new_geoms = absorb_slivers(new_geoms, ABSORB_MIN_M2)
            print(f"  새 파티션: {len(new_geoms)}개 (슬리버 흡수 후)")
            areas_new = sorted([g["area_m2"] for g in new_geoms])
            if areas_new:
                print(f"    면적: min={areas_new[0]:,.0f}  avg={sum(areas_new)/len(areas_new):,.0f}  max={areas_new[-1]:,.0f}")

            all_delete_ids.extend(delete_ids)
            all_new_items.extend(new_geoms)

        # ── 요약 ─────────────────────────────────────────────────────────
        print(f"\n[SUMMARY] 삭제 예정: {len(all_delete_ids)}개 → 신규: {len(all_new_items)}개")

        if dry_run:
            print("[DRY-RUN] DB 변경 없음.")
            return

        if not all_delete_ids and not all_new_items:
            print("[INFO] 처리할 항목 없음.")
            return

        # ── DB 교체 ───────────────────────────────────────────────────────
        # 그룹 멤버 먼저 삭제
        await session.execute(
            text("DELETE FROM world_partition_group_member WHERE partition_id = ANY(:ids)"),
            {"ids": all_delete_ids},
        )
        # 파티션 삭제
        await session.execute(
            text("DELETE FROM world_partition WHERE id = ANY(:ids)"),
            {"ids": all_delete_ids},
        )
        print(f"[DELETE] {len(all_delete_ids)}개 삭제 완료")

        # 새 파티션 삽입
        for p in all_new_items:
            lu_kr = LANDUSE_KR.get(p["dominant_landuse"], p["dominant_landuse"])
            display_name = (
                f"{p['name']} [{next_seq}]" if p.get("name")
                else f"{lu_kr} [{next_seq}]"
            )
            partition_key = f"{dong_key}.v2.{next_seq:04d}"

            await session.execute(
                text("""
                    INSERT INTO world_partition (
                        id, partition_key, admin_area_id,
                        city_name, district_name, dong_name,
                        partition_stage, partition_seq,
                        source_layer, display_name,
                        theme_code, landuse_code, dominant_landuse,
                        persona_tag, texture_profile,
                        is_road, area_m2,
                        centroid_lat, centroid_lng, boundary_geojson,
                        source_feature, gameplay_meta
                    ) VALUES (
                        :id, :pk, :aid,
                        :city, :dist, :dong,
                        'primary', :seq,
                        :layer, :dname,
                        :theme, :lu, :lu,
                        NULL, NULL,
                        :is_road, :area,
                        :clat, :clng, :bjson,
                        :sfeat, NULL
                    )
                """),
                {
                    "id":      next_id,
                    "pk":      partition_key,
                    "aid":     admin_area_id,
                    "city":    city_name,
                    "dist":    district_name,
                    "dong":    dong_name,
                    "seq":     next_seq,
                    "layer":   p["source_layer"],
                    "dname":   display_name,
                    "theme":   p["theme_code"],
                    "lu":      p["dominant_landuse"],
                    "is_road": p.get("is_road", False),
                    "area":    p["area_m2"],
                    "clat":    p["centroid_lat"],
                    "clng":    p["centroid_lng"],
                    "bjson":   json.dumps(p["boundary_geojson"], ensure_ascii=False),
                    "sfeat":   json.dumps({"osm_layer": p["source_layer"]}, ensure_ascii=False),
                },
            )
            next_id   += 1
            next_seq  += 1

        await session.commit()
        print(f"[INSERT] {len(all_new_items)}개 삽입 완료")
        print(f"\n[DONE] 다음 단계: python back/scripts/regroup_partition_members.py --dong-osm-id {dong_osm_id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dong-osm-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--types", nargs="+",
        choices=SPECIAL_LANDUSE_TYPES,
        default=SPECIAL_LANDUSE_TYPES,
        help="처리할 landuse 종류 (기본: 전체)",
    )
    args = parser.parse_args()
    asyncio.run(build_special_partitions(args.dong_osm_id, args.dry_run, args.types))
