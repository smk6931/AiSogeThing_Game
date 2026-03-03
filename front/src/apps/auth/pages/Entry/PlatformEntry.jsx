import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PlatformEntry.css';

const PlatformEntry = () => {
  const navigate = useNavigate();

  const handleChoice = (path) => {
    navigate(path);
  };

  return (
    <div className="entry-container">
      <div className="entry-background" />
      <div className="entry-overlay">
        <header className="entry-header">
          <h1 className="entry-logo">AiSogeThing</h1>
          <p className="entry-tagline">세상의 모든 소중한 인연과 즐거움</p>
        </header>

        <main className="platform-selection">
          <div
            className="platform-card sogething"
            onClick={() => handleChoice('/home')}
          >
            <div className="card-icon">💖</div>
            <h2 className="card-title">소개띵</h2>
            <p className="card-desc">AI가 추천하는 나만의 맞춤 인연<br />소셜 커뮤니티와 핫플레이스</p>
          </div>

          <div
            className="platform-card game"
            onClick={() => handleChoice('/game')}
          >
            <div className="card-icon">🎮</div>
            <h2 className="card-title">게임</h2>
            <p className="card-desc">박진감 넘치는 3D 생존 액션<br />전 세계 유저와 함께 즐기세요</p>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PlatformEntry;
