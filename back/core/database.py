from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import text
import os
from dotenv import load_dotenv

# .env ?뚯씪 濡쒕뱶 (?꾨줈?앺듃 猷⑦듃 ?먮뒗 back ?대뜑?먯꽌 李얘린)
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')  # back/core/../../.env
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()  # ?꾩옱 ?붾젆?좊━?먯꽌 李얘린

# ==========================================================
#  [Async] DB ?곌껐 ?ㅼ젙 (SQLAlchemy Async Core)
# ==========================================================

DB_USER = os.getenv("DB_USER", "game_sogething")
DB_PASSWORD = os.getenv("DB_PASSWORD", "0000")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5433")
DB_NAME = os.getenv("DB_NAME", "game_sogething")

# 鍮꾨룞湲??쒕씪?대쾭 (postgresql+asyncpg)
SQLALCHEMY_DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Connection info log without non-ASCII characters so startup works in cp949 consoles.
print(f"DB connection: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

# Async ?붿쭊 ?앹꽦
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    echo=False  # 荑쇰━ 濡쒓렇 蹂쇨굅硫?True
)

# Base ?좎뼵 (留덉씠洹몃젅?댁뀡??
Base = declarative_base()


# ==========================================================
#  [?듭떖] Async Raw SQL ?ㅽ뻾 ?섑띁 ?⑥닔
# ==========================================================

async def execute(query: str, params: dict = None):
    """
    INSERT, UPDATE, DELETE 荑쇰━ ?ㅽ뻾 (鍮꾨룞湲?
    """
    try:
        async with engine.begin() as conn:  # 鍮꾨룞湲??몃옖??뀡 (?깃났 ???먮룞 Commit)
            result = await conn.execute(text(query), params or {})
            return result
    except Exception as e:
        print(f"??execute ?ㅽ뙣: {e}")
        raise e

async def fetch_one(query: str, params: dict = None) -> dict | None:
    """
    SELECT ?④굔 議고쉶 (鍮꾨룞湲? Dict 諛섑솚)
    """
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text(query), params or {})
            row = result.mappings().first()
            return dict(row) if row else None
    except Exception as e:
        print(f"??fetch_one ?ㅽ뙣: {e}")
        raise e

async def fetch_all(query: str, params: dict = None) -> list[dict]:
    """
    SELECT ?ㅺ굔 議고쉶 (鍮꾨룞湲? List[Dict] 諛섑솚)
    """
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text(query), params or {})
            rows = result.mappings().all()
            return [dict(row) for row in rows]
    except Exception as e:
        print(f"??fetch_all ?ㅽ뙣: {e}")
        raise e

async def insert_and_return(query: str, params: dict = None) -> dict | None:
    """
    INSERT/UPDATE ??寃곌낵 諛섑솚 (鍮꾨룞湲? Transaction Commit ?ы븿)
    """
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text(query), params or {})
            row = result.mappings().first()
            return dict(row) if row else None
    except Exception as e:
        print(f"??insert_and_return ?ㅽ뙣: {e}")
        raise e

# ==========================================================
#  [Legacy] ?섏〈??二쇱엯??(鍮꾨룞湲??몄뀡?쇰줈 蹂寃??꾩슂 ???ъ슜)
# ==========================================================
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# ?ㅽ겕由쏀듃?먯꽌 ?ъ슜?????덈룄濡?蹂꾩묶 ?쒓났
async_session_factory = AsyncSessionLocal

async def get_db():
    async with AsyncSessionLocal() as db:
        try:
            yield db
        finally:
            await db.close()

# 紐⑤뜽 Import
# 紐⑤뜽 Import
from user.models.models import User
from player.models.models import GameCharacter
from world.models.models import WorldAdminArea, WorldLevelPartition, WorldPartitionAdjacency
from monster.models.model import MonsterTemplate
