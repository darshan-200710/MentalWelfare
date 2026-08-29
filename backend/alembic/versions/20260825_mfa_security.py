"""add MFA-ready account state

Revision ID: 20260825_mfa_security
Revises: 20260825_initial
Create Date: 2026-08-25
"""

import sqlalchemy as sa
from alembic import op

revision = "20260825_mfa_security"
down_revision = "20260825_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    op.drop_column("users", "mfa_enabled")
