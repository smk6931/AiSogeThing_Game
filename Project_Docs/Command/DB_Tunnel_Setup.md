=== SSH 터널링으로 로컬에서 서버 DB 접속하기 ===

[목적]
- 빠른 개발을 위해 로컬에서 서버 DB에 직접 연결
- 나중에 첫 배포 시 다시 로컬/서버 DB 분리 예정

=======================================================

[1단계] SSH 터널링 설정 (PowerShell)

터미널을 하나 열어서 다음 명령어를 실행 (백그라운드로 계속 실행됨):

ssh -i "C:\Users\ssh\ssh-key-oracle.key" -L 5433:localhost:5432 -N ubuntu@168.107.52.201

ssh -i "C:\Users\ssh\ssh-key-oracle.key" -L 5433:127.0.0.1:5432 -N ubuntu@168.107.52.201

* 설명:
  - -L 5433:localhost:5432: 로컬 5433 포트를 서버의 localhost:5432로 포워딩
  - -N: 명령어 실행 없이 터널만 유지
  - 이 터미널은 계속 열어둬야 함 (닫으면 터널 끊김)

* 확인: 터미널에 아무 에러 없이 대기 상태면 성공

=======================================================

[2단계] 로컬 .env 파일 설정

프로젝트 루트에 .env 파일 생성 (또는 수정):

DB_USER=postgres
DB_PASSWORD=0000
DB_HOST=localhost
DB_PORT=5433
DB_NAME=aisogething

* 중요: DB_PORT를 5433으로 설정 (SSH 터널 포트)

=======================================================

[3단계] Alembic 설정 수정 (마이그레이션용)

back/alembic.ini 파일 수정:

sqlalchemy.url = postgresql://postgres:0000@localhost:5433/aisogething

* 또는 환경변수로 alembic이 읽도록 설정 가능

=======================================================

[4단계] 테스트

1. SSH 터널 터미널이 실행 중인지 확인
2. 백엔드 실행:
   .\venv\Scripts\activate
   cd back
   uvicorn main:app --reload

3. 정상 작동하면 서버 DB에 연결된 상태

=======================================================

[주의사항]

1. SSH 터널 터미널을 닫으면 DB 연결 끊김
   - 항상 별도 터미널에서 터널 유지 필요

2. 서버 DB에 직접 작업하므로 주의
   - DELETE, DROP 등 위험한 작업 시 신중하게

3. 나중에 분리할 때:
   - 아래 "DB 분리 가이드" 참고

=======================================================

[나중에: DB 분리 가이드]

[1단계] 서버 DB 덤프 생성 및 다운로드

서버에서 덤프 생성 (서버 접속 후):

ssh -i "C:\Users\ssh\ssh-key-oracle.key" ubuntu@168.107.52.201
docker exec aisogething-db pg_dump -U postgres aisogething > /home/ubuntu/aisogething_dump.sql
exit

로컬로 덤프 파일 다운로드:

scp -i "C:\Users\ssh\ssh-key-oracle.key" ubuntu@168.107.52.201:/home/ubuntu/aisogething_dump.sql ./

[2단계] 로컬 DB 생성 및 복원

로컬에서 Docker PostgreSQL 실행:

docker run -d --name aisogething-db-local -p 5432:5432 -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=0000 -e POSTGRES_DB=aisogething pgvector/pgvector:pg16

덤프 복원:

docker exec -i aisogething-db-local psql -U postgres -d aisogething < aisogething_dump.sql

[3단계] 환경변수 복원

.env 파일 수정:

DB_HOST=localhost
DB_PORT=5432

alembic.ini 수정:

sqlalchemy.url = postgresql://postgres:0000@localhost:5432/aisogething

[4단계] SSH 터널 종료

SSH 터널 터미널에서 Ctrl+C로 종료

=======================================================
