=== 데이터베이스 & 배포 관련 명령어 모음 (Database & Deployment Commands) ===

[현재 설정: SSH 터널링으로 서버 DB 사용]
- 빠른 개발을 위해 로컬에서 서버 DB에 직접 연결 중
- 상세 가이드: Project_Docs/Command/DB_Tunnel_Setup.md 참고

0. [SSH 터널링] 로컬에서 서버 DB 접속 (현재 사용 중)
   -----------------------------------------------------
   # PowerShell에서 실행 (백그라운드로 계속 실행)
   ssh -i "C:\Users\ssh\ssh-key-oracle.key" -L 5433:localhost:5432 -N ubuntu@168.107.52.201
   
   # .env 파일 설정:
   # DB_HOST=localhost
   # DB_PORT=5433
   -----------------------------------------------------

1. [Docker] PostgreSQL (+pgvector) 컨테이너 실행
   (로컬/서버 공통 명령어)
   -----------------------------------------------------
   docker run -d --name aisogething-db -p 5432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=0000 -e POSTGRES_DB=aisogething pgvector/pgvector:pg16
   -----------------------------------------------------
   * 확인: docker ps
   * 삭제 후 재설치 시: docker rm -f aisogething-db


2. [Alembic] DB 마이그레이션 (DB 형상 관리)
   (모든 명령어는 back 폴더 또는 venv 활성화 상태에서 실행)
   -----------------------------------------------------
   # A. 초기 설정 (최초 1회)
   python -m alembic init alembic

   # B. 변경사항 감지 및 스크립트 생성 (주문서 작성)
   python -m alembic revision --autogenerate -m "메시지"

   # C. DB에 반영 (주문 넣기/시공)
   python -m alembic upgrade head

   # D. 꼬였을 때 강제로 버전 맞추기 (Stamp)
   # (DB에는 테이블이 있는데 Alembic이 모를 때 사용)
   python -m alembic stamp head
   -----------------------------------------------------


3. [Git] 서버 코드 강제 동기화 (Force Sync)
   (서버에서 파일 충돌 날 때, GitHub 기준으로 덮어쓰기)
   -----------------------------------------------------
   git fetch --all
   git reset --hard origin/main
   git clean -fd
   -----------------------------------------------------


4. [SSH Tunnel] DB 접속 정보 (DBeaver/pgAdmin)
   -----------------------------------------------------
   * Main 탭
     - Host: localhost
     - Port: 5432
     - Database: aisogething
     - User/PW: postgres / 0000

   * SSH 탭
     - [v] Use SSH Tunnel
     - Host IP: 168.107.52.201
     - User: ubuntu
     - Auth: Identity file -> 키 파일 선택 (ssh-key-oracle.key)
   -----------------------------------------------------


5. [Deploy] 원클릭 배포 스크립트
   -----------------------------------------------------
   # 로컬 (Push)
   git add .
   git commit -m "메시지"
   git push

   # 서버 (Execute)
   ./deploy.sh
   -----------------------------------------------------
