# PipelinePro Backend Startup Script
Write-Host 'Starting PipelinePro Backend...' -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path 'backend\.env')) {
    Write-Host 'Creating .env file from .env.example...' -ForegroundColor Yellow
    Copy-Item 'backend\.env.example' 'backend\.env' -ErrorAction SilentlyContinue
    Write-Host 'Please update backend\.env with your database configuration' -ForegroundColor Yellow
}

# Check Python
$pythonVersion = python --version 2>&1
Write-Host ("Python: {0}" -f $pythonVersion) -ForegroundColor Green

# Install/check dependencies
Write-Host ''
Write-Host 'Checking dependencies...' -ForegroundColor Cyan
Set-Location 'backend'

pip install -q fastapi uvicorn sqlalchemy alembic asyncpg psycopg2-binary pydantic pydantic-settings python-jose passlib pyotp 2>&1 | Out-Null

# Start server
Write-Host ''
Write-Host 'Starting FastAPI server on http://127.0.0.1:8000' -ForegroundColor Green
Write-Host 'API Docs will be available at http://127.0.0.1:8000/api/docs' -ForegroundColor Cyan
Write-Host 'Note: Make sure PostgreSQL is running or update DATABASE_URL in .env' -ForegroundColor Yellow
Write-Host 'Press Ctrl+C to stop the server' -ForegroundColor Gray
Write-Host ''

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
