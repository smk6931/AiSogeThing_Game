param(
    [string]$OutputDir = "",
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $ProjectRoot ".env"
$DockerConfigDir = Join-Path $ProjectRoot ".docker"

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

$envMap = Get-EnvMap $EnvPath
$DbUser = Get-RequiredValue $envMap "DB_USER" "game_sogething"
$DbPassword = Get-RequiredValue $envMap "DB_PASSWORD" "0000"
$DbHost = Get-RequiredValue $envMap "DB_HOST" "127.0.0.1"
$DbPort = Get-RequiredValue $envMap "DB_PORT" "5100"
$DbName = Get-RequiredValue $envMap "DB_NAME" "game_sogething"
$DbContainerName = Get-RequiredValue $envMap "DB_CONTAINER_NAME" "game-sogething-db"

if (-not $OutputDir) {
    $OutputDir = Join-Path $ProjectRoot "backups\deploy"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
New-Item -ItemType Directory -Force -Path $DockerConfigDir | Out-Null
$env:DOCKER_CONFIG = $DockerConfigDir
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$DumpFile = Join-Path $OutputDir "$DbName-$timestamp.sql"

if (-not $Quiet) {
    Write-Host "Creating PostgreSQL dump..." -ForegroundColor Cyan
}

$dockerContainerRunning = $false
$dockerState = docker inspect -f "{{.State.Running}}" $DbContainerName 2>$null
if ($LASTEXITCODE -eq 0 -and ($dockerState | Select-Object -First 1).Trim() -eq "true") {
    $dockerContainerRunning = $true
}

if ($dockerContainerRunning) {
    $ContainerDumpPath = "/tmp/$DbName-$timestamp.sql"

    & docker exec -e "PGPASSWORD=$DbPassword" $DbContainerName sh -c "rm -f '$ContainerDumpPath'"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to remove previous container dump file."
    }

    & docker exec -e "PGPASSWORD=$DbPassword" $DbContainerName pg_dump `
        --clean `
        --if-exists `
        --no-owner `
        --no-privileges `
        -U $DbUser `
        -d $DbName `
        -f $ContainerDumpPath

    if ($LASTEXITCODE -ne 0) {
        throw "docker exec pg_dump failed."
    }

    & docker cp "${DbContainerName}:$ContainerDumpPath" $DumpFile
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $DumpFile)) {
        throw "docker cp dump export failed."
    }

    & docker exec -e "PGPASSWORD=$DbPassword" $DbContainerName sh -c "rm -f '$ContainerDumpPath'" | Out-Null
} else {
    $PgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
    if (-not $PgDump) {
        throw "Neither Docker DB container nor host pg_dump is available."
    }

    $previousPassword = $env:PGPASSWORD
    $env:PGPASSWORD = $DbPassword
    try {
        & $PgDump.Source `
            --clean `
            --if-exists `
            --no-owner `
            --no-privileges `
            -h $DbHost `
            -p $DbPort `
            -U $DbUser `
            -d $DbName `
            -f $DumpFile

        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $DumpFile)) {
            throw "pg_dump failed."
        }
    }
    finally {
        $env:PGPASSWORD = $previousPassword
    }
}

if (-not $Quiet) {
    Write-Host "Dump created: $DumpFile" -ForegroundColor Green
}

Write-Output $DumpFile
