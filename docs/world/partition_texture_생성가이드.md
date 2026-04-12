# World Partition 생성 및 텍스처 가이드

> 파티션 **지오메트리 생성**(어떻게 쪼개나)부터 **텍스처 입히기**(AI 이미지 생성)까지 전 과정.
> 동작구 내 모든 동(洞)에 동일 기준으로 적용한다.

---

## 1. 전체 파이프라인

```
OSM Overpass API
  └─ fetch_osm_features.py
       └─ {dong_osm_id}_features.geojson (캐시)

build_partitions_from_osm.py
  ├─ 도로 라인 polygonize → 블록 생성
  ├─ OSM landuse feature → dominant_landuse 매핑
  ├─ 큰 블록: longest_axis_split (장축 기준 재귀 분할)
  ├─ 작은 자투리: absorb_slivers (이웃 흡수)
  └─ DB INSERT → world_level_partition

regroup_partition_members.py
  └─ 공간 인접성 기반 그룹 재배정

generate_partition_textures.py
  ├─ boundary_geojson → polygon mask (PIL)
  ├─ ComfyUI inpainting (SDXL)
  └─ front/public/world_partition/{group_short}/{name}.png
       └─ DB texture_image_url 업데이트
```

---

## 2. 파티션 분할 기준 (가장 중요)

### 2-1. 도로 등급 — 경계로 쓰는 것 / 안 쓰는 것

| 등급 | 경계 사용 | 비고 |
|------|-----------|------|
| motorway, motorway_link | ✅ | 고속도로 |
| trunk, trunk_link | ✅ | 대로 |
| primary, primary_link | ✅ | 주요 간선 |
| secondary, secondary_link | ✅ | 보조 간선 |
| tertiary, tertiary_link | ✅ | 3차로 |
| residential | ✅ | 주거 도로 |
| living_street | ✅ | 생활도로 |
| unclassified | ✅ | 미분류 도로 |
| **service** | ❌ | 주차장 진입로 등 — 파티션 지나치게 쪼개짐 |
| **footway / path / steps** | ❌ | 보행로 — 너무 세밀 |
| **cycleway** | ❌ | 자전거도로 |

> **핵심 원칙**: service/footway/path를 포함하면 파티션이 수백 개로 과분할됨.  
> residential 이상 등급만 블록 경계로 사용한다.

### 2-2. 파티션 크기 기준 (m²)

| 상수 | 값 | 의미 |
|------|----|------|
| `TARGET_MAX_M2` | **10,000 m²** | 이 초과 → 장축 분할 |
| `TARGET_MIN_M2` | **3,000 m²** | 이 미만 → 흡수 대상 |
| `ABSORB_MIN_M2` | **500 m²** | 이 미만 → 무조건 흡수 |
| `SPLIT_MAX_DEPTH` | **6** | 최대 재귀 분할 횟수 |

기준 근거:
- `10,000 m²` = 약 100×100m = 서울 일반 도로블록 크기 상한
- `3,000 m²` = 약 55×55m = RPG에서 하나의 지역감을 줄 수 있는 최소 크기
- `500 m²` = 약 22×22m = 이 이하는 텍스처 의미 없음 → 흡수

### 2-3. 분할 방식: 장축(Longest Axis) 분할

격자(grid) 분할 **금지** — 직선 격자는 도로 블록 모양을 무시하고 체스판처럼 쪼갬.

```python
def longest_axis_split(geom, target_max, depth=0):
    # 1. minimum_rotated_rectangle로 최소 외접 직사각형 계산
    # 2. 긴 변 방향이 장축 → 짧은 변 방향(= 장축에 수직)으로 중앙 절단
    # 3. 절단된 두 조각 각각에 재귀 적용
    # 4. depth >= SPLIT_MAX_DEPTH 또는 target_max 이하면 중단
```

결과: 블록의 자연스러운 형태(직사각형, L자, 사다리꼴)를 최대한 유지하면서 분할.

### 2-4. 슬리버 흡수 (absorb_slivers)

분할 후 생기는 얇은 자투리를 이웃 파티션에 병합:
- 기준: `ABSORB_MIN_M2` (500 m²) 미만
- 흡수 대상: 공유 경계선이 가장 긴 이웃 파티션
- 0개가 될 때까지 반복

---

## 3. Landuse 매핑 기준

OSM feature의 태그 → `dominant_landuse` + `theme_code`

| OSM 태그 값 | dominant_landuse | theme_code | 색상 참조 |
|------------|-----------------|------------|-----------|
| water, river, stream, canal | `water` | `ancient_waterway` | #4fc3f7 |
| park, grass, meadow, stadium, pitch | `park` | `sanctuary_green` | #81c784 |
| forest, wood, scrub, nature_reserve | `forest` | `sanctuary_green` | #388e3c |
| cemetery, grave_yard | `cemetery` | `sanctuary_green` | #90a4ae |
| residential, housing, allotments | `residential` | `residential_zone` | #ffb74d |
| commercial, retail, mixed_use | `commercial` | `urban_district` | #42a5f5 |
| school, university, college, kindergarten | `educational` | `academy_sanctum` | #ce93d8 |
| hospital, clinic | `medical` | `sanctuary_healing` | #ef9a9a |
| industrial, railway | `industrial` | `forge_district` | #bcaaa4 |
| military | `military` | `fortress_grounds` | #a5d6a7 |
| **(기본값)** | `residential` | `residential_zone` | #bdbdbd |

#### landuse 결정 우선순위 (`LANDUSE_PRIORITY`)

```
water > 공원/녹지 > 묘지 > 교육 > 의료 > 군사 > 산업 > 상업 > 스포츠 > 주거
```

블록이 여러 OSM feature와 겹칠 때 **우선순위가 높은 feature**가 결정함.
(단, 겹침 비율이 블록 면적의 10% 미만이면 무시)

---

## 4. 실행 방법 (동 단위)

```bash
# ── Step 1: OSM feature 수집 (캐시 자동 생성) ──────────────────────────────
python back/scripts/fetch_osm_features.py --dong-osm-id {DONG_OSM_ID}
# 캐시 위치: back/world/data/osm_cache/{dong_osm_id}_features.geojson
# 강제 재수집: --force

# ── Step 2: 파티션 생성 (dry-run으로 먼저 확인) ────────────────────────────
python back/scripts/build_partitions_from_osm.py --dong-osm-id {DONG_OSM_ID} --dry-run
# → DB 변경 없이 예상 파티션 수, 면적 분포 출력

# ── Step 3: 실제 생성 (기존 파티션 삭제 후 재삽입) ────────────────────────
python back/scripts/build_partitions_from_osm.py --dong-osm-id {DONG_OSM_ID}

# ── Step 4: 그룹 재배정 ────────────────────────────────────────────────────
python back/scripts/regroup_partition_members.py --dong-osm-id {DONG_OSM_ID}
```

#### 주요 동 OSM ID

| 동 | osm_id | 완료 여부 |
|----|--------|-----------|
| 노량진1동 | 3879474 | ✅ 완료 (285개) |
| 노량진2동 | 3879477 | ✅ 완료 (98개) |
| 상도1동 | - | 대기 |
| 상도2동 | - | 대기 |
| 상도3동 | - | 대기 |
| 상도4동 | - | 대기 |
| 사당1동 | - | 대기 |
| 사당2동 | - | 대기 |
| 사당3동 | - | 대기 |
| 사당4동 | - | 대기 |
| 대방동 | - | 대기 |
| 신대방1동 | - | 대기 |
| 신대방2동 | - | 대기 |

> osm_id 확인: `SELECT osm_id, name FROM world_area WHERE area_level='dong' AND name LIKE '%상도%';`

---

## 5. 백업 절차 (필수)

파티션 재생성 전 반드시 백업:

```bash
docker exec {postgres_container} pg_dump -U {user} -d {db} \
  -t world_level_partition -t world_partition_group -t world_partition_group_member \
  --data-only --inserts \
  > back/world/data/backups/partition_backup_{동이름}_{날짜}.sql
```

백업 위치: `back/world/data/backups/`

---

## 6. 텍스처 생성 (AI 이미지)

### 6-1. UV 좌표계 규칙

```python
# to_px() 내부 — 반전(1.0 -) 없음
def to_px(lng, lat):
    x = (lng - min_lng) / span_lng * width
    y = (lat - min_lat) / span_lat * height  # ← 1.0 - 하면 상하 반전됨, 금지
    return (x, y)
```

**북쪽(lat 큰 값) = 이미지 하단(큰 y)** — Three.js flipY=true 기본값과 맞아 정렬됨.

Three.js UV 계산 (`CityBlockOverlay.jsx`):
```js
uvs[ui++] = (p.x - minX) / spanX;   // u
uvs[ui++] = (p.z - minZ) / spanZ;   // v  (z 작을수록 = 북쪽 = image 하단)
```

### 6-2. 이미지 해상도

```python
METERS_PER_PIXEL = 0.5   # 1px = 0.5m
# 건물 1개 ≈ 10~20px → 게임 스케일과 자연스럽게 일치
# 최대 1536×1536, 64 배수 클램프 (SDXL 요구사항)
```

### 6-3. ComfyUI Inpainting

```
CheckpointLoaderSimple (SDXL)
    → CLIPTextEncode (positive: top-down RPG ground texture + landuse 프롬프트)
    → EmptyLatentImage
LoadImage (polygon mask PNG)
    → ImageToMask → SetLatentNoiseMask
KSampler (steps=30, cfg=5.0, euler/karras)
    → VAEDecode → SaveImage
```

polygon 경계: `MASK_FEATHER=12px` Gaussian blur로 자연스럽게 블렌딩.

### 6-4. 프롬프트 구조

```python
STYLE_PREFIX = (
    "top-down bird's eye view RPG ground texture, "
    "directly overhead 90 degrees, flat ground surface, ..."
)
positive = STYLE_PREFIX + area_prompt + group_prompt + persona_hint + scale_hint
# scale_hint 예: "area 174m x 177m, each building 10-20m wide"
```

### 6-5. 텍스처 스크립트 실행

```bash
# 특정 파티션
python back/scripts/generate_partition_textures.py \
    --partition-keys seoul.dongjak.noryangjin2.primary.p024 --outline

# 그룹 내 전체 파티션 개별 생성
python back/scripts/generate_partition_textures.py \
    --group-key seoul.dongjak.noryangjin2.group.g04 \
    --per-partition --outline

# UV 정렬 검증용 (이미지 지우고 outline만)
python back/scripts/generate_partition_textures.py \
    --group-key seoul.dongjak.noryangjin2.group.g04 \
    --outline-only --blank
```

출력: `front/public/world_partition/{group_short}/{partition_short}.png`  
DB: `world_level_partition.texture_image_url` 자동 업데이트

---

## 7. Three.js 렌더링 구조

```jsx
// CityBlockOverlay.jsx — UV 선택 로직
const isSharedGroupImage = urlCount.get(partition.texture_image_url) > 1;
const uvBounds = isSharedGroupImage ? groupUvBounds : null;
// --per-partition 모드 → 고유 URL → 파티션 자체 bbox UV 사용

// 재질
<meshBasicMaterial
  map={texture}
  transparent alphaTest={0.1}       // polygon 외부 투명
  stencilFunc={THREE.EqualStencilFunc}  // 동 마스크 내부만 렌더
/>
```

---

## 8. 파일 위치 참조

| 파일 | 역할 |
|------|------|
| `back/scripts/fetch_osm_features.py` | Overpass API 수집, GeoJSON 캐시 |
| `back/scripts/build_partitions_from_osm.py` | OSM → 파티션 생성 (핵심) |
| `back/scripts/regroup_partition_members.py` | 분할 후 그룹 재배정 |
| `back/scripts/generate_partition_textures.py` | AI 텍스처 생성 |
| `back/world/data/osm_cache/` | Overpass 응답 캐시 |
| `back/world/data/backups/` | DB 백업 SQL |
| `front/public/world_partition/` | 생성된 텍스처 PNG |
| `front/src/entity/world/CityBlockOverlay.jsx` | Three.js 렌더러 |
| `front/src/entity/world/GroupColorOverlay.jsx` | 그룹/파티션 디버그 오버레이 |
| `agents/game_design/world_partition_rules.md` | 파티션 설계 원칙 (게임 디자인) |

---

## 9. 인게임 디버그 레이어

게임 내 레이어 패널에서 파티션 상태 확인:

| 레이어 버튼 | 기능 |
|------------|------|
| 그룹선 (⬒) | world_partition_group 경계 표시 |
| 미세선 (┼) | 개별 파티션 경계 표시 |
| 그룹색 (🌈) | 그룹별 컬러 fill + 이름/개수 라벨 |
| 그룹영역 (◩) | 그룹별 fill + 면적(ha) 라벨 |
| 파티션 (▦) | 파티션별 landuse 색 fill + 경계선 |

---

## 10. 문제 해결 이력

| 날짜 | 증상 | 원인 | 해결 |
|------|------|------|------|
| 2026-04-11 | polygon outline 상하 반전 | `to_px` y에 `1.0 -` 반전 오적용 | 반전 제거 |
| 2026-04-11 | asyncio 두 번 호출 오류 | `asyncio.run()` 중복 | `async def main()` 단일 진입점 |
| 2026-04-12 | grid split → 체스판 패턴 | 격자 분할이 블록 모양 무시 | longest_axis_split으로 대체 |
| 2026-04-12 | `city_name` column 없음 | world_area에 해당 컬럼 없음 | parent_id JOIN으로 계층 탐색 |
| 2026-04-12 | service 도로로 과분할 | BOUNDARY_HIGHWAY에 service 포함 | service/footway/path 제외 |
| 2026-04-12 | 슬리버 파티션 다수 발생 | 도로 polygonize 후 얇은 조각 | absorb_slivers() 흡수 로직 추가 |

---

*이 문서는 동작구 전체 파티션 작업의 기준 문서다. 새 동 적용 시 §4 실행 방법을 따른다.*

---

## 다음 단계

이 가이드로 전체 동 기본 파티션 완성 후:

| 단계 | 문서 | 내용 |
|------|------|------|
| Phase 2 | [`[예정]_특수지형_파티션_고도화.md`]([예정]_특수지형_파티션_고도화.md) | 한강/안양천 수계, 철도 회랑, 대형 공원 추가 처리 |
| Phase 3 | [`3D지형_고도_설계.md`](3D지형_고도_설계.md) | DEM 기반 파티션 elevation_m, y-offset 렌더링 |
