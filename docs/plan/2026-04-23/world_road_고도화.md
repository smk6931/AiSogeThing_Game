# world_road 고도화 계획

## 현재 상태 (2026-04-22 기준)

- `world_road` 테이블 구축 완료, 노량진1동 197개 도로 저장
- 프론트 flat 렌더링 완료, 임시 #555555 단색
- 절벽 quads 클린업 완료

---

## 우선순위별 고도화 항목

### P1 — 다른 동 데이터 일괄 생성

현재 노량진1동만 데이터 있음. 플레이어가 다른 동으로 이동하면 도로가 없음.

```bash
# _roads.json 캐시가 있는 동 목록 확인
ls back/world/data/osm_cache/*_roads.json

# 각 동별 실행
venv/Scripts/python back/scripts/build_world_road.py --dong-osm-id <osm_id>
```

- [ ] osm_cache에 있는 전체 동 대상으로 일괄 실행 스크립트 작성 (`build_all_roads.py`)
- [ ] 실행 후 dong_id별 road 수 확인 쿼리로 검증

---

### P2 — 도로 텍스처 적용

현재 #555555 단색. road_type별로 다른 질감 필요.

방향:
- `arterial`: 아스팔트 포장 이미지 (`/road/asphalt/`)
- `collector`: 블록 포장 또는 좁은 아스팔트
- `local`: 시멘트 or 벽돌
- `alley`: 흙길 or 좁은 석판

구현 방법 두 가지 중 선택:
1. **단색 material에 alphaMap 으로 decal 느낌** — 빠름, 텍스처 타일링 없어도 됨
2. **UV 기반 tileX 텍스처** — `buildTerrainBlockFromGeoJson`에 UV 추가 필요, 퀄리티 높음

- [ ] `/road/` 폴더 아래 텍스처 이미지 준비 (ComfyUI or Polyhaven)
- [ ] `roadMeshes`에서 road_type별 material 분기
- [ ] UV 타일링 필요하면 `buildTerrainBlockFromGeoJson`에 tileRepeat 옵션 추가

---

### P3 — Phase 4: 파티션에서 도로 영역 빼기

도로와 파티션이 현재 겹쳐서 z-fighting 발생 가능. 파티션 폴리곤에서 도로 영역을 빼면 깔끔하게 분리.

```sql
-- world_partition에 terrain_geojson 컬럼 추가
ALTER TABLE world_partition ADD COLUMN terrain_geojson jsonb;

-- 동별로 도로 union → 파티션에서 차집합
UPDATE world_partition wp
SET terrain_geojson = ST_AsGeoJSON(
    ST_Difference(
        ST_GeomFromGeoJSON(wp.boundary_geojson::text),
        (SELECT ST_Union(ST_GeomFromGeoJSON(wr.boundary_geojson::text))
         FROM world_road wr WHERE wr.dong_id = wp.admin_area_id)
    )
)::jsonb
WHERE wp.admin_area_id = <dong_id>;
```

- [ ] Alembic: `terrain_geojson` 컬럼 추가 마이그레이션
- [ ] `partition_repository.py`: `terrain_geojson` 우선, fallback `boundary_geojson`
- [ ] `CityBlockOverlay.jsx`: `boundary_geojson` → `terrain_geojson ?? boundary_geojson`
- [ ] z-fighting 해결 확인

---

### P4 — 도로 클릭 인터랙션 / 이름 표시

- 도로 위 클릭 → `real_name`, `road_type` 툴팁 표시
- 이동 중 도로 위 감지 → `movement_bonus` UI 반영 (이동속도 버프 표시)
- 추후 게임플레이와 연결

---

### P5 — showElevation 모드 도로 절벽 처리

현재 도로는 flat quad만 있음. showElevation=ON 시 도로가 공중에 뜨거나 파티션 절벽 위로 잘릴 수 있음.

- 도로도 extruded geometry로 처리하거나
- road elevation_m을 인근 파티션 elevation 중앙값으로 맞추는 보정 필요
- Phase 4 완료 후 자연스럽게 해결될 수 있음 — 그때 같이 검토

---

## 내일 시작 순서 제안

1. `build_all_roads.py` 작성 → 전체 동 일괄 생성 (P1, 30분)
2. road_type별 텍스처 소재 결정 → material 분기 구현 (P2, 1~2시간)
3. Phase 4 미룰지 바로 할지 판단 후 결정 (P3)
