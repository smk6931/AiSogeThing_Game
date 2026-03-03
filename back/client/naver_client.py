import os
import urllib.parse
from datetime import datetime
from dotenv import load_dotenv
from utils.safe_ops import load_json_safe, save_json_safe, safe_http_get

# .env 파일 로드 (모듈 로드 시 최초 1회 실행)
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env') # back/client/../../.env -> back/.env
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv() 

# 전역 상수 (Singleton 효과)
CLIENT_ID = os.getenv("NAVER_CLIENT_ID")
CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET")
BASE_URL = "https://openapi.naver.com/v1/search/local.json"

def _manage_quota(increment=False):
    """
    로컬 파일(quota.json)을 이용해 API 사용량을 직접 카운팅합니다.
    """
    # 현재 파일(naver_client.py)과 같은 폴더에 quota.json 위치
    quota_file = os.path.join(os.path.dirname(__file__), 'quota.json')
    today = datetime.now().strftime('%Y-%m-%d')
    limit = 25000
    
    # 1. 파일 안전하게 읽기
    saved_data = load_json_safe(quota_file)
    
    # 2. 데이터 유효성 검사 및 날짜 리셋
    if saved_data and saved_data.get('date') == today:
        data = saved_data
    else:
        data = {"date": today, "remaining": limit, "limit": limit}

    # 3. 사용량 차감 및 저장
    if increment and data['remaining'] > 0:
        data['remaining'] -= 1
        save_json_safe(quota_file, data)

    return data['remaining'], limit

def _parse_items(items):
    """
    API 결과를 프론트엔드에서 쓰기 편하게 가공 (내부 헬퍼 함수)
    """
    results = []
    for item in items:
        # HTML 태그 제거
        title = item['title'].replace('<b>', '').replace('</b>', '')
        
        # 좌표 변환 (KATECH -> WGS84)
        try:
            lng = int(item['mapx']) / 10000000
            lat = int(item['mapy']) / 10000000
        except (ValueError, KeyError):
            lng, lat = 0.0, 0.0

        place = {
            "title": title,
            "category": item['category'],
            "description": item['description'],
            "address": item['roadAddress'] or item['address'],
            "lat": lat,
            "lng": lng,
            "naver_map_url": f"https://map.naver.com/p/search/{urllib.parse.quote(title)}"
        }
        results.append(place)
    return results

def search_place(query: str, display: int = 5):
    """
    네이버 지역 검색 API를 호출합니다. (외부 노출 함수)
    """
    if not CLIENT_ID or not CLIENT_SECRET:
        return {"error": "API 키가 설정되지 않았습니다."}

    headers = {
        "X-Naver-Client-Id": CLIENT_ID,
        "X-Naver-Client-Secret": CLIENT_SECRET
    }

    encoded_query = urllib.parse.quote(query)
    url = f"{BASE_URL}?query={encoded_query}&display={display}&sort=random"
    
    # safe_ops를 이용한 안전한 HTTP 호출
    data, error = safe_http_get(url, headers)
    
    if error:
        return {"error": error}
        
    # 성공 시 로직
    remaining, limit = _manage_quota(increment=True)
    
    return {
        "items": _parse_items(data['items']),
        "meta": {
            "remaining": str(remaining),
            "limit": str(limit)
        }
    }
