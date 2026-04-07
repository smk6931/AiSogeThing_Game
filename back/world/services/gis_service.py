import osmnx as ox
import geopandas as gpd
from shapely.geometry import box
import os

# osmnx 캐시 설정 (라이브러리 원본 캐시를 raw 폴더로 격리)
ox.settings.use_cache = True
ox.settings.cache_folder = os.path.join(os.path.dirname(__file__), "..", "..", "cache", "raw")

class GisService:
    def __init__(self):
        # 강남역 사거리 기준
        self.origin_lat = 37.4979
        self.origin_lng = 127.0276
        
        # 100m 기준 위경도 오프셋 (대략적)
        # 서울 위도에서 1도당 거리는 가로 약 88km, 세로 약 111km
        self.lat_step = 0.0009  # 약 100m 단위 위도 (세로)
        self.lng_step = 0.0011  # 약 100m 단위 경도 (가로)

    def get_tile_coords(self, x_idx, y_idx):
        """타일 인덱스(x, y)에 해당하는 위경도 중심점 반환"""
        # 게임 좌표계 (x, z)와 매칭: x_idx는 경도 증가, y_idx는 위도 감소(아래쪽)
        lat = self.origin_lat - (y_idx * self.lat_step)
        lng = self.origin_lng + (x_idx * self.lng_step)
        return lat, lng

    def fetch_area_features(self, lat, lng, dist=100):
        """
        특정 지점 주변의 도로나 수계 데이터를 OSM에서 가져옴
        """
        print(f"[INFO] GIS 데이터 추출 중: ({lat}, {lng}), 반경 {dist}m")
        try:
            # bbox 생성
            # dist가 100m이면 전체 200m x 200m 영역
            graph = ox.graph_from_point((lat, lng), dist=dist, network_type='all')
            nodes, edges = ox.graph_to_gdfs(graph)
            return edges
        except Exception as e:
            print(f"[ERROR] GIS 추출 실패: {e}")
            return None

    def export_skeleton(self, edges, output_path, dpi=100):
        """도로망을 흰색 선으로 그려 AI 밑그림(Template) 생성"""
        if edges is None or edges.empty:
            print("[WARN] 그릴 데이터가 없습니다.")
            return False
        
        import matplotlib.pyplot as plt
        # 1024x1024 해상도 맞추기 (10.24 inch * 100 dpi)
        fig, ax = plt.subplots(figsize=(10.24, 10.24), dpi=dpi)
        
        # 선 굵기는 도로 등급(highway)에 따라 조절 가능하지만 일단 통일
        edges.plot(ax=ax, color='white', linewidth=3)
        
        ax.set_facecolor('black')
        ax.set_xlim(edges.total_bounds[0], edges.total_bounds[2])
        ax.set_ylim(edges.total_bounds[1], edges.total_bounds[3])
        plt.axis('off')
        
        plt.savefig(output_path, bbox_inches='tight', pad_inches=0, facecolor='black')
        plt.close()
        print(f"[OK] GIS 템플릿 저장 완료: {output_path}")
        return True

# 싱글톤 인스턴스
gis_service = GisService()

if __name__ == "__main__":
    # 테스트 실행: 강남역 주변 도로망 추출
    service = GisService()
    gangnam_lat, gangnam_lng = 37.4979, 127.0276
    edges = service.fetch_area_features(gangnam_lat, gangnam_lng, dist=500)
    if edges is not None:
        os.makedirs("cache/maps/skeletons", exist_ok=True)
        service.export_skeleton(edges, "cache/maps/skeletons/gangnam_skeleton.png")
