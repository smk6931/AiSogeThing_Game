import asyncio
from typing import Dict, List, Optional
from fastapi import WebSocket
# [임시 비활성] DB 관련 임포트 (DB 연결 시 복원 필요)
# from sqlalchemy.future import select
# from sqlalchemy.ext.asyncio import AsyncSession
# from player.models.models import GameCharacter

class PlayerManager:
    """
    게임 내 활성 플레이어(접속자)를 메모리 상에서 관리하는 클래스
    Independent class optimized for Game State Management (User ID + Data).
    """
    def __init__(self):
        # 접속 중인 플레이어 목록 {user_id: {socket, nickname, position, ...}}
        self.active_connections: Dict[str, dict] = {}
        self.player_sync_radius = 120.0
        self.skill_sync_radius = 160.0

    @staticmethod
    def _required_exp_for_level(level: int) -> int:
        """간단한 누적 경험치 곡선. 추후 DB 레벨 테이블로 교체 가능."""
        if level <= 1:
            return 0
        return (level - 1) * level * 50

    async def connect(self, websocket: WebSocket, user_id: str, nickname: str, db=None):
        """새로운 플레이어 접속 처리"""
        await websocket.accept()
        
        # [임시] DB 없이 기본 스탯 사용 (DB 연결 시 복원 필요)
        stats = {
            "level": 1,
            "hp": 100,
            "maxHp": 100,
            "mp": 50,
            "maxMp": 50,
            "exp": 0,
            "gold": 0,
            "attack": 300
        }

        # 초기 상태 설정
        initial_state = {
            "socket": websocket,
            "nickname": nickname,
            "position": {"x": 0, "y": 0, "z": 0}, 
            "rotation": 0,
            "animation": "Idle",
            "stats": stats,  # 메모리에 스탯 보유
            "visibleMonsterIds": set(),
        }
        
        self.active_connections[user_id] = initial_state
        print(f"[OK] Player Connected: {nickname} (ID: {user_id}, Lv.{stats['level']})")
        return stats

    def disconnect(self, user_id: str):
        """플레이어 접속 해제 처리"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            print(f"[LEAVE] Player Disconnected: ID {user_id}")

    def get_player(self, user_id: str) -> Optional[dict]:
        """특정 플레이어 정보 조회"""
        return self.active_connections.get(user_id)

    @staticmethod
    def _distance_sq(player_a: dict, player_b: dict) -> float:
        pos_a = player_a.get("position") or {}
        pos_b = player_b.get("position") or {}
        dx = (pos_a.get("x", 0) or 0) - (pos_b.get("x", 0) or 0)
        dz = (pos_a.get("z", 0) or 0) - (pos_b.get("z", 0) or 0)
        return (dx * dx) + (dz * dz)

    @staticmethod
    def _same_map(player_a: dict, player_b: dict) -> bool:
        return player_a.get("mapId", "map_0") == player_b.get("mapId", "map_0")

    def get_nearby_user_ids(self, origin_user_id: str, radius: float, include_self: bool = False) -> list[str]:
        origin = self.active_connections.get(origin_user_id)
        if not origin:
            return []

        radius_sq = radius * radius
        nearby_user_ids: list[str] = []
        for user_id, player_data in self.active_connections.items():
            if not include_self and user_id == origin_user_id:
                continue
            if not self._same_map(origin, player_data):
                continue
            if self._distance_sq(origin, player_data) <= radius_sq:
                nearby_user_ids.append(user_id)
        return nearby_user_ids

    async def send_to_user(self, user_id: str, message: dict):
        player = self.active_connections.get(user_id)
        if not player:
            return
        try:
            await player["socket"].send_json(message)
        except Exception as e:
            print(f"[WARN] Send Error to {user_id}: {e}")
            self.disconnect(user_id)

    async def broadcast_to_users(self, message: dict, user_ids: list[str]):
        if not user_ids:
            return

        stale_user_ids = []
        tasks = []

        async def _send(user_id: str, socket: WebSocket):
            try:
                await socket.send_json(message)
            except Exception as e:
                print(f"[WARN] Broadcast Error to {user_id}: {e}")
                stale_user_ids.append(user_id)

        for user_id in user_ids:
            player = self.active_connections.get(user_id)
            if not player:
                continue
            tasks.append(_send(user_id, player["socket"]))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        for user_id in stale_user_ids:
            self.disconnect(user_id)

    async def broadcast_nearby(self, message: dict, origin_user_id: str, radius: float, include_self: bool = False):
        user_ids = self.get_nearby_user_ids(origin_user_id, radius, include_self=include_self)
        await self.broadcast_to_users(message, user_ids)

    def get_all_players(self) -> Dict[str, dict]:
        """전체 플레이어 목록 조회"""
        return self.active_connections

    def get_player_stats(self, user_id: str) -> Optional[dict]:
        player = self.active_connections.get(user_id)
        if not player:
            return None
        return player.get("stats")

    def update_player_state(self, user_id: str, new_state: dict):
        """플레이어 상태(위치, 행동) 업데이트"""
        if user_id in self.active_connections:
            player = self.active_connections[user_id]
            # 위험한 키(socket) 필터링
            safe_update = {k: v for k, v in new_state.items() if k != "socket"}
            player.update(safe_update)

    def add_rewards(self, user_id: str, exp_gain: int = 0, gold_gain: int = 0) -> Optional[dict]:
        """플레이어 보상 반영 및 간단 레벨업 처리"""
        player = self.active_connections.get(user_id)
        if not player:
            return None

        stats = player.get("stats")
        if not stats:
            return None

        stats["exp"] = stats.get("exp", 0) + max(0, exp_gain)
        stats["gold"] = stats.get("gold", 0) + max(0, gold_gain)

        leveled_up = False
        while stats["exp"] >= self._required_exp_for_level(stats["level"] + 1):
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

    async def broadcast(self, message: dict, exclude_user_id: str = None):
        """모든 플레이어에게 메시지 전송 (특정 유저 제외 가능)"""
        stale_user_ids = []
        tasks = []

        async def _send(user_id: str, socket: WebSocket):
            try:
                await socket.send_json(message)
            except Exception as e:
                print(f"[WARN] Broadcast Error to {user_id}: {e}")
                stale_user_ids.append(user_id)

        for user_id, player_data in list(self.active_connections.items()):
            if user_id == exclude_user_id:
                continue

            socket = player_data["socket"]
            tasks.append(_send(user_id, socket))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        for user_id in stale_user_ids:
            self.disconnect(user_id)

# 싱글톤 인스턴스
player_manager = PlayerManager()
