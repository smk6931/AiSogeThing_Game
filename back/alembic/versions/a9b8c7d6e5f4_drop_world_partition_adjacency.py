"""drop world partition adjacency table

Revision ID: a9b8c7d6e5f4
Revises: b2c3d4e5f6a7
Create Date: 2026-03-28 21:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "world_partition_adjacency" not in inspector.get_table_names():
        return

    indexes = {index["name"] for index in inspector.get_indexes("world_partition_adjacency")}
    for name in [
        op.f("ix_world_partition_adjacency_relation_type"),
        op.f("ix_world_partition_adjacency_to_partition_id"),
        op.f("ix_world_partition_adjacency_from_partition_id"),
        op.f("ix_world_partition_adjacency_id"),
    ]:
        if name in indexes:
            op.drop_index(name, table_name="world_partition_adjacency")

    op.drop_table("world_partition_adjacency")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "world_partition_adjacency" in inspector.get_table_names():
        return

    op.create_table(
        "world_partition_adjacency",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("from_partition_id", sa.BigInteger(), nullable=False),
        sa.Column("to_partition_id", sa.BigInteger(), nullable=False),
        sa.Column("relation_type", sa.String(length=32), nullable=False),
        sa.Column("traversal_cost", sa.Float(), nullable=True),
        sa.Column("edge_meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["from_partition_id"], ["world_level_partition.id"]),
        sa.ForeignKeyConstraint(["to_partition_id"], ["world_level_partition.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_world_partition_adjacency_id"), "world_partition_adjacency", ["id"], unique=False)
    op.create_index(
        op.f("ix_world_partition_adjacency_from_partition_id"),
        "world_partition_adjacency",
        ["from_partition_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_world_partition_adjacency_to_partition_id"),
        "world_partition_adjacency",
        ["to_partition_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_world_partition_adjacency_relation_type"),
        "world_partition_adjacency",
        ["relation_type"],
        unique=False,
    )
