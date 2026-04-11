"""
새 몬스터 13종 + 아이템 17종 DB 시드 스크립트
실행: python back/scripts/seed_monsters_v2.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import asyncio
from core.database import fetch_one, execute


# ── 새 아이템 (id 14~30) ───────────────────────────────────────
NEW_ITEMS = [
    # 소재 — 새 몬스터 드롭용
    {"id": 14, "name_ko": "요정 날개",    "name_en": "Fairy Wing",       "item_type": "material", "rarity": "common",    "stat_bonus": None,                   "description": "마포 요정에게서 얻은 투명한 날개 조각", "icon_key": "material_fairy_wing"},
    {"id": 15, "name_ko": "불사조 깃털",  "name_en": "Phoenix Feather",  "item_type": "material", "rarity": "epic",      "stat_bonus": None,                   "description": "타오르는 불사조의 깃털. 강렬한 열기가 느껴진다", "icon_key": "material_phoenix_feather"},
    {"id": 16, "name_ko": "해골 뼈",      "name_en": "Skeleton Bone",    "item_type": "material", "rarity": "common",    "stat_bonus": None,                   "description": "성동 해골로부터 얻은 뼈 조각", "icon_key": "material_bone"},
    {"id": 17, "name_ko": "영혼석",       "name_en": "Soul Gem",         "item_type": "material", "rarity": "rare",      "stat_bonus": None,                   "description": "종로 리치가 품고 있던 얼어붙은 영혼의 결정", "icon_key": "material_soul_gem"},
    {"id": 18, "name_ko": "산적 가면",    "name_en": "Bandit Mask",      "item_type": "material", "rarity": "common",    "stat_bonus": None,                   "description": "도봉 산적이 쓰던 낡은 가면", "icon_key": "material_bandit_mask"},
    {"id": 19, "name_ko": "박쥐 날개",    "name_en": "Bat Wing",         "item_type": "material", "rarity": "rare",      "stat_bonus": None,                   "description": "노원 뱀파이어에서 얻은 박쥐 날개", "icon_key": "material_bat_wing"},
    {"id": 20, "name_ko": "돌 파편",      "name_en": "Stone Fragment",   "item_type": "material", "rarity": "common",    "stat_bonus": None,                   "description": "강북 골렘의 몸에서 떨어진 돌 조각", "icon_key": "material_stone_fragment"},
    {"id": 21, "name_ko": "바다 비늘",    "name_en": "Sea Scale",        "item_type": "material", "rarity": "rare",      "stat_bonus": None,                   "description": "서초 바다뱀의 반짝이는 비늘", "icon_key": "material_sea_scale"},
    {"id": 22, "name_ko": "불주머니",     "name_en": "Flame Sac",        "item_type": "material", "rarity": "common",    "stat_bonus": None,                   "description": "송파 살라만더 몸속의 불 주머니", "icon_key": "material_flame_sac"},
    {"id": 23, "name_ko": "트롤 피",      "name_en": "Troll Blood",      "item_type": "material", "rarity": "rare",      "stat_bonus": None,                   "description": "구로 트롤의 강인한 재생력이 담긴 피", "icon_key": "material_troll_blood"},
    {"id": 24, "name_ko": "도깨비 정수",  "name_en": "Magic Wisp",       "item_type": "material", "rarity": "common",    "stat_bonus": None,                   "description": "광진 도깨비불에서 추출한 마법 결정", "icon_key": "material_magic_wisp"},
    {"id": 25, "name_ko": "석거인 핵",    "name_en": "Giant Stone Core", "item_type": "material", "rarity": "legendary", "stat_bonus": None,                   "description": "서대문 석거인의 몸 중심에 박혀 있던 신성한 핵", "icon_key": "material_stone_core"},
    {"id": 26, "name_ko": "늑대 발톱",    "name_en": "Wolf Claw",        "item_type": "material", "rarity": "epic",      "stat_bonus": None,                   "description": "동작 늑대인간에게서 얻은 날카로운 발톱", "icon_key": "material_wolf_claw"},
    # 장비 드롭
    {"id": 27, "name_ko": "철 검",        "name_en": "Iron Sword",       "item_type": "weapon",   "rarity": "rare",      "stat_bonus": {"attack": 15},          "description": "균형 잡힌 철로 만든 검", "icon_key": "weapon_iron_sword"},
    {"id": 28, "name_ko": "체인 갑옷",    "name_en": "Chain Mail",       "item_type": "armor",    "rarity": "rare",      "stat_bonus": {"defense": 12},         "description": "촘촘하게 엮인 쇠사슬 갑옷", "icon_key": "armor_chain_mail"},
    {"id": 29, "name_ko": "뼈 지팡이",    "name_en": "Bone Staff",       "item_type": "weapon",   "rarity": "epic",      "stat_bonus": {"attack": 25, "mp": 20}, "description": "리치가 사용하던 해골 지팡이. 마법 공격력 증가", "icon_key": "weapon_bone_staff"},
    {"id": 30, "name_ko": "마법 반지",    "name_en": "Enchanted Ring",   "item_type": "material", "rarity": "legendary", "stat_bonus": {"attack": 10, "defense": 5, "mp": 50}, "description": "모든 능력치를 강화하는 전설의 반지", "icon_key": "item_enchanted_ring"},
]


# ── 새 몬스터 13종 (id 8~20) ──────────────────────────────────
NEW_MONSTERS = [
    {
        "id": 8,
        "name_ko": "요정", "name_en": "Fairy",
        "tier": "normal", "origin_region": "Mapo",
        "property_type": "water",
        "model_path": "monsters/Mapo_Normal_Water_008_Fairy.glb",
        "model_scale": 0.5, "model_y_offset": 0.5,
        "base_hp": 45, "base_exp": 12,
        "description": "마포 강변에 서식하는 물의 요정. 연약해 보이지만 물 마법을 사용한다.",
        "drop_items": [
            {"item_id": 14, "rate": 0.7, "quantity": 1},
            {"item_id": 1,  "rate": 0.25, "quantity": 1},
        ],
    },
    {
        "id": 9,
        "name_ko": "불사조", "name_en": "Phoenix",
        "tier": "elite", "origin_region": "Yongsan",
        "property_type": "fire",
        "model_path": "monsters/Yongsan_Elite_Fire_009_Phoenix.glb",
        "model_scale": 0.2, "model_y_offset": 1.0,
        "base_hp": 420, "base_exp": 90,
        "description": "용산 하늘을 나는 불꽃 새. 죽어도 되살아난다는 전설이 있다.",
        "drop_items": [
            {"item_id": 15, "rate": 0.35, "quantity": 1},
            {"item_id": 22, "rate": 0.55, "quantity": 1},
            {"item_id": 2,  "rate": 0.3,  "quantity": 1},
        ],
    },
    {
        "id": 10,
        "name_ko": "해골", "name_en": "Skeleton",
        "tier": "normal", "origin_region": "Seongdong",
        "property_type": "stone",
        "model_path": "monsters/Seongdong_Normal_Stone_010_Skeleton.glb",
        "model_scale": 0.6, "model_y_offset": 0,
        "base_hp": 70, "base_exp": 16,
        "description": "성동 폐건물에서 출몰하는 해골 전사. 둔탁하지만 끈질기다.",
        "drop_items": [
            {"item_id": 16, "rate": 0.75, "quantity": 2},
            {"item_id": 1,  "rate": 0.2,  "quantity": 1},
        ],
    },
    {
        "id": 11,
        "name_ko": "리치", "name_en": "Lich",
        "tier": "boss", "origin_region": "Jongno",
        "property_type": "magic",
        "model_path": "monsters/Jongno_Boss_Magic_011_Lich.glb",
        "model_scale": 0.85, "model_y_offset": 0,
        "base_hp": 4500, "base_exp": 1800,
        "description": "종로 고궁 지하에 잠든 불멸의 마법사. 압도적인 마법으로 공격한다.",
        "drop_items": [
            {"item_id": 17, "rate": 0.7,  "quantity": 1},
            {"item_id": 29, "rate": 0.25, "quantity": 1},
            {"item_id": 3,  "rate": 0.5,  "quantity": 2},
        ],
    },
    {
        "id": 12,
        "name_ko": "산적", "name_en": "Bandit",
        "tier": "normal", "origin_region": "Dobong",
        "property_type": "forest",
        "model_path": "monsters/Dobong_Normal_Forest_012_Bandit.glb",
        "model_scale": 0.6, "model_y_offset": 0,
        "base_hp": 65, "base_exp": 14,
        "description": "도봉산 자락에서 출몰하는 산적. 무리를 지어 다닌다.",
        "drop_items": [
            {"item_id": 18, "rate": 0.4,  "quantity": 1},
            {"item_id": 1,  "rate": 0.3,  "quantity": 1},
            {"item_id": 11, "rate": 0.08, "quantity": 1},
        ],
    },
    {
        "id": 13,
        "name_ko": "뱀파이어", "name_en": "Vampire",
        "tier": "elite", "origin_region": "Nowon",
        "property_type": "dark",
        "model_path": "monsters/Nowon_Elite_Dark_013_Vampire.glb",
        "model_scale": 0.75, "model_y_offset": 0,
        "base_hp": 310, "base_exp": 85,
        "description": "노원 야산에 숨어 사는 뱀파이어 귀족. 밤에만 활동한다.",
        "drop_items": [
            {"item_id": 19, "rate": 0.5,  "quantity": 1},
            {"item_id": 7,  "rate": 0.3,  "quantity": 1},
            {"item_id": 2,  "rate": 0.25, "quantity": 1},
        ],
    },
    {
        "id": 14,
        "name_ko": "골렘", "name_en": "Golem",
        "tier": "normal", "origin_region": "Gangbuk",
        "property_type": "earth",
        "model_path": "monsters/Gangbuk_Normal_Earth_014_Golem.glb",
        "model_scale": 0.9, "model_y_offset": 0,
        "base_hp": 130, "base_exp": 22,
        "description": "강북 산 속에서 걸어다니는 돌 인형. 느리지만 공격력이 높다.",
        "drop_items": [
            {"item_id": 20, "rate": 0.8,  "quantity": 3},
            {"item_id": 5,  "rate": 0.2,  "quantity": 1},
        ],
    },
    {
        "id": 15,
        "name_ko": "바다뱀", "name_en": "Serpent",
        "tier": "elite", "origin_region": "Seocho",
        "property_type": "water",
        "model_path": "monsters/Seocho_Elite_Water_015_Serpent.glb",
        "model_scale": 0.7, "model_y_offset": 0.2,
        "base_hp": 380, "base_exp": 95,
        "description": "서초 한강 깊숙이 서식하는 거대 바다뱀. 맹독을 품고 있다.",
        "drop_items": [
            {"item_id": 21, "rate": 0.55, "quantity": 1},
            {"item_id": 6,  "rate": 0.45, "quantity": 2},
            {"item_id": 28, "rate": 0.12, "quantity": 1},
        ],
    },
    {
        "id": 16,
        "name_ko": "살라만더", "name_en": "Salamander",
        "tier": "normal", "origin_region": "Songpa",
        "property_type": "fire",
        "model_path": "monsters/Songpa_Normal_Fire_016_Salamander.glb",
        "model_scale": 0.55, "model_y_offset": 0,
        "base_hp": 55, "base_exp": 13,
        "description": "송파 화산지대에서 나타나는 불도마뱀. 불꽃을 뿜는다.",
        "drop_items": [
            {"item_id": 22, "rate": 0.65, "quantity": 1},
            {"item_id": 1,  "rate": 0.2,  "quantity": 1},
        ],
    },
    {
        "id": 17,
        "name_ko": "트롤", "name_en": "Troll",
        "tier": "elite", "origin_region": "Guro",
        "property_type": "earth",
        "model_path": "monsters/Guro_Elite_Earth_017_Troll.glb",
        "model_scale": 1.1, "model_y_offset": 0,
        "base_hp": 450, "base_exp": 100,
        "description": "구로 공단 지하에 숨어사는 거대 트롤. 재생력이 뛰어나다.",
        "drop_items": [
            {"item_id": 23, "rate": 0.5,  "quantity": 1},
            {"item_id": 5,  "rate": 0.4,  "quantity": 2},
            {"item_id": 27, "rate": 0.1,  "quantity": 1},
        ],
    },
    {
        "id": 18,
        "name_ko": "도깨비불", "name_en": "Wisp",
        "tier": "normal", "origin_region": "Gwangjin",
        "property_type": "magic",
        "model_path": "monsters/Gwangjin_Normal_Magic_018_Wisp.glb",
        "model_scale": 0.45, "model_y_offset": 0.8,
        "base_hp": 40, "base_exp": 11,
        "description": "광진 고택 주변을 떠도는 도깨비불. 실체가 없어 물리공격이 잘 통하지 않는다.",
        "drop_items": [
            {"item_id": 24, "rate": 0.7,  "quantity": 1},
            {"item_id": 1,  "rate": 0.15, "quantity": 1},
        ],
    },
    {
        "id": 19,
        "name_ko": "석거인", "name_en": "Stone Giant",
        "tier": "boss", "origin_region": "Seodaemun",
        "property_type": "stone",
        "model_path": "monsters/Seodaemun_Boss_Stone_019_Stone_Giant.glb",
        "model_scale": 1.4, "model_y_offset": 0,
        "base_hp": 6000, "base_exp": 2500,
        "description": "서대문 독립문 근처에서 봉인됐던 고대 석거인. 각 발걸음이 지진을 일으킨다.",
        "drop_items": [
            {"item_id": 25, "rate": 0.6,  "quantity": 1},
            {"item_id": 20, "rate": 0.9,  "quantity": 5},
            {"item_id": 30, "rate": 0.15, "quantity": 1},
        ],
    },
    {
        "id": 20,
        "name_ko": "늑대인간", "name_en": "Werewolf",
        "tier": "elite", "origin_region": "Dongjak",
        "property_type": "forest",
        "model_path": "monsters/Dongjak_Elite_Forest_020_Werewolf.glb",
        "model_scale": 0.95, "model_y_offset": 0,
        "base_hp": 400, "base_exp": 88,
        "description": "동작 보라매 공원에 출몰하는 늑대인간. 보름달이 뜨면 더욱 강해진다.",
        "drop_items": [
            {"item_id": 26, "rate": 0.45, "quantity": 1},
            {"item_id": 5,  "rate": 0.35, "quantity": 2},
            {"item_id": 27, "rate": 0.12, "quantity": 1},
        ],
    },
]


async def seed():
    print("=== 아이템 시드 시작 ===")
    for item in NEW_ITEMS:
        existing = await fetch_one("SELECT id FROM item WHERE id = :id", {"id": item["id"]})
        if existing:
            print(f"  [SKIP] item id={item['id']} ({item['name_en']}) 이미 존재")
            continue
        import json
        await execute(
            """INSERT INTO item (id, name_ko, name_en, item_type, rarity, stat_bonus, description, icon_key, is_active)
               VALUES (:id, :name_ko, :name_en, :item_type, :rarity,
                       CAST(:stat_bonus AS jsonb), :description, :icon_key, true)""",
            {
                "id": item["id"],
                "name_ko": item["name_ko"],
                "name_en": item["name_en"],
                "item_type": item["item_type"],
                "rarity": item["rarity"],
                "stat_bonus": json.dumps(item["stat_bonus"]) if item["stat_bonus"] else None,
                "description": item["description"],
                "icon_key": item["icon_key"],
            }
        )
        print(f"  [OK] item id={item['id']} ({item['name_en']}) 추가")

    print("\n=== 몬스터 시드 시작 ===")
    for m in NEW_MONSTERS:
        existing = await fetch_one("SELECT id FROM monster WHERE id = :id", {"id": m["id"]})
        if existing:
            print(f"  [SKIP] monster id={m['id']} ({m['name_en']}) 이미 존재")
            continue
        import json
        await execute(
            """INSERT INTO monster
               (id, name_ko, name_en, tier, origin_region, property_type,
                model_path, model_scale, model_y_offset,
                base_hp, base_exp, description, drop_items, is_active)
               VALUES
               (:id, :name_ko, :name_en, :tier, :origin_region, :property_type,
                :model_path, :model_scale, :model_y_offset,
                :base_hp, :base_exp, :description,
                CAST(:drop_items AS jsonb), true)""",
            {
                "id": m["id"],
                "name_ko": m["name_ko"],
                "name_en": m["name_en"],
                "tier": m["tier"],
                "origin_region": m["origin_region"],
                "property_type": m["property_type"],
                "model_path": m["model_path"],
                "model_scale": m["model_scale"],
                "model_y_offset": m["model_y_offset"],
                "base_hp": m["base_hp"],
                "base_exp": m["base_exp"],
                "description": m["description"],
                "drop_items": json.dumps(m["drop_items"]),
            }
        )
        print(f"  [OK] monster id={m['id']} ({m['name_en']}) 추가")

    print("\n=== 시퀀스 재조정 ===")
    await execute("SELECT setval('item_id_seq', (SELECT MAX(id) FROM item))")
    await execute("SELECT setval('monster_id_seq', (SELECT MAX(id) FROM monster))")
    print("  [OK] 시퀀스 업데이트 완료")
    print("\n시드 완료!")


if __name__ == "__main__":
    asyncio.run(seed())
