import { useState } from 'react';
import { useAuth } from '@shared/context/AuthContext';
import './AuthModal.css';

export default function AuthModal({ isOpen, onClose }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nickname: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); // 입력 시 에러 메시지 지우기
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'login') {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        onClose(); // 모달 닫기
        setFormData({ email: '', password: '', nickname: '' }); // 폼 초기화
      } else {
        setError(result.error);
      }
    } else {
      // 회원가입
      if (!formData.nickname) {
        setError('닉네임을 입력해주세요.');
        setLoading(false);
        return;
      }
      const result = await signup(formData.email, formData.password, formData.nickname);
      if (result.success) {
        setMode('login'); // 회원가입 성공 시 로그인 탭으로 전환
        setError('');
        setFormData({ ...formData, password: '' }); // 비밀번호만 초기화
        alert('회원가입이 완료되었습니다! 로그인해주세요.');
      } else {
        setError(result.error);
      }
    }
    setLoading(false);
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setFormData({ email: '', password: '', nickname: '' });
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose}>✕</button>

        <div className="auth-modal-header">
          <h2>{mode === 'login' ? '로그인' : '회원가입'}</h2>
          <p className="auth-modal-subtitle">
            {mode === 'login' ? '소개팅의 새로운 시작' : '지금 바로 시작하세요'}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="email">이메일</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@email.com"
              required
            />
          </div>

          <div className="auth-input-group">
            <label htmlFor="password">비밀번호</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="4자 이상 입력"
              required
              minLength="4"
            />
          </div>

          {mode === 'signup' && (
            <div className="auth-input-group">
              <label htmlFor="nickname">닉네임</label>
              <input
                type="text"
                id="nickname"
                name="nickname"
                value={formData.nickname}
                onChange={handleChange}
                placeholder="2자 이상 입력"
                required
                minLength="2"
              />
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? '처리 중...' : (mode === 'login' ? '로그인' : '회원가입')}
          </button>
        </form>

        <div className="auth-switch">
          <span>
            {mode === 'login' ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
          </span>
          <button type="button" onClick={switchMode} className="auth-switch-btn">
            {mode === 'login' ? '회원가입' : '로그인'}
          </button>
        </div>
      </div>
    </div>
  );
}
