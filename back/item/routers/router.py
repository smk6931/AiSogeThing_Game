# 인벤토리/장비 조회·장착 API
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from item import repository
from player.managers.PlayerManager import player_manager

router = APIRouter(prefix="/api/item", tags=["Item"])


@router.get("/inventory/{user_id}")
async def get_inventory(user_id: int):
    items = await repository.get_inventory(user_id)
    return {"items": items}


@router.get("/templates")
async def get_item_templates(user_id: int | None = None):
    items = await repository.get_item_templates(user_id)
    return {"items": items}


@router.get("/equipment/{user_id}")
async def get_equipment(user_id: int):
    equipment = await repository.get_equipment(user_id)
    return {"equipment": equipment}


class EquipRequest(BaseModel):
    user_id: int
    item_id: int


@router.put("/equip")
async def equip_item(req: EquipRequest):
    """장비 착용 — 같은 슬롯이면 교체. 착용 후 메모리 스탯도 갱신."""
    result = await repository.equip_item(req.user_id, req.item_id)
    if not result:
        raise HTTPException(status_code=400, detail="착용 불가 아이템이거나 존재하지 않습니다.")

    # 장비 전체 스탯 합산 → 플레이어 메모리 스탯 업데이트
    bonus = await repository.get_equipment_stat_bonus(req.user_id)
    updated_stats = _apply_equipment_bonus(req.user_id, bonus)
    return {"slot": result["slot"], "item": result, "stats": updated_stats}


@router.delete("/equip/{user_id}/{slot}")
async def unequip_item(user_id: int, slot: str):
    """장비 해제 후 메모리 스탯 갱신"""
    await repository.unequip_item(user_id, slot)
    bonus = await repository.get_equipment_stat_bonus(user_id)
    updated_stats = _apply_equipment_bonus(user_id, bonus)
    return {"unequipped": slot, "stats": updated_stats}


def _apply_equipment_bonus(user_id: int, bonus: dict) -> dict | None:
    """플레이어 메모리 스탯에 장비 보너스 반영 (base + bonus)"""
    player = player_manager.get_player(str(user_id))
    if not player:
        return None
    stats = player.get("stats", {})
    # base_attack: level-up 전 기본값 (attack에서 장비 보너스 제거 후 재계산)
    # 단순화: attack을 300 기준 + 장비 보너스로 설정
    base_attack = stats.get("_base_attack", stats.get("attack", 300))
    stats["_base_attack"] = base_attack
    stats["attack"] = base_attack + bonus.get("attack", 0)
    stats["defense"] = bonus.get("defense", 0)
    stats["mp"] = stats.get("maxMp", 50) + bonus.get("mp", 0)
    return dict(stats)
