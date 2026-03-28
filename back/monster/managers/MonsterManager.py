import random
import math
import asyncio
from typing import Dict, Optional


class Monster:
    def __init__(self, id: int, x: float, z: float, hp: int = 100, model_path: Optional[str] = None, tier: str = "normal"):
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

    def to_dict(self):
        data = {
            "id": self.id,
            "position": {"x": self.x, "y": 0, "z": self.z},
            "hp": self.hp,
            "maxHp": self.max_hp,
            "state": self.state,
            "monsterType": self.monster_type,
            "tier": self.tier,
        }
        if self.model_path:
            data["modelPath"] = self.model_path
        return data


class MonsterManager:
    def __init__(self):
        self.monsters: Dict[int, Monster] = {}
        self.next_id = 1
        self.is_running = False
        self._spawn_dragon_at_start()

    def _spawn_dragon_at_start(self):
        """서버 시작 시 드래곤을 플레이어 스폰 지점(0,0) 근처에 배치"""
        dragon = Monster(
            id=self.next_id,
            x=8.0,
            z=8.0,
            hp=5000,
            model_path="monsters/Gangnam_Boss_Fire_001_Dragon.glb",
            tier="boss",
        )
        dragon.monster_type = 0
        dragon.speed = 0.5
        self.monsters[dragon.id] = dragon
        self.next_id += 1

    def spawn_random(self, count: int = 5, center_x: float = 0.0, center_z: float = 0.0):
        """플레이어 근처 반경 20m 이내 랜덤 스폰 (일반 몬스터)"""
        current_count = len(self.monsters)
        max_monsters = 6  # 드래곤 1 + 일반 5
        if current_count >= max_monsters:
            return

        to_spawn = min(count, max_monsters - current_count)
        start_id = max(self.monsters.keys()) + 1 if self.monsters else self.next_id

        for i in range(to_spawn):
            angle = random.uniform(0, math.pi * 2)
            dist = random.uniform(5, 20)
            x = center_x + math.cos(angle) * dist
            z = center_z + math.sin(angle) * dist
            is_elite = random.random() < 0.1
            hp = 500 if is_elite else 100
            tier = "elite" if is_elite else "normal"
            monster = Monster(start_id + i, x, z, hp=hp,
                              model_path="monsters/Seoul_Normal_Water_001_Slime.glb",
                              tier=tier)
            monster.is_elite = is_elite
            self.monsters[monster.id] = monster

        self.next_id = start_id + to_spawn
        print(f"Monster spawn complete: {to_spawn} monsters spawned.")

    def get_all_monsters(self):
        return {mid: m.to_dict() for mid, m in self.monsters.items()}

    def handle_hit(self, monster_id: int, damage: int):
        if monster_id not in self.monsters:
            return
        m = self.monsters[monster_id]
        m.hp -= damage
        m.state = "hit"
        print(f"Monster {monster_id} hit! HP: {m.hp}/{m.max_hp}")
        if m.hp <= 0:
            m.state = "dead"

    def remove_dead_monsters(self):
        dead_ids = [mid for mid, m in self.monsters.items() if m.state == "dead" and m.hp <= 0]
        for mid in dead_ids:
            self.monsters.pop(mid, None)

    async def game_loop(self, broadcast_func):
        """몬스터 AI 루프 (0.1초마다 실행, 10 FPS)"""
        self.is_running = True
        print("Monster AI loop started.")

        while self.is_running:
            has_update = False

            # 일반 몬스터 부족하면 보충 (드래곤 제외)
            normal_count = sum(1 for m in self.monsters.values() if not m.model_path)
            if normal_count < 5:
                self.spawn_random(count=5 - normal_count)
                has_update = True
                await asyncio.sleep(1)

            to_delete = []

            for m_id in list(self.monsters.keys()):
                monster = self.monsters[m_id]

                if monster.state == "dead":
                    if not hasattr(monster, 'dead_tick'):
                        monster.dead_tick = 0
                        has_update = True
                    monster.dead_tick += 1
                    if monster.dead_tick > 5:
                        to_delete.append(m_id)
                        has_update = True
                    continue

                if monster.state == "hit":
                    if not hasattr(monster, 'hit_tick'):
                        monster.hit_tick = 0
                    monster.hit_tick += 1
                    if monster.hit_tick > 5:
                        monster.state = "idle"
                        del monster.hit_tick
                        has_update = True
                    continue

                if monster.state == "idle":
                    if random.random() < 0.05:
                        monster.state = "move"
                        dist = math.sqrt(monster.x**2 + monster.z**2)
                        if dist > 30:
                            angle = math.atan2(-monster.z, -monster.x)
                        else:
                            angle = random.uniform(0, math.pi * 2)
                        monster.dx = math.cos(angle) * monster.speed * 0.1
                        monster.dz = math.sin(angle) * monster.speed * 0.1

                elif monster.state == "move":
                    monster.x += getattr(monster, 'dx', 0)
                    monster.z += getattr(monster, 'dz', 0)
                    has_update = True
                    if random.random() < 0.1:
                        monster.state = "idle"

            for mid in to_delete:
                self.monsters.pop(mid, None)
                has_update = True

            if has_update and broadcast_func:
                await broadcast_func({
                    "type": "sync_monsters",
                    "monsters": self.get_all_monsters()
                })

            await asyncio.sleep(0.1)


monster_manager = MonsterManager()
