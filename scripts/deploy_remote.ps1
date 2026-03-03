# ========================================================
#  AiSogeThing 원클릭 배포 스크립트 (Windows용)
# ========================================================
# 사용법: .\deploy_remote.ps1 "커밋 메시지"

param (
    [string]$CommitMessage = "Update: Auto-deploy via script"
)

# 1. SSH 키 설정 (사용자 환경에 맞게 수정됨)
$SSH_KEY = "C:\Users\ssh\ssh-key-oracle.key"
$SSH_HOST = "ubuntu@168.107.52.201"
$REMOTE_DIR = "~/AiSogeThing"

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
Write-Host "🚀 [2/3] 서버 접속 및 배포 명령 전송..." -ForegroundColor Cyan

# 2. SSH를 통해 원격 명령 실행 (git reset + deploy.sh)
# 주의: 서버의 deploy.sh가 실행 권한이 있어야 함
$RemoteCommand = "cd $REMOTE_DIR && git fetch --all && git reset --hard origin/main && chmod +x scripts/deploy.sh && ./scripts/deploy.sh"

ssh -i $SSH_KEY $SSH_HOST $RemoteCommand

Write-Host "🎉 [3/3] 배포 명령 전송 완료! (서버 로그를 확인하세요)" -ForegroundColor Green
