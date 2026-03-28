import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@contexts/AuthContext';
import '@screens/Auth/AuthScreen.css';

export default function Signup() {
  const navigate = useNavigate();
  const { signup, login } = useAuth();
  const [form, setForm] = useState({
    nickname: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const updateField = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    const signupResult = await signup(form.email, form.password, form.nickname);
    if (!signupResult.success) {
      setError(signupResult.error);
      return;
    }

    const loginResult = await login(form.email, form.password);
    if (!loginResult.success) {
      setError(loginResult.error);
      return;
    }

    navigate('/game');
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-hero">
          <div className="auth-hero-inner">
            <div className="auth-kicker">New Character Entry</div>
            <h1 className="auth-title">첫 계정 생성</h1>
            <p className="auth-copy">
              회원가입이 끝나면 기본 캐릭터가 바로 생성됩니다.
              별도 캐릭터 생성 단계를 두지 않고 바로 월드 진입까지 이어집니다.
            </p>
            <div className="auth-highlights">
              <div className="auth-highlight">
                <div className="auth-highlight-label">Character</div>
                <div className="auth-highlight-value">가입 즉시 기본 캐릭터 생성</div>
              </div>
              <div className="auth-highlight">
                <div className="auth-highlight-label">Initial Stats</div>
                <div className="auth-highlight-value">Lv1 / HP100 / MP50</div>
              </div>
              <div className="auth-highlight">
                <div className="auth-highlight-label">Entry Flow</div>
                <div className="auth-highlight-value">가입 후 자동 로그인</div>
              </div>
            </div>
          </div>
          <div className="auth-hero-footer">
            <span>계정과 캐릭터를 같이 초기화</span>
            <span>초반 UX 끊김 제거</span>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-card-top">
              <h2 className="auth-card-title">회원가입</h2>
              <p className="auth-card-subtitle">
                닉네임, 이메일, 비밀번호를 입력하면 바로 게임 계정을 생성합니다.
              </p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span className="auth-label">Nickname</span>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="플레이어 이름"
                  value={form.nickname}
                  onChange={updateField('nickname')}
                  minLength={2}
                  required
                />
              </label>

              <label className="auth-field">
                <span className="auth-label">Email</span>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={updateField('email')}
                  required
                />
              </label>

              <label className="auth-field">
                <span className="auth-label">Password</span>
                <input
                  className="auth-input"
                  type="password"
                  placeholder="최소 4자 이상"
                  value={form.password}
                  onChange={updateField('password')}
                  minLength={4}
                  required
                />
              </label>

              <label className="auth-field">
                <span className="auth-label">Confirm Password</span>
                <input
                  className="auth-input"
                  type="password"
                  placeholder="비밀번호 확인"
                  value={form.confirmPassword}
                  onChange={updateField('confirmPassword')}
                  minLength={4}
                  required
                />
              </label>

              {error ? <div className="auth-error">{error}</div> : null}

              <div className="auth-actions">
                <button className="auth-primary-btn" type="submit">
                  Create Account
                </button>
              </div>
            </form>

            <div className="auth-switch">
              이미 계정이 있으면{' '}
              <button className="auth-text-btn" type="button" onClick={() => navigate('/login')}>
                로그인으로 돌아가기
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
