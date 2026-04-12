import React, { useCallback } from 'react';
import { SKILL_CATALOG, HOTBAR_KEYS } from '@data/skillCatalog';
import { PANEL_BG, BORDER_COLOR, GLOW } from '@ui/overlay/overlayConstants';

/**
 * 스킬 퀵슬롯 바
 * - 4슬롯 + 쿨다운 sweep 오버레이
 * - MP 부족 시 슬롯 반투명
 * - onSlotDrop: 스킬 패널에서 드래그 교체 (데스크탑)
 * - onSlotPress/onSlotRelease: 모바일 터치 시 키 시뮬레이션
 */
const SkillHotbar = ({
  slots,
  getCooldownFraction,
  canUse,
  onSlotDrop,
  onSlotPress,    // (slotIdx) => void — 모바일 pointerDown
  onSlotRelease,  // (slotIdx) => void — 모바일 pointerUp
  mp = 100,
  maxMp = 100,
  isMobile = false,
  style = {},     // 위치는 외부에서 주입
}) => {
  const slotSize = isMobile ? 48 : 56;
  const gap = isMobile ? 7 : 8;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = useCallback((e, slotIdx) => {
    e.preventDefault();
    const skillId = e.dataTransfer.getData('skillId');
    if (skillId) onSlotDrop?.(slotIdx, skillId);
  }, [onSlotDrop]);

  return (
    <div style={{ display: 'flex', gap: `${gap}px`, pointerEvents: 'auto', ...style }}>
      {slots.map((skillId, idx) => {
        const skill = skillId ? SKILL_CATALOG[skillId] : null;
        const frac = skillId ? getCooldownFraction(idx) : 0;
        const ready = skillId ? canUse(idx) : false;
        const mpShort = skill ? mp < skill.mpCost : false;

        return (
          <div
            key={idx}
            draggable={!isMobile && !!skillId}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, idx)}
            onPointerDown={onSlotPress ? () => onSlotPress(idx) : undefined}
            onPointerUp={onSlotRelease ? () => onSlotRelease(idx) : undefined}
            onPointerCancel={onSlotRelease ? () => onSlotRelease(idx) : undefined}
            onPointerLeave={onSlotRelease ? () => onSlotRelease(idx) : undefined}
            style={{
              position: 'relative',
              width: slotSize,
              height: slotSize,
              borderRadius: 10,
              background: skill ? PANEL_BG : 'rgba(10,16,12,0.5)',
              border: `1px solid ${
                ready ? 'rgba(100,220,200,0.6)'
                : skill ? BORDER_COLOR
                : 'rgba(60,80,60,0.25)'
              }`,
              boxShadow: ready ? GLOW : 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              opacity: mpShort ? 0.45 : 1,
              cursor: isMobile ? 'pointer' : (skill ? 'default' : 'copy'),
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {skill ? (
              <>
                {/* 스킬 아이콘 */}
                <span style={{ fontSize: isMobile ? 20 : 24, lineHeight: 1 }}>{skill.icon}</span>
                {/* 키 바인딩 */}
                <span style={{ fontSize: isMobile ? 8 : 9, color: 'rgba(200,220,200,0.6)', marginTop: 1 }}>
                  {HOTBAR_KEYS[idx]}
                </span>
              </>
            ) : (
              <>
                {/* 빈 슬롯 */}
                <span style={{ fontSize: 14, color: 'rgba(100,130,100,0.35)', lineHeight: 1 }}>+</span>
                <span style={{ fontSize: isMobile ? 8 : 9, color: 'rgba(100,130,100,0.3)', marginTop: 1 }}>
                  {HOTBAR_KEYS[idx]}
                </span>
              </>
            )}

            {/* 쿨다운 sweep (conic-gradient) */}
            {frac > 0 && (
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 10,
                background: `conic-gradient(
                  rgba(0,0,0,0.68) 0deg,
                  rgba(0,0,0,0.68) ${frac * 360}deg,
                  transparent ${frac * 360}deg
                )`,
                pointerEvents: 'none',
              }} />
            )}

            {/* MP 부족 */}
            {mpShort && (
              <div style={{
                position: 'absolute',
                bottom: 2,
                right: 3,
                fontSize: 8,
                color: '#88aaff',
                fontWeight: 700,
              }}>
                MP
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default SkillHotbar;
