from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class NovelCutBase(BaseModel):
    cut_order: int
    scene_desc: Optional[str] = None
    image_path: Optional[str] = None

class NovelCutResponse(NovelCutBase):
    id: int
    novel_id: int

    class Config:
        from_attributes = True

class NovelBase(BaseModel):
    title: Optional[str] = None
    genre: Optional[str] = None
    script: Optional[str] = None
    character_descriptions: Optional[str] = None

class NovelCreate(BaseModel):
    topic: str  # The prompt for generation
    character_count: Optional[int] = 2  # Number of characters
    character_descriptions: Optional[str] = "남녀 주인공"  # Character descriptions
    scene_count: Optional[int] = 4  # Number of scenes
    script_length: Optional[str] = "medium"  # short/medium/long

class NovelResponse(NovelBase):
    id: int
    created_at: datetime
    cuts: List[NovelCutResponse] = []
    thumbnail_image: Optional[str] = None

    class Config:
        from_attributes = True
