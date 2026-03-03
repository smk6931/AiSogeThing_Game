from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class Novel(Base):
    __tablename__ = "novels"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=True)
    genre = Column(String(50), nullable=True)
    script = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    cuts = relationship("NovelCut", back_populates="novel", cascade="all, delete-orphan")

class NovelCut(Base):
    __tablename__ = "novel_cuts"

    id = Column(Integer, primary_key=True, index=True)
    novel_id = Column(Integer, ForeignKey("novels.id"), nullable=False)
    cut_order = Column(Integer, nullable=False)
    scene_desc = Column(Text, nullable=True) # Description used for generation
    image_path = Column(String(255), nullable=True) # Path to the generated image
    
    novel = relationship("Novel", back_populates="cuts")
