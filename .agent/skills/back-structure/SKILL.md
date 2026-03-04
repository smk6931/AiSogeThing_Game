---
name: 백엔드 폴더 구조 규칙 (Back Structure)
description: FastAPI 백엔드의 도메인 기반 폴더 구조, 계층 분리 원칙, 임포트 규칙을 정의합니다.
---

# 백엔드 구조 규칙 (`back/`)

## 핵심 원칙: 최상위 = 도메인, 내부 = 계층(Layer)

```
back/
├── user/            # 계정 관리 (회원가입, 로그인, 인증)
├── player/          # 인게임 플레이어 캐릭터, 소켓 동기화
├── monster/         # 몬스터 AI, 피격 등 상호작용
├── world/           # OSM 기반 지형/구역/구 경계 파이프라인
├── core/            # DB 커넥션, 앱 설정 (database.py, config.py)
├── common/          # 공용 설정 (game_settings.json, routers/)
├── client/          # 외부 AI 클라이언트 (OpenAI, Gemini) - 보존
├── utils/           # safe_ops.py, websocket.py
├── static/          # 서버 생성 캐시 파일
├── venv/            # Python 가상환경 (반드시 back/ 하위에만 위치)
└── main.py          # FastAPI 앱 진입점
```

## 도메인 내부 서브폴더 구조 (필수 계층 분리)

```
[domain]/
├── routers/         → router.py (FastAPI 엔드포인트)
├── services/        → *_service.py (비즈니스 로직)
├── models/          → models.py (SQLAlchemy DB 모델)
├── schemas/         → schemas.py (Pydantic 스키마)
├── repositories/    → 데이터 접근 계층 (필요 시)
└── managers/        → *Manager.py (WebSocket 싱글톤, 필요 시)
```

## 규칙
- **임포트**: 절대경로만 사용. 예: `from world.services.zone_service import zone_service`
- **파일명**: `router.py`, `models.py`, `schemas.py`, `*_service.py` 네이밍 준수
- **매니저**: `managers/` 하위에 클래스로 정의, 파일 최하단에 `instance = ClassName()` 싱글톤 생성
- **가상환경**: 모든 Python 명령은 `.\venv\Scripts\python` 경로 사용
- **API prefix 규칙**: 반드시 도메인 이름을 그대로 사용. `/api/` 뒤에 바로 도메인이 온다.

| 도메인 폴더 | API prefix | 예시 엔드포인트 |
|---|---|---|
| `user/` | `/api/auth` | `/api/auth/login`, `/api/auth/me` |
| `world/` | `/api/world` | `/api/world/zones`, `/api/world/terrain` |
| `player/` | `/api/game` | `/api/game/ws/{id}`, `/api/game/settings` |
| `common/` | `/api/game` | `/api/game/config` |

> `/api/` prefix는 Vite proxy 설정에 의해 자동으로 백엔드로 라우팅된다.
> 프론트엔드 React Router의 `/world`, `/login` 같은 경로와 절대 충돌하지 않는다.
