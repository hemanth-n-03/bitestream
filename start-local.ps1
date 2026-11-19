# BiteStream Local Academic Demo Launcher (Windows PowerShell)
# Usage:
#   .\start-local.ps1            -> Starts Backend (port 5000) & Frontend (port 5173)
#   .\start-local.ps1 -SeedDemo  -> Ensures seeded Mysuru kitchens + demo analytics orders first

param(
  [switch]$SeedDemo
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"

if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
  Write-Error "Missing backend\.env. Copy backend\.env.example to backend\.env and configure MONGODB_URI and JWT_SECRET first."
}

if ($SeedDemo) {
  Write-Host "[BiteStream] Seeding Mysuru kitchens, dishes, riders, and demo analytics orders..." -ForegroundColor Cyan
  npm run seed:demo --prefix $BackendDir
}

Write-Host "[BiteStream] Starting Backend API + Socket.IO + MongoDB Change Streams (http://localhost:5000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; npm run dev"

Write-Host "[BiteStream] Starting Frontend Vite Dev Server (http://localhost:5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontendDir'; npm run dev"

Write-Host "`nReady for live academic demo:" -ForegroundColor Yellow
Write-Host "  Storefront : http://localhost:5173"
Write-Host "  API Health : http://localhost:5000/api/health"
Write-Host "  Demo Pass  : SeedPass@2026"
