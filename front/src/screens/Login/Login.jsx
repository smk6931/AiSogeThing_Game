import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@contexts/AuthContext';
import '@screens/Auth/AuthScreen.css';

export default function Login() {
  const [email, setEmail] = useState('w@w.w');
  const [password, setPassword] = useState('1234');
  const [error, setError] = useState('');
  const { login, guestLogin } = useAuth();
  const navigate = useNavigate();

  const handleGuestLogin = async () => {
    setError('');
    const result = await guestLogin();
    if (result.success) {
      navigate('/game');
      return;
    }
    setError(result.error);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const result = await login(email, password);
    if (result.success) {
      navigate('/game');
      return;
    }
    setError(result.error);
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-hero">
          <div className="auth-hero-inner">
            <div className="auth-kicker">Seoul Urban Fantasy RPG</div>
            <h1 className="auth-title">AiSogeThing<br />Game</h1>
            <p className="auth-copy">
              노량진 골목에서 시작해 서울 전역으로 확장되는 오픈월드 RPG.
              생활권, 탐험, 사냥, 지역 정보가 한 화면에서 이어지는 입구로 재구성했습니다.
            </p>
            <div className="auth-highlights">
              <div className="auth-highlight">
                <div className="auth-highlight-label">Start Zone</div>
                <div className="auth-highlight-value">노량진 생활권</div>
              </div>
              <div className="auth-highlight">
                <div className="auth-highlight-label">World Rule</div>
                <div className="auth-highlight-value">자유 이동 기반 오픈월드</div>
              </div>
              <div className="auth-highlight">
                <div className="auth-highlight-label">Focus</div>
                <div className="auth-highlight-value">탐험, 파밍, 지역 도감</div>
              </div>
            </div>
          </div>
          <div className="auth-hero-footer">
            <span>지역 데이터 기반 UI</span>
            <span>모바일 우선 플레이 흐름</span>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-card-top">
              <h2 className="auth-card-title">게임 진입</h2>
              <p className="auth-card-subtitle">
                기존 계정으로 로그인하거나, 게스트로 빠르게 들어갈 수 있습니다.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="auth-field">
                <span className="auth-label">Email</span>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>

              <label className="auth-field">
                <span className="auth-label">Password</span>
                <input
                  type="password"
                  className="auth-input"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>

              {error ? <div className="auth-error">{error}</div> : null}

              <div className="auth-actions">
                <button className="auth-primary-btn" type="submit">
                  Enter World
                </button>
                <button type="button" className="auth-secondary-btn" onClick={handleGuestLogin}>
                  게스트로 빠르게 시작
                </button>
              </div>
            </form>

            <div className="auth-switch">
              계정이 아직 없으면{' '}
              <button className="auth-text-btn" type="button" onClick={() => navigate('/signup')}>
                회원가입으로 이동
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
