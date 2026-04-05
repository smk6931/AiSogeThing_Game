# Title: 전투·보상·인벤토리 1차 구현 계획
Description: 몬스터 처치 → 경험치/골드/아이템 획득 → EXP바/인벤토리 UI까지 전체 프로세스 설계 및 구현 순서
When-To-Read: 전투 시스템, 아이템 드롭, 인벤토리, 경험치/레벨업, DB 스키마 작업 시
Keywords: combat, item, drop, inventory, exp, levelup, ui, db, websocket, target, magic_orb, auto_attack
Priority: high

---

## 현재 구현 상태 (2026-04-05 기준)

### 이미 완료된 것

| 기능 | 위치 | 상태 |
|---|---|---|
| 몬스터 HP바 (3D) | `front/src/entity/monster/Monster.jsx` | 완료 |
| 투사체 ↔ 몬스터 콜리전 | `front/src/entity/world/RpgWorld.jsx` useFrame | 완료 |
| 피격 → 데미지 계산 | `back/monster/managers/MonsterManager.py handle_hit()` | 완료 |
| 몬스터 사망 처리 | `MonsterManager` state=dead, dead_tick 제거 | 완료 |
| 처치 → EXP/골드 보상 | `back/player/managers/PlayerManager.py add_rewards()` | 완료 |
| 레벨업 로직 | `PlayerManager.add_rewards()` 내 while loop | 완료 (메모리) |
| 스킬 전송/수신 | `useGameSocket.js sendSkill / case 'skill'` | 완료 |
| 몬스터 AI 루프 | `MonsterManager.game_loop()` | 완료 |
| `monster_template` DB 테이블 | `back/monster/models/model.py` | 테이블만 있음, 시드 없음 |
| `game_character` DB 테이블 | `back/player/models/models.py` | 테이블만 있음, 소켓 미연결 |
| `player_level_curve` DB 테이블 | `back/player/models/models.py` | 테이블만 있음 |

### 아직 없는 것 (이번 구현 대상)

| 기능 | 상태 |
|---|---|
| `item_template` DB 테이블 | 없음 |
| `character_inventory` DB 테이블 | 없음 |
| 몬스터 처치 → 아이템 드롭 로직 | 없음 (`drop_items` JSON 컬럼은 있음) |
| 아이템 드롭 WebSocket 이벤트 | 없음 |
| 캐릭터 EXP바 UI | 없음 |
| 인벤토리 창 UI | 없음 |
| 아이템 획득 알림 UI | 없음 |
| `game_character` ↔ WebSocket 연결 | 미연결 (메모리로만 동작) |

---

## 공격 시스템 설계 결정 (2026-04-05)

### 방향: 타겟 기반 자동 공격 + 마법 구체 투사체

게임 방향이 **반자동 파밍** 이므로 논타겟 스킬보다 타겟 선택 후 자동 공격이 맞다.

### 공격 흐름

```
1. 플레이어가 몬스터 클릭 → 타겟 선택 (target 상태 저장)
2. 타겟이 있으면 → 일정 주기(1~1.5초)마다 자동으로 마법 구체 발사
3. 마법 구체가 타겟 몬스터 방향으로 날아감 (호밍 or 직선)
4. 구체가 몬스터에 닿으면 → sendHit() → 서버 데미지 처리
5. 타겟 몬스터 사망 or 범위 이탈 시 → 타겟 해제
```

### 구현 상세

#### 타겟 선택
- `Monster.jsx` onClick 이미 연결됨 (`onMonsterClick` prop)
- 현재는 MonsterInfoPanel 열기용으로만 사용 중
- **이걸 타겟 선택으로 전환** (MonsterInfoPanel은 타겟 선택과 동시에 표시)
- 타겟된 몬스터는 HP바 색상/테두리로 구분 표시

#### 자동 공격 루프
- `useAutoAttack(targetMonster, sendHit, sendSkill)` 훅으로 분리
- `setInterval` 기반 1.2초 주기
- 타겟이 살아있고 사정거리(30 이내) 일 때만 발사
- 플레이어가 타겟 방향으로 자동 회전

#### 마법 구체 (MagicOrb)
- 현재 `PunchProjectile.jsx` 있음 → 재활용하되 외형 교체
- `MagicOrbProjectile.jsx` 신규 생성
  - 구 형태 geometry + emissive glow 재질
  - 타겟 방향 호밍 (프레임마다 타겟 위치 추적)
  - 타겟에 닿으면 자동 제거 + hit 처리
- 다른 유저에게도 WebSocket `skill` 이벤트로 구체 동기화

#### 사정거리 벗어나면
- 타겟은 유지, 자동 공격만 멈춤
- 플레이어가 다가오면 자동 재개
- (추후) 타겟 방향으로 자동 이동 옵션 추가 가능

### 현재 PunchProjectile과의 관계
- `pyramid_punch`: 조이스틱 스킬용 (우측 조이스틱) 유지
- `MagicOrb`: 타겟 자동 공격용 (기본 공격)
- 두 시스템 병행 운영

---

## 구현 순서 (단계별)

### Phase 0: 공격 시스템 (타겟 선택 + 마법 구체)

**목표**: 몬스터 클릭 → 타겟 선택 → 자동으로 마법 구체 발사

1. `front/src/hooks/useAutoAttack.js` 신규
   - targetMonster, playerRef, sendHit, sendSkill, addProjectile 받음
   - 1.2초 interval로 MagicOrb 생성 + sendHit 전송

2. `front/src/entity/player/projectile/MagicOrbProjectile.jsx` 신규
   - 구체 geometry + emissive 재질 (파랑/보라 계열)
   - 호밍: 매 프레임 타겟 위치 추적하여 방향 업데이트
   - 타겟 도달 시 제거

3. `front/src/entity/world/RpgWorld.jsx` 수정
   - `onMonsterClick` → 타겟 몬스터 state 설정
   - 타겟 몬스터 HP바 강조 표시
   - `useAutoAttack` 훅 연결

4. `front/src/GameEntry.jsx` 수정
   - `selectedTarget` state 추가
   - 타겟 해제 버튼(ESC or 화면 빈 곳 클릭)

### Phase 1-A: DB 스키마 추가

**목표**: 아이템과 인벤토리 테이블 추가, 기존 테이블에 필요한 컬럼 보완

1. `item_template` 테이블 생성
   ```
   id, name_ko, name_en, type(weapon/armor/potion/material),
   rarity(common/rare/epic/legendary),
   stat_bonus(JSONB), description, icon_key, is_active
   ```

2. `character_inventory` 테이블 생성
   ```
   id, character_id(FK→game_character), item_id(FK→item_template),
   quantity, slot_index, acquired_at
   ```

3. `monster_template.drop_items` 컬럼 활용
   - 이미 있음: `[{"item_id": 1, "rate": 0.3}, ...]`
   - 시드 데이터 INSERT 필요

4. alembic migration 실행

### Phase 1-B: 시드 데이터 INSERT

**목표**: 게임에서 실제로 동작하는 초기 데이터 투입

1. `item_template` 시드 (10~15개)
   - 포션류 3개 (HP포션 소/중/대)
   - 소재류 5개 (고블린 귀, 오크 가죽, 슬라임 젤 등)
   - 장비류 3개 (목검, 가죽갑옷, 천 모자)

2. `monster_template` 시드 (7종 — 현재 MONSTER_TEMPLATES와 동기화)
   - `drop_items` JSONB에 item_id + rate 연결

3. `player_level_curve` 시드 (1~50레벨)

### Phase 1-C: 백엔드 — 아이템 드롭 로직

**목표**: 몬스터 처치 시 확률적으로 아이템 드롭, WebSocket으로 전송

1. `back/item/` 모듈 생성
   ```
   back/item/
     models/model.py       ← ItemTemplate, CharacterInventory ORM
     repository.py         ← 인벤토리 CRUD
     service.py            ← 드롭 확률 계산, 인벤토리 추가
     routers/router.py     ← GET /api/item/inventory/{character_id}
   ```

2. `MonsterManager.handle_hit()` 수정
   - 처치 시 `drop_items`에서 확률 계산
   - 드롭된 아이템 목록 result에 포함

3. `player/routers/router.py` WebSocket hit_monster 핸들러 수정
   - 처치 후 드롭 아이템 → DB 인벤토리 저장
   - `item_drop` 이벤트 소켓 전송

   ```python
   # WebSocket 전송 포맷
   {
     "type": "item_drop",
     "items": [{"itemId": 1, "name": "고블린 귀", "rarity": "common", "quantity": 1}],
     "monsterId": 3
   }
   ```

### Phase 1-D: 백엔드 — 게임캐릭터 DB 연결

**목표**: 현재 메모리로만 동작하는 스탯을 DB와 연결

- 접속 시 `game_character` DB에서 스탯 로드
- 레벨업/EXP 변경 시 DB 업데이트
- Guest 유저는 메모리 전용 유지 (DB 없음)

### Phase 1-E: 프론트엔드 — EXP바 UI

**목표**: GameOverlay에 EXP바와 레벨 표시 추가

위치: `front/src/ui/GameOverlay.jsx`

표시 요소:
- 현재 레벨
- EXP 수치 (현재/다음레벨까지)
- EXP 게이지 바 (HP바 아래)
- 레벨업 시 잠깐 애니메이션 텍스트

WebSocket `init_stats`, `player_reward` 이벤트로 `myStats` 업데이트 → 이미 연결됨

### Phase 1-F: 프론트엔드 — 아이템 획득 알림

**목표**: 아이템 드롭 시 화면에 플로팅 알림 표시

- WebSocket `item_drop` 이벤트 수신
- 화면 우측 하단에 "고블린 귀 획득!" 형식으로 2~3초 노출
- rarity별 색상 구분 (common 흰색, rare 파랑, epic 보라, legendary 금)

### Phase 1-G: 프론트엔드 — 인벤토리 창 UI

**목표**: 아이템 목록을 격자 UI로 표시

위치: `front/src/ui/InventoryModal.jsx` (신규)

기능:
- 단축키(I) 또는 버튼으로 열기/닫기
- 격자형 슬롯 (4열 × N행)
- 아이템 아이콘 + 수량 표시
- 아이템 클릭 시 툴팁 (이름, 설명, 스탯)
- API: `GET /api/item/inventory/{characterId}` 호출

---

## 구현 우선순위

```
Phase 0  (타겟 + 마법 구체)   ← 독립 구현 가능, 가장 먼저
  → Phase 1-A (DB 스키마)
    → Phase 1-B (시드 데이터)
      → Phase 1-C (드롭 로직 백엔드)
        → Phase 1-E (EXP바 UI)    ← 빠르고 임팩트 큼
        → Phase 1-F (아이템 알림)  ← WebSocket 이미 있음
        → Phase 1-G (인벤토리 창)  ← Phase 1-C 완료 후
Phase 1-D (DB 연결) ← Phase 1-A 완료 후 별도 진행 가능
```

---

## 기술적 결정 사항

### 아이템 드롭 처리 위치
- 드롭 확률 계산: **백엔드** (서버가 확률 결정 → 조작 방지)
- 드롭 결과 전송: WebSocket `item_drop` 이벤트 (공격한 유저에게만)
- DB 저장: 백엔드에서 즉시 `character_inventory`에 INSERT

### Guest 유저 아이템 처리
- Guest는 `character_inventory` DB 저장 생략
- 메모리 임시 인벤토리만 유지 (세션 종료 시 소멸)
- UI는 동일하게 표시

### 인벤토리 용량
- 1차: 제한 없음 (슬롯 무한)
- 추후: 가방 아이템으로 확장 슬롯 구현

---

## 다음 단계 (2차 예정)

- 장비 착용 시스템 (equip slot)
- 스탯 버프 적용 (attack/defense 반영)
- 경매장 (거래 시스템)
- 스킬 트리 / 추가 스킬

---

## 진행 체크리스트

### Phase 0 — 타겟 선택 + 마법 구체 자동 공격
- [x] `useAutoAttack.js` 훅 생성
- [x] `MagicOrbProjectile.jsx` 컴포넌트 생성
- [x] `RpgWorld.jsx` — 타겟 state + 타겟 강조 + useAutoAttack 연결 + 투사체 분기 렌더링
- [x] `Monster.jsx` — isTargeted 링/하이라이트 추가
- [x] `MonsterManager.py` — magic_orb 스킬 파워 추가
- [x] ESC 타겟 해제, 몬스터 사망 시 자동 해제
- [x] `DamageNumber.jsx` — 데미지 숫자 플로팅 컴포넌트
- [x] `RpgWorld.jsx` — 몬스터 HP 변화 감지 → 데미지 숫자 렌더링

### Phase 1-A — DB 스키마
- [x] `item_template` ORM 모델 작성
- [x] `character_inventory` ORM 모델 작성
- [x] alembic migration 생성 및 실행 (d1e2f3a4b5c6)

### Phase 1-B — 시드 데이터
- [x] `item_template` 시드 스크립트 작성 (포션/소재/장비 13개)
- [x] `monster_template` drops 연결 (MonsterManager MONSTER_TEMPLATES에 직접 추가)
- [ ] `player_level_curve` 시드 스크립트 (1~50레벨) — 추후

### Phase 1-C — 아이템 드롭 백엔드
- [x] `back/item/` 모듈 생성 (model, repository, service, router)
- [x] `MonsterManager` — drops 필드 + handle_hit() dropTable 포함
- [x] WebSocket `hit_monster` 핸들러 — roll_drops → grant_items → `item_drop` 이벤트
- [x] `main.py` item_router 등록

### Phase 1-D — game_character DB 연결
- [ ] 접속 시 DB에서 스탯 로드 (guest는 메모리 유지)
- [ ] 레벨업/EXP/골드 변경 시 DB 업데이트

### Phase 1-E — EXP바 UI
- [x] `GameOverlay.jsx` — EXP 게이지 바 추가 (레벨 기반 maxExp 계산)
- [x] `GameOverlay.jsx` — 골드 표시 추가

### Phase 1-F — 아이템 획득 알림 UI
- [x] `useGameSocket.js` — `item_drop` 이벤트 수신 → droppedItems state
- [x] `GameOverlay.jsx` — rarity별 색상 알림 (3초 노출 후 자동 제거)
- [x] `GameEntry.jsx` — droppedItems 전달 + 자동 제거 타이머

### Phase 1-G — 인벤토리 창 UI
- [x] `InventoryModal.jsx` 신규 생성 (격자 슬롯 5×6, rarity 테두리/글로우, 툴팁)
- [x] `api/item.js` 생성 → `GET /api/item/inventory/{userId}` 연결
- [x] 단축키(I) 열기/닫기 (GameEntry + InventoryModal 양쪽)
- [x] `GameOverlay.jsx` — 인벤 [I] 버튼 추가
- [x] `GameEntry.jsx` — InventoryModal lazy import + onInventoryOpen 연결

---

## 진행 기록

- 2026-04-05: 계획 수립 (현재 구현 상태 파악 완료)
- 2026-04-05: 타겟 기반 자동 공격 + 마법 구체 설계 추가
- 2026-04-05: 체크리스트 추가, Phase 0 구현 시작
