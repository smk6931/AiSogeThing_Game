"""rename tables

Revision ID: h5i6j7k8l9m0
Revises: g4h5i6j7k8l9
Create Date: 2026-04-11

game_character       -> char
character_equipment  -> char_equip
character_inventory  -> char_inven
player_level_curve   -> char_level_exp
item_template        -> item
monster_template     -> monster
world_admin_area     -> world_area
"""
from alembic import op

revision = 'h5i6j7k8l9m0'
down_revision = 'g4h5i6j7k8l9'
branch_labels = None
depends_on = None


def upgrade():
    op.rename_table('game_character', 'char')
    op.rename_table('character_equipment', 'char_equip')
    op.rename_table('character_inventory', 'char_inven')
    op.rename_table('player_level_curve', 'char_level_exp')
    op.rename_table('item_template', 'item')
    op.rename_table('monster_template', 'monster')
    op.rename_table('world_admin_area', 'world_area')


def downgrade():
    op.rename_table('char', 'game_character')
    op.rename_table('char_equip', 'character_equipment')
    op.rename_table('char_inven', 'character_inventory')
    op.rename_table('char_level_exp', 'player_level_curve')
    op.rename_table('item', 'item_template')
    op.rename_table('monster', 'monster_template')
    op.rename_table('world_area', 'world_admin_area')
