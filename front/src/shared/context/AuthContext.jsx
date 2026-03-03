import { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '@api/client';
import userApi from '@api/auth/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // 앱 초기화 시 로컬스토리지에서 토큰/유저 정보 복원
  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Axios 기본 헤더에 토큰 설정
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    setLoading(false);
  }, []);

  // 회원가입 함수
  const signup = async (email, password, nickname) => {
    try {
      const response = await userApi.signup({ email, password, nickname });
      return { success: true, data: response.data };
    } catch (error) {
      const errorMsg = error.response?.data?.detail || '회원가입에 실패했습니다.';
      return { success: false, error: errorMsg };
    }
  };

  // 로그인 함수
  const login = async (email, password) => {
    try {
      const response = await userApi.login({ email, password });
      const { access_token, user_id, nickname } = response.data;

      // 상태 업데이트
      setToken(access_token);
      const userData = { id: user_id, email, nickname };
      setUser(userData);

      // 로컬스토리지 저장
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));

      // Axios 기본 헤더 설정
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.detail || '로그인에 실패했습니다.';
      return { success: false, error: errorMsg };
    }
  };

  // 로그아웃 함수
  const logout = async () => {
    try {
      // 서버에 오프라인 상태 알림
      if (token) {
        await userApi.logout();
      }
    } catch (error) {
      console.error('Logout API Error:', error);
    } finally {
      // 성공 여부와 관계없이 클라이언트 로그아웃 처리
      setUser(null);
      setToken(null);
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      delete apiClient.defaults.headers.common['Authorization'];
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
