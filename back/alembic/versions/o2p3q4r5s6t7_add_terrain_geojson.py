"""add terrain_geojson to world_partition (+ refresh views)

Revision ID: o2p3q4r5s6t7
Revises: n1o2p3q4r5s6
Create Date: 2026-04-23

world_partition.terrain_geojson:
    boundary_geojson에서 world_road 폴리곤을 빼서 미리 계산해 둔 지형 폴리곤.
    클라이언트는 terrain_geojson이 있으면 우선 사용, 없으면 boundary_geojson fallback.
world_level / world_level_partition 뷰도 재생성해서 terrain_geojson 노출.
뷰 SQL은 실제 테이블 컬럼 기준 (source_feature, gameplay_meta, persona_tag는 이미 제거됨).
"""
from alembic import op
import sqlalchemy as sa

revision = 'o2p3q4r5s6t7'
down_revision = 'n1o2p3q4r5s6'
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
    p.boundary_geojson, p.terrain_geojson,
    p.created_at, p.updated_at,
    p.area_m2, p.dominant_landuse,
    p.texture_image_url, p.elevation_m,
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
    p.landuse_code, p.dominant_landuse, p.texture_profile,
    p.texture_image_url,
    p.is_road, p.area_m2,
    p.centroid_lat, p.centroid_lng,
    p.elevation_m,
    p.city_name, p.district_name, p.dong_name,
    a.area_code        AS admin_area_code,
    a.name_en          AS dong_name_en,
    a.parent_id        AS district_admin_id
FROM world_partition p
JOIN world_area a ON a.id = p.admin_area_id
LEFT JOIN world_partition_group_member gm ON gm.partition_id = p.id
LEFT JOIN world_partition_group g         ON g.id = gm.group_id
"""


def upgrade():
    op.add_column(
        'world_partition',
        sa.Column('terrain_geojson', sa.JSON(), nullable=True),
    )
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
    op.drop_column('world_partition', 'terrain_geojson')
    # 이 migration이 생성한 뷰가 현재 스키마와 맞으므로, 위 3개를 재실행 (terrain_geojson 없이)
    fallback_level = _CREATE_WORLD_LEVEL.replace(", p.terrain_geojson", "")
    conn.execute(sa.text(fallback_level))
    conn.execute(sa.text(_CREATE_WORLD_LEVEL_PARTITION))
    conn.execute(sa.text(_CREATE_WORLD_PARTITION_DETAIL))
