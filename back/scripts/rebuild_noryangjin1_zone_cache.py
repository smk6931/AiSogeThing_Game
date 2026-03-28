import json
import shutil
from datetime import datetime
from pathlib import Path
import sys


ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from world.services.district_service import get_dong_by_id
from world.services.zone_service import _generate_sector_blocks


CACHE_PATH = ROOT_DIR / "back" / "cache" / "zones" / "v20_dong_3879474.json"
BACKUP_DIR = ROOT_DIR / "back" / "world" / "data" / "backups"
DONG_OSM_ID = 3879474


def main() -> None:
    if not CACHE_PATH.exists():
        raise FileNotFoundError(f"Cache not found: {CACHE_PATH}")

    backup_dir = BACKUP_DIR / f"zone_cache_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(CACHE_PATH, backup_dir / CACHE_PATH.name)

    cache_data = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    dong = get_dong_by_id(DONG_OSM_ID)
    if not dong:
        raise RuntimeError(f"Dong not found: {DONG_OSM_ID}")

    zones = cache_data.get("zones") or {}
    zones["sectors"] = _generate_sector_blocks(zones, dong["coords"])
    cache_data["zones"] = zones
    cache_data["meta"] = {
        **(cache_data.get("meta") or {}),
        "sector_mode": "pure_road_split",
        "sector_count": len(zones["sectors"]),
        "regenerated_at": datetime.now().isoformat(),
    }
    CACHE_PATH.write_text(json.dumps(cache_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Rebuilt cache sectors: {len(zones['sectors'])}")
    print(f"Backup saved to: {backup_dir}")


if __name__ == "__main__":
    main()
