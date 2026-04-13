# Title: World Elevation and Cliff Rendering Rules
Description: world_partition의 elevation_m 데이터로 등고선 지형을 만드는 방법과, 파티션 경계에 절벽(cliff)을 3D로 렌더링하는 구현 규칙.
When-To-Read: 등고선 기능 수정, 파티션 고도 렌더링, 절벽 메시 생성, showElevation 로직 변경 시.
Keywords: elevation, cliff, extruded polygon, 3D mesh, terrain height, world_partition, showElevation, push/pull
Priority: high

---

## 1. 데이터 소스

DB 변경 없이 기존 컬럼만 사용한다.

| 컬럼 | 테이블 | 역할 |
|---|---|---|
| `boundary_geojson` | `world_partition` | 파티션 폴리곤 꼭지점 (GeoJSON Polygon) |
| `elevation_m` | `world_partition` | 파티션 고도 (미터 단위) |
| `boundary_geojson` | `world_group` | 그룹 union 폴리곤 (파티션 내부 gap 없는 깨끗한 경계) |

3D 메시는 이 두 값으로 **런타임에 생성**한다. 사전 계산이나 별도 3D 데이터 저장 불필요.

---

## 2. 등고선 스케일 상수

```js
// front/src/entity/world/CityBlockOverlay.jsx
const ELEV_SCALE = 1.0;   // 실제 1m → 게임 1 world unit
const BASE_Y     = 0.55;  // 파티션 바닥 기준 Y (모든 overlay 레이어 위)

// 파티션 상단면 Y 계산
const groupElevY = BASE_Y + avgElev * effectiveScale;

// effectiveScale: showElevation ON → ELEV_SCALE(1.0), OFF → 0
```

`ELEV_SCALE`과 `BASE_Y`는 `terrainHandler.js`의 `updatePartitionElevations`와 반드시 동기화한다.

---

## 3. 등고선 렌더링 방식: Extruded Polygon (push/pull)

### 핵심 함수

```js
// CityBlockOverlay.jsx
buildExtrudedPolygon(outerRing, holes, yTop, yBot = -1.0)
```

- `outerRing`: GeoJSON `[lng, lat][]` 배열
- `holes`: 내부 구멍 링 배열 (공원 내 연못 등)
- `yTop`: `BASE_Y + elevation_m * effectiveScale`
- `yBot`: `-1.0` (지표 아래까지 벽 연장, 배경 gap 없음)

### 반환 geometry 구조

```
geometry.groups[0] → 상단면 (top face)  — partition/theme 텍스처
geometry.groups[1] → 측면벽 (side walls) — cliff 텍스처
```

### 사용 예시

```js
// 그룹 boundary 렌더링 (effectiveScale > 0 시)
const { type, coordinates } = g.boundary_geojson;
const polys = type === 'Polygon' ? [coordinates] : coordinates;
for (const [outer, ...holes] of polys) {
  const geo = buildExtrudedPolygon(outer, holes, groupElevY);
  result.push({ geo, themeCode: g.theme_code, order: 5, isExtruded: true });
}
```

---

## 4. 렌더링 설정 규칙

### Extruded 메시 머티리얼

```jsx
<mesh geometry={block.geo} renderOrder={5}>
  {/* 상단면: DoubleSide — 카메라가 박스 하단을 향할 때도 텍스처 렌더 */}
  <meshBasicMaterial attach="material-0" map={topTex}
    side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
  {/* 측면벽: DoubleSide — 내/외부 모두 cliff 텍스처 */}
  <meshBasicMaterial attach="material-1" map={cliffTex}
    side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
</mesh>
```

**depthWrite=false 필수**: `depthWrite=true`로 바꾸면 세계 기저평면(Y=-1.8, renderOrder=0)이 depth test에 걸려 검정 void 발생.

**renderOrder=5**: painter's algorithm으로 카메라 회전에 대응. map tiles(order=-50), 도로(showElevation ON 시 order=2) 위에 렌더.

---

## 5. 절벽 텍스처

| 경로 | 용도 |
|---|---|
| `/ground/cliff/image.png` | 측면벽 기본 텍스처 (없으면 `#7a6850` fallback) |
| `/ground/slope/image.png` | 고도차가 낮은 경사 텍스처 (`CLIFF_DIFF_THRESHOLD=8` 기준) |

텍스처 로드는 `THREE.TextureLoader`로 404-safe하게 처리한다 (useTexture 사용 금지 — 404 시 크래시).

```js
const loadTex = (url, setter) => {
  const loader = new THREE.TextureLoader();
  loader.load(url,
    (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; setter(t); },
    undefined,
    () => setter(null), // 404 → null, fallback 색상 사용
  );
};
```

---

## 6. 플레이어 고도 추종

`showElevation` ON 시 플레이어가 파티션 고도에 맞게 Y 위치가 올라간다.

### 관련 파일

- `terrainHandler.js` — `updatePartitionElevations`, `getPartitionElevY`
- `usePlayerMovement.js` — 매 프레임 `getPartitionElevY`로 Y 보정

### 동작 원리

```js
// RpgWorld.jsx — sharedPartitions 또는 showElevation 변경 시 호출
updatePartitionElevations(sharedPartitions, showElevation ? ELEV_SCALE : 0);

// usePlayerMovement.js — 이동/정지 모두
const terrainHeight = getPartitionElevY(x, z) ?? getTerrainHeight(x, z);
ref.current.position.y = terrainHeight;
```

`getPartitionElevY`는 bbox pre-filter → point-in-polygon(ray casting) → 5m 캐시 순으로 동작한다.

---

## 7. 카메라 회전 대응 규칙

카메라가 등고선 지형을 회전할 때 생기는 문제와 해결책:

| 문제 | 원인 | 해결 |
|---|---|---|
| 맵 타일(흰색) 파티션 위에 노출 | `EqualStencilFunc` — DongMask(Y=0)과 elevated 바닥(Y>0) 투영 불일치 | `showElevation` ON 시 `AlwaysStencilFunc` 사용 |
| 도로가 elevated 파티션 위에 떠보임 | 도로 renderOrder=104~112 > 파티션 floor 5 | `showElevation` ON 시 도로 renderOrder=2 |
| 카메라 내부 방향 검정 void | `depthWrite=true` 상태에서 depth buffer 충돌 | `depthWrite=false` + `DoubleSide` 상단면 |

---

## 8. 세계 기저 평면 (World Floor)

`showElevation` ON 시 카메라가 대각선으로 볼 때 파티션 외곽 시야에 캔버스 검정 노출을 방지하는 광역 평면.

```jsx
// RpgWorld.jsx
{showElevation && (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.8, 0]} renderOrder={0}>
    <planeGeometry args={[30000, 30000]} />
    <meshBasicMaterial color="#3a3020" toneMapped={false} depthWrite={false} />
  </mesh>
)}
```

Y=-1.8 (yBot=-1.0 아래), renderOrder=0 (최하단), 30km 광역.

---

## 9. 등고선 ON/OFF 토글 정리

| 항목 | OFF (effectiveScale=0) | ON (effectiveScale=1.0) |
|---|---|---|
| 그룹 바닥 | flat polygon (Y=BASE_Y) | extruded 3D 메시 (Y=BASE_Y+elev) |
| 절벽 | 없음 | geometry.groups[1] 측면벽 |
| 도로 renderOrder | 104~112 | 2 |
| 스텐실 | EqualStencilFunc | AlwaysStencilFunc |
| 플레이어 Y | heightmap fallback | getPartitionElevY |
| 세계 기저 평면 | 없음 | Y=-1.8 렌더 |
| dongBasePlate | 렌더 | 비활성 (extruded가 커버) |
