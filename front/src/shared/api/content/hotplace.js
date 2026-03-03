import client from '@api/client';

/**
 * 네이버 장소 검색 API 호출
 * @param {string} query 검색어
 * @returns {Promise} API 응답 데이터 (items, meta 포함)
 */

export const searchPlace = async (query) => {
  // GET /api/search?query=...
  const response = await client.get('/api/content/search', {
    params: { query: query }
  });
  return response.data;
};
