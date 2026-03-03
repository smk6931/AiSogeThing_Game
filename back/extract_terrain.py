"""
서울 노량진~여의도 구간 지형 데이터 추출 스크립트
- osmnx로 도로, 하천, 육지 구역을 뽑아 JSON으로 저장
- Three.js에서 바로 ShapeGeometry로 렌더링할 수 있는 좌표 형식
"""
import json
import os
import math
import osmnx as ox

# ==============================================================
# 설정값
# ==============================================================

# 중심 기준점 (노량진로 6가길 18)
ORIGIN_LAT = 37.5124
ORIGIN_LNG = 126.9392

# 위경도 → 게임 좌표 변환 상수 (서울 37.5도 기준)
LAT_TO_M = 110940
LNG_TO_M = 88200

# 추출 반경 (단위: km)
RADIUS_KM = 3.0

# 저장 경로
OUTPUT_PATH = r"c:\GitHub\AiSogeThing\front\public\seoul_terrain.json"


# ==============================================================
# 좌표 변환
# ==============================================================
def gps_to_game(lat, lng):
    """GPS → Three.js 게임 좌표 (x, z)"""
    x = (lng - ORIGIN_LNG) * LNG_TO_M
    z = (ORIGIN_LAT - lat) * LAT_TO_M
    return x, z


def polygon_to_game_coords(polygon):
    """Shapely Polygon → (x, z) 리스트"""
    if polygon is None:
        return []
    coords = list(polygon.exterior.coords)
    return [[gps_to_game(lat, lng)[0], gps_to_game(lat, lng)[1]] for lng, lat in coords]


def linestring_to_game_coords(line):
    """Shapely LineString → (x, z) 리스트"""
    if line is None:
        return []
    coords = list(line.coords)
    return [[gps_to_game(lat, lng)[0], gps_to_game(lat, lng)[1]] for lng, lat in coords]


# ==============================================================
# 메인 추출 로직
# ==============================================================
def extract_terrain():
    center = (ORIGIN_LAT, ORIGIN_LNG)
    dist = int(RADIUS_KM * 1000)
    
    result = {
        "origin": {"lat": ORIGIN_LAT, "lng": ORIGIN_LNG},
        "radius_m": dist,
        "layers": {
            "water": [],       # 강, 호수 (파란색)
            "forest": [],      # 숲, 공원 (진한 초록)
            "grass": [],       # 초원, 잔디 (연한 초록)
            "roads": [],       # 도로 (선)
        }
    }

    print(f"[1/4] 하천/수역 데이터 추출 중...")
    try:
        water_tags = {"natural": ["water", "wetland"], "waterway": ["river", "stream", "canal"]}
        water_gdf = ox.features_from_point(center, tags=water_tags, dist=dist)
        for _, row in water_gdf.iterrows():
            geom = row.geometry
            if geom.geom_type == "Polygon":
                coords = polygon_to_game_coords(geom)
                if coords:
                    result["layers"]["water"].append({"type": "polygon", "coords": coords})
            elif geom.geom_type == "MultiPolygon":
                for part in geom.geoms:
                    coords = polygon_to_game_coords(part)
                    if coords:
                        result["layers"]["water"].append({"type": "polygon", "coords": coords})
            elif geom.geom_type in ("LineString", "MultiLineString"):
                lines = [geom] if geom.geom_type == "LineString" else list(geom.geoms)
                for line in lines:
                    coords = linestring_to_game_coords(line)
                    if coords:
                        result["layers"]["water"].append({"type": "line", "width": 20, "coords": coords})
        print(f"  하천/수역: {len(result['layers']['water'])}개 피처")
    except Exception as e:
        print(f"  ⚠ 하천 추출 실패: {e}")

    print("[2/4] 숲/공원 데이터 추출 중...")
    try:
        forest_tags = {"landuse": ["forest", "recreation_ground"], "leisure": ["park", "nature_reserve"], "natural": ["wood"]}
        forest_gdf = ox.features_from_point(center, tags=forest_tags, dist=dist)
        for _, row in forest_gdf.iterrows():
            geom = row.geometry
            if geom.geom_type == "Polygon":
                coords = polygon_to_game_coords(geom)
                if coords:
                    result["layers"]["forest"].append({"type": "polygon", "coords": coords})
            elif geom.geom_type == "MultiPolygon":
                for part in geom.geoms:
                    coords = polygon_to_game_coords(part)
                    if coords:
                        result["layers"]["forest"].append({"type": "polygon", "coords": coords})
        print(f"  숲/공원: {len(result['layers']['forest'])}개 피처")
    except Exception as e:
        print(f"  ⚠ 숲 추출 실패: {e}")

    print("[3/4] 초원/잔디 데이터 추출 중...")
    try:
        grass_tags = {"landuse": ["grass", "meadow", "farmland"], "natural": ["grassland", "scrub"]}
        grass_gdf = ox.features_from_point(center, tags=grass_tags, dist=dist)
        for _, row in grass_gdf.iterrows():
            geom = row.geometry
            if geom.geom_type == "Polygon":
                coords = polygon_to_game_coords(geom)
                if coords:
                    result["layers"]["grass"].append({"type": "polygon", "coords": coords})
        print(f"  초원: {len(result['layers']['grass'])}개 피처")
    except Exception as e:
        print(f"  ⚠ 초원 추출 실패: {e}")

    print("[4/4] 도로 데이터 추출 중...")
    try:
        # 도로는 그래프(G) 형태로 가져옴
        G = ox.graph_from_point(center, dist=dist, network_type="all")
        edges = ox.graph_to_gdfs(G, nodes=False)
        
        road_width_map = {
            "motorway": 30, "trunk": 25, "primary": 20,
            "secondary": 15, "tertiary": 10, "residential": 7,
            "footway": 3, "path": 2,
        }
        
        done = 0
        for _, row in edges.iterrows():
            geom = row.geometry
            if geom is None:
                continue
            hw = row.get("highway", "residential")
            if isinstance(hw, list):
                hw = hw[0]
            width = road_width_map.get(hw, 5)
            
            lines = [geom] if geom.geom_type == "LineString" else list(geom.geoms)
            for line in lines:
                coords = linestring_to_game_coords(line)
                if coords:
                    result["layers"]["roads"].append({
                        "type": "line",
                        "highway": hw,
                        "width": width,
                        "coords": coords
                    })
                    done += 1
        print(f"  도로: {done}개 세그먼트")
    except Exception as e:
        print(f"  ⚠ 도로 추출 실패: {e}")

    # 저장
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n✅ 저장 완료: {OUTPUT_PATH}")
    print(f"   파일 크기: {size_kb:.1f} KB")
    print(f"   - 수역: {len(result['layers']['water'])}개")
    print(f"   - 숲:   {len(result['layers']['forest'])}개")
    print(f"   - 초원: {len(result['layers']['grass'])}개")
    print(f"   - 도로: {len(result['layers']['roads'])}개")
    return result


if __name__ == "__main__":
    extract_terrain()
