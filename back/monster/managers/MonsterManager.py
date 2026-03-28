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
        self.speed = 2.0  # ?대룞 ?띾룄
        self.target_user_id = None # ?닿렇濡????
        self.state = "idle" # idle, move, chase, dead
        self.monster_type = random.randint(0, 13) # 0-13 ?쒕뜡 ???(留??뚮쭏? 留ㅼ묶)

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
        [Temporary] Starter Village (map_0) ?먯꽌留?紐ъ뒪???ㅽ룿
        """
        # (0, 0) ?꾩튂留??ъ슜?섎룄濡?怨좎젙
        map_positions = [(0, 0)]
        
        # ?꾩옱 紐ъ뒪?????뺤씤 (理쒕? 5留덈━ ?좎?)
        current_count = len(self.monsters)
        if current_count >= 5:
            return

        to_spawn = min(count, 5 - current_count)
        
        start_id = max(self.monsters.keys()) + 1 if self.monsters else 1
        
        for i in range(to_spawn):
            # 1. 怨좎젙 留??좏깮 (Starter Village)
            base_x, base_z = map_positions[0]
            
            # 2. 留????쒕뜡 ?꾩튂 (-40 ~ 40)
            offset_x = random.uniform(-40, 40)
            offset_z = random.uniform(-40, 40)
            
            x = base_x + offset_x
            z = base_z + offset_z
            
            hp = 100
            
            # 10% ?뺣쪧濡??섎━??紐ъ뒪??
            is_elite = random.random() < 0.1
            if is_elite:
                hp = 500
            
            monster = Monster(start_id + i, x, z, hp=hp)
            monster.is_elite = is_elite # ?띿꽦 異붽?
            self.monsters[monster.id] = monster
        
        print(f"Monster spawn complete: {count} monsters across the world.")

    def get_all_monsters(self):
        return {mid: m.to_dict() for mid, m in self.monsters.items()}

    def handle_hit(self, monster_id: int, damage: int):
        if monster_id in self.monsters:
            m = self.monsters[monster_id]
            m.hp -= damage
            m.state = "hit"
            
            # ?됰갚 ?④낵 (?닿굔 臾쇰━ ?붿쭊 ?꾩슂?섏?留??쇰떒 ?앸왂)
            print(f"Monster {monster_id} Hit! HP: {m.hp}")

            if m.hp <= 0:
                m.state = "dead"
                # 二쎌쓬 泥섎━ (?좎떆 ???쒓굅)
                # self.monsters.pop(monster_id) # 猷⑦봽 異⑸룎 ?꾪뿕, game_loop?먯꽌 泥섎━

    def remove_dead_monsters(self):
        dead_ids = [mid for mid, m in self.monsters.items() if m.state == "dead" and m.hp <= 0]
        # 諛붾줈 吏?곗? 留먭퀬 2珥?????젣? (?대씪 ?좊땲硫붿씠???쒓컙) - ?쇰떒 猷⑦봽?먯꽌 泥섎━

    async def game_loop(self, broadcast_func):
        """
        媛꾨떒??紐ъ뒪??AI 猷⑦봽 (0.1珥덈쭏???ㅽ뻾)
        """
        self.is_running = True
        print("Monster AI loop started.")
        
        while self.is_running:
            has_update = False
            
            # [Limit] ?곸떆 5留덈━ ?좎? (?섏튂硫?利됱떆 ??젣)
            if len(self.monsters) > 5:
                # 媛??ID媛 ??理쒓렐???앷릿) ?좊뱾?쒖쑝濡???젣?섍굅??洹몃깷 ?쒕뜡 ??젣
                excess_ids = list(self.monsters.keys())[5:]
                for eid in excess_ids:
                    self.monsters.pop(eid, None)
                has_update = True

            if not self.monsters:
                # 紐ъ뒪?곌? ??二쎌뿀?쇰㈃ 由ъ뒪??
                self.spawn_random(count=5) 
                has_update = True
                await asyncio.sleep(1) 
                # continue
            
            # 二쎌? 紐ъ뒪???뺣━ (Dead ?곹깭濡?3珥??댁긽 吏?섎㈃?)
            # ?쇰떒 利됱떆 ??젣蹂대떎???곹깭 ?꾪뙆 ????젣媛 醫뗭쓬
            to_delete = []
            
            # for 臾?????dict size 諛붾뚮㈃ ?먮윭 ?섎?濡?list濡?蹂듭궗
            for m_id in list(self.monsters.keys()):
                monster = self.monsters[m_id]

                if monster.state == "dead":
                    # 二쎌쓬 釉뚮줈?몄틦?ㅽ듃 ?쒕쾲 ?섍퀬 ??젣?댁빞 ??
                    # ?ш린?쒕뒗 媛꾨떒?? HP 0 ?댄븯???좊뱾? "dead" ?⑦궥 蹂대궡怨??섏꽌 紐⑸줉?먯꽌 ?쒓굅
                    # 洹쇰뜲 諛붾줈 吏?곕㈃ ?대씪媛 ?щ쭩 紐⑥뀡 紐?洹몃┝.
                    # => ?щ쭩 泥섎━ 濡쒖쭅 ?꾩슂 (Tick Count?)
                    if not hasattr(monster, 'dead_tick'):
                        monster.dead_tick = 0
                        has_update = True # ?щ쭩 ?곹깭 ?꾩넚
                    
                    monster.dead_tick += 1
                    if monster.dead_tick > 5: # 0.5珥?5?? ????젣
                        to_delete.append(m_id)
                        has_update = True
                    continue

                if monster.state == "hit":
                    # 0.5珥?5?? ?숈븞 硫덉땄
                    if not hasattr(monster, 'hit_tick'):
                         monster.hit_tick = 0
                    
                    monster.hit_tick += 1
                    if monster.hit_tick > 5:
                        monster.state = "idle" # ?뚮났
                        del monster.hit_tick
                        has_update = True
                    continue

                # 1. AI 寃곗젙 (?곹깭 ?꾩씠)
                if monster.state == "idle":
                    if random.random() < 0.05: # 5% ?뺣쪧濡??대룞 ?쒖옉
                        monster.state = "move"
                        # ?쒕뜡 諛⑺뼢 (?? ?덈Т 硫?댁?硫??먯젏 ?뚭?)
                        dist_from_origin = math.sqrt(monster.x**2 + monster.z**2)
                        if dist_from_origin > 30:
                            # ?먯젏 諛⑺뼢?쇰줈
                            angle = math.atan2(-monster.z, -monster.x) 
                        else:
                            # ?꾩쟾 ?쒕뜡
                            angle = random.uniform(0, math.pi * 2)
                        
                        monster.dx = math.cos(angle) * monster.speed * 0.1 # delta per tick
                        monster.dz = math.sin(angle) * monster.speed * 0.1

                elif monster.state == "move":
                    # ?대룞
                    monster.x += getattr(monster, 'dx', 0)
                    monster.z += getattr(monster, 'dz', 0)
                    
                    has_update = True
                    
                    # 10% ?뺣쪧濡?硫덉땄
                    if random.random() < 0.1:
                        monster.state = "idle"

            # Delete Cleaned Monsters
            for mid in to_delete:
                self.monsters.pop(mid, None)
                has_update = True # ??젣 ?ъ떎 ?꾪뙆 (?대씪?먯꽌??吏?뚯빞 ??

            # 2. 蹂寃쎌궗???덉쑝硫?釉뚮줈?쒖틦?ㅽ듃
            if has_update and broadcast_func:
                await broadcast_func({
                    "type": "sync_monsters",
                    "monsters": self.get_all_monsters()
                })
            
            await asyncio.sleep(0.1) # 10 FPS ?낅뜲?댄듃

# ?깃????몄뒪?댁뒪
monster_manager = MonsterManager()
