"""add character_equipment table

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-04-05

"""
from alembic import op
import sqlalchemy as sa

revision = 'f3a4b5c6d7e8'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'character_equipment',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False, index=True),
        sa.Column('slot', sa.String(32), nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('item_template.id'), nullable=False),
        sa.Column('equipped_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_unique_constraint('uq_character_equipment_user_slot', 'character_equipment', ['user_id', 'slot'])


def downgrade():
    op.drop_constraint('uq_character_equipment_user_slot', 'character_equipment', type_='unique')
    op.drop_table('character_equipment')
