---
name: 맵 레이어 시스템 (OSM Zone Layer Rules)
description: OSM Overpass API로 지도 레이어(용도구역, 자연지형, 도로 등)를 가져오는 백엔드/프론트엔드 연동 규칙과 새 카테고리 추가 절차입니다.
---

# 맵 레이어 시스템 개요

이 스킬은 2개의 세부 스킬로 분리되었습니다.

## 파이프라인 흐름 (요약)
```
OSM Overpass API
  → back/world/services/zone_service.py  (카테고리 분류 + 캐싱)
  → /api/world/zones
  → front/src/entity/world/ZoneOverlay.jsx  (Geometry 빌드)
  → front/src/entity/world/RpgWorld.jsx     (enabledZones prop으로 on/off)
```

## 백엔드 카테고리 / 추가 절차
→ 스킬: **osm-zone-backend**
- ZONE_CATEGORIES 전체 목록 (20개 카테고리)
- 새 카테고리 추가 3단계 절차
- 캐시 버전 관리 규칙

## 프론트엔드 연동 / 체크리스트
→ 스킬: **osm-zone-frontend**
- ZoneOverlay.jsx 수정 위치 (6곳)
- RpgWorld.jsx enabledZones prop 패턴
- GameEntry.jsx 상태 관리 패턴
- MapControlOverlay.jsx 드롭다운 추가 규칙
- 새 레이어 추가 시 전체 체크리스트
