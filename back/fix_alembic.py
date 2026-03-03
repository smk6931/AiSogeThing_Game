import asyncio
from sqlalchemy import text
from core.database import engine

async def fix_version():
    async with engine.begin() as conn:
        # 1. 현재 버전 확인 (디버깅용)
        result = await conn.execute(text("SELECT * FROM alembic_version"))
        current_version = result.scalar()
        print(f"🧐 Current DB Version: {current_version}")
        
        # 2. 강제 업데이트 (0c7db2cc67d8: 가장 최신 정상 파일)
        target_version = '0c7db2cc67d8'
        await conn.execute(text(f"UPDATE alembic_version SET version_num = '{target_version}'"))
        print(f"✅ Forced Update Query Executed. Target: {target_version}")

        # 3. 검증
        result = await conn.execute(text("SELECT * FROM alembic_version"))
        new_version = result.scalar()
        print(f"🧐 Verified DB Version: {new_version}")

        if new_version == target_version:
             print("🎉 SUCCESS: DB Version is now correct!")
        else:
             print("❌ FAILURE: DB Version did not update.")

if __name__ == "__main__":
    asyncio.run(fix_version())
