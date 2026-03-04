import osmnx as ox
import json
import math
import time
import urllib.request
import urllib.parse
from shapely.geometry import Polygon, LineString, MultiPolygon, MultiLineString
import os

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

        # 1. 고도 데이터 추출 (Heightmap) - 비활성화 (전역 HeightMap 사용으로 성능 최적화)
        # result["heightmap"] = self._fetch_area_elevations(lat, lng, dist, grid_size)
        result["heightmap"] = None


        # 2. OSM 특징 데이터 추출 (Water, Forest, Grass)
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
            # 2. 숲/녹지
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
            # 3. 도로 (핵심 간선도로 위주 필터링)
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
        """JSON 데이터 전송 직전에 NaN/Inf 값을 안전한 값으로 필터링"""
        if isinstance(obj, dict):
            return {k: self._deep_sanitize(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._deep_sanitize(v) for v in obj]
        elif isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return 0.0
            return obj
        return obj


    def _polygon_to_list(self, polygon, ref_lat, ref_lng):
        if not polygon or not hasattr(polygon, 'exterior'): return []
        coords = list(polygon.exterior.coords)
        return [self.gps_to_game(lat, lng, ref_lat, ref_lng) for lng, lat in coords]

    def _line_to_list(self, line, ref_lat, ref_lng):
        if not line or not hasattr(line, 'coords'): return []
        coords = list(line.coords)
        return [self.gps_to_game(lat, lng, ref_lat, ref_lng) for lng, lat in coords]

    def _fetch_area_elevations(self, lat, lng, dist, grid_size):
        """opentopodata를 이용해 격자 고도 데이터 추출"""
        lat_range = dist / self.LAT_TO_M
        lng_range = dist / self.LNG_TO_M
        
        lat_min, lat_max = lat - lat_range, lat + lat_range
        lng_min, lng_max = lng - lng_range, lng + lng_range
        
        grid_points = []
        for row in range(grid_size):
            for col in range(grid_size):
                p_lat = lat_max - (row / (grid_size - 1)) * (lat_max - lat_min)
                p_lng = lng_min + (col / (grid_size - 1)) * (lng_max - lng_min)
                grid_points.append((p_lat, p_lng))
        
        elevations = []
        for i in range(0, len(grid_points), 100):
            batch = grid_points[i:i+100]
            locations = "|".join(f"{lt:.6f},{lg:.6f}" for lt, lg in batch)
            url = f"https://api.opentopodata.org/v1/srtm30m?locations={urllib.parse.quote(locations)}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "AiSogeThing/1.0"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode())
                    if data.get("status") == "OK":
                        for r in data["results"]:
                            e = r.get("elevation")
                            elevations.append(self._sanitize_float(e))
                    else:
                        elevations.extend([0.0] * len(batch))
            except Exception as e:
                print(f"[TerrainService] Elevation API error: {e}")
                elevations.extend([0.0] * len(batch))
            time.sleep(1.0)

        # 안전한 min/max 계산 (비어있거나 모든 값이 0일 때 대비)
        valid = [e for e in elevations if e is not None and not math.isnan(e)]
        if not valid: valid = [0.0]
        
        return {
            "grid_size": grid_size,
            "elevations": elevations,
            "min": round(min(valid), 1),
            "max": round(max(valid), 1)
        }

    def _sanitize_float(self, val):
        """NaN 또는 무한대 값을 JSON 안전한 값(0)으로 변환"""
        if val is None or math.isnan(val) or math.isinf(val):
            return 0.0
        return float(val)

terrain_service = TerrainService()
