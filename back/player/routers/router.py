import time
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Any

from player.managers.PlayerManager import player_manager
from monster.managers.MonsterManager import monster_manager
from player.repositories import repository as char_repo
from player.services import service as player_service

router = APIRouter(prefix="/api/game", tags=["Game Player & WebSocket"])


class SettingsBody(BaseModel):
    settings: dict[str, Any]


@router.get("/settings/{user_id}")
async def get_settings(user_id: int):
    """유저 UI/전투 설정 조회"""
    try:
        data = await char_repo.get_ui_settings(user_id)
        return {"settings": data or {}}
    except Exception:
        return {"settings": {}}


@router.put("/settings/{user_id}")
async def save_settings(user_id: int, body: SettingsBody):
    """유저 UI/전투 설정 저장"""
    try:
        await char_repo.save_ui_settings(user_id, body.settings)
    except Exception:
        pass
    return {"ok": True}


@router.get("/status")
async def get_game_status():
    return {"status": "online", "active_players": len(player_manager.active_connections)}


async def _send_visible_monsters(websocket: WebSocket, player_state: dict):
    position = player_state.get("position") or {}
    monsters_data = monster_manager.get_monsters_in_radius(
        position.get("x", 0) or 0,
        position.get("z", 0) or 0,
    )
    player_state["visibleMonsterIds"] = {int(mid) for mid in monsters_data.keys()}
    await websocket.send_json({"type": "sync_monsters", "monsters": monsters_data})


@router.websocket("/ws/{user_id}/{nickname}")
async def websocket_endpoint(websocket: WebSocket, user_id: str, nickname: str):
    stats = await player_manager.connect(websocket, user_id, nickname)

    try:
        await websocket.send_json({"type": "init_stats", "stats": stats})
        await player_manager.broadcast(
            {"type": "join", "userId": user_id, "nickname": nickname,
             "position": {"x": 0, "y": 0, "z": 0}, "mapId": "map_0"},
            exclude_user_id=user_id,
        )
        existing_players = player_manager.get_all_players()
        await websocket.send_json({
            "type": "sync_players",
            "players": {
                uid: {
                    "nickname": d["nickname"],
                    "position": d["position"],
                    "rotation": d.get("rotation", 0),
                    "animation": d.get("animation", "Idle"),
                    "mapId": d.get("mapId", "map_0"),
                }
                for uid, d in existing_players.items() if uid != user_id
            },
        })

        if not monster_manager.monsters:
            monster_manager.spawn_random(count=5)
        player = player_manager.get_player(user_id)
        if player:
            await _send_visible_monsters(websocket, player)
    except WebSocketDisconnect:
        player_manager.disconnect(user_id)
        return

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "position":
                player_manager.update_player_state(user_id, {
                    "position": data.get("position"),
                    "rotation": data.get("rotation"),
                    "animation": data.get("animation"),
                    "mapId": data.get("mapId", "map_0"),
                })
                await player_manager.broadcast_nearby(
                    {"type": "update_position", "userId": user_id,
                     "position": data.get("position"), "rotation": data.get("rotation"),
                     "animation": data.get("animation"), "mapId": data.get("mapId", "map_0")},
                    origin_user_id=user_id,
                    radius=player_manager.player_sync_radius,
                    include_self=False,
                )
                player = player_manager.get_player(user_id)
                if player:
                    pos = player.get("position") or {}
                    px, pz = pos.get("x", 0) or 0, pos.get("z", 0) or 0
                    now_ts = time.time()
                    last_sync = player.get("_last_monster_sync_pos")
                    moved_far = (
                        last_sync is None or
                        (px - last_sync[0]) ** 2 + (pz - last_sync[1]) ** 2 >= 225
                    )
                    if moved_far or (now_ts - player.get("_last_monster_sync_time", 0)) >= 2.0:
                        player["_last_monster_sync_pos"] = (px, pz)
                        player["_last_monster_sync_time"] = now_ts
                        await _send_visible_monsters(websocket, player)

            elif msg_type == "chat":
                await player_manager.broadcast({
                    "type": "chat", "userId": user_id,
                    "nickname": nickname, "message": data.get("message"),
                })

            elif msg_type == "skill":
                await player_manager.broadcast_nearby(
                    {"type": "skill", "userId": user_id,
                     "nickname": nickname, "data": data.get("data")},
                    origin_user_id=user_id,
                    radius=player_manager.skill_sync_radius,
                    include_self=False,
                )

            elif msg_type == "hit_monster":
                result = await player_service.handle_hit(
                    user_id, data.get("monsterId"), data.get("skillName", "basic"),
                    player_manager, monster_manager,
                )
                if not result.get("ok"):
                    continue
                await player_manager.broadcast_nearby(
                    result["hit_broadcast"],
                    origin_user_id=user_id,
                    radius=player_manager.skill_sync_radius,
                    include_self=True,
                )
                if result.get("killed"):
                    if result.get("dead_broadcast"):
                        await player_manager.broadcast_nearby(
                            result["dead_broadcast"],
                            origin_user_id=user_id,
                            radius=player_manager.skill_sync_radius,
                            include_self=True,
                        )
                    player = player_manager.get_player(user_id)
                    if player:
                        if result.get("reward_payload"):
                            await player["socket"].send_json(result["reward_payload"])
                        if result.get("drop_payload"):
                            await player["socket"].send_json(result["drop_payload"])

            elif msg_type == "use_item":
                item_id = data.get("itemId")
                if item_id:
                    payload = await player_service.handle_use_item(user_id, item_id, player_manager)
                    if payload:
                        await websocket.send_json(payload)

    except WebSocketDisconnect:
        player_manager.disconnect(user_id)
        await player_manager.broadcast({"type": "leave", "userId": user_id})
