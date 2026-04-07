import React, { memo } from 'react';
import { PANEL_BG, BORDER_COLOR, GOLD, ACCENT, GLOW } from './overlayConstants';

const StatusPanel = ({
  playerStats,
  isMobile,
  uiScale,
  topPanelWidth,
  topPanelPadding,
  isAutoMode,
  onInventoryOpen,
  onAutoModeToggle,
}) => {
  const expForLevel = (lv) => lv <= 1 ? 0 : (lv - 1) * lv * 50;
  const maxExp = expForLevel(playerStats.level + 1);
  const hpPct = Math.max(0, Math.min(100, (playerStats.hp / playerStats.maxHp) * 100));
  const mpPct = Math.max(0, Math.min(100, (playerStats.mp / playerStats.maxMp) * 100));
  const expPct = maxExp > 0 ? Math.max(0, Math.min(100, (playerStats.exp / maxExp) * 100)) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 'max(10px, env(safe-area-inset-top))',
        left: 'max(10px, env(safe-area-inset-left))',
        width: topPanelWidth,
        padding: topPanelPadding,
        borderRadius: isMobile ? '10px' : '12px',
        background: PANEL_BG,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${BORDER_COLOR}`,
        boxShadow: GLOW,
        transformOrigin: 'top left',
        transform: isMobile ? 'none' : `scale(${uiScale})`,
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', marginBottom: isMobile ? '6px' : '8px' }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, ${GOLD})`,
            color: '#081015',
            fontWeight: 'bold',
            borderRadius: '50%',
            width: isMobile ? '18px' : '28px',
            height: isMobile ? '18px' : '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isMobile ? '10px' : '13px',
          }}
        >
          {playerStats.level}
        </div>
        <span style={{ color: GOLD, fontWeight: '700', fontSize: isMobile ? '9px' : '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {playerStats.nickname}
        </span>
      </div>

      <div style={{ marginBottom: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '8px' : '11px', color: '#aaa' }}>
          <span style={{ color: '#ff6b6b' }}>HP</span>
          <span>{playerStats.hp}/{playerStats.maxHp}</span>
        </div>
        <div style={{ height: isMobile ? '6px' : '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${hpPct}%`, height: '100%', background: 'linear-gradient(90deg, #b91c1c, #ef4444)' }} />
        </div>
      </div>

      <div style={{ marginBottom: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '8px' : '11px', color: '#aaa' }}>
          <span style={{ color: '#60a5fa' }}>MP</span>
          <span>{playerStats.mp}/{playerStats.maxMp}</span>
        </div>
        <div style={{ height: isMobile ? '6px' : '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${mpPct}%`, height: '100%', background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)' }} />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '7px' : '10px', color: '#aaa', marginBottom: '2px' }}>
          <span style={{ color: '#a78bfa' }}>EXP</span>
          <span style={{ color: '#c4b5fd' }}>{playerStats.exp}/{maxExp}</span>
        </div>
        <div style={{ height: isMobile ? '4px' : '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${expPct}%`, height: '100%', background: 'linear-gradient(90deg, #6d28d9, #8b5cf6)', transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
          {!isMobile && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={onInventoryOpen}
                style={{
                  background: 'rgba(30,50,40,0.8)',
                  border: '1px solid rgba(100,160,120,0.4)',
                  borderRadius: '5px',
                  color: '#67e8d6',
                  fontSize: '10px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  fontFamily: 'inherit',
                }}
              >
                인벤 [I]
              </button>
              <button
                onClick={onAutoModeToggle}
                style={{
                  background: isAutoMode ? 'rgba(255,120,30,0.25)' : 'rgba(30,30,50,0.8)',
                  border: `1px solid ${isAutoMode ? 'rgba(255,140,50,0.7)' : 'rgba(80,80,120,0.4)'}`,
                  borderRadius: '5px',
                  color: isAutoMode ? '#ffaa44' : '#778',
                  fontSize: '10px',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  fontFamily: 'inherit',
                  fontWeight: isAutoMode ? 700 : 400,
                  boxShadow: isAutoMode ? '0 0 6px rgba(255,140,50,0.4)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {isAutoMode ? '⚔ 자동ON' : '자동 [Z]'}
              </button>
            </div>
          )}
          <span style={{ fontSize: isMobile ? '8px' : '9px', color: GOLD, marginLeft: isMobile ? 'auto' : 0 }}>
            {playerStats.gold}G
          </span>
        </div>
      </div>
    </div>
  );
};

export default memo(StatusPanel);
