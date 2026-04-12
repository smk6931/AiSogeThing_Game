"""
update_group_boundaries.py

world_partition_group.boundary_geojson을 개별 파티션 폴리곤의 Shapely unary_union으로 교체.
현재 boundary_geojson = FeatureCollection(개별 파티션 모음) → Polygon/MultiPolygon(unioned)

사용법:
  python back/scripts/update_group_boundaries.py --dong-osm-id 3879474 --dry-run
  python back/scripts/update_group_boundaries.py --dong-osm-id 3879474
  python back/scripts/update_group_boundaries.py --dong-osm-id 3879474 --dong-osm-id 3879477
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from shapely.geometry import shape, mapping
from shapely.ops import unary_union
from sqlalchemy import text
from core.database import async_session_factory


def _flatten_geom(geom):
    """Polygon/MultiPolygon → 개별 Polygon 리스트"""
    if geom is None or geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom]
    if geom.geom_type == "MultiPolygon":
        return list(geom.geoms)
    if geom.geom_type == "GeometryCollection":
        result = []
        for g in geom.geoms:
            result.extend(_flatten_geom(g))
        return result
    return []


async def update_group_boundaries(dong_osm_ids: list[int], dry_run: bool) -> None:
    async with async_session_factory() as session:
        for dong_osm_id in dong_osm_ids:
            # 동 정보 로드
            row = await session.execute(
                text("""
                    SELECT id, name FROM world_area
                    WHERE osm_id = :osm_id AND area_level = 'dong'
                    LIMIT 1
                """),
                {"osm_id": dong_osm_id},
            )
            area = row.mappings().first()
            if not area:
                print(f"[ERROR] dong osm_id={dong_osm_id} 없음")
                continue

            admin_area_id = area["id"]
            dong_name = area["name"]
            print(f"\n[INFO] {dong_name} (id={admin_area_id})")

            # 그룹 로드
            group_rows = await session.execute(
                text("""
                    SELECT id, group_key, group_seq, display_name
                    FROM world_partition_group
                    WHERE admin_area_id = :admin_area_id
                      AND is_active = true
                    ORDER BY group_seq NULLS LAST
                """),
                {"admin_area_id": admin_area_id},
            )
            groups = [dict(r) for r in group_rows.mappings()]
            print(f"[INFO] 그룹 {len(groups)}개 로드")

            # 각 그룹별 멤버 파티션 로드
            member_rows = await session.execute(
                text("""
                    SELECT m.group_id, p.id, p.boundary_geojson
                    FROM world_partition_group_member m
                    JOIN world_partition p ON p.id = m.partition_id
                    WHERE m.group_id IN (
                        SELECT id FROM world_partition_group
                        WHERE admin_area_id = :admin_area_id
                    )
                      AND p.is_road = false
                      AND p.boundary_geojson IS NOT NULL
                """),
                {"admin_area_id": admin_area_id},
            )
            member_list = [dict(r) for r in member_rows.mappings()]
            print(f"[INFO] 비도로 멤버 파티션 {len(member_list)}개 로드")

            # group_id별 파티션 묶기
            from collections import defaultdict
            group_partitions: dict[int, list] = defaultdict(list)
            for m in member_list:
                group_partitions[m["group_id"]].append(m)

            # 그룹별 union 계산 및 업데이트
            update_count = 0
            skip_count = 0

            for g in groups:
                gid = g["id"]
                members = group_partitions.get(gid, [])

                if not members:
                    skip_count += 1
                    continue

                # Shapely union
                polys = []
                for m in members:
                    bj = m["boundary_geojson"]
                    if bj is None:
                        continue
                    if isinstance(bj, str):
                        bj = json.loads(bj)
                    try:
                        geom = shape(bj)
                        if geom.is_valid and not geom.is_empty:
                            polys.append(geom)
                        else:
                            fixed = geom.buffer(0)
                            if not fixed.is_empty:
                                polys.append(fixed)
                    except Exception as e:
                        print(f"  [WARN] 파티션 파싱 오류 ({m['id']}): {e}")
                        continue

                if not polys:
                    skip_count += 1
                    continue

                union_geom = unary_union(polys).buffer(0)
                if union_geom.is_empty:
                    skip_count += 1
                    continue

                # MultiPolygon이면 가장 큰 것만 유지 (작은 잡음 제거)
                # 단, 정상적인 MultiPolygon은 그대로 유지
                if union_geom.geom_type == "MultiPolygon":
                    pieces = list(union_geom.geoms)
                    max_area = max(p.area for p in pieces)
                    # 최대 조각 면적의 1% 미만인 잡음 제거
                    cleaned = [p for p in pieces if p.area >= max_area * 0.01]
                    if len(cleaned) == 1:
                        union_geom = cleaned[0]
                    elif len(cleaned) < len(pieces):
                        from shapely.geometry import MultiPolygon
                        union_geom = MultiPolygon(cleaned)

                union_gj = json.dumps(mapping(union_geom), ensure_ascii=False)
                gk_short = g["group_key"].split(".")[-1]
                geom_type = union_geom.geom_type

                if dry_run:
                    piece_count = len(list(union_geom.geoms)) if geom_type == "MultiPolygon" else 1
                    print(
                        f"  [DRY] {gk_short} '{g['display_name'][:20]}': "
                        f"{len(members)}개 파티션 → {geom_type}({piece_count}조각)"
                    )
                else:
                    await session.execute(
                        text("""
                            UPDATE world_partition_group
                            SET boundary_geojson = CAST(:boundary AS json),
                                updated_at = NOW()
                            WHERE id = :group_id
                        """),
                        {"boundary": union_gj, "group_id": gid},
                    )
                    update_count += 1
                    piece_count = len(list(union_geom.geoms)) if geom_type == "MultiPolygon" else 1
                    print(
                        f"  [OK] {gk_short} '{g['display_name'][:20]}': "
                        f"{len(members)}개 파티션 → {geom_type}({piece_count}조각)"
                    )

            if not dry_run:
                await session.commit()
                print(f"\n[DONE] {dong_name}: {update_count}개 그룹 boundary 업데이트, {skip_count}개 스킵")
            else:
                print(f"\n[DRY-RUN] {dong_name}: {skip_count}개 스킵 (나머지 업데이트 예정)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="그룹 boundary_geojson을 unary_union으로 교체")
    parser.add_argument("--dong-osm-id", type=int, action="append", dest="dong_osm_ids",
                        required=True, metavar="OSM_ID",
                        help="동 OSM ID (여러 개 지정 가능)")
    parser.add_argument("--dry-run", action="store_true", help="DB 변경 없이 결과만 출력")
    args = parser.parse_args()
    asyncio.run(update_group_boundaries(args.dong_osm_ids, args.dry_run))
