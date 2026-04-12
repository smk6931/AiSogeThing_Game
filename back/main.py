import sys
# Windows cp949 인코딩 문제 방지 — 이모지 등 비ASCII 예외 메시지 출력 시 크래시 예방
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from dotenv import load_dotenv
load_dotenv(override=True) # .env 파일 로드 (시스템 환경변수 덮어쓰기)

import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from user.routers.router import router as auth_router
from player.routers.router import router as player_router
from world.routers.router import router as world_router
from common.routers.router import router as common_router
from monster.routers.router import router as monster_router
from item.routers.router import router as item_router
from monster.managers.MonsterManager import monster_manager
from player.managers.PlayerManager import player_manager

app = FastAPI()


async def broadcast_monster_delta_to_visible_players(message: dict):
    upsert = message.get("upsert") or {}
    remove = [int(mid) for mid in (message.get("remove") or [])]

    for user_id, player in list(player_manager.get_all_players().items()):
        position = player.get("position") or {}
        current_visible_ids = monster_manager.get_monster_ids_in_radius(
            position.get("x", 0) or 0,
            position.get("z", 0) or 0,
        )
        previous_visible_ids = set(player.get("visibleMonsterIds") or set())

        visible_upsert = {
            str(mid): data
            for mid, data in upsert.items()
            if int(mid) in current_visible_ids
        }
        lost_visibility_ids = previous_visible_ids - current_visible_ids
        visible_remove = sorted(
            lost_visibility_ids.union({mid for mid in remove if mid in previous_visible_ids})
        )

        player["visibleMonsterIds"] = current_visible_ids

        if not visible_upsert and not visible_remove:
            continue

        await player_manager.send_to_user(user_id, {
            "type": "monster_delta",
            "upsert": visible_upsert,
            "remove": visible_remove,
        })

# ========================================================
#  Logging Configuration (Filter Heartbeat/Stats)
# ========================================================

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Filter out noisy heartbeat/stats logs
        return record.getMessage().find("/api/auth/heartbeat") == -1 and \
               record.getMessage().find("/api/auth/stats/online") == -1

@app.on_event("startup")
async def startup_event():
    logger = logging.getLogger("uvicorn.access")
    logger.addFilter(EndpointFilter())
    # 몬스터 스폰 및 AI 루프 시작
    if not monster_manager.monsters:
        monster_manager.spawn_random(count=5)
    asyncio.create_task(monster_manager.game_loop(
        broadcast_monster_delta_to_visible_players,
        player_manager.get_all_players,
        player_manager.send_to_user,
    ))
    asyncio.create_task(player_manager.mp_regen_loop(regen_per_tick=2, interval_sec=1.0))
    print("Monster AI loop started via app startup.")

origins = [
    "http://localhost:3100",
    "http://127.0.0.1:3100",
    "https://game.sogething.com",
    "https://www.game.sogething.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # 와일드카드(*) 사용 시 브라우저에서 CORS 차단됨 (credentials=True 때문)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth_router)
app.include_router(player_router)
app.include_router(world_router)
app.include_router(common_router)
app.include_router(monster_router)
app.include_router(item_router)


@app.get("/")
def read_root():
    return {"message": "AiSogeThing Backend is running!"}
