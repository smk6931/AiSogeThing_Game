"""
OSM feature 수집 스크립트 (Overpass API)
— 동 경계 bbox 기준으로 waterway/landuse/natural/leisure/amenity/highway 폴리곤 수집
— 결과를 back/world/data/osm_cache/{dong_osm_id}_features.geojson 에 캐시

사용법:
  python back/scripts/fetch_osm_features.py --dong-osm-id 3879474
  python back/scripts/fetch_osm_features.py --dong-osm-id 3879474 --force   # 캐시 무시 재수집
"""

import asyncio
import argparse
import json
import time
import sys
import math
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

import requests

ROOT_DIR = Path(__file__).resolve().parents[2]
BACK_DIR = ROOT_DIR / "back"
CACHE_DIR = BACK_DIR / "world" / "data" / "osm_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

if str(BACK_DIR) not in sys.path:
    sys.path.append(str(BACK_DIR))

from sqlalchemy import text
from core.database import async_session_factory

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
BBOX_MARGIN = 0.005   # 동 경계 bbox에 여유 추가 (약 400m)


# ── OSM 태그 → 파티션 속성 매핑 ────────────────────────────────────────────

LANDUSE_MAP = {
    # waterway
    "water":         ("water",       "ancient_waterway"),
    "river":         ("water",       "ancient_waterway"),
    "stream":        ("water",       "ancient_waterway"),
    "canal":         ("water",       "ancient_waterway"),
    # green
    "park":          ("park",        "sanctuary_green"),
    "forest":        ("forest",      "sanctuary_green"),
    "wood":          ("forest",      "sanctuary_green"),
    "grass":         ("park",        "sanctuary_green"),
    "meadow":        ("park",        "sanctuary_green"),
    "scrub":         ("forest",      "sanctuary_green"),
    "heath":         ("forest",      "sanctuary_green"),
    "nature_reserve":("forest",      "sanctuary_green"),
    # residential
    "residential":   ("residential", "residential_zone"),
    "housing":       ("residential", "residential_zone"),
    # commercial
    "commercial":    ("commercial",  "urban_district"),
    "retail":        ("commercial",  "urban_district"),
    "mixed_use":     ("commercial",  "urban_district"),
    # education
    "school":        ("educational", "academy_sanctum"),
    "university":    ("educational", "academy_sanctum"),
    "college":       ("educational", "academy_sanctum"),
    "kindergarten":  ("educational", "academy_sanctum"),
    # medical
    "hospital":      ("medical",     "sanctuary_healing"),
    "clinic":        ("medical",     "sanctuary_healing"),
    # industrial
    "industrial":    ("industrial",  "forge_district"),
    "railway":       ("industrial",  "forge_district"),
    # military
    "military":      ("military",    "fortress_grounds"),
    # cemetery
    "cemetery":      ("cemetery",    "sanctuary_green"),
    "grave_yard":    ("cemetery",    "sanctuary_green"),
    # sports / leisure
    "stadium":       ("park",        "sanctuary_green"),
    "sports_centre": ("park",        "sanctuary_green"),
    "pitch":         ("park",        "sanctuary_green"),
    "recreation_ground": ("park",    "sanctuary_green"),
    "allotments":    ("residential", "residential_zone"),
    "farmland":      ("park",        "sanctuary_green"),
    # default
    "default":       ("residential", "residential_zone"),
}


def get_landuse_theme(tags: dict) -> tuple[str, str]:
    """OSM tags → (dominant_landuse, theme_code)"""
    for key in ["leisure", "natural", "landuse", "waterway", "amenity"]:
        val = tags.get(key, "")
        if val in LANDUSE_MAP:
            return LANDUSE_MAP[val]
    return LANDUSE_MAP["default"]


# ── Overpass 쿼리 ──────────────────────────────────────────────────────────

def build_overpass_query(bbox: tuple[float, float, float, float]) -> str:
    s, w, n, e = bbox
    bbox_str = f"{s},{w},{n},{e}"
    return f"""
[out:json][timeout:120];
(
  way["natural"="water"]({bbox_str});
  way["natural"="wood"]({bbox_str});
  way["natural"="scrub"]({bbox_str});
  way["natural"="heath"]({bbox_str});
  way["natural"="grassland"]({bbox_str});
  way["waterway"~"^(river|stream|canal)$"]({bbox_str});
  way["leisure"~"^(park|garden|nature_reserve|stadium|sports_centre|pitch|recreation_ground)$"]({bbox_str});
  way["landuse"]({bbox_str});
  way["amenity"~"^(school|university|college|hospital|clinic|kindergarten)$"]({bbox_str});
  relation["natural"="water"]({bbox_str});
  relation["leisure"="park"]({bbox_str});
  relation["landuse"]({bbox_str});
  relation["waterway"="river"]({bbox_str});
);
out body;
>;
out skel qt;
""".strip()


def fetch_overpass(query: str, retries: int = 3) -> dict:
    for attempt in range(retries):
        try:
            print(f"  [Overpass] 쿼리 전송 중... (시도 {attempt+1}/{retries})")
            resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=120)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"  [Overpass] 오류: {e}")
            if attempt < retries - 1:
                wait = 5 * (attempt + 1)
                print(f"  {wait}초 후 재시도...")
                time.sleep(wait)
    raise RuntimeError("Overpass API 요청 실패")


# ── OSM JSON → GeoJSON 변환 ────────────────────────────────────────────────

def osm_to_geojson(osm_data: dict) -> dict:
    """
    Overpass JSON → GeoJSON FeatureCollection
    way / relation (outer ring 기준) → Polygon / MultiPolygon
    """
    node_map: dict[int, tuple[float, float]] = {}
    for el in osm_data.get("elements", []):
        if el["type"] == "node":
            node_map[el["id"]] = (el["lon"], el["lat"])

    way_map: dict[int, list] = {}
    for el in osm_data.get("elements", []):
        if el["type"] == "way" and "nodes" in el:
            coords = [node_map[n] for n in el["nodes"] if n in node_map]
            if len(coords) >= 3:
                way_map[el["id"]] = coords

    features = []

    for el in osm_data.get("elements", []):
        if el["type"] == "way" and el["id"] in way_map:
            tags = el.get("tags", {})
            # 단순 highway 라인은 스킵 (area 태그 없는 도로)
            if "highway" in tags and tags.get("area") != "yes":
                continue
            coords = way_map[el["id"]]
            if coords[0] != coords[-1]:
                coords = coords + [coords[0]]
            dominant_landuse, theme_code = get_landuse_theme(tags)
            features.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [coords]},
                "properties": {
                    "osm_id": el["id"],
                    "osm_type": "way",
                    "tags": tags,
                    "dominant_landuse": dominant_landuse,
                    "theme_code": theme_code,
                    "source_layer": _source_layer(tags),
                    "name": tags.get("name", ""),
                }
            })

        elif el["type"] == "relation":
            tags = el.get("tags", {})
            members = el.get("members", [])
            outer_rings = []
            inner_rings = []
            for m in members:
                if m.get("type") == "way" and m.get("ref") in way_map:
                    ring = way_map[m["ref"]]
                    if ring[0] != ring[-1]:
                        ring = ring + [ring[0]]
                    if m.get("role") == "inner":
                        inner_rings.append(ring)
                    else:
                        outer_rings.append(ring)
            if not outer_rings:
                continue
            dominant_landuse, theme_code = get_landuse_theme(tags)
            if len(outer_rings) == 1:
                coords = [outer_rings[0]] + inner_rings
                geometry = {"type": "Polygon", "coordinates": coords}
            else:
                polys = [[ring] for ring in outer_rings]
                geometry = {"type": "MultiPolygon", "coordinates": polys}
            features.append({
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "osm_id": el["id"],
                    "osm_type": "relation",
                    "tags": tags,
                    "dominant_landuse": dominant_landuse,
                    "theme_code": theme_code,
                    "source_layer": _source_layer(tags),
                    "name": tags.get("name", ""),
                }
            })

    return {"type": "FeatureCollection", "features": features}


def _source_layer(tags: dict) -> str:
    if "waterway" in tags or tags.get("natural") == "water":
        return "osm_waterway"
    if tags.get("leisure") in ("park", "garden", "nature_reserve"):
        return "osm_park"
    if tags.get("natural") in ("wood", "scrub", "heath", "grassland"):
        return "osm_forest"
    if tags.get("landuse") == "forest":
        return "osm_forest"
    if tags.get("amenity") in ("school", "university", "college", "kindergarten"):
        return "osm_education"
    if tags.get("amenity") in ("hospital", "clinic"):
        return "osm_medical"
    if "landuse" in tags:
        return "osm_landuse"
    return "osm_feature"


# ── 메인 ──────────────────────────────────────────────────────────────────

async def fetch_features(dong_osm_id: int, force: bool = False) -> Path:
    cache_path = CACHE_DIR / f"{dong_osm_id}_features.geojson"

    if cache_path.exists() and not force:
        print(f"[INFO] 캐시 사용: {cache_path}")
        return cache_path

    async with async_session_factory() as session:
        row = await session.execute(
            text("SELECT name, boundary_geojson FROM world_area WHERE osm_id = :osm_id AND area_level = 'dong' LIMIT 1"),
            {"osm_id": dong_osm_id},
        )
        area = row.mappings().first()
        if not area:
            raise ValueError(f"dong osm_id={dong_osm_id} not found in world_area")
        dong_name = area["name"]
        boundary = area["boundary_geojson"]

    if not boundary:
        raise ValueError(f"{dong_name}: boundary_geojson 없음 — world_area 확인 필요")

    # bbox 계산
    if isinstance(boundary, str):
        boundary = json.loads(boundary)
    coords = _extract_coords(boundary)
    lats = [c[1] for c in coords]
    lngs = [c[0] for c in coords]
    bbox = (
        min(lats) - BBOX_MARGIN,
        min(lngs) - BBOX_MARGIN,
        max(lats) + BBOX_MARGIN,
        max(lngs) + BBOX_MARGIN,
    )
    print(f"[INFO] {dong_name} bbox: S={bbox[0]:.5f} W={bbox[1]:.5f} N={bbox[2]:.5f} E={bbox[3]:.5f}")

    query = build_overpass_query(bbox)
    osm_data = fetch_overpass(query)

    elements = osm_data.get("elements", [])
    print(f"[INFO] Overpass 응답: {len(elements)}개 element")

    geojson = osm_to_geojson(osm_data)
    print(f"[INFO] GeoJSON feature 변환: {len(geojson['features'])}개")

    cache_path.write_text(json.dumps(geojson, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[SAVED] {cache_path}")
    return cache_path


def _extract_coords(geojson: dict) -> list:
    t = geojson.get("type", "")
    if t == "Polygon":
        return geojson["coordinates"][0]
    if t == "MultiPolygon":
        return geojson["coordinates"][0][0]
    if t == "Feature":
        return _extract_coords(geojson["geometry"])
    if t == "FeatureCollection":
        return _extract_coords(geojson["features"][0])
    return []


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dong-osm-id", type=int, required=True)
    parser.add_argument("--force", action="store_true", help="캐시 무시하고 재수집")
    args = parser.parse_args()
    path = asyncio.run(fetch_features(args.dong_osm_id, force=args.force))
    print(f"[DONE] {path}")
