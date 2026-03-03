[YouTube Data API v3 연동 가이드]

1. 개요
- 목적: 앱 내에서 유튜브 영상을 검색하고, 인기 급상승 동영상을 조회하며, 사용자 시청 로그를 기록함.
- 주요 기능: 검색(Search), 인기 리스트(Popular), 시청 로그 저장(Log).
- 관련 파일: 
  Client: back/client/youtube_client.py
  Router: back/youtube/router.py
  Frontend: front/fronted/src/api/youtube.js

2. 환경 설정
- .env 파일에 발급받은 API 키가 설정되어 있어야 합니다.
  예시: YOUTUBE_API_KEY=your_api_key_here
- 주의: Google Cloud Console에서 Referer 제한이 걸려 있을 경우, 파이썬 백엔드에서 호출 시 반드시 Referer 헤더를 포함해야 합니다. (현재 코드에 적용됨)

3. 주요 함수 및 엔드포인트

A. 인기 동영상 조회 (Popular)
- 함수: get_popular_videos(max_results=50)
- 주소: GET /api/youtube/popular
- 비용: 1 Unit (매우 저렴)
- 설명: 현재 한국에서 인기 있는 동영상 리스트를 최대 50개 반환합니다.

B. 동영상 검색 (Search)
- 함수: search_videos(query, max_results=50)
- 주소: GET /api/youtube/search?query=검색어
- 비용: 100 Unit (매우 비쌈)
- 설명: 키워드로 영상을 검색합니다. 비용 효율을 위해 한 번 호출 시 최대 50개를 가져옵니다.

C. 시청 로그 저장 (Logging)
- 함수: save_interaction_log(log_data)
- 주소: POST /api/youtube/log
- 데이터: { id: "...", title: "...", action: "click", ... }
- 저장 위치: back/logs/youtube_interaction.jsonl
- 설명: 사용자가 영상을 클릭할 때마다 로그를 파일에 기록합니다. (추후 DB 이관용)

4. 할당량 관리 및 비용 최적화
- 일일 할당량: 10,000 Unit
- 로컬 카운팅: back/client/youtube_quota.json 파일에 실시간 차감 내역을 기록하여 UI에 표시합니다.
- 최적화 전략:
  1) max_results를 50으로 설정하여 호출 횟수 최소화.
  2) 단순 메타데이터(URL, 제목) 저장 및 Iframe 재생으로 추가 비용 0 유지.
  (상세 전략 문서는 Project_Docs/Problem_Solving/Youtube_Token_Optimization.md 참조)

5. JSONL 로그 예시
{"id": "video_id_123", "title": "재미있는 영상", "user_id": "guest", "action": "click", "timestamp": "2026-01-16 14:55:00"}

6. API 응답 데이터 구조 (Response Structure)

(1) YouTube API 원본 응답 (Raw Data)
구글에서 보내주는 데이터는 중첩된 구조(snippet, id 등)를 가지고 있습니다.

{
  "kind": "youtube#searchListResponse",
  "eta": "...",
  "items": [
    {
      "id": {
        "kind": "youtube#video",
        "videoId": "영상ID_값"
      },
      "snippet": {
        "publishedAt": "2026-01-16T00:00:00Z",
        "title": "영상 제목입니다",
        "description": "영상 설명입니다...",
        "thumbnails": {
          "medium": {
            "url": "https://i.ytimg.com/vi/영상ID/mqdefault.jpg",
            "width": 320,
            "height": 180
          }
        },
        "channelTitle": "채널명"
      }
    }
  ]
}

(2) 백엔드 가공 후 응답 (Frontend 전달용)
프론트엔드에서 바로 쓰기 편하도록 평탄화(Flatten) 작업을 거친 구조입니다.

{
  "items": [
    {
      "id": "영상ID_값",
      "title": "영상 제목입니다",
      "description": "영상 설명입니다...",
      "thumbnail": "https://i.ytimg.com/vi/영상ID/mqdefault.jpg",
      "channelTitle": "채널명",
      "publishedAt": "2026-01-16T00:00:00Z"
    }
  ],
  "meta": {
    "remaining": "9899",
    "limit": "10000"
  }
}

