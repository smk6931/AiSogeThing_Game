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
        FROM world_area
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
            display_name,
            summary,
            description,
            theme_code,
            group_key,
            group_seq,
            group_display_name,
            group_theme_code,
            landuse_code,
            dominant_landuse,
            persona_tag,
            texture_profile,
            is_road,
            area_m2,
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
        FROM world_area
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
            display_name,
            summary,
            description,
            theme_code,
            group_key,
            group_seq,
            group_display_name,
            group_theme_code,
            landuse_code,
            dominant_landuse,
            persona_tag,
            texture_profile,
            is_road,
            area_m2,
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


def _find_current_partition(partition_rows: list[dict], lat: float, lng: float) -> dict | None:
    point = Point(lng, lat)

    for row in partition_rows:
        boundary = row.get("boundary_geojson")
        if not boundary:
            continue
        if isinstance(boundary, str):
            boundary = json.loads(boundary)
        try:
            polygon = shape(boundary)
            if polygon.is_valid and polygon.covers(point):
                return row
        except Exception:
            continue
    return None


async def get_current_region_info(lat: float, lng: float) -> dict:
    current_dong = get_current_dong(lat, lng)
    region_info = await get_region_info_by_dong_osm_id(current_dong["id"] if current_dong else None)

    current_partition = None
    if region_info:
        partition_rows = await fetch_all(
            """
            SELECT
                id,
                partition_key,
                partition_seq,
                partition_stage,
                display_name,
                summary,
                description,
                theme_code,
                group_key,
                group_seq,
                group_display_name,
                group_theme_code,
                landuse_code,
                dominant_landuse,
                persona_tag,
                texture_profile,
                is_road,
                area_m2,
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
