# Title: Road Design Rules
Description: 도로를 단순 시각선이 아니라 이동, 병목, 분위기, 구역 인지에 쓰는 월드 설계 규칙.
When-To-Read: 도로 레이어 수정, 도로 텍스처 적용, 도로 폭 조정, road DB 이관 설계 전.
Keywords: road, road_major, road_minor, traversal, bottleneck, decal, texture, width, path
Priority: high

## 기본 원칙

- 도로는 지우지 않는다.
- 도로는 배경 장식이 아니라 이동 구조와 구역 인지 장치다.
- 현실 서울 도로 폭을 그대로 쓰지 말고 게임 스케일로 재해석한다.

## 도로 타입

- 메인도로:
  - 빠른 이동축
  - 그룹 경계/지역 연결 인지
  - 가장 넓은 폭
- 중간도로:
  - 지역 내부 연결
  - 골목보다 넓고 메인보다 좁음
- 소로/골목:
  - 생활권 이동
  - 전투, NPC, 근거리 이벤트와 잘 맞음
- 특수길:
  - 결계, 룬, 유적, 포털 진입

## 표현 규칙

- 회색 단색 띠로 오래 두지 않는다.
- 바닥 위에 얹는 decal 성격의 길 표현이 우선이다.
- 메인도로는 석판/포장길, 소로는 흙길/좁은 석길이 잘 맞는다.
- 불투명도는 낮추고 바닥과 자연스럽게 섞는다.

## world_road DB 구조 (2026-04-22 구현)

- 테이블: `world_road` — dong 단위로 관리 (`dong_id` FK)
- 생성 방식: OSM `{dong_osm_id}_roads.json` 캐시 → `back/scripts/build_world_road.py`
- 도로 타입 분류 (`road_type`):
  - `arterial` — trunk/primary/secondary, 버퍼 12m
  - `collector` — tertiary/residential/living_street, 버퍼 7m
  - `local` — unclassified/service, 버퍼 4m
  - `alley` — footway/path/pedestrian, 버퍼 2m
- elevation_m: 인접 world_partition centroid들의 역거리 가중 평균으로 보간
- movement_bonus: arterial=1.3, collector=1.1, local=1.0, alley=0.85
- build 명령: `venv/Scripts/python back/scripts/build_world_road.py --dong-osm-id <osm_id> [--overwrite]`

## 렌더링 규칙

- 프론트: `CityBlockOverlay.jsx` → `dbRoads` → `roadMeshes` useMemo
- renderOrder=6, DoubleSide
- 현재 임시: 상단 `#555555`, 측벽 `#333333` 단색. 추후 road_type별 텍스처 적용 예정
- showElevation ON 시 elevation_m 반영 + 박스 extrude (`buildExtrudedPolygon`), OFF 시 flat

## ⚠️ 임시: 도로/파티션 렌더 결합 (2026-04-25)

**중요 — 이 결합 구조가 깨끗하게 정리될 때까지 도로/파티션 렌더링 코드 수정 시 반드시 이 섹션 읽을 것.**

`showRoadLayer`(도로텍 토글) 한 변수가 세 개의 다른 렌더 동작을 동시에 제어한다:

1. **`roadMeshes` useMemo** — 도로 메시 자체 생성 여부 (직관적)
2. **`getGroupGeometries(..., useTerrainGeoJson=showRoadLayer)`** — 파티션이 `terrain_geojson`(도로 차집합) 사용할지, 원본 `boundary_geojson` 사용할지 분기
3. **blocks useMemo 분기 1 조건의 `!showRoadLayer`** — 도로텍 ON 시 그룹 단위 통합 렌더(분기 1) 비활성화 → 파티션 단위 렌더(분기 2)로 강제 폴백. 분기 1은 `g.boundary_geojson`(그룹 union)을 그대로 써서 도로 차집합이 안 되기 때문.

**수정 시 주의**:
- "도로 위치만 살짝 조정"하려고 1번만 건드렸다가 2/3번 사이드이펙트 못 보고 회귀 발생 가능.
- "그룹텍 단독 ON" 모드는 분기 1으로 들어가서 파티션+도로가 한 폴리곤으로 통합돼 보임. 의도된 동작이 아니라 임시 한계.
- "그룹텍+도로텍" 같이 ON일 때만 파티션과 도로가 분리되어 의도대로 보임.

**정상화 방법 (택 1)**:
- A. `world_partition_group`에 `terrain_geojson` 컬럼 추가 → 그룹 단위 분기에서도 도로 차집합 사용 가능
- B. 분기 1을 제거하고 항상 파티션 단위 렌더로 통일 (성능 영향 측정 필요)
- C. 도로 세그먼트 분할(아래 등고선 정합 섹션) 시점에 같이 해결

## ⚠️ 도로↔파티션 등고선 정합 (미해결)

도로 elevation_m은 인접 파티션의 가중 평균 단일값. 긴 도로(올림픽대로, 양녕로 등)가 여러 파티션을 가로지를 때 파티션마다 elevation이 다르면 도로가 계단처럼 떠오르거나 파묻힌다.

해결 옵션:
- **A. 도로 세그먼트 분할** — `build_world_road.py`에서 OSM way를 파티션과 ST_Intersection으로 잘라 segment 단위로 저장. 각 segment는 자신이 속한 파티션 elevation 사용. → 정합 완전 해결 + 그룹 단위 차집합 문제도 함께 해결.
- **B. 도로 vertex별 elevation 보간** — 클라이언트에서 도로 polygon vertex별로 가장 가까운 파티션 elevation lookup → BufferGeometry y값 변경.
- **C. 도로를 decal로 처리** — 파티션 메시 위에 projected texture. 구현 복잡. 게임 스케일 대비 오버엔지니어링.

권장: **A**. 데이터 모델이 깔끔해지고 위 "임시 결합" 문제도 같이 풀린다.

