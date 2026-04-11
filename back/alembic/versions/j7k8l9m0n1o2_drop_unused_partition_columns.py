"""drop unused partition columns

Revision ID: j7k8l9m0n1o2
Revises: i6j7k8l9m0n1
Create Date: 2026-04-11

world_partition (DROP):
    - map_name
    - partition_type
    - landuse_mix_score
    - is_walkable
    - source_version

world_partition_group (DROP):
    - codex_title
    - codex_body
    - primary_landuse
    - secondary_landuse
    - texture_style_profile
"""
from alembic import op
import sqlalchemy as sa

revision = 'j7k8l9m0n1o2'
down_revision = 'i6j7k8l9m0n1'
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
    conn = op.get_bind()

    # 1. VIEW 제거 (의존 순서 역순)
    conn.execute(sa.text("DROP VIEW IF EXISTS world_level_partition"))
    conn.execute(sa.text("DROP VIEW IF EXISTS world_level"))
    conn.execute(sa.text("DROP VIEW IF EXISTS world_partition_detail"))

    # 2. world_partition 컬럼 제거
    op.drop_column('world_partition', 'map_name')
    op.drop_column('world_partition', 'partition_type')
    op.drop_column('world_partition', 'landuse_mix_score')
    op.drop_column('world_partition', 'is_walkable')
    op.drop_column('world_partition', 'source_version')

    # 3. world_partition_group 컬럼 제거
    op.drop_column('world_partition_group', 'codex_title')
    op.drop_column('world_partition_group', 'codex_body')
    op.drop_column('world_partition_group', 'primary_landuse')
    op.drop_column('world_partition_group', 'secondary_landuse')
    op.drop_column('world_partition_group', 'texture_style_profile')

    # 4. VIEW 재생성
    conn.execute(sa.text(_CREATE_WORLD_LEVEL))
    conn.execute(sa.text(_CREATE_WORLD_LEVEL_PARTITION))
    conn.execute(sa.text(_CREATE_WORLD_PARTITION_DETAIL))


def downgrade():
    # world_partition
    op.add_column('world_partition', sa.Column('source_version', sa.String(32), nullable=True))
    op.add_column('world_partition', sa.Column('is_walkable', sa.Boolean, nullable=False, server_default='true'))
    op.add_column('world_partition', sa.Column('landuse_mix_score', sa.Float, nullable=True))
    op.add_column('world_partition', sa.Column('partition_type', sa.String(32), nullable=True))
    op.add_column('world_partition', sa.Column('map_name', sa.String(128), nullable=True))

    # world_partition_group
    op.add_column('world_partition_group', sa.Column('texture_style_profile', sa.String(64), nullable=True))
    op.add_column('world_partition_group', sa.Column('secondary_landuse', sa.String(64), nullable=True))
    op.add_column('world_partition_group', sa.Column('primary_landuse', sa.String(64), nullable=True))
    op.add_column('world_partition_group', sa.Column('codex_body', sa.Text, nullable=True))
    op.add_column('world_partition_group', sa.Column('codex_title', sa.String(128), nullable=True))
