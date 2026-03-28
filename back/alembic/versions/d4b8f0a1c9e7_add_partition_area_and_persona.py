"""add partition area and persona

Revision ID: d4b8f0a1c9e7
Revises: c1a2e3f4b5c6
Create Date: 2026-03-28 15:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d4b8f0a1c9e7"
down_revision: Union[str, Sequence[str], None] = "c1a2e3f4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("world_level_partition", sa.Column("persona_tag", sa.String(length=64), nullable=True))
    op.add_column("world_level_partition", sa.Column("area_m2", sa.Float(), nullable=True))
    op.create_index(op.f("ix_world_level_partition_persona_tag"), "world_level_partition", ["persona_tag"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_world_level_partition_persona_tag"), table_name="world_level_partition")
    op.drop_column("world_level_partition", "area_m2")
    op.drop_column("world_level_partition", "persona_tag")
