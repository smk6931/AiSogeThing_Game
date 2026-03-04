from typing import Dict, List, Optional
from fastapi import WebSocket
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from player.models.models import GameCharacter

class PlayerManager:
    """
    게임 내 활성 플레이어(접속자)를 메모리 상에서 관리하는 클래스
    Independent class optimized for Game State Management (User ID + Data).
    """
    def __init__(self):
        # 접속 중인 플레이어 목록 {user_id: {socket, nickname, position, ...}}
        self.active_connections: Dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, user_id: str, nickname: str, db: AsyncSession):
        """새로운 플레이어 접속 처리"""
        await websocket.accept()
        
        # 1. DB에서 캐릭터 정보 로드 (없으면 생성)
        try:
            result = await db.execute(select(GameCharacter).where(GameCharacter.user_id == int(user_id)))
            character = result.scalars().first()
            
            if not character:
                character = GameCharacter(
                    user_id=int(user_id),
                    level=1, hp=100, max_hp=100, 
                    mp=50, max_mp=50, exp=0
                )
                db.add(character)
                await db.commit()
                await db.refresh(character)
                print(f"✨ New Character Created for {nickname}")
        except Exception as e:
            print(f"⚠️ DB Loading Error: {e}")
            # DB 에러나도 접속은 시켜주되 기본값 사용
            character = GameCharacter(level=1, hp=100, max_hp=100, mp=50, max_mp=50)

        stats = {
            "level": character.level,
            "hp": character.hp,
            "maxHp": character.max_hp,
            "mp": character.mp,
            "maxMp": character.max_mp,
            "exp": character.exp
        }

        # 초기 상태 설정
        initial_state = {
            "socket": websocket,
            "nickname": nickname,
            "position": {"x": 0, "y": 0, "z": 0}, 
            "rotation": 0,
            "animation": "Idle",
            "stats": stats  # 메모리에 스탯 보유
        }
        
        self.active_connections[user_id] = initial_state
        print(f"✅ Player Connected: {nickname} (ID: {user_id}, Lv.{stats['level']})")
        return stats

    def disconnect(self, user_id: str):
        """플레이어 접속 해제 처리"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            print(f"❌ Player Disconnected: ID {user_id}")

    def get_player(self, user_id: str) -> Optional[dict]:
        """특정 플레이어 정보 조회"""
        return self.active_connections.get(user_id)

    def get_all_players(self) -> Dict[str, dict]:
        """전체 플레이어 목록 조회"""
        return self.active_connections

    def update_player_state(self, user_id: str, new_state: dict):
        """플레이어 상태(위치, 행동) 업데이트"""
        if user_id in self.active_connections:
            player = self.active_connections[user_id]
            # 위험한 키(socket) 필터링
            safe_update = {k: v for k, v in new_state.items() if k != "socket"}
            player.update(safe_update)

    async def broadcast(self, message: dict, exclude_user_id: str = None):
        """모든 플레이어에게 메시지 전송 (특정 유저 제외 가능)"""
        # [수정] 런타임 에러 방지하기 위해 리스트로 복사본 생성 후 순회
        for user_id, player_data in list(self.active_connections.items()):
            if user_id == exclude_user_id:
                continue
            
            socket = player_data["socket"]
            try:
                await socket.send_json(message)
            except Exception as e:
                print(f"⚠️ Broadcast Error to {user_id}: {e}")
                # 에러 발생 시 처리 (옵션)

# 싱글톤 인스턴스
player_manager = PlayerManager()
