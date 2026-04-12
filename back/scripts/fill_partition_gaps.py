"""
fill_partition_gaps.py

동 경계와 파티션 union 사이의 gap을 찾아 인접 파티션에 흡수.

알고리즘:
  1. 동 경계 - 파티션 union = gap 폴리곤들
  2. 200m² 미만 gap → 무시 (수치 오차)
  3. 각 gap에 대해: 공유 경계 길이가 가장 긴 인접 파티션 탐색
  4. 해당 파티션의 boundary_geojson에 gap을 union해서 업데이트

사용법:
  python back/scripts/fill_partition_gaps.py --dong-osm-id 3879474 --dry-run
  python back/scripts/fill_partition_gaps.py --dong-osm-id 3879474
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path
from collections import defaultdict

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from shapely.geometry import shape, mapping, MultiPolygon, Polygon
from shapely.ops import unary_union
from sqlalchemy import text
from core.database import async_session_factory

# 이 미만 gap은 수치 오차로 무시
GAP_MIN_M2 = 200
LAT_TO_M = 111320
LNG_TO_M = 88574


def approx_area_m2(geom) -> float:
    polys = list(geom.geoms) if geom.geom_type == "MultiPolygon" else [geom]
    total = 0.0
    for poly in polys:
        coords = list(poly.exterior.coords)
        a = 0.0
        for i in range(len(coords) - 1):
            lng1, lat1 = coords[i]
            lng2, lat2 = coords[i + 1]
            a += (lng1 * LNG_TO_M) * (lat2 * LAT_TO_M) - (lng2 * LNG_TO_M) * (lat1 * LAT_TO_M)
        total += abs(a) / 2
    return total


def find_best_neighbor(gap_geom, partitions):
    """gap과 공유 경계가 가장 긴 파티션 반환"""
    best_id = None
    best_len = 0.0
    # 약간 확장해서 경계 접촉 감지
    gap_expanded = gap_geom.buffer(1e-6)
    for p in partitions:
        try:
            shared = gap_expanded.intersection(p["geom"])
            if shared.is_empty:
                continue
            shared_len = shared.length
            if shared_len > best_len:
                best_len = shared_len
                best_id = p["id"]
        except Exception:
            continue
    return best_id, best_len


async def fill_gaps(dong_osm_id: int, dry_run: bool, min_gap_m2: float = GAP_MIN_M2) -> None:
    async with async_session_factory() as session:
        # 동 정보
        row = await session.execute(
            text("SELECT id, name, boundary_geojson FROM world_area WHERE osm_id=:osm_id AND area_level='dong' LIMIT 1"),
            {"osm_id": dong_osm_id},
        )
        area = row.mappings().first()
        if not area:
            print(f"[ERROR] dong osm_id={dong_osm_id} not found")
            return

        admin_area_id = area["id"]
        dong_name = area["name"]
        raw_bnd = area["boundary_geojson"]
        if isinstance(raw_bnd, str):
            raw_bnd = json.loads(raw_bnd)
        dong_geom = shape(raw_bnd).buffer(0)
        print(f"[INFO] {dong_name} (id={admin_area_id})")

        # 파티션 로드
        part_rows = await session.execute(
            text("SELECT id, partition_key, boundary_geojson, dominant_landuse, area_m2 FROM world_partition WHERE admin_area_id=:aid"),
            {"aid": admin_area_id},
        )
        partitions = []
        part_geoms = []
        for r in part_rows.mappings():
            bj = r["boundary_geojson"]
            if bj is None:
                continue
            if isinstance(bj, str):
                bj = json.loads(bj)
            try:
                g = shape(bj).buffer(0)
                if not g.is_empty:
                    partitions.append({
                        "id": r["id"],
                        "key": r["partition_key"],
                        "geom": g,
                        "landuse": r["dominant_landuse"],
                        "area": r["area_m2"] or 0,
                        "boundary_json": bj,
                    })
                    part_geoms.append(g)
            except Exception as e:
                print(f"  [WARN] 파티션 {r['id']} 파싱 오류: {e}")

        print(f"[INFO] 파티션 {len(partitions)}개 로드")

        # gap 계산
        union_all = unary_union(part_geoms).buffer(0)
        gap = dong_geom.difference(union_all)

        if gap.is_empty:
            print("[INFO] gap 없음 — 완전 커버리지!")
            return

        pieces = list(gap.geoms) if gap.geom_type == "MultiPolygon" else [gap]
        gap_pieces = []
        for p in pieces:
            p = p.buffer(0)
            if p.is_empty:
                continue
            area_m2 = approx_area_m2(p)
            if area_m2 >= min_gap_m2:
                gap_pieces.append({"geom": p, "area": area_m2, "centroid": p.centroid})

        gap_pieces.sort(key=lambda x: -x["area"])
        total_gap = sum(g["area"] for g in gap_pieces)
        print(f"[INFO] {min_gap_m2}m² 초과 gap: {len(gap_pieces)}개 / 총 {total_gap:,.0f} m²")

        # gap별 최적 이웃 파티션 찾기 + 흡수
        absorb_map: dict[int, list] = defaultdict(list)  # partition_id → [gap_geom, ...]
        unmatched = []

        for i, gp in enumerate(gap_pieces):
            best_id, best_len = find_best_neighbor(gp["geom"], partitions)
            if best_id is None:
                unmatched.append(gp)
                print(f"  gap{i+1:02d}: {gp['area']:>8,.0f} m² → [UNMATCHED] 인접 파티션 없음")
            else:
                absorb_map[best_id].append(gp["geom"])
                pk = next(p["key"] for p in partitions if p["id"] == best_id)
                print(f"  gap{i+1:02d}: {gp['area']:>8,.0f} m²  lat={gp['centroid'].y:.5f} lng={gp['centroid'].x:.5f}  → {pk}")

        if unmatched:
            print(f"\n[WARN] {len(unmatched)}개 gap 미처리 (인접 파티션 없음)")

        if dry_run:
            print(f"\n[DRY-RUN] {len(absorb_map)}개 파티션 업데이트 예정. DB 변경 없음.")
            return

        # DB 업데이트
        update_count = 0
        for part in partitions:
            gaps_to_absorb = absorb_map.get(part["id"])
            if not gaps_to_absorb:
                continue

            new_geom = unary_union([part["geom"]] + gaps_to_absorb).buffer(0)
            if new_geom.is_empty:
                continue

            # MultiPolygon이면 가장 큰 것 기준으로 단순화 (필요시)
            # 그대로 저장해도 되지만 작은 잡음 제거
            if new_geom.geom_type == "MultiPolygon":
                polys = list(new_geom.geoms)
                max_area = max(p.area for p in polys)
                cleaned = [p for p in polys if p.area >= max_area * 0.01]
                if len(cleaned) == 1:
                    new_geom = cleaned[0]
                else:
                    new_geom = MultiPolygon(cleaned)

            new_area = approx_area_m2(new_geom)
            new_gj = json.dumps(mapping(new_geom), ensure_ascii=False)

            await session.execute(
                text("""
                    UPDATE world_partition
                    SET boundary_geojson = CAST(:boundary AS json),
                        area_m2 = :area,
                        updated_at = NOW()
                    WHERE id = :pid
                """),
                {"boundary": new_gj, "area": new_area, "pid": part["id"]},
            )
            absorbed_area = sum(approx_area_m2(g) for g in gaps_to_absorb)
            print(f"  [UPDATE] {part['key']}: +{absorbed_area:,.0f} m² 흡수 → 총 {new_area:,.0f} m²")
            update_count += 1

        await session.commit()
        print(f"\n[DONE] {dong_name}: {update_count}개 파티션 업데이트, {len(gap_pieces)}개 gap 흡수")
        print(f"       흡수 면적: {total_gap:,.0f} m²")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="파티션 gap을 인접 파티션에 흡수")
    parser.add_argument("--dong-osm-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--min-gap-m2", type=float, default=GAP_MIN_M2,
                        help=f"이 면적 미만 gap 무시 (기본값: {GAP_MIN_M2}m²)")
    args = parser.parse_args()
    asyncio.run(fill_gaps(args.dong_osm_id, args.dry_run, args.min_gap_m2))
