import axios from 'axios';

// 백엔드 기본 URL 설정 (운영 환경에서는 상대 경로/인증서 도메인을 사용하도록 개선)
const client = axios.create({
  // PROD 환경이면 같은 도메인의 /api를 사용 (상대 경로), 아니면 환경변수/로컬 주소 사용
  baseURL: import.meta.env.PROD
    ? ''
    : (import.meta.env.VITE_API_URL || 'http://localhost:8100'),
  withCredentials: true,
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
