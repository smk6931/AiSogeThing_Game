"""
OSM road-polygonize 기반 파티션 생성 스크립트 v2
— 도로 라인을 polygonize해서 도로로 둘러싸인 블록을 파티션으로 사용
— service/footway/path 제외한 도로만 경계로 사용
— 큰 블록은 장축(longest axis) 기준 분할 (격자 아님)
— 작은 자투리는 인접 큰 파티션에 흡수

사용법:
  python back/scripts/build_partitions_from_osm.py --dong-osm-id 3879474 --dry-run
  python back/scripts/build_partitions_from_osm.py --dong-osm-id 3879474
"""

import asyncio
import argparse
import json
import math
import sys
import re
import time
from pathlib import Path
from collections import defaultdict

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
CACHE_DIR = BACK_DIR / "world" / "data" / "osm_cache"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from shapely.geometry import shape, mapping, box, LineString, MultiLineString, MultiPolygon, Polygon
from shapely.ops import unary_union, polygonize, split as shapely_split
from shapely.affinity import rotate
from sqlalchemy import text
from core.database import async_session_factory

LAT_TO_M = 111000
LNG_TO_M = 88000

# 파티션 크기 기준 (m²)
TARGET_MIN_M2   = 3_000    # 이 미만 → 인접 파티션에 흡수
TARGET_MAX_M2   = 10_000   # 이 초과 → 장축 분할
ABSORB_MIN_M2   = 500      # 이 미만은 무조건 흡수
SPLIT_MAX_DEPTH = 6        # 최대 재귀 분할 횟수

# 경계로 쓸 도로 등급 (service/footway/path 제외)
BOUNDARY_HIGHWAY = {
    "motorway", "motorway_link",
    "trunk", "trunk_link",
    "primary", "primary_link",
    "secondary", "secondary_link",
    "tertiary", "tertiary_link",
    "residential", "living_street",
    "unclassified",
}

# landuse 태그 → (dominant_landuse, theme_code)
LANDUSE_MAP = {
    "water":          ("water",       "ancient_waterway"),
    "river":          ("water",       "ancient_waterway"),
    "stream":         ("water",       "ancient_waterway"),
    "canal":          ("water",       "ancient_waterway"),
    "park":           ("park",        "sanctuary_green"),
    "forest":         ("forest",      "sanctuary_green"),
    "wood":           ("forest",      "sanctuary_green"),
    "grass":          ("park",        "sanctuary_green"),
    "meadow":         ("park",        "sanctuary_green"),
    "scrub":          ("forest",      "sanctuary_green"),
    "nature_reserve": ("forest",      "sanctuary_green"),
    "cemetery":       ("cemetery",    "sanctuary_green"),
    "grave_yard":     ("cemetery",    "sanctuary_green"),
    "residential":    ("residential", "residential_zone"),
    "housing":        ("residential", "residential_zone"),
    "commercial":     ("commercial",  "urban_district"),
    "retail":         ("commercial",  "urban_district"),
    "mixed_use":      ("commercial",  "urban_district"),
    "school":         ("educational", "academy_sanctum"),
    "university":     ("educational", "academy_sanctum"),
    "college":        ("educational", "academy_sanctum"),
    "kindergarten":   ("educational", "academy_sanctum"),
    "hospital":       ("medical",     "sanctuary_healing"),
    "clinic":         ("medical",     "sanctuary_healing"),
    "industrial":     ("industrial",  "forge_district"),
    "railway":        ("industrial",  "forge_district"),
    "military":       ("military",    "fortress_grounds"),
    "stadium":        ("park",        "sanctuary_green"),
    "sports_centre":  ("park",        "sanctuary_green"),
    "pitch":          ("park",        "sanctuary_green"),
    "recreation_ground": ("park",     "sanctuary_green"),
    "allotments":     ("residential", "residential_zone"),
}
LANDUSE_PRIORITY = [
    "water", "river", "stream", "canal",
    "park", "forest", "wood", "grass", "meadow", "scrub", "nature_reserve",
    "cemetery", "grave_yard",
    "university", "college", "school", "kindergarten",
    "hospital", "clinic",
    "military",
    "industrial", "railway",
    "commercial", "retail", "mixed_use",
    "stadium", "sports_centre", "pitch", "recreation_ground",
    "residential", "housing",
    "allotments",
]


def area_m2(geom) -> float:
    c = geom.centroid
    return geom.area * LAT_TO_M * (math.cos(math.radians(c.y)) * LAT_TO_M)


def centroid_latng(geom) -> tuple[float, float]:
    c = geom.centroid
    return c.y, c.x


# ── 장축 분할 (격자 아님) ──────────────────────────────────────────────────

def longest_axis_split(geom, target_max: float, depth: int = 0) -> list:
    """
    폴리곤을 장축 기준으로 절반씩 분할. 재귀적으로 target_max 이하까지.
    격자와 달리 폴리곤 모양을 최대한 유지.
    """
    if area_m2(geom) <= target_max or depth >= SPLIT_MAX_DEPTH:
        return [geom]

    # 최소 외접 직사각형의 장축 방향 계산
    try:
        rect = geom.minimum_rotated_rectangle
        coords = list(rect.exterior.coords)
        # 두 변의 길이 계산
        dx0 = coords[1][0] - coords[0][0]
        dy0 = coords[1][1] - coords[0][1]
        dx1 = coords[2][0] - coords[1][0]
        dy1 = coords[2][1] - coords[1][1]
        len0 = math.sqrt(dx0**2 + dy0**2)
        len1 = math.sqrt(dx1**2 + dy1**2)

        # 장축이 어느 쪽인지 결정
        if len0 >= len1:
            # 변0이 장축 → 변1 방향으로 자름 (중점 수직)
            mid_x = (coords[0][0] + coords[1][0]) / 2
            mid_y = (coords[0][1] + coords[1][1]) / 2
            # 장축에 수직인 방향으로 자르는 선
            cut_dx = coords[2][0] - coords[1][0]
            cut_dy = coords[2][1] - coords[1][1]
        else:
            mid_x = (coords[1][0] + coords[2][0]) / 2
            mid_y = (coords[1][1] + coords[2][1]) / 2
            cut_dx = coords[1][0] - coords[0][0]
            cut_dy = coords[1][1] - coords[0][1]

        # 자르는 선 (충분히 길게)
        scale = 10.0
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


def _flatten(geom) -> list:
    if geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom] if geom.is_valid else [geom.buffer(0)]
    if geom.geom_type == "MultiPolygon":
        return [g if g.is_valid else g.buffer(0) for g in geom.geoms]
    return [g for g in getattr(geom, "geoms", []) if g.geom_type in ("Polygon", "MultiPolygon")]


# ── OSM feature로 블록에 landuse 태그 매핑 ───────────────────────────────

def assign_landuse(block: Polygon, feature_index: list) -> tuple[str, str, str]:
    """
    블록과 가장 많이 겹치는 OSM feature의 landuse를 매핑.
    Returns: (dominant_landuse, theme_code, name)
    """
    best_lu, best_theme, best_name = "residential", "residential_zone", ""
    best_priority = len(LANDUSE_PRIORITY)
    best_area = 0.0

    for feat_geom, props in feature_index:
        try:
            inter = block.intersection(feat_geom)
            if inter.is_empty:
                continue
            inter_area = inter.area
            if inter_area < block.area * 0.1:
                continue  # 10% 미만 겹침은 무시

            tags = props.get("tags", {})
            for key in ["leisure", "natural", "landuse", "waterway", "amenity"]:
                val = tags.get(key, "")
                if val in LANDUSE_MAP:
                    priority = LANDUSE_PRIORITY.index(val) if val in LANDUSE_PRIORITY else 99
                    if priority < best_priority or (priority == best_priority and inter_area > best_area):
                        best_lu, best_theme = LANDUSE_MAP[val]
                        best_priority = priority
                        best_area = inter_area
                        best_name = tags.get("name", "")
                    break
        except Exception:
            continue

    return best_lu, best_theme, best_name


# ── 슬리버 흡수 ────────────────────────────────────────────────────────────

def absorb_slivers(items: list[dict], min_area: float) -> list[dict]:
    """area_m2 < min_area 인 파티션을 경계 공유가 가장 긴 이웃으로 흡수"""
    from shapely.geometry import shape as shp
    geoms = [shp(p["boundary_geojson"]) for p in items]

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
            # 가장 많이 접하는 이웃
            best_j, best_len = None, 0.0
            for j in range(len(items)):
                if j == i or j in absorbed:
                    continue
                try:
                    shared = geoms[i].intersection(geoms[j]).length
                    if shared > best_len:
                        best_len = shared
                        best_j = j
                except Exception:
                    continue
            if best_j is not None and best_len > 0:
                geoms[best_j] = geoms[best_j].union(geoms[i])
                absorbed.add(i)
                changed = True
            else:
                keep.append(i)

        new_items = []
        for i in keep:
            p = dict(items[i])
            g = geoms[i]
            if not g.is_valid:
                g = g.buffer(0)
            p["boundary_geojson"] = mapping(g)
            lat, lng = centroid_latng(g)
            p["centroid_lat"] = lat
            p["centroid_lng"] = lng
            p["area_m2"] = area_m2(g)
            new_items.append(p)
        items = new_items
        geoms = [shp(p["boundary_geojson"]) for p in items]

    return items


# ── 도로 라인 → polygonize ──────────────────────────────────────────────────

def build_blocks_from_roads(road_elements: list, dong_geom) -> list:
    """
    도로 라인 + 동 경계선을 polygonize해서 블록 폴리곤 목록 반환
    """
    node_map = {el["id"]: (el["lon"], el["lat"])
                for el in road_elements if el["type"] == "node"}

    lines = []
    for el in road_elements:
        if el["type"] != "way" or "nodes" not in el:
            continue
        tags = el.get("tags", {})
        hw = tags.get("highway", "")
        if hw not in BOUNDARY_HIGHWAY:
            continue
        coords = [node_map[n] for n in el["nodes"] if n in node_map]
        if len(coords) < 2:
            continue
        lines.append(LineString(coords))

    # 동 경계도 라인으로 추가 (외곽 블록이 닫히도록)
    dong_boundary_line = dong_geom.boundary
    if dong_boundary_line.geom_type == "LineString":
        lines.append(dong_boundary_line)
    elif dong_boundary_line.geom_type == "MultiLineString":
        lines.extend(dong_boundary_line.geoms)

    if not lines:
        return []

    # 모든 라인을 node 단위로 분해 (polygonize 정확도 향상)
    all_lines = unary_union(lines)

    blocks = list(polygonize(all_lines))
    print(f"  [polygonize] {len(lines)}개 라인 → {len(blocks)}개 블록 후보")

    # 동 경계로 clip, 너무 작은 것 제거
    result = []
    for blk in blocks:
        clipped = blk.intersection(dong_geom)
        for piece in _flatten(clipped):
            if area_m2(piece) >= ABSORB_MIN_M2:
                result.append(piece)

    return result


# ── 메인 ──────────────────────────────────────────────────────────────────

async def build_partitions(dong_osm_id: int, dry_run: bool) -> None:
    async with async_session_factory() as session:
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
            print(f"[ERROR] dong osm_id={dong_osm_id} not found")
            return

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
        print(f"[INFO] 동: {dong_name} (id={admin_area_id})")

        # OSM feature 캐시
        feat_path = CACHE_DIR / f"{dong_osm_id}_features.geojson"
        if not feat_path.exists():
            print(f"[ERROR] OSM 캐시 없음. 먼저 실행:")
            print(f"  python back/scripts/fetch_osm_features.py --dong-osm-id {dong_osm_id}")
            return
        features = json.loads(feat_path.read_text(encoding="utf-8"))["features"]
        print(f"[INFO] OSM feature {len(features)}개 로드")

        # feature index (shapely geom + props)
        feature_index = []
        for feat in features:
            try:
                g = shape(feat["geometry"])
                if not g.is_valid:
                    g = g.buffer(0)
                feature_index.append((g, feat["properties"]))
            except Exception:
                pass

        # 도로 캐시
        road_cache = CACHE_DIR / f"{dong_osm_id}_roads.json"
        if not road_cache.exists():
            print("[ERROR] 도로 캐시 없음. fetch_osm_features.py 재실행 필요")
            return
        road_elements = json.loads(road_cache.read_text(encoding="utf-8"))
        print(f"[INFO] 도로 {len(road_elements)}개 element 로드")

        # ── 1. 도로 → polygonize → 블록 ─────────────────────────────────
        print("[INFO] 도로 polygonize 중...")
        blocks = build_blocks_from_roads(road_elements, dong_geom)
        print(f"[INFO] 유효 블록: {len(blocks)}개")

        # ── 2. 각 블록에 landuse 매핑 ────────────────────────────────────
        raw_items = []
        for blk in blocks:
            dom_lu, theme, name = assign_landuse(blk, feature_index)
            raw_items.append({
                "geom": blk,
                "dominant_landuse": dom_lu,
                "theme_code": theme,
                "name": name,
                "source_layer": "road_block",
                "is_road": False,
                "area_m2": area_m2(blk),
                "centroid_lat": centroid_latng(blk)[0],
                "centroid_lng": centroid_latng(blk)[1],
            })

        # ── 3. 큰 블록 → 장축 분할 ──────────────────────────────────────
        split_items = []
        for item in raw_items:
            if item["area_m2"] > TARGET_MAX_M2 and not item["is_road"]:
                pieces = longest_axis_split(item["geom"], TARGET_MAX_M2)
                for piece in pieces:
                    dom_lu, theme, name = assign_landuse(piece, feature_index)
                    split_items.append({
                        **item,
                        "geom": piece,
                        "dominant_landuse": dom_lu,
                        "theme_code": theme,
                        "name": name,
                        "area_m2": area_m2(piece),
                        "centroid_lat": centroid_latng(piece)[0],
                        "centroid_lng": centroid_latng(piece)[1],
                    })
            else:
                split_items.append(item)

        print(f"[INFO] 장축 분할 후: {len(split_items)}개")

        # ── 4. boundary_geojson 직렬화 ─────────────────────────────────
        for item in split_items:
            item["boundary_geojson"] = mapping(item["geom"])
            del item["geom"]

        # ── 5. 슬리버 흡수 (TARGET_MIN_M2 미만) ─────────────────────────
        split_items = absorb_slivers(split_items, TARGET_MIN_M2)
        print(f"[INFO] 슬리버 흡수 후: {len(split_items)}개")

        # ── 6. 통계 ─────────────────────────────────────────────────────
        areas = sorted([p["area_m2"] for p in split_items])
        by_lu = defaultdict(int)
        for p in split_items:
            by_lu[p["dominant_landuse"]] += 1

        tiny  = sum(1 for a in areas if a < 2_000)
        good  = sum(1 for a in areas if 2_000 <= a <= 10_000)
        large = sum(1 for a in areas if a > 10_000)

        print(f"\n[SUMMARY] 총 {len(split_items)}개 파티션")
        print(f"  면적: avg={sum(areas)/len(areas):.0f}m²  "
              f"median={areas[len(areas)//2]:.0f}m²  "
              f"min={areas[0]:.0f}m²  max={areas[-1]:.0f}m²")
        print(f"  크기: tiny(<2k)={tiny}  good(2~10k)={good}  large(>10k)={large}")
        print(f"  landuse별:")
        for lu, cnt in sorted(by_lu.items(), key=lambda x: -x[1]):
            print(f"    {lu:20s}: {cnt:4d}개")

        if dry_run:
            print("\n[DRY-RUN] DB 변경 없음.")
            return

        # ── 7. DB 교체 ──────────────────────────────────────────────────
        old_rows = await session.execute(
            text("SELECT id FROM world_partition WHERE admin_area_id = :aid"),
            {"aid": admin_area_id},
        )
        old_ids = [r[0] for r in old_rows]
        await session.execute(
            text("DELETE FROM world_partition_group_member WHERE partition_id = ANY(:ids)"),
            {"ids": old_ids},
        )
        await session.execute(
            text("DELETE FROM world_partition WHERE id = ANY(:ids)"),
            {"ids": old_ids},
        )
        print(f"\n[UPDATE] 기존 파티션 {len(old_ids)}개 삭제")

        max_id_row = await session.execute(text("SELECT COALESCE(MAX(id), 0) FROM world_partition"))
        next_id = max_id_row.scalar() + 1

        dong_key = re.sub(r"[^a-z0-9._]", "",
                          f"seoul.{district_name}.{dong_name}".lower().replace(" ", "_"))

        LANDUSE_KR = {
            "water": "수계", "park": "공원", "forest": "숲",
            "residential": "주거", "commercial": "상업",
            "educational": "교육", "medical": "의료",
            "road": "도로", "military": "군사",
            "industrial": "산업", "cemetery": "묘지",
        }

        for seq, p in enumerate(split_items, start=1):
            lu_kr = LANDUSE_KR.get(p["dominant_landuse"], p["dominant_landuse"])
            display_name = f"{p['name']} [{seq}]" if p.get("name") else f"{lu_kr} [{seq}]"
            partition_key = f"{dong_key}.v2.{seq:04d}"

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
                    "id":     next_id,
                    "pk":     partition_key,
                    "aid":    admin_area_id,
                    "city":   city_name,
                    "dist":   district_name,
                    "dong":   dong_name,
                    "seq":    seq,
                    "layer":  p["source_layer"],
                    "dname":  display_name,
                    "theme":  p["theme_code"],
                    "lu":     p["dominant_landuse"],
                    "is_road": p.get("is_road", False),
                    "area":   p["area_m2"],
                    "clat":   p["centroid_lat"],
                    "clng":   p["centroid_lng"],
                    "bjson":  json.dumps(p["boundary_geojson"], ensure_ascii=False),
                    "sfeat":  json.dumps({"osm_layer": p["source_layer"]}, ensure_ascii=False),
                },
            )
            next_id += 1

        await session.commit()
        print(f"[DONE] {len(split_items)}개 파티션 삽입 완료.")
        print(f"\n[NEXT] python back/scripts/regroup_partition_members.py --dong-osm-id {dong_osm_id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dong-osm-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(build_partitions(args.dong_osm_id, dry_run=args.dry_run))
