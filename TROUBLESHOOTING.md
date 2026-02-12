# Troubleshooting Guide

## Backend Connection Issues

### Error: `ECONNREFUSED` or `http proxy error`

This means the backend server is not running.

**Solution:**
1. Open a new terminal/PowerShell window
2. Navigate to the backend directory:
   ```powershell
   cd backend
   ```
3. Start the backend server:
   ```powershell
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

4. Verify it's running by visiting:
   - Health check: http://127.0.0.1:8000/health
   - API docs: http://127.0.0.1:8000/api/docs

### Backend Won't Start

**Common Issues:**

1. **Database not running**
   - Make sure PostgreSQL is running
   - Check DATABASE_URL in `backend/.env`

2. **Port 8000 already in use**
   - Change the port in the uvicorn command
   - Update `vite.config.ts` proxy target

3. **Missing dependencies**
   ```powershell
   cd backend
   pip install -r requirements.txt
   ```

4. **Database connection error**
   - Verify PostgreSQL is running
   - Check DATABASE_URL format: `postgresql://user:password@localhost:5432/dbname`
   - Ensure database `pipelinepro` exists

### Frontend Can't Connect to Backend

1. **Check backend is running:**
   ```powershell
   # Test health endpoint
   Invoke-WebRequest -Uri "http://127.0.0.1:8000/health"
   ```

2. **Check proxy configuration:**
   - File: `frontend/vite.config.ts`
   - Should proxy `/api` to `http://localhost:8000`

3. **Check CORS settings:**
   - Backend should allow `http://localhost:5173`
   - Check `backend/app/config.py` CORS_ORIGINS

## Quick Start Commands

**Backend:**
```powershell
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend:**
```powershell
cd frontend
npm install
npm run dev
```

## Verify Everything is Working

1. Backend health: http://127.0.0.1:8000/health
2. API docs: http://127.0.0.1:8000/api/docs
3. Frontend: http://localhost:5173
4. Login and try creating an opportunity

