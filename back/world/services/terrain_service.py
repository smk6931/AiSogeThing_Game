import osmnx as ox
import json
import math
import time
import urllib.request
import urllib.parse
from shapely.geometry import Polygon, LineString, MultiPolygon, MultiLineString
import os
import concurrent.futures

# osmnx 캐시 설정 (라이브러리 원본 데이터는 raw 폴더로 격리)
ox.settings.use_cache = True
ox.settings.cache_folder = os.path.join(os.path.dirname(__file__), "..", "..", "cache", "raw")

class TerrainService:
    def __init__(self):
        # 기준점 (서울 노량진 근처)
        self.origin_lat = 37.5124
        self.origin_lng = 126.9392
        
        # 위경도 → 미터 변환 상수 (서울 37.5도 기준)
        self.LAT_TO_M = 110940
        self.LNG_TO_M = 88200

    def gps_to_game(self, lat, lng, ref_lat, ref_lng):
        """GPS → 게임 좌표 (x, z) - 타일 기준점(ref) 대비 상대 좌표"""
        x = (lng - ref_lng) * self.LNG_TO_M
        z = (ref_lat - lat) * self.LAT_TO_M
        return x, z

    def extract_area_terrain(self, lat: float, lng: float, dist: int = 500):
        """
        특정 좌표(lat, lng) 중심, 반경(dist) 미터 내의 지형 데이터를 실시간 추출
        """
        center = (lat, lng)
        
        # 격자 크기 (성능을 위해 16x16 정도로 제한)
        grid_size = 16
        
        result = {
            "center": {"lat": lat, "lng": lng},
            "dist": dist,
            "grid_size": grid_size,
            "layers": {
                "water": [],
                "forest": [],
                "grass": [],
                "roads": [],
            },
            "heightmap": None
        }

        # 고도 데이터 추출은 현재 전역 HeightMap을 사용하므로 생략
        result["heightmap"] = None

        # [병렬화 적용 가능하지만 실시간 area 추출은 거리(dist)가 작으므로 순차 처리 유지하거나 추후 병렬화]
        try:
            water_tags = {"natural": ["water", "wetland"], "waterway": ["river", "stream", "canal"]}
            water_gdf = ox.features_from_point(center, tags=water_tags, dist=dist)
            if not water_gdf.empty:
                for _, row in water_gdf.iterrows():
                    geom = row.geometry
                    if geom.geom_type == "Polygon":
                        coords = self._polygon_to_list(geom, lat, lng)
                        result["layers"]["water"].append({"type": "polygon", "coords": coords})
                    elif geom.geom_type == "MultiPolygon":
                        for part in geom.geoms:
                            coords = self._polygon_to_list(part, lat, lng)
                            result["layers"]["water"].append({"type": "polygon", "coords": coords})
                    elif geom.geom_type in ("LineString", "MultiLineString"):
                        lines = [geom] if geom.geom_type == "LineString" else list(geom.geoms)
                        for line in lines:
                            coords = self._line_to_list(line, lat, lng)
                            result["layers"]["water"].append({"type": "line", "width": 20, "coords": coords})
        except Exception as e:
            print(f"[TerrainService] Water Layer Error: {e}")

        try:
            forest_tags = {"landuse": ["forest", "recreation_ground"], "leisure": ["park", "nature_reserve"], "natural": ["wood"]}
            forest_gdf = ox.features_from_point(center, tags=forest_tags, dist=dist)
            if not forest_gdf.empty:
                for _, row in forest_gdf.iterrows():
                    geom = row.geometry
                    if geom.geom_type == "Polygon":
                        coords = self._polygon_to_list(geom, lat, lng)
                        result["layers"]["forest"].append({"type": "polygon", "coords": coords})
                    elif geom.geom_type == "MultiPolygon":
                        for part in geom.geoms:
                            coords = self._polygon_to_list(part, lat, lng)
                            result["layers"]["forest"].append({"type": "polygon", "coords": coords})
        except Exception as e:
            print(f"[TerrainService] Forest Layer Error: {e}")

        try:
            G = ox.graph_from_point(center, dist=dist, network_type="all")
            edges = ox.graph_to_gdfs(G, nodes=False)
            major_hw = ["motorway", "trunk", "primary", "secondary", "tertiary", "residential"]
            if not edges.empty:
                for _, row in edges.iterrows():
                    geom = row.geometry
                    hw = row.get("highway", "residential")
                    if isinstance(hw, list): hw = hw[0]
                    if hw not in major_hw: continue
                    bridge = row.get("bridge", "no")
                    if isinstance(bridge, list): bridge = bridge[0]
                    lines = [geom] if geom.geom_type == "LineString" else (list(geom.geoms) if geom.geom_type == "MultiLineString" else [])
                    for line in lines:
                        coords = self._line_to_list(line, lat, lng)
                        result["layers"]["roads"].append({
                            "type": "line",
                            "highway": hw,
                            "bridge": bridge,
                            "coords": coords
                        })
        except Exception as e:
            print(f"[TerrainService] Road Layer Error: {e}")

        return self._deep_sanitize(result)

    def _deep_sanitize(self, obj):
        if isinstance(obj, dict):
            return {k: self._deep_sanitize(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._deep_sanitize(v) for v in obj]
        elif isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return 0.0
            return obj
        return obj

    def extract_district_terrain(self, district_id: int):
        from world.services.district_service import get_district_by_id
        district = get_district_by_id(district_id)
        if not district: return None
        return self._extract_boundary_terrain(district, "district")

    def extract_dong_terrain(self, dong_id: int):
        from world.services.district_service import get_dong_by_id
        dong = get_dong_by_id(dong_id)
        if not dong: return None
        return self._extract_boundary_terrain(dong, "dong")

    def _extract_boundary_terrain(self, area_data, area_type):
        area_id = area_data["id"]
        area_name = area_data["name"]
        cache_dir = os.path.join(os.path.dirname(__file__), "..", "..", "cache", f"terrain_{area_type}s")
        os.makedirs(cache_dir, exist_ok=True)
        cache_path = os.path.join(cache_dir, f"terrain_{area_type}_{area_id}.json")

        if os.path.exists(cache_path):
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)

        print(f"[TerrainService] '{area_name}' {area_type} 지형 데이터 병렬 추출 시작...")
        poly = Polygon([(lng, lat) for lat, lng in area_data["coords"]])
        ref_lat, ref_lng = area_data["center"]
        
        result = {
            "name": area_name,
            "type": area_type,
            "id": area_id,
            "center": {"lat": ref_lat, "lng": ref_lng},
            "layers": {"water": [], "forest": [], "grass": [], "roads": []}
        }

        # [핵심 리팩토링] 지형 기하구조를 현재 구/동 경계(poly) 면적으로 칼같이 잘라내는(Intersection) 헬퍼
        def _clip_geom(geom, is_polygon=True):
            items = []
            try:
                if not geom.is_valid:
                    geom = geom.buffer(0)
                
                # 교집합 연산 (경계 밖은 버려지고, 안쪽 면적만 추출)
                clipped = geom.intersection(poly)
                if clipped.is_empty:
                    return items

                # 잘려나간 조각들을 프론트에서 랜더링 가능하게 배열로 반환
                if clipped.geom_type == "Polygon":
                    items.append({"type": "polygon", "coords": self._polygon_to_list(clipped, ref_lat, ref_lng)})
                elif clipped.geom_type == "MultiPolygon":
                    for part in clipped.geoms:
                        items.append({"type": "polygon", "coords": self._polygon_to_list(part, ref_lat, ref_lng)})
                elif clipped.geom_type == "LineString":
                    width = 20 if is_polygon else None
                    base = {"type": "line", "coords": self._line_to_list(clipped, ref_lat, ref_lng)}
                    if width: base["width"] = width
                    items.append(base)
                elif clipped.geom_type == "MultiLineString":
                    for part in clipped.geoms:
                        width = 20 if is_polygon else None
                        base = {"type": "line", "coords": self._line_to_list(part, ref_lat, ref_lng)}
                        if width: base["width"] = width
                        items.append(base)
                elif clipped.geom_type == "GeometryCollection":
                    for part in clipped.geoms:
                        items.extend(_clip_geom(part, is_polygon))
            except Exception as e:
                # print(f"[TerrainService] Clip Error: {e}")
                pass
            return items

        def fetch_water():
            items = []
            try:
                water_tags = {"natural": ["water", "wetland"], "waterway": ["river", "stream", "canal"]}
                gdf = ox.features_from_polygon(poly, tags=water_tags)
                if not gdf.empty:
                    for _, row in gdf.iterrows():
                        geom = row.geometry
                        # 다각형인지 라인인지 여부는 OSM 피처 타입에 따름
                        is_poly = geom.geom_type in ["Polygon", "MultiPolygon"]
                        items.extend(_clip_geom(geom, is_polygon=is_poly))
            except Exception as e: print(f"[TerrainService] Water Error: {e}")
            return items

        def fetch_forest():
            items = []
            try:
                forest_tags = {"landuse": ["forest", "recreation_ground"], "leisure": ["park", "nature_reserve"], "natural": ["wood"]}
                gdf = ox.features_from_polygon(poly, tags=forest_tags)
                if not gdf.empty:
                    for _, row in gdf.iterrows():
                        geom = row.geometry
                        items.extend(_clip_geom(geom, is_polygon=True))
            except Exception as e: print(f"[TerrainService] Forest Error: {e}")
            return items

        def fetch_roads():
            items = []
            try:
                G = ox.graph_from_polygon(poly, network_type="all")
                edges = ox.graph_to_gdfs(G, nodes=False)
                major_hw = ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified", "service"]
                if not edges.empty:
                    for _, row in edges.iterrows():
                        geom = row.geometry
                        hw = row.get("highway", "residential")
                        if isinstance(hw, list): hw = hw[0]
                        if hw not in major_hw: continue
                        bridge = row.get("bridge", "no")
                        if isinstance(bridge, list): bridge = bridge[0]
                        
                        clipped_lines = _clip_geom(geom, is_polygon=False)
                        for line_data in clipped_lines:
                            line_data["highway"] = hw
                            line_data["bridge"] = bridge
                            items.append(line_data)
            except Exception as e: print(f"[TerrainService] Road Error: {e}")
            return items

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            f_water = executor.submit(fetch_water)
            f_forest = executor.submit(fetch_forest)
            f_roads = executor.submit(fetch_roads)
            result["layers"]["water"] = f_water.result()
            result["layers"]["forest"] = f_forest.result()
            result["layers"]["roads"] = f_roads.result()

        final_result = self._deep_sanitize(result)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(final_result, f, ensure_ascii=False, indent=2)
        return final_result

    def _polygon_to_list(self, polygon, ref_lat, ref_lng):
        if not polygon or not hasattr(polygon, 'exterior'): return []
        # [수정] 프론트엔드의 gpsToGame 함수를 제대로 타도록 순수 GPS(lat, lng) 반환
        return [[lat, lng] for lng, lat in list(polygon.exterior.coords)]

    def _line_to_list(self, line, ref_lat, ref_lng):
        if not line or not hasattr(line, 'coords'): return []
        # [수정] 순수 GPS 반환
        return [[lat, lng] for lng, lat in list(line.coords)]

    def _fetch_area_elevations(self, lat, lng, dist, grid_size):
        # OpenTopoData API 호출 (현재 비활성 상태 유지)
        return {"grid_size": grid_size, "elevations": [], "min": 0, "max": 0}

terrain_service = TerrainService()
