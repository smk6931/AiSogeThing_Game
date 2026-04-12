import { LAYER_Y } from './mapConfig';

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
