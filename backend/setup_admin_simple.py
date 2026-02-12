"""Simple setup script to create initial admin user (non-interactive)"""
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.database import Base, _build_engine_config
from app.models.tenant import Tenant
from app.models.user import User
from app.core.security import hash_password
import uuid
from datetime import datetime

# Get database URL from environment
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/pipelinepro")

# Ensure we're using asyncpg for async operations
if "postgresql://" in DATABASE_URL and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
elif "postgresql+psycopg2" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql+psycopg2", "postgresql+asyncpg")


async def setup_admin():
    """Create default tenant and admin user with default credentials"""
    engine_url, engine_connect_args = _build_engine_config()
    engine = create_async_engine(
        engine_url,
        echo=False,
        connect_args=engine_connect_args or {},
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Get or create tenant
        result = await session.execute(select(Tenant).limit(1))
        tenant = result.scalar_one_or_none()
        
        if not tenant:
            tenant = Tenant(
                id=str(uuid.uuid4()),
                name="Default Tenant",
                is_active=True,
            )
            session.add(tenant)
            await session.commit()
            await session.refresh(tenant)
            print(f"Created tenant: {tenant.name}")
        else:
            print(f"Using existing tenant: {tenant.name}")
        
        # Check if admin user exists
        result = await session.execute(
            select(User).where(
                (User.username == "admin") | (User.email == "admin@pipelinepro.com")
            )
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print(f"Admin user already exists: {existing_user.username}")
            print(f"   Email: {existing_user.email}")
            print(f"\n📋 Login Credentials:")
            print(f"   Username: {existing_user.username}")
            print(f"   Email: {existing_user.email}")
            print(f"   Password: (existing password)")
            return
        
        # Create admin user with default password
        admin_password = "admin123"
        admin_user = User(
            id=str(uuid.uuid4()),
            tenant_id=tenant.id,
            email="admin@pipelinepro.com",
            username="admin",
            hashed_password=hash_password(admin_password),
            first_name="Admin",
            last_name="User",
            role="admin",
            is_active=True,
            is_superuser=True,
        )
        
        session.add(admin_user)
        await session.commit()
        await session.refresh(admin_user)
        
        print(f"\nAdmin user created successfully!")
        print(f"\n📋 Login Credentials:")
        print(f"   Username: admin")
        print(f"   Email: admin@pipelinepro.com")
        print(f"   Password: admin123")
        print(f"   Role: admin")
        print(f"\n🚀 You can now log in to the application!")
        print(f"   Frontend: http://localhost:5173")
        print(f"   API Docs: http://127.0.0.1:8000/api/docs")
    
    await engine.dispose()


if __name__ == "__main__":
    try:
        asyncio.run(setup_admin())
    except Exception as e:
        print(f"\nError during setup: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
