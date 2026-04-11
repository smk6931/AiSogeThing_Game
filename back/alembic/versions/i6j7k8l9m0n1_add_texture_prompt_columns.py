"""add texture prompt columns

Revision ID: i6j7k8l9m0n1
Revises: h5i6j7k8l9m0
Create Date: 2026-04-11

world_area:
    + persona_tag              String(64)
    + texture_style_profile    String(64)
    + image_prompt_base        Text
    + image_prompt_negative    Text

world_partition_group:
    + prompt_inherit_mode      String(16)  DEFAULT 'append'

world_partition:
    + image_prompt_append      Text
    + image_prompt_negative    Text
    + resolved_prompt          Text
    + resolved_prompt_negative Text
    + prompt_resolved_at       DateTime(tz)
"""
from alembic import op
import sqlalchemy as sa

revision = 'i6j7k8l9m0n1'
down_revision = 'h5i6j7k8l9m0'
branch_labels = None
depends_on = None


def upgrade():
    # world_area
    op.add_column('world_area', sa.Column('persona_tag', sa.String(64), nullable=True))
    op.add_column('world_area', sa.Column('texture_style_profile', sa.String(64), nullable=True))
    op.add_column('world_area', sa.Column('image_prompt_base', sa.Text, nullable=True))
    op.add_column('world_area', sa.Column('image_prompt_negative', sa.Text, nullable=True))
    op.create_index('ix_world_area_persona_tag', 'world_area', ['persona_tag'])

    # world_partition_group
    op.add_column('world_partition_group', sa.Column(
        'prompt_inherit_mode', sa.String(16), nullable=False, server_default='append'
    ))

    # world_partition
    op.add_column('world_partition', sa.Column('image_prompt_append', sa.Text, nullable=True))
    op.add_column('world_partition', sa.Column('image_prompt_negative', sa.Text, nullable=True))
    op.add_column('world_partition', sa.Column('resolved_prompt', sa.Text, nullable=True))
    op.add_column('world_partition', sa.Column('resolved_prompt_negative', sa.Text, nullable=True))
    op.add_column('world_partition', sa.Column(
        'prompt_resolved_at', sa.DateTime(timezone=True), nullable=True
    ))


def downgrade():
    # world_partition
    op.drop_column('world_partition', 'prompt_resolved_at')
    op.drop_column('world_partition', 'resolved_prompt_negative')
    op.drop_column('world_partition', 'resolved_prompt')
    op.drop_column('world_partition', 'image_prompt_negative')
    op.drop_column('world_partition', 'image_prompt_append')

    # world_partition_group
    op.drop_column('world_partition_group', 'prompt_inherit_mode')

    # world_area
    op.drop_index('ix_world_area_persona_tag', table_name='world_area')
    op.drop_column('world_area', 'image_prompt_negative')
    op.drop_column('world_area', 'image_prompt_base')
    op.drop_column('world_area', 'texture_style_profile')
    op.drop_column('world_area', 'persona_tag')
