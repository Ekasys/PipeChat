"""add_ekchat_schema_rls

Revision ID: 005_ekchat_schema
Revises: 004_processing_status
Create Date: 2026-02-09

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "005_ekchat_schema"
down_revision = "004_processing_status"
branch_labels = None
depends_on = None


_TABLES = [
    "chats",
    "messages",
    "chat_files",
    "rfp_sessions",
    "rfp_outputs_capability_matrix",
    "rfp_outputs_shred_document",
    "plot_artifacts",
    "vector_chunks",
]


def _apply_rls(table_name: str) -> None:
    policy_name = f"{table_name}_tenant_user_isolation"
    op.execute(f"ALTER TABLE ekchat.{table_name} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE ekchat.{table_name} FORCE ROW LEVEL SECURITY")
    op.execute(f"DROP POLICY IF EXISTS {policy_name} ON ekchat.{table_name}")
    op.execute(
        f"""
        CREATE POLICY {policy_name}
        ON ekchat.{table_name}
        USING (
            tenant_id = current_setting('app.tenant_id', true)
            AND user_id = current_setting('app.user_id', true)
        )
        WITH CHECK (
            tenant_id = current_setting('app.tenant_id', true)
            AND user_id = current_setting('app.user_id', true)
        )
        """
    )


def _create_vector_chunks_table() -> None:
    # Use pgvector when available; fallback to float array for local dev DBs.
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
                EXECUTE '
                    CREATE TABLE IF NOT EXISTS ekchat.vector_chunks (
                        id BIGSERIAL PRIMARY KEY,
                        tenant_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        chat_id TEXT REFERENCES ekchat.chats(id) ON DELETE CASCADE,
                        source_id TEXT,
                        chunk_index INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        embedding VECTOR(1536),
                        metadata JSONB,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                ';
            ELSE
                EXECUTE '
                    CREATE TABLE IF NOT EXISTS ekchat.vector_chunks (
                        id BIGSERIAL PRIMARY KEY,
                        tenant_id TEXT NOT NULL,
                        user_id TEXT NOT NULL,
                        chat_id TEXT REFERENCES ekchat.chats(id) ON DELETE CASCADE,
                        source_id TEXT,
                        chunk_index INTEGER NOT NULL,
                        content TEXT NOT NULL,
                        embedding DOUBLE PRECISION[],
                        metadata JSONB,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                ';
            END IF;
        END $$;
        """
    )


def upgrade() -> None:
    # pgvector may be unavailable in local Docker postgres image; continue without hard-failing.
    op.execute(
        """
        DO $$
        BEGIN
            BEGIN
                CREATE EXTENSION IF NOT EXISTS vector;
            EXCEPTION
                WHEN undefined_file THEN
                    RAISE NOTICE 'pgvector extension not installed; using fallback embedding type';
                WHEN insufficient_privilege THEN
                    RAISE NOTICE 'No privilege to create vector extension; using fallback embedding type';
            END;
        END $$;
        """
    )

    op.execute("CREATE SCHEMA IF NOT EXISTS ekchat")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ekchat.chats (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            title TEXT,
            model TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ekchat.messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL REFERENCES ekchat.chats(id) ON DELETE CASCADE,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ekchat.chat_files (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL REFERENCES ekchat.chats(id) ON DELETE CASCADE,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT,
            blob_path TEXT NOT NULL,
            file_size BIGINT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ekchat.rfp_sessions (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            kind TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            payload JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ekchat.rfp_outputs_capability_matrix (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            rfp_name TEXT NOT NULL,
            model TEXT,
            prompt_version TEXT,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ekchat.rfp_outputs_shred_document (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            rfp_name TEXT NOT NULL,
            model TEXT,
            prompt_version TEXT,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS ekchat.plot_artifacts (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL REFERENCES ekchat.chats(id) ON DELETE CASCADE,
            tenant_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            blob_path TEXT NOT NULL,
            metadata JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )

    _create_vector_chunks_table()

    op.execute("CREATE INDEX IF NOT EXISTS ix_ekchat_chats_tenant_user ON ekchat.chats (tenant_id, user_id, updated_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ekchat_messages_chat_ts ON ekchat.messages (chat_id, ts)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ekchat_messages_tenant_user ON ekchat.messages (tenant_id, user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ekchat_chat_files_chat ON ekchat.chat_files (chat_id, created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ekchat_rfp_sessions_tenant_user ON ekchat.rfp_sessions (tenant_id, user_id, created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ekchat_cap_matrix_tenant_user ON ekchat.rfp_outputs_capability_matrix (tenant_id, user_id, created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ekchat_shred_tenant_user ON ekchat.rfp_outputs_shred_document (tenant_id, user_id, created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ekchat_plot_artifacts_chat ON ekchat.plot_artifacts (chat_id, created_at DESC)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_ekchat_vector_chunks_tenant_user ON ekchat.vector_chunks (tenant_id, user_id)")

    for table in _TABLES:
        _apply_rls(table)


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS ekchat CASCADE")
