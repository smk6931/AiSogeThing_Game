# World Road Layer 설계 계획

**날짜**: 2026-04-22  
**목표**: OSM 도로 데이터를 world_partition 시스템에 통합, 등고선 위에 도로 메시 렌더링

---

## 1. 현재 상황 분석

### 문제
- `world_partition` 폴리곤이 도로 영역을 포함한 채로 관리됨
- 등고선(showElevation) ON 시 도로 포함된 지형 블록 전체가 올라감 → 비자연스러움
- 도로와 지형이 같은 메시 → z-fighting, 레이어 분리 불가

### 목표 상태
```
등고선 ON 렌더링:
  ┌─────────────────────────────┐
  │  world_group boundary       │
  │  ┌──────┐  도로  ┌──────┐  │
  │  │파티션│~~~~~~~~│파티션│  │  ← 도로가 파티션 사이를 흐름
  │  │(고도)│        │(고도)│  │
  │  └──────┘        └──────┘  │
  └─────────────────────────────┘
```

---

## 2. 기존 OSM 파이프라인 분석 (조사 완료)

### 파일 구조
```
back/scripts/
  fetch_osm_features.py         ← Overpass API → osm_cache 파일 생성
  build_partitions_from_osm.py  ← osm_cache 읽어서 world_partition DB 저장
  
back/world/data/osm_cache/
  {dong_osm_id}_features.geojson  ← landuse/waterway 등 area feature
  {dong_osm_id}_roads.json        ← 도로 LINE 데이터 (node + way)
```

### roads.json 구조 (이미 존재)
```json
[
  { "type": "node", "id": 123, "lon": 126.94, "lat": 37.51 },
  {
    "type": "way",
    "id": 456,
    "nodes": [123, 124, 125],
    "tags": {
      "highway": "tertiary",
      "name": "등용로",
      "lanes": "2"
    }
  }
]
```
**→ 도로 raw data가 이미 캐시에 있음. 새 스크립트에서 재활용 가능.**

### BOUNDARY_HIGHWAY (현재 파티션 경계로 쓰이는 도로 등급)
```python
{ motorway, motorway_link, trunk, trunk_link,
  primary, primary_link, secondary, secondary_link,
  tertiary, tertiary_link, residential, living_street, unclassified }
```
service, footway, path는 파티션 경계에서 제외되어 있음 → `world_road`에서는 alley로 포함.

---

## 3. DB 스키마

### 3-1. world_road 테이블 (신규)
```sql
CREATE TABLE world_road (
  id                SERIAL PRIMARY KEY,
  road_key          VARCHAR UNIQUE NOT NULL,     -- "{dong_osm_id}_r_{osm_way_id}"
  dong_id           INT REFERENCES world_dong(id) ON DELETE CASCADE,
  osm_way_id        BIGINT,                      -- OSM way id (추적용)
  road_type         VARCHAR NOT NULL,            -- arterial/collector/local/alley
  boundary_geojson  JSONB NOT NULL,              -- buffered Polygon (렌더링용)
  centerline_geojson JSONB,                      -- 원본 LineString (보관)
  real_name         VARCHAR,                     -- OSM name 태그
  width_m           FLOAT NOT NULL,              -- buffer 너비
  elevation_m       FLOAT DEFAULT 0,             -- 인접 파티션에서 보간
  movement_bonus    FLOAT DEFAULT 1.0,           -- 이동 배율
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_world_road_dong    ON world_road(dong_id);
CREATE INDEX idx_world_road_spatial ON world_road
  USING GIST (ST_GeomFromGeoJSON(boundary_geojson::text));
```

### road_type 기준

| type | OSM highway 태그 | buffer 너비 | 이동 배율 |
|---|---|---|---|
| `arterial`  | trunk, primary, secondary           | 12m | 1.3 |
| `collector` | tertiary, residential, living_street | 7m  | 1.1 |
| `local`     | service, unclassified               | 4m  | 1.0 |
| `alley`     | footway, path, steps                | 2m  | 0.85 |

### 3-2. world_partition 변경사항 (Phase 4 전까지 없음)
```sql
-- Phase 4에서 추가 예정 (지금은 건드리지 않음):
ALTER TABLE world_partition ADD COLUMN terrain_geojson JSONB;

-- Phase 4 실행 시 한 번만:
UPDATE world_partition p SET terrain_geojson = ST_AsGeoJSON(
  ST_Difference(
    ST_GeomFromGeoJSON(p.boundary_geojson::text),
    (SELECT ST_Union(ST_GeomFromGeoJSON(r.boundary_geojson::text))
     FROM world_road r
     WHERE r.dong_id = p.dong_id
       AND ST_Intersects(ST_GeomFromGeoJSON(r.boundary_geojson::text),
                         ST_GeomFromGeoJSON(p.boundary_geojson::text)))
  )
)::jsonb;
-- → 파티션에서 도로 구멍 뚫린 terrain_geojson 사전 계산 완료
```

---

## 4. 새 스크립트: build_world_road.py

### 위치
`back/scripts/build_world_road.py`

### 로직 흐름
```
1. dong_osm_id 인자로 받음
2. osm_cache/{dong_osm_id}_roads.json 로드 (이미 있음)
3. 각 highway way 순회:
   a. node_map으로 좌표 복원 → LineString
   b. highway 태그 → road_type 분류
   c. road_type → buffer 너비 결정
   d. LineString → buffer → WGS84 Polygon
   e. 동 경계로 clip (ST_Intersection)
   f. DB의 world_partition에서 겹치는 파티션들의 elevation_m 가중 평균 → elevation_m 결정
4. world_road 테이블에 upsert
```

### 핵심 코드 구조
```python
HIGHWAY_TO_TYPE = {
    'trunk':         'arterial',  'primary':    'arterial',
    'secondary':     'arterial',
    'tertiary':      'collector', 'residential':'collector',
    'living_street': 'collector',
    'service':       'local',     'unclassified':'local',
    'footway':       'alley',     'path':        'alley',
    'steps':         'alley',
}

TYPE_TO_BUFFER_M = {
    'arterial': 12.0, 'collector': 7.0,
    'local':    4.0,  'alley':     2.0,
}

TYPE_TO_MOVEMENT = {
    'arterial': 1.3, 'collector': 1.1,
    'local':    1.0, 'alley':     0.85,
}

# EPSG:5186 (한국 평면 좌표) 으로 변환 후 buffer, 다시 WGS84로
def line_to_buffered_polygon(coords_lnglat, width_m):
    ...

# DB world_partition에서 겹치는 파티션들 elevation_m 가중 평균
async def interpolate_elevation(road_polygon_geojson, dong_id, session):
    ...
```

---

## 5. API 변경

### 기존: GET /world/codex/dong/{dong_id}/groups
```json
{ "groups": [...], "partitions": [...] }
```

### 변경: roads 배열 추가
```python
# world/router/codex.py 또는 해당 라우터에 추가
@router.get("/dong/{dong_id}/roads")
async def get_dong_roads(dong_id: int, ...):
    # dong_id 기준으로 world_road 조회
    # boundary_geojson이 dong boundary 내인 것만
    ...
```

또는 기존 그룹 API 응답에 포함 (클라이언트 요청 한 번으로 처리).  
**dong 단위로 한 번에 반환** → 클라이언트에서 activeGroupKeys로 필터링.

---

## 6. 클라이언트 렌더링

### 렌더 순서
```
order=3  basal slab (gap 메우기)
order=4  파티션 절벽 (cliff walls)
order=5  파티션 상단면 (group top face)
order=6  도로 메시  ← 신규
```

### 도로 메시 생성
```javascript
// CityBlockOverlay.jsx 또는 별도 RoadOverlay.jsx
const buildRoadMesh = (road, effectiveScale) => {
  const elevY = BASE_Y + road.elevation_m * effectiveScale + 0.02; // 파티션 위로 살짝
  return buildTerrainBlockFromGeoJson(road.boundary_geojson, false, null, null, elevY);
};
```

### 도로 머티리얼 (임시: 어두운 회색)
```jsx
// 텍스처 파일 불필요, 코드에서 직접 색상 지정
<meshBasicMaterial
  color="#555555"
  side={THREE.DoubleSide}
  toneMapped={false}
  depthWrite={false}
  renderOrder={6}
/>
```
나중에 도로 텍스처 준비되면 `map={roadTex}`로 교체.

---

## 7. 구현 순서 (체크리스트)

### Phase 1: DB + 데이터 (백엔드)
- [ ] Alembic migration: `world_road` 테이블 생성
- [ ] `back/scripts/build_world_road.py` 작성
  - [ ] `_roads.json` → highway way 파싱
  - [ ] LineString → buffered Polygon (EPSG:5186 buffer)
  - [ ] elevation_m 보간 (인접 파티션 가중 평균)
  - [ ] `world_road` upsert
- [ ] 노량진1동 테스트 실행: `python back/scripts/build_world_road.py --dong-osm-id 3879474`

### Phase 2: API
- [ ] `GET /world/dong/{dong_id}/roads` 엔드포인트 추가
- [ ] 또는 기존 groups API에 roads 포함

### Phase 3: 클라이언트 렌더링
- [ ] 도로 데이터 fetch (RpgWorld.jsx 또는 CityBlockOverlay.jsx)
- [ ] 도로 메시 생성 (`buildTerrainBlockFromGeoJson` 재활용)
- [ ] 임시 회색 머티리얼 (#555555)
- [ ] `showElevation` ON/OFF 시 elevation 추종 확인
- [ ] 플레이어가 도로 위일 때 movement_bonus 적용

### Phase 4: 파티션에서 도로 빼기 (나중에)
- [ ] `world_partition.terrain_geojson` 컬럼 추가
- [ ] ST_Difference 쿼리로 일괄 계산 (위 SQL 참조)
- [ ] 클라이언트에서 `terrain_geojson` 우선 사용

---

## 8. 핵심 결정 요약

| 결정 사항 | 선택 | 이유 |
|---|---|---|
| 도로 소속 | dong (그룹 아님) | 도로는 그룹 경계를 넘기 때문 |
| 그룹↔도로 연결 | spatial query (junction 테이블 없음) | 단순 구조 유지 |
| 파티션에서 도로 제거 | Phase 4에서 별도 컬럼으로 | 우선 기능 구현, 한 줄 쿼리로 나중에 가능 |
| 도로 고도 | 인접 파티션 elevation 가중 보간 | OSM에 고도 없음 |
| 임시 텍스처 | color="#555555" (코드 직접) | 텍스처 파일 준비 불필요 |
| 렌더 레이어 | order=6 (파티션=5 위) | z-fighting 없이 도로가 파티션 위에 표시 |
