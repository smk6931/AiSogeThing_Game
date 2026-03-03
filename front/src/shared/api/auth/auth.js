import client from '@api/client';

/**
 * 사용자 및 인증 관련 API 모음
 */
const userApi = {
  // 회원가입
  signup: async ({ email, password, nickname }) => {
    return await client.post('/api/auth/signup', { email, password, nickname });
  },

  // 로그인 (OAuth2 폼 데이터 전송)
  login: async ({ email, password }) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    return await client.post('/api/auth/login', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
  },

  // 로그아웃 (서버 상태 변경)
  logout: async () => {
    return await client.post('/api/auth/logout');
  },

  // 내 정보 조회 (토큰 검증 포함)
  getMe: async () => {
    return await client.get('/api/auth/me');
  },

  // 실시간 접속자 수 조회 (숫자)
  getOnlineStats: async () => {
    return await client.get('/api/auth/stats/online');
  },

  // 접속 중인 유저 상세 리스트 조회 (모달용)
  getOnlineUsersDetail: async () => {
    return await client.get('/api/auth/stats/online-users');
  },

  // 전체 유저 리스트 조회
  getAllUsers: async () => {
    return await client.get('/api/auth/stats/all-users');
  },

  // 생존 신호 전송 (Heartbeat)
  sendHeartbeat: async () => {
    return await client.post('/api/auth/heartbeat');
  },

  // ========== 사용자 프로필 조회 (Public) ==========
  // 특정 사용자 프로필 정보 조회
  getUserProfile: async (userId) => {
    return await client.get(`/api/auth/profile/${userId}`);
  },

  // 특정 사용자 시청 기록 조회
  getUserHistory: async (userId) => {
    return await client.get(`/api/content/youtube/user/${userId}/history`);
  },

  // 특정 사용자 구독 채널 조회
  getUserSubscriptions: async (userId) => {
    return await client.get(`/api/content/youtube/user/${userId}/subscriptions`);
  }
};

export default userApi;
