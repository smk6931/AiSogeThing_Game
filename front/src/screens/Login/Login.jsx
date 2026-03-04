import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('w@w.w'); // 자동 입력
  const [password, setPassword] = useState('1234');     // 자동 입력
  const { login, guestLogin } = useAuth();
  const navigate = useNavigate();

  const handleGuestLogin = async () => {
    const result = await guestLogin();
    if (result.success) {
      navigate('/game');
    } else {
      alert(result.error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (username.trim()) {
      const result = await login(username, password);
      if (result.success) {
        navigate('/game'); // 3D 게임으로 즉시 진입
      } else {
        alert(result.error);
      }
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">AiSogeThing Game</h1>
        <p className="login-subtitle">나만의 3D 월드 탐험</p>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <input
              type="text"
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              required
            />
          </div>
          <div className="form-group">
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              required
            />
          </div>

          <button className="primary-btn login-btn" type="submit">
            게임 시작
          </button>

          <button
            type="button"
            className="link-btn guest-btn"
            onClick={handleGuestLogin}
            style={{ marginTop: '15px', display: 'block', width: '100%', padding: '10px', background: '#e0e0e0', color: '#333', borderRadius: '8px' }}
          >
            임시 Admin 계정으로 억지 접속
          </button>
        </form>

        <div className="login-footer">
          {/* 회원가입 라우트는 현재 연결되어 있지 않음 */}
          <p>계정이 없으신가요? <button className="link-btn">회원가입</button></p>
        </div>
      </div>
    </div>
  );
}
