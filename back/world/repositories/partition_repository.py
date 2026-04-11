# world 파티션 DB 쿼리 전담
from core.database import fetch_all, fetch_one

_PARTITION_COLUMNS = """
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
    texture_image_url,
    is_road,
    area_m2,
    centroid_lat,
    centroid_lng,
    boundary_geojson,
    gameplay_meta
"""


async def get_area_by_osm_id(osm_id: int) -> dict | None:
    """dong 레벨 행정구역 단건 조회"""
    return await fetch_one(
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
        {"osm_id": osm_id},
    )


async def get_partitions_by_admin_area_id(admin_area_id: int) -> list[dict]:
    """admin_area_id에 속한 파티션 전체 조회"""
    return await fetch_all(
        f"""
        SELECT {_PARTITION_COLUMNS}
        FROM world_level_partition
        WHERE admin_area_id = :admin_area_id
        ORDER BY partition_stage, partition_seq
        """,
        {"admin_area_id": admin_area_id},
    )
