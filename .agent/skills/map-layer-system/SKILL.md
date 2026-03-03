---
name: 맵 레이어 시스템 (OSM Zone Layer Rules)
description: OSM Overpass API로 지도 레이어(용도구역, 자연지형, 도로 등)를 가져오는 백엔드/프론트엔드 연동 규칙과 새 카테고리 추가 절차입니다.
---

# 맵 레이어 시스템: OSM Zone Layer 개발 규칙

## 1. 전체 아키텍처 흐름

OSM 데이터는 아래의 순서로 파이프라인을 타고 3D 씬에 렌더링됩니다.

    [OSM Overpass API]
          ↓
    [back/game/zone_service.py]   → 카테고리별 폴리곤 분류 및 캐싱
          ↓ /api/game/zones
    [front: ZoneOverlay.jsx]      → 데이터 패칭, Three.js Geometry 빌드
          ↓
    [front: RpgWorld.jsx]         → enabledZones prop으로 온/오프 제어
          ↓
    [front: ZoneMesh (Three.js)]  → 반투명 컬러 폴리곤 렌더
          + [CityBlockOverlay.jsx] → 클릭 가능한 텍스처 블록

---

## 2. 백엔드: zone_service.py 카테고리 규칙

### 2-1. 현재 등록된 카테고리 목록 (ZONE_CATEGORIES)

카테고리 키     | OSM 태그 기반                             | 색상 코드   | 레이블
--------------  | ----------------------------------------  | ---------- | ---------
water           | natural=water, waterway=river/stream/canal | #2a6ab5   | 강/하천
park            | leisure=park, landuse=recreation_ground   | #4caf50    | 공원
cemetery        | landuse=cemetery, amenity=grave_yard              | #607d8b    | 공동묘지
transport       | aeroway=aerodrome/runway, landuse=railway          | #455a64    | 교통시설
port            | landuse=port, industrial=port                      | #1a237e    | 항구/부두
unexplored      | [Shapely 도로 폴리고나이제이션 자동계산]               | #4a3728    | 미개척 지형
road_major      | highway=motorway/trunk/primary            | #ff9800    | 주요도로
road_minor      | highway=secondary/tertiary                | #ffeb3b    | 일반도로
residential     | landuse=residential                       | #8bc34a    | 주거구역
commercial      | landuse=commercial/retail                 | #2196f3    | 상업구역
industrial      | landuse=industrial/brownfield/construction| #ffc107    | 공업구역
institutional   | landuse=institutional                     | #9c27b0    | 공공기관
educational     | amenity=school/university, landuse=education | #ff5722 | 교육시설
medical         | amenity=hospital/clinic                   | #f44336    | 의료시설
parking         | amenity=parking                           | #9e9e9e    | 주차장
forest          | landuse=forest, natural=wood              | #2d6a28    | 숲/산
natural_site    | natural=scrub/grassland/heath, landuse=grass/meadow/farmland/cemetery 등 | #c5e1a5 | 비개발/자연공간
military        | landuse=military                          | #3e2723    | 군사시설
religious       | amenity=place_of_worship                  | #fbc02d    | 종교시설
sports          | leisure=sports_centre, amenity=stadium    | #009688    | 스포츠시설
beach           | natural=beach                             | #fff9c4    | 해변
farmland        | landuse=farmland                          | #aed581    | 농경지

### 2-2. 새 카테고리 추가 절차 (백엔드)

1. ZONE_CATEGORIES 딕셔너리에 새 항목 추가:
   - tags: Overpass 쿼리 문자열 리스트 (way/relation + 태그)
   - color: 해당 구역의 대표 색상 (hex)
   - label: 한국어 레이블

2. _classify_way() 함수에 분류 조건 추가:
   - tags 딕셔너리에서 highway/natural/landuse/leisure/waterway/amenity 등 추출
   - 신규 카테고리는 반드시 마지막 줄 근처에 elif 블록으로 추가 (road 우선 분류 보장)

3. 정규식 기반 태그 매칭 예시 (Overpass):
   - 단일값: 'way["landuse"="residential"]'
   - 다중값(OR): 'way["natural"~"scrub|grassland|heath"]'

4. 캐시 버전을 +1 올림 (예: v5 → v6):
   - cache_key 포맷: f"v{N}_z{dist}_lat{lat:.3f}_lng{lng:.3f}_{cat_str}.json"

### 2-3. tags에서 가져오는 추가 보존 필드 (feature["tags"])
    "name", "highway", "natural", "landuse", "leisure", "waterway", "amenity"

---

## 3. 프론트엔드: ZoneOverlay.jsx 규칙

### 3-1. 새 카테고리 추가 시 수정 위치 (4곳)

위치              | 수정 내용
----------------  | -------------------------------------------------
ZONE_COLORS       | { new_key: '#hexcolor' } 추가
ZONE_OPACITY      | { new_key: 0.25 } 추가 (기본 0.25)
fetchGroup 호출   | 해당 카테고리가 속하는 그룹의 배열에 문자열 추가
geometries 루프   | for (const cat of [...]) 배열에 추가
defaults 객체     | { new_key: true } 추가 (기본 활성)
JSX 렌더링 블록   | enabled.new_key && geometries.new_key && <ZoneMesh ... /> 추가

### 3-2. fetchGroup 그룹별 카테고리 기준

그룹명        | 포함 카테고리
-----------   | -------------------------------------------
'world_zones' | 모든 카테고리 (water, road, urban, nature, special, unexplored)

```javascript
// 모든 구역 데이터를 하나의 그룹으로 통합 요청
// (서버가 모든 레이어의 위치를 알아야 그 사이의 '미개척 지형(빈 공간)'을 정확히 계산할 수 있습니다)
const ALL_CATS = [
  'water', 'park', 'forest', 'natural_site',
  'residential', 'commercial', 'industrial', 'institutional', 'educational', 'medical', 'parking',
  'military', 'religious', 'sports', 'cemetery', 'transport', 'port',
  'road_major', 'road_minor',
  'unexplored'
];
fetchGroup('world_zones', ALL_CATS);
```

새 자연지형 카테고리는 'nature' 그룹에, 새 개발지 카테고리는 'residential' 그룹에 추가.

### 3-3. 브라우저 캐시 버전 갱신 규칙

백엔드 캐시(v5) 와 프론트엔드 브라우저 Cache API 버전은 항상 쌍으로 올려야 합니다.

    back/game/zone_service.py:
        cache_key = f"v{N}_z..." 의 N을 증가

    front/ZoneOverlay.jsx:
        caches.open('zone-data-v{N}')  ← 읽기/쓰기 두 곳 모두 동일 버전으로

---

## 4. 프론트엔드: RpgWorld.jsx — enabledZones 연동 규칙

ZoneOverlay 컴포넌트의 enabledZones prop 구조:

    enabledZones={{
      water: showSeoulNature,              // 자연 지형 토글에 연동
      park: showSeoulNature,
      forest: showSeoulNature,
      natural_site: showLanduseZones && landuseFilters.natural_site,
      road_major: showSeoulRoads,          // 도로 동선 토글에 연동
      road_minor: showSeoulRoads,
      residential: showLanduseZones && landuseFilters.residential,  // 용도 구역 토글 + 필터
      commercial:  showLanduseZones && landuseFilters.commercial,
      ... (이하 동일 패턴)
    }}

규칙:
- 자연지형(park/forest 등)은 showSeoulNature 에 직접 연동
- 용도 구역(개발지)은 showLanduseZones (마스터) AND landuseFilters.KEY (개별) 로 이중 조건
- natural_site 는 landuseFilters 에 포함시키되, 성격상 자연 레이어에 가까움

---

## 5. 프론트엔드: GameEntry.jsx — 상태 관리 규칙

    showLanduseZones: boolean   ← 용도 구역 전체 마스터 스위치
    landuseFilters: {           ← 개별 용도 구역 on/off 딕셔너리
      residential: true,
      commercial: true,
      ...
      natural_site: true
    }

새 카테고리 추가 시 landuseFilters 초기값에도 반드시 추가할 것.

---

## 6. UI: MapControlOverlay.jsx — 드롭다운 필터 규칙

용도 구역 버튼(showLanduseZones) 이 ON 상태일 때 하단에 드롭다운 패널이 렌더링됩니다.
드롭다운 내 Object.entries({...}) 에 새 항목을 추가하면 체크박스가 자동으로 생성됩니다.

    Object.entries({
      residential: '가옥/거주 (초록)',
      commercial: '상업시설 (파랑)',
      ...
      natural_site: '비개발/산악 (연녹)',  // ← 새 항목 추가 여기
    })

---

## 7. CityBlockOverlay.jsx — 텍스처 블록 연동 규칙

zones 데이터에서 폴리곤을 합쳐 '클릭 가능한 텍스처 블록'을 만드는 배열에도 신규 카테고리를 추가.

    ['residential', 'commercial', ..., 'new_category', 'park', 'forest'].forEach(cat => { ... })

이 배열에 포함된 카테고리만 블록 텍스처 모드에서 클릭하여 텍스처를 적용할 수 있습니다.

---

## 8. 체크리스트: 새 OSM 레이어 추가 시 수정 파일 목록

    [ ] back/game/zone_service.py
        [ ] ZONE_CATEGORIES 에 항목 추가
        [ ] _classify_way() 에 분류 조건 추가
        [ ] 캐시 버전 +1 (cache_key = f"v{N+1}_z...")

    [ ] front/ZoneOverlay.jsx
        [ ] ZONE_COLORS 에 색상 추가
        [ ] ZONE_OPACITY 에 불투명도 추가
        [ ] fetchGroup 호출의 해당 배열에 키 추가
        [ ] geometries useMemo의 cat 루프 배열에 추가
        [ ] defaults 객체에 true 로 추가
        [ ] JSX 렌더링 블록에 <ZoneMesh> 추가
        [ ] caches.open 버전 +1 (두 곳 모두)

    [ ] front/GameEntry.jsx
        [ ] landuseFilters 초기값에 new_key: true 추가

    [ ] front/ui/MapControlOverlay.jsx
        [ ] 드롭다운 Object.entries 목록에 레이블 추가

    [ ] front/world/RpgWorld.jsx
        [ ] enabledZones 에 new_key: showLanduseZones && landuseFilters.new_key 추가

    [ ] front/world/CityBlockOverlay.jsx
        [ ] forEach 배열에 new_key 추가
