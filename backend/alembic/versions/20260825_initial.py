"""initial Sentinel schema

Revision ID: 20260825_initial
Revises:
Create Date: 2026-08-25
"""

from alembic import op

from app.database.session import Base
import app.database.models  # noqa: F401

revision = "20260825_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
