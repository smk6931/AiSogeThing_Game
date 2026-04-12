# 파티션 그루핑 원칙 — 서울시 행정구역 분석 기반

## 1. 서울시 실제 행정구역 쪼갬 방식 분석

### 1-1. 계층 구조

```
서울특별시 (시)
└── 자치구 (25개) — 평균 면적 약 24km², 평균 반경 약 2.7km
    └── 법정동 (424개) — 평균 면적 약 1.4km², 평균 반경 약 670m
        └── 통/반 (최소 단위) — 평균 약 100~200m 반경
```

### 1-2. 동(洞) 경계 결정 원칙

서울시가 동 경계를 나눌 때 사용하는 실제 기준:

| 우선순위 | 기준 | 설명 |
|---|---|---|
| 1 | 자연 경계 | 강, 하천, 산 능선이 가장 강한 경계 |
| 2 | 대형 도로 | 왕복 4차선 이상 도로가 경계선 역할 |
| 3 | 철도/지하철 | 선로가 지역을 분리 |
| 4 | 지형 유사성 | 같은 용도지역(주거/상업/공원)끼리 묶기 |
| 5 | 인구/면적 균형 | 동별 인구 1만~3만명, 면적 0.5~3km² |
| 6 | 생활권 연속성 | 주민이 실제로 같은 생활권을 공유 |

### 1-3. 노량진1동 실측 데이터 (게임 맵 기준)

```
전체 범위: 1370m(남북) × 1756m(동서)
총 파티션: 222개 (도로 49개, 비도로 173개)
비도로 평균 면적: ~8,560m²
비도로 5번째 이웃 거리: 중앙값 103m (p25=72m, p75=140m)
기존 그룹 수: 21개 (목표)
```

---

## 2. 게임 파티션 그루핑에 적용할 원칙

### 2-1. 핵심 제약 (Hard Constraints)

```
① 공간 반경 제약: 그룹 내 모든 파티션의 centroid가 그룹 중심에서 350m 이내
② 파티션 수 제약: 그룹당 최대 15개 (비도로 기준)
③ 연결성 제약: 그룹 내 파티션들은 인접 관계로 연결된 부분 그래프여야 함
    (= 고리형/섬 불허, 경계를 실제로 맞대고 있어야 연결)
④ 도로 분리: 도로(is_road=True) 파티션은 비도로와 다른 그룹으로 분리
```

### 2-2. 선호 기준 (Soft Constraints, 우선순위 순)

```
1. dominant_landuse 동일한 파티션 우선 묶기
   (park끼리, residential끼리, educational끼리)
2. theme_code 동일한 파티션 우선 묶기
3. 가장 가까운 파티션 우선 확장 (BFS, 거리 기준)
4. 그룹 모양이 최대한 compact (원형에 가깝게, 길쭉한 형태 지양)
```

### 2-3. 기존 알고리즘의 문제점

**Union-Find + 인접성 체인**의 문제:
```
A — B — C — D — E — F    (모두 park, 인접)
→ 전부 하나의 클러스터로 병합됨
→ A와 F는 실제 1.7km 떨어져 있어도 같은 그룹이 됨
→ 결과: sanctuary_green 133개, 1756m 범위
```

**올바른 방식 (Radius-constrained BFS)**:
```
A — B — C (350m 반경 내) → Group 1
            D — E — F (350m 반경 내) → Group 2
```

### 2-4. 도로 파티션 처리

- 도로는 비도로 그룹과 **완전 분리**
- 도로는 별도 road group (theme=road)으로 묶거나 그룹핑 대상에서 제외
- 현재 기존 그룹 중 is_road 파티션이 대량 포함된 그룹(g18: 133개)은 재설계 필요

---

## 3. 올바른 그루핑 알고리즘 설계

### 3-1. 입력값

```
partitions: List[{id, centroid_lat, centroid_lng, dominant_landuse, theme_code, is_road, area_m2, boundary_geojson}]
groups: List[{id, group_key, theme_code, persona_tag, primary_landuse}]  ← 기존 그룹 정의
```

### 3-2. 알고리즘 (Greedy Radius-constrained BFS Clustering)

```
1. 도로 파티션 분리 → road_group 에 일괄 배정 (or 스킵)

2. 비도로 파티션을 면적 내림차순 정렬 (큰 파티션이 그룹 seed)

3. 미배정 파티션 중 가장 큰 것을 seed로 선택:
   a. seed의 dominant_landuse에 맞는 기존 group 선택
   b. BFS 확장:
      - 큐에 seed 추가
      - 인접한 파티션 중:
        * 미배정 상태
        * seed의 dominant_landuse 또는 theme_code와 동일 (또는 유사)
        * 현재 그룹 중심에서 350m 이내
        * 현재 그룹 파티션 수 < 15
      → 조건 만족 시 그룹에 추가, 큐에 추가
   c. BFS 종료 → 다음 미배정 파티션으로

4. 모든 파티션 배정 완료 시 종료

5. 기존 그룹(group_key)에 매핑:
   - 클러스터의 dominant_landuse/theme_code 다수결 → 가장 유사한 group 선택
   - 같은 그룹에 여러 클러스터가 배정될 수 있음 (단, 각 파티션은 1그룹만)
```

### 3-3. 파라미터 설정값 (노량진1동 기준)

```python
MAX_RADIUS_M = 350       # 그룹 중심에서 최대 350m
MAX_PARTITION_COUNT = 15  # 그룹당 최대 파티션 수 (비도로)
LANDUSE_BONUS = 1.5      # 같은 landuse끼리 BFS 우선순위 가중치
MIN_GROUP_SIZE = 2        # 단독 파티션은 가장 가까운 그룹에 흡수
```

---

## 4. 기대 결과

### 현재 (잘못된 그루핑)

```
g18: 133개 파티션, 1756m 범위 (sanctuary_green 전부 chain-merge)
g19: 49개 파티션, 1342m 범위
g15: 21개 파티션, 1414m 범위
```

### 목표 (서울 동 분할 원칙 적용)

```
sanctuary_green 133개 → 7~9개 그룹으로 분할 (각 15개 이하, 350m 이내)
academy_sanctum 21개 → 2~3개 그룹
event_pocket 14개 → 1~2개 그룹
도로 49개 → 별도 road 그룹들
```

이렇게 하면 전체 1370×1756m 지도가 **약 200~350m 반경의 20~25개 그룹**으로 나뉘어,
서울시 통/반 단위와 유사한 밀도로 페르소나 구분이 가능해진다.

---

## 5. 관련 파일

| 파일 | 역할 |
|---|---|
| `back/scripts/regroup_partition_members.py` | 그루핑 실행 스크립트 (재작성 필요) |
| `back/world/models/models.py` | WorldPartitionGroup, WorldPartitionGroupMember 모델 |
| `front/src/entity/world/CityBlockOverlay.jsx` | 그룹 텍스처 렌더링 |
| `front/src/entity/world/PartitionBoundaryOverlay.jsx` | 그룹 경계선 렌더링 |
