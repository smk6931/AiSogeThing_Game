[Naver Search API 연동 가이드]

1. 개요
이 문서는 AiSogeThing 프로젝트에서 사용된 '네이버 지역 검색 API (Naver Local Search API)'의 연동 방식, 주요 기능, 그리고 데이터 구조를 설명합니다.

2. 사용된 기술 및 모듈
- Language: Python 3.10 이상
- Framework: FastAPI (Backend Proxy)
- Library:
  1) requests: HTTP 요청 처리
  2) python-dotenv: 환경 변수(.env) 로드
  3) urllib.parse: 검색어 인코딩

3. 주요 구현 기능

(1) 좌표계 변환 및 데이터 정제
네이버 검색 API는 KATECH 좌표계(또는 TM128) 기반의 정수형 좌표(mapx, mapy)를 반환합니다. 이를 지도 라이브러리에서 사용하는 WGS84(위도, 경도) 좌표로 변환해야 합니다.
- 변환 로직: 네이버의 mapx, mapy 값은 실제 위경도 값에 10,000,000이 곱해진 형태입니다.
- 구현 방법: 위도(Lat) = mapy / 10000000, 경도(Lng) = mapx / 10000000

(2) 일일 사용량(Quota) 로컬 관리 시스템
네이버 검색 API는 남은 호출 횟수 정보를 직접 알려주지 않습니다. 이를 해결하기 위해 로컬 파일 기반의 카운팅 시스템을 구현했습니다.
- 작동 원리: back 폴더 내 quota.json 파일에 사용량을 저장합니다.
- 초기화: 날짜가 변경되면 자동으로 25,000회로 리셋됩니다.

4. 데이터 변환 예시 (Raw vs Refined)

(1) 네이버 검색 API 원본 응답 (예시: '잠실' 검색)
네이버 서버에서 보내주는 가공되지 않은 원본 데이터입니다.

{
  "lastBuildDate": "Fri, 16 Jan 2026 11:30:00 +0900",
  "total": 5,
  "start": 1,
  "display": 1,
  "items": [
    {
      "title": "<b>잠실</b>역 2호선", (검색어가 강조 처리됨)
      "link": "https://map.naver.com/p/entry/place/13479536",
      "category": "교통,수송>지하철,전철",
      "description": "",
      "telephone": "02-6110-2161",
      "address": "서울특별시 송파구 잠실동 40-1",
      "roadAddress": "서울특별시 송파구 올림픽로 305",
      "mapx": "127100159", (KATECH 좌표)
      "mapy": "375132612" (KATECH 좌표)
    }
  ]
}

(2) 백엔드 가공 후 응답 (Frontend 전달용)
프론트엔드(React)에서 바로 사용할 수 있도록 가공된 구조입니다.

{
  "items": [
    {
      "title": "잠실역 2호선", (태그 제거됨)
      "category": "교통,수송>지하철,전철",
      "address": "서울특별시 송파구 올림픽로 305",
      "lat": 37.5132612, (위도로 변환됨)
      "lng": 127.100159, (경도로 변환됨)
      "naver_map_url": "https://map.naver.com/p/search/잠실역 2호선"
    }
  ],
  "meta": {
    "remaining": 24974,
    "limit": 25000
  }
}

5. 핵심 코드 동작 원리
API 호출 시 mapx와 mapy를 10,000,000으로 나누어 위경도로 변환하고, title의 HTML 태그를 제거한 뒤, naver_map_url을 생성하여 프론트엔드로 반환합니다. 동시에 로컬 quota.json 파일을 업데이트하여 남은 횟수를 차감합니다.
