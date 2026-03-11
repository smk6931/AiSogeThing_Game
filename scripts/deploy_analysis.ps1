# ========================================================
#  AiSogeThing 배포 스크립트 상세 분석
# ========================================================

# 1️⃣ 파라미터 정의
param ([string]$CommitMessage = "Update: Auto-deploy via script")

# 2️⃣ 작업 디렉토리 설정
Set-Location "C:\GitHub\AiSogeThing_Game"
Write-Host "Working Directory: C:\GitHub\AiSogeThing_Game"

# 3️⃣ 환경변수 로드 (외부 파일 없이 직접 처리)
$EnvPath = Join-Path (Get-Location) ".env"
if (Test-Path $EnvPath) {
    # .env 파일 한 줄씩 읽어서 파싱
    Get-Content $EnvPath | ForEach-Object {
        $line = $_.Trim()
        # 주석 제외, = 포함된 라인만 처리
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)  # '=' 기준으로 최대 2개로 분리
            $key = $parts[0].Trim()
            $value = $parts[1].Trim().Trim('"').Trim("'")  # 따옴표 제거
            
            # 각 키에 해당하는 변수에 값 할당
            if ($key -eq "SSH_KEY_PATH") { $SshKey = $value }
            if ($key -eq "SSH_HOST") { $SshHost = $value }
            if ($key -eq "REMOTE_DIR") { $RemoteDir = $value }
        }
    }
}

# 4️⃣ 기본값 설정 (.env에 없을 경우 대비)
if (-not $SshKey) { $SshKey = "C:\Users\ssh\ssh-key-oracle.key" }
if (-not $SshHost) { $SshHost = "ubuntu@168.107.52.201" }
if (-not $RemoteDir) { $RemoteDir = "~/AiSogeThing" }

# 5️⃣ 로컬 Git 작업 시작
Write-Host "🚀 [1/5] Git Push 진행 중..." -ForegroundColor Cyan

# 변경사항 커밋 및 푸시
git add .
git commit -m "$CommitMessage"
git push origin main

# Git Push 실패 시 중단
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git Push 실패! 배포를 중단합니다." -ForegroundColor Red
    exit
}

Write-Host "✅ Git Push 완료!" -ForegroundColor Green

# 6️⃣ 서버에서 실행할 전체 명령 정의 (Here-String 사용)
$RemoteCommand = @'
    cd ~/AiSogeThing && 
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
    pm2 delete backend || true &&
    pm2 delete frontend || true &&
    cd ../back &&
    pm2 start "uvicorn main:app --host 0.0.0.0 --port 8100" --name backend --update-env &&
    cd ../front &&
    pm2 start "npm run dev" --name frontend --update-env &&
    echo "[Step 5] Nginx 설정 업데이트..." &&
    if [ -f ~/AiSogeThing/nginx_game_sogething.conf ]; then
        sudo cp ~/AiSogeThing/nginx_game_sogething.conf /etc/nginx/sites-available/game.sogething &&
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

# 7️⃣ SSH로 서버 접속하여 원격 명령 실행
Write-Host "🚀 [2/5] 서버 접속 및 전체 배포 실행..." -ForegroundColor Cyan
ssh -i "$SshKey" "$SshHost" "$RemoteCommand"

# 8️⃣ 완료 메시지
Write-Host "🎉 배포 완료! (Deployment Completed)" -ForegroundColor Green
Write-Host "🌐 접속 주소: https://game.sogething.com" -ForegroundColor Cyan

# ========================================================
# 실행 순서 요약:
# 1. 파라미터 수신
# 2. 작업 디렉토리 이동
# 3. .env 파일 읽어서 변수 설정
# 4. 기본값 설정
# 5. 로컬 Git Push
# 6. 서버 명령 정의
# 7. SSH 접속 및 서버 명령 실행
# 8. 완료 메시지
# ========================================================
