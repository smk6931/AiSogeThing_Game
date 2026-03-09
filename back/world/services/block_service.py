import os
import json
import math
from shapely.geometry import Polygon
from world.services.district_service import get_district_by_id, get_dong_by_id

class BlockService:
    def __init__(self):
        self.cache_dir = os.path.join(os.path.dirname(__file__), "..", "..", "cache", "blocks")
        os.makedirs(self.cache_dir, exist_ok=True)

    def extract_district_blocks(self, district_id: int):
        district = get_district_by_id(district_id)
        if not district: return []
        return self._extract_boundary_blocks(district, "district")

    def extract_dong_blocks(self, dong_id: int):
        dong = get_dong_by_id(dong_id)
        if not dong: return []
        return self._extract_boundary_blocks(dong, "dong")

    def _extract_boundary_blocks(self, area_data, area_type):
        """
        특정 영역(구/동)의 블록 데이터 추출
        현재는 별도의 블록 서비스가 없으므로 zone_service의 용도구역 중 
        건축물/주거/상업 영역을 '블록'으로 간주하여 필터링 반환합니다.
        """
        area_id = area_data["id"]
        cache_path = os.path.join(self.cache_dir, f"blocks_{area_type}_{area_id}.json")

        if os.path.exists(cache_path):
            with open(cache_path, "r", encoding="utf-8") as f:
                return json.load(f)

        # 실제로는 zone_service를 호출하여 폴리곤 데이터를 가져옵니다.
        from world.services.zone_service import fetch_zones
        lat, lng = area_data["center"]
        dist = 5000 if area_type == "district" else 2000
        
        # 구/동 ID를 명시적으로 전달하여 해당 영역만큼만 추출하게 함
        zone_data = fetch_zones(lat, lng, dist, 
                                district_id=area_id if area_type == "district" else None,
                                dong_id=area_id if area_type == "dong" else None)
        
        # 'residential', 'commercial' 등을 블록 데이터로 취급
        all_blocks = []
        for cat in ['residential', 'commercial', 'industrial', 'institutional']:
            if cat in zone_data.get("zones", {}):
                all_blocks.extend(zone_data["zones"][cat])

        # 캐시 저장 후 반환
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(all_blocks, f, ensure_ascii=False)
            
        return all_blocks

block_service = BlockService()
