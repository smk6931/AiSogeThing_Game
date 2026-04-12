"""add elevation_m to world_partition

Revision ID: m0n1o2p3q4r5
Revises: l9m0n1o2p3q4
Create Date: 2026-04-12

world_partition:
    + elevation_m  Float  DEFAULT 0.0  -- OpenTopoData SRTM 기반 평균 고도(m)

world_level / world_level_partition VIEW 재생성 (elevation_m 포함)
"""
from alembic import op
import sqlalchemy as sa

revision = 'm0n1o2p3q4r5'
down_revision = 'l9m0n1o2p3q4'
branch_labels = None
depends_on = None

_CREATE_WORLD_LEVEL = """
CREATE VIEW world_level AS
SELECT
    p.id, p.partition_key, p.admin_area_id,
    p.city_name, p.district_name, p.dong_name,
    p.partition_stage, p.partition_seq,
    p.source_layer,
    p.display_name, p.summary, p.description,
    p.theme_code, p.landuse_code, p.texture_profile,
    p.is_road, p.centroid_lat, p.centroid_lng,
    p.boundary_geojson, p.source_feature, p.gameplay_meta,
    p.created_at, p.updated_at,
    p.persona_tag, p.area_m2, p.dominant_landuse,
    p.texture_image_url,
    p.elevation_m,
    g.group_key, g.group_seq,
    g.display_name AS group_display_name,
    g.theme_code   AS group_theme_code
FROM world_partition p
LEFT JOIN world_partition_group_member gm ON gm.partition_id = p.id
LEFT JOIN world_partition_group g         ON g.id = gm.group_id
"""

_CREATE_WORLD_LEVEL_PARTITION = """
CREATE VIEW world_level_partition AS
SELECT * FROM world_level
"""

_CREATE_WORLD_PARTITION_DETAIL = """
CREATE VIEW world_partition_detail AS
SELECT
    p.id, p.partition_key,
    p.partition_stage, p.partition_seq,
    p.display_name, p.summary, p.description,
    p.theme_code,
    g.group_key, g.group_seq,
    g.display_name AS group_display_name,
    g.theme_code   AS group_theme_code,
    p.landuse_code, p.dominant_landuse, p.persona_tag, p.texture_profile,
    p.texture_image_url,
    p.is_road, p.area_m2,
    p.centroid_lat, p.centroid_lng,
    p.elevation_m,
    p.city_name, p.district_name, p.dong_name,
    a.area_code        AS admin_area_code,
    a.name_en          AS dong_name_en,
    a.parent_id        AS district_admin_id,
    p.gameplay_meta
FROM world_partition p
JOIN world_area a ON a.id = p.admin_area_id
LEFT JOIN world_partition_group_member gm ON gm.partition_id = p.id
LEFT JOIN world_partition_group g         ON g.id = gm.group_id
"""

# 이전 VIEW (elevation_m 없는 버전)
_CREATE_WORLD_LEVEL_OLD = """
CREATE VIEW world_level AS
SELECT
    p.id, p.partition_key, p.admin_area_id,
    p.city_name, p.district_name, p.dong_name,
    p.partition_stage, p.partition_seq,
    p.source_layer,
    p.display_name, p.summary, p.description,
    p.theme_code, p.landuse_code, p.texture_profile,
    p.is_road, p.centroid_lat, p.centroid_lng,
    p.boundary_geojson, p.source_feature, p.gameplay_meta,
    p.created_at, p.updated_at,
    p.persona_tag, p.area_m2, p.dominant_landuse,
    p.texture_image_url,
    g.group_key, g.group_seq,
    g.display_name AS group_display_name,
    g.theme_code   AS group_theme_code
FROM world_partition p
LEFT JOIN world_partition_group_member gm ON gm.partition_id = p.id
LEFT JOIN world_partition_group g         ON g.id = gm.group_id
"""

_CREATE_WORLD_PARTITION_DETAIL_OLD = """
CREATE VIEW world_partition_detail AS
SELECT
    p.id, p.partition_key,
    p.partition_stage, p.partition_seq,
    p.display_name, p.summary, p.description,
    p.theme_code,
    g.group_key, g.group_seq,
    g.display_name AS group_display_name,
    g.theme_code   AS group_theme_code,
    p.landuse_code, p.dominant_landuse, p.persona_tag, p.texture_profile,
    p.texture_image_url,
    p.is_road, p.area_m2,
    p.centroid_lat, p.centroid_lng,
    p.city_name, p.district_name, p.dong_name,
    a.area_code        AS admin_area_code,
    a.name_en          AS dong_name_en,
    a.parent_id        AS district_admin_id,
    p.gameplay_meta
FROM world_partition p
JOIN world_area a ON a.id = p.admin_area_id
LEFT JOIN world_partition_group_member gm ON gm.partition_id = p.id
LEFT JOIN world_partition_group g         ON g.id = gm.group_id
"""


def upgrade():
    # 1. 컬럼 추가
    op.add_column('world_partition', sa.Column('elevation_m', sa.Float(), nullable=True, server_default='0.0'))

    # 2. VIEW 재생성 (elevation_m 포함)
    conn = op.get_bind()
    conn.execute(sa.text("DROP VIEW IF EXISTS world_level_partition"))
    conn.execute(sa.text("DROP VIEW IF EXISTS world_level"))
    conn.execute(sa.text("DROP VIEW IF EXISTS world_partition_detail"))
    conn.execute(sa.text(_CREATE_WORLD_LEVEL))
    conn.execute(sa.text(_CREATE_WORLD_LEVEL_PARTITION))
    conn.execute(sa.text(_CREATE_WORLD_PARTITION_DETAIL))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("DROP VIEW IF EXISTS world_level_partition"))
    conn.execute(sa.text("DROP VIEW IF EXISTS world_level"))
    conn.execute(sa.text("DROP VIEW IF EXISTS world_partition_detail"))
    conn.execute(sa.text(_CREATE_WORLD_LEVEL_OLD))
    conn.execute(sa.text(_CREATE_WORLD_LEVEL_PARTITION))
    conn.execute(sa.text(_CREATE_WORLD_PARTITION_DETAIL_OLD))

    op.drop_column('world_partition', 'elevation_m')
