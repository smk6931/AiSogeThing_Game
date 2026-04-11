# Title: DB Naming Rules
Description: 테이블명, 컬럼명, 인덱스명, 제약조건명 네이밍 규칙. 새 테이블 설계 전 반드시 참고.
When-To-Read: 새 테이블 생성, 컬럼 추가, alembic 마이그레이션 작성 전
Keywords: table name, column name, naming, convention, db, schema
Priority: high

---

## 테이블명 규칙

### 기본 원칙
- 소문자 + 언더스코어(`snake_case`)
- 가능한 짧고 명확하게. 불필요한 단어 제거.
- 단수형 사용 (복수형 금지)
- 도메인 접두어로 묶는다

### 현재 테이블 목록 (확정)

| 테이블명 | 도메인 | 설명 |
|----------|--------|------|
| `user` | user | 사용자 계정 |
| `char` | player | 플레이어 캐릭터 스탯 |
| `char_level_exp` | player | 레벨별 경험치 커브 |
| `char_inven` | item | 캐릭터 인벤토리 |
| `char_equip` | item | 캐릭터 착용 장비 |
| `item` | item | 아이템 템플릿 정의 |
| `monster` | monster | 몬스터 템플릿 정의 |
| `world_area` | world | 행정구역 (시/구/동) |
| `world_partition` | world | 파티션 (필지 단위 구역) |
| `world_partition_group` | world | 파티션 그룹 |
| `world_partition_group_member` | world | 그룹-파티션 멤버십 |

### 네이밍 패턴

```
<도메인>_<대상>_<관계>
```

- 도메인이 명확하면 도메인 접두어 붙인다: `world_area`, `world_partition`
- 도메인이 테이블 이름 자체인 경우 접두어 생략 가능: `item`, `monster`, `user`
- 캐릭터 관련은 `char_` 접두어로 통일: `char`, `char_equip`, `char_inven`, `char_level_exp`
- 연결 테이블(junction)은 양쪽 이름 조합: `world_partition_group_member`

### 금지 패턴

| 금지 | 이유 | 대신 |
|------|------|------|
| `game_character` | `game_` 불필요, 길다 | `char` |
| `character_equipment` | domain 접두어 없음, 길다 | `char_equip` |
| `item_template` | `_template` suffix 불필요 | `item` |
| `monster_template` | 동일 | `monster` |
| `world_admin_area` | `admin_` 불필요 | `world_area` |
| `player_level_curve` | `player_`, `_curve` 혼재 | `char_level_exp` |
| `tbl_user`, `t_item` | 접두어 의미 없음 | 없애라 |
| `items`, `users` | 복수형 | `item`, `user` |

---

## 컬럼명 규칙

### 기본
- `snake_case`, 소문자
- 불필요한 테이블명 반복 금지: `item.item_name` → `item.name`
- boolean은 `is_` 접두어: `is_active`, `is_road`, `is_walkable`
- 타임스탬프는 `_at` 접미어: `created_at`, `updated_at`, `prompt_resolved_at`
- FK 참조 컬럼은 `<참조테이블단수>_id`: `admin_area_id`, `group_id`, `user_id`

### 자주 쓰는 컬럼 패턴

```python
# 공통 타임스탬프 (모든 테이블)
created_at = Column(DateTime(timezone=True), server_default=func.now())
updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

# FK
user_id    = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
group_id   = Column(BigInteger, ForeignKey("world_partition_group.id"), nullable=False, index=True)

# 자기 참조 (계층 구조)
parent_id  = Column(Integer, ForeignKey("world_area.id"), nullable=True, index=True)

# 지리 좌표
centroid_lat = Column(Float, nullable=True)
centroid_lng = Column(Float, nullable=True)

# JSON 메타
gameplay_meta = Column(JSON, nullable=True)
area_meta     = Column(JSON, nullable=True)
```

---

## 게임 세계관 컬럼 네이밍

세계관 데이터는 3단계 계층 구조를 가진다:

```
world_area (동/구/시)
  └─ world_partition_group (구역 묶음)
       └─ world_partition (개별 필지)
```

각 레벨에서 쓰는 컬럼 패턴:

| 컬럼 | 레벨 | 설명 |
|------|------|------|
| `persona_tag` | 전 레벨 | 구역 성격 코드 (영문, snake_case) |
| `theme_code` | group, partition | 지형/분위기 코드 |
| `texture_profile` | partition | 바닥 텍스처 식별자 |
| `texture_style_profile` | area | 상위 텍스처 스타일 |
| `image_prompt_base` | area, group | AI 이미지 생성 기본 프롬프트 |
| `image_prompt_append` | partition | 파티션 단위 추가 프롬프트 |
| `image_prompt_negative` | 전 레벨 | 제외할 요소 프롬프트 |
| `resolved_prompt` | partition | 상속 합산된 최종 프롬프트 |
| `prompt_resolved_at` | partition | 프롬프트 확정 시각 |
| `prompt_inherit_mode` | group | `append` / `override` |

### persona_tag 네이밍 스타일

- 영문 소문자 + 언더스코어
- `<역할>_<직군/속성>` 형태 권장
- 계층적으로 세분화: 상위 → 하위로 갈수록 구체화

```
# world_area 레벨 (동 단위)
scholar_haven_frontier

# world_partition_group 레벨 (구역 단위)
riverbank_guardian
cliff_hermit
tome_seeker
oracle_keeper

# world_partition 레벨 (필지 단위)
shore_watcher
pond_keeper
breakthrough_spot
wall_whisperer
```

---

## 인덱스 / 제약조건명 규칙

```
ix_<테이블>_<컬럼>          # 단일 인덱스
uq_<테이블>_<컬럼들>        # 유니크 제약
fk_<테이블>_<참조테이블>    # FK (SQLAlchemy 자동 생성 시 생략 가능)
```

예:
```python
UniqueConstraint("admin_area_id", "partition_stage", "partition_seq",
                 name="uq_partition_admin_stage_seq")
UniqueConstraint("group_id", "partition_id",
                 name="uq_world_partition_group_member_group_partition")
```

---

## 새 테이블 설계 체크리스트

- [ ] 테이블명이 도메인 접두어를 포함하는가?
- [ ] 불필요한 `_template`, `_curve`, `_log` 등 suffix가 없는가?
- [ ] 복수형이 아닌 단수형인가?
- [ ] `created_at` / `updated_at` 포함했는가?
- [ ] FK 컬럼에 `index=True` 달았는가?
- [ ] boolean 컬럼에 `is_` 접두어 붙었는가?
- [ ] `server_default` 지정해서 앱 레벨 기본값 의존 줄였는가?
