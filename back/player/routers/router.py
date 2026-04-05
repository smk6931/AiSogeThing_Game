from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from player.managers.PlayerManager import player_manager
from monster.managers.MonsterManager import monster_manager
from item.service import roll_drops, grant_items_to_user
import player.repository as char_repo

router = APIRouter(prefix="/api/game", tags=["Game Player & WebSocket"])


async def _send_visible_monsters(websocket: WebSocket, player_state: dict):
    position = player_state.get("position") or {}
    monsters_data = monster_manager.get_monsters_in_radius(
        position.get("x", 0) or 0,
        position.get("z", 0) or 0,
    )
    player_state["visibleMonsterIds"] = {int(mid) for mid in monsters_data.keys()}
    await websocket.send_json({
        "type": "sync_monsters",
        "monsters": monsters_data
    })

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
    
    player = player_manager.get_player(user_id)
    if player:
        await _send_visible_monsters(websocket, player)

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
                await player_manager.broadcast_nearby(
                    broadcast_msg,
                    origin_user_id=user_id,
                    radius=player_manager.player_sync_radius,
                    include_self=False,
                )

                player = player_manager.get_player(user_id)
                if player:
                    await _send_visible_monsters(websocket, player)
            
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
                await player_manager.broadcast_nearby({
                    "type": "skill",
                    "userId": user_id,
                    "nickname": nickname,
                    "data": data.get("data")
                }, origin_user_id=user_id, radius=player_manager.skill_sync_radius, include_self=False)

            # --- [HIT] 몬스터 피격 ---
            elif msg_type == "hit_monster":
                monster_id = data.get("monsterId")
                skill_name = data.get("skillName", "basic")
                player_stats = player_manager.get_player_stats(user_id) or {}
                player_attack = player_stats.get("attack", 10)

                hit_result = monster_manager.handle_hit(monster_id, player_attack, skill_name)
                if not hit_result or not hit_result.get("ok"):
                    continue

                await player_manager.broadcast_nearby({
                    "type": "monster_hit",
                    "monsterId": hit_result["monsterId"],
                    "damage": hit_result["damage"],
                    "hp": hit_result["hp"],
                    "maxHp": hit_result["maxHp"],
                    "state": hit_result["state"],
                    "killed": hit_result["killed"],
                    "skillName": skill_name,
                    "attackerId": user_id
                }, origin_user_id=user_id, radius=player_manager.skill_sync_radius, include_self=True)

                if hit_result["killed"]:
                    reward_result = player_manager.add_rewards(
                        user_id,
                        exp_gain=hit_result["expReward"],
                        gold_gain=hit_result["goldReward"]
                    )

                    if reward_result:
                        await player_manager.broadcast_nearby({
                            "type": "monster_dead",
                            "monsterId": hit_result["monsterId"],
                            "attackerId": user_id,
                            "expReward": hit_result["expReward"],
                            "goldReward": hit_result["goldReward"]
                        }, origin_user_id=user_id, radius=player_manager.skill_sync_radius, include_self=True)

                        player = player_manager.get_player(user_id)
                        if player:
                            await player["socket"].send_json({
                                "type": "player_reward",
                                "monsterId": hit_result["monsterId"],
                                "expGained": reward_result["expGained"],
                                "goldGained": reward_result["goldGained"],
                                "leveledUp": reward_result["leveledUp"],
                                "stats": reward_result["stats"]
                            })

                        # 등록 유저만 스탯 DB 저장
                        try:
                            uid_int = int(user_id)
                            if uid_int < 50000:
                                await char_repo.save_character(uid_int, reward_result["stats"])
                        except Exception as e:
                            print(f"[WARN] save_character failed for {user_id}: {e}")

                    # 아이템 드롭 처리
                    drop_table = hit_result.get("dropTable", [])
                    if drop_table:
                        try:
                            dropped = await roll_drops(drop_table)
                        except Exception as e:
                            print(f"[WARN] roll_drops failed for monster {hit_result['monsterId']}: {e}")
                            dropped = []
                        print(f"[DROP] user={user_id} monster={hit_result['monsterId']} dropTable={drop_table} dropped={dropped}")
                        if dropped:
                            # 등록 유저(< 50000)만 DB 저장, guest는 FK 없으므로 스킵
                            try:
                                uid_int = int(user_id)
                                if uid_int < 50000:
                                    await grant_items_to_user(uid_int, dropped)
                            except Exception as e:
                                print(f"[WARN] grant_items failed for user {user_id}: {e}")
                            player = player_manager.get_player(user_id)
                            if player:
                                await player["socket"].send_json({
                                    "type": "item_drop",
                                    "monsterId": hit_result["monsterId"],
                                    "items": dropped
                                })

    except WebSocketDisconnect:
        player_manager.disconnect(user_id)
        
        leave_msg = {
            "type": "leave",
            "userId": user_id
        }
        await player_manager.broadcast(leave_msg)
