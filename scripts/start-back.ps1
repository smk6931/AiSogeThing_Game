param(
    [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RunDir = Join-Path $PSScriptRoot "run"
$LogDir = Join-Path $PSScriptRoot "logs"
$PidPath = Join-Path $RunDir "backend.pid"
$OutLog = Join-Path $LogDir "backend.out.log"
$ErrLog = Join-Path $LogDir "backend.err.log"
$EnvPath = Join-Path $ProjectRoot ".env"
$PythonExe = Join-Path $ProjectRoot "venv\Scripts\python.exe"
$BackendDir = Join-Path $ProjectRoot "back"

New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

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

function Get-RunningProcess([string]$PidFile) {
    if (-not (Test-Path $PidFile)) {
        return $null
    }

    $pidValue = (Get-Content -Encoding UTF8 $PidFile | Select-Object -First 1).Trim()
    if (-not $pidValue) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        return $null
    }

    $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
    if (-not $process) {
        Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
        return $null
    }

    return $process
}

if (-not (Test-Path $PythonExe)) {
    throw "Python executable not found: $PythonExe"
}

$envMap = Get-EnvMap $EnvPath
$backendPort = 8100

if ($envMap.ContainsKey("BACKEND_PORT")) {
    $backendPort = [int]$envMap["BACKEND_PORT"]
} elseif ($envMap.ContainsKey("API_PORT")) {
    $backendPort = [int]$envMap["API_PORT"]
} elseif ($envMap.ContainsKey("VITE_API_URL") -and $envMap["VITE_API_URL"]) {
    $uri = [System.Uri]$envMap["VITE_API_URL"]
    if ($uri.Port -gt 0) {
        $backendPort = $uri.Port
    }
}

$existing = Get-RunningProcess $PidPath
if ($existing -and -not $ForceRestart) {
    Write-Host "Backend already running on PID $($existing.Id) (port $backendPort)."
    Write-Host "Logs: $OutLog"
    exit 0
}

if ($existing -and $ForceRestart) {
    Stop-Process -Id $existing.Id -Force
    Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

try {
    if (Test-Path $OutLog) { Remove-Item -LiteralPath $OutLog -Force }
    if (Test-Path $ErrLog) { Remove-Item -LiteralPath $ErrLog -Force }
} catch {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $OutLog = Join-Path $LogDir "backend-$timestamp.out.log"
    $ErrLog = Join-Path $LogDir "backend-$timestamp.err.log"
}

$process = Start-Process -FilePath "powershell.exe" `
    -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command", "Set-Location '$BackendDir'; `$env:PYTHONUTF8='1'; `$env:PYTHONIOENCODING='utf-8'; & '$PythonExe' -m uvicorn main:app --host 127.0.0.1 --port $backendPort"
    ) `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Encoding UTF8 -Path $PidPath -Value $process.Id

Write-Host "Backend started."
Write-Host "PID: $($process.Id)"
Write-Host "Port: $backendPort"
Write-Host "Logs: $OutLog"
