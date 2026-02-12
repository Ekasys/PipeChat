"""Add processing status to market_intel

Revision ID: 004_processing_status
Revises: 003_capture_qualification
Create Date: 2026-01-29

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = '004_processing_status'
down_revision = '003_capture_qual'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) DEFAULT 'idle'")
    op.execute("ALTER TABLE market_intel ADD COLUMN IF NOT EXISTS processing_error TEXT")


def downgrade():
    op.execute("ALTER TABLE market_intel DROP COLUMN IF EXISTS processing_error")
    op.execute("ALTER TABLE market_intel DROP COLUMN IF EXISTS processing_status")
