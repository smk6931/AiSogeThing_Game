"""add texture_image_url to world_partition

Revision ID: k8l9m0n1o2p3
Revises: j7k8l9m0n1o2
Create Date: 2026-04-11

world_partition:
    + texture_image_url  String(512)  -- ComfyUI 생성 이미지 경로
                                         /world_partition/{group_short}/{partition_key}.png
"""
from alembic import op
import sqlalchemy as sa

revision = 'k8l9m0n1o2p3'
down_revision = 'j7k8l9m0n1o2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('world_partition',
        sa.Column('texture_image_url', sa.String(512), nullable=True)
    )


def downgrade():
    op.drop_column('world_partition', 'texture_image_url')
