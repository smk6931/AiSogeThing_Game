"""
Overpass API에서 동 bbox 안의 모든 highway way를 가져와 osm_cache/{dong_osm_id}_roads.json 갱신.

기존 fetch_osm_features.py는 landuse/waterway 등 area feature 전용. 도로 라인은 다루지 않음.
이 스크립트가 작은 도로(service, footway, path, unclassified, pedestrian, steps, living_street) 까지 포함.

사용법:
  python back/scripts/fetch_osm_roads.py --dong-osm-id 3879474
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
CACHE_DIR = BACK_DIR / "world" / "data" / "osm_cache"
if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

import requests
from shapely.geometry import shape
from sqlalchemy import text
from core.database import async_session_factory

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# 모든 단계 highway 포함 (큰길→골목→보행)
HIGHWAY_REGEX = (
    "trunk|trunk_link|primary|primary_link|secondary|secondary_link|"
    "tertiary|tertiary_link|residential|living_street|"
    "unclassified|service|"
    "footway|path|steps|pedestrian"
)


async def get_dong_bbox(dong_osm_id: int):
    async with async_session_factory() as session:
        row = await session.execute(text("""
            SELECT name, boundary_geojson
            FROM world_area
            WHERE osm_id = :id AND area_level = 'dong' LIMIT 1
        """), {"id": dong_osm_id})
        rec = row.mappings().first()
        if not rec:
            return None, None
        raw = rec["boundary_geojson"]
        if isinstance(raw, str):
            raw = json.loads(raw)
        g = shape(raw)
        if not g.is_valid:
            g = g.buffer(0)
        return rec["name"], g.bounds  # (minx_lng, miny_lat, maxx_lng, maxy_lat)


def fetch_overpass(bbox: tuple) -> list:
    minlng, minlat, maxlng, maxlat = bbox
    query = f"""
    [out:json][timeout:180];
    (
      way["highway"~"^({HIGHWAY_REGEX})$"]({minlat},{minlng},{maxlat},{maxlng});
    );
    out body;
    >;
    out skel qt;
    """
    print(f"[INFO] Overpass 호출 bbox=({minlat:.4f},{minlng:.4f})-({maxlat:.4f},{maxlng:.4f})")
    headers = {"User-Agent": "AiSogeThing-Game/1.0 (build_world_road)"}
    resp = requests.post(OVERPASS_URL, data={"data": query}, headers=headers, timeout=180)
    resp.raise_for_status()
    data = resp.json()
    return data.get("elements", [])


async def run(dong_osm_id: int):
    name, bbox = await get_dong_bbox(dong_osm_id)
    if not bbox:
        print(f"[ERROR] dong osm_id={dong_osm_id} not found")
        return
    print(f"[INFO] dong: {name}")

    elements = fetch_overpass(bbox)
    nodes = [e for e in elements if e.get("type") == "node"]
    ways  = [e for e in elements if e.get("type") == "way"]
    print(f"[INFO] 받은 element: ways={len(ways)} nodes={len(nodes)}")

    # highway 분포
    from collections import Counter
    hw = Counter(w.get("tags", {}).get("highway", "") for w in ways)
    for k, v in sorted(hw.items(), key=lambda x: -x[1]):
        print(f"    {k:20s}: {v}")

    out = CACHE_DIR / f"{dong_osm_id}_roads.json"
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(elements, ensure_ascii=False), encoding="utf-8")
    print(f"[DONE] saved → {out} ({out.stat().st_size:,} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dong-osm-id", type=int, required=True)
    args = parser.parse_args()
    asyncio.run(run(args.dong_osm_id))
