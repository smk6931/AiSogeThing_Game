import asyncio
import json
from datetime import datetime
from pathlib import Path
import sys

from sqlalchemy import text


ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from core.database import async_session_factory, fetch_all


BACKUP_ROOT = ROOT_DIR / "back" / "world" / "data" / "backups"


async def backup_table(name: str, out_dir: Path) -> None:
    rows = await fetch_all(f"SELECT * FROM {name} ORDER BY id")
    (out_dir / f"{name}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


async def main() -> None:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = BACKUP_ROOT / f"world_partition_backup_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    for table in ["world_admin_area", "world_level_partition"]:
        await backup_table(table, out_dir)

    async with async_session_factory() as session:
        await session.execute(text("DROP VIEW IF EXISTS world_partition_detail"))
        await session.execute(
            text(
                """
                TRUNCATE TABLE
                    world_level_partition,
                    world_admin_area
                RESTART IDENTITY CASCADE
                """
            )
        )
        await session.commit()

    print(f"Backup completed: {out_dir}")
    print("World partition tables reset.")


if __name__ == "__main__":
    asyncio.run(main())
