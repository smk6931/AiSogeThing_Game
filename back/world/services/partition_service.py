import json

from shapely.geometry import Point, shape

from world.repositories import partition_repository
from world.services.district_service import get_current_dong

# 파티션 shape 객체 캐시 — DB row의 boundary_geojson을 반복 파싱하지 않도록
_shape_cache: dict = {}

def _get_cached_shape(partition_id: int, boundary: dict):
    if partition_id not in _shape_cache:
        try:
            _shape_cache[partition_id] = shape(boundary)
        except Exception:
            _shape_cache[partition_id] = None
    return _shape_cache[partition_id]


async def get_region_info_by_dong_osm_id(dong_osm_id: int | None) -> dict | None:
    if not dong_osm_id:
        return None

    area = await partition_repository.get_area_by_osm_id(dong_osm_id)
    if not area:
        return None

    partition_rows = await partition_repository.get_partitions_by_admin_area_id(area["id"])

    theme_counts: dict[str, int] = {}
    landuse_counts: dict[str, int] = {}
    for row in partition_rows:
        if row.get("theme_code"):
            theme_counts[row["theme_code"]] = theme_counts.get(row["theme_code"], 0) + 1
        if row.get("landuse_code"):
            landuse_counts[row["landuse_code"]] = landuse_counts.get(row["landuse_code"], 0) + 1

    top_themes = sorted(theme_counts.items(), key=lambda item: (-item[1], item[0]))[:3]
    top_landuse = sorted(landuse_counts.items(), key=lambda item: (-item[1], item[0]))[:3]

    return {
        "admin_area": area,
        "partition_count": len(partition_rows),
        "top_themes": [{"code": code, "count": count} for code, count in top_themes],
        "top_landuse": [{"code": code, "count": count} for code, count in top_landuse],
        "featured_partitions": partition_rows[:5],
    }


async def get_partitions_by_dong_osm_id(dong_osm_id: int | None) -> list[dict]:
    if not dong_osm_id:
        return []

    area = await partition_repository.get_area_by_osm_id(dong_osm_id)
    if not area:
        return []

    return await partition_repository.get_partitions_by_admin_area_id(area["id"])


def _find_current_partition(partition_rows: list[dict], lat: float, lng: float) -> dict | None:
    point = Point(lng, lat)

    for row in partition_rows:
        boundary = row.get("boundary_geojson")
        if not boundary:
            continue
        if isinstance(boundary, str):
            boundary = json.loads(boundary)

        polygon = _get_cached_shape(row["id"], boundary)
        if polygon and polygon.is_valid and polygon.covers(point):
            return row
    return None


async def get_current_region_info(lat: float, lng: float) -> dict:
    current_dong = get_current_dong(lat, lng)

    if not current_dong:
        return {"current_dong": None, "db_region": None, "current_partition": None}

    # admin_area + partition_rows를 한 번만 조회 (이중 쿼리 제거)
    area = await partition_repository.get_area_by_osm_id(current_dong["id"])
    if not area:
        return {"current_dong": current_dong, "db_region": None, "current_partition": None}

    partition_rows = await partition_repository.get_partitions_by_admin_area_id(area["id"])

    theme_counts: dict[str, int] = {}
    landuse_counts: dict[str, int] = {}
    for row in partition_rows:
        if row.get("theme_code"):
            theme_counts[row["theme_code"]] = theme_counts.get(row["theme_code"], 0) + 1
        if row.get("landuse_code"):
            landuse_counts[row["landuse_code"]] = landuse_counts.get(row["landuse_code"], 0) + 1

    top_themes = sorted(theme_counts.items(), key=lambda item: (-item[1], item[0]))[:3]
    top_landuse = sorted(landuse_counts.items(), key=lambda item: (-item[1], item[0]))[:3]

    region_info = {
        "admin_area": area,
        "partition_count": len(partition_rows),
        "top_themes": [{"code": code, "count": count} for code, count in top_themes],
        "top_landuse": [{"code": code, "count": count} for code, count in top_landuse],
        "featured_partitions": partition_rows[:5],
    }

    current_partition = _find_current_partition(partition_rows, lat, lng)

    return {
        "current_dong": current_dong,
        "db_region": region_info,
        "current_partition": current_partition,
    }
