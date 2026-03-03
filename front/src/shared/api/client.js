import axios from 'axios';

// 백엔드 기본 URL 설정
const client = axios.create({
  // 환경변수(.env)에 설정된 주소를 그대로 사용합니다.
  // 로컬에서는 http://localhost:8001, 서버에서는 https://sogething.com 이 적용됩니다.
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8400',
  withCredentials: true, // 쿠키 기반 인증 활성화
  headers: {
    'Content-Type': 'application/json',
  },
});

// 응답 인터셉터 (에러 처리 공통화 가능)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// WebSocket URL 생성 헬퍼
export const getWebSocketUrl = (endpoint) => {
  const baseUrl = client.defaults.baseURL;
  // http:// -> ws://, https:// -> wss:// 변환
  const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
  return `${wsBaseUrl}${endpoint}`;
};

export default client;
