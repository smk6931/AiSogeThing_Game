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
  }
};

export default worldApi;
