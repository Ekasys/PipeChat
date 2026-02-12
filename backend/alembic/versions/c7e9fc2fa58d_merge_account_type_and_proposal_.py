"""merge account_type and proposal structure branches

Revision ID: c7e9fc2fa58d
Revises: add_account_type, add_dynamic_proposal_structure
Create Date: 2026-01-09 01:48:50.744366

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7e9fc2fa58d'
down_revision = ('add_account_type', 'add_dynamic_proposal_structure')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass


