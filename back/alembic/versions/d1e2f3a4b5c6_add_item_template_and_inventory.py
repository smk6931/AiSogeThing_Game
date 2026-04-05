"""add item_template and character_inventory

Revision ID: d1e2f3a4b5c6
Revises: c4d5e6f7a8b9
Create Date: 2026-04-05

"""
from alembic import op
import sqlalchemy as sa

revision = 'd1e2f3a4b5c6'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'item_template',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name_ko', sa.String(128), nullable=False),
        sa.Column('name_en', sa.String(128), nullable=False),
        sa.Column('item_type', sa.String(32), nullable=False),
        sa.Column('rarity', sa.String(32), nullable=False, server_default='common'),
        sa.Column('stat_bonus', sa.JSON(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon_key', sa.String(128), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
    )

    op.create_table(
        'character_inventory',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False, index=True),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('item_template.id'), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('slot_index', sa.Integer(), nullable=True),
        sa.Column('acquired_at', sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('character_inventory')
    op.drop_table('item_template')
