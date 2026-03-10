#!/bin/bash

echo "=== 1. Nginx 설치 및 설정 시작 ==="
sudo apt update
sudo apt install -y nginx

echo "=== 2. 설정 파일 복사 ==="
# 기존 default 삭제
sudo rm -f /etc/nginx/sites-enabled/default

# 새 설정 파일 이동
sudo cp /home/ubuntu/nginx_sogething.conf /etc/nginx/sites-available/sogething

# 심볼릭 링크 생성
sudo ln -sf /etc/nginx/sites-available/sogething /etc/nginx/sites-enabled/

echo "=== 3. 방화벽 포트 열기 (80, 443) ==="
# Oracle Cloud iptables 규칙 추가
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

echo "=== 4. Nginx 재시작 ==="
sudo nginx -t
sudo systemctl reload nginx

echo "=== 5. Frontend 환경변수 수정 (.env) ==="
# VITE_API_URL을 빈 값(상대경로)으로 설정하여 Nginx 프록시를 타게 함
# 기존 라인이 있다면 수정, 없다면 추가
ENV_FILE="/home/ubuntu/AiSogeThing/front/.env"
if grep -q "VITE_API_URL" "$ENV_FILE"; then
    sed -i 's|VITE_API_URL=.*|VITE_API_URL=|g' "$ENV_FILE"
else
    echo "VITE_API_URL=" >> "$ENV_FILE"
fi

echo "✅ Nginx 설정 완료! 이제 http://sogething.com 으로 접속해보세요."
echo ""
echo "⚠️ [HTTPS 적용 방법]"
echo "sudo apt install -y certbot python3-certbot-nginx"
echo "sudo certbot --nginx -d sogething.com -d www.sogething.com"
