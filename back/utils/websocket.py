from typing import List
from fastapi import WebSocket

class ConnectionManager:
    """
    범용 WebSocket 연결 관리자
    - 채팅, 알림, 게임 등 다양한 실시간 기능에서 상속받아 사용 가능
    """
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """연결된 모든 클라이언트에게 메시지 전송"""
        # 연결이 끊긴 소켓은 리스트에서 제거하기 위해 복사본을 순회하거나, 예외 처리
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # 전송 실패 시 (이미 끊긴 경우 등) 로그만 남기거나 무시
                pass
