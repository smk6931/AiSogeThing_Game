import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import text


ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from core.database import async_session_factory, fetch_all


DEFAULT_TABLES = [
    "comments",
    "novel_cuts",
    "novels",
    "user_logs",
    "user_youtube_logs",
    "youtube_channels",
    "youtube_list",
]

BACKUP_ROOT = ROOT_DIR / "back" / "world" / "data" / "backups"


async def fetch_columns(table_name: str) -> list[dict]:
    return await fetch_all(
        """
        SELECT
            column_name,
            data_type,
            is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = :table_name
        ORDER BY ordinal_position
        """,
        {"table_name": table_name},
    )


async def table_exists(table_name: str) -> bool:
    row = await fetch_all(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = :table_name
        """,
        {"table_name": table_name},
    )
    return bool(row)


async def backup_table(table_name: str, out_dir: Path) -> dict:
    columns = await fetch_columns(table_name)
    rows = await fetch_all(f"SELECT * FROM {table_name} ORDER BY 1")
    (out_dir / f"{table_name}.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    return {
        "table": table_name,
        "row_count": len(rows),
        "columns": columns,
    }


async def drop_tables(table_names: list[str]) -> None:
    async with async_session_factory() as session:
        for table_name in table_names:
            await session.execute(text(f"DROP TABLE IF EXISTS {table_name} CASCADE"))
        await session.commit()


async def main() -> None:
    parser = argparse.ArgumentParser(description="Backup and optionally drop legacy tables.")
    parser.add_argument("--execute", action="store_true", help="Actually drop the tables after backup.")
    parser.add_argument("--tables", nargs="*", default=DEFAULT_TABLES, help="Override target tables.")
    args = parser.parse_args()

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = BACKUP_ROOT / f"legacy_table_backup_{stamp}"
    out_dir.mkdir(parents=True, exist_ok=True)

    existing_tables: list[str] = []
    metadata: list[dict] = []
    for table_name in args.tables:
        if not await table_exists(table_name):
            metadata.append({
                "table": table_name,
                "row_count": None,
                "columns": [],
                "status": "missing",
            })
            continue

        existing_tables.append(table_name)
        info = await backup_table(table_name, out_dir)
        info["status"] = "backed_up"
        metadata.append(info)

    (out_dir / "metadata.json").write_text(
        json.dumps(
            {
                "created_at": stamp,
                "tables": metadata,
                "execute_drop": args.execute,
            },
            ensure_ascii=False,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )

    print(f"Backup completed: {out_dir}")
    print(f"Tables backed up: {', '.join(existing_tables) if existing_tables else 'none'}")

    if args.execute and existing_tables:
        await drop_tables(existing_tables)
        print(f"Dropped tables: {', '.join(existing_tables)}")
    elif args.execute:
        print("No existing tables to drop.")
    else:
        print("Dry run only. No tables were dropped.")


if __name__ == "__main__":
    asyncio.run(main())
