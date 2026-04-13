# 등고선 3D Extruded 렌더링 (SketchUp push/pull 방식)

## 배경 및 목표

기존 등고선 렌더링 방식은 **flat 폴리곤 바닥 + 별도 cliff quad** 조합.
이 방식은 두 가지 근본 문제를 가짐:

1. **카메라 회전 시 렌더 순서 붕괴** — `depthWrite=false` + 고정 `renderOrder`는
   top-down 고정 시점에서만 정상. 카메라를 돌리면 맵 타일이 파티션 위에 노출됨.
2. **파티션 경계 gap** — 인접 파티션 GeoJSON 좌표가 정확히 일치하지 않아
   엣지 매칭(`buildAdjacentCliffs`)이 실패 → 흰 틈 발생.

**목표**: SketchUp push/pull처럼 polygon + elevation → 상단면 + 측면벽을 하나의
3D 메시로 생성. `depthWrite=true`로 GPU depth sorting 사용.

---

## 아키텍처 분석

### 기존 구조 (showElevation ON 시)

```
flat polygon (Y=BASE_Y+elev, renderOrder=5)
+ buildGroupBoundaryCliffs → 별도 wall quads (renderOrder=4)
모두 depthWrite=false → painter's algorithm
```

### 신규 구조 (showElevation ON 시)

```
buildExtrudedPolygon(outerRing, holes, yTop, yBot=-1.0)
→ geometry.groups[0] = 상단면 (partition texture, depthWrite=true)
→ geometry.groups[1] = 측면벽 (cliff texture, depthWrite=true)
GPU depth sorting → 카메라 회전 안전
```

### DB 변경 필요 여부

**없음.** `world_partition.boundary_geojson` + `world_partition.elevation_m` / `dbGroups.boundary_geojson`으로 런타임 생성 가능.

---

## 구현 범위

### 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `front/src/entity/world/CityBlockOverlay.jsx` | `buildExtrudedPolygon` 추가, 그룹 렌더 경로 교체 |
| `front/src/entity/world/SeoulTerrain.jsx` | `showElevation` prop 추가, 도로 renderOrder 조정 |
| `front/src/entity/world/RpgWorld.jsx` | 월드 기저 평면 추가, SeoulTerrain에 prop 전달 |

### 변경 내용 상세

#### `buildExtrudedPolygon(outerRing, holes, yTop, yBot=-1.0)`

```js
// geometry.addGroup(0, topCount, 0)       → material-0: 상단면
// geometry.addGroup(topCount, wallCount, 1) → material-1: 측면벽
```

- outerRing: GeoJSON `[lng, lat][]` 형식
- yTop: `BASE_Y + elevation_m * effectiveScale`
- yBot: `-1.0` (지표 아래까지 벽 연장)
- 상단면 UV: bounding box 기준 0~1 정규화
- 측면벽 UV: edgeLen/5 × heightDiff/5 타일링

#### 렌더 (R3F 멀티 머티리얼)

```jsx
<mesh geometry={block.geo}>
  <meshBasicMaterial attach="material-0" map={topTex}  depthWrite={true} />
  <meshBasicMaterial attach="material-1" map={wallTex} depthWrite={true} side={DoubleSide} />
</mesh>
```

#### SeoulTerrain 도로 renderOrder

- `showElevation OFF`: 기존 104~112 유지
- `showElevation ON`: renderOrder=2 (elevated 파티션 floor=5 아래)

---

## 할 일 체크리스트

- [x] `buildExtrudedPolygon` 함수 구현
- [x] 그룹 렌더 경로: effectiveScale>0 시 extruded 메시 사용
- [x] 렌더 루프: `isExtruded` 블록 → 멀티 머티리얼 처리
- [x] `buildGroupBoundaryCliffs` extruded 경로에서 제거
- [x] `dongBasePlate` showElevation ON 시 비활성화
- [x] `SeoulTerrain.MergedMesh` showElevation prop 추가
- [x] `RpgWorld` → SeoulTerrain에 showElevation 전달
- [x] `RpgWorld` 월드 기저 평면 추가 (Y=-1.8, 30km, showElevation 조건부)
- [ ] 파티션 단위 fallback 경로도 extruded 방식으로 전환 (현재 buildAdjacentCliffs 유지)
- [ ] hole 폴리곤 테스트 (공원 내 연못 등 구멍 있는 파티션)
- [ ] 성능 프로파일링 (extruded 메시 수 × 버텍스 수 × 그룹 수)

---

## 주의사항

1. **geometry.groups 정합성**: `topCount` 계산 후 실제 wall vi가 다를 수 있음
   (edgeLen<0.01 skip). `subarray(0, vi)` 처리로 해결했으나 group[1] count 확인 필요.

2. **depthWrite=true 혼용**: extruded 블록은 true, 나머지 오버레이(도로, 존)는 false.
   같은 장면에서 혼용 시 투명 패스 순서 주의.

3. **그룹 캐시 무효화**: `groupGeometryCache` 키에 `effectiveScale` 포함되어 있어
   elevation on/off 전환 시 자동 재빌드됨.

4. **flat 모드와 공존**: `effectiveScale === 0`이면 기존 flat polygon 그대로.
   API 변경 없이 toggle 가능.
