# 인벤토리 DB CRUD — 아이템 조회/추가/수량 업데이트
from core.database import fetch_all, fetch_one, execute, insert_and_return


async def get_inventory(user_id: int) -> list[dict]:
    """유저 인벤토리 전체 조회 (아이템 정보 JOIN)"""
    query = """
        SELECT ci.id, ci.user_id, ci.item_id, ci.quantity, ci.slot_index, ci.acquired_at,
               it.name_ko, it.name_en, it.item_type, it.rarity, it.stat_bonus,
               it.description, it.icon_key
        FROM character_inventory ci
        JOIN item_template it ON ci.item_id = it.id
        WHERE ci.user_id = :user_id
        ORDER BY ci.acquired_at DESC
    """
    return await fetch_all(query, {"user_id": user_id})


async def add_item(user_id: int, item_id: int, quantity: int = 1) -> dict | None:
    """인벤토리에 아이템 추가 — 이미 있으면 수량 증가"""
    existing = await fetch_one(
        "SELECT id, quantity FROM character_inventory WHERE user_id = :uid AND item_id = :iid",
        {"uid": user_id, "iid": item_id}
    )
    if existing:
        await execute(
            "UPDATE character_inventory SET quantity = quantity + :qty WHERE id = :id",
            {"qty": quantity, "id": existing["id"]}
        )
        return {**existing, "quantity": existing["quantity"] + quantity}

    return await insert_and_return(
        """INSERT INTO character_inventory (user_id, item_id, quantity)
           VALUES (:uid, :iid, :qty) RETURNING id, user_id, item_id, quantity""",
        {"uid": user_id, "iid": item_id, "qty": quantity}
    )


async def get_item_template(item_id: int) -> dict | None:
    """아이템 템플릿 단건 조회"""
    return await fetch_one(
        "SELECT * FROM item_template WHERE id = :id AND is_active = TRUE",
        {"id": item_id}
    )
