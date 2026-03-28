"""add partition group columns

Revision ID: f7b9c1d2e3a4
Revises: e6a1b2c3d4f5
Create Date: 2026-03-28 16:40:00
"""

from alembic import op
import sqlalchemy as sa


revision = "f7b9c1d2e3a4"
down_revision = "e6a1b2c3d4f5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("world_level_partition", sa.Column("group_key", sa.String(length=160), nullable=True))
    op.add_column("world_level_partition", sa.Column("group_seq", sa.Integer(), nullable=True))
    op.add_column("world_level_partition", sa.Column("group_display_name", sa.String(length=128), nullable=True))
    op.add_column("world_level_partition", sa.Column("group_theme_code", sa.String(length=64), nullable=True))

    op.create_index(op.f("ix_world_level_partition_group_key"), "world_level_partition", ["group_key"], unique=False)
    op.create_index(op.f("ix_world_level_partition_group_seq"), "world_level_partition", ["group_seq"], unique=False)
    op.create_index(op.f("ix_world_level_partition_group_display_name"), "world_level_partition", ["group_display_name"], unique=False)
    op.create_index(op.f("ix_world_level_partition_group_theme_code"), "world_level_partition", ["group_theme_code"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_world_level_partition_group_theme_code"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_group_display_name"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_group_seq"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_group_key"), table_name="world_level_partition")

    op.drop_column("world_level_partition", "group_theme_code")
    op.drop_column("world_level_partition", "group_display_name")
    op.drop_column("world_level_partition", "group_seq")
    op.drop_column("world_level_partition", "group_key")
