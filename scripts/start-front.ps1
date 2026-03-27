param(
    [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$RunDir = Join-Path $PSScriptRoot "run"
$LogDir = Join-Path $PSScriptRoot "logs"
$PidPath = Join-Path $RunDir "frontend.pid"
$OutLog = Join-Path $LogDir "frontend.out.log"
$ErrLog = Join-Path $LogDir "frontend.err.log"
$EnvPath = Join-Path $ProjectRoot ".env"
$FrontendDir = Join-Path $ProjectRoot "front"
$NpmCmd = "npm.cmd"

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

$envMap = Get-EnvMap $EnvPath
$frontendPort = 3100

if ($envMap.ContainsKey("FRONTEND_PORT")) {
    $frontendPort = [int]$envMap["FRONTEND_PORT"]
} elseif ($envMap.ContainsKey("VITE_PORT")) {
    $frontendPort = [int]$envMap["VITE_PORT"]
} elseif ($envMap.ContainsKey("PORT")) {
    $frontendPort = [int]$envMap["PORT"]
}

$existing = Get-RunningProcess $PidPath
if ($existing -and -not $ForceRestart) {
    Write-Host "Frontend already running on PID $($existing.Id) (port $frontendPort)."
    Write-Host "Logs: $OutLog"
    exit 0
}

if ($existing -and $ForceRestart) {
    Stop-Process -Id $existing.Id -Force
    Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

if (Test-Path $OutLog) { Remove-Item -LiteralPath $OutLog -Force }
if (Test-Path $ErrLog) { Remove-Item -LiteralPath $ErrLog -Force }

$process = Start-Process -FilePath "powershell.exe" `
    -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-Command", "`$env:PORT='$frontendPort'; & '$NpmCmd' run dev -- --host 0.0.0.0 --port $frontendPort --strictPort"
    ) `
    -WorkingDirectory $FrontendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -PassThru

Set-Content -Encoding UTF8 -Path $PidPath -Value $process.Id

Write-Host "Frontend started."
Write-Host "PID: $($process.Id)"
Write-Host "Port: $frontendPort"
Write-Host "Logs: $OutLog"
