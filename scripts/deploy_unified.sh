#!/bin/bash

# ==========================================
#  AiSogeThing 통합 자동 배포 스크립트
# ==========================================

PROJECT_DIR="/home/ubuntu/AiSogeThing"
BACK_DIR="$PROJECT_DIR/back"
FRONT_DIR="$PROJECT_DIR/front"

echo "🚀 [1/6] 최신 코드 다운로드 (Git Reset --hard)..."
cd "$PROJECT_DIR"
git fetch --all
git reset --hard origin/main

echo "🐍 [2/6] 백엔드 업데이트 (Pip & DB)..."
cd "$BACK_DIR"
source ../venv/bin/activate
pip install -r ../requirements.txt

# [Fix] 서버에서는 DB 포트(5100)를 사용하도록 설정
export DB_PORT=5100

# DB 마이그레이션 적용
alembic upgrade head

echo "⚛️ [3/6] 프론트엔드 업데이트 (npm install)..."
cd "$FRONT_DIR"
npm install
 
# Vite 캐시 삭제 (강제 최신화)
echo "🧹 Vite 캐시 삭제 중..."
rm -rf node_modules/.vite

# 프로덕션 빌드
npm run build

echo "🔥 [4/6] PM2 프로세스 재시작 (완전 삭제 후 재시작)..."
# 기존 프로세스 완전 삭제
pm2 delete backend || true
pm2 delete frontend || true

# 새로 시작
cd "$BACK_DIR"
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8100" --name backend --update-env

cd "$FRONT_DIR"
pm2 start "npm run dev" --name frontend --update-env

echo "⚙️ [5/6] Nginx 설정 업데이트..."
NGINX_CONF="$PROJECT_DIR/nginx_game_sogething.conf"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
SITE_NAME="game.sogething"

if [ -f "$NGINX_CONF" ]; then
    echo "✅ Nginx 설정 파일 발견: $NGINX_CONF"
    
    # sites-available에 설정 파일 복사
    sudo cp "$NGINX_CONF" "$NGINX_SITES_AVAILABLE/$SITE_NAME"
    
    # sites-enabled에 심볼릭 링크 생성 (기존 링크 삭제 후 새로 생성)
    sudo rm -f "$NGINX_SITES_ENABLED/$SITE_NAME"
    sudo ln -s "$NGINX_SITES_AVAILABLE/$SITE_NAME" "$NGINX_SITES_ENABLED/$SITE_NAME"
    
    # Nginx 설정 테스트
    if sudo nginx -t; then
        echo "✅ Nginx 설정 테스트 통과"
        # Nginx 재시작
        sudo systemctl reload nginx
        echo "✅ Nginx 재시작 완료"
    else
        echo "❌ Nginx 설정 테스트 실패! 설정을 확인하세요."
        exit 1
    fi
else
    echo "⚠️ Nginx 설정 파일을 찾을 수 없습니다: $NGINX_CONF"
    echo "Nginx 설정 업데이트를 건너뜁니다."
fi

echo "🎉 [6/6] 배포 완료! (Deployment Success)"
echo "📊 PM2 상태:"
pm2 status

echo "🌐 접속 주소:"
echo "   - Frontend: https://game.sogething.com"
echo "   - Backend API: https://game.sogething.com/api/"
echo "   - Swagger Docs: https://game.sogething.com/docs"

# 실행 권한 한 번만 주고
# 커맨드 : chmod +x scripts/deploy_unified.sh
# 바로 실행!
# 커맨드 : ./scripts/deploy_unified.sh
