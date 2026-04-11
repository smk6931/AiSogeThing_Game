from datetime import datetime, timedelta
import uuid

from sqlalchemy import text

from core.database import engine, execute, fetch_all, fetch_one
from user.schemas.schemas import UserCreate
from user.services.auth import get_password_hash


async def get_user_by_email(email: str):
    sql = 'SELECT * FROM "user" WHERE email = :email'
    return await fetch_one(sql, {"email": email})


async def get_user_by_id(user_id: int):
    sql = 'SELECT * FROM "user" WHERE id = :user_id'
    return await fetch_one(sql, {"user_id": user_id})


async def get_user_by_uuid(uuid_value: str):
    sql = 'SELECT * FROM "user" WHERE uuid = :uuid'
    return await fetch_one(sql, {"uuid": uuid_value})


async def create_user(user: UserCreate):
    hashed_password = get_password_hash(user.password)
    new_uuid = str(uuid.uuid4())

    async with engine.begin() as conn:
        result = await conn.execute(
            text(
                """
                INSERT INTO "user" (email, hashed_password, nickname, is_active, is_superuser, created_at, uuid)
                VALUES (:email, :password, :nickname, true, false, NOW(), :uuid)
                RETURNING id, email, nickname, is_active, created_at, uuid
                """
            ),
            {
                "email": user.email,
                "password": hashed_password,
                "nickname": user.nickname,
                "uuid": new_uuid,
            },
        )
        created_user = result.mappings().first()

        if created_user:
            await conn.execute(
                text(
                    """
                    INSERT INTO char (user_id, level, exp, hp, max_hp, mp, max_mp)
                    VALUES (:user_id, 1, 0, 100, 100, 50, 50)
                    """
                ),
                {"user_id": created_user["id"]},
            )

    return dict(created_user) if created_user else None


async def update_last_active(user_id: int):
    sql = """
        UPDATE "user"
        SET last_active_at = NOW()
        WHERE id = :user_id
    """
    await execute(sql, {"user_id": user_id})


async def count_online_users(minutes: int = 5):
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
    limit_time = datetime.now() - timedelta(minutes=minutes)
    sql = """
        SELECT id, uuid, nickname, email, last_active_at
        FROM "user"
        WHERE last_active_at >= :limit_time
          AND is_active = true
        ORDER BY last_active_at DESC
        LIMIT 50
    """
    return await fetch_all(sql, {"limit_time": limit_time})


async def get_all_users_list(limit: int = 50):
    sql = """
        SELECT id, uuid, nickname, email, last_active_at, created_at
        FROM "user"
        WHERE is_active = true
        ORDER BY COALESCE(last_active_at, created_at) DESC
        LIMIT :limit
    """
    return await fetch_all(sql, {"limit": limit})


async def mark_user_offline(user_id: int):
    past_time = datetime.now() - timedelta(hours=1)
    sql = """
        UPDATE "user"
        SET last_active_at = :past_time
        WHERE id = :user_id
    """
    await execute(sql, {"past_time": past_time, "user_id": user_id})
