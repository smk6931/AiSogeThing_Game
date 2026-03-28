"""add monster icon_emoji and update spawn regions to noryangjin

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-28

"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('monster_template', sa.Column('icon_emoji', sa.String(8), nullable=True))

    op.execute("""
    UPDATE monster_template SET
        icon_emoji = CASE id
            WHEN 1 THEN '🐉'
            WHEN 2 THEN '🫧'
            WHEN 3 THEN '👺'
            WHEN 4 THEN '👹'
            WHEN 5 THEN '🧟'
            WHEN 6 THEN '🧙'
            WHEN 7 THEN '🗿'
            ELSE '👾'
        END,
        origin_region = '노량진'
    WHERE id IN (1,2,3,4,5,6,7)
    """)


def downgrade() -> None:
    op.drop_column('monster_template', 'icon_emoji')
