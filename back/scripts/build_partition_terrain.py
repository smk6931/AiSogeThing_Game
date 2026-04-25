"""
world_partition.boundary_geojson − world_road 폴리곤들의 union → terrain_geojson 계산 스크립트

Shapely 기반 (PostGIS 의존 없음).
동 단위로 실행. 파티션의 boundary_geojson에서 해당 동 도로 union을 빼서 terrain_geojson 저장.

사용법:
  python back/scripts/build_partition_terrain.py --dong-osm-id 3879474 --dry-run
  python back/scripts/build_partition_terrain.py --dong-osm-id 3879474
  python back/scripts/build_partition_terrain.py --all            # 도로 있는 모든 동 일괄
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

from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from sqlalchemy import text
from core.database import async_session_factory


async def process_dong(session, dong_id: int, dry_run: bool):
    roads = await session.execute(text("""
        SELECT id, boundary_geojson FROM world_road WHERE dong_id = :dong_id
    """), {"dong_id": dong_id})
    road_rows = list(roads.mappings())
    if not road_rows:
        print(f"  [SKIP] dong_id={dong_id}: 도로 없음")
        return 0

    road_geoms = []
    for r in road_rows:
        raw = r["boundary_geojson"]
        if isinstance(raw, str):
            raw = json.loads(raw)
        g = shape(raw)
        if not g.is_valid:
            g = g.buffer(0)
        if not g.is_empty:
            road_geoms.append(g)
    road_union = unary_union(road_geoms) if road_geoms else None
    if road_union is None or road_union.is_empty:
        print(f"  [SKIP] dong_id={dong_id}: 유효한 도로 geometry 없음")
        return 0

    parts = await session.execute(text("""
        SELECT id, partition_key, boundary_geojson
        FROM world_partition
        WHERE admin_area_id = :dong_id AND is_road = false
    """), {"dong_id": dong_id})
    part_rows = list(parts.mappings())
    print(f"  [INFO] dong_id={dong_id}: 파티션 {len(part_rows)}개, 도로 {len(road_geoms)}개 union")

    updated = 0
    for p in part_rows:
        raw = p["boundary_geojson"]
        if isinstance(raw, str):
            raw = json.loads(raw)
        part_geom = shape(raw)
        if not part_geom.is_valid:
            part_geom = part_geom.buffer(0)

        if not part_geom.intersects(road_union):
            continue

        diff = part_geom.difference(road_union)
        if diff.is_empty:
            continue

        terrain_geojson = mapping(diff)

        if dry_run:
            updated += 1
            continue

        await session.execute(text("""
            UPDATE world_partition
            SET terrain_geojson = CAST(:geojson AS json)
            WHERE id = :pid
        """), {"geojson": json.dumps(terrain_geojson), "pid": p["id"]})
        updated += 1

    if not dry_run:
        await session.commit()

    print(f"  [DONE] dong_id={dong_id}: {updated}개 파티션 업데이트 (dry_run={dry_run})")
    return updated


async def run(dong_osm_id: int | None, all_dongs: bool, dry_run: bool):
    async with async_session_factory() as session:
        if all_dongs:
            dongs = await session.execute(text("""
                SELECT DISTINCT dong_id FROM world_road WHERE dong_id IS NOT NULL
            """))
            dong_ids = [r["dong_id"] for r in dongs.mappings()]
            print(f"[INFO] 대상 동: {len(dong_ids)}개")
            total = 0
            for did in dong_ids:
                total += await process_dong(session, did, dry_run)
            print(f"[TOTAL] {total}개 파티션 업데이트")
        else:
            row = await session.execute(text(
                "SELECT id FROM world_area WHERE osm_id = :osm_id AND area_level = 'dong' LIMIT 1"
            ), {"osm_id": dong_osm_id})
            dong = row.mappings().first()
            if not dong:
                print(f"[ERROR] dong osm_id={dong_osm_id} not found")
                return
            await process_dong(session, dong["id"], dry_run)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dong-osm-id", type=int)
    parser.add_argument("--all", action="store_true", help="도로 있는 모든 동 일괄 처리")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.all and not args.dong_osm_id:
        parser.error("--dong-osm-id 또는 --all 필요")
    asyncio.run(run(args.dong_osm_id, args.all, args.dry_run))
