import client from '@api/client';

/**
 * 스마트 검색 API 모듈
 * - 의도 기반 라우팅 (키워드/개인화/유사도/분석)
 */

export const searchAPI = {
  /**
   * 스마트 영상 검색
   * @param {string} query - 검색어
   * @returns {Promise<{intent: string, results: Array}>}
   */
  searchVideos: async (query) => {
    const response = await client.get('/api/content/search/smart', {
      params: { query, target: 'video' }
    });
    return response.data;
  },

  /**
   * 스마트 채널 검색
   * @param {string} query - 검색어
   * @returns {Promise<{intent: string, results: Array}>}
   */
  searchChannels: async (query) => {
    const response = await client.get('/api/content/search/smart', {
      params: { query, target: 'channel' }
    });
    return response.data;
  }
};

export default searchAPI;
