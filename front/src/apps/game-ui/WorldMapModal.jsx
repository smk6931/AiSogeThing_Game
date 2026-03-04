
import React from 'react';
import { MAPS } from '@world/mapConfig';

const WorldMapModal = ({ isOpen, onClose, onSelectMap }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      zIndex: 200, // Joystick(90)보다 높게
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      padding: '20px'
    }}>
      {/* Background/Close Area */}
      <div
        style={{ position: 'absolute', inset: 0 }}
        onClick={onClose}
      />

      <div style={{
        position: 'relative',
        background: '#1a1a2e',
        border: '2px solid #4a4a6a',
        borderRadius: '16px',
        padding: '24px',
        maxWidth: '90%',
        maxHeight: '90%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: '0 0 40px rgba(0,0,0,0.5)'
      }}>

        <h2 style={{ marginBottom: '20px', color: '#ffcc00', textShadow: '0 0 10px rgba(255, 204, 0, 0.5)' }}>
          WORLD MAP
        </h2>

        {/* Map Image Section */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '600px',
          marginBottom: '20px',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #333',
          flexShrink: 0 // [Fix] 화면이 작아도 이미지 찌그러짐 방지
        }}>
          <img
            src="/images/image.png"
            alt="World Map"
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>

        {/* Map List / Buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '12px',
          width: '100%',
          maxWidth: '800px'
        }}>
          {Object.values(MAPS).map((map) => (
            <button
              key={map.id}
              onClick={() => onSelectMap(map.id)}
              style={{
                background: '#2a2a4e',
                border: '1px solid #5a5a8a',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#3a3a6e'}
              onMouseLeave={e => e.currentTarget.style.background = '#2a2a4e'}
            >
              <img
                src={map.texture}
                alt={map.name}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '4px',
                  objectFit: 'cover',
                  border: '1px solid #5a5a8a'
                }}
              />
              <span>{map.name}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: '20px',
            background: 'transparent',
            border: '1px solid #aaa',
            color: '#aaa',
            padding: '8px 24px',
            borderRadius: '20px',
            cursor: 'pointer'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default WorldMapModal;
