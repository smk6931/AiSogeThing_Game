import random
import math
import asyncio
from typing import Dict, List

class Monster:
    def __init__(self, id: int, x: float, z: float, hp: int = 100):
        self.id = id
        self.x = x
        self.z = z
        self.hp = hp
        self.max_hp = hp
        self.speed = 2.0  # 이동 속도
        self.target_user_id = None # 어그로 대상
        self.state = "idle" # idle, move, chase, dead
        self.monster_type = random.randint(0, 13) # 0-13 랜덤 타입 (맵 테마와 매칭)

    def to_dict(self):
        return {
            "id": self.id,
            "position": {"x": self.x, "y": 0, "z": self.z},
            "hp": self.hp,
            "maxHp": self.max_hp,
            "state": self.state,
            "monsterType": self.monster_type
        }

class MonsterManager:
    def __init__(self):
        self.monsters: Dict[int, Monster] = {}
        self.next_id = 1
        self.is_running = False

    
    def spawn_random(self, count: int = 5, map_size: int = 100, gap: int = 50):
        """
        [Temporary] Starter Village (map_0) 에서만 몬스터 스폰
        """
        # (0, 0) 위치만 사용하도록 고정
        map_positions = [(0, 0)]
        
        # 현재 몬스터 수 확인 (최대 5마리 유지)
        current_count = len(self.monsters)
        if current_count >= 5:
            return

        to_spawn = min(count, 5 - current_count)
        
        start_id = max(self.monsters.keys()) + 1 if self.monsters else 1
        
        for i in range(to_spawn):
            # 1. 고정 맵 선택 (Starter Village)
            base_x, base_z = map_positions[0]
            
            # 2. 맵 내 랜덤 위치 (-40 ~ 40)
            offset_x = random.uniform(-40, 40)
            offset_z = random.uniform(-40, 40)
            
            x = base_x + offset_x
            z = base_z + offset_z
            
            hp = 100
            
            # 10% 확률로 엘리트 몬스터
            is_elite = random.random() < 0.1
            if is_elite:
                hp = 500
            
            monster = Monster(start_id + i, x, z, hp=hp)
            monster.is_elite = is_elite # 속성 추가
            self.monsters[monster.id] = monster
        
        print(f"👾 Spawning {count} monsters across the world complete.")

    def get_all_monsters(self):
        return {mid: m.to_dict() for mid, m in self.monsters.items()}

    def handle_hit(self, monster_id: int, damage: int):
        if monster_id in self.monsters:
            m = self.monsters[monster_id]
            m.hp -= damage
            m.state = "hit"
            
            # 넉백 효과 (이건 물리 엔진 필요하지만 일단 생략)
            print(f"Monster {monster_id} Hit! HP: {m.hp}")

            if m.hp <= 0:
                m.state = "dead"
                # 죽음 처리 (잠시 뒤 제거)
                # self.monsters.pop(monster_id) # 루프 충돌 위험, game_loop에서 처리

    def remove_dead_monsters(self):
        dead_ids = [mid for mid, m in self.monsters.items() if m.state == "dead" and m.hp <= 0]
        # 바로 지우지 말고 2초 뒤 삭제? (클라 애니메이션 시간) - 일단 루프에서 처리

    async def game_loop(self, broadcast_func):
        """
        간단한 몬스터 AI 루프 (0.1초마다 실행)
        """
        self.is_running = True
        print("👾 Monster AI Loop Started!")
        
        while self.is_running:
            has_update = False
            
            # [Limit] 상시 5마리 유지 (넘치면 즉시 삭제)
            if len(self.monsters) > 5:
                # 가장 ID가 큰(최근에 생긴) 애들순으로 삭제하거나 그냥 랜덤 삭제
                excess_ids = list(self.monsters.keys())[5:]
                for eid in excess_ids:
                    self.monsters.pop(eid, None)
                has_update = True

            if not self.monsters:
                # 몬스터가 다 죽었으면 리스폰
                self.spawn_random(count=5) 
                has_update = True
                await asyncio.sleep(1) 
                # continue
            
            # 죽은 몬스터 정리 (Dead 상태로 3초 이상 지나면?)
            # 일단 즉시 삭제보다는 상태 전파 후 삭제가 좋음
            to_delete = []
            
            # for 문 돌 때 dict size 바뀌면 에러 나므로 list로 복사
            for m_id in list(self.monsters.keys()):
                monster = self.monsters[m_id]

                if monster.state == "dead":
                    # 죽음 브로트캐스트 한번 하고 삭제해야 함.
                    # 여기서는 간단히: HP 0 이하인 애들은 "dead" 패킷 보내고 나서 목록에서 제거
                    # 근데 바로 지우면 클라가 사망 모션 못 그림.
                    # => 사망 처리 로직 필요 (Tick Count?)
                    if not hasattr(monster, 'dead_tick'):
                        monster.dead_tick = 0
                        has_update = True # 사망 상태 전송
                    
                    monster.dead_tick += 1
                    if monster.dead_tick > 5: # 0.5초(5틱) 뒤 삭제
                        to_delete.append(m_id)
                        has_update = True
                    continue

                if monster.state == "hit":
                    # 0.5초(5틱) 동안 멈춤
                    if not hasattr(monster, 'hit_tick'):
                         monster.hit_tick = 0
                    
                    monster.hit_tick += 1
                    if monster.hit_tick > 5:
                        monster.state = "idle" # 회복
                        del monster.hit_tick
                        has_update = True
                    continue

                # 1. AI 결정 (상태 전이)
                if monster.state == "idle":
                    if random.random() < 0.05: # 5% 확률로 이동 시작
                        monster.state = "move"
                        # 랜덤 방향 (단, 너무 멀어지면 원점 회귀)
                        dist_from_origin = math.sqrt(monster.x**2 + monster.z**2)
                        if dist_from_origin > 30:
                            # 원점 방향으로
                            angle = math.atan2(-monster.z, -monster.x) 
                        else:
                            # 완전 랜덤
                            angle = random.uniform(0, math.pi * 2)
                        
                        monster.dx = math.cos(angle) * monster.speed * 0.1 # delta per tick
                        monster.dz = math.sin(angle) * monster.speed * 0.1

                elif monster.state == "move":
                    # 이동
                    monster.x += getattr(monster, 'dx', 0)
                    monster.z += getattr(monster, 'dz', 0)
                    
                    has_update = True
                    
                    # 10% 확률로 멈춤
                    if random.random() < 0.1:
                        monster.state = "idle"

            # Delete Cleaned Monsters
            for mid in to_delete:
                self.monsters.pop(mid, None)
                has_update = True # 삭제 사실 전파 (클라에서도 지워야 함)

            # 2. 변경사항 있으면 브로드캐스트
            if has_update and broadcast_func:
                await broadcast_func({
                    "type": "sync_monsters",
                    "monsters": self.get_all_monsters()
                })
            
            await asyncio.sleep(0.1) # 10 FPS 업데이트

# 싱글톤 인스턴스
monster_manager = MonsterManager()
