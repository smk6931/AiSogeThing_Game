from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

import sys
import os

# ===========================================================================
# [경로 설정 & 모델 Import & Dotenv Load]
# ===========================================================================
from dotenv import load_dotenv

# 1. 루트 경로의 .env 로드 (절대 경로)
env_path = r"c:/GitHub/AiSogeThing/.env"
print(f"📄 Loading .env from: {env_path}")
load_dotenv(env_path)

sys.path.append(os.getcwd())

# 이제 models.py 대신 core.database를 불러옵니다.
# (이 안에 모델들이 다 들어있음)
from core.database import Base 

# Alembic이 바라볼 MetaData 설정
target_metadata = Base.metadata

# ===========================================================================

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    
    # [Patch] 환경변수 우선 (서버: 5432, 로컬: 5433)
    db_user = os.getenv("DB_USER", "postgres")
    db_password = os.getenv("DB_PASSWORD", "0000")
    db_host = os.getenv("DB_HOST", "127.0.0.1")
    db_port = os.getenv("DB_PORT", "5433") 
    db_name = os.getenv("DB_NAME", "aisogething")
    
    sqlalchemy_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    print(f"🔗 Alembic Connecting to: {sqlalchemy_url}")

    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = sqlalchemy_url

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
