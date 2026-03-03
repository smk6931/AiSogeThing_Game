import { Sparkles } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import './MatchCard.css';

export default function MatchCard({ user, onViewDetails }) {
  return (
    <Card variant="glass" padding="medium" className="match-card">
      <div className="match-card__header">
        <img
          src={user.photo || 'https://placehold.co/120'}
          alt={user.name}
          className="match-card__photo"
        />
        <div className="match-card__match-badge">
          <span className="match-card__percentage">{user.matchPercentage}%</span>
          <span className="match-card__text">매칭</span>
        </div>
      </div>

      <div className="match-card__body">
        <h3 className="match-card__name">{user.name}, {user.age}</h3>

        <div className="match-card__tags">
          {user.interests.slice(0, 3).map((interest, index) => (
            <span key={index} className="match-card__tag">
              {interest}
            </span>
          ))}
        </div>

        <Button
          variant="ghost"
          size="small"
          fullWidth
          icon={<Sparkles size={16} />}
          onClick={() => onViewDetails(user.id)}
        >
          AI 분석 보기
        </Button>
      </div>
    </Card>
  );
}
