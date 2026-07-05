# One-command local runner for EnviSys.
# Sets up backend/frontend on first run, then launches both dev servers
# in their own windows so logs stay visible and Ctrl+C in either stops just that one.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$venvPython = Join-Path $backend ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating backend virtual environment..." -ForegroundColor Cyan
    python -m venv (Join-Path $backend ".venv")
}

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
& $venvPython -m pip install -q -r (Join-Path $backend "requirements.txt")

if (-not (Test-Path (Join-Path $backend ".env"))) {
    Copy-Item (Join-Path $backend ".env.example") (Join-Path $backend ".env")
}

Write-Host "Applying migrations and seeding demo data..." -ForegroundColor Cyan
& $venvPython (Join-Path $backend "manage.py") migrate
& $venvPython (Join-Path $backend "manage.py") seed_demo

if (-not (Test-Path (Join-Path $frontend ".env"))) {
    Copy-Item (Join-Path $frontend ".env.example") (Join-Path $frontend ".env")
}

if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    Push-Location $frontend
    npm install
    Pop-Location
}

Write-Host "Launching backend (http://localhost:8000) and frontend (http://localhost:5173)..." -ForegroundColor Green
Start-Process powershell -WorkingDirectory $backend -ArgumentList "-NoExit", "-Command", "& '$venvPython' manage.py runserver"
Start-Process powershell -WorkingDirectory $frontend -ArgumentList "-NoExit", "-Command", "npm run dev"

Write-Host ""
Write-Host "Backend:  http://localhost:8000/api/  (health: /api/health/)"
Write-Host "Frontend: http://localhost:5173"
Write-Host "Demo login: student1@ustp.edu.ph / envisys123 (password same for chair@, adviser1@)"
