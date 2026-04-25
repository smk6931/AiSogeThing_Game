# world 파티션 + 도로 DB 쿼리 전담
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
    texture_profile,
    texture_image_url,
    is_road,
    area_m2,
    centroid_lat,
    centroid_lng,
    elevation_m,
    boundary_geojson,
    terrain_geojson
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


async def get_codex_area_tree() -> list[dict]:
    """서울시 → 구 → 동 계층 구조 조회 (그룹/파티션 카운트 포함)"""
    return await fetch_all(
        """
        WITH dong_counts AS (
            SELECT
                p.admin_area_id,
                COUNT(DISTINCT pg.id) AS group_count,
                COUNT(p.id) AS partition_count
            FROM world_partition p
            LEFT JOIN world_partition_group pg ON pg.admin_area_id = p.admin_area_id
            WHERE p.is_road = false
            GROUP BY p.admin_area_id
        )
        SELECT
            a.id,
            a.osm_id,
            a.area_level,
            a.name,
            a.name_en,
            a.parent_id,
            a.center_lat,
            a.center_lng,
            a.persona_tag,
            COALESCE(dc.group_count, 0) AS group_count,
            COALESCE(dc.partition_count, 0) AS partition_count
        FROM world_area a
        LEFT JOIN dong_counts dc ON dc.admin_area_id = a.id
        WHERE a.area_level IN ('city', 'district', 'dong')
        ORDER BY a.area_level, a.name
        """,
        {},
    )


async def get_codex_dong_groups(dong_id: int) -> list[dict]:
    """동의 그룹파티션 목록 조회"""
    return await fetch_all(
        """
        SELECT
            pg.id,
            pg.group_key,
            pg.group_seq,
            pg.display_name,
            pg.summary,
            pg.theme_code,
            pg.centroid_lat,
            pg.centroid_lng,
            pg.boundary_geojson,
            COUNT(pgm.partition_id) AS partition_count
        FROM world_partition_group pg
        LEFT JOIN world_partition_group_member pgm ON pgm.group_id = pg.id
        WHERE pg.admin_area_id = :dong_id
          AND pg.is_active = true
        GROUP BY pg.id
        HAVING COUNT(pgm.partition_id) > 0
        ORDER BY pg.group_seq NULLS LAST, pg.display_name
        """,
        {"dong_id": dong_id},
    )


async def get_codex_group_partitions(group_id: int) -> list[dict]:
    """그룹의 파티션 목록 조회"""
    return await fetch_all(
        """
        SELECT
            p.id,
            p.partition_key,
            p.partition_seq,
            p.display_name,
            p.summary,
            p.theme_code,
            p.centroid_lat,
            p.centroid_lng,
            p.area_m2,
            p.dominant_landuse,
            p.boundary_geojson
        FROM world_partition p
        JOIN world_partition_group_member pgm ON pgm.partition_id = p.id
        WHERE pgm.group_id = :group_id
          AND p.is_road = false
        ORDER BY p.partition_seq
        """,
        {"group_id": group_id},
    )


async def get_dong_roads(dong_id: int) -> list[dict]:
    """dong 소속 world_road 전체 조회 (클라이언트에서 activeGroupKeys로 필터링)"""
    return await fetch_all(
        """
        SELECT
            id,
            road_key,
            road_type,
            real_name,
            width_m,
            elevation_m,
            movement_bonus,
            boundary_geojson
        FROM world_road
        WHERE dong_id = :dong_id
        ORDER BY road_type, id
        """,
        {"dong_id": dong_id},
    )
