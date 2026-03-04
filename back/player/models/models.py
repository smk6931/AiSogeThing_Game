from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

class GameCharacter(Base):
    __tablename__ = "game_character"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), unique=True, nullable=False)
    
    level = Column(Integer, default=1)
    exp = Column(Integer, default=0)
    hp = Column(Integer, default=100)
    max_hp = Column(Integer, default=100)
    mp = Column(Integer, default=50)
    max_mp = Column(Integer, default=50)
    
    # User와 1:1 관계 (User에서 character 접근 가능)
    user = relationship("user.models.User", backref="character")
