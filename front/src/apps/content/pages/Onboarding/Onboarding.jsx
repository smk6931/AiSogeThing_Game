import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Youtube, MessageCircle, Sparkles } from 'lucide-react';
import Button from '../../components/common/Button';
import Card from '../../components/common/Card';
import './Onboarding.css';

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  const handleYoutubeConnect = () => {
    // TODO: YouTube OAuth 연동
    console.log('YouTube 연동 시작');
    setStep(2);
  };

  const handleChatAnalysis = () => {
    // TODO: 채팅 데이터 분석
    console.log('채팅 분석 시작');
    setStep(3);
  };

  const handleComplete = () => {
    navigate('/matching');
  };

  return (
    <div className="onboarding">
      <div className="onboarding__container">
        <Card variant="glass" padding="large" className="onboarding__card">
          <div className="onboarding__icon">
            <div className="onboarding__icon-wrapper">
              <Youtube size={40} className="onboarding__icon-youtube" />
              <Sparkles size={24} className="onboarding__icon-ai" />
              <MessageCircle size={40} className="onboarding__icon-chat" />
            </div>
          </div>

          <h1 className="onboarding__title">
            AI가 분석하는<br />
            진짜 나와 맞는 사람
          </h1>

          <p className="onboarding__subtitle">
            YouTube 시청 기록과 채팅 스타일을 분석하여<br />
            당신의 완벽한 매칭을 찾아드립니다.
          </p>

          <div className="onboarding__actions">
            {step === 1 && (
              <>
                <Button
                  variant="secondary"
                  fullWidth
                  icon={<Youtube size={20} />}
                  onClick={handleYoutubeConnect}
                >
                  YouTube 연동하기
                </Button>
                <Button
                  variant="primary"
                  fullWidth
                  icon={<MessageCircle size={20} />}
                  onClick={handleChatAnalysis}
                >
                  채팅 분석 시작
                </Button>
              </>
            )}

            {step === 2 && (
              <div className="onboarding__loading">
                <div className="onboarding__spinner"></div>
                <p>YouTube 데이터 분석 중...</p>
                <Button variant="ghost" onClick={() => setStep(3)}>
                  건너뛰기
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="onboarding__complete">
                <Sparkles size={48} className="onboarding__complete-icon" />
                <h2>분석 완료!</h2>
                <p>이제 당신과 완벽한 매칭을 찾아보세요</p>
                <Button variant="primary" fullWidth onClick={handleComplete}>
                  매칭 시작하기
                </Button>
              </div>
            )}
          </div>

          <div className="onboarding__progress">
            <div className="onboarding__dots">
              {[...Array(totalSteps)].map((_, i) => (
                <span
                  key={i}
                  className={`onboarding__dot ${i + 1 === step ? 'active' : ''}`}
                />
              ))}
            </div>
            <p className="onboarding__step-text">단계 {step} / {totalSteps}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
