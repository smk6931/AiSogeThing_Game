import React, { useState, useEffect } from 'react';
import { useGameConfig } from './GameConfigContext';
import client from '@api/client';

const EditorOverlay = () => {
  const { hdriUrl, setHdriUrl, moveSpeed, setMoveSpeed } = useGameConfig();

  const [inputValue, setInputValue] = useState(hdriUrl);
  const [hdriList, setHdriList] = useState([]);

  // 백엔드에서 HDRI 파일 목록 가져오기
  useEffect(() => {
    client.get('/api/game/hdri-list')
      .then(res => {
        if (res.data && res.data.files) {
          setHdriList(res.data.files);
        }
      })
      .catch(err => console.error('Failed to load HDRI list:', err));
  }, []);


  // 외부(GameConfigContext)에서 hdriUrl이 변경되면 inputValue도 업데이트
  useEffect(() => {
    setInputValue(hdriUrl);
  }, [hdriUrl]);

  // 수동 입력 후 버튼 클릭 시 서버에 영구 저장
  const handleApply = () => {
    client.post('/api/game/settings/hdri', { path: inputValue })
      .then(res => {
        if (res.data.status === 'success') {
          setHdriUrl(inputValue);
          console.log('HDRI setting saved to server!');
        }
      })
      .catch(err => {
        console.error('Failed to save HDRI setting:', err);
        alert('서버 저장 실패! 네트워크 상태를 확인하세요.');
      });
  };

  // 드롭다운 변경 시에도 즉시 서버 저장 (UX를 위해)
  const handleSelectChange = (e) => {
    const val = e.target.value;
    setInputValue(val);
    client.post('/api/game/settings/hdri', { path: val })
      .then(() => {
        setHdriUrl(val);
      })
      .catch(err => console.error('Failed to save HDRI selection:', err));
  };


  return (
    <div style={{
      position: 'absolute',
      top: 20,
      right: 20,
      width: '320px',
      padding: '20px',
      background: 'rgba(15, 15, 20, 0.85)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: 'white',
      zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      fontFamily: '"Cinzel", sans-serif'
    }}>
      <h3 style={{ margin: '0 0 15px 0', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '10px' }}>
        Game Editor Mode
      </h3>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', fontSize: '13px', opacity: 0.9, marginBottom: '8px' }}>
          Select Environment HDRI
        </label>

        {/* 드롭다운 셀렉트 박스 */}
        <select
          value={inputValue}
          onChange={handleSelectChange}
          style={{
            width: '100%',
            padding: '10px',
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#d4af37', // 판타지 테마의 황금색
            borderRadius: '6px',
            marginBottom: '10px',
            outline: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'inherit'
          }}
        >
          {hdriList.length === 0 && (
            <option value="" disabled>Loading or No Files Found...</option>
          )}
          {hdriList.map((file, idx) => (
            <option key={idx} value={file.value}>
              {file.label}
            </option>
          ))}
        </select>

        {/* 수동 경로 입력 (직접 외부 URL이나 다른 폴더를 지정하고 싶을 때) */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="/assets/hdri/your_file.exr"
          style={{
            width: '100%',
            padding: '8px',
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#aaa',
            borderRadius: '4px',
            marginBottom: '10px',
            fontSize: '11px',
            boxSizing: 'border-box'
          }}
        />

        <button
          onClick={handleApply}
          style={{
            width: '100%',
            padding: '10px',
            background: 'linear-gradient(135deg, #d4af37, #b8860b)',
            border: 'none',
            color: '#000',
            fontWeight: 'bold',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            boxSizing: 'border-box'
          }}
          onMouseOver={(e) => e.target.style.opacity = '0.8'}
          onMouseOut={(e) => e.target.style.opacity = '1'}
        >
          Apply Custom Path
        </button>
      </div>

      {/* ===== 이동 속도 조절 섹션 ===== */}
      <div style={{ marginBottom: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
        <label style={{ display: 'block', fontSize: '13px', opacity: 0.9, marginBottom: '10px' }}>
          Movement Speed (Expediting)
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button
            onClick={() => setMoveSpeed(prev => Math.max(5, prev - 5))}
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', fontSize: '20px', cursor: 'pointer'
            }}
          >-</button>

          <div style={{
            flex: 1, textAlign: 'center', fontSize: '22px', fontWeight: 'bold',
            color: moveSpeed >= 40 ? '#ff4d4d' : '#d4af37',
            textShadow: '0 0 10px rgba(212, 175, 55, 0.4)'
          }}>
            {moveSpeed.toFixed(0)}
          </div>

          <button
            onClick={() => setMoveSpeed(prev => Math.min(50, prev + 5))}
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: 'white', fontSize: '20px', cursor: 'pointer'
            }}
          >+</button>
        </div>
        <p style={{ fontSize: '10px', opacity: 0.5, marginTop: '8px', textAlign: 'center' }}>
          * Max Speed <span style={{ color: '#ff4d4d' }}>50</span> is like a race car!
        </p>
      </div>


      <p style={{ fontSize: '11px', opacity: 0.5, margin: 0, lineHeight: 1.4 }}>
        * Drop .exr or .hdr files into <br />
        <span style={{ color: '#d4af37', fontWeight: 'bold' }}>front/public/assets/hdri/</span><br />
        folder and reload the page to see them in the list.
      </p>
    </div>
  );
};

export default EditorOverlay;
