# 플레이어 캐릭터 DB CRUD — 스탯 로드/저장
from core.database import fetch_one, execute, insert_and_return


async def get_character(user_id: int) -> dict | None:
    """char 테이블에서 스탯 로드"""
    return await fetch_one(
        """SELECT level, exp, hp, max_hp, mp, max_mp, gold, attack
           FROM char WHERE user_id = :uid""",
        {"uid": user_id}
    )


async def upsert_character(user_id: int) -> dict:
    """캐릭터 없으면 기본값으로 생성, 있으면 그냥 조회"""
    existing = await get_character(user_id)
    if existing:
        return existing
    row = await insert_and_return(
        """INSERT INTO char (user_id, level, exp, hp, max_hp, mp, max_mp, gold, attack)
           VALUES (:uid, 1, 0, 100, 100, 50, 50, 0, 12)
           RETURNING level, exp, hp, max_hp, mp, max_mp, gold, attack""",
        {"uid": user_id}
    )
    return row or {"level": 1, "exp": 0, "hp": 100, "max_hp": 100, "mp": 50, "max_mp": 50, "gold": 0, "attack": 12}


async def get_ui_settings(user_id: int) -> dict | None:
    """게임 UI/전투 설정 로드"""
    row = await fetch_one(
        "SELECT ui_settings FROM char WHERE user_id = :uid",
        {"uid": user_id}
    )
    return row["ui_settings"] if row and row["ui_settings"] else None


async def save_ui_settings(user_id: int, settings: dict) -> None:
    """게임 UI/전투 설정 저장 (JSONB merge — 기존 키 보존, 전달한 키만 덮어씀)"""
    import json
    await execute(
        "UPDATE char SET ui_settings = COALESCE(ui_settings, '{}'::jsonb) || CAST(:s AS jsonb) WHERE user_id = :uid",
        {"uid": user_id, "s": json.dumps(settings)}
    )


async def save_character(user_id: int, stats: dict) -> None:
    """레벨/EXP/골드/스탯 변경 시 DB 업데이트"""
    await execute(
        """UPDATE char
           SET level = :level, exp = :exp, hp = :hp, max_hp = :max_hp,
               mp = :mp, max_mp = :max_mp, gold = :gold, attack = :attack
           WHERE user_id = :uid""",
        {
            "uid": user_id,
            "level": stats.get("level", 1),
            "exp": stats.get("exp", 0),
            "hp": stats.get("hp", 100),
            "max_hp": stats.get("maxHp", 100),
            "mp": stats.get("mp", 50),
            "max_mp": stats.get("maxMp", 50),
            "gold": stats.get("gold", 0),
            "attack": stats.get("attack", 12),
        }
    )
