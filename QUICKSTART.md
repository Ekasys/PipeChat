# PipelinePro Quick Start Guide

## Prerequisites

1. **Python 3.11+** - [Download](https://www.python.org/downloads/)
2. **PostgreSQL 14+** - [Download](https://www.postgresql.org/download/) OR use Docker
3. **Node.js 18+** - [Download](https://nodejs.org/) (for frontend)
4. **Docker** (optional) - [Download](https://www.docker.com/products/docker-desktop)

## Quick Start Options

### Option 1: Docker (Recommended - Easiest)

```powershell
# Start all services (PostgreSQL, Redis, Backend)
docker-compose up -d

# Run database migrations
docker-compose exec backend alembic upgrade head

# Access the application
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/api/docs
# Frontend: http://localhost:5173 (after starting frontend)
```

### Option 2: Manual Setup

#### Step 1: Setup Database

Install and start PostgreSQL, then create a database:

```sql
CREATE DATABASE pipelinepro;
```

#### Step 2: Configure Backend

```powershell
# Navigate to backend
cd backend

# Copy environment file
Copy-Item .env.example .env

# Edit .env and update DATABASE_URL:
# DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/pipelinepro
```

#### Step 3: Install Backend Dependencies

```powershell
cd backend
pip install -r requirements.txt
```

#### Step 4: Run Database Migrations

```powershell
cd backend
alembic upgrade head
```

#### Step 5: Start Backend Server

```powershell
# Use the startup script
..\start_backend.ps1

# OR manually:
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend will be available at: http://127.0.0.1:8000
API Documentation: http://127.0.0.1:8000/api/docs

#### Step 6: Start Frontend (Optional)

```powershell
# Use the startup script
.\start_frontend.ps1

# OR manually:
cd frontend
npm install
npm run dev
```

Frontend will be available at: http://localhost:5173

## Troubleshooting

### Database Connection Error

If you see database connection errors:

1. **Check PostgreSQL is running:**
   ```powershell
   # Windows: Check services
   Get-Service postgresql*
   ```

2. **Verify DATABASE_URL in backend/.env:**
   ```
   DATABASE_URL=postgresql+asyncpg://username:password@localhost:5432/pipelinepro
   ```

3. **Test connection:**
   ```powershell
   psql -U postgres -d pipelinepro -c "SELECT 1;"
   ```

### Port Already in Use

If port 8000 is already in use:

1. Change the port in the startup command:
   ```powershell
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
   ```

2. Or stop the process using port 8000:
   ```powershell
   netstat -ano | findstr :8000
   taskkill /PID <PID> /F
   ```

### Missing Dependencies

If you see import errors:

```powershell
cd backend
pip install -r requirements.txt
```

### Frontend Build Errors

```powershell
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## First Time Setup

1. **Create a superuser/admin account:**
   ```powershell
   cd backend
   python setup_admin_simple.py
   ```
   
   This will create:
   - Default tenant
   - Admin user with credentials:
     - **Username:** `admin`
     - **Email:** `admin@pipelinepro.com`
     - **Password:** `admin123`
   
   For interactive setup (custom password):
   ```powershell
   python setup_admin.py
   ```

2. **Access the application:**
   - Backend API: http://127.0.0.1:8000/api/docs
   - Frontend: http://localhost:5173
   - Login with the admin credentials created above

## Development Tips

- Backend auto-reloads on code changes (--reload flag)
- Frontend hot-reloads automatically
- Check logs in the terminal for errors
- Use API docs at `/api/docs` to test endpoints

## Next Steps

- Review the [API Documentation](docs/API.md)
- Check the [Deployment Guide](docs/DEPLOYMENT.md)
- Explore the codebase structure

