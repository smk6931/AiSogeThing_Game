import React, { useState, useEffect, useRef } from 'react';

const ChatBox = ({ messages, onSend, isMobile }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSend(inputText);
      setInputText('');
    }
  };

  // Styles
  const containerStyle = {
    position: 'absolute',
    bottom: isMobile ? '10px' : '130px', // 모바일: 중앙 하단 배치
    left: isMobile ? '50%' : '20px',
    transform: isMobile ? 'translateX(-50%)' : 'none',
    width: isMobile ? '220px' : '260px',
    height: isMobile ? '120px' : '160px',
    display: 'flex',
    flexDirection: 'column',
    pointerEvents: 'auto', // Enable interaction
    zIndex: 60,
    transition: 'all 0.3s ease'
  };

  const messageListStyle = {
    flex: 1,
    overflowY: 'auto',
    background: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '8px',
    padding: '8px',
    marginBottom: '8px',
    color: 'white',
    fontSize: isMobile ? '10px' : '13px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maskImage: 'linear-gradient(to bottom, transparent, black 10%)' // Fade top for better look
  };

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.7)',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: isMobile ? '6px 8px' : '6px 10px',
    color: 'white',
    fontSize: isMobile ? '16px' : '14px', // 16px 이상이어야 모바일 브라우저 자동 확대 방지
    outline: 'none',
    width: '100%'
  };

  return (
    <div style={containerStyle}>
      {/* Messages Area */}
      <div style={messageListStyle} className="hide-scrollbar">
        {messages.map((msg, index) => (
          <div key={index} style={{ wordBreak: 'break-all' }}>
            <span style={{ fontWeight: 'bold', color: '#fbbf24', marginRight: '4px' }}>
              {msg.nickname}:
            </span>
            <span>{msg.message}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Press Enter to chat..."
          style={inputStyle}
        // 모바일에서 입력 시 화면 가림 방지 (포커스 시 상단으로 이동 등은 복잡하므로 일단 기본 동작)
        />
      </form>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default ChatBox;
