---
name: OSM Zone 백엔드 규칙 (osm-zone-backend)
description: zone_service.py의 카테고리 목록, 새 카테고리 추가 절차, 캐시 버전 관리 규칙입니다.
---

# OSM Zone 백엔드 규칙

## 파일 위치
`back/world/services/zone_service.py`

## 전체 파이프라인 흐름
```
OSM Overpass API → zone_service.py → /api/world/zones → ZoneOverlay.jsx (front)
```

## ZONE_CATEGORIES 카테고리 목록

| 키 | OSM 태그 | 색상 | 레이블 |
|---|---|---|---|
| water | natural=water, waterway=river/stream | #2a6ab5 | 강/하천 |
| park | leisure=park, landuse=recreation_ground | #4caf50 | 공원 |
| forest | landuse=forest, natural=wood | #2d6a28 | 숲/산 |
| natural_site | natural=scrub/grassland/heath 등 | #c5e1a5 | 비개발/자연 |
| road_major | highway=motorway/trunk/primary | #ff9800 | 주요도로 |
| road_minor | highway=secondary/tertiary | #ffeb3b | 일반도로 |
| residential | landuse=residential | #8bc34a | 주거구역 |
| commercial | landuse=commercial/retail | #2196f3 | 상업구역 |
| industrial | landuse=industrial/construction | #ffc107 | 공업구역 |
| institutional | landuse=institutional | #9c27b0 | 공공기관 |
| educational | amenity=school/university | #ff5722 | 교육시설 |
| medical | amenity=hospital/clinic | #f44336 | 의료시설 |
| parking | amenity=parking | #9e9e9e | 주차장 |
| military | landuse=military | #3e2723 | 군사시설 |
| religious | amenity=place_of_worship | #fbc02d | 종교시설 |
| sports | leisure=sports_centre | #009688 | 스포츠시설 |
| cemetery | landuse=cemetery | #607d8b | 공동묘지 |
| transport | aeroway=aerodrome, landuse=railway | #455a64 | 교통시설 |
| port | landuse=port | #1a237e | 항구/부두 |
| unexplored | [Shapely 자동계산] | #4a3728 | 미개척 지형 |

## 새 카테고리 추가 절차

1. `ZONE_CATEGORIES` 딕셔너리에 추가 (tags, color, label)
2. `_classify_way()` 함수에 `elif` 블록으로 분류 조건 추가
3. **캐시 버전 반드시 +1**: `cache_key = f"v{N+1}_z{dist}_lat{lat:.3f}_lng{lng:.3f}_{cat_str}.json"`
