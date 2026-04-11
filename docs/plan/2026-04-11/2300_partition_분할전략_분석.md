# world_partition 분할 전략 분석 및 개선 계획

**작성일**: 2026-04-11  
**상태**: DRAFT — 확인 대기

---

## 1. 현재 상황 진단

### 1-1. 현재 파티션 생성 방식

```
source_layer = 'road_split'
source_feature.tags = { name: 'Sector Plot' }   ← 모든 파티션이 동일
```

**결론**: 현재 파티션은 OSM 실제 지형 feature가 아니라  
손으로 그린 "Sector Plot" 폴리곤을 도로 경계로 잘라서 만든 것.  
→ OSM landuse/waterway/building 정보는 `dominant_landuse` 추론에만 쓰임.  
→ 실제 지형 특성(수계, 산 능선, 건물군)이 경계선에 반영되지 않음.

### 1-2. 현재 수치 (분할 후)

| 동 | 파티션 수 | 평균 면적 | 최대 면적 |
|---|---|---|---|
| 노량진1동 | 354개 | 5,361m² | 34,890m² |
| 노량진2동 | 79개 | 7,669m² | 96,469m² |

노량진2동 park 96,469m²는 아직 분할 미적용.

### 1-3. 문제 유형별 분류

| 문제 유형 | 해당 지형 | 현재 처리 | 문제점 |
|---|---|---|---|
| **대형 공원/녹지** | 노량진공원, 용봉정근린공원 | bbox 격자 분할 | 직선 경계, 자연스럽지 않음 |
| **강(waterway)** | 한강, 안양천 | 별도 처리 없음 | 거대한 단일 파티션 가능 |
| **간선도로 내부** | 노량진로, 노들로 | road_split으로 쪼개짐 | 도로 폴리곤 내부가 과다 분할 |
| **대형 상업지구** | 노량진2동 상업 32,826m² | 분할 미적용 | 단일 텍스처 |
| **대학/병원** | 중앙대학교, 보라매병원 | 하나의 educational 파티션 | 캠퍼스 내부 구분 없음 |
| **산/구릉** | 용봉정산, 노량진산 | 등고선 무시 bbox 격자 | 사면 방향 무시 |

---

## 2. 분할 방식 옵션 비교

### Option A: 현재 방식 + bbox 격자 보완 (현재 상태)

```
장점: 구현 완료, 빠름
단점: 직선 격자 경계, 자연 지형 무시, 큰 공원이 체스판처럼 분할됨
적합: 상업지구, 평탄한 주거지역
```

### Option B: 자연 경계 우선 분할 (권장)

자연 지형별로 다른 분할 전략 적용:

| 지형 타입 | 권장 분할 전략 | 경계 기준 |
|---|---|---|
| 공원 (park) | 내부 보행로(footway/path) 기준 분할 | OSM footway 레이어 |
| 숲/산 (forest/natural) | 사면 방향별 4분할 (N/S/E/W) or 등고선 구간 | DEM or 등고선 OSM |
| 강 (waterway) | 교량 구간별 분할 (~200-500m 세그먼트) | OSM bridge/waterway |
| 상업지구 | 블록 단위 (도로로 둘러싸인 필지 블록) | OSM highway + building |
| 대학/병원 캠퍼스 | 내부 도로로 분할 | OSM service road |
| 주거지 | 현재 road_split 유지 | 현재 방식 OK |

### Option C: OSM 멀티레이어 재처리 (풀 리빌드)

```
입력: OSM pbf (서울 dongjak 추출)
레이어 우선순위:
  1. waterway (강, 하천) → 물 파티션 먼저 확정
  2. highway major (trunk, primary, secondary) → 주요 경계
  3. landuse + natural 경계선 → 지형 단위
  4. highway minor (residential, tertiary) → 내부 세분화
  5. building cluster → 상업/캠퍼스 내부
출력: 위 레이어를 순서대로 clip해서 파티션 생성
```

---

## 3. 현재 방식이 최선인가?

### 맞는 부분 (유지 권장)

- **도로 경계 우선** → 서울시 동 경계 원칙과 일치, 유지
- **is_road 분리** → 도로 파티션과 비도로 파티션 분리 올바름
- **admin_area 연결** → 동 단위 관리 구조 올바름

### 개선이 필요한 부분

| 우선순위 | 항목 | 작업량 | 효과 |
|---|---|---|---|
| **높음** | 노량진2동 large partition split 실행 | 10분 | 즉시 시각 개선 |
| **높음** | 강(한강/안양천) 파티션 별도 처리 | 2-3시간 | 수계 영역 올바른 표현 |
| **중간** | 공원 내부 footway 기반 분할 | 1일 | 공원 텍스처 자연스러워짐 |
| **중간** | 대학/병원 캠퍼스 내부 분할 | 반나절 | 캠퍼스 구역 구분 |
| **낮음** | 산/숲 사면 방향 분할 | 1-2일 | 산악 지형 리얼리티 |
| **낮음** | OSM 멀티레이어 전면 재처리 | 1주+ | 전체 품질 향상 |

---

## 4. 1차 목표 범위 권장안

### 4-A안: 노량진(1동+2동) 완성 우선 ← 권장

```
근거:
- 노량진1동은 이미 354개로 잘 쪼개짐
- 노량진2동은 79개 → large split + regroup으로 ~150개 예상
- 두 동을 완성하면 "플레이어블 데모 맵" 완성
- 동작구 전체는 11개 동 = 10배 작업량
```

**작업 순서 (노량진 완성 기준):**
1. 노량진2동 large partition split 실행
2. 노량진2동 regroup 실행
3. 한강/안양천 waterway 파티션 처리 (수계 별도 theme_code)
4. 노량진역 상업지구 상세 분할 (상업 블록 2-4개로)

### 4-B안: 동작구 전체 1차 확장

```
동작구 11개 동 = 노량진1,2 + 상도1,2,3,4 + 사당1,2,3,4 + 대방 + 신대방
→ 각 동마다 road_split seed 생성 + 분할 스크립트 적용
→ 추정 총 파티션: 2,000~3,000개
→ 리소스: seed 생성 스크립트 × 9개 동 + 검증
```

---

## 5. 수계(강/하천) 처리 설계

현재 가장 큰 미처리 문제. 한강/안양천이 단일 초대형 파티션으로 존재할 가능성.

### 권장 수계 파티션 설계

```
theme_code: 'ancient_waterway' or 'river_boundary'
is_road: false
source_layer: 'waterway_split'
분할 기준: 교량 위치 또는 ~300m 세그먼트
```

| 수계 구간 | 예상 파티션 수 | 특징 |
|---|---|---|
| 한강 (노량진 구간) | 4-6개 | 폭 500m, 구간별 분할 |
| 안양천 합류부 | 2-3개 | 합류점 포함 |
| 도림천 (노량진2동) | 2-4개 | 소하천 |

---

## 6. 실행 체크리스트

### Phase 1 — 즉시 실행 가능 (노량진2동 split)
- [ ] `split_large_partitions.py --dong-osm-id 3879477 --dry-run`
- [ ] 실제 실행
- [ ] `regroup_partition_members.py --dong-osm-id 3879477`

### Phase 2 — 수계 처리
- [ ] 노량진 인근 OSM waterway 데이터 확인
- [ ] `create_waterway_partitions.py` 스크립트 작성
- [ ] 한강/안양천 파티션 INSERT
- [ ] theme_code = 'ancient_waterway' 지정

### Phase 3 — 공원 footway 분할 (선택)
- [ ] OSM footway/path 레이어 추출 (노량진공원 내부)
- [ ] footway 교차점 기반 분할 로직 구현
- [ ] 기존 grid split 대체 또는 병행

### Phase 4 — 동작구 확장 (나중에)
- [ ] 각 동별 road_split seed 생성 파이프라인 구축
- [ ] 자동화 스크립트 (dong_osm_id 목록으로 일괄 처리)

---

## 7. 주의사항

- `world_partition` 분할 시 항상 백업 먼저 (JSON export)
- `partition_key` unique constraint: `_s{N:02d}` suffix 방식 유지
- 분할 후 반드시 `regroup_partition_members.py` 재실행
- 수계 파티션은 `is_road = false`지만 별도 theme_code로 그룹도 별도 구분
- 노량진2동 그룹 정보(`world_partition_group`)도 있는지 확인 필요

---

## 관련 파일

| 파일 | 역할 |
|---|---|
| `back/scripts/split_large_partitions.py` | 대형 파티션 격자 분할 |
| `back/scripts/regroup_partition_members.py` | 분할 후 그룹 재배정 |
| `docs/plan/partition_grouping_principles.md` | 서울시 기반 그루핑 원칙 |
| `docs/plan/2026-04-11/2100_대형파티션_분할_계획.md` | 분할 실행 계획 |
