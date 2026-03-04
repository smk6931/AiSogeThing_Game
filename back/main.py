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

# CORS 설정 (프론트엔드/클라우드 허용)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",

    "*" # 개발 편의상 유지하되, 위 명시적 주소가 우선됨
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
