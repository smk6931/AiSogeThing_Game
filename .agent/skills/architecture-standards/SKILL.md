# 프로젝트 아키텍처 및 구조 가이드 (Architecture Standards)

## 1. 개요: 복합 모듈러 모놀리스 (Domain + Layered)
이 프로젝트는 **도메인(기능) 중심**으로 최상위 폴더를 세팅하되, 그 세부 도메인 내부에서 다시 **역할(Layer)별 폴더**로 코드를 관리하는 복잡하고 고도화된 아키텍처를 따릅니다.

---

## 2. 백엔드 구조 (`back/`)

### 핵심 원칙: 도메인 기반 분리 + 계층형(Layered) 폴더화
기존의 `content/` 등의 찌꺼기를 날려버리고, 모든 핵심 기능은 `back/`의 **최상단 도메인 폴더**로 나뉩니다.
각 도메인(Ex: `user`, `player`, `world`, `monster`)의 내부에는 다음과 같은 서브 폴더들이 필수적으로 존재하여 계층을 분리합니다.

- **`routers/`**: FastAPI 엔드포인트 정의 (예: `router.py`)
- **`services/`**: 비즈니스 로직 작성 (예: `*_service.py`)
- **`models/`**: SQLAlchemy DB 모델 정의 (예: `models.py`)
- **`schemas/`**: Pydantic 스키마 정의 (예: `schemas.py`)
- **`repositories/`**: DB 트랜잭션 등 데이터 접근 계층 (필요 시 구성)
- **`managers/`**: WebSocket 소켓 통신 매니저나, 싱글톤 객체 등 특별한 상태 관리 모듈

### 현재 최상단 도메인
- **`user/`**: 회원가입, 로그인 등 계정 관리 도메인
- **`player/`**: 인게임 유저 캐릭터 동기화, 소켓 통신 제어 (WebSocket 로직 포함)
- **`monster/`**: 몬스터 AI 제어, 타격 등 상호작용 도메인
- **`world/`**: OSM API 기반 실시간 지형 로딩 파이프라인(terrain, zone, district) 담당 도메인
- **`common/`**: 기타 프로젝트 공용 설정
- **`client/`**: 3D Asset 텍스처, 프롬프트 연동 등을 위한 OpenAI, Gemini 등 외부 생성형 AI 전송 모듈 보관 (보존)
- **`core/`**: DB 커넥션, 앱 설정 등을 관리하는 엔진 레이어

---

## 3. 프론트엔드 구조 (`front/src/`)

### 앱 중심 구조 (`apps/`)
모든 화면과 도메인 로직은 `apps/` 폴더 산하의 독립된 앱 공간에 위치합니다.
- `apps/auth/`: 로그인 로직, 진입 지점
- `apps/game/`: WebGL 기반 3D World (Three.js/Fiber 기반 코어 게임 뷰)
- `apps/gameEdit/`: HDRI 등 개발 에셋 에디터

### 중앙 집중형 API 관리 (`shared/api/`)
모든 API 호출 기능은 `src/shared/api/` 폴더에서 중앙 관리합니다.
- `shared/api/auth.js`: 로그인/유저 관련 API
- `shared/api/game.js`: 게임 데이터 및 REST API
- `shared/api/client.js`: 공통 Axios 인스턴스

---

## 4. 가상 환경 설정 (Virtual Environment)
백엔드 가상 환경의 권장 위치는 `back/venv` 입니다. 
- 프론트엔드(npm) 모듈과 파이썬 의존성을 완전히 공간적으로 분리함으로써 의존성 탐색 충돌을 예방합니다. 
- 프로젝트 최상위 루트가 아니라 서버 코드가 위치한 `back/` 도메인 산하에서 Python 관련 패키지를 독립적으로 관리하는 것이 모노레포에서의 표준 관리법입니다.

---

## 5. 절대 경로 별칭 (Alias) 사용 규칙
- **`@api`**: `src/shared/api`
- **`@shared`**: `src/shared`
- **`@auth`**: `src/apps/auth`
- **`@game`**: `src/apps/game`
- **`@`**: `src/`

---

## 6. 코딩 시 주의사항 (New Rules)
- **임포트 경로 관리**: 백엔드 내부의 각 도메인은 완전 독립적이나, `models` 나 `services`를 호출할 때는 반드시 절대경로(예: `from player.services.skill_service import ...`)를 사용합니다.
- **파일명 준수**: 하위 폴더(`routers`, `services`)가 생겼으므로 각 폴더 안의 Python 파일명은 `xxx_service.py` 또는 단순하게 `router.py`, `models.py`로 직관적으로 네이밍합니다.
