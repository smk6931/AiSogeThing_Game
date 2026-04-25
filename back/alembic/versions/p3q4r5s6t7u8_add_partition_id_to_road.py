"""add partition_id to world_road (for road segment split)

Revision ID: p3q4r5s6t7u8
Revises: o2p3q4r5s6t7
Create Date: 2026-04-25

world_road.partition_id:
    OSM way를 파티션 경계로 ST_Intersection 잘라 segment 단위로 저장할 때
    각 segment가 속한 파티션의 id를 기록 (elevation 출처 추적, 게임플레이 연결용).
    같은 OSM way의 여러 segment는 osm_way_id로 묶을 수 있음.
"""
from alembic import op
import sqlalchemy as sa

revision = 'p3q4r5s6t7u8'
down_revision = 'o2p3q4r5s6t7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'world_road',
        sa.Column('partition_id', sa.BigInteger(), nullable=True),
    )
    op.create_index('ix_world_road_partition_id', 'world_road', ['partition_id'])


def downgrade():
    op.drop_index('ix_world_road_partition_id', table_name='world_road')
    op.drop_column('world_road', 'partition_id')
