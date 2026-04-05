"""add ui_settings to game_character

Revision ID: g4h5i6j7k8l9
Revises: f3a4b5c6d7e8
Create Date: 2026-04-05

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'g4h5i6j7k8l9'
down_revision = 'f3a4b5c6d7e8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'game_character',
        sa.Column('ui_settings', JSONB, nullable=True, server_default=None)
    )


def downgrade():
    op.drop_column('game_character', 'ui_settings')
