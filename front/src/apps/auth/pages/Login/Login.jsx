import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@shared/context/AuthContext';
import Card from '../../../content/components/common/Card';
import Button from '../../../content/components/common/Button';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('w@w.w'); // 자동 입력
  const [password, setPassword] = useState('1234');     // 자동 입력
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (username.trim()) {
      const result = await login(username, password);
      if (result.success) {
        navigate('/entry'); // 진입 플랫폼 선택 화면으로 이동
      } else {
        alert(result.error);
      }
    }
  };

  return (
    <div className="login-page">
      <Card variant="glass" padding="large" className="login-card">
        <h1 className="login-title">AiSogeThing</h1>
        <p className="login-subtitle">AI로 찾는 완벽한 인연</p>

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

          <Button variant="primary" fullWidth size="large" type="submit">
            로그인
          </Button>
        </form>

        <div className="login-footer">
          <p>계정이 없으신가요? <button className="link-btn">회원가입</button></p>
        </div>
      </Card>
    </div>
  );
}
