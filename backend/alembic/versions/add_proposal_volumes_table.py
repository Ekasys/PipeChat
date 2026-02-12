"""add_proposal_volumes_table

Revision ID: a1b2c3d4e5f6
Revises: 7a836fb59f86
Create Date: 2025-01-27 10:00:00.000000

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '7a836fb59f86'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enums if missing.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'volumetype') THEN
                CREATE TYPE volumetype AS ENUM ('technical', 'management', 'past_performance', 'pricing', 'executive_summary', 'other');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'volumestatus') THEN
                CREATE TYPE volumestatus AS ENUM ('draft', 'in_review', 'approved', 'final', 'locked');
            END IF;
        END $$;
        """
    )

    # Create proposal_volumes table only if missing.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS proposal_volumes (
            id VARCHAR PRIMARY KEY,
            proposal_id VARCHAR NOT NULL REFERENCES proposals(id),
            tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
            owner_id VARCHAR NULL REFERENCES users(id),
            name VARCHAR(500) NOT NULL,
            volume_type volumetype NOT NULL,
            status volumestatus NOT NULL DEFAULT 'draft',
            description TEXT,
            content TEXT,
            compliance_notes TEXT,
            page_count VARCHAR(50),
            word_count INTEGER,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
        )
        """
    )

    op.execute("CREATE INDEX IF NOT EXISTS ix_proposal_volumes_proposal_id ON proposal_volumes (proposal_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_proposal_volumes_tenant_id ON proposal_volumes (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_proposal_volumes_owner_id ON proposal_volumes (owner_id)")

    # Add proposal_volume_id to documents table if missing.
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS proposal_volume_id VARCHAR")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_proposal_volume_id ON documents (proposal_volume_id)")
    op.execute(
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


def downgrade() -> None:
    op.execute("ALTER TABLE documents DROP CONSTRAINT IF EXISTS fk_documents_proposal_volume_id")
    op.execute("DROP INDEX IF EXISTS ix_documents_proposal_volume_id")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS proposal_volume_id")

    op.execute("DROP INDEX IF EXISTS ix_proposal_volumes_owner_id")
    op.execute("DROP INDEX IF EXISTS ix_proposal_volumes_tenant_id")
    op.execute("DROP INDEX IF EXISTS ix_proposal_volumes_proposal_id")
    op.execute("DROP TABLE IF EXISTS proposal_volumes")

    op.execute("DROP TYPE IF EXISTS volumestatus")
    op.execute("DROP TYPE IF EXISTS volumetype")
