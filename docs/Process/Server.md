[ 서버 방화벽(Firewall) 해결 과정 ]
작성일: 2026-01-17

1. 문제 상황
   - 서버에 프론트엔드(3000)와 백엔드(8080)를 모두 실행했으나, 외부(브라우저)에서 접속이 안 되고 무한 로딩 발생.
   - 원인은 "이중 방화벽" (서버 내부 OS 방화벽 + 오라클 클라우드 외부 방화벽) 때문임.

2. 해결 1단계: 서버 내부 방화벽 개방 (OS)
   - 서버 터미널에서 다음 명령어를 입력하여 포트 강제 개방.
   - 명령어:
     sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
     sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
     sudo netfilter-persistent save

3. 해결 2단계: 오라클 클라우드 방화벽 개방 (Web Console)
   - 오라클 웹사이트에서 물리적인 보안 문을 열어줘야 함.
   
   [설정 경로]
   1) Oracle Cloud 로그인 -> Compute -> Instances -> 내 인스턴스 클릭
   2) 화면 중단 [Networking] 탭 클릭 -> [Primary VNIC]의 Subnet 링크 클릭
   3) [Security Lists] -> [Default Security List...] 클릭
   4) [Add Ingress Rules] 버튼 클릭

   [입력 값]
   - Source CIDR: 0.0.0.0/0 (전체 허용)
   - IP Protocol: TCP
   - Destination Port Range: 3000, 8080
   - [Add Ingress Rules] 버튼 클릭하여 저장.

4. 결과
   - http://168.107.52.201:3000 접속 성공.

=======================================================

[ HTTPS 및 Nginx 리버스 프록시 설정 ]
작성일: 2026-01-18

1. 문제 상황
   - 프론트엔드(HTTPS, sogething.com)에서 백엔드(HTTP, IP:8080)로 API 요청 시 Mixed Content 보안 에러 발생.
   - 브라우저가 보안상 HTTPS 페이지 내의 HTTP 요청을 차단함.

2. 해결 방법: Nginx 리버스 프록시 적용
   - 프론트엔드와 백엔드를 Nginx(443 포트) 하나로 통합하여 모두 HTTPS로 통신하도록 설정.
   - / (루트 경로) -> 프론트엔드 (3000번 포트)
   - /api (API 경로) -> 백엔드 (8080번 포트)

3. Nginx 설정 파일 수정 (/etc/nginx/sites-available/sogething)
   - 프록시 설정 추가 (location /api 블록 추가)
   - 백엔드로 헤더 정보(Host, IP 등)를 그대로 전달하도록 설정.

4. 클라이언트 코드 수정 (front/src/api/client.js)
   - API 주소를 하드코딩하지 않고 환경에 따라 자동 선택되도록 변경.
   - 도메인 접속 시: https://sogething.com (Nginx가 백엔드로 연결)
   - 로컬 개발 시: http://localhost:8001 (개발자 PC 백엔드)

5. 결과
   - https://sogething.com 접속 시 자물쇠(SSL) 유지됨.
   - https://sogething.com 접속 시 자물쇠(SSL) 유지됨.
   - API 요청도 HTTPS로 전송되어 보안 에러 해결 및 정상 작동.

=======================================================

[ 프로세스 관리 업그레이드 (nohup -> PM2) ]
작성일: 2026-01-18

1. 문제 상황
   - 기존 nohup 방식은 SSH 접속 연결이 끊기면 프로세스가 같이 종료되는 현상 발생 (Oracle Cloud 기본 보안 정책).

2. 해결 방법: PM2 도입 (Process Manager)
   - Node.js 기반의 프로세스 관리자로, SSH가 끊기거나 서버가 재부팅되어도 앱을 자동으로 살려냄 (Keep-Alive).
   - 로그 관리 및 모니터링이 훨씬 간편함.

3. 적용 완료
   - 서버에 PM2 설치 및 기존 프로세스 종료 후 PM2로 재실행.
   - [Backend]  pm2 start ... --name "backend"
   - [Frontend] pm2 start ... --name "frontend"
   - pm2 save (재부팅 시 자동 실행 저장)

4. 주요 명령어 확인
   - 상태 확인: pm2 list
   - 로그 확인: pm2 logs
   - 재시작: pm2 restart all

=======================================================

[ 배포 트러블 슈팅: 포트 충돌 및 코드 동기화 ]
작성일: 2026-01-18 (심야)

1. 포트 충돌 (Address already in use)
   - 현상: PM2 실행 시 로그에 `[Errno 98] address already in use` 에러 발생 및 무한 재시작.
   - 원인: PM2 도입 이전에 실행했던 `nohup` 프로세스가 정상 종료되지 않고 백그라운드에서 포트를 계속 점유함 (좀비 프로세스).
   - 해결:
     1) 포트 점유 프로세스(PID) 확인: `sudo lsof -i :8080`
     2) 프로세스 강제 종료: `sudo fuser -k 8080/tcp` (가장 확실함)
     3) PM2 재시작: `pm2 restart backend`

2. 배포 시 코드 불일치 문제 (404 Not Found)
   - 현상: 로컬에서 수정한 코드(예: API Prefix 추가)를 배포했으나 서버에는 구버전 코드가 남아있어 API 호출 실패.
   - 원인: `git pull` 실행 시 충돌(Conflict)이나 기타 이유로 업데이트가 중단됨.
   - 해결:
     1) 배포 시 로컬 변경사항 무시 전략 사용.
     2) `git fetch origin` (최신 상태 확인)
     3) `git reset --hard origin/main` (강제 덮어쓰기)
     4) 이 과정을 통해 서버 코드를 로컬 코드(`origin/main`)와 100% 일치시킴.
