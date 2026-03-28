"""add world level partition tables

Revision ID: c1a2e3f4b5c6
Revises: 0f7c34a2f782
Create Date: 2026-03-28 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1a2e3f4b5c6"
down_revision: Union[str, Sequence[str], None] = "0f7c34a2f782"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "world_admin_area",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("osm_id", sa.BigInteger(), nullable=True),
        sa.Column("area_level", sa.String(length=32), nullable=False),
        sa.Column("area_code", sa.String(length=128), nullable=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("name_en", sa.String(length=128), nullable=True),
        sa.Column("parent_id", sa.Integer(), nullable=True),
        sa.Column("center_lat", sa.Float(), nullable=True),
        sa.Column("center_lng", sa.Float(), nullable=True),
        sa.Column("boundary_geojson", sa.JSON(), nullable=True),
        sa.Column("area_meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["parent_id"], ["world_admin_area.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_world_admin_area_id"), "world_admin_area", ["id"], unique=False)
    op.create_index(op.f("ix_world_admin_area_osm_id"), "world_admin_area", ["osm_id"], unique=True)
    op.create_index(op.f("ix_world_admin_area_area_level"), "world_admin_area", ["area_level"], unique=False)
    op.create_index(op.f("ix_world_admin_area_area_code"), "world_admin_area", ["area_code"], unique=True)
    op.create_index(op.f("ix_world_admin_area_name"), "world_admin_area", ["name"], unique=False)
    op.create_index(op.f("ix_world_admin_area_parent_id"), "world_admin_area", ["parent_id"], unique=False)

    op.create_table(
        "world_level_partition",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("partition_key", sa.String(length=160), nullable=False),
        sa.Column("admin_area_id", sa.Integer(), nullable=False),
        sa.Column("city_name", sa.String(length=64), nullable=False),
        sa.Column("district_name", sa.String(length=64), nullable=False),
        sa.Column("dong_name", sa.String(length=64), nullable=False),
        sa.Column("partition_stage", sa.String(length=32), nullable=False),
        sa.Column("partition_seq", sa.Integer(), nullable=False),
        sa.Column("partition_type", sa.String(length=32), nullable=False),
        sa.Column("source_layer", sa.String(length=64), nullable=False),
        sa.Column("source_version", sa.String(length=32), nullable=True),
        sa.Column("map_name", sa.String(length=128), nullable=False),
        sa.Column("display_name", sa.String(length=128), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("theme_code", sa.String(length=64), nullable=True),
        sa.Column("landuse_code", sa.String(length=64), nullable=True),
        sa.Column("texture_profile", sa.String(length=64), nullable=True),
        sa.Column("is_road", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_walkable", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("centroid_lat", sa.Float(), nullable=True),
        sa.Column("centroid_lng", sa.Float(), nullable=True),
        sa.Column("boundary_geojson", sa.JSON(), nullable=True),
        sa.Column("source_feature", sa.JSON(), nullable=True),
        sa.Column("gameplay_meta", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["admin_area_id"], ["world_admin_area.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("partition_key"),
        sa.UniqueConstraint("admin_area_id", "partition_stage", "partition_seq", name="uq_partition_admin_stage_seq"),
    )
    op.create_index(op.f("ix_world_level_partition_id"), "world_level_partition", ["id"], unique=False)
    op.create_index(op.f("ix_world_level_partition_partition_key"), "world_level_partition", ["partition_key"], unique=True)
    op.create_index(op.f("ix_world_level_partition_admin_area_id"), "world_level_partition", ["admin_area_id"], unique=False)
    op.create_index(op.f("ix_world_level_partition_city_name"), "world_level_partition", ["city_name"], unique=False)
    op.create_index(op.f("ix_world_level_partition_district_name"), "world_level_partition", ["district_name"], unique=False)
    op.create_index(op.f("ix_world_level_partition_dong_name"), "world_level_partition", ["dong_name"], unique=False)
    op.create_index(op.f("ix_world_level_partition_partition_stage"), "world_level_partition", ["partition_stage"], unique=False)
    op.create_index(op.f("ix_world_level_partition_partition_type"), "world_level_partition", ["partition_type"], unique=False)
    op.create_index(op.f("ix_world_level_partition_source_layer"), "world_level_partition", ["source_layer"], unique=False)
    op.create_index(op.f("ix_world_level_partition_theme_code"), "world_level_partition", ["theme_code"], unique=False)
    op.create_index(op.f("ix_world_level_partition_landuse_code"), "world_level_partition", ["landuse_code"], unique=False)

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
    op.create_index(op.f("ix_world_partition_adjacency_from_partition_id"), "world_partition_adjacency", ["from_partition_id"], unique=False)
    op.create_index(op.f("ix_world_partition_adjacency_to_partition_id"), "world_partition_adjacency", ["to_partition_id"], unique=False)
    op.create_index(op.f("ix_world_partition_adjacency_relation_type"), "world_partition_adjacency", ["relation_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_world_partition_adjacency_relation_type"), table_name="world_partition_adjacency")
    op.drop_index(op.f("ix_world_partition_adjacency_to_partition_id"), table_name="world_partition_adjacency")
    op.drop_index(op.f("ix_world_partition_adjacency_from_partition_id"), table_name="world_partition_adjacency")
    op.drop_index(op.f("ix_world_partition_adjacency_id"), table_name="world_partition_adjacency")
    op.drop_table("world_partition_adjacency")

    op.drop_index(op.f("ix_world_level_partition_landuse_code"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_theme_code"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_source_layer"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_partition_type"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_partition_stage"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_dong_name"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_district_name"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_city_name"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_admin_area_id"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_partition_key"), table_name="world_level_partition")
    op.drop_index(op.f("ix_world_level_partition_id"), table_name="world_level_partition")
    op.drop_table("world_level_partition")

    op.drop_index(op.f("ix_world_admin_area_parent_id"), table_name="world_admin_area")
    op.drop_index(op.f("ix_world_admin_area_name"), table_name="world_admin_area")
    op.drop_index(op.f("ix_world_admin_area_area_code"), table_name="world_admin_area")
    op.drop_index(op.f("ix_world_admin_area_area_level"), table_name="world_admin_area")
    op.drop_index(op.f("ix_world_admin_area_osm_id"), table_name="world_admin_area")
    op.drop_index(op.f("ix_world_admin_area_id"), table_name="world_admin_area")
    op.drop_table("world_admin_area")
