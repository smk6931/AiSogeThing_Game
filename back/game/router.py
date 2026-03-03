from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated, List, Dict
import json
from core.database import get_db

router = APIRouter(prefix="/api/game", tags=["Game"])

from game.managers.PlayerManager import player_manager
from game.managers.MonsterManager import monster_manager
from game.terrain_service import terrain_service
from game.zone_service import fetch_zones

import asyncio
import os
from pydantic import BaseModel

class HdriUpdate(BaseModel):
    path: str

SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "game_settings.json")

def load_settings():
    if not os.path.exists(SETTINGS_FILE):
        return {"current_hdri": "/assets/hdri/autumn_field_4k.exr"}
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {"current_hdri": "/assets/hdri/autumn_field_4k.exr"}

def save_settings(settings):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=4)
    except Exception as e:
        print(f"Error saving settings: {e}")

@router.get("/settings/hdri")
async def get_current_hdri():
    settings = load_settings()
    return {"path": settings.get("current_hdri")}

@router.post("/settings/hdri")
async def update_current_hdri(body: HdriUpdate):
    settings = load_settings()
    settings["current_hdri"] = body.path
    save_settings(settings)
    return {"status": "success", "path": body.path}


@router.get("/hdri-list")
async def get_hdri_list():
    try:
        # FastAPI 실행 위치(back) 기준 front의 hdri 폴더 경로
        hdri_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "front", "public", "assets", "hdri")
        
        if not os.path.exists(hdri_dir):
            return {"files": []}

        files = []
        for file_name in os.listdir(hdri_dir):
            if file_name.endswith(('.exr', '.hdr')):
                files.append({
                    "label": file_name,
                    "value": f"/assets/hdri/{file_name}"
                })
        return {"files": files}
    except Exception as e:
        print(f"Error reading hdri dir: {e}")
        return {"files": []}


@router.get("/terrain")
async def get_terrain_data(lat: float, lng: float, dist: int = 500):
    """
    특정 좌표 중심의 실시간 지형 데이터를 반환 (Tiled Streaming용)
    """
    # OSMnx API 호출은 Blocking IO 성향이 강하므로 run_in_executor 사용
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, terrain_service.extract_area_terrain, lat, lng, dist)
    return data


@router.get("/zones")
async def get_zone_data(lat: float, lng: float, dist: int = 2000, categories: str = None):
    """
    특정 좌표 중심, 반경(dist)m 내의 구역(Zone) 데이터를 카테고리별로 반환
    - water: 강/하천/호수
    - park: 공원
    - forest: 숲/산
    - road_major: 주요 도로 (고속도로, 간선)
    - road_minor: 일반 도로
    - residential: 주거 지역
    """
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, fetch_zones, lat, lng, dist, categories)
    return data

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
async def websocket_endpoint(websocket: WebSocket, user_id: str, nickname: str, db: AsyncSession = Depends(get_db)):
    # 1. 연결 수락 및 등록 (DB 세션 전달)
    stats = await player_manager.connect(websocket, user_id, nickname, db)
    
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
    # 자신의 소켓 정보 등을 제외하고 필요한 정보만 추려서 보냄
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
                # 내 상태 업데이트
                player_manager.update_player_state(user_id, {
                    "position": data.get("position"),
                    "rotation": data.get("rotation"),
                    "animation": data.get("animation"),
                    "mapId": data.get("mapId", "map_0") # [NEW] 맵 정보 저장
                })
                
                # 다른 사람들에게 전파 (Broadcast)
                broadcast_msg = {
                    "type": "update_position",
                    "userId": user_id,
                    "position": data.get("position"),
                    "rotation": data.get("rotation"),
                    "animation": data.get("animation"),
                    "mapId": data.get("mapId", "map_0") # [NEW] 맵 정보 전파
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
                # 채팅은 나 포함 모두에게 전송 (확인 차원)
                await player_manager.broadcast(chat_msg)

            # --- [SKILL] 스킬 사용 (중계) ---
            elif msg_type == "skill":
                # 내가 쓴 스킬을 다른 사람들에게 알림
                await player_manager.broadcast({
                    "type": "skill",
                    "userId": user_id,
                    "nickname": nickname,
                    "data": data.get("data") # 스킬 상세 정보 (pos, rot 등)
                }, exclude_user_id=user_id)

            # --- [HIT] 몬스터 피격 ---
            elif msg_type == "hit_monster":
                monster_id = data.get("monsterId")
                damage = data.get("damage", 10) # 기본 데미지 10
                skill_name = data.get("skillName", "basic")

                # 서버 상태 업데이트
                monster_manager.handle_hit(monster_id, damage)

                # 피격 사실 브로드캐스트 (이펙트 표시용)
                await player_manager.broadcast({
                    "type": "monster_hit",
                    "monsterId": monster_id,
                    "damage": damage,
                    "skillName": skill_name,
                    "attackerId": user_id
                })

    except WebSocketDisconnect:
        # 4. 연결 종료 처리
        player_manager.disconnect(user_id)
        
        # 퇴장 알림
        leave_msg = {
            "type": "leave",
            "userId": user_id
        }
        await player_manager.broadcast(leave_msg)

