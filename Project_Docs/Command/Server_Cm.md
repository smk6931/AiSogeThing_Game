================================================================================
                          서버 관리 명령어 모음
================================================================================

[ 1. 서버 접속 ]
--------------------------------------------------------------------------------

1.0. 서버 업데이트
Scripts/deploy_remote.ps1

1-1. 기본 접속
ssh -i "C:\Users\ssh\ssh-key-oracle.key" ubuntu@168.107.52.201

1-2. 접속과 동시에 프로젝트 폴더 이동 및 가상환경 활성화
ssh -i "C:\Users\ssh\ssh-key-oracle.key" ubuntu@168.107.52.201 "cd AiSogeThing && source venv/bin/activate && bash"


[ 2. 로컬에서 서버로 파일 전송 (SCP) ]
--------------------------------------------------------------------------------
주의사항:
- 터미널 위치: 프로젝트 최상위 폴더 (c:\GitHub\AiSogeThing)
- node_modules, venv 폴더는 전송하지 않음 (OS별로 다름)

2-1. 백엔드 파일 전송
scp -i "C:\Users\ssh\ssh-key-oracle.key" -r back ubuntu@168.107.52.201:/home/ubuntu/AiSogeThing/
scp -i "C:\Users\ssh\ssh-key-oracle.key" requirements.txt ubuntu@168.107.52.201:/home/ubuntu/AiSogeThing/
scp -i "C:\Users\ssh\ssh-key-oracle.key" .env ubuntu@168.107.52.201:/home/ubuntu/AiSogeThing/

2-2. 프론트엔드 파일 전송
scp -i "C:\Users\ssh\ssh-key-oracle.key" -r front/src ubuntu@168.107.52.201:/home/ubuntu/AiSogeThing/front/
scp -i "C:\Users\ssh\ssh-key-oracle.key" -r front/public ubuntu@168.107.52.201:/home/ubuntu/AiSogeThing/front/
scp -i "C:\Users\ssh\ssh-key-oracle.key" front/package.json ubuntu@168.107.52.201:/home/ubuntu/AiSogeThing/front/
scp -i "C:\Users\ssh\ssh-key-oracle.key" front/vite.config.js ubuntu@168.107.52.201:/home/ubuntu/AiSogeThing/front/
scp -i "C:\Users\ssh\ssh-key-oracle.key" front/index.html ubuntu@168.107.52.201:/home/ubuntu/AiSogeThing/front/


[ 3. 서버에서 패키지 설치 ]
--------------------------------------------------------------------------------

3-1. 백엔드 패키지 설치
cd ~/AiSogeThing
source venv/bin/activate
pip install -r requirements.txt

3-2. 프론트엔드 패키지 설치
cd ~/AiSogeThing/front
npm install


[ 4. 서버 실행 (PM2) ]
--------------------------------------------------------------------------------

4-1. 백엔드 실행 (8080 포트)
cd ~/AiSogeThing/back
pm2 start "source ../venv/bin/activate && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8080" --name "backend"
http://168.107.52.201:8080

4-2. 프론트엔드 실행 (3000 포트)
cd ~/AiSogeThing/front
pm2 start "npm run dev -- --host 0.0.0.0 --port 3000" --name "frontend"
http://168.107.52.201:3000

[ 5. PM2 관리 명령어 ]
--------------------------------------------------------------------------------

5-1. 실행 목록 확인
pm2 list

5-2. 실시간 로그 보기 (나가기: Ctrl+C)
pm2 logs

5-3. 특정 프로세스 로그
pm2 logs backend
pm2 logs frontend

5-4. 서버 재시작
pm2 restart backend
pm2 restart frontend
pm2 restart all

5-5. 서버 중지
pm2 stop backend
pm2 stop frontend
pm2 stop all

5-6. 서버 삭제 (완전 제거)
pm2 delete backend
pm2 delete frontend
pm2 delete all

5-7. 프로세스 강제 종료 (PM2 안 쓸 때)
pkill -f uvicorn
pkill -f node


[ 6. 포트 확인 ]
--------------------------------------------------------------------------------

6-1. 열려있는 포트 확인
sudo netstat -tulpn | grep LISTEN

6-2. 특정 포트 확인 (예: 8080)
sudo lsof -i :8080
sudo netstat -tulpn | grep 8080

6-3. 현재 프로젝트 관련 포트 확인
sudo netstat -tulpn | grep -E ':(80|443|3000|8080)'

포트 설명:
- 80   : HTTP (Nginx)
- 443  : HTTPS (Nginx SSL)
- 3000 : 프론트엔드 개발 서버
- 8080 : 백엔드 FastAPI


[ 7. 방화벽 설정 ]
--------------------------------------------------------------------------------

7-1. 포트 개방 (최초 1회)
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 8080 -j ACCEPT
sudo netfilter-persistent save

7-2. 방화벽 규칙 확인
sudo iptables -L -n


[ 8. 시스템 관리 ]
--------------------------------------------------------------------------------

8-1. 시스템 업데이트
sudo apt update && sudo apt upgrade -y

8-2. 디스크 용량 확인
df -h

8-3. 메모리 사용량 확인
free -h

8-4. CPU 사용량 확인
top
htop


[ 9. Node.js 버전 관리 ]
--------------------------------------------------------------------------------

9-1. 현재 버전 확인
node -v
npm -v

9-2. Node.js 20 버전으로 업그레이드
sudo apt remove -y nodejs
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v


[ 10. 트러블슈팅 ]
--------------------------------------------------------------------------------

10-1. 프론트엔드 라이브러리 초기화
cd ~/AiSogeThing/front
rm -rf node_modules package-lock.json
npm install

10-2. 백엔드 가상환경 재생성
cd ~/AiSogeThing
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

10-3. 로그 파일 확인
tail -f ~/AiSogeThing/back/server.log
tail -f ~/.pm2/logs/backend-out.log
tail -f ~/.pm2/logs/backend-error.log


================================================================================
