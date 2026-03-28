"""add player level curve table

Revision ID: c4d5e6f7a8b9
Revises: a9b8c7d6e5f4
Create Date: 2026-03-28 22:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, Sequence[str], None] = "a9b8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "player_level_curve",
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("required_exp_total", sa.Integer(), nullable=False),
        sa.Column("reward_stat_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reward_skill_points", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("level"),
    )
    op.create_index(op.f("ix_player_level_curve_level"), "player_level_curve", ["level"], unique=False)

    op.execute(
        """
        INSERT INTO player_level_curve (level, required_exp_total, reward_stat_points, reward_skill_points)
        VALUES
            (1, 0, 0, 0),
            (2, 100, 1, 0),
            (3, 250, 1, 0),
            (4, 450, 1, 1),
            (5, 700, 1, 0),
            (6, 1000, 1, 0),
            (7, 1350, 1, 1),
            (8, 1750, 1, 0),
            (9, 2200, 1, 0),
            (10, 2700, 2, 1)
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_player_level_curve_level"), table_name="player_level_curve")
    op.drop_table("player_level_curve")
