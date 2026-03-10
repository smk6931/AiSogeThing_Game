===================================================================
WebSocket 연결 실패 문제 해결 보고서
===================================================================
작성일: 2026-02-01
소요 시간: 약 1시간 30분

===================================================================
0. Nginx 설정 파일 구조 (필독)
===================================================================

[Nginx 설정 파일 시스템]
-------------------------------------------------------------------
Nginx는 2단계 디렉토리 구조로 설정을 관리합니다:

1) sites-available/ (보관소)
   - 역할: 모든 설정 파일 보관
   - 위치: /etc/nginx/sites-available/
   - 특징: 여기 있어도 작동 안 함 (대기 상태)
   - 예시:
     ├── default    (Nginx 설치 시 기본 예제, 삭제 가능)
     ├── sogething  (실제 사용 설정)
     └── 기타...

2) sites-enabled/ (활성화)
   - 역할: 실제 적용할 설정만 선택
   - 위치: /etc/nginx/sites-enabled/
   - 특징: 심볼릭 링크로 연결된 것만 Nginx가 읽음
   - 예시:
     └── sogething -> /etc/nginx/sites-available/sogething

[설정 ON/OFF 방법]
-------------------------------------------------------------------
# ON (활성화)
sudo ln -s /etc/nginx/sites-available/sogething \
           /etc/nginx/sites-enabled/sogething

# OFF (비활성화)
sudo rm /etc/nginx/sites-enabled/sogething

# 확인
ls -la /etc/nginx/sites-enabled/

[배포 프로세스]
-------------------------------------------------------------------
로컬 환경:
  c:\GitHub\AiSogeThing\nginx_sogething.conf
  ↓ (Git push)
서버 Git 레포:
  /home/ubuntu/AiSogeThing/nginx_sogething.conf
  ↓ (./scripts/deploy.sh 실행)
서버 시스템:
  /etc/nginx/sites-available/sogething (자동 덮어쓰기)
  ↓ (심볼릭 링크)
  /etc/nginx/sites-enabled/sogething (Nginx가 읽음)

[중요 포인트]
-------------------------------------------------------------------
1. 로컬에서는 nginx_sogething.conf만 수정
2. deploy.sh가 자동으로 서버의 sogething 파일 업데이트
3. sites-enabled에 링크된 것만 실제 적용됨
4. default 파일은 Nginx 기본 예제 (무시됨, 삭제 가능)
5. 여러 사이트 운영 시 ON/OFF 스위치로 유연하게 관리 가능

[현재 프로젝트 상태]
-------------------------------------------------------------------
사용 중: sogething (ON)
무시됨: default (삭제됨)
관리 방법: 로컬 nginx_sogething.conf만 수정 → 배포 자동 적용
최종 상태: 해결 완료

===================================================================
1. 문제 증상
===================================================================

[로컬 환경]
- WebSocket 연결 정상 작동
- URL: ws://localhost:8001/api/game/ws/{user_id}/{nickname}

[서버 환경]
- WebSocket 연결 실패 (404 Not Found)  
- URL: wss://sogething.com/api/game/ws/{user_id}/{nickname}
- 브라우저 에러: "WebSocket is closed before the connection is established"

===================================================================
2. 근본 원인 분석
===================================================================

[핵심 문제]
Nginx 설정 파일 불일치로 인한 WebSocket Upgrade 헤더 누락

[상세 원인]

1) Nginx 설정 파일 구조 문제
-------------------------------------------------------------------
서버에는 2개의 Nginx 설정 파일이 존재:

/etc/nginx/sites-available/default
  - 내용: 올바른 WebSocket 설정 포함
  - 상태: sites-enabled에 링크 없음 (적용 안 됨)

/etc/nginx/sites-available/sogething  
  - 내용: 옛날 설정, WebSocket 헤더 누락
  - 상태: sites-enabled/sogething으로 심볼릭 링크 (실제 적용됨)

심볼릭 링크 구조:
/etc/nginx/sites-enabled/sogething -> /etc/nginx/sites-available/sogething

결과: Nginx는 sogething 파일만 읽고, default는 완전히 무시


2) 옛날 sogething 파일의 치명적 문제
-------------------------------------------------------------------
location /api {
    proxy_pass http://localhost:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

누락된 필수 설정:
- proxy_http_version 1.1;  (WebSocket은 HTTP/1.1 필수)
- proxy_set_header Upgrade $http_upgrade;
- proxy_set_header Connection $connection_upgrade;
- map $http_upgrade $connection_upgrade { ... }


3) WebSocket 프로토콜 요구사항 미충족
-------------------------------------------------------------------
WebSocket은 HTTP Upgrade 메커니즘을 사용:

1. 클라이언트가 HTTP 요청에 특수 헤더 포함:
   - Upgrade: websocket
   - Connection: Upgrade

2. 서버가 101 Switching Protocols 응답

3. 이후 WebSocket 프로토콜로 전환

Nginx가 이 헤더들을 FastAPI에 전달하지 않아 404 발생


4) 로컬과 서버 동작 차이
-------------------------------------------------------------------
로컬:
  브라우저 -> localhost:8001 (직접 연결)
  -> FastAPI 직접 수신 (Nginx 없음)
  -> WebSocket 정상

서버:
  브라우저 -> https://sogething.com (Nginx 443)
  -> Nginx가 Upgrade 헤더 제거
  -> FastAPI가 일반 GET 요청으로 수신
  -> WebSocket 라우터 매칭 실패 (404)

===================================================================
3. 해결 과정
===================================================================

[1단계] 문제 진단
-------------------------------------------------------------------
- FastAPI 라우터 확인: /api/game/ws/{user_id}/{nickname} 정상 등록
- Nginx access log 확인: WebSocket 요청이 HTTP GET으로 기록
- Nginx 설정 출력: sites-enabled에 sogething 파일 발견

[2단계] Nginx 설정 파일 확인  
-------------------------------------------------------------------
명령어:
  sudo nginx -T 2>/dev/null | grep "location /api/"
  
결과: 아무것도 출력 안 됨 (설정 누락 확인)

sites-enabled 확인:
  ls -la /etc/nginx/sites-enabled/
  
결과: sogething -> ../sites-available/sogething (심볼릭 링크)

실제 파일 확인:
  cat /etc/nginx/sites-available/sogething
  
결과: WebSocket 헤더 전혀 없음

[3단계] 올바른 설정 적용
-------------------------------------------------------------------
명령어:
  sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/sogething
  sudo nginx -t
  sudo systemctl restart nginx

검증:
  sudo nginx -T 2>/dev/null | grep "location /api/" -A 10
  
결과:
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $connection_upgrade;
  
  -> WebSocket 설정 정상 적용 확인

[4단계] 테스트
-------------------------------------------------------------------
1. Backend PM2 재시작
2. Frontend 프로덕션 빌드 재배포 (npx serve)
3. 브라우저 강력 새로고침 (Ctrl + Shift + R)
4. 게임 페이지 접속

결과: WebSocket 연결 성공!

===================================================================
4. 올바른 Nginx 설정
===================================================================

[전역 설정 - /etc/nginx/nginx.conf]
-------------------------------------------------------------------
http {
    # WebSocket Upgrade Map (필수)
    map $http_upgrade $connection_upgrade {
        default upgrade;
        '' close;
    }
    
    # 나머지 설정...
}

[사이트별 설정 - /etc/nginx/sites-available/sogething]
-------------------------------------------------------------------
server {
    server_name sogething.com www.sogething.com;
    
    location /api/ {
        proxy_pass http://localhost:8080;
        
        # WebSocket 필수 설정
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # 기본 프록시 헤더
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # SSL 설정 (Let's Encrypt)
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/sogething.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sogething.com/privkey.pem;
}

===================================================================
5. 재발 방지 조치
===================================================================

[1] deploy.sh 스크립트 수정
-------------------------------------------------------------------
기존:
  sudo cp nginx_sogething.conf /etc/nginx/sites-available/default
  
문제: default 파일은 sites-enabled에 링크 없어서 적용 안 됨

수정:
  sudo cp nginx_sogething.conf /etc/nginx/sites-available/sogething
  
효과: 실제 사용되는 파일에 직접 배포

[2] 배포 체크리스트 추가
-------------------------------------------------------------------
1. Git push
2. 서버에서 git pull
3. deploy.sh 실행
4. Nginx 설정 검증:
   sudo nginx -T 2>/dev/null | grep "location /api/" -A 5
5. WebSocket 헤더 확인:
   - Upgrade
   - Connection

===================================================================
6. 교훈 및 개선 사항
===================================================================

[핵심 교훈]
-------------------------------------------------------------------
1. Nginx는 sites-enabled의 심볼릭 링크만 읽는다
2. 여러 설정 파일이 있으면 실제 적용되는 파일을 확인해야 함
3. WebSocket은 HTTP Upgrade 헤더가 필수
4. 로컬과 서버 환경 차이 (프록시 유무) 고려 필요

[개선 사항]
-------------------------------------------------------------------
1. 배포 스크립트를 올바른 파일 경로로 수정
2. Nginx 설정 검증 단계 추가 (nginx -T 사용)
3. WebSocket 연결 테스트 자동화 고려
4. 문서화로 재발 방지

===================================================================
참고 자료
===================================================================

[공식 문서]
- Nginx WebSocket Proxy: https://nginx.org/en/docs/http/websocket.html
- MDN WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- FastAPI WebSocket: https://fastapi.tiangolo.com/advanced/websockets/

[관련 파일]
- back/game/router.py (WebSocket 라우터)
- nginx_sogething.conf (Nginx 설정 템플릿)
- scripts/deploy.sh (자동 배포 스크립트)

===================================================================
