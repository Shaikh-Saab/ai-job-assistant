# Runs Nexus on Windows: first-time setup if needed, apply new migrations, open the browser, start the app.
$ErrorActionPreference = "Stop"
$AppDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $AppDir
$env:NEXT_TELEMETRY_DISABLED = "1"

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Test-Path ".env") -or -not (Test-Path "node_modules")) {
  Write-Host "First run: setting up Nexus..." -ForegroundColor Cyan
  & (Join-Path $PSScriptRoot "setup.ps1")
}

npx prisma migrate deploy | Out-Null

$busy = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
  Write-Host "Nexus is already running."
  Start-Process "http://localhost:3000"
  exit 0
}

# Open the browser once the server answers.
Start-Job -ScriptBlock {
  for ($i = 0; $i -lt 90; $i++) {
    try { Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:3000/login" -TimeoutSec 2 | Out-Null; Start-Process "http://localhost:3000"; break }
    catch { Start-Sleep -Seconds 1 }
  }
} | Out-Null

Write-Host ""
Write-Host "  Nexus is starting at http://localhost:3000" -ForegroundColor Green
Write-Host "  Demo login: demo@nexus.dev / Password123!"
Write-Host "  Keep this window open while you use the app. Press Ctrl+C to stop."
Write-Host ""
npm run dev
