import json

from shapely.geometry import Point, shape

from core.database import fetch_all, fetch_one
from world.services.district_service import get_current_dong


async def get_region_info_by_dong_osm_id(dong_osm_id: int | None) -> dict | None:
    if not dong_osm_id:
        return None

    area = await fetch_one(
        """
        SELECT
            id,
            osm_id,
            area_level,
            area_code,
            name,
            name_en,
            parent_id,
            center_lat,
            center_lng,
            area_meta
        FROM world_admin_area
        WHERE osm_id = :osm_id AND area_level = 'dong'
        LIMIT 1
        """,
        {"osm_id": dong_osm_id},
    )

    if not area:
        return None

    partition_rows = await fetch_all(
        """
        SELECT
            id,
            partition_key,
            partition_seq,
            partition_stage,
            partition_type,
            map_name,
            display_name,
            summary,
            description,
            theme_code,
            landuse_code,
            texture_profile,
            is_road,
            is_walkable,
            centroid_lat,
            centroid_lng,
            boundary_geojson,
            gameplay_meta
        FROM world_level_partition
        WHERE admin_area_id = :admin_area_id
        ORDER BY partition_stage, partition_seq
        """,
        {"admin_area_id": area["id"]},
    )

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

    area = await fetch_one(
        """
        SELECT id
        FROM world_admin_area
        WHERE osm_id = :osm_id AND area_level = 'dong'
        LIMIT 1
        """,
        {"osm_id": dong_osm_id},
    )
    if not area:
        return []

    return await fetch_all(
        """
        SELECT
            id,
            partition_key,
            partition_seq,
            partition_stage,
            partition_type,
            map_name,
            display_name,
            summary,
            description,
            theme_code,
            landuse_code,
            texture_profile,
            is_road,
            is_walkable,
            centroid_lat,
            centroid_lng,
            boundary_geojson,
            source_feature,
            gameplay_meta
        FROM world_level_partition
        WHERE admin_area_id = :admin_area_id
        ORDER BY partition_stage, partition_seq
        """,
        {"admin_area_id": area["id"]},
    )


def _find_current_partition(partition_rows: list[dict], lat: float, lng: float) -> dict | None:
    point = Point(lng, lat)
    nearest_row = None
    nearest_distance = None

    for row in partition_rows:
        boundary = row.get("boundary_geojson")
        if not boundary:
            if row.get("centroid_lat") is not None and row.get("centroid_lng") is not None:
                distance = (row["centroid_lat"] - lat) ** 2 + (row["centroid_lng"] - lng) ** 2
                if nearest_distance is None or distance < nearest_distance:
                    nearest_distance = distance
                    nearest_row = row
            continue
        if isinstance(boundary, str):
            boundary = json.loads(boundary)
        try:
            polygon = shape(boundary)
            if polygon.is_valid and polygon.covers(point):
                return row
            if row.get("centroid_lat") is not None and row.get("centroid_lng") is not None:
                distance = (row["centroid_lat"] - lat) ** 2 + (row["centroid_lng"] - lng) ** 2
                if nearest_distance is None or distance < nearest_distance:
                    nearest_distance = distance
                    nearest_row = row
        except Exception:
            continue
    return nearest_row


async def get_current_region_info(lat: float, lng: float) -> dict:
    current_dong = get_current_dong(lat, lng)
    region_info = await get_region_info_by_dong_osm_id(current_dong["id"] if current_dong else None)

    current_partition = None
    if region_info:
        current_partition = _find_current_partition(region_info.get("featured_partitions", []) + [], lat, lng)
        if current_partition is None:
            partition_rows = await fetch_all(
                """
                SELECT
                    id,
                    partition_key,
                    partition_seq,
                    partition_stage,
                    partition_type,
                    map_name,
                    display_name,
                    summary,
                    description,
                    theme_code,
                    landuse_code,
                    texture_profile,
                    is_road,
                    is_walkable,
                    centroid_lat,
                    centroid_lng,
                    boundary_geojson,
                    gameplay_meta
                FROM world_level_partition
                WHERE admin_area_id = :admin_area_id
                ORDER BY partition_stage, partition_seq
                """,
                {"admin_area_id": region_info["admin_area"]["id"]},
            )
            current_partition = _find_current_partition(partition_rows, lat, lng)

    return {
        "current_dong": current_dong,
        "db_region": region_info,
        "current_partition": current_partition,
    }
