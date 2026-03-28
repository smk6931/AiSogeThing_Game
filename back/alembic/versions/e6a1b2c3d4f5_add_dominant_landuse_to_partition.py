"""add dominant landuse to partition

Revision ID: e6a1b2c3d4f5
Revises: d4b8f0a1c9e7
Create Date: 2026-03-28 15:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6a1b2c3d4f5"
down_revision: Union[str, Sequence[str], None] = "d4b8f0a1c9e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("world_level_partition", sa.Column("dominant_landuse", sa.String(length=64), nullable=True))
    op.add_column("world_level_partition", sa.Column("landuse_mix_score", sa.Float(), nullable=True))
    op.create_index(op.f("ix_world_level_partition_dominant_landuse"), "world_level_partition", ["dominant_landuse"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_world_level_partition_dominant_landuse"), table_name="world_level_partition")
    op.drop_column("world_level_partition", "landuse_mix_score")
    op.drop_column("world_level_partition", "dominant_landuse")
