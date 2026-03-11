from dotenv import load_dotenv
load_dotenv(override=True) # .env 파일 로드 (시스템 환경변수 덮어쓰기)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from user.routers.router import router as auth_router
from player.routers.router import router as player_router
from world.routers.router import router as world_router
from common.routers.router import router as common_router

app = FastAPI()

# ========================================================
#  Logging Configuration (Filter Heartbeat/Stats)
# ========================================================
import logging

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # Filter out noisy heartbeat/stats logs
        return record.getMessage().find("/api/auth/heartbeat") == -1 and \
               record.getMessage().find("/api/auth/stats/online") == -1

@app.on_event("startup")
async def startup_event():
    # Apply filter to uvicorn access logger
    logger = logging.getLogger("uvicorn.access")
    logger.addFilter(EndpointFilter())

origins = [
    "http://localhost:3100",
    "http://127.0.0.1:3100",
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


@app.get("/")
def read_root():
    return {"message": "AiSogeThing Backend is running!"}
