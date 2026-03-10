=== 로컬 개발 환경 - 서버 DB 터널링 접속 가이드 ===

작성일: 2026-01-24
목적: 로컬 PC(Backend)에서 보안이 적용된 서버 DB(PostgreSQL)에 안전하게 접속하여 개발하기 위함.

1. 아키텍처 (접속 흐름)
   [Local PC]                  [SSH Tunnel]                   [Remote Server (Oracle Cloud)]
   Backend (8001)  --------->  localhost:5433  ============>  Server(127.0.0.1):5432 (Docker DB)
   (FastAPI)                   (Secure Pipe)                  (PostgreSQL)

   * 핵심: 서버의 5432 포트는 방화벽으로 막혀있음. 오직 SSH(22)를 통한 터널링으로만 진입 가능.

2. 터널링 실행 방법 (PowerShell)
   - 개발 시작 전, 터미널 하나를 따로 열어서 아래 명령어를 실행하고 켜둬야 함.
   
   ssh -i "C:\Users\ssh\ssh-key-oracle.key" -L 5433:127.0.0.1:5432 -N ubuntu@168.107.52.201

   * 옵션 설명:
     - -L 5433:127.0.0.1:5432 : 내 PC의 5433 포트를 서버 내부의 127.0.0.1:5432로 연결
     - -N : 쉘 접속 없이 터널만 유지 (Blocking 모드)
     - 127.0.0.1 : localhost 대신 명시적 IP 사용 (IPv6 문제 방지)

3. 로컬 프로젝트 설정 (.env)
   - 로컬 백엔드는 DB가 내 PC의 5433 포트에 있다고 생각해야 함.
   
   [back/.env]
   DB_HOST=127.0.0.1  # 터널 입구
   DB_PORT=5433       # 터널 입구 포트 (5432 아님!)
   DB_USER=...
   DB_PASSWORD=...

4. 자주 겪는 에러 및 해결 (Troubleshooting)

   [Error 1] Connection refused / Connect call failed ('127.0.0.1', 5433)
   - 원인: SSH 터널이 꺼져 있거나, 명령어가 잘못됨 (5433 -> 5432 연결 실패)
   - 해결: 터널 명령어 다시 실행 및 백엔드 재시작

   [Error 2] 500 Internal Server Error & CORS Error
   - 원인: 백엔드가 DB 접속에 실패해서 죽어버림 -> 브라우저는 응답이 없으니 CORS 에러로 착각
   - 해결: DB 연결부터 확인하면 CORS 에러는 자동으로 사라짐

   [Error 3] Heartbeat 401 Unauthorized
   - 원인: 로그인하지 않은 상태에서 Heartbeat 요청을 보냄
   - 해결: 정상 동작임. 로그인하면 200 OK로 바뀜.

5. 요약
   - 터미널 1: SSH 터널 유지 (5433 -> 5432)
   - 터미널 2: 백엔드 실행 (port 8001)
   - 터미널 3: 프론트 실행 (npm run dev)

6. [심화] 왜 localhost 대신 127.0.0.1을 써야 하는가? (RDS vs Docker)

   [상황 A] 서버 내부 Docker DB를 쓸 때 (현재 상황)
   - 명령어: ssh ... -L 5433:127.0.0.1:5432 ... (O)
   - 명령어: ssh ... -L 5433:localhost:5432 ... (X - 위험!)
   - 이유: localhost로 적으면 서버가 IPv6 주소(::1)로 접속을 시도할 수 있음. Docker는 IPv4(127.0.0.1)만 열려있는 경우가 많아 접속 거부됨.
   
   [상황 B] AWS RDS를 쓸 때 (EC2를 경유하는 Bastion Host 방식)
   - 명령어: ssh ... -L 5433:mydb.xxx.rds.amazonaws.com:5432 ... (O)
   - 이유: 이 경우엔 EC2(서버)가 최종 목적지가 아니라 "징검다리" 역할임. 터널 끝에서 RDS의 실제 주소(DNS)로 토스해줘야 함. localhost나 127.0.0.1을 쓰면 EC2 자기 자신을 찾게 되어 실패함.

   => 결론: Docker DB는 무조건 127.0.0.1, RDS는 RDS 주소!
