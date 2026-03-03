from .schemas import UserCreate
from .auth import get_password_hash
from core.database import execute, fetch_one, fetch_all, insert_and_return  # Raw SQL 래퍼 사용
from datetime import datetime, timedelta
import uuid

# ========================================================
#  User 서비스 (Raw SQL 버전)
# ========================================================

async def get_user_by_email(email: str):
    """이메일로 사용자 조회 (Async Raw SQL)"""
    sql = 'SELECT * FROM "user" WHERE email = :email'
    return await fetch_one(sql, {"email": email})

async def get_user_by_id(user_id: int):
    """ID로 사용자 조회 (Async Raw SQL)"""
    sql = 'SELECT * FROM "user" WHERE id = :user_id'
    return await fetch_one(sql, {"user_id": user_id})

async def get_user_by_uuid(uuid: str):
    """UUID로 사용자 조회 (Async Raw SQL)"""
    sql = 'SELECT * FROM "user" WHERE uuid = :uuid'
    return await fetch_one(sql, {"uuid": uuid})


async def create_user(user: UserCreate):
    """신규 회원 생성 (Async Raw SQL)"""
    # 1. 비밀번호 암호화
    hashed_password = get_password_hash(user.password)
    
    # 2. UUID 생성
    new_uuid = str(uuid.uuid4())
    
    # 3. INSERT 쿼리 (uuid 추가)
    sql = """
        INSERT INTO "user" (email, hashed_password, nickname, is_active, is_superuser, created_at, uuid)
        VALUES (:email, :password, :nickname, true, false, NOW(), :uuid)
        RETURNING id, email, nickname, is_active, created_at, uuid
    """
    
    params = {
        "email": user.email,
        "password": hashed_password,
        "nickname": user.nickname,
        "uuid": new_uuid
    }
    
    # 4. 실행 및 결과 반환
    return await insert_and_return(sql, params)

async def update_last_active(user_id: int):
    """유저 마지막 활동 시간 갱신 (Heartbeat)"""
    sql = """
        UPDATE "user"
        SET last_active_at = NOW()
        WHERE id = :user_id
    """
    await execute(sql, {"user_id": user_id})

async def count_online_users(minutes: int = 5):
    """
    최근 N분 내 활동 유저 수 조회
    """
    # Python에서 시간 계산 (DB 종속성 제거 및 안전성 확보)
    limit_time = datetime.now() - timedelta(minutes=minutes)
    
    sql = """
        SELECT COUNT(*) as count 
        FROM "user" 
        WHERE last_active_at >= :limit_time
          AND is_active = true
    """
    
    result = await fetch_one(sql, {"limit_time": limit_time})
    return result["count"] if result else 0

async def get_online_users_list(minutes: int = 5):
    """
    최근 N분 내 활동 유저 목록 조회 (닉네임, 이메일 등)
    """
    limit_time = datetime.now() - timedelta(minutes=minutes)
    
    sql = """
        SELECT id, uuid, nickname, email, last_active_at
        FROM "user" 
        WHERE last_active_at >= :limit_time
          AND is_active = true
        ORDER BY last_active_at DESC
        LIMIT 50
    """
    # 너무 많으면 UI 터지니까 일단 50명 제한
    
    return await fetch_all(sql, {"limit_time": limit_time})

async def get_all_users_list(limit: int = 50):
    """
    전체 유저 목록 조회 (최근 활동순, 오프라인 포함)
    """
    sql = """
        SELECT id, uuid, nickname, email, last_active_at, created_at
        FROM "user" 
        WHERE is_active = true
        ORDER BY COALESCE(last_active_at, created_at) DESC
        LIMIT :limit
    """
    return await fetch_all(sql, {"limit": limit})

async def mark_user_offline(user_id: int):
    """
    로그아웃 시 강제로 오프라인 처리 (시간을 과거로 돌림)
    """
    # 5분 조회 조건에서 즉시 빠지도록 1시간 전으로 세팅
    past_time = datetime.now() - timedelta(hours=1)
    
    sql = """
        UPDATE "user"
        SET last_active_at = :past_time
        WHERE id = :user_id
    """
    await execute(sql, {"past_time": past_time, "user_id": user_id})
