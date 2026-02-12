"""add_ai_providers_table

Revision ID: 7a836fb59f86
Revises: 3ddcc25dda02
Create Date: 2025-11-09 16:00:48.693797

"""
from datetime import datetime
import json
import os
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '7a836fb59f86'
down_revision = '3ddcc25dda02'
branch_labels = None
depends_on = None


def _table_exists(connection, table_name: str) -> bool:
    inspector = sa.inspect(connection)
    return table_name in inspector.get_table_names()


def _index_exists(connection, table_name: str, index_name: str) -> bool:
    inspector = sa.inspect(connection)
    try:
        return any(idx.get("name") == index_name for idx in inspector.get_indexes(table_name))
    except Exception:
        return False


def upgrade() -> None:
    connection = op.get_bind()

    if not _table_exists(connection, "ai_providers"):
        op.create_table(
            'ai_providers',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('tenant_id', sa.String(), nullable=False),
            sa.Column('provider_name', sa.String(length=100), nullable=False),
            sa.Column('display_name', sa.String(length=200), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('connection_config', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
            sa.PrimaryKeyConstraint('id')
        )

    index_name = op.f('ix_ai_providers_tenant_id')
    if _table_exists(connection, "ai_providers") and not _index_exists(connection, "ai_providers", index_name):
        op.create_index(index_name, 'ai_providers', ['tenant_id'], unique=False)

    # Pre-populate with OpenAI provider from environment variable.
    openai_api_key = os.getenv('OPENAI_API_KEY')
    openai_model = os.getenv('OPENAI_MODEL', 'gpt-5')

    if openai_api_key and _table_exists(connection, "ai_providers"):
        tenants_result = connection.execute(sa.text("SELECT id FROM tenants"))
        tenants = tenants_result.fetchall()

        for tenant_row in tenants:
            tenant_id = tenant_row[0]
            provider_id = str(uuid.uuid4())
            now = datetime.utcnow()

            connection_config = {
                "api_key": openai_api_key,
                "api_endpoint": "https://api.openai.com/v1",
                "default_model": openai_model,
                "temperature": 0.7,
                "max_tokens": 2000,
            }

            connection.execute(
                sa.text(
                    """
                    INSERT INTO ai_providers
                        (id, tenant_id, provider_name, display_name, is_active, is_default, connection_config, created_at, updated_at)
                    SELECT
                        :id, :tenant_id, :provider_name, :display_name, :is_active, :is_default, CAST(:connection_config AS JSONB), :created_at, :updated_at
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM ai_providers
                        WHERE tenant_id = :tenant_id
                          AND provider_name = :provider_name
                    )
                    """
                ),
                {
                    "id": provider_id,
                    "tenant_id": tenant_id,
                    "provider_name": "chatgpt",
                    "display_name": "OpenAI ChatGPT",
                    "is_active": True,
                    "is_default": True,
                    "connection_config": json.dumps(connection_config),
                    "created_at": now,
                    "updated_at": now,
                }
            )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {op.f('ix_ai_providers_tenant_id')}")
    op.execute("DROP TABLE IF EXISTS ai_providers")
