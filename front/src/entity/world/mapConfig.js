// ─── 월드 Y축 레이어 상수 ───────────────────────────────────────────────────
// 모든 레이어와 플레이어/몬스터는 이 값을 기준으로 오프셋을 더한다.
// 변경 시 이 파일 한 곳만 수정하면 된다.
export const LAYER_Y = {
  // ── 지면 렌더링 레이어 (낮은 순서 = 먼저 깔리는 레이어) ─────────────────
  base:              0,      // MapTiles 기준 바닥
  ground_mesh:       0.01,   // DongGroundMesh
  zone:              0.02,   // ZoneOverlay (공원·자연·수계) — 블록 아래
  landuse:           0.03,   // CityBlockOverlay (토지이용 텍스처)
  road_split:        0.04,   // CityBlockOverlay (도로분할 섹터)
  current_group_tex: 0.05,   // CityBlockOverlay (현재그룹 텍스처)
  road:              0.06,   // SeoulTerrain (도로) — 블록 위에 깔림
  district_boundary: 0.07,   // PartitionBoundaryOverlay
  group_color:       0.08,   // GroupColorOverlay
  // ── 캐릭터/몬스터 — 지면 레이어 전체보다 위 ────────────────────────────
  character:         0.5,    // 플레이어·몬스터 (AI 텍스처 시각 높이 + 여유)
};

// 맵 크기 정의 (1m = 1 unit)
export const TILE_SIZE = 2000; // 300m x 300m (사람이 걷기 좋은 거대한 구역)
export const VISIBILITY_RADIUS = 2; // 내 주변 2타일 반경 (5x5 그리드)

// GIS 좌표 설정 (노량진로 6가길 18 기준)
export const GIS_ORIGIN = {
  lat: 37.5124,
  lng: 126.9392
};

// 위경도 <-> 게임 좌표 변환 오프셋 (서울 37.5도 기준 정밀도 향상)
// 1도당 m: lat 약 110,940m, lng 약 88,200m
export const LAT_TO_M = 110940;
export const LNG_TO_M = 88200;

export const gameToGps = (x, z) => {
  return {
    lat: GIS_ORIGIN.lat - (z / LAT_TO_M),
    lng: GIS_ORIGIN.lng + (x / LNG_TO_M)
  };
};

export const gpsToGame = (lat, lng) => {
  return {
    x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
    z: (GIS_ORIGIN.lat - lat) * LAT_TO_M
  };
};

const GAP = 100; // 타일 사이 간격 50m로 확대
const STRIDE = TILE_SIZE + GAP;

// 14개 맵에서 실제 서울 위성지도(map_0, map_1) 제거 후 12개로 정리
// Grid System (4x3 그리드):
// Row 0: map_2(0), map_4(1), map_5(2), map_6(3)
// Row 1: map_7(0), map_8(1), map_9(2), map_10(3)
// Row 2: map_11(0), map_12(1), map_14(2), map_15(3)

export const MAPS = {
  // Row 0: North Seoul Line (X: -1, 0, 1, 2 | Z: -1)
  'map_2': {
    id: 'map_2', name: 'Mapo-gu (Market)', texture: '/images/327b36da6402f56e679184d5cf7d7c26.jpg',
    position: [-1 * STRIDE, 0, -1 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/15.png',
    portals: [{ targetMapId: 'map_7', position: [0, 0, 40] }]
  },
  'map_4': {
    id: 'map_4', name: 'Yongsan-gu (Base)', texture: '/images/447c1be047db0362550eac42c361e35c.jpg',
    position: [0 * STRIDE, 0, -1 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/74.png',
    portals: [{ targetMapId: 'map_8', position: [0, 0, 40] }]
  },
  'map_5': {
    id: 'map_5', name: 'Seongdong-gu (Tech)', texture: '/images/59c7288fe0c809ecefb03e0610fca467.jpg',
    position: [1 * STRIDE, 0, -1 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/361.png',
    portals: [{ targetMapId: 'map_6', position: [40, 0, 0] }, { targetMapId: 'map_9', position: [0, 0, 40] }]
  },
  'map_6': {
    id: 'map_6', name: 'Gwangjin-gu (River)', texture: '/images/5ee644c3dd0996505e2e8c2904448a8d.jpg',
    position: [2 * STRIDE, 0, -1 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/41.png',
    portals: [{ targetMapId: 'map_5', position: [-40, 0, 0] }, { targetMapId: 'map_10', position: [0, 0, 40] }]
  },

  // Row 1: Central Seoul Line (Origin: Noryangjin/Dongjak at [0,0])
  'map_7': {
    id: 'map_7', name: 'Yeongdeungpo-gu (Finance)', texture: '/images/64e5d8778128da07aa4ae0b2cbb79292.jpg',
    position: [-1 * STRIDE, 0, 0 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/131.png',
    portals: [{ targetMapId: 'map_2', position: [0, 0, -40] }, { targetMapId: 'map_8', position: [40, 0, 0] }, { targetMapId: 'map_11', position: [0, 0, 40] }]
  },
  'map_8': {
    id: 'map_8', name: 'Noryangjin (Dongjak-gu)', texture: '/images/735e3a457fd48501e95f1f23832ba1ad.jpg',
    position: [0 * STRIDE, 0, 0 * STRIDE],
    isHome: true,
    color: '#4ade80',
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png',
    portals: [{ targetMapId: 'map_4', position: [0, 0, -40] }, { targetMapId: 'map_7', position: [-40, 0, 0] }, { targetMapId: 'map_12', position: [0, 0, 40] }]
  },
  'map_9': {
    id: 'map_9', name: 'Seocho-gu (Court)', texture: '/images/7b277889e448e30f490a55074e694ff5.jpg',
    position: [1 * STRIDE, 0, 0 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/218.png',
    portals: [{ targetMapId: 'map_5', position: [0, 0, -40] }, { targetMapId: 'map_10', position: [40, 0, 0] }, { targetMapId: 'map_14', position: [0, 0, 40] }]
  },
  'map_10': {
    id: 'map_10', name: 'Gangnam-gu (Neon)', texture: '/images/c26ed8d33fdd167d4688a38dc3f262d5.jpg',
    position: [2 * STRIDE, 0, 0 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/149.png',
    portals: [{ targetMapId: 'map_6', position: [0, 0, -40] }, { targetMapId: 'map_9', position: [-40, 0, 0] }, { targetMapId: 'map_15', position: [0, 0, 40] }]
  },

  // Row 2: South Seoul Line
  'map_11': {
    id: 'map_11', name: 'Gwanak-gu (Varsity)', texture: '/images/dbe11e2e0165a947ff3943289e46a46a.jpg',
    position: [-1 * STRIDE, 0, 1 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/109.png',
    portals: [{ targetMapId: 'map_7', position: [0, 0, -40] }, { targetMapId: 'map_12', position: [40, 0, 0] }]
  },
  'map_12': {
    id: 'map_12', name: 'Geumcheon-gu (Valley)', texture: '/images/e2d883e3f30b7ac9e222195601498684.jpg',
    position: [0 * STRIDE, 0, 1 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/27.png',
    portals: [{ targetMapId: 'map_8', position: [0, 0, -40] }, { targetMapId: 'map_11', position: [-40, 0, 0] }]
  },
  'map_14': {
    id: 'map_14', name: 'Songpa-gu (Tower)', texture: '/images/ec1cbe7ba65ab0e674808182127c8b6b.jpg',
    position: [1 * STRIDE, 0, 1 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png',
    portals: [{ targetMapId: 'map_9', position: [0, 0, -40] }, { targetMapId: 'map_15', position: [40, 0, 0] }]
  },
  'map_15': {
    id: 'map_15', name: 'Gangdong-gu (East)', texture: '/images/f9b808c6e9318d035e1d64cd546d23d3.jpg',
    position: [2 * STRIDE, 0, 1 * STRIDE],
    monsterTexture: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/150.png',
    portals: [{ targetMapId: 'map_10', position: [0, 0, -40] }, { targetMapId: 'map_14', position: [-40, 0, 0] }]
  }
};

export const getMap = (id) => MAPS[id] || MAPS['map_2'];
export const getAllMaps = () => Object.values(MAPS);
