# Title: World Layer Design
Description: 서울 월드를 정적 지형 레이어(Layer 0)와 플레이어 건설 레이어(Layer 1)로 분리하는 설계 원칙. 두 레이어는 절대 섞지 않는다.
When-To-Read: placed_objects 구현, 자원 노드 배치, 계단/다리/오브젝트 관련 기능, DB 스키마 설계, 렌더링 파이프라인 추가 시
Keywords: world layer, placed_objects, static terrain, player building, world_partition, layer separation, instance rendering
Priority: high

---

## 레이어 구조

### Layer 0 — 서울 지형 (영구 불변)

DB 소스: `world_partition`, `world_partition_group`

| 컬럼 | 역할 |
|------|------|
| `boundary_geojson` | OSM 실측 폴리곤 경계 |
| `elevation_m` | 실제 지형 고도 |
| `persona_tag` | 지역 정체성 (수산시장, 고시촌 등) |
| `theme_code` | 분위기/테마 |

- 플레이어가 수정 불가
- 게임 시스템(몬스터 스폰, 퀘스트 배치)의 기준점
- Layer 0 품질이 Layer 1의 게임성을 결정한다

### Layer 1 — 플레이어 건설 (동적)

DB 소스: `placed_objects` (설계 예정)

```sql
placed_objects
  id              BIGSERIAL PRIMARY KEY
  partition_id    INT REFERENCES world_partition(id)
  world_x         FLOAT   -- Three.js 월드 좌표
  world_z         FLOAT
  object_type     VARCHAR -- 'stair' | 'bridge' | 'tree' | 'stone' | 'building'
  creator_id      INT REFERENCES game_character(id)
  use_count       INT DEFAULT 0   -- 이 오브젝트를 거쳐간 플레이어 수
  placed_at       TIMESTAMPTZ DEFAULT now()
  is_active       BOOLEAN DEFAULT true
```

- 플레이어가 자원을 소비해 배치
- 다른 플레이어에게 영향 (계단 = 이동 경로, 다리 = 파티션 연결)
- `creator_id` + `use_count` = 명성 시스템의 근거

---

## 절대 규칙

1. **두 레이어는 섞지 않는다**
   - Layer 0 데이터(boundary, elevation)를 플레이어가 직접 수정하는 API를 만들지 않는다
   - Layer 1 오브젝트는 별도 테이블에만 저장한다

2. **Layer 0이 기준, Layer 1이 반응**
   - elevation 단차가 높은 파티션 경계에서만 계단 배치 가능
   - persona_tag가 '수산시장'인 파티션에는 수산시장 테마 건물만 허용 (추후 검증)

3. **파티션당 오브젝트 상한 200개**
   - 초과 시 배치 불가 (희소성 = 선점 경쟁 = 게임성)
   - 프론트 렌더 부하 방지

4. **같은 종류 오브젝트는 InstancedMesh로 렌더**
   - 나무 100그루 = draw call 1번
   - `placed_objects`를 object_type별로 그룹핑 후 instanced 렌더
   - 오브젝트 종류 추가 시 반드시 instanced 처리할 것

5. **시야 밖 오브젝트 로드 금지**
   - 현재 파티션 + 인접 파티션 범위만 쿼리
   - 멀어지면 unload
   - 전체 서울에 오브젝트 100만개여도 동시 렌더는 수백 개로 제한

---

## WebSocket 동기화 규칙

```json
// 오브젝트 배치 이벤트
{
  "type": "object_placed",
  "objectType": "stair",
  "worldX": 12.5,
  "worldZ": -8.3,
  "partitionId": 1042,
  "creatorId": 77,
  "creatorName": "더블유"
}

// 통행 카운트 이벤트 (플레이어가 계단/다리 통과 시)
{
  "type": "object_used",
  "objectId": 5512,
  "userId": 203
}
```

- 배치 이벤트: 같은 파티션에 있는 플레이어에게만 브로드캐스트
- 통행 카운트: 서버에서 `use_count += 1` 처리, UI 갱신은 배치자에게만

---

## 명성 시스템 (use_count 활용)

```
use_count >= 10   → "잘 다니는 길"
use_count >= 100  → 지도에 제작자 이름 표시
use_count >= 500  → "명소" 태그 부여
use_count >= 1000 → 파티션 상위 기여자 목록 등재
```

- 명성은 삭제해도 누적 기록 유지 (오브젝트 삭제 시 is_active=false, use_count는 보존)

---

## 구현 순서 (예정)

Phase 1 완료 후 진입:
1. `placed_objects` 테이블 migration
2. 자원 노드 (돌/나무) 필드 스폰
3. 계단(stair) 오브젝트 최소 구현 + 배치 UI
4. 플레이어 계단 위 Y 점진 이동 (usePlayerMovement 수정)
5. use_count 카운터 + 이름 표시
6. 다리(bridge) — 파티션 경계 연결
7. 건물 등 추가 오브젝트 확장
