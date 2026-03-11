# ========================================================
#  AiSogeThing 통합 배포 스크립트 (단일 파일)
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

Write-Host "🚀 [1/5] Git Push 진행 중..." -ForegroundColor Cyan

# Git 작업
git add .
git commit -m "$CommitMessage"
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git Push 실패! 배포를 중단합니다." -ForegroundColor Red
    exit
}

Write-Host "✅ Git Push 완료!" -ForegroundColor Green
Write-Host "🚀 [2/5] 서버 접속 및 전체 배포 실행..." -ForegroundColor Cyan

# 서버에서 실행할 전체 명령 (하나의 스크립트로 모든 작업)
$RemoteCommand = @'
    # 프로젝트 폴더가 없으면 초기 설정
    if [ ! -d ~/game.sogething ]; then
        echo "[Initial Setup] 프로젝트 클론 및 초기 설정..." &&
        cd ~ &&
        git clone https://github.com/smk6931/AiSogeThing_Game.git game.sogething &&
        cd game.sogething &&
        
        # 가상환경 생성
        python3 -m venv venv &&
        source venv/bin/activate &&
        pip install -r requirements.txt &&
        
        # 프론트엔드 의존성 설치
        cd front &&
        npm install &&
        cd .. &&
        
        echo "[Initial Setup] 완료!";
    else
        cd ~/game.sogething;
    fi &&
    
    echo "[Step 1] 최신 코드 다운로드..." &&
    git fetch --all && 
    git reset --hard origin/main && 
    echo "[Step 2] 백엔드 업데이트..." &&
    cd back &&
    source ../venv/bin/activate &&
    pip install -r ../requirements.txt &&
    export DB_PORT=5100 &&
    alembic upgrade head &&
    echo "[Step 3] 프론트엔드 빌드..." &&
    cd ../front &&
    npm install &&
    rm -rf node_modules/.vite &&
    npm run build &&
    echo "[Step 4] PM2 프로세스 재시작..." &&
    
    # PM2 프로세스가 없으면 최초 설정
    if ! pm2 list | grep -q "backend"; then
        echo "[PM2 Initial] 백엔드 최초 시작..." &&
        pm2 start "uvicorn main:app --host 0.0.0.0 --port 8100" --name backend --update-env;
    else
        pm2 delete backend || true &&
        pm2 start "uvicorn main:app --host 0.0.0.0 --port 8100" --name backend --update-env;
    fi &&
    
    if ! pm2 list | grep -q "frontend"; then
        echo "[PM2 Initial] 프론트엔드 최초 시작..." &&
        cd ../front &&
        pm2 start "npm run dev" --name frontend --update-env;
    else
        pm2 delete frontend || true &&
        cd ../front &&
        pm2 start "npm run dev" --name frontend --update-env;
    fi &&
    
    echo "[Step 5] Nginx 설정 업데이트..." &&
    if [ -f ~/game.sogething/nginx_game_sogething.conf ]; then
        sudo cp ~/game.sogething/nginx_game_sogething.conf /etc/nginx/sites-available/game.sogething &&
        sudo rm -f /etc/nginx/sites-enabled/game.sogething &&
        sudo ln -s /etc/nginx/sites-available/game.sogething /etc/nginx/sites-enabled/game.sogething &&
        sudo nginx -t && sudo systemctl reload nginx &&
        echo "✅ Nginx 설정 완료";
    else
        echo "⚠️ Nginx 설정 파일 없음";
    fi &&
    echo "🎉 배포 완료!" &&
    pm2 status
'@

# SSH로 서버에서 전체 배포 실행
ssh -i "$SshKey" "$SshHost" "$RemoteCommand"

Write-Host "🎉 배포 완료! (Deployment Completed)" -ForegroundColor Green
Write-Host "🌐 접속 주소: https://game.sogething.com" -ForegroundColor Cyan
