import json
import os
from functools import lru_cache


DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
YONGSAN_PROFILE_PATH = os.path.join(DATA_DIR, "yongsan_world_profile.json")


@lru_cache(maxsize=8)
def _load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_yongsan_world_profile() -> dict:
    if not os.path.exists(YONGSAN_PROFILE_PATH):
        return {"error": "Yongsan world profile not found"}
    return _load_json(YONGSAN_PROFILE_PATH)

