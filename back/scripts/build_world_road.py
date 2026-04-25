"""
OSM _roads.json 캐시 → world_road 테이블 생성 스크립트

기존 build_partitions_from_osm.py 가 생성한 {dong_osm_id}_roads.json 을 재활용.
각 highway way를 road_type 기준 너비로 buffer → Polygon 변환 후 DB upsert.
elevation_m은 DB의 world_partition에서 인접 파티션 elevation 가중 평균으로 보간.

사용법:
  python back/scripts/build_world_road.py --dong-osm-id 3879474 --dry-run
  python back/scripts/build_world_road.py --dong-osm-id 3879474
  python back/scripts/build_world_road.py --dong-osm-id 3879474 --overwrite
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
CACHE_DIR = BACK_DIR / "world" / "data" / "osm_cache"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from shapely.geometry import LineString, mapping, shape
from shapely.ops import unary_union
import pyproj
from shapely.ops import transform as shapely_transform
from sqlalchemy import text
from core.database import async_session_factory

# ── 분류 테이블 ──────────────────────────────────────────────────────────────

HIGHWAY_TO_TYPE = {
    "trunk":         "arterial",
    "trunk_link":    "arterial",
    "primary":       "arterial",
    "primary_link":  "arterial",
    "secondary":     "arterial",
    "secondary_link":"arterial",
    "tertiary":      "collector",
    "tertiary_link": "collector",
    "residential":   "collector",
    "living_street": "collector",
    "unclassified":  "local",
    "service":       "local",
    "footway":       "alley",
    "path":          "alley",
    "steps":         "alley",
    "pedestrian":    "alley",
}

TYPE_TO_BUFFER_M = {
    "arterial":  12.0,
    "collector":  7.0,
    "local":      4.0,
    "alley":      2.0,
}

TYPE_TO_MOVEMENT = {
    "arterial":  1.3,
    "collector": 1.1,
    "local":     1.0,
    "alley":     0.85,
}

# WGS84 ↔ EPSG:5186 (한국 평면좌표 — 미터 단위 buffer용)
_proj_to_5186  = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:5186", always_xy=True)
_proj_to_4326  = pyproj.Transformer.from_crs("EPSG:5186", "EPSG:4326", always_xy=True)


def _to_5186(geom):
    return shapely_transform(_proj_to_5186.transform, geom)


def _to_4326(geom):
    return shapely_transform(_proj_to_4326.transform, geom)


def road_line_to_polygon(coords_lnglat: list, width_m: float):
    """LineString [lng,lat] → buffered Polygon (WGS84)"""
    line = LineString(coords_lnglat)
    if len(line.coords) < 2:
        return None
    line_proj = _to_5186(line)
    buffered  = line_proj.buffer(width_m / 2, cap_style=2, join_style=2)  # flat cap, miter join
    if not buffered.is_valid:
        buffered = buffered.buffer(0)
    poly_wgs84 = _to_4326(buffered)
    if poly_wgs84.is_empty or not poly_wgs84.is_valid:
        return None
    return poly_wgs84


def parse_road_elements(road_elements: list) -> list:
    """
    roads.json elements → [{ osm_way_id, highway, name, coords_lnglat }]
    coords_lnglat: [[lng, lat], ...]
    """
    node_map = {el["id"]: (el["lon"], el["lat"])
                for el in road_elements if el["type"] == "node"}
    roads = []
    for el in road_elements:
        if el["type"] != "way" or "nodes" not in el:
            continue
        tags = el.get("tags", {})
        hw = tags.get("highway", "")
        if hw not in HIGHWAY_TO_TYPE:
            continue
        coords = [node_map[n] for n in el["nodes"] if n in node_map]
        if len(coords) < 2:
            continue
        roads.append({
            "osm_way_id": el["id"],
            "highway":    hw,
            "name":       tags.get("name", None),
            "coords":     coords,  # [lng, lat]
        })
    return roads


async def get_dong_info(session, dong_osm_id: int):
    row = await session.execute(text("""
        SELECT id, name, boundary_geojson
        FROM world_area
        WHERE osm_id = :osm_id AND area_level = 'dong'
        LIMIT 1
    """), {"osm_id": dong_osm_id})
    return row.mappings().first()


async def get_partitions_full(session, dong_id: int) -> list:
    """
    dong 내 파티션의 id + boundary_geojson + elevation_m 목록.
    segment 분할 시 ST_Intersection 용 + 각 segment elevation 출처.
    """
    rows = await session.execute(text("""
        SELECT id, boundary_geojson, elevation_m,
               centroid_lat, centroid_lng
        FROM world_partition
        WHERE admin_area_id = :dong_id
          AND boundary_geojson IS NOT NULL
          AND elevation_m IS NOT NULL
          AND is_road = false
    """), {"dong_id": dong_id})
    result = []
    for r in rows.mappings():
        raw = r["boundary_geojson"]
        if isinstance(raw, str):
            raw = json.loads(raw)
        geom = shape(raw)
        if not geom.is_valid:
            geom = geom.buffer(0)
        if geom.is_empty:
            continue
        result.append({
            "id":          r["id"],
            "geom":        geom,
            "elevation_m": r["elevation_m"],
            "centroid_lat": r["centroid_lat"],
            "centroid_lng": r["centroid_lng"],
        })
    return result


def split_road_by_partitions(road_poly, partitions: list) -> list:
    """
    도로 polygon을 파티션 boundary로 ST_Intersection 잘라 segment list 반환.
    각 segment: { 'geom': shapely Polygon/MultiPolygon, 'partition_id': int, 'elevation_m': float }
    어느 파티션과도 안 겹치는 잔여 영역은 elevation 보간으로 fallback segment 1개 생성.
    """
    segments = []
    consumed = None  # 이미 분할된 영역 누적 (bbox 충돌 회피용)
    for p in partitions:
        # bbox prefilter
        if not road_poly.intersects(p["geom"]):
            continue
        inter = road_poly.intersection(p["geom"])
        if inter.is_empty or inter.area < 1e-12:
            continue
        segments.append({
            "geom":         inter,
            "partition_id": p["id"],
            "elevation_m":  p["elevation_m"],
        })
        consumed = inter if consumed is None else consumed.union(inter)

    # 파티션 없는 영역(예: 한강 위 올림픽대로/노들로) 도로는 무시.
    # 이전엔 leftover/IDW로 추가했지만, 결과가 거대 polygon (~20000m²)이 되어
    # 시각적으로 도로가 강 위에 떠있는 것처럼 보임 → 그냥 안 그리는 게 자연스러움.
    return segments


def _idw_elevation(centroid, partitions: list) -> float:
    """역거리 가중 평균 — fallback용"""
    if not partitions:
        return 0.0
    lng, lat = centroid.x, centroid.y
    total_w = 0.0
    total_e = 0.0
    for p in partitions:
        dlat = (lat - p["centroid_lat"]) * 111000
        dlng = (lng - p["centroid_lng"]) * 88000
        dist = max((dlat**2 + dlng**2) ** 0.5, 1.0)
        w = 1.0 / dist
        total_w += w
        total_e += p["elevation_m"] * w
    return round(total_e / total_w, 2) if total_w > 0 else 0.0


async def run(dong_osm_id: int, dry_run: bool, overwrite: bool):
    road_cache = CACHE_DIR / f"{dong_osm_id}_roads.json"
    if not road_cache.exists():
        print(f"[ERROR] 도로 캐시 없음: {road_cache}")
        print(f"  python back/scripts/fetch_osm_features.py --dong-osm-id {dong_osm_id}")
        return

    road_elements = json.loads(road_cache.read_text(encoding="utf-8"))
    raw_roads = parse_road_elements(road_elements)
    print(f"[INFO] 파싱된 도로 way: {len(raw_roads)}개")

    async with async_session_factory() as session:
        dong = await get_dong_info(session, dong_osm_id)
        if not dong:
            print(f"[ERROR] dong osm_id={dong_osm_id} not found in world_area")
            return
        dong_id   = dong["id"]
        dong_name = dong["name"]
        print(f"[INFO] 동: {dong_name} (id={dong_id})")

        # 동 경계 (clip용)
        raw_boundary = dong["boundary_geojson"]
        if isinstance(raw_boundary, str):
            raw_boundary = json.loads(raw_boundary)
        dong_geom = shape(raw_boundary)
        if not dong_geom.is_valid:
            dong_geom = dong_geom.buffer(0)

        # 기존 world_road 확인
        existing = await session.execute(text(
            "SELECT road_key FROM world_road WHERE dong_id = :dong_id"
        ), {"dong_id": dong_id})
        existing_keys = {r["road_key"] for r in existing.mappings()}
        if existing_keys and not overwrite:
            print(f"[INFO] 이미 {len(existing_keys)}개 도로 존재. --overwrite 없이 스킵.")
            return
        if existing_keys and overwrite and not dry_run:
            await session.execute(text(
                "DELETE FROM world_road WHERE dong_id = :dong_id"
            ), {"dong_id": dong_id})
            await session.commit()
            print(f"[INFO] 기존 {len(existing_keys)}개 삭제 완료")
        elif existing_keys and overwrite and dry_run:
            print(f"[INFO] [DRY] 기존 {len(existing_keys)}개 삭제 예정 (실제 삭제 안 함)")

        # 파티션 전체 (elevation + boundary) — segment 분할용
        partitions = await get_partitions_full(session, dong_id)
        print(f"[INFO] 파티션: {len(partitions)}개 (segment 분할 + elevation 출처)")

        # 도로 변환 + 저장
        # segment 수 ≤ MERGE_THRESHOLD: way 단위 통합 단일 row (짧은 도로 — 평균 elevation, 단차 분산)
        # segment 수 >  MERGE_THRESHOLD: segment 단위 row 유지 (긴 도로 — 파티션별 elevation 정합)
        MERGE_THRESHOLD = 3
        saved = 0
        skipped = 0
        for rd in raw_roads:
            road_type = HIGHWAY_TO_TYPE[rd["highway"]]
            width_m   = TYPE_TO_BUFFER_M[road_type]
            poly      = road_line_to_polygon(rd["coords"], width_m)
            if poly is None:
                skipped += 1
                continue

            # 동 경계로 clip
            clipped = poly.intersection(dong_geom)
            if clipped.is_empty:
                skipped += 1
                continue

            # 파티션별로 segment 분할
            segments = split_road_by_partitions(clipped, partitions)
            if not segments:
                skipped += 1
                continue

            centerline = {"type": "LineString", "coordinates": rd["coords"]}

            # 저장 모드 결정
            if len(segments) <= MERGE_THRESHOLD:
                # === 통합 모드: way 단위 단일 row, 면적 가중 평균 elevation ===
                total_area = sum(s["geom"].area for s in segments if not s["geom"].is_empty)
                if total_area <= 0:
                    skipped += 1
                    continue
                avg_elev = round(sum(
                    s["elevation_m"] * s["geom"].area for s in segments
                ) / total_area, 2)

                union_geom = unary_union([s["geom"] for s in segments])
                if union_geom.is_empty:
                    skipped += 1
                    continue
                polys = list(union_geom.geoms) if union_geom.geom_type == "MultiPolygon" else [union_geom]

                for idx, geom in enumerate(polys):
                    if geom.is_empty or geom.area < 1e-13:
                        continue
                    if not geom.is_valid:
                        geom = geom.buffer(0)
                        if geom.is_empty:
                            continue

                    suffix = f"_p{idx}" if len(polys) > 1 else ""
                    road_key = f"{dong_osm_id}_r_{rd['osm_way_id']}{suffix}"
                    saved += await _insert_road(
                        session, dry_run,
                        road_key=road_key, dong_id=dong_id, osm_way_id=rd["osm_way_id"],
                        road_type=road_type, partition_id=None,
                        geom=geom, centerline=centerline,
                        real_name=rd["name"], width_m=width_m,
                        elevation_m=avg_elev, mode_label=f"merge x{len(segments)}",
                    )
            else:
                # === segment 모드: 긴 도로 — 각 파티션별 elevation 그대로 ===
                for seg_idx, seg in enumerate(segments):
                    geom = seg["geom"]
                    if geom.is_empty or geom.area < 1e-13:
                        continue
                    if not geom.is_valid:
                        geom = geom.buffer(0)
                        if geom.is_empty:
                            continue

                    road_key = f"{dong_osm_id}_r_{rd['osm_way_id']}_s{seg_idx}"
                    saved += await _insert_road(
                        session, dry_run,
                        road_key=road_key, dong_id=dong_id, osm_way_id=rd["osm_way_id"],
                        road_type=road_type, partition_id=seg["partition_id"],
                        geom=geom, centerline=centerline,
                        real_name=rd["name"], width_m=width_m,
                        elevation_m=seg["elevation_m"], mode_label=f"seg{seg_idx}/{len(segments)}",
                    )

        if not dry_run:
            await session.commit()

        print(f"[DONE] row={saved}개 저장 / 스킵 way={skipped} / dry_run={dry_run}")


async def _insert_road(session, dry_run, *, road_key, dong_id, osm_way_id, road_type,
                       partition_id, geom, centerline, real_name, width_m,
                       elevation_m, mode_label):
    if dry_run:
        print(f"  [DRY] {road_key} | {road_type} | elev={elevation_m}m | "
              f"part={partition_id} | mode={mode_label} | {real_name or '-'}")
        return 1
    await session.execute(text("""
        INSERT INTO world_road
          (road_key, dong_id, osm_way_id, road_type, partition_id,
           boundary_geojson, centerline_geojson,
           real_name, width_m, elevation_m, movement_bonus)
        VALUES
          (:road_key, :dong_id, :osm_way_id, :road_type, :partition_id,
           :boundary, :centerline,
           :real_name, :width_m, :elevation_m, :movement_bonus)
        ON CONFLICT (road_key) DO UPDATE SET
          boundary_geojson  = EXCLUDED.boundary_geojson,
          elevation_m       = EXCLUDED.elevation_m,
          partition_id      = EXCLUDED.partition_id,
          road_type         = EXCLUDED.road_type
    """), {
        "road_key":       road_key,
        "dong_id":        dong_id,
        "osm_way_id":     osm_way_id,
        "road_type":      road_type,
        "partition_id":   partition_id,
        "boundary":       json.dumps(mapping(geom)),
        "centerline":     json.dumps(centerline),
        "real_name":      real_name,
        "width_m":        width_m,
        "elevation_m":    elevation_m,
        "movement_bonus": TYPE_TO_MOVEMENT[road_type],
    })
    return 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dong-osm-id", type=int, required=True)
    parser.add_argument("--dry-run",  action="store_true")
    parser.add_argument("--overwrite", action="store_true", help="기존 도로 삭제 후 재생성")
    args = parser.parse_args()
    asyncio.run(run(args.dong_osm_id, args.dry_run, args.overwrite))
