from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class WorldAdminArea(Base):
    __tablename__ = "world_area"

    id = Column(Integer, primary_key=True, index=True)
    osm_id = Column(BigInteger, unique=True, nullable=True, index=True)
    area_level = Column(String(32), nullable=False, index=True)
    area_code = Column(String(128), nullable=True, unique=True, index=True)
    name = Column(String(128), nullable=False, index=True)
    name_en = Column(String(128), nullable=True)
    parent_id = Column(Integer, ForeignKey("world_area.id"), nullable=True, index=True)  # self-ref
    center_lat = Column(Float, nullable=True)
    center_lng = Column(Float, nullable=True)
    boundary_geojson = Column(JSON, nullable=True)
    area_meta = Column(JSON, nullable=True)
    persona_tag = Column(String(64), nullable=True, index=True)
    texture_style_profile = Column(String(64), nullable=True)
    image_prompt_base = Column(Text, nullable=True)
    image_prompt_negative = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    parent = relationship("WorldAdminArea", remote_side=[id], backref="children")


class WorldLevelPartition(Base):
    __tablename__ = "world_partition"  # 실제 테이블 (world_level_partition은 group JOIN view)

    id = Column(BigInteger, primary_key=True, index=True)
    partition_key = Column(String(160), nullable=False, unique=True, index=True)
    admin_area_id = Column(Integer, ForeignKey("world_area.id"), nullable=False, index=True)
    city_name = Column(String(64), nullable=False, index=True)
    district_name = Column(String(64), nullable=False, index=True)
    dong_name = Column(String(64), nullable=False, index=True)
    partition_stage = Column(String(32), nullable=False, index=True)
    partition_seq = Column(Integer, nullable=False)
    source_layer = Column(String(64), nullable=False, index=True)
    display_name = Column(String(128), nullable=False)
    summary = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    theme_code = Column(String(64), nullable=True, index=True)
    group_key = Column(String(160), nullable=True, index=True)
    group_seq = Column(Integer, nullable=True, index=True)
    group_display_name = Column(String(128), nullable=True, index=True)
    group_theme_code = Column(String(64), nullable=True, index=True)
    landuse_code = Column(String(64), nullable=True, index=True)
    dominant_landuse = Column(String(64), nullable=True, index=True)
    texture_profile = Column(String(64), nullable=True)
    is_road = Column(Boolean, nullable=False, server_default="false")
    area_m2 = Column(Float, nullable=True)
    centroid_lat = Column(Float, nullable=True)
    centroid_lng = Column(Float, nullable=True)
    boundary_geojson = Column(JSON, nullable=True)
    image_prompt_negative = Column(Text, nullable=True)
    texture_image_url = Column(String(256), nullable=True)
    elevation_m = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    admin_area = relationship("WorldAdminArea", backref="partitions")
    group_memberships = relationship("WorldPartitionGroupMember", back_populates="partition", lazy="dynamic")

    __table_args__ = (
        UniqueConstraint("admin_area_id", "partition_stage", "partition_seq", name="uq_partition_admin_stage_seq"),
    )


class WorldPartitionGroup(Base):
    __tablename__ = "world_partition_group"

    id = Column(BigInteger, primary_key=True, index=True)
    group_key = Column(String(160), nullable=False, index=True)
    admin_area_id = Column(Integer, ForeignKey("world_area.id"), nullable=True, index=True)
    group_seq = Column(Integer, nullable=True, index=True)
    display_name = Column(String(128), nullable=True, index=True)
    summary = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    theme_code = Column(String(64), nullable=True, index=True)
    image_prompt_base = Column(Text, nullable=True)
    centroid_lat = Column(Float, nullable=True)
    centroid_lng = Column(Float, nullable=True)
    boundary_geojson = Column(JSON, nullable=True)
    is_active = Column(Boolean, nullable=False, server_default="true")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    admin_area = relationship("WorldAdminArea", backref="partition_groups")
    members = relationship("WorldPartitionGroupMember", back_populates="group", lazy="dynamic")


class WorldPartitionGroupMember(Base):
    __tablename__ = "world_partition_group_member"

    id = Column(BigInteger, primary_key=True, index=True)
    group_id = Column(BigInteger, ForeignKey("world_partition_group.id"), nullable=False, index=True)
    partition_id = Column(BigInteger, ForeignKey("world_partition.id"), nullable=False, index=True)
    member_order = Column(Integer, nullable=True)
    member_role = Column(String(32), nullable=True)
    weight = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    group = relationship("WorldPartitionGroup", back_populates="members")
    partition = relationship("WorldLevelPartition", back_populates="group_memberships")

    __table_args__ = (
        UniqueConstraint("group_id", "partition_id", name="uq_world_partition_group_member_group_partition"),
    )
