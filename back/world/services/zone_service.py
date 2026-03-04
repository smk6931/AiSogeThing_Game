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
# static/cache/zones 대신 cache/zones 사용 (통합 캐시 구조)
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
    # --- 물 ---
    "water": {
        "tags": [
            'way["natural"="water"]', 'relation["natural"="water"]',
            'way["waterway"="river"]', 'way["waterway"="stream"]', 'way["waterway"="canal"]',
            'way["landuse"="reservoir"]', 'relation["landuse"="reservoir"]',
        ],
        "color": "#2a6ab5", "label": "강/수계"
    },
    # --- 공원/여가 ---
    "park": {
        "tags": [
            'way["leisure"="park"]', 'relation["leisure"="park"]',
            'way["landuse"="recreation_ground"]', 'relation["landuse"="recreation_ground"]',
            'way["leisure"="garden"]', 'relation["leisure"="garden"]',
            'way["leisure"="nature_reserve"]', 'relation["leisure"="nature_reserve"]',
        ],
        "color": "#4caf50", "label": "공원/녹지"
    },
    # --- 숲/산 ---
    "forest": {
        "tags": [
            'way["landuse"="forest"]', 'relation["landuse"="forest"]',
            'way["natural"="wood"]', 'relation["natural"="wood"]',
        ],
        "color": "#2d6a28", "label": "숲/산림"
    },
    # --- 주요도로 ---
    "road_major": {
        "tags": [
            'way["highway"="motorway"]', 'way["highway"="trunk"]', 'way["highway"="primary"]',
        ],
        "color": "#ff9800", "label": "주요도로"
    },
    # --- 일반도로 ---
    "road_minor": {
        "tags": [
            'way["highway"="secondary"]', 'way["highway"="tertiary"]',
        ],
        "color": "#ffeb3b", "label": "일반도로"
    },
    # --- 주거구역 ---
    "residential": {
        "tags": [
            'way["landuse"="residential"]', 'relation["landuse"="residential"]',
        ],
        "color": "#8bc34a", "label": "주거구역"
    },
    # --- 상업구역 ---
    "commercial": {
        "tags": [
            'way["landuse"="commercial"]', 'relation["landuse"="commercial"]',
            'way["landuse"="retail"]', 'relation["landuse"="retail"]',
        ],
        "color": "#2196f3", "label": "상업구역"
    },
    # --- 공업구역 ---
    "industrial": {
        "tags": [
            'way["landuse"="industrial"]', 'relation["landuse"="industrial"]',
            'way["landuse"="brownfield"]', 'relation["landuse"="brownfield"]',
            'way["landuse"="construction"]', 'relation["landuse"="construction"]',
        ],
        "color": "#ffc107", "label": "공업구역"
    },
    # --- 공공기관 ---
    "institutional": {
        "tags": [
            'way["landuse"="institutional"]', 'relation["landuse"="institutional"]',
        ],
        "color": "#9c27b0", "label": "공공기관"
    },
    # --- 교육시설 ---
    "educational": {
        "tags": [
            'way["amenity"="school"]', 'relation["amenity"="school"]',
            'way["amenity"="university"]', 'relation["amenity"="university"]',
            'way["amenity"="college"]', 'relation["amenity"="college"]',
            'way["amenity"="kindergarten"]', 'relation["amenity"="kindergarten"]',
            'way["landuse"="education"]', 'relation["landuse"="education"]',
        ],
        "color": "#ff5722", "label": "교육시설"
    },
    # --- 의료시설 ---
    "medical": {
        "tags": [
            'way["amenity"="hospital"]', 'relation["amenity"="hospital"]',
            'way["amenity"="clinic"]', 'relation["amenity"="clinic"]',
            'way["landuse"="medical"]', 'relation["landuse"="medical"]',
        ],
        "color": "#f44336", "label": "의료시설"
    },
    # --- 주차장 ---
    "parking": {
        "tags": [
            'way["amenity"="parking"]', 'relation["amenity"="parking"]',
        ],
        "color": "#9e9e9e", "label": "주차장"
    },
    # --- 비개발 자연지 ---
    "natural_site": {
        "tags": [
            'way["natural"~"scrub|grassland|heath|bare_rock|scree|beach|sand|mud"]',
            'relation["natural"~"scrub|grassland|heath|bare_rock|scree|beach|sand|mud"]',
            'way["landuse"~"grass|meadow|farmland|orchard|vineyard|allotments|greenfield"]',
            'relation["landuse"~"grass|meadow|farmland|orchard|vineyard|allotments|greenfield"]',
        ],
        "color": "#c5e1a5", "label": "비개발/자연지"
    },
    # --- 군사시설 ---
    "military": {
        "tags": [
            'way["landuse"="military"]', 'relation["landuse"="military"]',
            'way["military"~"base|barracks|training_area|danger_area"]',
            'relation["military"~"base|barracks|training_area"]',
        ],
        "color": "#795548", "label": "군사시설"
    },
    # --- 종교시설 ---
    "religious": {
        "tags": [
            'way["amenity"="place_of_worship"]', 'relation["amenity"="place_of_worship"]',
            'way["landuse"="religious"]', 'relation["landuse"="religious"]',
        ],
        "color": "#e91e63", "label": "종교시설"
    },
    # --- 스포츠/여가시설 ---
    "sports": {
        "tags": [
            'way["leisure"="sports_centre"]', 'relation["leisure"="sports_centre"]',
            'way["leisure"="stadium"]', 'relation["leisure"="stadium"]',
            'way["leisure"="golf_course"]', 'relation["leisure"="golf_course"]',
            'way["leisure"="pitch"]', 'relation["leisure"="pitch"]',
            'way["leisure"="swimming_pool"]', 'relation["leisure"="swimming_pool"]',
            'way["leisure"="track"]', 'relation["leisure"="track"]',
        ],
        "color": "#00bcd4", "label": "스포츠시설"
    },
    # --- 공동묘지 ---
    "cemetery": {
        "tags": [
            'way["landuse"="cemetery"]', 'relation["landuse"="cemetery"]',
            'way["amenity"="grave_yard"]', 'relation["amenity"="grave_yard"]',
        ],
        "color": "#607d8b", "label": "공동묘지"
    },
    # --- 교통인프라 (공항/철도부지) ---
    "transport": {
        "tags": [
            'way["aeroway"~"aerodrome|runway|taxiway|apron"]',
            'relation["aeroway"~"aerodrome"]',
            'way["landuse"="railway"]', 'relation["landuse"="railway"]',
        ],
        "color": "#455a64", "label": "교통시설"
    },
    # --- 항구/부두 ---
    "port": {
        "tags": [
            'way["landuse"="port"]', 'relation["landuse"="port"]',
            'way["industrial"="port"]', 'relation["industrial"="port"]',
        ],
        "color": "#1a237e", "label": "항구/부두"
    },
}


def _build_overpass_query(south, west, north, east, categories=None):
    bbox = f"{south},{west},{north},{east}"
    cats = categories or list(ZONE_CATEGORIES.keys())
    parts = []
    for cat in cats:
        if cat not in ZONE_CATEGORIES:
            continue
        for tag in ZONE_CATEGORIES[cat]["tags"]:
            parts.append(f"  {tag}({bbox});")
    query = f"""
[out:json][timeout:60];
(
{chr(10).join(parts)}
);
out body;
>;
out skel qt;
"""
    return query


def _parse_overpass_response(data, categories=None):
    cats = categories or list(ZONE_CATEGORIES.keys())
    result = {cat: [] for cat in cats}

    nodes = {}
    ways_map = {}
    elements = data.get("elements", [])

    # 1. 노드와 웨이 정보를 먼저 매핑
    for elem in elements:
        etype = elem.get("type")
        eid = elem.get("id")
        if etype == "node":
            nodes[eid] = (elem["lat"], elem["lon"])
        elif etype == "way":
            ways_map[eid] = elem.get("nodes", [])

    # 2. 구역(Way, Relation) 처리
    for elem in elements:
        etype = elem.get("type")
        if etype not in ("way", "relation"):
            continue

        tags = elem.get("tags", {})
        nd_ids = []

        if etype == "way":
            nd_ids = elem.get("nodes", [])
        elif etype == "relation":
            # Multipolygon 등 관계 데이터: outer 역할을 하는 way들의 노드를 합침
            for member in elem.get("members", []):
                if member.get("type") == "way" and member.get("role") == "outer":
                    ref = member.get("ref")
                    if ref in ways_map:
                        # 이미 닫힌 루프 형태면 마지막 중복 노드 제거 후 합침 (간이 처리)
                        w_nodes = ways_map[ref]
                        if nd_ids and w_nodes and nd_ids[-1] == w_nodes[0]:
                            nd_ids.extend(w_nodes[1:])
                        else:
                            nd_ids.extend(w_nodes)

        if not nd_ids:
            continue

        coords = []
        for nid in nd_ids:
            if nid in nodes:
                coords.append(list(nodes[nid]))

        if len(coords) < 2:
            continue

        category = _classify_way(tags, cats)
        if category:
            # OSM 노드 ID 기반으로 닫혀 있는지 확인 (가장 정확함)
            is_closed = len(nd_ids) >= 3 and nd_ids[0] == nd_ids[-1]
            
            feature = {
                "type": "polygon" if is_closed else "line",
                "coords": coords,
                "tags": {k: v for k, v in tags.items() if k in ("name", "highway", "natural", "landuse", "leisure", "waterway", "amenity", "military", "aeroway", "industrial")}
            }
            result[category].append(feature)

    return result


def _classify_way(tags, categories):
    """태그 기반 카테고리 분류 — 우선순위 높은 것부터"""
    highway = tags.get("highway", "")
    natural = tags.get("natural", "")
    landuse = tags.get("landuse", "")
    leisure = tags.get("leisure", "")
    waterway = tags.get("waterway", "")
    amenity = tags.get("amenity", "")
    military = tags.get("military", "")
    aeroway = tags.get("aeroway", "")
    industrial = tags.get("industrial", "")

    if "water" in categories:
        if natural == "water" or waterway in ("river", "stream", "canal") or landuse == "reservoir":
            return "water"
    if "park" in categories:
        if leisure in ("park", "garden", "nature_reserve") or landuse == "recreation_ground":
            return "park"
    if "forest" in categories:
        if landuse == "forest" or natural == "wood":
            return "forest"
    if "road_major" in categories:
        if highway in ("motorway", "trunk", "primary"):
            return "road_major"
    if "road_minor" in categories:
        if highway in ("secondary", "tertiary"):
            return "road_minor"
    if "military" in categories:
        if landuse == "military" or military in ("base", "barracks", "training_area", "danger_area"):
            return "military"
    if "transport" in categories:
        if aeroway in ("aerodrome", "runway", "taxiway", "apron") or landuse == "railway":
            return "transport"
    if "port" in categories:
        if landuse == "port" or industrial == "port":
            return "port"
    if "residential" in categories and landuse == "residential":
        return "residential"
    if "commercial" in categories and landuse in ("commercial", "retail"):
        return "commercial"
    if "industrial" in categories and landuse in ("industrial", "brownfield", "construction"):
        return "industrial"
    if "institutional" in categories and landuse == "institutional":
        return "institutional"
    if "educational" in categories and (amenity in ("school", "university", "college", "kindergarten") or landuse == "education"):
        return "educational"
    if "medical" in categories and (amenity in ("hospital", "clinic") or landuse == "medical"):
        return "medical"
    if "religious" in categories and (amenity == "place_of_worship" or landuse == "religious"):
        return "religious"
    if "sports" in categories and leisure in ("sports_centre", "stadium", "golf_course", "pitch", "swimming_pool", "track"):
        return "sports"
    if "cemetery" in categories and (landuse == "cemetery" or amenity == "grave_yard"):
        return "cemetery"
    if "parking" in categories and amenity == "parking":
        return "parking"
    if "natural_site" in categories:
        if natural in ("scrub", "grassland", "heath", "bare_rock", "scree", "beach", "sand", "mud") or \
           landuse in ("grass", "meadow", "farmland", "orchard", "vineyard", "allotments", "greenfield"):
            return "natural_site"
    return None


# ============================================================
# 미개척 지형 자동 계산 (Shapely 도로망 폴리곤화)
# ============================================================
def compute_unexplored_zones(lat: float, lng: float, dist: int, existing_zones: dict):
    """
    도로망으로 생성되는 격자 폴리곤 중, 기존 레이어로 채워지지 않은 영역을
    Shapely로 계산하여 '미개척 지형' 폴리곤 리스트를 반환합니다.
    """
    try:
        from shapely.geometry import LineString, Polygon, MultiPolygon, box
        from shapely.ops import unary_union, polygonize, linemerge
        from shapely.validation import make_valid

        LAT_TO_M = 111000.0
        LNG_TO_M = 111000.0 * math.cos(math.radians(lat))

        def gps_to_xy(lat_p, lng_p):
            return ((lng_p - lng) * LNG_TO_M, (lat_p - lat) * LAT_TO_M)

        def xy_to_gps(x, y):
            return [lat + y / LAT_TO_M, lng + x / LNG_TO_M]

        # 1. 바운딩박스 경계선 (도로와 합쳐 폴리곤화)
        half = dist * 0.98
        bbox_poly = box(-half, -half, half, half)

        # 2. 기존 모든 레이어의 폴리곤을 Shapely로 변환 → 합집합
        existing_shapes = []
        for cat, features in existing_zones.items():
            if cat in ("road_major", "road_minor"):
                continue  # 도로는 선(line)이라 면적 없음, 제외
            for f in features:
                if f.get("type") != "polygon" or len(f.get("coords", [])) < 3:
                    continue
                try:
                    pts = [gps_to_xy(c[0], c[1]) for c in f["coords"]]
                    poly = Polygon(pts)
                    if poly.is_valid:
                        existing_shapes.append(poly)
                    else:
                        existing_shapes.append(make_valid(poly))
                except Exception:
                    pass

        existing_union = unary_union(existing_shapes) if existing_shapes else Polygon()

        # 3. 도로 라인들을 LineString으로 변환
        road_lines = []
        for cat in ("road_major", "road_minor"):
            for f in existing_zones.get(cat, []):
                coords = f.get("coords", [])
                if len(coords) < 2:
                    continue
                try:
                    pts = [gps_to_xy(c[0], c[1]) for c in coords]
                    road_lines.append(LineString(pts))
                except Exception:
                    pass

        # 경계선도 라인으로 추가
        bx, by = bbox_poly.exterior.xy
        boundary_line = LineString(list(zip(bx, by)))
        road_lines.append(boundary_line)

        if not road_lines:
            return []

        # 4. 도로 라인망 폴리곤화
        merged = linemerge(road_lines)
        cells = list(polygonize(merged))

        if not cells:
            # 도로만으로 폴리곤화가 안 될 경우, bbox 전체에서 기존 레이어를 뺀 영역 반환
            remainder = bbox_poly.difference(existing_union)
            cells = [remainder] if not remainder.is_empty else []

        # 5. 각 도로 격자 폴리곤에서 기존 레이어 영역 제거
        unexplored = []
        min_area = 50 * 50  # 최소 50m x 50m = 2500m² 미만 무시 (너무 작은 잡음 제거)

        for cell in cells:
            try:
                if not bbox_poly.intersects(cell):
                    continue
                clipped = cell.intersection(bbox_poly)
                gap = clipped.difference(existing_union)

                if gap.is_empty or gap.area < min_area:
                    continue

                # MultiPolygon 처리
                geoms = gap.geoms if hasattr(gap, 'geoms') else [gap]
                for g in geoms:
                    if g.is_empty or g.area < min_area:
                        continue
                    ext_pts = list(g.exterior.coords)
                    coords_gps = [xy_to_gps(x, y) for x, y in ext_pts]
                    unexplored.append({
                        "type": "polygon",
                        "coords": coords_gps,
                        "tags": {}
                    })
            except Exception:
                continue

        print(f"[ZoneService] 미개척 지형 {len(unexplored)}개 폴리곤 계산 완료")
        return unexplored

    except ImportError:
        print("[ZoneService] Shapely 미설치 — 미개척 지형 계산 불가")
        return []
    except Exception as e:
        print(f"[ZoneService] 미개척 지형 계산 오류: {e}")
        return []


def fetch_zones(lat: float, lng: float, dist: int = 2000, categories=None):
    if isinstance(categories, str):
        cats = [c.strip() for c in categories.split(",") if c.strip()]
    else:
        cats = categories or list(ZONE_CATEGORIES.keys())

    # 'unexplored' 는 OSM 요청 대상이 아니므로 분리
    fetch_cats = [c for c in cats if c != "unexplored"]

    cat_str = "_".join(sorted(fetch_cats)) if fetch_cats else "all"
    cache_key = f"v8_z{dist}_lat{lat:.3f}_lng{lng:.3f}_{cat_str}.json"
    cache_path = os.path.join(CACHE_DIR, cache_key)

    if os.path.exists(cache_path):
        mtime = os.path.getmtime(cache_path)
        if time.time() - mtime < 86400:
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                print(f"[ZoneService] 캐시 사용: {cache_key}")
                return cached_data
            except:
                pass

    lat_offset = dist / 111000
    lng_offset = dist / (111000 * math.cos(math.radians(lat)))
    south = lat - lat_offset
    north = lat + lat_offset
    west = lng - lng_offset
    east = lng + lng_offset

    print(f"[ZoneService] 구역 데이터 추출: ({lat:.4f}, {lng:.4f}), 반경 {dist}m")
    query = _build_overpass_query(south, west, north, east, fetch_cats)

    try:
        encoded = urllib.parse.urlencode({"data": query}).encode("utf-8")
        raw = None
        last_error = None

        for mirror_url in OVERPASS_MIRRORS:
            try:
                print(f"[ZoneService] 미러 시도: {mirror_url}")
                req = urllib.request.Request(mirror_url, data=encoded, method="POST")
                req.add_header("Content-Type", "application/x-www-form-urlencoded")
                req.add_header("User-Agent", "AiSogeThing/1.0")
                start = time.time()
                with urllib.request.urlopen(req, timeout=30) as resp:
                    raw = json.loads(resp.read().decode("utf-8"))
                print(f"[ZoneService] 성공! ({time.time()-start:.1f}초)")
                break
            except Exception as mirror_err:
                last_error = mirror_err
                print(f"[ZoneService] {mirror_url} 실패: {mirror_err}")
                continue

        if raw is None:
            raise Exception(f"모든 미러 실패: {last_error}")

        zones = _parse_overpass_response(raw, fetch_cats)

        total_features = sum(len(v) for v in zones.values())
        print(f"[ZoneService] 추출 완료: {total_features}개 피처")
        for cat, features in zones.items():
            if features:
                print(f"  - {cat}: {len(features)}개")

        cat_meta = {}
        for cat in fetch_cats:
            if cat in ZONE_CATEGORIES:
                cat_meta[cat] = {"color": ZONE_CATEGORIES[cat]["color"], "label": ZONE_CATEGORIES[cat]["label"]}

        # 미개척 지형 계산 (요청에 'unexplored' 포함된 경우)
        if "unexplored" in (categories or []):
            unexplored_features = compute_unexplored_zones(lat, lng, dist, zones)
            zones["unexplored"] = unexplored_features
            cat_meta["unexplored"] = {"color": "#4a3728", "label": "미개척 지형"}

        result_data = {
            "zones": zones,
            "meta": {"center": [lat, lng], "dist": dist, "bbox": [south, west, north, east]},
            "categories": cat_meta
        }

        try:
            with open(cache_path, "w", encoding="utf-8") as f:
                json.dump(result_data, f, ensure_ascii=False, indent=2)
            print(f"[ZoneService] 캐시 저장: {cache_key}")
        except Exception as e:
            print(f"[ZoneService] 캐시 저장 실패: {e}")

        return result_data

    except Exception as e:
        print(f"[ZoneService] Overpass API 오류: {e}")
        return {
            "zones": {cat: [] for cat in cats},
            "meta": {"center": [lat, lng], "dist": dist, "bbox": [south, west, north, east]},
            "categories": {},
            "error": str(e)
        }
