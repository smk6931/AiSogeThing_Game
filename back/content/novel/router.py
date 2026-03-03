from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List
import os

from content.novel.schemas import NovelCreate, NovelResponse
from content.novel import service
from content.novel.langgraph_workflow import generate_webtoon_task
from utils.safe_ops import handle_exceptions

router = APIRouter(
    prefix="/api/content/novel",
    tags=["Novel"],
    responses={404: {"description": "Not found"}},
)

from datetime import datetime

@router.post("/generate", response_model=NovelResponse)
@handle_exceptions(default_message="웹툰 생성 요청 실패")
async def generate_novel(request: NovelCreate, background_tasks: BackgroundTasks):
    """
    AI 웹툰 생성 요청 (비동기 처리)
    ID를 즉시 반환하고 백그라운드에서 생성 작업을 수행합니다.
    """
    # 1. 빈 소설 레코드 생성 (ID 확보)
    novel = await service.create_novel(request.topic)
    novel_id = novel["id"]
    
    # 2. 백그라운드 태스크 등록
    background_tasks.add_task(
        generate_webtoon_task,
        novel_id=novel_id,
        topic=request.topic,
        character_count=request.character_count,
        character_descriptions=request.character_descriptions,
        scene_count=request.scene_count,
        script_length=request.script_length
    )
    
    # 3. 초기 상태 반환 (DB 조회 회피)
    # create_novel의 커밋 시점 문제로 인해 조회 시 None이 뜰 수 있음
    return {
        "id": novel_id,
        "title": request.topic[:50] + "..." if len(request.topic) > 50 else request.topic,
        "script": "",
        "created_at": datetime.now(),
        "cuts": [],
        "thumbnail_image": None,
        "character_descriptions": None
    }


@router.get("/{novel_id}", response_model=NovelResponse)
@handle_exceptions(default_message="웹툰 조회 실패")
async def get_novel(novel_id: int):
    novel = await service.get_novel(novel_id)
    if not novel:
        raise HTTPException(status_code=404, detail="Novel not found")
    return novel


@router.get("/", response_model=List[NovelResponse])
@handle_exceptions(default_message="웹툰 목록 조회 실패")
async def list_novels():
    return await service.list_novels()


# ========================================================
#  이미지 서빙 API
# ========================================================

@router.get("/image/character/{filename}")
async def get_character_image(filename: str):
    """캐릭터 이미지 조회"""
    file_path = os.path.join("static/generated/characters", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/png")


@router.get("/image/scene/{filename}")
async def get_scene_image(filename: str):
    """씬 이미지 조회"""
    file_path = os.path.join("static/generated/scenes", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/png")


@router.get("/image/cover/{filename}")
async def get_cover_image(filename: str):
    """표지 이미지 조회"""
    file_path = os.path.join("static/generated/covers", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path, media_type="image/png")
