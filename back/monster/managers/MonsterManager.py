import random
import math
import asyncio
import time
from typing import Dict, Optional
from player.services import service as player_service


class Monster:
    def __init__(
        self,
        id: int,
        x: float,
        z: float,
        hp: int = 100,
        model_path: Optional[str] = None,
        tier: str = "normal",
        template_id: Optional[int] = None,
        exp_reward: int = 0,
        gold_reward: int = 0,
        attack_power: int = 10,
        attack_range: float = 2.8,
        attack_cooldown: float = 2.0,
    ):
        self.id = id
        self.x = x
        self.z = z
        self.hp = hp
        self.max_hp = hp
        self.speed = 2.0
        self.target_user_id = None
        self.state = "idle"
        self.monster_type = random.randint(0, 13)
        self.model_path = model_path
        self.tier = tier
        self.template_id = template_id
        self.exp_reward = exp_reward
        self.gold_reward = gold_reward
        self.drops: list = []
        self.attack_power = attack_power
        self.attack_range = attack_range
        self.attack_cooldown = attack_cooldown
        self.last_attack_time: float = 0.0

    def to_dict(self):
        data = {
            "id": self.id,
            "position": {"x": self.x, "y": 0, "z": self.z},
            "hp": self.hp,
            "maxHp": self.max_hp,
            "state": self.state,
            "monsterType": self.monster_type,
            "tier": self.tier,
            "expReward": self.exp_reward,
            "goldReward": self.gold_reward,
        }
        if self.model_path:
            data["modelPath"] = self.model_path
        if self.template_id:
            data["templateId"] = self.template_id
        return data


MONSTER_TEMPLATES = [
    # ── 기존 7종 ─────────────────────────────────────────────────────────────────
    {"template_id":  1, "tier": "boss",   "hp": 5000, "speed": 0.5, "exp": 400, "gold": 180, "attack_power": 55, "attack_range": 5.0, "attack_cooldown": 3.0,
     "model_path": "monsters/Gangnam_Boss_Fire_001_Dragon.glb",
     "drops": [{"item_id": 9, "rate": 0.8, "quantity": 1}]},
    {"template_id":  2, "tier": "normal", "hp":   80, "speed": 2.0, "exp":  15, "gold":   7, "attack_power":  8, "attack_range": 2.5, "attack_cooldown": 2.0,
     "model_path": "monsters/Seoul_Normal_Water_001_Slime.glb",
     "drops": [{"item_id": 6, "rate": 0.6, "quantity": 1}, {"item_id": 1, "rate": 0.2, "quantity": 1}]},
    {"template_id":  3, "tier": "normal", "hp":   60, "speed": 2.5, "exp":  18, "gold":   9, "attack_power": 10, "attack_range": 2.5, "attack_cooldown": 1.8,
     "model_path": "monsters/Noryangjin_Normal_Forest_003_Goblin.glb",
     "drops": [{"item_id": 4, "rate": 0.7, "quantity": 1}, {"item_id": 1, "rate": 0.15, "quantity": 1}]},
    {"template_id":  4, "tier": "elite",  "hp":  350, "speed": 1.5, "exp":  65, "gold":  28, "attack_power": 22, "attack_range": 3.0, "attack_cooldown": 1.8,
     "model_path": "monsters/Noryangjin_Elite_Stone_004_Orc.glb",
     "drops": [{"item_id": 5, "rate": 0.65, "quantity": 1}, {"item_id": 2, "rate": 0.3, "quantity": 1}, {"item_id": 11, "rate": 0.1, "quantity": 1}]},
    {"template_id":  5, "tier": "normal", "hp":   90, "speed": 1.2, "exp":  20, "gold":  10, "attack_power": 12, "attack_range": 2.5, "attack_cooldown": 2.2,
     "model_path": "monsters/Noryangjin_Normal_Dark_005_Zombie.glb",
     "drops": [{"item_id": 8, "rate": 0.6, "quantity": 1}, {"item_id": 1, "rate": 0.2, "quantity": 1}]},
    {"template_id":  6, "tier": "elite",  "hp":  280, "speed": 2.0, "exp":  72, "gold":  32, "attack_power": 20, "attack_range": 4.0, "attack_cooldown": 2.0,
     "model_path": "monsters/Noryangjin_Elite_Magic_006_Witch.glb",
     "drops": [{"item_id": 7, "rate": 0.5, "quantity": 1}, {"item_id": 13, "rate": 0.15, "quantity": 1}]},
    {"template_id":  7, "tier": "boss",   "hp": 3000, "speed": 0.8, "exp": 260, "gold": 140, "attack_power": 45, "attack_range": 4.5, "attack_cooldown": 2.5,
     "model_path": "monsters/Noryangjin_Boss_Earth_007_Ogre.glb",
     "drops": [{"item_id": 10, "rate": 0.9, "quantity": 1}, {"item_id": 12, "rate": 0.4, "quantity": 1}, {"item_id": 3, "rate": 0.5, "quantity": 1}]},
    # ── 신규 13종 ────────────────────────────────────────────────────────────────
    {"template_id":  8, "tier": "normal", "hp":   45, "speed": 2.5, "exp":  12, "gold":   5, "attack_power":  6, "attack_range": 2.0, "attack_cooldown": 1.8,
     "model_path": "monsters/Mapo_Normal_Water_008_Fairy.glb",
     "drops": [{"item_id": 14, "rate": 0.7, "quantity": 1}, {"item_id": 1, "rate": 0.25, "quantity": 1}]},
    {"template_id":  9, "tier": "elite",  "hp":  420, "speed": 1.8, "exp":  90, "gold":  40, "attack_power": 28, "attack_range": 4.0, "attack_cooldown": 2.2,
     "model_path": "monsters/Yongsan_Elite_Fire_009_Phoenix.glb",
     "drops": [{"item_id": 15, "rate": 0.35, "quantity": 1}, {"item_id": 22, "rate": 0.55, "quantity": 1}, {"item_id": 2, "rate": 0.3, "quantity": 1}]},
    {"template_id": 10, "tier": "normal", "hp":   70, "speed": 1.8, "exp":  16, "gold":   8, "attack_power":  9, "attack_range": 2.5, "attack_cooldown": 2.0,
     "model_path": "monsters/Seongdong_Normal_Stone_010_Skeleton.glb",
     "drops": [{"item_id": 16, "rate": 0.75, "quantity": 2}, {"item_id": 1, "rate": 0.2, "quantity": 1}]},
    {"template_id": 11, "tier": "boss",   "hp": 4500, "speed": 0.6, "exp": 360, "gold": 200, "attack_power": 60, "attack_range": 5.5, "attack_cooldown": 2.8,
     "model_path": "monsters/Jongno_Boss_Magic_011_Lich.glb",
     "drops": [{"item_id": 17, "rate": 0.7, "quantity": 1}, {"item_id": 29, "rate": 0.25, "quantity": 1}, {"item_id": 3, "rate": 0.5, "quantity": 2}]},
    {"template_id": 12, "tier": "normal", "hp":   65, "speed": 2.8, "exp":  14, "gold":   6, "attack_power": 10, "attack_range": 2.5, "attack_cooldown": 1.7,
     "model_path": "monsters/Dobong_Normal_Forest_012_Bandit.glb",
     "drops": [{"item_id": 18, "rate": 0.4, "quantity": 1}, {"item_id": 1, "rate": 0.3, "quantity": 1}, {"item_id": 11, "rate": 0.08, "quantity": 1}]},
    {"template_id": 13, "tier": "elite",  "hp":  310, "speed": 2.2, "exp":  85, "gold":  38, "attack_power": 25, "attack_range": 3.5, "attack_cooldown": 2.0,
     "model_path": "monsters/Nowon_Elite_Dark_013_Vampire.glb",
     "drops": [{"item_id": 19, "rate": 0.5, "quantity": 1}, {"item_id": 7, "rate": 0.3, "quantity": 1}, {"item_id": 2, "rate": 0.25, "quantity": 1}]},
    {"template_id": 14, "tier": "normal", "hp":  130, "speed": 1.0, "exp":  22, "gold":  11, "attack_power": 18, "attack_range": 2.8, "attack_cooldown": 2.5,
     "model_path": "monsters/Gangbuk_Normal_Earth_014_Golem.glb",
     "drops": [{"item_id": 20, "rate": 0.8, "quantity": 3}, {"item_id": 5, "rate": 0.2, "quantity": 1}]},
    {"template_id": 15, "tier": "elite",  "hp":  380, "speed": 1.6, "exp":  95, "gold":  42, "attack_power": 26, "attack_range": 3.2, "attack_cooldown": 2.0,
     "model_path": "monsters/Seocho_Elite_Water_015_Serpent.glb",
     "drops": [{"item_id": 21, "rate": 0.55, "quantity": 1}, {"item_id": 6, "rate": 0.45, "quantity": 2}, {"item_id": 28, "rate": 0.12, "quantity": 1}]},
    {"template_id": 16, "tier": "normal", "hp":   55, "speed": 2.2, "exp":  13, "gold":   6, "attack_power":  8, "attack_range": 2.3, "attack_cooldown": 1.9,
     "model_path": "monsters/Songpa_Normal_Fire_016_Salamander.glb",
     "drops": [{"item_id": 22, "rate": 0.65, "quantity": 1}, {"item_id": 1, "rate": 0.2, "quantity": 1}]},
    {"template_id": 17, "tier": "elite",  "hp":  450, "speed": 1.3, "exp": 100, "gold":  45, "attack_power": 30, "attack_range": 3.0, "attack_cooldown": 2.3,
     "model_path": "monsters/Guro_Elite_Earth_017_Troll.glb",
     "drops": [{"item_id": 23, "rate": 0.5, "quantity": 1}, {"item_id": 5, "rate": 0.4, "quantity": 2}, {"item_id": 27, "rate": 0.1, "quantity": 1}]},
    {"template_id": 18, "tier": "normal", "hp":   40, "speed": 3.0, "exp":  11, "gold":   5, "attack_power":  7, "attack_range": 2.0, "attack_cooldown": 1.6,
     "model_path": "monsters/Gwangjin_Normal_Magic_018_Wisp.glb",
     "drops": [{"item_id": 24, "rate": 0.7, "quantity": 1}, {"item_id": 1, "rate": 0.15, "quantity": 1}]},
    {"template_id": 19, "tier": "boss",   "hp": 6000, "speed": 0.4, "exp": 500, "gold": 250, "attack_power": 70, "attack_range": 6.0, "attack_cooldown": 3.5,
     "model_path": "monsters/Seodaemun_Boss_Stone_019_Stone_Giant.glb",
     "drops": [{"item_id": 25, "rate": 0.6, "quantity": 1}, {"item_id": 20, "rate": 0.9, "quantity": 5}, {"item_id": 30, "rate": 0.15, "quantity": 1}]},
    {"template_id": 20, "tier": "elite",  "hp":  400, "speed": 2.0, "exp":  88, "gold":  40, "attack_power": 27, "attack_range": 3.0, "attack_cooldown": 1.9,
     "model_path": "monsters/Dongjak_Elite_Forest_020_Werewolf.glb",
     "drops": [{"item_id": 26, "rate": 0.45, "quantity": 1}, {"item_id": 5, "rate": 0.35, "quantity": 2}, {"item_id": 27, "rate": 0.12, "quantity": 1}]},
]

# ── Grid Bucket 공간 인덱싱 ────────────────────────────────────────────────────
# 감지 범위(25m)보다 약간 큰 셀 크기 → 9개 인접 셀만 탐색하면 25m 반경 커버
_GRID_CELL = 30.0


def _build_player_grid(player_list: list) -> dict:
    """플레이어 위치를 그리드 버킷으로 분류 — O(n)"""
    grid: dict = {}
    for entry in player_list:
        uid, px, pz, defense = entry
        key = (int(px // _GRID_CELL), int(pz // _GRID_CELL))
        if key not in grid:
            grid[key] = []
        grid[key].append(entry)
    return grid


def _nearby_players(grid: dict, mx: float, mz: float) -> list:
    """몬스터 위치 기준 인접 9셀 플레이어만 반환 — 평균 O(1)"""
    cx = int(mx // _GRID_CELL)
    cz = int(mz // _GRID_CELL)
    result = []
    for dcx in (-1, 0, 1):
        for dcz in (-1, 0, 1):
            bucket = grid.get((cx + dcx, cz + dcz))
            if bucket:
                result.extend(bucket)
    return result


class MonsterManager:
    def __init__(self):
        self.monsters: Dict[int, Monster] = {}
        self.next_id = 1
        self.is_running = False
        self.sync_radius = 180.0
        # 활성 스폰 template_id 목록 (None = 전체 허용)
        self.enabled_template_ids: Optional[set[int]] = None
        # 일반 몬스터 수 캐시 — 매 루프 sum() 대신 스폰/삭제 시점에만 갱신
        self._normal_count: int = 0
        self._spawn_all_at_start()

    def get_active_templates(self) -> list[dict]:
        """현재 enabled_template_ids 기준으로 활성 템플릿 목록 반환"""
        if self.enabled_template_ids is None:
            return MONSTER_TEMPLATES
        return [t for t in MONSTER_TEMPLATES if t["template_id"] in self.enabled_template_ids]

    def set_enabled_templates(self, template_ids: list[int]) -> None:
        """스폰 허용 템플릿 ID 목록 변경. 빈 리스트 = 전체 허용."""
        self.enabled_template_ids = set(template_ids) if template_ids else None

    def _spawn_all_at_start(self):
        """서버 시작 시 활성 몬스터를 플레이어 스폰 지점 주변에 배치"""
        active = self.get_active_templates()
        positions = [
            (8, 8), (-10, 5), (12, -8), (-6, -12), (15, 3), (-14, 10), (5, -15),
            (-8, 15), (18, -5), (-15, -8), (6, 18), (-18, 3), (10, 12), (-4, -18),
            (16, -15), (-12, 12), (3, -10), (20, 8), (-6, 20), (-20, -10),
        ]
        for i, tmpl in enumerate(active):
            x, z = positions[i % len(positions)]
            x += random.uniform(-3, 3)
            z += random.uniform(-3, 3)
            m = Monster(
                id=self.next_id,
                x=x, z=z,
                hp=tmpl["hp"],
                model_path=tmpl["model_path"],
                tier=tmpl["tier"],
                template_id=tmpl["template_id"],
                exp_reward=tmpl.get("exp", 0),
                gold_reward=tmpl.get("gold", 0),
                attack_power=tmpl.get("attack_power", 10),
                attack_range=tmpl.get("attack_range", 2.8),
                attack_cooldown=tmpl.get("attack_cooldown", 2.0),
            )
            m.speed = tmpl["speed"]
            m.drops = tmpl.get("drops", [])
            self.monsters[m.id] = m
            if tmpl["tier"] != "boss":
                self._normal_count += 1
            self.next_id += 1
        print(f"Monster spawn complete: {len(MONSTER_TEMPLATES)} monsters spawned.")

    def spawn_random(self, count: int = 5, center_x: float = 0.0, center_z: float = 0.0):
        """죽은 일반 몬스터 보충 스폰"""
        if self._normal_count >= 5:
            return []
        to_spawn = min(count, 5 - self._normal_count)
        start_id = max(self.monsters.keys()) + 1 if self.monsters else self.next_id
        normal_templates = [t for t in self.get_active_templates() if t["tier"] == "normal"]
        spawned_ids = []
        for i in range(to_spawn):
            tmpl = random.choice(normal_templates)
            angle = random.uniform(0, math.pi * 2)
            dist = random.uniform(5, 20)
            x = center_x + math.cos(angle) * dist
            z = center_z + math.sin(angle) * dist
            m = Monster(
                start_id + i, x, z,
                hp=tmpl["hp"],
                model_path=tmpl["model_path"],
                tier=tmpl["tier"],
                template_id=tmpl["template_id"],
                exp_reward=tmpl.get("exp", 0),
                gold_reward=tmpl.get("gold", 0),
                attack_power=tmpl.get("attack_power", 10),
                attack_range=tmpl.get("attack_range", 2.8),
                attack_cooldown=tmpl.get("attack_cooldown", 2.0),
            )
            m.speed = tmpl["speed"]
            m.drops = tmpl.get("drops", [])
            self.monsters[m.id] = m
            self._normal_count += 1
            spawned_ids.append(m.id)
        self.next_id = start_id + to_spawn
        print(f"Respawn: {to_spawn} normal monsters.")
        return spawned_ids

    def get_all_monsters(self):
        return {mid: m.to_dict() for mid, m in self.monsters.items()}

    def get_monsters_in_radius(self, center_x: float, center_z: float, radius: float | None = None):
        use_radius = radius if radius is not None else self.sync_radius
        radius_sq = use_radius * use_radius
        visible = {}
        for mid, monster in self.monsters.items():
            dx = monster.x - center_x
            dz = monster.z - center_z
            if (dx * dx) + (dz * dz) <= radius_sq:
                visible[mid] = monster.to_dict()
        return visible

    def get_monster_ids_in_radius(self, center_x: float, center_z: float, radius: float | None = None) -> set[int]:
        use_radius = radius if radius is not None else self.sync_radius
        radius_sq = use_radius * use_radius
        visible_ids: set[int] = set()
        for mid, monster in self.monsters.items():
            dx = monster.x - center_x
            dz = monster.z - center_z
            if (dx * dx) + (dz * dz) <= radius_sq:
                visible_ids.add(mid)
        return visible_ids

    def handle_hit(self, monster_id: int, player_attack: int, skill_name: str = "basic") -> dict:
        """몬스터 피격 — 전투 계산은 player_service에 위임"""
        if monster_id not in self.monsters:
            return {"ok": False, "reason": "monster_not_found"}
        return player_service.apply_hit_to_monster(self.monsters[monster_id], player_attack, skill_name)

    def batch_hit(self, monster_ids: list, damage: int) -> list:
        """여러 몬스터 일괄 피격 (frost_nova 등 AoE용). damage는 이미 계산된 최종값."""
        results = []
        for mid in monster_ids:
            monster = self.monsters.get(mid)
            if not monster or monster.state == "dead" or monster.hp <= 0:
                continue
            monster.hp -= damage
            monster.state = "hit"
            killed = monster.hp <= 0
            if killed:
                monster.hp = 0
                monster.state = "dead"
                if monster.tier != "boss":
                    self._normal_count = max(0, self._normal_count - 1)
            results.append({
                "ok": True,
                "monsterId": monster.id,
                "damage": damage,
                "hp": max(0, monster.hp),
                "maxHp": monster.max_hp,
                "state": monster.state,
                "killed": killed,
                "expReward": monster.exp_reward if killed else 0,
                "goldReward": monster.gold_reward if killed else 0,
            })
        return results

    def remove_dead_monsters(self):
        dead_ids = [mid for mid, m in self.monsters.items() if m.state == "dead" and m.hp <= 0]
        for mid in dead_ids:
            self.monsters.pop(mid, None)

    async def game_loop(self, broadcast_func, get_players_func=None, send_to_player_func=None):
        """몬스터 AI 루프 (0.1초마다 실행, 10 FPS)"""
        self.is_running = True
        print("Monster AI loop started.")

        while self.is_running:
            changed_monsters = {}
            removed_monster_ids = []
            now = time.time()

            # 플레이어 위치 + ID 수집 → Grid Bucket 구성 (O(n))
            player_list = []  # [(user_id, x, z, defense)]
            if get_players_func:
                for uid, pdata in get_players_func().items():
                    pos = pdata.get("position", {})
                    defense = pdata.get("stats", {}).get("defense", 0)
                    player_list.append((uid, pos.get("x", 0), pos.get("z", 0), defense))

            player_grid = _build_player_grid(player_list)

            # 일반 몬스터 보충 (_normal_count 캐시 사용 — O(1))
            if self._normal_count < 5:
                spawned_ids = self.spawn_random(count=5 - self._normal_count)
                for mid in spawned_ids:
                    changed_monsters[mid] = self.monsters[mid].to_dict()
                await asyncio.sleep(1)

            to_delete = []

            for m_id in list(self.monsters.keys()):
                monster = self.monsters[m_id]

                if monster.state == "dead":
                    if not hasattr(monster, 'dead_tick'):
                        monster.dead_tick = 0
                        changed_monsters[m_id] = monster.to_dict()
                    monster.dead_tick += 1
                    if monster.dead_tick > 5:
                        to_delete.append(m_id)
                    continue

                if monster.state == "hit":
                    if not hasattr(monster, 'hit_tick'):
                        monster.hit_tick = 0
                    monster.hit_tick += 1
                    if monster.hit_tick > 5:
                        monster.state = "idle"
                        del monster.hit_tick
                        changed_monsters[m_id] = monster.to_dict()
                    continue

                # 가장 가까운 플레이어 탐색 (Grid Bucket — 인접 9셀만, distSq 비교)
                DETECT_RANGE_SQ = 625.0  # 25m²
                nearest_uid, nearest_dist_sq, nearest_px, nearest_pz, nearest_def = None, float('inf'), 0, 0, 0
                for uid, px, pz, defense in _nearby_players(player_grid, monster.x, monster.z):
                    d_sq = (monster.x - px) ** 2 + (monster.z - pz) ** 2
                    if d_sq <= DETECT_RANGE_SQ and d_sq < nearest_dist_sq:
                        nearest_dist_sq = d_sq
                        nearest_uid = uid
                        nearest_px, nearest_pz = px, pz
                        nearest_def = defense

                # 공격 범위 내 플레이어가 있으면 공격
                if nearest_uid and nearest_dist_sq <= monster.attack_range * monster.attack_range:
                    if now - monster.last_attack_time >= monster.attack_cooldown:
                        monster.last_attack_time = now
                        raw_dmg = monster.attack_power + random.randint(-2, 2)
                        damage = max(1, raw_dmg - nearest_def)
                        if send_to_player_func:
                            await send_to_player_func(nearest_uid, {
                                "type": "player_hit",
                                "monsterId": m_id,
                                "damage": damage,
                            })
                        monster.state = "idle"
                        changed_monsters[m_id] = monster.to_dict()
                    continue

                # 이동 AI
                if monster.state == "idle":
                    if random.random() < 0.05:
                        monster.state = "move"
                        if nearest_uid and nearest_dist_sq > 9:  # 3m² = 9
                            angle = math.atan2(nearest_pz - monster.z, nearest_px - monster.x)
                        else:
                            angle = random.uniform(0, math.pi * 2)
                        monster.dx = math.cos(angle) * monster.speed * 0.1
                        monster.dz = math.sin(angle) * monster.speed * 0.1
                        changed_monsters[m_id] = monster.to_dict()

                elif monster.state == "move":
                    monster.x += getattr(monster, 'dx', 0)
                    monster.z += getattr(monster, 'dz', 0)
                    changed_monsters[m_id] = monster.to_dict()
                    if random.random() < 0.1:
                        monster.state = "idle"
                        changed_monsters[m_id] = monster.to_dict()

            for mid in to_delete:
                m = self.monsters.pop(mid, None)
                if m and m.tier != "boss":
                    self._normal_count = max(0, self._normal_count - 1)
                removed_monster_ids.append(mid)

            if (changed_monsters or removed_monster_ids) and broadcast_func:
                await broadcast_func({
                    "type": "monster_delta",
                    "upsert": changed_monsters,
                    "remove": removed_monster_ids
                })

            await asyncio.sleep(0.1)


monster_manager = MonsterManager()
