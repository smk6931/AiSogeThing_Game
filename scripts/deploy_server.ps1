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

# 서버에서 실행할 전체 명령 (bash stdin으로 전달)
$RemoteCommand = @'
    # 프로젝트 폴더가 없으면 초기 설정
    if [ ! -d ~/game.sogething ]; then
        echo "[Initial Setup] Clone project..."
        cd ~
        git clone https://github.com/smk6931/AiSogeThing_Game.git game.sogething
        cd game.sogething
        python3 -m venv venv
        source venv/bin/activate
        pip install -r requirements.txt
        cd front && npm install && cd ..
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
    # alembic upgrade head (DB 연결 전까지 주석)
    cd ..

    echo "[Step 3] Build frontend..."
    cd front
    npm install
    rm -rf node_modules/.vite dist
    npm run build
    cd ..

    echo "[Step 4] Restart PM2 processes..."
    # Legacy Cleanup (기존 이름 삭제)
    pm2 delete backend > /dev/null 2>&1 || true
    pm2 delete frontend > /dev/null 2>&1 || true

    # Back-end: game-back
    if pm2 list | grep -q "game-back"; then
        echo "[PM2] Reloading game-back..."
        pm2 reload game-back --update-env
    else
        echo "[PM2] Starting game-back..."
        cd back
        pm2 start "uvicorn main:app --host 0.0.0.0 --port 8100" --name game-back --update-env
        cd ..
    fi

    # Front-end: game-front (PM2 serve 방식으로 목록 유지)
    if pm2 list | grep -q "game-front"; then
        echo "[PM2] Reloading game-front..."
        pm2 reload game-front --update-env
    else
        echo "[PM2] Starting game-front..."
        pm2 serve front/dist 3100 --name game-front --spa
    fi
    
    echo "[Step 5] Update Nginx config..."
    if [ -f ~/game.sogething/nginx_game_sogething.conf ]; then
        sudo cp ~/game.sogething/nginx_game_sogething.conf /etc/nginx/sites-available/game.sogething
        sudo rm -f /etc/nginx/sites-enabled/game.sogething
        sudo ln -s /etc/nginx/sites-available/game.sogething /etc/nginx/sites-enabled/game.sogething
        
        # SSL 인증서 (실패 시 무시)
        if [ ! -d /etc/letsencrypt/live/game.sogething.com ]; then
            echo "[SSL] Attempting certificate issue..."
            sudo certbot --nginx -d game.sogething.com -d www.game.sogething.com --non-interactive --agree-tos --email admin@sogething.com || echo "SSL Skip"
        fi
        
        sudo nginx -t && sudo systemctl reload nginx
        echo "SUCCESS: Nginx config completed"
    fi
    echo "Deployment completed!"
    pm2 status
'@

# SSH로 서버에서 전체 배포 실행
$RemoteCommand | ssh -i "$SshKey" "$SshHost" "bash"

Write-Host "🎉 Deployment completed! (Deployment Completed)" -ForegroundColor Green
Write-Host "🌐 Access URL: https://game.sogething.com" -ForegroundColor Cyan
