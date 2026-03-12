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

from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString
from shapely.ops import polygonize, unary_union

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
    "road_minor": {"tags": ['way["highway"~"secondary|tertiary|residential|service|unclassified"]'], "color": "#ffeb3b", "label": "일반도로"},
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
            if any(k in t_str for k in ["forest", "wood"]) and cat == "forest": return "forest"
            if any(k in t_str for k in ["water", "river", "stream", "canal", "lake"]) and cat == "water": return "water"
            if any(k in t_str for k in ["park", "garden", "leisure"]) and cat == "park": return "park"
            if any(k in t_str for k in ["residential", "apartments", "house"]) and cat == "residential": return "residential"
            if any(k in t_str for k in ["commercial", "retail", "marketplace", "office"]) and cat == "commercial": return "commercial"
            if any(k in t_str for k in ["industrial", "factory", "works"]) and cat == "industrial": return "industrial"
            if any(k in t_str for k in ["school", "university", "college", "kindergarten"]) and cat == "educational": return "educational"
            if any(k in t_str for k in ["hospital", "clinic", "doctors", "pharmacy"]) and cat == "medical": return "medical"
            if any(k in t_str for k in ["parking", "garage"]) and cat == "parking": return "parking"
            if "highway" in t_str:
                if any(k in t_str for k in ["motorway", "trunk", "primary"]) and cat == "road_major": return "road_major"
                if any(k in t_str for k in ["secondary", "tertiary", "residential", "service", "unclassified"]) and cat == "road_minor": return "road_minor"
    return None

def _generate_sector_blocks(zones, area_poly_coords):
    """
    도로가 감싸는 안쪽 면적들을 잘게 쪼개서 '섹터(Sectors)'를 생성합니다.
    기존 용도구역(공원, 주거지 등)과 겹치지 않는 순수 빈 땅 영역만 추출합니다.
    """
    if not area_poly_coords: return []
    try:
        dong_poly = Polygon(area_poly_coords)
        if not dong_poly.is_valid: dong_poly = dong_poly.buffer(0)

        # 1. 분할용 칼(도로망) 수집
        roads = zones.get("road_major", []) + zones.get("road_minor", [])
        road_lines = []
        for r in roads:
            if r["type"] == "line" and len(r["coords"]) >= 2:
                road_lines.append(LineString(r["coords"]))
        
        # 도로망이 없으면 그냥 동 전체
        if not road_lines:
            all_lines = dong_poly.exterior
        else:
            # 동 경계선 + 도로망 결합 (unary_union으로 선들이 서로 교차되는 지점을 인식하게 함)
            all_lines = unary_union(road_lines + [dong_poly.exterior])
        
        # 선들로 이루어진 면(Blocks) 추출
        blocks = list(polygonize(all_lines))
        
        # 2. 이미 정의된 구역(water, park, resi 등)의 합집합 생성 (오려낼 영역)
        filled_polys = []
        for cat, features in zones.items():
            if cat in ["road_major", "road_minor", "sectors"]: continue
            for f in features:
                if f["type"] == "polygon" and len(f["coords"]) >= 3:
                    p = Polygon(f["coords"])
                    if p.is_valid: filled_polys.append(p)
        
        filled_union = unary_union(filled_polys) if filled_polys else None

        # 3. 각 도로 블록에서 기존 구역을 뺀 '순수 섹터' 생성
        sector_features = []
        for block in blocks:
            if not block.is_valid: block = block.buffer(0)
            if not dong_poly.intersects(block): continue
            
            # 동 안쪽 영역만 타겟
            target_part = block.intersection(dong_poly)
            if target_part.is_empty: continue

            # 기존 구역(공원 등) 오려내기
            if filled_union and target_part.intersects(filled_union):
                diff = target_part.difference(filled_union)
            else:
                diff = target_part

            # 결과 처리 (Polygon 또는 MultiPolygon)
            final_polys = []
            if isinstance(diff, Polygon): final_polys = [diff]
            elif hasattr(diff, 'geoms'): final_polys = list(diff.geoms)
            else: continue

            for p in final_polys:
                if p.area > 0.00000001: # 약 1제곱미터 이상의 의미 있는 조각만 수용
                    coords = [[lat, lng] for lat, lng in p.exterior.coords]
                    sector_features.append({
                        "type": "polygon",
                        "coords": coords,
                        "tags": {"name": "Sector Plot"}
                    })
        return sector_features
    except Exception as e:
        print(f"[ZoneService] Error generating sectors: {e}")
        return []

def fetch_zones(lat: float, lng: float, dist: int = 2000, categories=None, district_id: int = None, dong_id: int = None):
    cats = categories or list(ZONE_CATEGORIES.keys())
    fetch_cats = [c for c in cats if c != "sectors"]
    
    area_type = "district" if district_id else ("dong" if dong_id else "point")
    area_id = district_id or dong_id or f"{lat:.3f}_{lng:.3f}"
    
    cache_key = f"v13_{area_type}_{area_id}.json" # 버전업 (v13)
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
                    
                    # [핵심] 도로 기반 섹터 자동 생성 (빈틈 메우기)
                    if poly_coords:
                        zones["sectors"] = _generate_sector_blocks(zones, poly_coords)
                    
                    result_data = {"zones": zones, "meta": {"center": [lat, lng], "dist": dist}, "categories": {}}
                    with open(cache_path, "w", encoding="utf-8") as f:
                        json.dump(result_data, f, ensure_ascii=False, indent=2)
                    return result_data
            except Exception as e: 
                print(f"Overpass Mirror Error: {e}")
                continue
        return {"zones": {cat: [] for cat in cats}, "meta": {}}
    except Exception as e:
        return {"zones": {cat: [] for cat in cats}, "error": str(e)}

class ZoneService:
    def extract_district_zones(self, district_id: int):
        return fetch_zones(0, 0, district_id=district_id)

    def extract_dong_zones(self, dong_id: int):
        return fetch_zones(0, 0, dong_id=dong_id)

zone_service = ZoneService()
