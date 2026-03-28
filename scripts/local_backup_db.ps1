param(
    [string]$OutputDir = "",
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $ProjectRoot ".env"

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

$PgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $PgDump) {
    throw "pg_dump not found in PATH. Install PostgreSQL client tools first."
}

if (-not $OutputDir) {
    $OutputDir = Join-Path $ProjectRoot "backups\deploy"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$DumpFile = Join-Path $OutputDir "$DbName-$timestamp.sql"

if (-not $Quiet) {
    Write-Host "Creating PostgreSQL dump..." -ForegroundColor Cyan
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

if (-not $Quiet) {
    Write-Host "Dump created: $DumpFile" -ForegroundColor Green
}

Write-Output $DumpFile
