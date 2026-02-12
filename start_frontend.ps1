# PipelinePro Frontend Startup Script
Write-Host "Starting PipelinePro Frontend..." -ForegroundColor Cyan

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    cd frontend
    npm install
    cd ..
}

Write-Host "`n🚀 Starting React development server..." -ForegroundColor Green
Write-Host "Frontend will be available at http://localhost:5173" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop the server`n" -ForegroundColor Gray

cd frontend
npm run dev

