"""add world_road table

Revision ID: n1o2p3q4r5s6
Revises: m0n1o2p3q4r5
Create Date: 2026-04-22

world_road:
    OSM 도로 라인을 buffer → Polygon 변환해서 저장
    dong 단위 소속, road_type(arterial/collector/local/alley)으로 분류
"""
from alembic import op
import sqlalchemy as sa

revision = 'n1o2p3q4r5s6'
down_revision = 'm0n1o2p3q4r5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'world_road',
        sa.Column('id',                  sa.BigInteger(),  primary_key=True, autoincrement=True),
        sa.Column('road_key',            sa.String(160),   nullable=False),
        sa.Column('dong_id',             sa.Integer(),     nullable=True),
        sa.Column('osm_way_id',          sa.BigInteger(),  nullable=True),
        sa.Column('road_type',           sa.String(32),    nullable=False),   # arterial/collector/local/alley
        sa.Column('boundary_geojson',    sa.JSON(),        nullable=False),   # buffered Polygon
        sa.Column('centerline_geojson',  sa.JSON(),        nullable=True),    # 원본 LineString
        sa.Column('real_name',           sa.String(128),   nullable=True),
        sa.Column('width_m',             sa.Float(),       nullable=False, server_default='4.0'),
        sa.Column('elevation_m',         sa.Float(),       nullable=False, server_default='0.0'),
        sa.Column('movement_bonus',      sa.Float(),       nullable=False, server_default='1.0'),
        sa.Column('created_at',          sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_world_road_road_key', 'world_road', ['road_key'], unique=True)
    op.create_index('ix_world_road_dong_id',  'world_road', ['dong_id'])
    op.create_index('ix_world_road_road_type','world_road', ['road_type'])


def downgrade():
    op.drop_index('ix_world_road_road_type', table_name='world_road')
    op.drop_index('ix_world_road_dong_id',   table_name='world_road')
    op.drop_index('ix_world_road_road_key',  table_name='world_road')
    op.drop_table('world_road')
