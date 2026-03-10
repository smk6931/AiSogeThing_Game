
import React, { useState, useRef } from 'react';
import { MAPS } from '@entity/world/mapConfig';

const WorldMapModal = ({ isOpen, onClose, onSelectMap }) => {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleWheel = (e) => {
    const zoomFactor = 0.1;
    let newScale = e.deltaY < 0 ? scale + zoomFactor : scale - zoomFactor;
    // 최소 1배, 최대 5배 제한
    newScale = Math.max(1, Math.min(newScale, 5));
    setScale(newScale);

    // 축소해서 1배율이 되면 위치 중앙 정렬
    if (newScale === 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

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
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '600px',
            marginBottom: '20px',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '2px solid #5a5a8a',
            flexShrink: 0, // [Fix] 화면이 작아도 이미지 찌그러짐 방지
            aspectRatio: '1.2 / 1', // 지도 비율에 맞춰 고정
            background: '#f4f1ea', // [Fix] 이미지가 투명해서 뒷 배경(검은색)이 비쳐 일부 구가 까맣게 보였던 문제 해결 (카카오맵 기본 배경색 적용)
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          <img
            src="/images/image.png"
            alt="World Map"
            draggable={false} // 브라우저 고유의 이미지 드래그 고스트 방지
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
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
