import client from '@api/client';

/**
 * 월드/지도 관련 API 모음 (지형, 구역, 행정경계)
 */
const worldApi = {
  // 서울시 25개 구 행정 경계 데이터 조회
  getDistricts: async (refresh = false) => {
    return await client.get(`/api/world/districts?refresh=${refresh}`);
  },

  // 특정 좌표 중심의 구역(Zone) 데이터 조회
  getZones: async (lat, lng, dist = 2000, categories = '', districtId = null) => {
    return await client.get('/api/world/zones', {
      params: { lat, lng, dist, categories, district_id: districtId }
    });
  },

  // 특정 좌표 중심의 실시간 지형(Terrain) 데이터 조회
  getTerrain: async (lat, lng, dist = 100) => {
    return await client.get('/api/world/terrain', {
      params: { lat, lng, dist }
    });
  },

  // 특정 구(District) 고유 지형 데이터 조회
  getDistrictTerrain: async (districtId) => {
    return await client.get(`/api/world/terrain/district/${districtId}`);
  },

  // 서울시 동(Dong) 행정 경계 데이터 조회
  getDongs: async (refresh = false) => {
    return await client.get(`/api/world/dongs?refresh=${refresh}`);
  },

  // 현재 좌표 기준 동 정보 조회
  getCurrentDong: async (lat, lng) => {
    return await client.get('/api/world/dong/current', {
      params: { lat, lng }
    });
  },

  getCurrentRegion: async (lat, lng) => {
    return await client.get('/api/world/region/current', {
      params: { lat, lng }
    });
  },

  // 특정 동(Dong) 고유 지형 데이터 조회
  getDongTerrain: async (dongId) => {
    return await client.get(`/api/world/terrain/dong/${dongId}`);
  },

  // 구역(Zone) 데이터 조회 (구/동 단위 선택적 지원)
  getDistrictZones: async (districtId) => {
    return await client.get(`/api/world/zones/district/${districtId}`);
  },
  getDongZones: async (dongId) => {
    return await client.get(`/api/world/zones/dong/${dongId}`);
  },

  // 블록(Block) 데이터 조회
  getDistrictBlocks: async (districtId) => {
    return await client.get(`/api/world/blocks/district/${districtId}`);
  },
  getDongBlocks: async (dongId) => {
    return await client.get(`/api/world/blocks/dong/${dongId}`);
  },
  
  // 서버의 images 폴더 내 파일 목록 조회
  getBlockTextures: async () => {
    return await client.get('/api/world/block-textures');
  },

  // 용산구 월드 디자인 메타데이터 초안 조회
  getYongsanDesignProfile: async () => {
    return await client.get('/api/world/design/yongsan');
  }
};

export default worldApi;
