# world_road 설계 교차 검토 리포트

**작성일**: 2026-04-23
**대상**:
- `docs/plan/2026-04-22/world_road_레이어_설계계획.md` (원 설계)
- `docs/plan/2026-04-23/world_road_고도화.md` (고도화 계획)
- 실제 구현 (backend + frontend)

---

## 1. 진행도 요약 (원 설계 Phase 기준)

| Phase | 항목 | 상태 | 비고 |
|---|---|---|---|
| Phase 1 | `world_road` 테이블 + migration | ✅ 완료 | n1o2p3q4r5s6 |
| Phase 1 | `build_world_road.py` | ✅ 완료 | EPSG:5186 buffer, 동경계 clip, elevation 보간 |
| Phase 1 | 노량진1동 데이터 생성 | ✅ 완료 | 197개 저장 / 189개 스킵 |
| Phase 2 | `GET /codex/dong/{id}/roads` 엔드포인트 | ✅ 완료 | worldApi.getDongRoads |
| Phase 3 | 클라이언트 fetch | ✅ 완료 | dbRoads state |
| Phase 3 | 도로 메시 생성 | ✅ 완료 | buildTerrainBlockFromGeoJson 재활용 |
| Phase 3 | 임시 회색 머티리얼 | ✅ 완료 | #555555 |
| Phase 3 | showElevation 추종 | ⚠️ 부분 | elevation_m 적용됨. 단일 elevation이라 긴 도로는 부자연 |
| Phase 3 | movement_bonus 적용 | ❌ 미구현 | DB에는 있음, 이동 로직 연결 없음 |
| Phase 4 | 파티션에서 도로 빼기 | ❌ 미시작 | terrain_geojson 컬럼 없음 |

**Phase 1~3 거의 완료, Phase 4 미시작.**

---

## 2. 사용자 질문에 대한 정확한 답변

### Q1. world_road가 world_partition 폴리곤과 겹칠 때만 그 부분이 렌더링되는가?

**NO. 현재 구현은 도로 폴리곤 전체가 파티션과 무관하게 렌더링됨.**

- `build_world_road.py` 는 LineString을 buffer한 뒤 **동 경계**로만 clip함 (파티션 경계 clip 아님).
- 클라이언트는 `road.boundary_geojson` 전체를 그대로 메시화.
- 즉 활성 그룹 바깥 영역의 도로도 활성 그룹 바깥에 그대로 그려질 수 있다.
- depthWrite=false + renderOrder=6 으로 z-fighting은 회피 중.

### Q2. world_road도 캐릭터 위치 기준 유저 주변 범위로 렌더링되는가?

**NO (부분적). 현재는 "동 전체 도로 일괄 렌더링".**

- 파티션/그룹: `activeGroupKeys` (플레이어 주변 700m 내 그룹) 로 필터링 → 가시 영역만 렌더링.
- 도로: `roadMeshes` useMemo에서 `!dbRoads?.length || !activeGroupKeys.size`만 체크.
  - activeGroupKeys가 비어있지 않으면 **동 전체 197개 도로 전부** 렌더링.
  - 개별 도로가 active 그룹과 겹치는지 확인하지 않음.
- 결과: 플레이어 주변에는 파티션이 몇 개만 그려지는데 도로는 동 전체가 그려져 **비대칭 가시 범위**가 된다. 드로우 콜 낭비.

### Q3. world_partition에서 world_road 면적 빼는 계획이 있는가?

**있음. 원 설계의 Phase 4에 SQL까지 포함되어 문서화. 고도화 계획의 P3에도 동일 내용 재확인됨.**

핵심 SQL:
```sql
ALTER TABLE world_partition ADD COLUMN terrain_geojson jsonb;
UPDATE world_partition wp SET terrain_geojson = ST_Difference(
  ST_GeomFromGeoJSON(wp.boundary_geojson::text),
  (SELECT ST_Union(ST_GeomFromGeoJSON(wr.boundary_geojson::text))
   FROM world_road wr WHERE wr.dong_id = wp.admin_area_id)
)::jsonb;
```
클라이언트는 `terrain_geojson ?? boundary_geojson` 로 사용.

### Q4. 이 방법(ST_Difference로 빼기)이 좋은가?

**좋다. 단, 조건부.**

**장점**
- 한 번 계산해두면 런타임 연산 0 — 완전히 정적인 전처리.
- PostGIS ST_Difference는 성숙한 연산, robust.
- `boundary_geojson` 원본 유지 + 파생값 `terrain_geojson` 분리 → 롤백 쉬움.
- Three.js triangulation이 hole-aware (`earcut`) 이므로 구멍 뚫린 폴리곤 그대로 받아도 렌더링됨.

**리스크/주의점**
- ST_Difference 결과가 **MultiPolygon으로 쪼개지는 경우**: 파티션이 도로로 여러 조각 난다 → `buildTerrainBlockFromGeoJson`이 MultiPolygon 처리하는지 확인 필요.
- **파티션 텍스처 UV 연속성**: 현재 각 파티션은 자체 이미지 매핑. 도로로 구멍 뚫려도 UV 재계산 필요 없음 (hole은 UV 좌표에 무관). → 문제 없음.
- **elevation 불일치**: 도로는 보간된 단일 elevation, 주변 파티션은 각자 elevation. 구멍 뚫은 뒤에도 도로가 벽면으로 "쑥 들어가 보이는" 현상 가능 → Phase 5(P5)와 맞물림.

---

## 3. 현재 설계의 평가

### 좋은 점

1. **도로를 dong 단위로 묶음** — 그룹 경계를 넘는 도로 특성과 일치.
2. **centerline + boundary 동시 저장** — 렌더링과 물리 체크(어느 way인지) 분리.
3. **movement_bonus DB 저장** — 이동 버프 시스템 쉽게 연결 가능.
4. **road_type 4단계 분류** — agents/game_design/road_design_rules.md 와 정확히 일치.
5. **elevation 가중 보간** — OSM에 고도 없음. 현실적 근사.
6. **임시 단색 렌더링 채택** — 텍스처 없이 먼저 렌더 파이프라인 검증.
7. **Phase 4 분리** — 기능 구현 먼저, 최적화/정돈은 뒤. 좋은 순서.

### 문제점 / 개선 필요

| # | 문제 | 영향 | 해결 |
|---|---|---|---|
| A | **도로 필터링 범위 누락** — activeGroupKeys와 무관하게 동 전체 도로 렌더링 | 성능, 가시 범위 비대칭 | `roadMeshes`에서 road_key 또는 PostGIS spatial join으로 active 그룹 경계와 교차하는 도로만 필터 |
| B | **z-fighting 근본 해결 안 됨** — depthWrite=false는 임시 | 특정 카메라 각도에서 flicker | Phase 4 우선 실행 |
| C | **긴 도로의 단일 elevation** — 올림픽대로 같이 동 전체 가로지르는 도로는 한 elevation만 가짐 | 시각적으로 공중에 뜨거나 파묻힘 | 도로를 파티션 교차 영역별로 분할 (Phase 4와 합쳐서 처리 가능) |
| D | **197개 개별 draw call** | 성능 — 다른 동 추가될수록 누적 | road_type별 geometry merge (BufferGeometryUtils.mergeGeometries) — 동당 4 draw call로 축소 |
| E | **movement_bonus 미사용** | 게임플레이 미연결 | P4로 문서화됨. Phase 4 이후 |
| F | **단색 #555555 장기화 우려** | road_design_rules.md "회색 단색 띠로 오래 두지 않는다" 위반 | P2 텍스처 작업 조기 착수 |

---

## 4. 대안 설계 검토

### 대안 1: 도로를 decal(projected texture)로 취급

- 파티션 extrude geometry 상면에 도로 텍스처를 위에서 투영.
- 파티션 고도 차이를 자동으로 따라감 → elevation 불일치 문제 원천 해결.
- 단점: Three.js DecalGeometry 구현 복잡, 동적 고도 변화에 재계산 필요.
- **판단: 오버엔지니어링. 현재 게임 스케일에선 불필요.**

### 대안 2: 도로 세그먼트를 파티션별로 분할 저장

- `build_world_road.py` 에서 각 도로를 교차하는 파티션별로 잘라 `world_road_segment` 테이블에 저장.
- 각 세그먼트는 소속 파티션의 elevation 사용 → 자연스러운 고도 추종.
- 단점: 테이블 한 단계 추가, 데이터량 증가.
- **판단: Phase 4의 ST_Difference와 같은 타이밍에 같이 처리하면 효율적. 추천.**

### 대안 3: 현재 설계 유지 + Phase 4만 실행

- 파티션에서 도로 빼고, 도로는 단일 elevation 유지.
- 장점: 가장 단순, 이미 80% 완성.
- 단점: 긴 도로의 고도 불일치 이슈 남음. 하지만 depthWrite=false + renderOrder=6 조합으로 시각적으론 덜 거슬림.
- **판단: MVP로는 충분. 이슈가 실제로 보이면 그때 세그먼트 분할.**

---

## 5. 권장 실행 순서 (수정안)

### 즉시 (내일)
1. **Phase 4 선행** — terrain_geojson 컬럼 추가 + ST_Difference UPDATE
   - 이유: z-fighting 근본 해결, 도로 경계 선명화. 구현 난이도 낮음 (SQL 한 줄).
   - 노량진1동만 먼저 테스트 → 시각 확인 → 전체 동.
2. **도로 필터링 수정** — `roadMeshes`에서 activeGroupKeys와 교차하는 도로만 렌더
   - dbGroups의 boundary_geojson ∪ → 교차 여부 판정, 또는 서버에서 spatial join으로 필터된 결과 반환.
   - 간단 대안: dbRoads에 admin_area_id만 있음 → 현재 동 전체는 유지하되, draw call 수 문제는 (3)으로 해결.

### 단기 (이번 주)
3. **road_type별 geometry merge** — 동당 4 draw call로 축소.
4. **build_all_roads.py** — 캐시 있는 전체 동 일괄 생성.

### 중기
5. **road_type별 텍스처 적용** — 단순 alphaMap 방식 먼저 (노말맵/PBR은 과투자).
6. **movement_bonus 플레이어 이동에 연결** — 게임플레이 첫 연결점.

### 장기 (이슈 실제 발생 시)
7. **도로 세그먼트 분할** — 긴 도로 고도 불일치가 실제로 거슬리면.

---

## 6. 최종 판정

**원 설계 방향은 타당하고, 구현된 코드는 설계와 일치한다.**

단, 실제 구현 중 빠진 것/미완성인 것이 있어 내일 작업은 **원 계획 그대로 다음 단계(고도화 P1~P3)를 진행하기보다는**:

- **Phase 4(터페인 구멍 뚫기)를 P1로 올리는 것을 권장** — 이걸 하면 문제점 B, C의 대부분이 해결됨.
- **도로 필터링 수정(문제점 A)은 덤으로 처리** — 10분 작업.
- P1(다른 동 일괄 생성), P2(텍스처)는 그 이후.

이 수정안을 고도화 계획에 반영하면 된다.
