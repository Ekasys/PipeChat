"""Database connection and session management"""
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from sqlalchemy.engine.url import make_url
from app.config import settings

def _build_engine_config():
    url = make_url(settings.DATABASE_URL)
    connect_args = {}
    if url.drivername.endswith("+asyncpg"):
        query = dict(url.query)
        ssl_mode = str(query.pop("sslmode", "")).lower()
        ssl_flag = str(query.pop("ssl", "")).lower()
        env_ssl = os.getenv("DATABASE_SSL", "").lower()
        ssl_required = ssl_mode in {"require", "verify-ca", "verify-full"} or ssl_flag in {"true", "1", "require"}
        if ssl_required or env_ssl in {"true", "1", "require"}:
            connect_args["ssl"] = True
        url = url.set(query=query)
    return url, connect_args


# Create async engine
engine_url, engine_connect_args = _build_engine_config()
engine = create_async_engine(
    engine_url,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DEBUG,
    future=True,
    connect_args=engine_connect_args,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncSession:
    """Dependency for getting database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database (create tables + lightweight schema reconciliation).

    This project historically relied on SQLAlchemy `create_all()`. `create_all()`
    will not add columns/constraints to existing tables, which can cause runtime
    errors after models evolve (e.g., missing `documents.proposal_volume_id`).

    We keep a small, idempotent reconciliation step here so local/dev databases
    can self-heal without requiring a full Alembic migration workflow.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # ---- Reconcile known critical columns/constraints (idempotent) ----
        # Documents ↔ ProposalVolume linkage (required by Document model)
        await conn.execute(
            text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS proposal_volume_id VARCHAR")
        )
        await conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_documents_proposal_volume_id ON documents (proposal_volume_id)")
        )
        await conn.execute(
            text(
                """
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_documents_proposal_volume_id'
          AND table_name = 'documents'
    ) THEN
        ALTER TABLE documents
        ADD CONSTRAINT fk_documents_proposal_volume_id
        FOREIGN KEY (proposal_volume_id) REFERENCES proposal_volumes (id);
    END IF;
END $$;
"""
            )
        )

        # ProposalVolume fields added over time (idempotent)
        await conn.execute(text("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS page_limit VARCHAR(50)"))
        await conn.execute(text("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS rfp_sections JSON"))
        await conn.execute(text("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS executive_summary TEXT"))
        await conn.execute(text("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS technical_approach TEXT"))
        await conn.execute(text("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS rfp_reference JSON"))
        await conn.execute(text("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0"))
        # Add source column if missing; assumes enum values are uppercase (USER/RFP/TEMPLATE)
        await conn.execute(text("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS source structuresource DEFAULT 'USER'"))
        # Ensure NOT NULL + defaults (safe no-op if already)
        await conn.execute(text("ALTER TABLE proposal_volumes ALTER COLUMN order_index SET DEFAULT 0"))
        await conn.execute(text("ALTER TABLE proposal_volumes ALTER COLUMN source SET DEFAULT 'USER'"))
        # Make volume_type nullable (ignore if already nullable)
        await conn.execute(
            text(
                """
DO $$
BEGIN
    BEGIN
        ALTER TABLE proposal_volumes ALTER COLUMN volume_type DROP NOT NULL;
    EXCEPTION
        WHEN undefined_column THEN NULL;
        WHEN others THEN NULL;
    END;
END $$;
"""
            )
        )


async def close_db():
    """Close database connections"""
    await engine.dispose()


