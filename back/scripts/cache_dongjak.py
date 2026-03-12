import sys
import os
import json
import time

# 운영체제에 맞춰 인접한 back 디렉토리를 경로에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
back_dir = os.path.dirname(current_dir)
sys.path.append(back_dir)

# 환경 변수 설정 (필요시)
os.environ["PYTHONPATH"] = back_dir

from world.services.district_service import fetch_seoul_sub_districts, fetch_seoul_districts, _point_in_polygon
from world.services.zone_service import zone_service

def cache_district_dongs(district_name):
    print(f"====================================================")
    print(f"[{district_name}] 전역 동 단위 캐싱 스크립트 실행")
    print(f"====================================================")
    
    # 1. 구 정보 가져오기
    dist_data = fetch_seoul_districts()
    gu = next((d for d in dist_data['districts'] if district_name in d['name']), None)
    
    if not gu:
        print(f"Error: '{district_name}'을 찾을 수 없습니다.")
        return

    gu_poly = gu['coords']
    print(f" - 대상 구: {gu['name']} (ID: {gu['id']})")
    
    # 2. 모든 동 데이터 가져오기 (전체 서울)
    dong_data = fetch_seoul_sub_districts()
    
    # 3. 해당 구에 속한 동 필터링 (PIP 알고리즘 사용)
    target_dongs = []
    for dong in dong_data['dongs']:
        lat, lng = dong['center']
        if _point_in_polygon(lat, lng, gu_poly):
            target_dongs.append(dong)
    
    print(f" - {gu['name']} 내 {len(target_dongs)}개의 행정동 발견")
    
    # 4. 각 동별 캐싱 실행
    start_time = time.time()
    success_count = 0
    
    for i, dong in enumerate(target_dongs):
        print(f"[{i+1}/{len(target_dongs)}] {dong['name']} (ID: {dong['id']}) 데이터 패치 중...")
        try:
            # fetch_zones는 결과가 캐시에 없으면 Overpass API를 호출하고 v13 캐시를 생성함
            zone_service.extract_dong_zones(dong['id'])
            print(f"   ㄴ [성공] 캐시 생성 완료")
            success_count += 1
        except Exception as e:
            print(f"   ㄴ [실패] 에러 발생: {e}")
        
        # Overpass API Rate Limit 방지를 위한 짧은 대기
        time.sleep(2)

    total_time = time.time() - start_time
    print(f"====================================================")
    print(f"작업 완료!")
    print(f" - 총 소요 시간: {total_time:.1f}초")
    print(f" - 성공: {success_count} / {len(target_dongs)}")
    print(f" - 저장 위치: back/cache/zones/v13_dong_*.json")
    print(f"====================================================")

if __name__ == "__main__":
    # 동작구 내의 모든 동을 순회하며 캐시 생성
    cache_district_dongs("동작구")
