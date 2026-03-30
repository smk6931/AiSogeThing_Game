# ========================================================
#  AiSogeThing deployment script
#  local git push -> local DB dump -> upload -> remote restore
# ========================================================

param(
    [string]$CommitMessage = "Update: Auto-deploy via script"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
Write-Host "Working Directory: $ProjectRoot"

$EnvPath = Join-Path $ProjectRoot ".env"
$ComposePath = Join-Path $ProjectRoot "docker-compose.server.yml"
$DeployDir = Join-Path $ProjectRoot "backups\deploy"
$LocalBackupScript = Join-Path $PSScriptRoot "local_backup_db.ps1"

function Get-EnvMap([string]$Path) {
    $map = @{}
    if (-not (Test-Path $Path)) {
        return $map
    }

    Get-Content -Encoding UTF8 $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }

        $parts = $line.Split("=", 2)
        $key = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        $map[$key] = $value
    }

    return $map
}

function Get-RequiredValue($Map, [string]$Key, [string]$Default = "") {
    if ($Map.ContainsKey($Key) -and $Map[$Key]) {
        return $Map[$Key]
    }
    return $Default
}

if (-not (Test-Path $EnvPath)) {
    throw ".env not found: $EnvPath"
}

if (-not (Test-Path $ComposePath)) {
    throw "docker-compose.server.yml not found: $ComposePath"
}

$localBackupExists = Test-Path $LocalBackupScript
if (-not $localBackupExists) {
    throw "local_backup_db.ps1 not found: $LocalBackupScript"
}

$envMap = Get-EnvMap $EnvPath

$SshKey = Get-RequiredValue $envMap "SSH_KEY_PATH" "C:\Users\ssh\ssh-key-oracle.key"
$SshHost = Get-RequiredValue $envMap "SSH_HOST" "ubuntu@168.107.52.201"
$RemoteDir = Get-RequiredValue $envMap "REMOTE_DIR" "~/game.sogething"
$RemoteDirShell = if ($RemoteDir.StartsWith("~/")) { '$HOME/' + $RemoteDir.Substring(2) } else { $RemoteDir }
$RemoteDirScp = $RemoteDir

$DbUser = Get-RequiredValue $envMap "DB_USER" "game_sogething"
$DbPassword = Get-RequiredValue $envMap "DB_PASSWORD" "0000"
$DbHost = Get-RequiredValue $envMap "DB_HOST" "127.0.0.1"
$DbPort = Get-RequiredValue $envMap "DB_PORT" "5100"
$DbName = Get-RequiredValue $envMap "DB_NAME" "game_sogething"

New-Item -ItemType Directory -Force -Path $DeployDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$DumpFile = ""
$RemoteDeployDir = "$RemoteDirShell/.deploy"
$RemoteDeployDirScp = "$RemoteDirScp/.deploy"
$RemoteDumpName = [System.IO.Path]::GetFileName($DumpFile)

Write-Host "[1/7] Git push..." -ForegroundColor Cyan
git add .
git commit -m "$CommitMessage"
if ($LASTEXITCODE -ne 0) {
    Write-Host "No new commit created or commit failed. Continuing to push current branch state." -ForegroundColor Yellow
}
git push origin main
if ($LASTEXITCODE -ne 0) {
    throw "Git push failed."
}
Write-Host "Git push completed." -ForegroundColor Green

Write-Host "[2/7] Create local PostgreSQL dump..." -ForegroundColor Cyan
$DumpFile = (& $LocalBackupScript -OutputDir $DeployDir -Quiet | Select-Object -Last 1).Trim()
if (-not $DumpFile -or -not (Test-Path $DumpFile)) {
    throw "Local backup script did not produce a valid dump file."
}
$RemoteDumpName = [System.IO.Path]::GetFileName($DumpFile)
Write-Host "Local dump created: $DumpFile" -ForegroundColor Green

Write-Host "[3/7] Prepare remote deploy directory..." -ForegroundColor Cyan
ssh -i "$SshKey" "$SshHost" "mkdir -p $RemoteDeployDir"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to prepare remote deploy directory."
}

Write-Host "[4/7] Upload .env, compose, and SQL dump..." -ForegroundColor Cyan
scp -i "$SshKey" "$EnvPath" "$SshHost`:$RemoteDirScp/.env"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to upload .env."
}
scp -i "$SshKey" "$ComposePath" "$SshHost`:$RemoteDirScp/docker-compose.server.yml"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to upload docker-compose.server.yml."
}
scp -i "$SshKey" "$DumpFile" "$SshHost`:$RemoteDeployDirScp/$RemoteDumpName"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to upload SQL dump."
}

Write-Host "[5/7] Run remote deploy..." -ForegroundColor Cyan
$RemoteCommand = @'
set -e

RESTORE_REQUESTED=0
REMOTE_DB_BACKUP=''
APP_STOPPED=0

rollback_db() {
    if [ "$RESTORE_REQUESTED" != "1" ]; then
        exit 1
    fi

    if [ -n "$REMOTE_DB_BACKUP" ] && [ -f "$REMOTE_DB_BACKUP" ]; then
        echo '[Rollback] Restoring previous server DB backup...'
        docker exec -e PGPASSWORD="$DB_PASSWORD" game-sogething-db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE;"
        docker exec -e PGPASSWORD="$DB_PASSWORD" game-sogething-db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA public;"
        docker exec -e PGPASSWORD="$DB_PASSWORD" -i game-sogething-db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$REMOTE_DB_BACKUP" || true
        echo '[Rollback] Previous DB restore attempted.'
    else
        echo '[Rollback] No previous DB backup found. Nothing to restore.'
    fi

    if [ "$APP_STOPPED" = "1" ]; then
        echo '[Rollback] Restarting PM2 apps after DB restore attempt...'
        pm2 restart game-back > /dev/null 2>&1 || true
        pm2 restart game-front > /dev/null 2>&1 || true
    fi
}

trap 'rollback_db' ERR

if [ ! -d __REMOTE_DIR__/.git ]; then
    echo '[Initial Setup] Clone project...'
    mkdir -p __REMOTE_DIR__
    rm -rf __REMOTE_DIR__/repo_bootstrap
    git clone https://github.com/smk6931/AiSogeThing_Game.git __REMOTE_DIR__/repo_bootstrap
    cp -a __REMOTE_DIR__/repo_bootstrap/. __REMOTE_DIR__/
    rm -rf __REMOTE_DIR__/repo_bootstrap
fi

cd __REMOTE_DIR__

if [ ! -f .env ]; then
    echo '.env is missing on remote server'
    exit 1
fi

tr -d '\r' < .env > .env.runtime

set -a
. ./.env.runtime
set +a

if [ ! -f docker-compose.server.yml ]; then
    echo 'docker-compose.server.yml is missing on remote server'
    exit 1
fi

if [ ! -f '.deploy/__REMOTE_DUMP__' ]; then
    echo 'SQL dump file is missing on remote server'
    exit 1
fi

echo '[Remote 1/6] Pull latest code...'
git fetch --all
git reset --hard origin/main

echo '[Remote 2/6] Ensure runtime dependencies...'
if [ ! -d venv ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt

if docker compose version > /dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose > /dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo 'Neither docker compose nor docker-compose is available'
    exit 1
fi

echo '[Remote 3/6] Start PostgreSQL container...'
$COMPOSE_CMD -f docker-compose.server.yml up -d db

echo '[Remote 4/6] Wait for PostgreSQL health...'
for i in {1..30}; do
    if docker exec game-sogething-db pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        break
    fi
    sleep 2
done

if ! docker exec game-sogething-db pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    echo 'PostgreSQL did not become ready in time'
    exit 1
fi

echo '[Remote 5/6] Backup current server DB before restore...'
mkdir -p .deploy/server-pre-restore
REMOTE_DB_BACKUP=".deploy/server-pre-restore/__DB_NAME__-pre-__TIMESTAMP__.sql"
docker exec -e PGPASSWORD="$DB_PASSWORD" game-sogething-db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --no-privileges > "$REMOTE_DB_BACKUP"

echo '[Remote 5.1/6] Stop PM2 apps before DB reset...'
pm2 stop game-back > /dev/null 2>&1 || true
pm2 stop game-front > /dev/null 2>&1 || true
APP_STOPPED=1

echo '[Remote 5.2/6] Reset PostgreSQL public schema...'
docker exec -e PGPASSWORD="$DB_PASSWORD" game-sogething-db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE;"
docker exec -e PGPASSWORD="$DB_PASSWORD" game-sogething-db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "CREATE SCHEMA public;"

echo '[Remote 5.3/6] Restore SQL dump into PostgreSQL...'
RESTORE_REQUESTED=1
docker exec -e PGPASSWORD="$DB_PASSWORD" -i game-sogething-db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < '.deploy/__REMOTE_DUMP__'

echo '[Remote 5.4/6] Run Alembic migration after restore...'
cd back
source ../venv/bin/activate
alembic upgrade head
cd ..

echo '[Remote 6/6] Build frontend and restart PM2...'
cd front
npm install
rm -rf node_modules/.vite dist
npm run build
cd ..

pm2 delete backend > /dev/null 2>&1 || true
pm2 delete frontend > /dev/null 2>&1 || true

if pm2 list | grep -q 'game-back'; then
    pm2 reload game-back --update-env
else
    cd back
    pm2 start 'uvicorn main:app --host 0.0.0.0 --port 8100' --name game-back --update-env
    cd ..
fi

if pm2 list | grep -q 'game-front'; then
    pm2 reload game-front --update-env
else
    pm2 serve front/dist 3100 --name game-front --spa
fi

if [ -f nginx_game_sogething.conf ]; then
    sudo cp nginx_game_sogething.conf /etc/nginx/sites-available/game.sogething
    sudo rm -f /etc/nginx/sites-enabled/game.sogething
    sudo ln -s /etc/nginx/sites-available/game.sogething /etc/nginx/sites-enabled/game.sogething
    sudo nginx -t && sudo systemctl reload nginx
fi

RESTORE_REQUESTED=0
APP_STOPPED=0
pm2 status
echo 'Deployment completed.'
'@

$RemoteCommand = $RemoteCommand.Replace('__REMOTE_DIR__', $RemoteDirShell)
$RemoteCommand = $RemoteCommand.Replace('__REMOTE_DUMP__', $RemoteDumpName)
$RemoteCommand = $RemoteCommand.Replace('__DB_NAME__', $DbName)
$RemoteCommand = $RemoteCommand.Replace('__TIMESTAMP__', $timestamp)

$RemoteCommand | ssh -i "$SshKey" "$SshHost" "bash"
if ($LASTEXITCODE -ne 0) {
    throw "Remote deployment failed."
}

Write-Host "[6/7] Remote deployment completed." -ForegroundColor Green
Write-Host "[7/7] SQL backup kept locally: $DumpFile" -ForegroundColor Green
Write-Host "Access URL: https://game.sogething.com" -ForegroundColor Cyan
