import { LAYER_Y, GIS_ORIGIN, LNG_TO_M, LAT_TO_M } from './mapConfig';

/**
 * 서울 지형(HeightMap) 데이터 기반 고도 계산 핸들러
 * 플레이어·몬스터 기준 Y는 mapConfig.LAYER_Y.character 를 사용한다.
 */
let heightData = null;

export const loadHeightMap = async () => {
  if (heightData) return heightData;
  try {
    const res = await fetch('/seoul_heightmap.json');
    heightData = await res.json();
    console.log('[TerrainHandler] 지형 데이터 로드 완료');
    return heightData;
  } catch (err) {
    console.error('[TerrainHandler] 지형 데이터 로드 실패:', err);
    return null;
  }
};

// ─── 파티션 고도 데이터 (showElevation 활성화 시 사용) ──────────────────────
let partitionElevStore = null; // { items: [{elevY, bbox, pts}], baseCharY: number }

// ray-casting point-in-polygon (2D, XZ 평면)
const pointInPolygon2D = (wx, wz, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1];
    const xj = pts[j][0], zj = pts[j][1];
    if ((zi > wz) !== (zj > wz) && wx < (xj - xi) * (wz - zi) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * RpgWorld에서 sharedPartitions + effectiveScale이 변경될 때마다 호출.
 * effectiveScale=0 이면 파티션 고도 비활성화.
 */
export const updatePartitionElevations = (partitions, effectiveScale) => {
  if (!partitions?.length || effectiveScale === 0) {
    partitionElevStore = null;
    return;
  }

  const BASE_Y = 0.55; // CityBlockOverlay BASE_Y 와 동일
  const items = [];

  for (const p of partitions) {
    const elev = (p.elevation_m ?? 0) * effectiveScale;
    const b = p.boundary_geojson;
    if (!b?.coordinates?.[0]) continue;

    const outer = b.coordinates[0];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const pts = [];
    for (const [lng, lat] of outer) {
      const x = (lng - GIS_ORIGIN.lng) * LNG_TO_M;
      const z = (GIS_ORIGIN.lat - lat) * LAT_TO_M;
      pts.push([x, z]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    // 플레이어 목표 Y = 지면 Y + 캐릭터 오프셋
    // 지면 실제 Y = elevation_prop(0.05) + BASE_Y(0.55) + elev
    // 캐릭터는 지면 위에 서 있어야 하므로 LAYER_Y.character + elev
    items.push({ elevY: LAYER_Y.character + elev, bbox: { minX, maxX, minZ, maxZ }, pts });
  }

  partitionElevStore = items.length ? items : null;
};

// 마지막 탐색 결과 캐시 (매 프레임 full scan 방지)
let _lastPos = null;
let _lastElevY = null;
const CACHE_DIST_SQ = 5 * 5; // 5m 이상 이동 시에만 재탐색

/**
 * 현재 플레이어 위치(wx, wz)에 해당하는 파티션 Y 반환.
 * 파티션 고도 비활성화 상태면 null 반환 → 호출측에서 getTerrainHeight 로 폴백.
 */
export const getPartitionElevY = (wx, wz) => {
  if (!partitionElevStore) return null;

  // 캐시 히트
  if (_lastPos) {
    const dx = wx - _lastPos[0], dz = wz - _lastPos[1];
    if (dx * dx + dz * dz < CACHE_DIST_SQ) return _lastElevY;
  }

  let result = LAYER_Y.character; // 파티션 미탐색 시 기본값
  for (const { elevY, bbox, pts } of partitionElevStore) {
    if (wx < bbox.minX || wx > bbox.maxX || wz < bbox.minZ || wz > bbox.maxZ) continue;
    if (pointInPolygon2D(wx, wz, pts)) { result = elevY; break; }
  }

  _lastPos = [wx, wz];
  _lastElevY = result;
  return result;
};

export const getTerrainHeight = (wx, wz) => {
  if (!heightData) return LAYER_Y.character;

  const { grid_size, world_width, world_height, elevations, elev_min, offset_x, offset_z } = heightData;

  // 1. 월드 좌표를 데이터 격자 좌표(u, v)로 변환
  const u = (wx - offset_x) / world_width;
  const v = (wz - offset_z) / world_height;



  // 2. 범위를 벗어나면 기본값 반환
  if (u < 0 || u > 1 || v < 0 || v > 1) return 1.0;

  // 3. 네 개의 인접 그리드 점 찾기 (Bilinear Interpolation)
  const fX = u * (grid_size - 1);
  const fZ = v * (grid_size - 1);
  const x1 = Math.floor(fX);
  const x2 = Math.min(grid_size - 1, x1 + 1);
  const z1 = Math.floor(fZ);
  const z2 = Math.min(grid_size - 1, z1 + 1);

  // 각 점의 가중치(소수점 부분)
  const tx = fX - x1;
  const tz = fZ - z1;

  // 네 점의 높이값 추출
  const h11 = elevations[z1 * grid_size + x1] || elev_min;
  const h21 = elevations[z1 * grid_size + x2] || elev_min;
  const h12 = elevations[z2 * grid_size + x1] || elev_min;
  const h22 = elevations[z2 * grid_size + x2] || elev_min;

  // x축 방향 보간
  const h1 = h11 * (1 - tx) + h21 * tx;
  const h2 = h12 * (1 - tx) + h22 * tx;

  // z축 방향 최종 보간 (부드러운 원본 고도)
  const rawElev = h1 * (1 - tz) + h2 * tz;
  let relElev = Math.max(0, rawElev - elev_min);

  // 현재 RpgWorld.jsx의 debugConfig.terrainHeightScale (기본값 1.0)과 일치시킵니다.
  let finalY = relElev * 1.0;

  // 캐릭터나 도로가 올라갈 최종 지표면 높이 (flat 오버레이 스택 위)
  return finalY + LAYER_Y.character;
};
