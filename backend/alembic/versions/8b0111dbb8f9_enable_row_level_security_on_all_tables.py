"""enable row level security on all tables

Revision ID: 8b0111dbb8f9
Revises: 2d1af25fca13
Create Date: 2026-10-05 00:08:42.560027

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "8b0111dbb8f9"
down_revision: str | Sequence[str] | None = "2d1af25fca13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = [
    "users",
    "projects",
    "api_keys",
    "traces",
    "spans",
    "model_prices",
    "alert_rules",
    "alert_events",
]


def upgrade() -> None:
    """Enable Row Level Security on all tables in PostgreSQL."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in TABLES:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")


def downgrade() -> None:
    """Disable Row Level Security on all tables in PostgreSQL."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in TABLES:
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
