import { useState } from 'react';
import { MessageCircle, X, Send, TrendingUp, Users, HelpCircle, Sparkles } from 'lucide-react';
import chatbotAPI from '@api/content/chatbot';
import './ChatbotWidget.css';

export default function ChatbotWidget({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '안녕하세요! 무엇을 도와드릴까요?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const quickActions = [
    { icon: Sparkles, label: '성향 분석', action: 'analyze' },
    { icon: TrendingUp, label: '영상 추천', action: 'recommend' },
    { icon: Users, label: '유사 유저', action: 'match' },
    { icon: HelpCircle, label: '서비스 안내', action: 'info' }
  ];

  const handleQuickAction = async (actionType) => {
    const actionMessages = {
      analyze: '내 시청 성향을 분석해주세요',
      recommend: '추천 영상을 보여주세요',
      match: '나와 비슷한 유저를 찾아주세요',
      info: '이 서비스에 대해 설명해주세요'
    };

    const userMessage = actionMessages[actionType];
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const data = await chatbotAPI[actionType]();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message || '처리 완료!' }]);
    } catch (error) {
      const errorMsg = error.response?.status === 401
        ? '로그인이 필요한 기능입니다. 먼저 로그인해주세요!'
        : '죄송합니다. 일시적인 오류가 발생했습니다.';

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMsg
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const messageToSend = inputText;
    setMessages(prev => [...prev, { role: 'user', content: messageToSend }]);
    setInputText('');
    setLoading(true);

    try {
      const data = await chatbotAPI.chat(messageToSend);
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch (error) {
      const errorMsg = error.response?.status === 401
        ? '로그인이 필요합니다. 먼저 로그인해주세요!'
        : '죄송합니다. 응답을 생성하지 못했습니다.';

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMsg
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chatbot-modal-overlay" onClick={onClose}>
      {/* 챗봇 윈도우 */}
      <div className="chatbot-window" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="chatbot-header">
          <div className="chatbot-title">
            <MessageCircle size={20} />
            <span>AI 도우미</span>
          </div>
          <button className="chatbot-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* 빠른 액션 버튼 */}
        <div className="chatbot-quick-actions">
          {quickActions.map((action) => (
            <button
              key={action.action}
              className="quick-action-btn"
              onClick={() => handleQuickAction(action.action)}
              disabled={loading}
            >
              <action.icon size={16} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* 메시지 영역 */}
        <div className="chatbot-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <div className="message-content loading-dots">
                <span>●</span><span>●</span><span>●</span>
              </div>
            </div>
          )}
        </div>

        {/* 입력창 */}
        <div className="chatbot-input-area">
          <input
            type="text"
            placeholder="메시지를 입력하세요..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={loading}
          />
          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={loading || !inputText.trim()}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
