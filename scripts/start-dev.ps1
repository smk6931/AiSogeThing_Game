param(
    [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

$startBack = Join-Path $PSScriptRoot "start-back.ps1"
$startFront = Join-Path $PSScriptRoot "start-front.ps1"

if ($ForceRestart) {
    & $startBack -ForceRestart
    & $startFront -ForceRestart
} else {
    & $startBack
    & $startFront
}
