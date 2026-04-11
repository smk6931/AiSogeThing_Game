"""
대형 파티션 자동 분할 스크립트
— area_m2 > SPLIT_THRESHOLD_M2 인 파티션을 격자(Grid) 방식으로 분할

알고리즘:
  1. 임계값 초과 파티션 조회
  2. bbox 기반 NxM 격자 생성 → 원본 polygon과 교차 → 서브 polygon 생성
  3. 원본 파티션 DELETE → 서브 파티션 INSERT
  4. world_partition_group_member 정리 (regroup 스크립트 별도 실행 필요)

사용법:
  python back/scripts/split_large_partitions.py --dong-osm-id 3879474 [--dry-run]
  python back/scripts/split_large_partitions.py --dong-osm-id 3879474 [--threshold 15000]
"""

import asyncio
import argparse
import json
import math
import sys
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from shapely.geometry import shape, mapping, box
from sqlalchemy import text
from core.database import async_session_factory

LAT_TO_M = 111000
LNG_TO_M = 88000

SPLIT_THRESHOLD_M2 = 15_000   # 이 면적 초과 시 분할
TARGET_AREA_M2     = 8_000    # 목표 서브 파티션 면적
MIN_SUB_AREA_M2    = 500      # 이보다 작은 서브 polygon은 버림


def area_m2_from_shape(geom) -> float:
    centroid = geom.centroid
    lat_scale = LAT_TO_M
    lng_scale = math.cos(math.radians(centroid.y)) * LAT_TO_M
    return geom.area * lat_scale * lng_scale


def centroid_latng(geom) -> tuple[float, float]:
    c = geom.centroid
    return c.y, c.x  # lat, lng


def grid_split(geom, target_area_m2: float) -> list:
    total_area = area_m2_from_shape(geom)
    n_cells = max(2, math.ceil(total_area / target_area_m2))

    minx, miny, maxx, maxy = geom.bounds
    width = maxx - minx
    height = maxy - miny

    aspect = (width * LNG_TO_M) / max(height * LAT_TO_M, 1e-10)
    cols = max(1, round(math.sqrt(n_cells * aspect)))
    rows = max(1, math.ceil(n_cells / cols))

    cell_w = width / cols
    cell_h = height / rows

    sub_polys = []
    for r in range(rows):
        for c in range(cols):
            cell = box(
                minx + c * cell_w,
                miny + r * cell_h,
                minx + (c + 1) * cell_w,
                miny + (r + 1) * cell_h,
            )
            inter = geom.intersection(cell)
            if inter.is_empty:
                continue
            if inter.geom_type == "MultiPolygon":
                parts = list(inter.geoms)
            elif inter.geom_type == "Polygon":
                parts = [inter]
            else:
                parts = [p for p in getattr(inter, "geoms", []) if p.geom_type == "Polygon"]

            for part in parts:
                if area_m2_from_shape(part) >= MIN_SUB_AREA_M2:
                    sub_polys.append(part)

    return sub_polys


async def split_partitions(dong_osm_id: int, threshold: int, dry_run: bool) -> None:
    async with async_session_factory() as session:
        area_row = await session.execute(
            text("SELECT id FROM world_area WHERE osm_id = :osm_id AND area_level = 'dong' LIMIT 1"),
            {"osm_id": dong_osm_id},
        )
        area = area_row.mappings().first()
        if not area:
            print(f"[ERROR] dong osm_id={dong_osm_id} not found")
            return
        admin_area_id = area["id"]

        rows = await session.execute(
            text("""
                SELECT id, partition_seq, partition_key, partition_stage,
                       source_layer, display_name, summary, description,
                       theme_code, landuse_code, dominant_landuse,
                       persona_tag, texture_profile, is_road,
                       area_m2, boundary_geojson,
                       source_feature, gameplay_meta,
                       city_name, district_name, dong_name
                FROM world_partition
                WHERE admin_area_id = :aid
                  AND is_road = false
                  AND area_m2 > :threshold
                ORDER BY area_m2 DESC
            """),
            {"aid": admin_area_id, "threshold": threshold},
        )
        targets = [dict(r) for r in rows.mappings()]
        print(f"[INFO] 분할 대상: {len(targets)}개 파티션 (임계값 {threshold:,}m²)")

        if not targets:
            print("[INFO] 분할 대상 없음.")
            return

        seq_row = await session.execute(
            text("SELECT COALESCE(MAX(partition_seq), 0) FROM world_partition WHERE admin_area_id = :aid"),
            {"aid": admin_area_id},
        )
        next_seq = seq_row.scalar() + 1

        max_id_row = await session.execute(
            text("SELECT COALESCE(MAX(id), 0) FROM world_partition")
        )
        next_id = max_id_row.scalar() + 1

        total_before = 0
        total_after = 0
        all_new_partitions = []

        for p in targets:
            raw = p.get("boundary_geojson")
            if not raw:
                print(f"  [SKIP] seq={p['partition_seq']} boundary_geojson 없음")
                continue

            try:
                geom = shape(raw) if isinstance(raw, dict) else shape(json.loads(raw))
            except Exception as e:
                print(f"  [SKIP] seq={p['partition_seq']} geom 파싱 실패: {e}")
                continue

            sub_polys = grid_split(geom, TARGET_AREA_M2)
            total_before += 1
            total_after += len(sub_polys)

            areas = [area_m2_from_shape(sp) for sp in sub_polys]
            print(f"  seq={p['partition_seq']:3d} | {p['area_m2']:>8.0f}m² → {len(sub_polys)}개 "
                  f"(avg {sum(areas)/len(areas):.0f}m², min {min(areas):.0f}m²)")

            for i, sp in enumerate(sub_polys):
                lat, lng = centroid_latng(sp)
                a_m2 = area_m2_from_shape(sp)
                new_key = f"{p['partition_key']}_s{i+1:02d}"
                new_display = f"{p['display_name']} {i+1}"

                all_new_partitions.append({
                    "id": next_id,
                    "partition_key": new_key,
                    "admin_area_id": admin_area_id,
                    "city_name": p["city_name"],
                    "district_name": p["district_name"],
                    "dong_name": p["dong_name"],
                    "partition_stage": p["partition_stage"],
                    "partition_seq": next_seq,
                    "source_layer": p["source_layer"],
                    "display_name": new_display,
                    "summary": p["summary"],
                    "description": p["description"],
                    "theme_code": p["theme_code"],
                    "landuse_code": p["landuse_code"],
                    "dominant_landuse": p["dominant_landuse"],
                    "persona_tag": p["persona_tag"],
                    "texture_profile": p["texture_profile"],
                    "is_road": False,
                    "area_m2": a_m2,
                    "centroid_lat": lat,
                    "centroid_lng": lng,
                    "boundary_geojson": mapping(sp),
                    "source_feature": p["source_feature"],
                    "gameplay_meta": p["gameplay_meta"],
                })
                next_id += 1
                next_seq += 1

        print(f"\n[SUMMARY] {total_before}개 → {total_after}개 서브 파티션")

        if dry_run:
            print("\n[DRY-RUN] DB 변경 없음.")
            return

        orig_ids = [p["id"] for p in targets]

        await session.execute(
            text("DELETE FROM world_partition_group_member WHERE partition_id = ANY(:ids)"),
            {"ids": orig_ids},
        )
        print(f"[UPDATE] group_member {len(orig_ids)}개 삭제")

        await session.execute(
            text("DELETE FROM world_partition WHERE id = ANY(:ids)"),
            {"ids": orig_ids},
        )
        print(f"[UPDATE] 원본 파티션 {len(orig_ids)}개 삭제")

        for np_ in all_new_partitions:
            await session.execute(
                text("""
                    INSERT INTO world_partition (
                        id, partition_key, admin_area_id,
                        city_name, district_name, dong_name,
                        partition_stage, partition_seq,
                        source_layer, display_name,
                        summary, description, theme_code, landuse_code,
                        dominant_landuse, persona_tag, texture_profile,
                        is_road, area_m2,
                        centroid_lat, centroid_lng, boundary_geojson,
                        source_feature, gameplay_meta
                    ) VALUES (
                        :id, :partition_key, :admin_area_id,
                        :city_name, :district_name, :dong_name,
                        :partition_stage, :partition_seq,
                        :source_layer, :display_name,
                        :summary, :description, :theme_code, :landuse_code,
                        :dominant_landuse, :persona_tag, :texture_profile,
                        :is_road, :area_m2,
                        :centroid_lat, :centroid_lng, :boundary_geojson,
                        :source_feature, :gameplay_meta
                    )
                """),
                {
                    **np_,
                    "boundary_geojson": json.dumps(np_["boundary_geojson"], ensure_ascii=False),
                    "source_feature": json.dumps(np_["source_feature"], ensure_ascii=False) if np_["source_feature"] else None,
                    "gameplay_meta": json.dumps(np_["gameplay_meta"], ensure_ascii=False) if np_["gameplay_meta"] else None,
                },
            )

        await session.commit()
        print(f"[DONE] {len(all_new_partitions)}개 서브 파티션 삽입 완료.")
        print(f"\n[NEXT] 반드시 regroup 재실행:")
        print(f"  python back/scripts/regroup_partition_members.py --dong-osm-id {dong_osm_id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dong-osm-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--threshold", type=int, default=SPLIT_THRESHOLD_M2)
    args = parser.parse_args()
    asyncio.run(split_partitions(
        dong_osm_id=args.dong_osm_id,
        threshold=args.threshold,
        dry_run=args.dry_run,
    ))
