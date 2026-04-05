# 인벤토리 조회 API
from fastapi import APIRouter
from item import repository

router = APIRouter(prefix="/api/item", tags=["Item"])


@router.get("/inventory/{user_id}")
async def get_inventory(user_id: int):
    items = await repository.get_inventory(user_id)
    return {"items": items}
