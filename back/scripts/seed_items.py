# 아이템 템플릿 시드 데이터 INSERT
import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from core.database import execute, fetch_one

ITEMS = [
    # 포션류
    {"id": 1,  "name_ko": "HP 포션 (소)", "name_en": "HP Potion (S)", "item_type": "potion", "rarity": "common",    "stat_bonus": {"hp": 50},          "description": "HP를 50 회복한다.", "icon_key": "potion_hp_s"},
    {"id": 2,  "name_ko": "HP 포션 (중)", "name_en": "HP Potion (M)", "item_type": "potion", "rarity": "common",    "stat_bonus": {"hp": 150},         "description": "HP를 150 회복한다.", "icon_key": "potion_hp_m"},
    {"id": 3,  "name_ko": "HP 포션 (대)", "name_en": "HP Potion (L)", "item_type": "potion", "rarity": "rare",      "stat_bonus": {"hp": 400},         "description": "HP를 400 회복한다.", "icon_key": "potion_hp_l"},
    # 소재류
    {"id": 4,  "name_ko": "고블린 귀",    "name_en": "Goblin Ear",    "item_type": "material","rarity": "common",    "stat_bonus": None,                "description": "고블린의 귀. 상인이 좋아한다.", "icon_key": "mat_goblin_ear"},
    {"id": 5,  "name_ko": "오크 가죽",    "name_en": "Orc Hide",      "item_type": "material","rarity": "common",    "stat_bonus": None,                "description": "질긴 오크 가죽.", "icon_key": "mat_orc_hide"},
    {"id": 6,  "name_ko": "슬라임 젤",    "name_en": "Slime Gel",     "item_type": "material","rarity": "common",    "stat_bonus": None,                "description": "끈적한 슬라임 젤.", "icon_key": "mat_slime_gel"},
    {"id": 7,  "name_ko": "마녀의 뿔",    "name_en": "Witch Horn",    "item_type": "material","rarity": "rare",      "stat_bonus": None,                "description": "마녀에게서 얻은 뿔. 마력이 깃들어 있다.", "icon_key": "mat_witch_horn"},
    {"id": 8,  "name_ko": "좀비 뼛가루",  "name_en": "Zombie Bone",   "item_type": "material","rarity": "common",    "stat_bonus": None,                "description": "좀비의 뼈를 갈아 만든 가루.", "icon_key": "mat_zombie_bone"},
    {"id": 9,  "name_ko": "용의 비늘",    "name_en": "Dragon Scale",  "item_type": "material","rarity": "legendary", "stat_bonus": None,                "description": "드래곤에게서 얻은 비늘. 극히 희귀하다.", "icon_key": "mat_dragon_scale"},
    {"id": 10, "name_ko": "오우거 심장",  "name_en": "Ogre Heart",    "item_type": "material","rarity": "epic",      "stat_bonus": None,                "description": "오우거의 심장. 강한 생명력이 느껴진다.", "icon_key": "mat_ogre_heart"},
    # 장비류
    {"id": 11, "name_ko": "목검",         "name_en": "Wooden Sword",  "item_type": "weapon",  "rarity": "common",    "stat_bonus": {"attack": 5},       "description": "초보자용 목검.", "icon_key": "weapon_wood_sword"},
    {"id": 12, "name_ko": "가죽 갑옷",    "name_en": "Leather Armor", "item_type": "armor",   "rarity": "common",    "stat_bonus": {"defense": 4},      "description": "가죽으로 만든 갑옷.", "icon_key": "armor_leather"},
    {"id": 13, "name_ko": "마법사 모자",  "name_en": "Mage Hat",      "item_type": "armor",   "rarity": "rare",      "stat_bonus": {"mp": 30, "attack": 3}, "description": "마법 공격력이 높아지는 모자.", "icon_key": "armor_mage_hat"},
]

MONSTER_DROP_UPDATES = [
    # monster_template id → drop_items JSONB
    # 현재는 monster_template 테이블에 시드가 없으므로 향후 사용
    # MonsterManager의 MONSTER_TEMPLATES와 동기화 예정
]

async def seed():
    print("Seeding item_template...")
    for item in ITEMS:
        existing = await fetch_one("SELECT id FROM item_template WHERE id = :id", {"id": item["id"]})
        if existing:
            print(f"  SKIP: {item['name_ko']} (id={item['id']} already exists)")
            continue
        import json
        stat_json = json.dumps(item["stat_bonus"]) if item["stat_bonus"] else None
        await execute(
            """INSERT INTO item_template (id, name_ko, name_en, item_type, rarity, stat_bonus, description, icon_key, is_active)
               VALUES (:id, :name_ko, :name_en, :item_type, :rarity, CAST(:stat_bonus AS jsonb), :description, :icon_key, TRUE)""",
            {
                "id": item["id"],
                "name_ko": item["name_ko"],
                "name_en": item["name_en"],
                "item_type": item["item_type"],
                "rarity": item["rarity"],
                "stat_bonus": stat_json,
                "description": item["description"],
                "icon_key": item["icon_key"],
            }
        )
        print(f"  INSERT: {item['name_ko']} ({item['rarity']})")
    print(f"Done. {len(ITEMS)} items processed.")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
    asyncio.run(seed())
