import React, { useEffect, useRef, useState } from 'react';

const ChatBox = ({ messages, onSend, isMobile }) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!inputText.trim()) return;
    onSend(inputText);
    setInputText('');
  };

  const containerStyle = {
    position: 'absolute',
    bottom: isMobile ? '8px' : '130px',
    left: isMobile ? '50%' : '20px',
    transform: isMobile ? 'translateX(-50%)' : 'none',
    width: isMobile ? '170px' : '260px',
    height: isMobile ? '78px' : '160px',
    display: 'flex',
    flexDirection: 'column',
    pointerEvents: 'auto',
    zIndex: 60,
    transition: 'all 0.3s ease',
  };

  const messageListStyle = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    background: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '8px',
    padding: isMobile ? '6px' : '8px',
    marginBottom: isMobile ? '6px' : '8px',
    color: 'white',
    fontSize: isMobile ? '10px' : '13px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maskImage: 'linear-gradient(to bottom, transparent, black 10%)',
  };

  const inputStyle = {
    background: 'rgba(0, 0, 0, 0.72)',
    border: '1px solid #555',
    borderRadius: '4px',
    padding: isMobile ? '6px 8px' : '6px 10px',
    color: 'white',
    fontSize: isMobile ? '16px' : '14px',
    outline: 'none',
    width: '100%',
  };

  return (
    <div style={containerStyle}>
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

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="Press Enter to chat..."
          style={inputStyle}
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
