import React, { useCallback } from 'react';
import { SKILL_CATALOG } from '@data/skillCatalog';
import { PANEL_BG, BORDER_COLOR, GOLD, ACCENT, GLOW } from '@ui/overlay/overlayConstants';

/**
 * 스킬 목록 패널 — 드래그로 퀵슬롯에 배치
 */
const SkillPanel = ({
  playerLevel = 1,
  onClose,
  isMobile = false,
}) => {
  const handleDragStart = useCallback((e, skillId) => {
    e.dataTransfer.setData('skillId', skillId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const skills = Object.entries(SKILL_CATALOG);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: isMobile ? 150 : 90,
        left: '50%',
        transform: 'translateX(-50%)',
        width: isMobile ? 280 : 340,
        background: PANEL_BG,
        backdropFilter: 'blur(16px)',
        border: `1px solid ${BORDER_COLOR}`,
        borderRadius: 12,
        boxShadow: GLOW,
        padding: '12px',
        pointerEvents: 'auto',
        zIndex: 120,
      }}
    >
      {/* 헤더 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
      }}>
        <span style={{ color: GOLD, fontWeight: 700, fontSize: 13, letterSpacing: '0.5px' }}>
          스킬 목록
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#aaa',
            fontSize: 16,
            cursor: 'pointer',
            lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {skills.map(([skillId, skill]) => {
          const locked = skill.levelReq > playerLevel;
          return (
            <div
              key={skillId}
              draggable={!locked}
              onDragStart={locked ? undefined : (e) => handleDragStart(e, skillId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 8px',
                borderRadius: 8,
                background: locked ? 'rgba(20,20,30,0.5)' : 'rgba(40,60,50,0.4)',
                border: `1px solid ${locked ? 'rgba(80,80,100,0.3)' : 'rgba(80,160,120,0.35)'}`,
                opacity: locked ? 0.5 : 1,
                cursor: locked ? 'not-allowed' : 'grab',
                userSelect: 'none',
              }}
            >
              {/* 아이콘 */}
              <span style={{ fontSize: 22, lineHeight: 1, minWidth: 28, textAlign: 'center' }}>
                {skill.icon}
              </span>

              {/* 정보 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: locked ? '#888' : ACCENT, fontWeight: 600, fontSize: 12 }}>
                    {skill.nameKo}
                  </span>
                  {locked && (
                    <span style={{ color: '#888', fontSize: 10 }}>Lv.{skill.levelReq} 필요</span>
                  )}
                </div>
                <div style={{ color: 'rgba(180,200,190,0.75)', fontSize: 10, marginTop: 1 }}>
                  {skill.desc}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                  <span style={{ color: '#60a5fa', fontSize: 10 }}>MP {skill.mpCost}</span>
                  <span style={{ color: '#a78bfa', fontSize: 10 }}>CD {(skill.cooldownMs / 1000).toFixed(1)}s</span>
                  <span style={{ color: '#fbbf24', fontSize: 10 }}>사거리 {skill.range}m</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 8, color: 'rgba(160,180,160,0.5)', fontSize: 10, textAlign: 'center' }}>
        드래그하여 퀵슬롯에 배치
      </div>
    </div>
  );
};

export default SkillPanel;
