# 아이템 드롭 확률 계산 및 인벤토리 지급
import random
from item.repositories import repository


async def roll_drops(drop_table: list[dict]) -> list[dict]:
    """
    drop_table 예시: [{"item_id": 1, "rate": 0.5, "quantity": 1}, ...]
    rate: 0.0~1.0 확률
    드롭된 아이템 목록 반환
    """
    dropped = []
    for entry in (drop_table or []):
        roll = random.random()
        rate = entry.get("rate", 0)
        print(f"[ROLL] item_id={entry.get('item_id')} rate={rate:.2f} roll={roll:.2f} hit={roll < rate}")
        if roll < rate:
            try:
                item = await repository.get_item(entry["item_id"])
            except Exception as e:
                print(f"[WARN] get_item({entry['item_id']}) failed: {e}")
                continue
            if item:
                dropped.append({
                    "item_id": item["id"],
                    "name_ko": item["name_ko"],
                    "rarity": item["rarity"],
                    "icon_key": item["icon_key"],
                    "quantity": entry.get("quantity", 1),
                })
            else:
                print(f"[WARN] item_id={entry['item_id']} not found in item")
    return dropped


async def grant_items_to_user(user_id: int, dropped_items: list[dict]) -> list[dict]:
    """드롭된 아이템을 DB 인벤토리에 저장"""
    results = []
    for item in dropped_items:
        await repository.add_item(user_id, item["item_id"], item.get("quantity", 1))
        results.append(item)
    return results
