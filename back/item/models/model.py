# 아이템 정의 및 플레이어 인벤토리 테이블
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.sql import func
from core.database import Base


class ItemTemplate(Base):
    """게임 내 모든 아이템 종류 정의"""
    __tablename__ = "item_template"

    id = Column(Integer, primary_key=True, index=True)
    name_ko = Column(String(128), nullable=False)
    name_en = Column(String(128), nullable=False)
    item_type = Column(String(32), nullable=False)       # weapon / armor / potion / material
    rarity = Column(String(32), nullable=False, default="common")  # common / rare / epic / legendary
    stat_bonus = Column(JSON, nullable=True)             # {"attack": 5, "defense": 3, "hp": 50}
    description = Column(Text, nullable=True)
    icon_key = Column(String(128), nullable=True)        # 프론트 아이콘 식별자
    is_active = Column(Boolean, nullable=False, default=True)


class CharacterInventory(Base):
    """플레이어 인벤토리 — user_id 기준 (guest 포함)"""
    __tablename__ = "character_inventory"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("item_template.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    slot_index = Column(Integer, nullable=True)
    acquired_at = Column(DateTime, server_default=func.now())
