from dotenv import load_dotenv
load_dotenv(override=True) # .env 파일 로드 (시스템 환경변수 덮어쓰기)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from content.hotplace.router import router as hotplace_router
from content.youtube.router import router as youtube_router
from content.user.router import router as user_router
from content.chatbot.router import router as chatbot_router
from content.admin.router import router as admin_router
from content.search.router import router as search_router
from content.novel.router import router as novel_router
from game.router import router as game_router

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
app.include_router(hotplace_router)
app.include_router(youtube_router)
app.include_router(user_router)
app.include_router(chatbot_router)
app.include_router(admin_router)
app.include_router(search_router)  # 스마트 검색 추가
app.include_router(novel_router)
app.include_router(game_router)


@app.get("/")
def read_root():
    return {"message": "AiSogeThing Backend is running!"}
