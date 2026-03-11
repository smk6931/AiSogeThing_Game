# ========================================================
#  AiSogeThing 통합 배포 스크립트 (개선 버전)
# ========================================================

param ([string]$CommitMessage = "Update: Auto-deploy via script")

# Set Location
Set-Location "C:\GitHub\AiSogeThing_Game"
Write-Host "Working Directory: C:\GitHub\AiSogeThing_Game"

# 로컬 .env 직접 읽기
$EnvPath = Join-Path (Get-Location) ".env"
if (Test-Path $EnvPath) {
    Get-Content $EnvPath | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            $key = $parts[0].Trim()
            $value = $parts[1].Trim().Trim('"').Trim("'")
            if ($key -eq "SSH_KEY_PATH") { $SshKey = $value }
            if ($key -eq "SSH_HOST") { $SshHost = $value }
            if ($key -eq "REMOTE_DIR") { $RemoteDir = $value }
        }
    }
}

# 기본값 설정
if (-not $SshKey) { $SshKey = "C:\Users\ssh\ssh-key-oracle.key" }
if (-not $SshHost) { $SshHost = "ubuntu@168.107.52.201" }
if (-not $RemoteDir) { $RemoteDir = "~/game.sogething" }

Write-Host "🚀 [1/5] Git Push in progress..." -ForegroundColor Cyan

# Git 작업
git add .
git commit -m "$CommitMessage"
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git Push failed! Stopping deployment." -ForegroundColor Red
    exit
}

Write-Host "✅ Git Push completed!" -ForegroundColor Green
Write-Host "🚀 [2/5] Connecting to server and running deployment..." -ForegroundColor Cyan

# 서버에서 실행할 전체 명령 (bash stdin으로 전달 예정)
$RemoteCommand = @"
    set -e

    # 프로젝트 폴더가 없으면 초기 설정
    if [ ! -d ~/game.sogething ]; then
        echo "[Initial Setup] Clone project and initial setup..."
        cd ~
        git clone https://github.com/smk6931/AiSogeThing_Game.git game.sogething
        cd game.sogething
        
        # 가상환경 생성
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
        
        # 프론트엔드 의존성 설치
        cd front
        npm install
        cd ..
        
        echo "[Initial Setup] Completed!"
    else
        cd ~/game.sogething
    fi
    
    echo "[Step 1] Download latest code..."
    git fetch --all
    git reset --hard origin/main

    echo "[Step 2] Update backend..."
    cd back
    source ../venv/bin/activate
    pip install -r ../requirements.txt
    export DB_PORT=5100
    alembic upgrade head

    echo "[Step 3] Build frontend..."
    cd ../front
    npm install
    rm -rf node_modules/.vite dist
    npm run build

    echo "[Step 4] Restart PM2 processes..."
    # 백엔드: 무중단 또는 환경변수 업데이트를 위해 restart 사용
    if pm2 list | grep -q "backend"; then
        echo "[PM2] Restarting backend..."
        pm2 restart backend --update-env
    else
        echo "[PM2] Starting backend..."
        pm2 start "uvicorn main:app --host 0.0.0.0 --port 8100" --name backend --update-env
    fi

    # 프론트엔드: Nginx가 빌드된 정적 파일(dist)을 직접 서빙하므로 PM2 프로세스 불필요
    if pm2 list | grep -q "frontend"; then
        echo "[PM2] Removing legacy frontend process..."
        pm2 delete frontend || true
    fi
    
    echo "[Step 5] Update Nginx config..."
    if [ -f ~/game.sogething/nginx_game_sogething.conf ]; then
        sudo cp ~/game.sogething/nginx_game_sogething.conf /etc/nginx/sites-available/game.sogething
        sudo rm -f /etc/nginx/sites-enabled/game.sogething
        sudo ln -s /etc/nginx/sites-available/game.sogething /etc/nginx/sites-enabled/game.sogething
        
        # SSL 인증서 발급 (없을 경우만)
        if [ ! -d /etc/letsencrypt/live/game.sogething.com ]; then
            echo "[SSL] Issue certificate for game.sogething.com..."
            sudo certbot --nginx -d game.sogething.com -d www.game.sogething.com --non-interactive --agree-tos --email admin@sogething.com || \
            echo "WARNING: SSL certificate failed - Check DNS manually"
        fi
        
        sudo nginx -t && sudo systemctl reload nginx
        echo "SUCCESS: Nginx config completed"
    else
        echo "WARNING: Nginx config file not found"
    fi
    echo "Deployment completed!"
    pm2 status
"@

# SSH로 서버에서 전체 배포 실행 (명령어 뭉치기 대신 파이핑 사용으로 주석/개행 문제 원천 차단)
$RemoteCommand | ssh -i "$SshKey" "$SshHost" "bash"

Write-Host "🎉 Deployment completed! (Deployment Completed)" -ForegroundColor Green
Write-Host "🌐 Access URL: https://game.sogething.com" -ForegroundColor Cyan
