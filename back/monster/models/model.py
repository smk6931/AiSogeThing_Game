# monster_template 테이블 — 게임 내 모든 몬스터 종류 정의
from sqlalchemy import Boolean, Column, Float, Integer, JSON, String, Text
from core.database import Base


class MonsterTemplate(Base):
    __tablename__ = "monster_template"

    id = Column(Integer, primary_key=True, index=True)
    name_en = Column(String(128), nullable=False)
    name_ko = Column(String(128), nullable=False)
    tier = Column(String(32), nullable=False, default="normal")  # normal / elite / boss
    origin_region = Column(String(128), nullable=True)
    property_type = Column(String(64), nullable=True)  # fire / water / forest / stone / dark / magic / earth
    model_path = Column(String(256), nullable=False)   # e.g. monsters/Gangnam_Boss_Fire_001_Dragon.glb
    model_scale = Column(Float, nullable=False, default=1.0)
    model_y_offset = Column(Float, nullable=False, default=0.0)
    base_hp = Column(Integer, nullable=False, default=100)
    base_exp = Column(Integer, nullable=False, default=30)
    description = Column(Text, nullable=True)
    drop_items = Column(JSON, nullable=True)  # [{"item": "Fire Scale", "rate": 0.3, "icon": "🔥"}]
    is_active = Column(Boolean, nullable=False, default=True)
