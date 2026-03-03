import React, { useState, useEffect } from 'react';
import { Html } from '@react-three/drei';

const PlayerChat = ({ chat }) => {
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (chat && chat.timestamp) {
      setShowChat(true);
      const timer = setTimeout(() => setShowChat(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [chat]);

  if (!showChat) return null;

  return (
    <Html position={[0, 4.0, 0]} center>
      <div style={{
        background: 'white',
        color: 'black',
        padding: '8px 12px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        border: '2px solid #333',
        position: 'relative',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        animation: 'popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        zIndex: 100
      }}>
        {chat.message}
        <div style={{
          position: 'absolute',
          bottom: '-6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '6px solid white'
        }}></div>
      </div>
      <style>{`
        @keyframes popIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </Html>
  );
};

export default PlayerChat;
