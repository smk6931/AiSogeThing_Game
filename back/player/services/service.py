# 플레이어 비즈니스 로직 — 전투 계산, 스탯 처리, WebSocket 핸들러

from player.repositories import repository as char_repo
from item.repositories import repository as item_repo
from item.services.service import roll_drops, grant_items_to_user


# ── 전투 / 스킬 계산 (pure functions) ─────────────────────────

SKILL_POWER = {
    "basic": 0,
    "pyramid_punch": 8,
    "magic_orb": 10,
}


def calc_damage(player_attack: int, skill_name: str) -> int:
    return max(1, player_attack + SKILL_POWER.get(skill_name, 0))


def apply_hit_to_monster(monster, player_attack: int, skill_name: str) -> dict:
    """Monster 객체에 피격을 적용하고 결과 dict를 반환한다."""
    if monster.state == "dead" or monster.hp <= 0:
        return {"ok": False, "reason": "monster_already_dead"}

    damage = calc_damage(player_attack, skill_name)
    monster.hp -= damage
    monster.state = "hit"
    print(f"Monster {monster.id} hit! Damage: {damage}, HP: {monster.hp}/{monster.max_hp}")

    result = {
        "ok": True,
        "monsterId": monster.id,
        "damage": damage,
        "hp": max(0, monster.hp),
        "maxHp": monster.max_hp,
        "state": monster.state,
        "killed": False,
        "expReward": 0,
        "goldReward": 0,
    }

    if monster.hp <= 0:
        monster.hp = 0
        monster.state = "dead"
        result.update({
            "hp": 0,
            "state": "dead",
            "killed": True,
            "expReward": monster.exp_reward,
            "goldReward": monster.gold_reward,
            "dropTable": monster.drops,
        })

    return result


# ── 플레이어 스탯 계산 (pure functions) ───────────────────────

def _required_exp_for_level(level: int) -> int:
    if level <= 1:
        return 0
    return (level - 1) * level * 50


def apply_damage_to_stats(stats: dict, damage: int) -> dict:
    """플레이어 피격 — HP 감소 및 사망 시 즉시 풀회복"""
    stats["hp"] = max(0, stats.get("hp", 100) - damage)
    died = stats["hp"] <= 0
    if died:
        stats["hp"] = stats.get("maxHp", 100)
    return {"ok": True, "hp": stats["hp"], "maxHp": stats.get("maxHp", 100), "died": died}


def apply_heal_to_stats(stats: dict, amount: int) -> dict:
    """HP 회복"""
    max_hp = stats.get("maxHp", 100)
    stats["hp"] = min(max_hp, stats.get("hp", max_hp) + amount)
    return {"ok": True, "hp": stats["hp"], "maxHp": max_hp}


def add_rewards_to_stats(stats: dict, exp_gain: int = 0, gold_gain: int = 0) -> dict:
    """보상 반영 및 레벨업 처리"""
    stats["exp"] = stats.get("exp", 0) + max(0, exp_gain)
    stats["gold"] = stats.get("gold", 0) + max(0, gold_gain)

    leveled_up = False
    while stats["exp"] >= _required_exp_for_level(stats["level"] + 1):
        stats["level"] += 1
        stats["maxHp"] += 20
        stats["maxMp"] += 10
        stats["attack"] = stats.get("attack", 12) + 2
        stats["hp"] = stats["maxHp"]
        stats["mp"] = stats["maxMp"]
        leveled_up = True

    return {
        "expGained": exp_gain,
        "goldGained": gold_gain,
        "leveledUp": leveled_up,
        "stats": dict(stats),
    }


# ── WebSocket 메시지 핸들러 ───────────────────────────────────

async def handle_hit(
    user_id: str,
    monster_id: int,
    skill_name: str,
    player_manager,
    monster_manager,
) -> dict:
    """
    몬스터 피격 전투 로직 + 보상 + 드롭 + DB 저장.

    반환 구조:
        ok           : bool
        hit_broadcast: dict          — monster_hit 브로드캐스트 페이로드
        killed       : bool
        dead_broadcast: dict | None  — monster_dead 브로드캐스트 페이로드
        reward_payload: dict | None  — player_reward 전송 페이로드
        drop_payload  : dict | None  — item_drop 전송 페이로드
    """
    player_stats = player_manager.get_player_stats(user_id) or {}
    player_attack = player_stats.get("attack", 10)

    hit_result = monster_manager.handle_hit(monster_id, player_attack, skill_name)
    if not hit_result or not hit_result.get("ok"):
        return {"ok": False}

    result: dict = {
        "ok": True,
        "killed": hit_result["killed"],
        "hit_broadcast": {
            "type": "monster_hit",
            "monsterId": hit_result["monsterId"],
            "damage": hit_result["damage"],
            "hp": hit_result["hp"],
            "maxHp": hit_result["maxHp"],
            "state": hit_result["state"],
            "killed": hit_result["killed"],
            "skillName": skill_name,
            "attackerId": user_id,
        },
    }

    if not hit_result["killed"]:
        return result

    # 보상
    reward_result = player_manager.add_rewards(
        user_id,
        exp_gain=hit_result["expReward"],
        gold_gain=hit_result["goldReward"],
    )
    if reward_result:
        result["dead_broadcast"] = {
            "type": "monster_dead",
            "monsterId": hit_result["monsterId"],
            "attackerId": user_id,
            "expReward": hit_result["expReward"],
            "goldReward": hit_result["goldReward"],
        }
        result["reward_payload"] = {
            "type": "player_reward",
            "monsterId": hit_result["monsterId"],
            "expGained": reward_result["expGained"],
            "goldGained": reward_result["goldGained"],
            "leveledUp": reward_result["leveledUp"],
            "stats": reward_result["stats"],
        }
        try:
            uid_int = int(user_id)
            if uid_int < 50000:
                await char_repo.save_character(uid_int, reward_result["stats"])
        except Exception as e:
            print(f"[WARN] save_character failed for {user_id}: {e}")

    # 드롭
    drop_table = hit_result.get("dropTable", [])
    if drop_table:
        try:
            dropped = await roll_drops(drop_table)
        except Exception as e:
            print(f"[WARN] roll_drops failed: {e}")
            dropped = []

        print(f"[DROP] user={user_id} monster={hit_result['monsterId']} dropped={dropped}")
        if dropped:
            try:
                uid_int = int(user_id)
                if uid_int < 50000:
                    await grant_items_to_user(uid_int, dropped)
            except Exception as e:
                print(f"[WARN] grant_items failed for {user_id}: {e}")
            result["drop_payload"] = {
                "type": "item_drop",
                "monsterId": hit_result["monsterId"],
                "items": dropped,
            }

    return result


async def handle_use_item(user_id: str, item_id: int, player_manager) -> dict | None:
    """
    포션 사용 처리 — HP 회복 + 인벤토리 차감.
    반환: player_healed 페이로드 or None (실패/조건 불충족)
    """
    try:
        item = await item_repo.get_item(item_id)
        if not item or item["item_type"] != "potion":
            return None

        heal_amount = (item.get("stat_bonus") or {}).get("hp", 0)
        if heal_amount <= 0:
            return None

        heal_result = player_manager.apply_heal(user_id, heal_amount)
        if not heal_result["ok"]:
            return None

        try:
            uid_int = int(user_id)
            if uid_int < 50000:
                await item_repo.consume_item(uid_int, item_id, 1)
        except Exception:
            pass

        return {
            "type": "player_healed",
            "itemId": item_id,
            "healAmount": heal_amount,
            "hp": heal_result["hp"],
            "maxHp": heal_result["maxHp"],
        }
    except Exception as e:
        print(f"[WARN] use_item failed: {e}")
        return None
