import client from '@api/client';

/**
 * 챗봇 API 모듈
 * - 모든 챗봇 관련 API 호출을 중앙화
 * - client.js의 axios 인스턴스 사용 (토큰 자동 관리)
 */

export const chatbotAPI = {
  // 성향 분석
  analyze: async () => {
    const response = await client.post('/api/content/chatbot/analyze');
    return response.data;
  },

  // 영상 추천
  recommend: async () => {
    const response = await client.post('/api/content/chatbot/recommend');
    return response.data;
  },

  // 유사 유저 찾기
  match: async () => {
    const response = await client.post('/api/content/chatbot/match');
    return response.data;
  },

  // 서비스 안내
  info: async () => {
    const response = await client.post('/api/content/chatbot/info');
    return response.data;
  },

  // 자유 대화
  chat: async (message) => {
    const response = await client.post('/api/content/chatbot/chat', { message });
    return response.data;
  }
};

export default chatbotAPI;
