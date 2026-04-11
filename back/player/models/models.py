from sqlalchemy import Column, ForeignKey, Integer, JSON
from sqlalchemy.orm import relationship

from core.database import Base


class GameCharacter(Base):
    __tablename__ = "char"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), unique=True, nullable=False)

    level = Column(Integer, default=1)
    exp = Column(Integer, default=0)
    hp = Column(Integer, default=100)
    max_hp = Column(Integer, default=100)
    mp = Column(Integer, default=50)
    max_mp = Column(Integer, default=50)
    gold = Column(Integer, default=0)
    attack = Column(Integer, default=12)
    ui_settings = Column(JSON, nullable=True)

    user = relationship("user.models.User", backref="character")


class PlayerLevelCurve(Base):
    __tablename__ = "char_level_exp"

    level = Column(Integer, primary_key=True, index=True)
    required_exp_total = Column(Integer, nullable=False)
    reward_stat_points = Column(Integer, default=0)
    reward_skill_points = Column(Integer, default=0)
