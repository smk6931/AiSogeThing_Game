"""add gold and attack to game_character

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-04-05

"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('game_character', sa.Column('gold', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('game_character', sa.Column('attack', sa.Integer(), nullable=False, server_default='12'))


def downgrade():
    op.drop_column('game_character', 'attack')
    op.drop_column('game_character', 'gold')
