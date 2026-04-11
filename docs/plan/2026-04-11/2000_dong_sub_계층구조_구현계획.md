# dong_sub 계층 구조 구현 계획

**작성일**: 2026-04-11  
**상태**: CONFIRMED

---

## 배경 및 목표

바닥 텍스처가 대부분 어두운 문제 해결.  
현재 CityBlockOverlay가 현재 위치 주변 700m 그룹만 렌더링해서 나머지 맵이 어둡게 보임.  
`world_partition_group`에 `group_level` 컬럼을 추가하여 전체 동 커버리지용 배경 레이어(dong_sub)를 도입한다.

---

## 계층 구조

```
서울특별시 (시)           → world_admin_area (level=city)    [기존]
└── 자치구 (~2.7km)       → world_admin_area (level=gu)     [기존]
    └── 법정동 (~670m)     → world_admin_area (level=dong)   [기존]
        └── 대구역 (~600m) → world_partition_group (group_level='dong_sub') [신규 5-6개]
            └── 소구역 (~200-400m) → world_partition_group (group_level='block') [기존 21개]
                └── 필지 (~100m)  → world_partition [기존 222개, 변경없음]
```

---

## 분석

### DB 테이블별 변경 범위

| 테이블 | 변경 내용 | 리스크 |
|---|---|---|
| `world_admin_area` | 변경 없음 | 없음 |
| `world_partition` | 변경 없음 | 없음 |
| `world_partition_group` | `group_level TEXT DEFAULT 'block'` 컬럼 추가 + dong_sub 5-6행 INSERT | 없음 (nullable+default) |
| `world_partition_group_member` | dong_sub 멤버 ~173행 추가 (파티션당 block 1개 + dong_sub 1개) | 없음 (group_id 다름) |

### 데이터 구조 샘플

**world_partition_group — dong_sub (신규)**

| id | group_key | group_level | display_name | centroid_lat | centroid_lng | theme_code |
|---|---|---|---|---|---|---|
| 101 | noryangjin1.ds_north | dong_sub | 북측 공원권 | 37.516 | 126.939 | sanctuary_green |
| 102 | noryangjin1.ds_central | dong_sub | 중앙 상업권 | 37.512 | 126.942 | urban_district |
| 103 | noryangjin1.ds_south | dong_sub | 남측 주거권 | 37.508 | 126.944 | residential_zone |
| 104 | noryangjin1.ds_east | dong_sub | 동측 학원권 | 37.511 | 126.948 | academy_sanctum |
| 105 | noryangjin1.ds_west | dong_sub | 서측 도로권 | 37.513 | 126.937 | ancient_stone_route |

**world_partition_group — block (기존 21개, group_level='block' 자동 적용)**

| id | group_key | group_level | display_name |
|---|---|---|---|
| 1 | noryangjin1.g01 | block | 공원 북구역 |
| … | … | block | … |
| 21 | noryangjin1.g21 | block | 도로 남측 |

**world_partition_group_member — 파티션당 2개 row**

| group_id | partition_id | 설명 |
|---|---|---|
| 1 (g01/block) | 15 | 기존 block 매핑 |
| 101 (ds_north/dong_sub) | 15 | 신규 dong_sub 매핑 |

### 렌더링 구조

```
CityBlockOverlay groupLevel="dong_sub"  → 항상 전체 동 렌더링 (배경 커버리지)
CityBlockOverlay groupLevel="block"     → 현재 위치 ±1500m만 (상세)
```

```jsx
// RpgWorld.jsx
<CityBlockOverlay groupLevel="dong_sub" />  {/* 배경 전체 */}
<CityBlockOverlay groupLevel="block"    />  {/* 상세 오버레이 */}
```

---

## 할 일 체크리스트

### Phase 0 — CityBlockOverlay 렌더링 즉시 수정 (DB 변경 없음)
- [ ] `front/src/entity/world/CityBlockOverlay.jsx` 인접 그룹 탐지 반경 700m → 1500m
- [ ] `showCurrentGroupTexture` ON 상태 렌더링 동작 검증
- [ ] `/front/public/ground/` 텍스처 파일 현황 확인

### Phase 1 — DB 스키마 변경
- [ ] `world_partition_group.group_level` 컬럼 추가 (TEXT, DEFAULT 'block')
- [ ] Alembic migration 작성: `back/alembic/versions/`
- [ ] `back/world/models/models.py` `WorldPartitionGroup` 모델에 `group_level` 컬럼 추가
- [ ] 기존 21개 그룹 group_level = 'block' (default 자동 적용 확인)

### Phase 2 — dong_sub 그룹 생성 스크립트
- [ ] `back/scripts/create_dong_sub_groups.py` 작성
  - 노량진1동 경계 기준 Voronoi 5-6개 구역 자동 계산
  - `world_partition_group` INSERT (group_level='dong_sub')
  - `world_partition_group_member` INSERT (각 partition → dong_sub 매핑)
- [ ] 스크립트 실행: `python back/scripts/create_dong_sub_groups.py --dong-osm-id 3879474`
- [ ] 결과 검증: dong_sub 그룹 5-6개, 전체 173개 비도로 파티션 커버 확인

### Phase 3 — 백엔드 API 수정
- [ ] `back/world/services/partition_service.py` 그룹 레벨별 조회 함수 추가
  - `get_partition_groups_by_level(admin_area_id, group_level)` 추가
- [ ] `back/world/routers/router.py` API 엔드포인트 수정
  - `GET /api/world/partition-groups/dong/{dong_id}?level=dong_sub` 지원

### Phase 4 — 프론트엔드 이중 레이어 렌더링
- [ ] `front/src/entity/world/CityBlockOverlay.jsx`
  - `groupLevel` prop 추가 (기본값 'block')
  - groupLevel에 따라 다른 API 호출 분기
- [ ] `front/src/entity/world/RpgWorld.jsx`
  - dong_sub + block 이중 레이어 구성

### Phase 5 — 텍스처 생성 (오프라인)
- [ ] dong_sub 5-6장 ComfyUI 생성
- [ ] block 21장 ComfyUI 생성 (우선순위 낮음)
- [ ] `/front/public/ground/{group_key}.png` 저장 및 연동

---

## 주의사항

- `world_partition` 테이블은 수정하지 않음 (이미 최소 단위, 222개 필지)
- `world_level_partition`은 VIEW — 직접 UPDATE 불가
- `group_level` 컬럼 추가는 `DEFAULT 'block'` 방식 → 기존 21개 row 자동 적용, 무중단
- dong_sub 멤버 INSERT 시 unique constraint `uq_world_partition_group_member_group_partition` 주의 (group_id + partition_id 조합이 달라야 함)
- dong_sub은 block보다 먼저 렌더링 (renderOrder 낮게 설정)
- 텍스처 파일 없으면 theme_code 기반 fallback 색상으로 처리

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `back/world/models/models.py` | WorldPartitionGroup.group_level 컬럼 추가 |
| `back/alembic/versions/` | group_level 컬럼 마이그레이션 |
| `back/scripts/create_dong_sub_groups.py` | dong_sub 그룹 자동 생성 스크립트 |
| `back/world/services/partition_service.py` | 그룹 레벨별 조회 |
| `back/world/routers/router.py` | ?level= 파라미터 지원 |
| `front/src/entity/world/CityBlockOverlay.jsx` | groupLevel prop + 이중 레이어 |
| `front/src/entity/world/RpgWorld.jsx` | 이중 레이어 호출 |
| `front/public/ground/` | 텍스처 이미지 저장 위치 |
