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
    <div className="auth-page auth-page-login">
      <div className="auth-shell">
        <section className="auth-hero">
          <div className="auth-hero-inner">
            <div className="auth-kicker">Seoul Urban Fantasy RPG</div>
            <h1 className="auth-title">Enter the Frontier</h1>
            <p className="auth-copy">Map first. Fast login. Direct world entry.</p>

            <div className="auth-badge-row">
              <span className="auth-chip">Town Map</span>
              <span className="auth-chip">Fast Start</span>
              <span className="auth-chip">Mobile Ready</span>
            </div>

            <div className="auth-scene">
              <div className="auth-map-panel">
                <div className="auth-map-panel-copy">
                  <span className="auth-map-panel-label">Starting Area</span>
                  <strong>Noryangjin Route</strong>
                  <p>Roads, camps, ruins, and a village map layered into the entry flow.</p>
                </div>
              </div>

              <div className="auth-preview-stack" aria-hidden="true">
                <div className="auth-preview-card auth-preview-card-main" />
                <div className="auth-preview-card auth-preview-card-camp" />
                <div className="auth-preview-card auth-preview-card-ruin" />
              </div>
            </div>
          </div>

          <div className="auth-hero-footer">
            <span>Game login screen</span>
            <span>Scrolls on small screens</span>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-card-top">
              <h2 className="auth-card-title">Login</h2>
              <p className="auth-card-subtitle">Sign in or jump in as guest.</p>
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
                  placeholder="Enter password"
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
                  Guest Start
                </button>
              </div>
            </form>

            <div className="auth-stat-grid">
              <div className="auth-stat-card">
                <span>Mode</span>
                <strong>Cross Device</strong>
              </div>
              <div className="auth-stat-card">
                <span>Flow</span>
                <strong>Login to Spawn</strong>
              </div>
            </div>

            <div className="auth-switch">
              Need an account?{' '}
              <button className="auth-text-btn" type="button" onClick={() => navigate('/signup')}>
                Create one
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
