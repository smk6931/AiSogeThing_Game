"""merge_conflict

Revision ID: 9ebdea7f2168
Revises: 38d2f1fb75a9, 999999999999
Create Date: 2026-01-25 17:06:39.600110

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9ebdea7f2168'
down_revision: Union[str, Sequence[str], None] = '38d2f1fb75a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
