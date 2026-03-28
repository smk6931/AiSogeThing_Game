# 몬스터 설계 규칙

## 핵심 개념: DB 레코드 = 모델 파일 1:1 대응

DB에 몬스터 한 줄이 있으면, 그 줄에 해당하는 3D 모델 파일이 정확히 하나 존재한다.
파일 이름만 봐도 DB 어느 행인지 알 수 있고, DB 보면 파일명을 바로 유추할 수 있다.

---

## DB 테이블 구조

DB 이름: `game-sogethingdb`
테이블 이름: `monster_template`

```
┌─────┬─────────────┬────────┬────────────┬──────────┬─────────────────────────────────────────────────┐
│ id  │    name     │  tier  │   region   │ property │                   model_path                    │
├─────┼─────────────┼────────┼────────────┼──────────┼─────────────────────────────────────────────────┤
│  1  │   Goblin    │ normal │ noryangjin │  forest  │ monsters/Goblin_Normal_Noryangjin_Forest_001.glb │
│  2  │    Orc      │ elite  │   yongsan  │  stone   │ monsters/Orc_Elite_Yongsan_Stone_002.glb         │
│  3  │ DragonBoss  │  boss  │   gangnam  │   fire   │ monsters/DragonBoss_Boss_Gangnam_Fire_003.glb    │
└─────┴─────────────┴────────┴────────────┴──────────┴─────────────────────────────────────────────────┘
```

---

## 3D 모델 파일 네이밍 규칙

```
{Name}_{Tier}_{Region}_{Property}_{PKey}.glb
```

| 자리 | 설명 | 예시 |
|------|------|------|
| Name | 몬스터 이름 (PascalCase) | `Goblin`, `Orc`, `DragonBoss` |
| Tier | 등급 | `Normal` / `Elite` / `Event` / `Boss` |
| Region | 이 모델이 설계된 기원 지역 | `Noryangjin`, `Yongsan`, `Gangnam` |
| Property | 속성/테마 | `Forest` / `Stone` / `Fire` / `Water` / `Dark` |
| PKey | DB의 id (3자리, 001~999) | `001`, `042` |

### 실제 파일명 예시
```
Goblin_Normal_Noryangjin_Forest_001.glb
Orc_Elite_Yongsan_Stone_002.glb
DragonBoss_Boss_Gangnam_Fire_003.glb
EventSlime_Event_Mapo_Water_077.glb
```

---

## 파일 저장 위치

```
front/public/models/
  monsters/     ← monster_template 테이블 모델
  characters/   ← 플레이어 캐릭터 모델
  items/        ← 아이템 모델
  npcs/         ← NPC 모델
```

실제 경로 예시:
```
front/public/models/monsters/Goblin_Normal_Noryangjin_Forest_001.glb
```

---

## DB model_path 컬럼 규칙

- DB에는 `public/models/` 이후 **상대경로만** 저장한다.
- 앞에 `/models/`를 붙이지 않는다.

```sql
-- DB에 저장되는 값
model_path = 'monsters/Goblin_Normal_Noryangjin_Forest_001.glb'
```

프론트에서 실제 URL 조합:
```js
const BASE_MODEL_URL = '/models/'   // 로컬
// const BASE_MODEL_URL = 'https://cdn.example.com/models/'  // CDN으로 이전 시

const url = BASE_MODEL_URL + monster.model_path
// 결과: '/models/monsters/Goblin_Normal_Noryangjin_Forest_001.glb'
```

CDN으로 이전할 때 `BASE_MODEL_URL` 환경변수 하나만 바꾸면 전체 적용된다.

---

## 파일명 변경 규칙

| 변경 가능 | 변경 금지 |
|-----------|-----------|
| Name (몬스터 이름 변경) | PKey (DB id와 동기화 필수) |
| Tier 수정 | 파일 저장 경로 (`public/models/monsters/`) |
| Region 수정 | |
| Property 수정 | |

파일명 바꿀 때는 반드시 DB `model_path` 컬럼도 같이 업데이트해야 한다.

---

## 같은 모델을 여러 지역에서 쓸 때

Region은 **이 모델이 디자인된 기원 지역**이다. 실제 어느 지역에 스폰되는지는 별도 스폰 테이블에서 관리한다.

```
파일: Goblin_Normal_Noryangjin_Forest_001.glb  (파일은 1개)

스폰 테이블
┌────────────────┬──────────────────────┐
│  partition_key │  monster_template_id │
├────────────────┼──────────────────────┤
│  noryangjin_01 │          1           │  ← 노량진에서도 등장
│  dongjak_05    │          1           │  ← 동작에서도 같은 파일 재사용
└────────────────┴──────────────────────┘
```

---

## 몬스터 테이블 전체 컬럼 설계 (참고)

```sql
CREATE TABLE monster_template (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(128) NOT NULL,      -- 'Goblin'
    tier            VARCHAR(16)  NOT NULL,      -- 'normal' / 'elite' / 'event' / 'boss'
    region          VARCHAR(64)  NOT NULL,      -- 'noryangjin'
    property        VARCHAR(32)  NOT NULL,      -- 'forest'
    model_path      VARCHAR(256) NOT NULL,      -- 'monsters/Goblin_Normal_Noryangjin_Forest_001.glb'

    hp_base         INT NOT NULL DEFAULT 100,
    atk_base        INT NOT NULL DEFAULT 10,
    def_base        INT NOT NULL DEFAULT 5,
    exp_reward      INT NOT NULL DEFAULT 20,

    spawn_weight    FLOAT DEFAULT 1.0,          -- 출현 확률 가중치
    theme_tag       VARCHAR(64),                -- 스폰 파티션 연결용

    boss_phase_data JSONB,                      -- 보스 전용 페이즈 패턴 (일반 몬스터는 NULL)

    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

