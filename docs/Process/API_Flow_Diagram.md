=== API Request Flow Logic Comparison ===

시나리오: 사용자가 웹사이트에서 "유튜브 검색 버튼"을 클릭했을 때

-------------------------------------------------------
1. 로컬 개발 환경 (Local Development)
-------------------------------------------------------
[상황]
- 내 컴퓨터 (Windows)
- Frontend: localhost:3000 (npm run dev)
- Backend : localhost:8001 (FastAPI)
- .env 설정: VITE_API_URL="http://localhost:8001"

[흐름도]
(1) 사용자 클릭
    │
(2) Frontend (Axios)
    │  "http://localhost:8001/api/youtube/search" 주소로 직접 발사! 🚀
    │  (다른 포트로 쏘기 때문에 CORS 허용 필요)
    ↓
(3) Backend (Port 8001) 도착
    │  API 처리 (DB 조회, 유튜브 검색 등)
    │
(4) 응답 반환 (JSON Data)
    │
(5) Frontend 도착 & 화면 표시


-------------------------------------------------------
2. 오라클 서버 환경 (Server Production)
-------------------------------------------------------
[상황]
- 오라클 클라우드 (Ubuntu)
- 사용자 접속: https://sogething.com
- Middleware: Nginx (Port 80/443)
- Backend   : localhost:8080 (숨겨져 있음)
- .env 설정 : VITE_API_URL="" (빈 값 = 상대 경로)

[흐름도]
(1) 사용자 클릭
    │
(2) Frontend (Axios)
    │  "/api/youtube/search" 주소로 발사!
    │  (브라우저는 현재 도메인을 붙여서 "https://sogething.com/api/youtube/search"로 보냄)
    ↓
(3) Nginx (Port 443, 문지기) 도착
    │  "어? 주소에 '/api'가 붙어있네?"
    │  "이건 백엔드(8080)로 토스하자!" (Reverse Proxy)
    ↓
(4) Backend (Port 8080) 도착
    │  (백엔드는 요청이 Nginx에서 왔는지 사용자한테 왔는지 모름. 그냥 처리함)
    │  "작업 완료!"
    │
(5) Nginx 다시 도착
    │  "백엔드가 이거 주래." 하고 사용자에게 전달
    ↓
(6) Frontend 도착 & 화면 표시

-------------------------------------------------------
[핵심 차이]
- 로컬: 프론트가 백엔드 집 대문을 직접 두드림. (포트 노출)
- 서버: 프론트가 '경비실(Nginx)'에 맡기면, 경비실이 백엔드에 다녀옴. (포트 숨김 & 보안 강화)
