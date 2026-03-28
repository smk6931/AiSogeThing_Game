# 몬스터 템플릿 API 라우터
from fastapi import APIRouter, HTTPException
from core.database import fetch_all, fetch_one
from monster.managers.MonsterManager import monster_manager

router = APIRouter(prefix="/api/monsters", tags=["Monster"])


@router.get("/live")
async def get_live_monsters():
    """현재 인메모리 몬스터 상태 디버그 확인용"""
    return monster_manager.get_all_monsters()


@router.get("/templates")
async def get_all_templates():
    """활성화된 모든 몬스터 템플릿 목록 반환"""
    rows = await fetch_all(
        "SELECT * FROM monster_template WHERE is_active = true ORDER BY id"
    )
    return rows


@router.get("/templates/{template_id}")
async def get_template(template_id: int):
    """특정 몬스터 템플릿 상세 정보 반환"""
    row = await fetch_one(
        "SELECT * FROM monster_template WHERE id = :id",
        {"id": template_id}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Monster template not found")
    return row
