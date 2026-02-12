"""add dynamic proposal structure

Revision ID: add_dynamic_proposal_structure
Revises: add_volume_narrative_fields
Create Date: 2025-12-11 20:00:00.000000
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = 'add_dynamic_proposal_structure'
down_revision = 'add_volume_narrative_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'structuresource') THEN
                CREATE TYPE structuresource AS ENUM ('rfp', 'user', 'template');
            END IF;
        END $$;
        """
    )

    op.execute("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS source structuresource DEFAULT 'user'")
    op.execute("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0")
    op.execute("ALTER TABLE proposal_volumes ADD COLUMN IF NOT EXISTS rfp_reference JSON")

    op.execute(
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

    op.execute(
        """
        UPDATE proposal_volumes
        SET order_index = subquery.row_num - 1
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY proposal_id ORDER BY created_at) AS row_num
            FROM proposal_volumes
        ) AS subquery
        WHERE proposal_volumes.id = subquery.id
          AND (proposal_volumes.order_index IS NULL OR proposal_volumes.order_index = 0)
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS proposal_sections (
            id VARCHAR PRIMARY KEY,
            volume_id VARCHAR NOT NULL REFERENCES proposal_volumes(id),
            heading VARCHAR(500) NOT NULL,
            order_index INTEGER NOT NULL DEFAULT 0,
            source structuresource NOT NULL DEFAULT 'user',
            rfp_reference JSON,
            parent_section_id VARCHAR NULL REFERENCES proposal_sections(id),
            content TEXT,
            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_proposal_sections_volume_id ON proposal_sections (volume_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_proposal_sections_parent_section_id ON proposal_sections (parent_section_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_proposal_sections_parent_section_id")
    op.execute("DROP INDEX IF EXISTS ix_proposal_sections_volume_id")
    op.execute("DROP TABLE IF EXISTS proposal_sections")

    op.execute("ALTER TABLE proposal_volumes DROP COLUMN IF EXISTS rfp_reference")
    op.execute("ALTER TABLE proposal_volumes DROP COLUMN IF EXISTS order_index")
    op.execute("ALTER TABLE proposal_volumes DROP COLUMN IF EXISTS source")

    op.execute(
        """
        DO $$
        BEGIN
            BEGIN
                ALTER TABLE proposal_volumes ALTER COLUMN volume_type SET NOT NULL;
            EXCEPTION
                WHEN undefined_column THEN NULL;
                WHEN others THEN NULL;
            END;
        END $$;
        """
    )

    op.execute("DROP TYPE IF EXISTS structuresource")
