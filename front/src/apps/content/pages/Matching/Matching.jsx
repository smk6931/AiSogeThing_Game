import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import MatchCard from '../../components/shared/MatchCard';
import './Matching.css';

export default function Matching() {
  const navigate = useNavigate();

  // 임시 데이터 (추후 API 연동)
  const [matches] = useState([
    {
      id: 1,
      name: '지수',
      age: 28,
      photo: 'https://placehold.co/120',
      matchPercentage: 92,
      interests: ['🎵 인디음악', '🎬 SF영화', '☕️ 카페투어']
    },
    {
      id: 2,
      name: '민준',
      age: 30,
      photo: 'https://placehold.co/120',
      matchPercentage: 88,
      interests: ['🏃 러닝', '🎮 게임', '🍕 맛집탐방']
    },
    {
      id: 3,
      name: '서연',
      age: 26,
      photo: 'https://placehold.co/120',
      matchPercentage: 85,
      interests: ['💄 뷰티', '🎹 재즈', '📚 독서']
    },
  ]);

  const handleViewDetails = (userId) => {
    navigate(`/profile/${userId}`);
  };

  return (
    <div className="matching">
      <div className="matching__container">
        <header className="matching__header">
          <h1 className="matching__title">
            <Sparkles size={24} className="matching__title-icon" />
            오늘의 매칭
          </h1>
          <p className="matching__subtitle">
            AI가 분석한 당신과 가장 잘 맞는 사람들입니다
          </p>
        </header>

        <div className="matching__grid">
          {matches.map((user) => (
            <MatchCard
              key={user.id}
              user={user}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
