"""
서울 고도(Elevation) 데이터 추출 스크립트
- opentopodata.org SRTM 30m 무료 API 사용 (키 없음)
- 격자 형태로 고도값을 받아 heightmap JSON 저장
- Three.js PlaneGeometry displacement에 사용
"""
import json
import os
import time
import math
import urllib.request
import urllib.parse

# ==============================================================
# 설정값
# ==============================================================
ORIGIN_LAT = 37.5124
ORIGIN_LNG = 126.9392

# 추출 범위 (원점 기준 ±km)
RANGE_KM = 15.0

# 격자 해상도 (숫자가 클수록 정밀하지만 느림 / API 제한)
# 120x120 = 14400개 포인트, 약 2~3분 소요
GRID_SIZE = 120


# 고도 배율 (Three.js에서 보기 좋게 과장)
ELEVATION_SCALE = 1.0  # 실제 미터 단위 그대로

# 저장 경로
OUTPUT_PATH = r"c:\GitHub\AiSogeThing\front\public\seoul_heightmap.json"

# 위경도 변환 상수
LAT_PER_KM = 1 / 110.94  # 1km당 위도 차이
LNG_PER_KM = 1 / 88.2    # 1km당 경도 차이 (서울 기준)

# ==============================================================
# API 호출 (batch, 최대 100개씩)
# ==============================================================
def fetch_elevations_batch(latlng_list):
    """opentopodata 배치 요청 (최대 100개)"""
    locations = "|".join(f"{lat:.6f},{lng:.6f}" for lat, lng in latlng_list)
    url = f"https://api.opentopodata.org/v1/srtm30m?locations={urllib.parse.quote(locations)}"
    
    req = urllib.request.Request(url, headers={"User-Agent": "AiSogeThing/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
            if data.get("status") == "OK":
                return [r["elevation"] for r in data["results"]]
            else:
                print(f"  API 오류: {data}")
                return [0] * len(latlng_list)
    except Exception as e:
        print(f"  요청 실패: {e}")
        return [0] * len(latlng_list)


# ==============================================================
# 메인 고도 추출
# ==============================================================
def extract_heightmap():
    # 격자 좌표 생성
    lat_range = RANGE_KM * LAT_PER_KM
    lng_range = RANGE_KM * LNG_PER_KM
    
    lat_min = ORIGIN_LAT - lat_range
    lat_max = ORIGIN_LAT + lat_range
    lng_min = ORIGIN_LNG - lng_range
    lng_max = ORIGIN_LNG + lng_range
    
    # 격자 포인트 목록 (row-major order)
    grid_points = []
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            lat = lat_max - (row / (GRID_SIZE - 1)) * (lat_max - lat_min)  # 북→남
            lng = lng_min + (col / (GRID_SIZE - 1)) * (lng_max - lng_min)  # 서→동
            grid_points.append((lat, lng))
    
    print(f"= 고도 격자 추출 시작 =")
    print(f"  범위: {GRID_SIZE}x{GRID_SIZE} = {len(grid_points)}개 포인트")
    print(f"  위도: {lat_min:.4f} ~ {lat_max:.4f}")
    print(f"  경도: {lng_min:.4f} ~ {lng_max:.4f}")
    print()
    
    # 배치 100개씩 API 호출
    BATCH = 100
    elevations = []
    total_batches = math.ceil(len(grid_points) / BATCH)
    
    for i in range(0, len(grid_points), BATCH):
        batch_num = i // BATCH + 1
        batch = grid_points[i:i+BATCH]
        print(f"  [{batch_num}/{total_batches}] {len(batch)}개 포인트 요청 중...", end=" ")
        
        result = fetch_elevations_batch(batch)
        elevations.extend(result)
        
        min_e = min(r for r in result if r is not None)
        max_e = max(r for r in result if r is not None)
        print(f"완료 (고도 범위: {min_e:.0f}m ~ {max_e:.0f}m)")
        
        # API rate limit 준수 (1 req/sec)
        if i + BATCH < len(grid_points):
            time.sleep(1.1)
    
    # None 값 처리 (오류난 포인트)
    elevations = [e if e is not None else 0 for e in elevations]
    
    # 전체 통계
    valid = [e for e in elevations if e > 0]
    min_elev = min(valid)
    max_elev = max(valid)
    
    print(f"\n전체 고도 범위: {min_elev:.0f}m (최저) ~ {max_elev:.0f}m (최고)")
    print(f"  (예상: 한강 3~5m, 남산 265m, 관악산 629m 등)")
    
    # 게임 좌표 변환 파라미터 계산
    # Three.js에서 PlaneGeometry가 (world_width x world_height)로 GRID_SIZE x GRID_SIZE 분할됨
    lat_to_m  = 110940
    lng_to_m  = 88200
    world_width  = (lng_max - lng_min) * lng_to_m
    world_height = (lat_max - lat_min) * lat_to_m
    
    origin_offset_x = (lng_min - ORIGIN_LNG) * lng_to_m
    origin_offset_z = (ORIGIN_LAT - lat_max) * lat_to_m
    
    result = {
        "origin": {"lat": ORIGIN_LAT, "lng": ORIGIN_LNG},
        "grid_size": GRID_SIZE,
        "world_width": round(world_width, 1),
        "world_height": round(world_height, 1),
        "offset_x": round(origin_offset_x, 1),
        "offset_z": round(origin_offset_z, 1),
        "elev_min": round(min_elev, 1),
        "elev_max": round(max_elev, 1),
        "elevations": [round(e, 1) for e in elevations]
    }
    
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, separators=(",", ":"))
    
    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"\n✅ 저장 완료: {OUTPUT_PATH}")
    print(f"   파일 크기: {size_kb:.1f} KB")
    print(f"   격자: {GRID_SIZE}x{GRID_SIZE}")
    print(f"   세계 크기: {world_width:.0f}m x {world_height:.0f}m")

if __name__ == "__main__":
    extract_heightmap()
