# Phase 4: terrain_geojson 구현 + 도로 컬링

## 작업 배경

전일 리포트(world_road_설계분석리포트.md)에서 도출한 핵심 수정안:
1. z-fighting 근본 해결을 위해 Phase 4(파티션에서 도로 빼기) 선행
2. 도로 필터링이 activeGroupKeys와 비대칭 → bbox 컬링 추가

브랜치 `main_04_25_road`에서 진행.

## 실행한 작업

### 1. 마이그레이션
`back/alembic/versions/o2p3q4r5s6t7_add_terrain_geojson.py`
- `world_partition.terrain_geojson` (JSON, nullable) 추가
- `world_level`, `world_level_partition`, `world_partition_detail` 뷰 재생성 (terrain_geojson 포함)
- 실제 테이블 스키마 기준으로 뷰 SQL 정비 (source_feature, gameplay_meta, persona_tag 등 과거 참조 제거 — 해당 컬럼은 이미 드롭된 상태)

### 2. ST_Difference 스크립트
`back/scripts/build_partition_terrain.py`
- Shapely 기반 (PostGIS 의존 없음)
- 동 단위 또는 `--all` 옵션으로 도로 있는 모든 동 일괄 처리
- 각 파티션 boundary_geojson ∖ 동 도로 union → terrain_geojson
- 노량진1동 결과: 230개 파티션 중 201개 업데이트 (나머지 29개는 도로 미교차)

### 3. Repository
`back/world/repositories/partition_repository.py`
- `_PARTITION_COLUMNS` SELECT 리스트에 `terrain_geojson` 추가

### 4. 프론트 Multi-Polygon 헬퍼
`front/src/entity/world/CityBlockOverlay.jsx`
- `buildTerrainBlocksFromGeoJson` 신설 (MultiPolygon → 여러 geometry 리스트)
- ST_Difference 결과가 MultiPolygon으로 쪼개지는 경우(파티션이 도로로 여러 조각) 대응
- 파티션 렌더링 지점 2곳(terrain 모드, partition 모드)을 단수 → 복수로 수정
- `partition.terrain_geojson || partition.boundary_geojson` 폴백

### 5. 도로 bbox 컬링
`front/src/entity/world/CityBlockOverlay.jsx`
- `activeGroupBBoxes` useMemo — 활성 그룹들의 lng/lat bbox 계산
- `roadMeshes`에서 각 도로 bbox와 활성 그룹 bbox 겹침 체크
- 동 전체 197개 → 플레이어 주변 active 그룹 교차 도로만 렌더링

## 검증

- 마이그레이션 성공
- `build_partition_terrain.py` 노량진1동 실행: 201개 업데이트
- API `GET /api/world/partitions/dong/3879474` 200 응답
  - 230개 파티션 반환
  - terrain_geojson 보유: 201 (Polygon 144 + MultiPolygon 57)
- 프론트 브라우저 시각 검증 필요

## 남은 리스크

- MultiPolygon 파티션의 cliff wall: `buildPartitionCliffs`는 여전히 원본 `boundary_geojson.coordinates[0]` 사용 → 원래 파티션 외곽 벽만 그림. 의도된 동작 (도로로 잘린 내부 가장자리까지 벽 그리면 어색)
- 도로와 파티션 elevation 단차: 긴 도로는 단일 elevation이라 여전히 고도 불일치 가능 (P5 대상)
- 다른 동 terrain_geojson 미생성 → `build_partition_terrain.py --all` 한 번 돌려야 함 (단, 해당 동에 world_road 데이터가 먼저 있어야 함)

## 다음 단계 (내일)

문제 없으면:
1. `build_all_roads.py` 작성 → 전체 동 도로 일괄 생성
2. `build_partition_terrain.py --all` 일괄 실행
3. road_type별 텍스처 분기

문제 생기면 브랜치 리셋 후 재설계.
