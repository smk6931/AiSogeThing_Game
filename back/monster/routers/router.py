# 몬스터 템플릿 API 라우터
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.database import fetch_all, fetch_one
from monster.managers.MonsterManager import monster_manager, MONSTER_TEMPLATES

router = APIRouter(prefix="/api/monsters", tags=["Monster"])


@router.get("/live")
async def get_live_monsters():
    """현재 인메모리 몬스터 상태 디버그 확인용"""
    return monster_manager.get_all_monsters()


@router.get("/templates")
async def get_all_templates():
    """활성화된 모든 몬스터 템플릿 목록 반환 (도감용)"""
    rows = await fetch_all(
        "SELECT * FROM monster WHERE is_active = true ORDER BY id"
    )
    return rows


@router.get("/templates/{template_id}")
async def get_template(template_id: int):
    """특정 몬스터 템플릿 상세 정보 반환"""
    row = await fetch_one(
        "SELECT * FROM monster WHERE id = :id",
        {"id": template_id}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Monster template not found")
    return row


# ── 스폰 설정 API ─────────────────────────────────────────────

class SpawnConfigBody(BaseModel):
    enabled_template_ids: list[int]  # 빈 리스트 = 전체 허용


@router.get("/spawn-config")
async def get_spawn_config():
    """현재 서버 스폰 설정 반환"""
    ids = list(monster_manager.enabled_template_ids) if monster_manager.enabled_template_ids else []
    all_ids = [t["template_id"] for t in MONSTER_TEMPLATES]
    return {
        "enabled_template_ids": ids,
        "all_template_ids": all_ids,
        "is_all": monster_manager.enabled_template_ids is None,
    }


@router.put("/spawn-config")
async def set_spawn_config(body: SpawnConfigBody):
    """
    스폰 허용 몬스터 템플릿 ID 목록 변경.
    빈 리스트([]) 전달 시 전체 허용으로 초기화.
    변경 즉시 적용 (기존 스폰된 몬스터는 유지, 이후 리스폰부터 반영).
    """
    monster_manager.set_enabled_templates(body.enabled_template_ids)
    is_all = monster_manager.enabled_template_ids is None
    return {
        "ok": True,
        "enabled_template_ids": body.enabled_template_ids,
        "is_all": is_all,
        "message": "전체 허용" if is_all else f"{len(body.enabled_template_ids)}종 활성화",
    }


@router.post("/respawn")
async def respawn_monsters():
    """현재 스폰 설정 기준으로 몬스터 전체 리스폰 (기존 몬스터 초기화)"""
    monster_manager.monsters.clear()
    monster_manager.next_id = 1
    monster_manager._spawn_all_at_start()
    return {
        "ok": True,
        "spawned": len(monster_manager.monsters),
        "templates_used": [m.template_id for m in monster_manager.monsters.values()],
    }
