================================================================================
                        기술 스택 선정 및 결정 (Tech Stack)
================================================================================

1. 최종 확정 스택 (Current Tech Stack)
--------------------------------------------------------------------------------
A. Backend
   - Framework: FastAPI (Async)
   - Language: Python 3.11+
   - Database: PostgreSQL 16+
   - Driver: asyncpg (High Performance Async Driver)
   - ORM: SQLAlchemy (Core Mode only)

B. Infrastructure
   - Server: Oracle Cloud (Ubuntu 22.04 LTS)
   - Process Manager: PM2
   - Deploy: Custom Shell/PowerShell Scripts

C. Frontend
   - Framework: React + Vite
   - State: Context API
   - Style: Plain CSS (Glassmorphism)


2. 주요 기술 의사결정 (Architecture Decision Records)
--------------------------------------------------------------------------------

Q1. Backend Framework: FastAPI vs Django?

   * 후보 1: FastAPI (선정됨)
     - 이유 1: 압도적인 비동기(Async) 성능. 실시간 채팅/알림 서버에 유리.
     - 이유 2: AI/ML 라이브러리(PyTorch, LangChain)와의 호환성 및 확장성.
     - 이유 3: Swagger UI 자동 생성으로 프론트엔드 협업 효율 증대.

   * 후보 2: Django (탈락)
     - 장점: 관리자 페이지 등 기본 기능 강력.
     - 단점: 무겁고, 비동기 처리가 FastAPI만큼 매끄럽지 않음.

Q2. DB Driver: 왜 asyncpg인가? (vs psycopg2)

   * 선정: asyncpg
     - 속도: C로 작성되어 Python DB 드라이버 중 벤치마크 1위.
     - 비동기 최적화: Blocking 없이 대량의 동시 접속 처리 가능.
     - SQLAlchemy 연동: Core의 :name 파라미터 바인딩을 통해 $1 문법 차이를 극복하고 안전하게 사용 중.

   * 비교군: psycopg2 (기존 표준)
     - 단점: 동기(Sync) 방식이라 await 키워드를 쓸 수 없음. DB 응답 대기 중 서버 전체가 멈추는 현상(Blocking) 발생.

Q3. ORM 사용 여부: SQLAlchemy ORM vs Core?

   * 선정: SQLAlchemy Core (Raw SQL Style)
     - 이유: 객체 매핑(Object Mapping) 오버헤드를 제거하여 Raw SQL급 성능 확보.
     - 전략: 복잡한 Join이나 튜닝이 필요한 쿼리는 직접 SQL로 작성하고, 연결/트랜잭션 관리만 라이브러리에 위임.


3. 추후 도입 예정 (Future)
--------------------------------------------------------------------------------
- Redis: 채팅 메시지 큐 및 세션 캐싱.
- S3 / R2: 프로필 이미지 저장소.
