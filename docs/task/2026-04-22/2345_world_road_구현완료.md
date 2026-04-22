# world_road 레이어 구현

## 작업 배경

등고선(파티션) 위에 도로를 별도 레이어로 올리기 위해 OSM 도로 데이터를 DB화하고 Three.js로 렌더링.

## 실행한 작업

### 1. DB 마이그레이션
- 파일: `back/alembic/versions/n1o2p3q4r5s6_add_world_road.py`
- `world_road` 테이블 생성 (road_key, dong_id, osm_way_id, road_type, boundary_geojson, centerline_geojson, real_name, width_m, elevation_m, movement_bonus)
- 실행: `venv/Scripts/alembic upgrade head` → 성공

### 2. 빌드 스크립트
- 파일: `back/scripts/build_world_road.py`
- OSM `{dong_osm_id}_roads.json` 캐시 재활용
- LineString → EPSG:5186 buffer → WGS84 Polygon → 동 경계 clip
- elevation_m: 인접 world_partition 역거리 가중 평균 보간
- 노량진1동(osm_id=3879474) 실행 결과: 197개 저장, 189개 스킵(동 경계 밖)

### 3. 백엔드
- `back/world/models/models.py`: `WorldRoad` 모델 추가
- `back/world/repositories/partition_repository.py`: `get_dong_roads(dong_id)` 추가
- `back/world/routers/router.py`: `GET /api/world/codex/dong/{dong_id}/roads` 추가

### 4. 프론트엔드
- `front/src/api/world.js`: `getDongRoads` 추가
- `front/src/entity/world/CityBlockOverlay.jsx`:
  - `dbRoads` state + fetch useEffect
  - `roadMeshes` useMemo (boundary_geojson → flat geometry, elevation 반영)
  - renderOrder=6, depthWrite=false, `#555555` 단색 임시 렌더링

### 5. 절벽 텍스처 수정 (함께 진행)
- `buildNoisyCliffWall` 제거 → 단순 수직 사각형 quad로 변경
- 흰 삼각형 아티팩트 제거, 텍스처 틈 해결

## 검증 결과

- API: `GET http://localhost:8100/api/world/codex/dong/3879474/roads` → 200 OK, 197개 반환
- 프론트: roadMeshes 렌더링 코드 완성, 브라우저에서 노량진1동 진입 시 도로 표시 예정

## 남은 리스크

- 다른 동은 별도로 build_world_road.py 실행 필요 (`_roads.json` 캐시 있는 동만 가능)
- 현재 임시 단색(#555555). 텍스처 적용 미완성
- Phase 4(파티션에서 도로 영역 빼기) 미구현
