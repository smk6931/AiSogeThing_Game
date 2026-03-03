import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@shared/context/AuthContext';
import { Bot, Gamepad2 } from 'lucide-react';
import userApi from '@api/auth/auth';
import OnlineUsersModal from '../common/OnlineUsersModal';
import ChatbotWidget from '../ChatbotWidget';
import './UserStatus.css';

export default function UserStatus() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [onlineCount, setOnlineCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  // 5초마다 접속자 수 조회 + Heartbeat 전송
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // 1. 전체 접속자 수 조회
        const response = await userApi.getOnlineStats();
        setOnlineCount(response.data.online_users);

        // 2. 로그인 상태면 Heartbeat(생존 신호) 전송
        if (user) {
          await userApi.sendHeartbeat();
        }
      } catch (error) {
        console.error('Status Error:', error);
      }
    };

    // 최초 1회 실행
    fetchStatus();

    // 5초 주기 폴링 (테스트용 짧은 주기)
    const interval = setInterval(fetchStatus, 5000);

    return () => clearInterval(interval);
  }, [user]);

  // 천 단위 콤마 포맷팅
  const formattedCount = onlineCount.toLocaleString();

  return (
    <>
      <div className="user-status-container">
        <button className="online-status-badge" onClick={() => setIsModalOpen(true)}>
          <span className="online-status-dot"></span>
          <span className="online-status-text">
            <span className="online-count">{formattedCount}</span>명 접속 중
          </span>
        </button>

        {/* AI 챗봇 아이콘 버튼 */}
        <button
          className="ai-chatbot-icon-btn"
          onClick={() => setIsChatbotOpen(true)}
          title="AI 도우미"
        >
          <Bot size={20} />
        </button>

        {/* RPG 게임 입장 버튼 (NEW) */}
        <button
          className="game-enter-btn"
          onClick={() => navigate('/game')}
          title="RPG 월드 입장"
          style={{
            marginLeft: '8px',
            background: 'linear-gradient(135deg, #6e8efb, #a777e3)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            cursor: 'pointer',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
          }}
        >
          <Gamepad2 size={18} />
        </button>
      </div>

      <OnlineUsersModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* 챗봇 모달 */}
      {isChatbotOpen && (
        <ChatbotWidget
          isOpen={isChatbotOpen}
          onClose={() => setIsChatbotOpen(false)}
        />
      )}
    </>
  );
}
