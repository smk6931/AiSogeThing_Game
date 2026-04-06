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
      setError('Passwords do not match.');
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
    <div className="auth-page auth-page-signup">
      <div className="auth-shell">
        <section className="auth-hero">
          <div className="auth-hero-inner">
            <div className="auth-kicker">New Character Entry</div>
            <h1 className="auth-title">Create the Route</h1>
            <p className="auth-copy">One screen. One account. Instant entry.</p>

            <div className="auth-badge-row">
              <span className="auth-chip">Camp</span>
              <span className="auth-chip">Ruin</span>
              <span className="auth-chip">Village</span>
            </div>

            <div className="auth-scene">
              <div className="auth-map-panel auth-map-panel-signup">
                <div className="auth-map-panel-copy">
                  <span className="auth-map-panel-label">Spawn Ring</span>
                  <strong>First Step Setup</strong>
                  <p>Create an account and move straight into the world.</p>
                </div>
              </div>

              <div className="auth-preview-stack" aria-hidden="true">
                <div className="auth-preview-card auth-preview-card-ruin" />
                <div className="auth-preview-card auth-preview-card-main" />
                <div className="auth-preview-card auth-preview-card-camp" />
              </div>
            </div>
          </div>

          <div className="auth-hero-footer">
            <span>Quick account flow</span>
            <span>Mobile scroll supported</span>
          </div>
        </section>

        <section className="auth-panel">
          <div className="auth-card">
            <div className="auth-card-top">
              <h2 className="auth-card-title">Sign Up</h2>
              <p className="auth-card-subtitle">Create account and auto-login.</p>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-field">
                <span className="auth-label">Nickname</span>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Player name"
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
                  placeholder="At least 4 chars"
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
                  placeholder="Repeat password"
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

            <div className="auth-stat-grid">
              <div className="auth-stat-card">
                <span>Start</span>
                <strong>Account + Character</strong>
              </div>
              <div className="auth-stat-card">
                <span>Flow</span>
                <strong>Single Screen</strong>
              </div>
            </div>

            <div className="auth-switch">
              Already have an account?{' '}
              <button className="auth-text-btn" type="button" onClick={() => navigate('/login')}>
                Back to login
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
