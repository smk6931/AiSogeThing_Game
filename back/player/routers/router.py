from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
# from sqlalchemy.ext.asyncio import AsyncSession  # [임시 비활성]
from typing import Annotated, List, Dict
# from core.database import get_db  # [임시 비활성]
import asyncio

from player.managers.PlayerManager import player_manager
from monster.managers.MonsterManager import monster_manager

router = APIRouter(prefix="/api/game", tags=["Game Player & WebSocket"])

@router.on_event("startup")
async def start_monster_ai():
    # 서버 시작 시 몬스터 스폰 및 AI 가동
    if not monster_manager.monsters:
        monster_manager.spawn_random(count=5)
    
    # AI 루프를 백그라운드 태스크로 실행
    asyncio.create_task(monster_manager.game_loop(player_manager.broadcast))

@router.get("/status")
async def get_game_status():
    return {"status": "online", "active_players": len(player_manager.active_connections)}

@router.websocket("/ws/{user_id}/{nickname}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, nickname: str):
    # 1. 연결 수락 및 등록 (DB 임시 비활성)
    stats = await player_manager.connect(websocket, user_id, nickname)
    
    # 1.5. 내 정보(스탯) 전송
    await websocket.send_json({"type": "init_stats", "stats": stats})

    # 2. 입장 알림 (나를 제외한 모두에게)
    join_msg = {
        "type": "join",
        "userId": user_id,
        "nickname": nickname,
        "position": {"x": 0, "y": 0, "z": 0},
        "mapId": "map_0" # [NEW] 초기 맵
    }
    await player_manager.broadcast(join_msg, exclude_user_id=user_id)
    
    # 3. 현재 접속자 목록 나에게 전송 (Sync)
    existing_players = player_manager.get_all_players()
    sync_data = {
        "type": "sync_players",
        "players": {
            uid: {
                "nickname": data["nickname"],
                "position": data["position"],
                "rotation": data.get("rotation", 0),
                "animation": data.get("animation", "Idle"),
                "mapId": data.get("mapId", "map_0") # [NEW] 맵 정보 포함
            }
            for uid, data in existing_players.items() if uid != user_id
        }
    }
    await websocket.send_json(sync_data)

    # 3.5 몬스터 목록 전송 (Sync Monsters)
    if not monster_manager.monsters:
        monster_manager.spawn_random(count=5)
    
    monsters_data = monster_manager.get_all_monsters()
    await websocket.send_json({
        "type": "sync_monsters",
        "monsters": monsters_data
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            # --- [MOVE] 위치 업데이트 ---
            if msg_type == "position":
                player_manager.update_player_state(user_id, {
                    "position": data.get("position"),
                    "rotation": data.get("rotation"),
                    "animation": data.get("animation"),
                    "mapId": data.get("mapId", "map_0")
                })
                
                broadcast_msg = {
                    "type": "update_position",
                    "userId": user_id,
                    "position": data.get("position"),
                    "rotation": data.get("rotation"),
                    "animation": data.get("animation"),
                    "mapId": data.get("mapId", "map_0")
                }
                await player_manager.broadcast(broadcast_msg, exclude_user_id=user_id)
            
            # --- [CHAT] 채팅 메시지 ---
            elif msg_type == "chat":
                chat_msg = {
                    "type": "chat",
                    "userId": user_id,
                    "nickname": nickname,
                    "message": data.get("message")
                }
                await player_manager.broadcast(chat_msg)

            # --- [SKILL] 스킬 사용 (중계) ---
            elif msg_type == "skill":
                await player_manager.broadcast({
                    "type": "skill",
                    "userId": user_id,
                    "nickname": nickname,
                    "data": data.get("data")
                }, exclude_user_id=user_id)

            # --- [HIT] 몬스터 피격 ---
            elif msg_type == "hit_monster":
                monster_id = data.get("monsterId")
                damage = data.get("damage", 10)
                skill_name = data.get("skillName", "basic")

                monster_manager.handle_hit(monster_id, damage)

                await player_manager.broadcast({
                    "type": "monster_hit",
                    "monsterId": monster_id,
                    "damage": damage,
                    "skillName": skill_name,
                    "attackerId": user_id
                })

    except WebSocketDisconnect:
        player_manager.disconnect(user_id)
        
        leave_msg = {
            "type": "leave",
            "userId": user_id
        }
        await player_manager.broadcast(leave_msg)
