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
- renderOrder=6, depthWrite=false, DoubleSide (파티션 위에 float)
- 현재 임시: `#555555` 단색. 추후 road_type별 텍스처 적용 예정
- showElevation ON 시 elevation_m 반영, OFF 시 flat

## Phase 4 (미구현 — 추후)

- 파티션에서 도로 영역 빼기: `world_partition.terrain_geojson = ST_Difference(boundary_geojson, road_union)`
- `world_partition`에 `terrain_geojson` 컬럼 추가 후 단일 SQL UPDATE로 처리 가능

