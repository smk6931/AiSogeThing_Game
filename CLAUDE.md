# Project Rules

## Agents Context Loading Rule

- 코드 실행이나 수정 전에 먼저 `agents/` 폴더 문서의 `Title`, `Description`, `When-To-Read`, `Keywords`를 본다.
- 유저 요청, 수정 대상 파일, 실행 명령 목적과 대조해서 필요한 문서만 추가 컨텍스트로 읽는다.
- `agents/`에 없는 규칙은 새 문서로 추가하거나 기존 문서로 옮긴 뒤 사용한다.
- 구현 시 `agents/` 안 규칙과 코드베이스 기존 패턴을 우선 따른다.
- 시작 문서:
  - [`agents/README.md`](C:/GitHub/AiSogeThing_Game/agents/README.md)
  - [`agents/development/core_rules.md`](C:/GitHub/AiSogeThing_Game/agents/development/core_rules.md)
  - [`agents/development/player_leveling_rules.md`](C:/GitHub/AiSogeThing_Game/agents/development/player_leveling_rules.md)
  - [`agents/frontend/ui_rules.md`](C:/GitHub/AiSogeThing_Game/agents/frontend/ui_rules.md)
  - [`agents/frontend/intro_signup_rules.md`](C:/GitHub/AiSogeThing_Game/agents/frontend/intro_signup_rules.md)
  - [`agents/game_design/world_partition_rules.md`](C:/GitHub/AiSogeThing_Game/agents/game_design/world_partition_rules.md)
  - [`agents/game_design/road_design_rules.md`](C:/GitHub/AiSogeThing_Game/agents/game_design/road_design_rules.md)
  - [`agents/auth/auth_flow_rules.md`](C:/GitHub/AiSogeThing_Game/agents/auth/auth_flow_rules.md)

## Database

- Use `world_admin_area` as the canonical parent table for Seoul, district, and dong hierarchy.
- Use `world_level_partition` as the lowest gameplay partition table.
- Child partitions should reference parent rows with foreign keys.
- Child partitions may store short denormalized labels like city, district, dong, and theme for easier AI prompting and DBeaver inspection.
- Do not copy full parent geometry or full parent metadata into each child row.
- When readable inspection is needed, prefer a joined SQL view instead of heavy duplication.

## Level Data

- The recommended hierarchy is `city -> district -> dong -> partition`.
- Road data should remain part of traversal and adjacency logic, not just texture decoration.
- Primary partitions come from road split and dong boundary.
- `world_level_partition` must remain the micro-partition table.
- Do not insert larger grouped-region rows into `world_level_partition`.
- When larger playable regions are needed, keep one table and add grouping metadata to each micro partition row:
  - `group_key`
  - `group_seq`
  - `group_display_name`
  - `group_theme_code`
- Use `group_*` fields for:
  - grouped world-map naming
  - grouped boundary rendering
  - grouped visual mood / texture coordination
- Use micro partitions for:
  - deterministic current-position lookup
  - adjacency
  - fine-grained encounter placement
- Landuse remains a semantic analysis layer, not the final partition ownership layer.
- Secondary partitions may refine landuse or manual gameplay design later.

## Monster Design Rules

### DB 구조
- 모든 몬스터(일반/엘리트/이벤트/보스)는 `monster_template` 단일 테이블로 관리한다.
- `tier` 컬럼으로 구분: `normal` / `elite` / `event` / `boss`
- 보스 전용 페이즈·스크립트는 `boss_phase_data JSONB` 컬럼으로 흡수한다.
- 스폰 지역은 `world_level_partition`의 `theme_code` / `persona_tag`와 연결한다.

### 3D 모델 파일 네이밍 컨벤션
분류 기준이 앞에, 이름이 맨 뒤에 온다. 파일 정렬 시 분류 기준으로 그룹핑되어 한눈에 파악 가능.

```
{OriginRegion}_{Tier}_{Property}_{PKey}_{MonsterName}.glb

예시)
Noryangjin_Normal_Forest_001_Goblin.glb
Yongsan_Elite_Stone_002_Orc.glb
Gangnam_Boss_Fire_001_Dragon.glb
Mapo_Event_Water_077_Slime.glb
```

- `Tier`: `Normal` / `Elite` / `Event` / `Boss`
- `OriginRegion`: 이 모델이 설계된 기원 지역 (실제 스폰 지역은 DB에서 관리)
- `Property`: 속성/테마 (`Forest` / `Stone` / `Fire` / `Water` 등)
- `PKey`: DB primary key (3자리 zero-padding, 예: `001`). 절대 변경 금지.
- `MonsterName`: 몬스터 종류 이름 (PascalCase). 변경 시 파일 rename + DB 업데이트.

### 파일 경로 구조
```
front/public/models/      ← 브라우저가 직접 서빙 (백엔드 아님)
  monsters/    ← monster_template 테이블
  characters/  ← character 테이블
  items/       ← item 테이블
  npcs/        ← npc 테이블
```

### DB model_path 컬럼 규칙
- DB에는 `public/models/` 이후 상대경로만 저장한다.
- 예: `monster_template.model_path = 'monsters/Normal_Noryangjin_Forest_001_Goblin.glb'`
- 프론트에서 실제 URL 조합: `BASE_MODEL_URL + model_path`
- `BASE_MODEL_URL`은 프론트 환경변수로 관리 (로컬: `/models/`, CDN: `https://cdn.../models/`)

### 파일명 변경 규칙
- Tier / Region / Property / Name 변경 시: 파일 rename + DB `model_path` 동시 업데이트.
- PKey는 절대 변경하지 않는다 (DB primary key와 영구 동기화).
- 경로(`public/models/monsters/`) 자체는 변경하지 않는다.

## AI and Metadata

- Small denormalized metadata is acceptable if it helps prompts, tools, logs, and debugging.
- Large duplicated documents should not be stored in relational child rows without a strong reason.
- Use vector search only for semantic text retrieval, not for deterministic map ownership or region hierarchy.
