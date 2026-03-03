from utils.websocket import ConnectionManager
from typing import Dict

class GameService:
    def __init__(self):
        self.manager = ConnectionManager()
        # player_positions: { user_id: {x, z, nickname} }
        self.player_positions: Dict[str, dict] = {}

    async def connect(self, websocket, user_id: str, nickname: str):
        """플레이어 접속 처리"""
        await self.manager.connect(websocket)
        # 초기 위치 등록
        self.player_positions[user_id] = {"x": 0, "z": 0, "nickname": nickname}
        print(f"Game Player connected: {nickname} ({user_id})")
        # 접속 알림 브로드캐스트
        await self.manager.broadcast({
            "event": "player_joined", 
            "user_id": user_id, 
            "nickname": nickname
        })

    async def disconnect(self, websocket, user_id: str):
        """플레이어 연결 해제 처리"""
        self.manager.disconnect(websocket)
        if user_id in self.player_positions:
            del self.player_positions[user_id]
        print(f"Game Player disconnected: {user_id}")
        await self.manager.broadcast({
            "event": "player_left", 
            "user_id": user_id
        })

    async def handle_message(self, user_id: str, nickname: str, data: dict):
        """클라이언트 메시지 분기 처리"""
        event_type = data.get("event")

        if event_type == "chat":
            await self._handle_chat(user_id, nickname, data)
        else:
            await self._handle_move(user_id, nickname, data)

    async def _handle_chat(self, user_id: str, nickname: str, data: dict):
        """채팅 처리"""
        await self.manager.broadcast({
            "event": "chat",
            "user_id": user_id,
            "nickname": nickname,
            "message": data.get("message"),
            "timestamp": data.get("timestamp")
        })

    async def _handle_move(self, user_id: str, nickname: str, data: dict):
        """이동 처리"""
        # 서버 메모리에 위치 업데이트
        if user_id in self.player_positions:
            self.player_positions[user_id].update(data)
        
        # 다른 유저들에게 이동 정보 전송
        await self.manager.broadcast({
            "event": "player_move",
            "user_id": user_id,
            "nickname": nickname,
            "position": data
        })

    def get_online_count(self):
        return len(self.manager.active_connections)

game_service = GameService()
