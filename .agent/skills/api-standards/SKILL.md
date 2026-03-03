---
name: API 및 정적 파일 경로 규칙
description: 모든 API 엔드포인트는 /api/ 접두사를 사용해야 하며, 정적 파일 서빙 경로도 이를 따라야 합니다.
---

# API 및 정적 파일 경로 규칙 (AiSogeThing)

운영 서버의 Nginx 설정과 호환성을 맞추기 위한 필수 규칙입니다.

## 1. API 라우팅 (필수)
- **규칙**: 모든 Backend API의 `APIRouter` prefix는 반드시 **`/api/`**로 시작해야 합니다.
- **이유**: Nginx가 `/api/` 요청만 백엔드(Port 8001)로 전달합니다.
- **예시**:
    - ✅ `router = APIRouter(prefix="/api/game")`

## 2. 정적 파일 및 이미지 서빙
- **규칙**: 백엔드가 생성/제공하는 모든 URL 주소에 **`/api/`**를 포함하십시오.
- **구현 예시**:
    - Backend: `return f"/api/static/images/{filename}"`
    - Frontend: `<img src="/api/static/images/hero.png" />`

## 3. 프론트엔드 호출
- **규칙**: 백엔드 주소를 하드코딩하지 말고 환경 변수나 공통 클라이언트를 사용하십시오.
- **참조**: `VITE_API_URL` 환경 변수 사용.
