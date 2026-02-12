"""Setup script to create initial admin user"""
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.database import Base
from app.models.tenant import Tenant
from app.models.user import User
from app.core.security import hash_password
import uuid
from datetime import datetime

# Get database URL from environment or use default
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
    """Create default tenant and admin user"""
    # Create async engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        # Ensure tables exist
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Check if tenant exists
        result = await session.execute(select(Tenant).limit(1))
        tenant = result.scalar_one_or_none()
        
        if not tenant:
            # Create default tenant
            tenant = Tenant(
                id=str(uuid.uuid4()),
                name="Default Tenant",
                is_active=True,
            )
            session.add(tenant)
            await session.commit()
            await session.refresh(tenant)
            print(f"✅ Created tenant: {tenant.name} (ID: {tenant.id})")
        else:
            print(f"✅ Using existing tenant: {tenant.name} (ID: {tenant.id})")
        
        # Check if admin user exists
        result = await session.execute(
            select(User).where(
                (User.username == "admin") | (User.email == "admin@pipelinepro.com")
            )
        )
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            print(f"⚠️  Admin user already exists: {existing_user.username}")
            print(f"   Email: {existing_user.email}")
            response = input("   Do you want to reset the password? (y/n): ")
            if response.lower() == 'y':
                new_password = input("   Enter new password (or press Enter for 'admin123'): ").strip()
                if not new_password:
                    new_password = "admin123"
                existing_user.hashed_password = hash_password(new_password)
                existing_user.is_active = True
                await session.commit()
                print(f"✅ Password updated for user: {existing_user.username}")
                print(f"\n📋 Login Credentials:")
                print(f"   Username: {existing_user.username}")
                print(f"   Email: {existing_user.email}")
                print(f"   Password: {new_password}")
            return
        
        # Create admin user
        admin_password = input("Enter admin password (or press Enter for 'admin123'): ").strip()
        if not admin_password:
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
        
        print(f"\n✅ Admin user created successfully!")
        print(f"\n📋 Login Credentials:")
        print(f"   Username: {admin_user.username}")
        print(f"   Email: {admin_user.email}")
        print(f"   Password: {admin_password}")
        print(f"   Role: {admin_user.role}")
        print(f"\n🚀 You can now log in to the application!")
        print(f"   Frontend: http://localhost:5173")
        print(f"   API Docs: http://127.0.0.1:8000/api/docs")
    
    await engine.dispose()


if __name__ == "__main__":
    try:
        asyncio.run(setup_admin())
    except KeyboardInterrupt:
        print("\n❌ Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error during setup: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

