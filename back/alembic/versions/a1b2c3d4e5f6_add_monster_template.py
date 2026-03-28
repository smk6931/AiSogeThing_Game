"""add monster_template

Revision ID: a1b2c3d4e5f6
Revises: f7b9c1d2e3a4
Create Date: 2026-03-28

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'f7b9c1d2e3a4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'monster_template',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name_en', sa.String(128), nullable=False),
        sa.Column('name_ko', sa.String(128), nullable=False),
        sa.Column('tier', sa.String(32), nullable=False, server_default='normal'),
        sa.Column('origin_region', sa.String(128), nullable=True),
        sa.Column('property_type', sa.String(64), nullable=True),
        sa.Column('model_path', sa.String(256), nullable=False),
        sa.Column('model_scale', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('model_y_offset', sa.Float(), nullable=False, server_default='0.0'),
        sa.Column('base_hp', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('base_exp', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('drop_items', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
    )

    # 시드 데이터: 기존 2개 + 신규 5개
    op.execute("""
    INSERT INTO monster_template (id, name_en, name_ko, tier, origin_region, property_type, model_path, model_scale, model_y_offset, base_hp, base_exp, description, drop_items, is_active)
    VALUES
    (1, 'Dragon', '드래곤', 'boss', 'Gangnam', 'fire',
     'monsters/Gangnam_Boss_Fire_001_Dragon.glb', 0.12, 0.0, 5000, 2000,
     '강남을 지배하는 불꽃의 보스 드래곤. 전설적인 화염 브레스를 보유하고 있다.',
     '[{"item": "Dragon Scale", "rate": 0.5, "icon": "🐉"}, {"item": "Fire Core", "rate": 0.2, "icon": "🔥"}, {"item": "Ancient Coin", "rate": 1.0, "icon": "🪙"}]',
     true),

    (2, 'Slime', '슬라임', 'normal', 'Seoul', 'water',
     'monsters/Seoul_Normal_Water_001_Slime.glb', 0.6, 0.014, 80, 15,
     '서울 어디서나 볼 수 있는 흔한 수계 슬라임. 약하지만 무리를 지어 다닌다.',
     '[{"item": "Slime Jelly", "rate": 0.8, "icon": "🫧"}, {"item": "Small Coin", "rate": 1.0, "icon": "🪙"}]',
     true),

    (3, 'Goblin', '고블린', 'normal', 'Seoul', 'forest',
     'monsters/Seoul_Normal_Water_001_Slime.glb', 0.6, 0.0, 60, 20,
     '서울 숲 지역에 서식하는 고블린. 빠른 이동속도가 특징이다.',
     '[{"item": "Goblin Ear", "rate": 0.6, "icon": "👂"}, {"item": "Small Coin", "rate": 1.0, "icon": "🪙"}, {"item": "Tattered Cloth", "rate": 0.3, "icon": "🧥"}]',
     true),

    (4, 'Orc', '오크', 'elite', 'Yongsan', 'stone',
     'monsters/Seoul_Normal_Water_001_Slime.glb', 0.7, 0.0, 350, 120,
     '용산 지역의 엘리트 오크 전사. 두꺼운 갑옷과 강력한 도끼를 보유한다.',
     '[{"item": "Orc Fang", "rate": 0.5, "icon": "🦷"}, {"item": "Iron Ingot", "rate": 0.3, "icon": "⚙️"}, {"item": "Medium Coin", "rate": 1.0, "icon": "🪙"}]',
     true),

    (5, 'Zombie', '좀비', 'normal', 'Jongno', 'dark',
     'monsters/Seoul_Normal_Water_001_Slime.glb', 0.6, 0.0, 90, 18,
     '종로 골목을 배회하는 언데드 좀비. 느리지만 집요하게 추적한다.',
     '[{"item": "Rotten Flesh", "rate": 0.7, "icon": "🧟"}, {"item": "Cursed Bone", "rate": 0.2, "icon": "🦴"}, {"item": "Small Coin", "rate": 1.0, "icon": "🪙"}]',
     true),

    (6, 'Witch', '마녀', 'elite', 'Mapo', 'magic',
     'monsters/Seoul_Normal_Water_001_Slime.glb', 0.65, 0.0, 280, 100,
     '마포 지역에 은거하는 마법 엘리트 마녀. 강력한 마법 공격을 구사한다.',
     '[{"item": "Witch Hat", "rate": 0.15, "icon": "🎩"}, {"item": "Magic Crystal", "rate": 0.4, "icon": "💎"}, {"item": "Medium Coin", "rate": 1.0, "icon": "🪙"}]',
     true),

    (7, 'Ogre', '오우거', 'boss', 'Dongjak', 'earth',
     'monsters/Seoul_Normal_Water_001_Slime.glb', 0.9, 0.0, 3000, 1200,
     '동작구를 지배하는 대지의 보스 오우거. 압도적인 체력과 물리 공격력을 자랑한다.',
     '[{"item": "Ogre Club", "rate": 0.1, "icon": "🪵"}, {"item": "Earth Stone", "rate": 0.4, "icon": "🪨"}, {"item": "Boss Coin", "rate": 1.0, "icon": "🪙"}]',
     true)
    ON CONFLICT (id) DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_table('monster_template')
