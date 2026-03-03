"""add character_descriptions column

Revision ID: 40c5f2b8a1e2
Revises: faef00269395
Create Date: 2026-01-28 20:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '40c5f2b8a1e2'
down_revision: Union[str, Sequence[str], None] = 'faef00269395'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('novels', sa.Column('character_descriptions', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('novels', 'character_descriptions')
