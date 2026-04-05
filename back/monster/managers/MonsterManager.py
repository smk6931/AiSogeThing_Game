import random
import math
import asyncio
from typing import Dict, Optional


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
        self.tier = tier  # normal / elite / boss
        self.template_id = template_id
        self.exp_reward = exp_reward
        self.gold_reward = gold_reward
        self.drops: list = []  # [{"item_id": 1, "rate": 0.5, "quantity": 1}]

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
    {"template_id": 1, "model_path": "monsters/Gangnam_Boss_Fire_001_Dragon.glb",      "tier": "boss",   "hp": 5000, "speed": 0.5, "exp": 400, "gold": 180,
     "drops": [{"item_id": 9, "rate": 0.8, "quantity": 1}]},  # 용의 비늘
    {"template_id": 2, "model_path": "monsters/Seoul_Normal_Water_001_Slime.glb",       "tier": "normal", "hp": 80,   "speed": 2.0, "exp": 15,  "gold": 7,
     "drops": [{"item_id": 6, "rate": 0.6, "quantity": 1}, {"item_id": 1, "rate": 0.2, "quantity": 1}]},  # 슬라임 젤, HP포션소
    {"template_id": 3, "model_path": "monsters/Noryangjin_Normal_Forest_003_Goblin.glb","tier": "normal", "hp": 60,   "speed": 2.5, "exp": 18,  "gold": 9,
     "drops": [{"item_id": 4, "rate": 0.7, "quantity": 1}, {"item_id": 1, "rate": 0.15, "quantity": 1}]},  # 고블린 귀, HP포션소
    {"template_id": 4, "model_path": "monsters/Noryangjin_Elite_Stone_004_Orc.glb",     "tier": "elite",  "hp": 350,  "speed": 1.5, "exp": 65,  "gold": 28,
     "drops": [{"item_id": 5, "rate": 0.65, "quantity": 1}, {"item_id": 2, "rate": 0.3, "quantity": 1}, {"item_id": 11, "rate": 0.1, "quantity": 1}]},  # 오크 가죽, HP포션중, 목검
    {"template_id": 5, "model_path": "monsters/Noryangjin_Normal_Dark_005_Zombie.glb",  "tier": "normal", "hp": 90,   "speed": 1.2, "exp": 20,  "gold": 10,
     "drops": [{"item_id": 8, "rate": 0.6, "quantity": 1}, {"item_id": 1, "rate": 0.2, "quantity": 1}]},  # 좀비 뼛가루, HP포션소
    {"template_id": 6, "model_path": "monsters/Noryangjin_Elite_Magic_006_Witch.glb",   "tier": "elite",  "hp": 280,  "speed": 2.0, "exp": 72,  "gold": 32,
     "drops": [{"item_id": 7, "rate": 0.5, "quantity": 1}, {"item_id": 13, "rate": 0.15, "quantity": 1}]},  # 마녀의 뿔, 마법사 모자
    {"template_id": 7, "model_path": "monsters/Noryangjin_Boss_Earth_007_Ogre.glb",     "tier": "boss",   "hp": 3000, "speed": 0.8, "exp": 260, "gold": 140,
     "drops": [{"item_id": 10, "rate": 0.9, "quantity": 1}, {"item_id": 12, "rate": 0.4, "quantity": 1}, {"item_id": 3, "rate": 0.5, "quantity": 1}]},  # 오우거 심장, 가죽갑옷, HP포션대
]

SKILL_POWER = {
    "basic": 0,
    "pyramid_punch": 8,
    "magic_orb": 10,
}


class MonsterManager:
    def __init__(self):
        self.monsters: Dict[int, Monster] = {}
        self.next_id = 1
        self.is_running = False
        self.sync_radius = 180.0
        self._spawn_all_at_start()

    def _spawn_all_at_start(self):
        """서버 시작 시 7종 몬스터를 플레이어 스폰 지점 주변에 배치"""
        positions = [
            (8, 8), (-10, 5), (12, -8), (-6, -12), (15, 3), (-14, 10), (5, -15)
        ]
        for i, tmpl in enumerate(MONSTER_TEMPLATES):
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
            )
            m.speed = tmpl["speed"]
            m.drops = tmpl.get("drops", [])
            self.monsters[m.id] = m
            self.next_id += 1
        print(f"Monster spawn complete: {len(MONSTER_TEMPLATES)} monsters spawned.")

    def spawn_random(self, count: int = 5, center_x: float = 0.0, center_z: float = 0.0):
        """죽은 일반 몬스터 보충 스폰"""
        normal_count = sum(1 for m in self.monsters.values() if m.tier == "normal")
        if normal_count >= 5:
            return []
        to_spawn = min(count, 5 - normal_count)
        start_id = max(self.monsters.keys()) + 1 if self.monsters else self.next_id
        normal_templates = [t for t in MONSTER_TEMPLATES if t["tier"] == "normal"]
        spawned_ids = []
        for i in range(to_spawn):
            tmpl = random.choice(normal_templates)
            angle = random.uniform(0, math.pi * 2)
            dist = random.uniform(5, 20)
            x = center_x + math.cos(angle) * dist
            z = center_z + math.sin(angle) * dist
            m = Monster(start_id + i, x, z, hp=tmpl["hp"],
                        model_path=tmpl["model_path"],
                        tier=tmpl["tier"],
                        template_id=tmpl["template_id"],
                        exp_reward=tmpl.get("exp", 0),
                        gold_reward=tmpl.get("gold", 0))
            m.speed = tmpl["speed"]
            self.monsters[m.id] = m
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

    def _calc_damage(self, player_attack: int, skill_name: str):
        return max(1, player_attack + SKILL_POWER.get(skill_name, 0))

    def handle_hit(self, monster_id: int, player_attack: int, skill_name: str = "basic"):
        if monster_id not in self.monsters:
            return {"ok": False, "reason": "monster_not_found"}

        m = self.monsters[monster_id]
        if m.state == "dead" or m.hp <= 0:
            return {"ok": False, "reason": "monster_already_dead"}

        damage = self._calc_damage(player_attack, skill_name)
        m.hp -= damage
        m.state = "hit"
        print(f"Monster {monster_id} hit! Damage: {damage}, HP: {m.hp}/{m.max_hp}")

        result = {
            "ok": True,
            "monsterId": monster_id,
            "damage": damage,
            "hp": max(0, m.hp),
            "maxHp": m.max_hp,
            "state": m.state,
            "killed": False,
            "expReward": 0,
            "goldReward": 0,
        }

        if m.hp <= 0:
            m.hp = 0
            m.state = "dead"
            result["hp"] = 0
            result["state"] = "dead"
            result["killed"] = True
            result["expReward"] = m.exp_reward
            result["goldReward"] = m.gold_reward
            result["dropTable"] = m.drops  # 드롭 확률 테이블 전달

        return result

    def remove_dead_monsters(self):
        dead_ids = [mid for mid, m in self.monsters.items() if m.state == "dead" and m.hp <= 0]
        for mid in dead_ids:
            self.monsters.pop(mid, None)

    async def game_loop(self, broadcast_func, get_players_func=None):
        """몬스터 AI 루프 (0.1초마다 실행, 10 FPS)"""
        self.is_running = True
        print("Monster AI loop started.")

        while self.is_running:
            changed_monsters = {}
            removed_monster_ids = []

            # 접속 중인 플레이어 위치 수집
            player_positions = []
            if get_players_func:
                for pdata in get_players_func().values():
                    pos = pdata.get("position", {})
                    player_positions.append((pos.get("x", 0), pos.get("z", 0)))

            # 일반 몬스터 부족하면 보충 (드래곤/보스 제외)
            normal_count = sum(1 for m in self.monsters.values() if m.tier != "boss")
            if normal_count < 5:
                spawned_ids = self.spawn_random(count=5 - normal_count)
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

                if monster.state == "idle":
                    if random.random() < 0.05:
                        monster.state = "move"

                        # 가장 가까운 플레이어 찾기 — 100m 이상 멀면 해당 방향으로 이동
                        nearest = None
                        nearest_dist = float('inf')
                        for px, pz in player_positions:
                            d = math.sqrt((monster.x - px) ** 2 + (monster.z - pz) ** 2)
                            if d < nearest_dist:
                                nearest_dist = d
                                nearest = (px, pz)

                        if nearest and nearest_dist > 100:
                            angle = math.atan2(nearest[1] - monster.z, nearest[0] - monster.x)
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
                self.monsters.pop(mid, None)
                removed_monster_ids.append(mid)

            if (changed_monsters or removed_monster_ids) and broadcast_func:
                await broadcast_func({
                    "type": "monster_delta",
                    "upsert": changed_monsters,
                    "remove": removed_monster_ids
                })

            await asyncio.sleep(0.1)


monster_manager = MonsterManager()
