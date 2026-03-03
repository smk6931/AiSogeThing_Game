"""add thumbnail_image column to novels

Revision ID: 51d6f3c9b2f3
Revises: 40c5f2b8a1e2
Create Date: 2026-01-28 20:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '51d6f3c9b2f3'
down_revision: Union[str, Sequence[str], None] = '40c5f2b8a1e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('novels', sa.Column('thumbnail_image', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('novels', 'thumbnail_image')
