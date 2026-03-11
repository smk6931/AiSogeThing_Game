# ========================================================
#  AiSogeThing 원클릭 배포 스크립트 (Windows용)
# ========================================================
# 사용법: .\deploy.ps1 "커밋 메시지"

param (
    [string]$CommitMessage = "Update: Auto-deploy via script"
)

# 1. SSH 키 설정 (환경 변수에서 로드)
$EnvFile = "..\.env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

$SSH_KEY = $env:SSH_KEY_PATH
$SSH_HOST = $env:SSH_HOST
$REMOTE_DIR = $env:REMOTE_DIR

if (-not $SSH_KEY -or -not $SSH_HOST) {
    Write-Host "❌ SSH 설정이 없습니다! .env 파일을 확인하세요." -ForegroundColor Red
    exit
}

Write-Host "🚀 [1/3] Git Push 진행 중..." -ForegroundColor Cyan

# Git 작업
git add .
git commit -m "$CommitMessage"
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git Push 실패! 배포를 중단합니다." -ForegroundColor Red
    exit
}

Write-Host "✅ Git Push 완료!" -ForegroundColor Green
Write-Host "🚀 [2/3] 서버 접속 및 전체 배포 실행..." -ForegroundColor Cyan

# 2. SSH를 통해 원격에서 통합 배포 스크립트 실행
$RemoteCommand = @"
cd $REMOTE_DIR && 
chmod +x scripts/deploy_unified.sh && 
./scripts/deploy_unified.sh
"@

ssh -i $SSH_KEY $SSH_HOST $RemoteCommand

Write-Host "🎉 [3/3] 배포 완료! (서버 로그를 확인하세요)" -ForegroundColor Green
