"""Pytest configuration and fixtures"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from fastapi.testclient import TestClient

# Test database URL (in-memory SQLite for tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture
async def db_session():
    """Create a test database session"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestSessionLocal() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def client(db_session):
    """Create a test client"""
    def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
async def test_tenant(db_session):
    """Create a test tenant"""
    from app.models.tenant import Tenant
    import uuid
    
    tenant = Tenant(
        id=str(uuid.uuid4()),
        name="Test Tenant",
        is_active=True,
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest.fixture
async def test_user(db_session, test_tenant):
    """Create a test user"""
    from app.models.user import User
    from app.core.security import hash_password
    import uuid
    
    user = User(
        id=str(uuid.uuid4()),
        tenant_id=test_tenant.id,
        email="test@example.com",
        username="testuser",
        hashed_password=hash_password("testpassword"),
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user

