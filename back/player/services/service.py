# 플레이어 비즈니스 로직 — 전투 계산, 스탯 처리, WebSocket 핸들러

from player.repositories import repository as char_repo
from item.repositories import repository as item_repo
from item.services.service import roll_drops, grant_items_to_user


# ── 전투 / 스킬 계산 (pure functions) ─────────────────────────

# 프론트 front/src/data/skillCatalog.js 와 동기화 유지
SKILL_CATALOG = {
    "magic_orb":      {"power": 10, "mp_cost": 10, "multiplier": 1.0, "type": "target"},
    "pyramid_punch":  {"power": 8,  "mp_cost": 5,  "multiplier": 0.8, "type": "spread"},
    "lightning_bolt": {"power": 20, "mp_cost": 15, "multiplier": 1.2, "type": "linear"},
    "frost_nova":     {"power": 15, "mp_cost": 25, "multiplier": 0.9, "type": "aoe_self"},
    "basic":          {"power": 0,  "mp_cost": 0,  "multiplier": 1.0, "type": "target"},
}


def calc_damage(player_attack: int, skill_name: str) -> int:
    skill = SKILL_CATALOG.get(skill_name, SKILL_CATALOG["basic"])
    return max(1, int(player_attack * skill["multiplier"]) + skill["power"])


def deduct_mp_for_skill(stats: dict, skill_name: str) -> bool:
    """MP 소모 처리. 충분하면 차감 후 True, 부족하면 False 반환."""
    skill = SKILL_CATALOG.get(skill_name, SKILL_CATALOG["basic"])
    mp_cost = skill.get("mp_cost", 0)
    if mp_cost == 0:
        return True
    current_mp = stats.get("mp", 0)
    if current_mp < mp_cost:
        return False
    stats["mp"] = current_mp - mp_cost
    return True


def apply_hit_to_monster(monster, player_attack: int, skill_name: str) -> dict:
    """Monster 객체에 피격을 적용하고 결과 dict를 반환한다."""
    if monster.state == "dead" or monster.hp <= 0:
        return {"ok": False, "reason": "monster_already_dead"}

    damage = calc_damage(player_attack, skill_name)
    monster.hp -= damage
    monster.state = "hit"

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

    # MP 검증 + 차감 (부족하면 거부)
    if not deduct_mp_for_skill(player_stats, skill_name):
        return {"ok": False, "reason": "insufficient_mp"}

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


async def handle_frost_nova(
    user_id: str,
    player_manager,
    monster_manager,
) -> dict:
    """
    frost_nova AoE 처리 — 플레이어 위치 기준 반경 8m 내 몬스터 전체 피격.
    클라이언트는 반경 계산을 하지 않고 서버에 위임 (보안).

    반환: { ok, hits: [hit_result, ...], killed_ids: [...] }
    """
    skill = SKILL_CATALOG["frost_nova"]
    player_stats = player_manager.get_player_stats(user_id) or {}
    player_attack = player_stats.get("attack", 10)

    # MP 검증 + 차감
    if not deduct_mp_for_skill(player_stats, "frost_nova"):
        return {"ok": False, "reason": "insufficient_mp"}

    damage = calc_damage(player_attack, "frost_nova")

    player = player_manager.get_player(user_id)
    if not player:
        return {"ok": False}

    pos = player.get("position") or {}
    px = float(pos.get("x", 0) or 0)
    pz = float(pos.get("z", 0) or 0)

    radius_sq = skill["power"] * 1.0  # range = power값을 m 반경으로 사용 (8m)
    # frost_nova range는 8m → 반경²
    FROST_RADIUS_SQ = 64.0  # 8m²

    monster_ids = [
        mid for mid, m in monster_manager.monsters.items()
        if m.state != "dead" and m.hp > 0
        and (m.x - px) ** 2 + (m.z - pz) ** 2 <= FROST_RADIUS_SQ
    ]

    if not monster_ids:
        return {"ok": True, "hits": [], "killed_ids": []}

    batch_results = monster_manager.batch_hit(monster_ids, damage)
    killed_ids = [r["monsterId"] for r in batch_results if r.get("killed")]

    # 보상: 킬된 몬스터들에 대해 보상 처리
    total_exp = 0
    total_gold = 0
    for r in batch_results:
        if r.get("killed"):
            total_exp += r.get("expReward", 0)
            total_gold += r.get("goldReward", 0)

    reward_result = None
    if total_exp > 0 or total_gold > 0:
        reward_result = player_manager.add_rewards(
            user_id, exp_gain=total_exp, gold_gain=total_gold
        )
        if reward_result:
            try:
                uid_int = int(user_id)
                if uid_int < 50000:
                    await char_repo.save_character(uid_int, reward_result["stats"])
            except Exception as e:
                print(f"[WARN] frost_nova save_character failed for {user_id}: {e}")

    return {
        "ok": True,
        "hits": batch_results,
        "killed_ids": killed_ids,
        "reward_result": reward_result,
    }


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
