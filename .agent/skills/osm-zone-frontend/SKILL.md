---
name: OSM Zone 프론트엔드 연동 규칙 (osm-zone-frontend)
description: ZoneOverlay, RpgWorld, GameEntry, MapControlOverlay의 새 카테고리 연동 절차와 수정 체크리스트입니다.
---

# OSM Zone 프론트엔드 연동 규칙

## 관련 파일 위치

| 파일 | 경로 |
|---|---|
| ZoneOverlay | `front/src/entity/world/ZoneOverlay.jsx` |
| CityBlockOverlay | `front/src/entity/world/CityBlockOverlay.jsx` |
| RpgWorld | `front/src/entity/world/RpgWorld.jsx` |
| GameEntry | `front/src/GameEntry.jsx` |
| MapControlOverlay | `front/src/ui/MapControlOverlay.jsx` |

## ZoneOverlay.jsx 새 카테고리 추가 시 수정 위치

| 위치 | 수정 내용 |
|---|---|
| `ZONE_COLORS` | `{ new_key: '#hexcolor' }` 추가 |
| `ZONE_OPACITY` | `{ new_key: 0.25 }` 추가 |
| `ALL_CATS` 배열 | 문자열 키 추가 |
| `geometries` useMemo 루프 | cat 배열에 추가 |
| `defaults` 객체 | `{ new_key: true }` 추가 |
| JSX 렌더링 블록 | `enabled.new_key && <ZoneMesh .../>` 추가 |
| `caches.open` 버전 | 읽기/쓰기 두 곳 모두 버전 +1 |

## RpgWorld.jsx enabledZones prop 패턴

```javascript
enabledZones={{
  water: showSeoulNature,
  park: showSeoulNature,
  forest: showSeoulNature,
  road_major: showSeoulRoads,
  road_minor: showSeoulRoads,
  residential: showLanduseZones && landuseFilters.residential,
  commercial: showLanduseZones && landuseFilters.commercial,
  // 새 카테고리: showLanduseZones && landuseFilters.new_key
}}
```

## 캐시 버전 동기화 규칙
백엔드 `zone_service.py`의 버전 N과 `ZoneOverlay.jsx`의 `caches.open('zone-data-vN')` 버전은 **반드시 동일**해야 합니다.

## 새 OSM 레이어 추가 체크리스트

    [ ] back/world/services/zone_service.py
        [ ] ZONE_CATEGORIES 항목 추가
        [ ] _classify_way() elif 블록 추가
        [ ] 캐시 버전 +1

    [ ] front/src/entity/world/ZoneOverlay.jsx
        [ ] ZONE_COLORS, ZONE_OPACITY 추가
        [ ] ALL_CATS 배열에 키 추가
        [ ] geometries 루프 배열에 추가
        [ ] defaults에 true 추가
        [ ] JSX 렌더링 블록 추가
        [ ] caches.open 버전 +1 (두 곳)

    [ ] front/src/GameEntry.jsx
        [ ] landuseFilters 초기값에 new_key: true 추가

    [ ] front/src/ui/MapControlOverlay.jsx
        [ ] 드롭다운 Object.entries에 레이블 추가

    [ ] front/src/entity/world/RpgWorld.jsx
        [ ] enabledZones에 new_key 조건 추가

    [ ] front/src/entity/world/CityBlockOverlay.jsx
        [ ] forEach 배열에 new_key 추가
