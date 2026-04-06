# 인벤토리/장비 DB CRUD — 아이템 조회/추가/장착
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


async def consume_item(user_id: int, item_id: int, quantity: int = 1) -> bool:
    """포션 등 소모성 아이템 사용 — 수량 감소, 0이면 삭제"""
    existing = await fetch_one(
        "SELECT id, quantity FROM character_inventory WHERE user_id = :uid AND item_id = :iid",
        {"uid": user_id, "iid": item_id}
    )
    if not existing or existing["quantity"] <= 0:
        return False
    if existing["quantity"] <= quantity:
        await execute(
            "DELETE FROM character_inventory WHERE id = :id",
            {"id": existing["id"]}
        )
    else:
        await execute(
            "UPDATE character_inventory SET quantity = quantity - :qty WHERE id = :id",
            {"qty": quantity, "id": existing["id"]}
        )
    return True


async def get_item_template(item_id: int) -> dict | None:
    """아이템 템플릿 단건 조회"""
    return await fetch_one(
        "SELECT * FROM item_template WHERE id = :id AND is_active = TRUE",
        {"id": item_id}
    )


# ──────────────────────────────────────────────
# 장비 착용 관련
# ──────────────────────────────────────────────

async def get_item_templates(user_id: int | None = None) -> list[dict]:
    """아이템 도감용 전체 템플릿 조회. user_id가 있으면 보유 수량 포함."""
    if user_id is None:
        return await fetch_all(
            """
            SELECT it.id AS item_id, it.name_ko, it.name_en, it.item_type, it.rarity,
                   it.stat_bonus, it.description, it.icon_key,
                   0 AS quantity
            FROM item_template it
            WHERE it.is_active = TRUE
            ORDER BY it.id
            """
        )

    return await fetch_all(
        """
        SELECT it.id AS item_id, it.name_ko, it.name_en, it.item_type, it.rarity,
               it.stat_bonus, it.description, it.icon_key,
               COALESCE(SUM(ci.quantity), 0) AS quantity
        FROM item_template it
        LEFT JOIN character_inventory ci
          ON ci.item_id = it.id AND ci.user_id = :user_id
        WHERE it.is_active = TRUE
        GROUP BY it.id, it.name_ko, it.name_en, it.item_type, it.rarity, it.stat_bonus, it.description, it.icon_key
        ORDER BY it.id
        """,
        {"user_id": user_id}
    )


EQUIPPABLE_TYPES = {"weapon", "armor", "helmet", "gloves", "boots"}

def get_slot_for_type(item_type: str) -> str | None:
    """item_type으로 장착 슬롯 결정"""
    slot_map = {
        "weapon": "weapon",
        "armor": "armor",
        "helmet": "helmet",
        "gloves": "gloves",
        "boots": "boots",
    }
    return slot_map.get(item_type)


async def get_equipment(user_id: int) -> dict:
    """현재 착용 장비 조회 → {slot: item_data}"""
    rows = await fetch_all(
        """SELECT ce.slot, ce.item_id,
                  it.name_ko, it.name_en, it.item_type, it.rarity,
                  it.stat_bonus, it.description, it.icon_key
           FROM character_equipment ce
           JOIN item_template it ON ce.item_id = it.id
           WHERE ce.user_id = :uid""",
        {"uid": user_id}
    )
    return {row["slot"]: dict(row) for row in rows}


async def equip_item(user_id: int, item_id: int) -> dict | None:
    """아이템 장착 — 같은 슬롯이면 교체"""
    item = await get_item_template(item_id)
    if not item:
        return None
    slot = get_slot_for_type(item["item_type"])
    if not slot:
        return None

    # 이미 같은 슬롯에 장비 있으면 교체
    existing = await fetch_one(
        "SELECT id FROM character_equipment WHERE user_id = :uid AND slot = :slot",
        {"uid": user_id, "slot": slot}
    )
    if existing:
        await execute(
            "UPDATE character_equipment SET item_id = :iid, equipped_at = now() WHERE user_id = :uid AND slot = :slot",
            {"uid": user_id, "slot": slot, "iid": item_id}
        )
    else:
        await execute(
            "INSERT INTO character_equipment (user_id, slot, item_id) VALUES (:uid, :slot, :iid)",
            {"uid": user_id, "slot": slot, "iid": item_id}
        )
    return {"slot": slot, **item}


async def unequip_item(user_id: int, slot: str) -> bool:
    """슬롯 장비 해제"""
    await execute(
        "DELETE FROM character_equipment WHERE user_id = :uid AND slot = :slot",
        {"uid": user_id, "slot": slot}
    )
    return True


async def get_equipment_stat_bonus(user_id: int) -> dict:
    """모든 착용 장비 스탯 합산 → {"attack": N, "defense": N, ...}"""
    rows = await fetch_all(
        """SELECT it.stat_bonus
           FROM character_equipment ce
           JOIN item_template it ON ce.item_id = it.id
           WHERE ce.user_id = :uid AND it.stat_bonus IS NOT NULL""",
        {"uid": user_id}
    )
    totals: dict[str, int] = {}
    for row in rows:
        bonus = row["stat_bonus"] or {}
        for stat, val in bonus.items():
            totals[stat] = totals.get(stat, 0) + val
    return totals
