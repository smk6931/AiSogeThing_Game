#!/bin/bash

# ==========================================
#  AiSogeThing 자동 배포 스크립트 (PM2 버전)
# ==========================================

PROJECT_DIR="/home/ubuntu/AiSogeThing"
BACK_DIR="$PROJECT_DIR/back"
FRONT_DIR="$PROJECT_DIR/front"

echo "🚀 [1/4] 최신 코드 다운로드 (Git Reset --hard)..."
cd "$PROJECT_DIR"
git fetch --all
git reset --hard origin/main

echo "🐍 [2/4] 백엔드 업데이트 (Pip & DB)..."
cd "$BACK_DIR"
source ../venv/bin/activate
pip install -r ../requirements.txt

# [Fix] 서버에서는 로컬 DB 포트(5432)를 사용하도록 강제 설정
export DB_PORT=5432

# DB 마이그레이션 적용
alembic upgrade head

echo "⚛️ [3/4] 프론트엔드 업데이트 (npm install)..."
cd "$FRONT_DIR"
npm install
 
# Vite 캐시 삭제 (강제 최신화)
echo "🧹 Vite 캐시 삭제 중..."
rm -rf node_modules/.vite

# 프로덕션 빌드
npm run build

echo "🔥 [4/4] PM2 프로세스 재시작 (완전 삭제 후 재시작)..."
# 기존 프로세스 완전 삭제
pm2 delete backend || true
pm2 delete frontend || true

# 새로 시작 (빌드된 파일 기준으로 시작해야 함. ecosystem.config.js 확인 필요)
# 임시로 dev 서버 다시 시작 (나중에 serve로 바꿔야 함)
cd "$BACK_DIR"
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8400" --name backend --update-env

cd "$FRONT_DIR"
pm2 start "npm run dev" --name frontend --update-env

echo "� [Add-on] Nginx 설정 업데이트..."
NGINX_CONF="$PROJECT_DIR/nginx_sogething.conf"
if [ -f "$NGINX_CONF" ]; then
    # 설정 파일을 실제 사용되는 sogething 파일에 복사
    sudo cp "$NGINX_CONF" /etc/nginx/sites-available/sogething
    # 설정 테스트 후 리로드
    sudo nginx -t && sudo systemctl reload nginx
    echo "✅ Nginx 설정이 업데이트되고 재시작되었습니다."
else
    echo "⚠️ Nginx 설정 파일을 찾을 수 없습니다: $NGINX_CONF"
fi

echo "�🎉 배포 완료! (Deployment Success)"
pm2 status


# 실행 권한 한 번만 주고
# 커맨드 : chmod +x Project_Docs/Server/deploy.sh
# 바로 실행!
# 커맨드 : ./Project_Docs/Server/deploy.sh