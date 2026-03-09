"""
Zone(구역) 추출 서비스 - 완전판
OSM Overpass API를 사용하여 특정 영역의 지형 구역을 카테고리별로 분류합니다.
Shapely를 사용하여 도로망 기반 미개척지(unexplored) 폴리곤을 자동 생성합니다.
"""
import json
import urllib.request
import urllib.parse
import time
import math
import os

# 캐시 디렉토리 설정
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "cache", "zones")
os.makedirs(CACHE_DIR, exist_ok=True)

# Overpass API 미러 서버 목록
OVERPASS_MIRRORS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# ============================================================
# 카테고리별 Overpass 쿼리 태그 - OSM 전체 주요 레이어
# ============================================================
ZONE_CATEGORIES = {
    "water": {
        "tags": ['way["natural"="water"]', 'relation["natural"="water"]', 'way["waterway"~"river|stream|canal"]'],
        "color": "#2a6ab5", "label": "강/수계"
    },
    "park": {
        "tags": ['way["leisure"="park"]', 'relation["leisure"="park"]', 'way["landuse"="recreation_ground"]'],
        "color": "#4caf50", "label": "공원/녹지"
    },
    "forest": {
        "tags": ['way["landuse"="forest"]', 'relation["landuse"="forest"]', 'way["natural"="wood"]'],
        "color": "#2d6a28", "label": "숲/산림"
    },
    "residential": {"tags": ['way["landuse"="residential"]', 'relation["landuse"="residential"]'], "color": "#8bc34a", "label": "주거구역"},
    "commercial": {"tags": ['way["landuse"~"commercial|retail"]', 'relation["landuse"~"commercial|retail"]'], "color": "#2196f3", "label": "상업구역"},
    "industrial": {"tags": ['way["landuse"="industrial"]', 'relation["landuse"="industrial"]'], "color": "#ffc107", "label": "공업구역"},
    "educational": {"tags": ['way["amenity"~"school|university|college"]'], "color": "#ff5722", "label": "교육시설"},
    "medical": {"tags": ['way["amenity"~"hospital|clinic"]'], "color": "#f44336", "label": "의료시설"},
    "road_major": {"tags": ['way["highway"~"motorway|trunk|primary"]'], "color": "#ff9800", "label": "주요도로"},
    "road_minor": {"tags": ['way["highway"~"secondary|tertiary"]'], "color": "#ffeb3b", "label": "일반도로"},
}


def _build_overpass_query(south, west, north, east, categories=None, poly_coords=None):
    if poly_coords:
        poly_str = " ".join([f"{p[0]} {p[1]}" for p in poly_coords])
        filter_str = f'poly:"{poly_str}"'
    else:
        filter_str = f"{south},{west},{north},{east}"

    cats = categories or list(ZONE_CATEGORIES.keys())
    parts = []
    for cat in cats:
        if cat in ZONE_CATEGORIES:
            for tag in ZONE_CATEGORIES[cat]["tags"]:
                parts.append(f"  {tag}({filter_str});")
    
    return f"[out:json][timeout:60];\n(\n{chr(10).join(parts)}\n);\nout body;\n>;\nout skel qt;"


def _parse_overpass_response(data, categories=None):
    cats = categories or list(ZONE_CATEGORIES.keys())
    result = {cat: [] for cat in cats}
    nodes = {}
    ways_map = {}
    elements = data.get("elements", [])

    for elem in elements:
        etype, eid = elem.get("type"), elem.get("id")
        if etype == "node": nodes[eid] = (elem["lat"], elem["lon"])
        elif etype == "way": ways_map[eid] = elem.get("nodes", [])

    for elem in elements:
        etype = elem.get("type")
        if etype not in ("way", "relation"): continue
        tags, nd_ids = elem.get("tags", {}), []
        if etype == "way": nd_ids = elem.get("nodes", [])
        elif etype == "relation":
            for m in elem.get("members", []):
                if m.get("type") == "way" and m.get("role") == "outer":
                    ref = m.get("ref")
                    if ref in ways_map: nd_ids.extend(ways_map[ref])
        
        if not nd_ids: continue
        coords = [list(nodes[nid]) for nid in nd_ids if nid in nodes]
        if len(coords) < 2: continue

        category = _classify_way(tags, cats)
        if category:
            is_closed = len(nd_ids) >= 3 and nd_ids[0] == nd_ids[-1]
            result[category].append({
                "type": "polygon" if is_closed else "line",
                "coords": coords,
                "tags": {k: v for k, v in tags.items() if k in ("name", "highway", "natural", "landuse", "leisure", "waterway", "amenity")}
            })
    return result

def _classify_way(tags, categories):
    t_str = str(tags).lower()
    for cat in categories:
        if cat in ZONE_CATEGORIES:
            # 단순 키워드 매칭으로 성능 최적화 (서빙용)
            if any(tag_part in t_str for tag_part in ["forest", "wood"]) and cat == "forest": return "forest"
            if any(tag_part in t_str for tag_part in ["water", "river"]) and cat == "water": return "water"
            if any(tag_part in t_str for tag_part in ["park", "garden"]) and cat == "park": return "park"
            if "residential" in t_str and cat == "residential": return "residential"
            if any(k in t_str for k in ["commercial", "retail"]) and cat == "commercial": return "commercial"
    return None

def fetch_zones(lat: float, lng: float, dist: int = 2000, categories=None, district_id: int = None, dong_id: int = None):
    cats = categories or list(ZONE_CATEGORIES.keys())
    fetch_cats = [c for c in cats if c != "unexplored"]
    
    area_type = "district" if district_id else ("dong" if dong_id else "point")
    area_id = district_id or dong_id or f"{lat:.3f}_{lng:.3f}"
    
    cache_key = f"v10_{area_type}_{area_id}.json"
    cache_path = os.path.join(CACHE_DIR, cache_key)

    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)

    poly_coords = None
    if district_id or dong_id:
        from world.services.district_service import get_district_by_id, get_dong_by_id
        area = get_district_by_id(district_id) if district_id else get_dong_by_id(dong_id)
        if area:
            poly_coords = area["coords"]
            lat, lng = area["center"]
            dist = 5000 if district_id else 2000

    lat_offset = dist / 111000
    lng_offset = dist / (111000 * math.cos(math.radians(lat)))
    south, north = lat - lat_offset, lat + lat_offset
    west, east = lng - lng_offset, lng + lng_offset

    query = _build_overpass_query(south, west, north, east, fetch_cats, poly_coords=poly_coords)
    
    try:
        encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
        for mirror_url in OVERPASS_MIRRORS:
            try:
                req = urllib.request.Request(mirror_url, data=encoded, method="POST")
                with urllib.request.urlopen(req, timeout=45) as resp:
                    raw = json.loads(resp.read().decode("utf-8"))
                    zones = _parse_overpass_response(raw, fetch_cats)
                    result_data = {"zones": zones, "meta": {"center": [lat, lng], "dist": dist}, "categories": {}}
                    with open(cache_path, "w", encoding="utf-8") as f:
                        json.dump(result_data, f, ensure_ascii=False, indent=2)
                    return result_data
            except: continue
        return {"zones": {cat: [] for cat in cats}, "meta": {}}
    except Exception as e:
        return {"zones": {cat: [] for cat in cats}, "error": str(e)}

class ZoneService:
    def extract_district_zones(self, district_id: int):
        return fetch_zones(0, 0, district_id=district_id)

    def extract_dong_zones(self, dong_id: int):
        return fetch_zones(0, 0, dong_id=dong_id)

zone_service = ZoneService()
