// 환경설정 모달 — 전투 범위 슬라이더 + UI 토글
import React, { useState } from 'react';
import { DEFAULT_SETTINGS } from '@hooks/useGameSettings';

const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const ACCENT = '#67e8d6';
const GOLD = '#d0b16b';
const BORDER = 'rgba(124,171,166,0.35)';

const SectionTitle = ({ children }) => (
  <div style={{
    color: GOLD, fontSize: '9px', fontWeight: 700,
    letterSpacing: '1.5px', textTransform: 'uppercase',
    marginBottom: '10px', marginTop: '4px',
  }}>
    {children}
  </div>
);

const Divider = () => (
  <div style={{ borderTop: `1px solid rgba(100,130,120,0.2)`, margin: '12px 0' }} />
);

/** 슬라이더 행 */
const SliderRow = ({ label, value, min, max, step = 1, unit = '', onChange }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
      <span style={{ color: '#aabbb8', fontSize: '11px' }}>{label}</span>
      <span style={{ color: ACCENT, fontSize: '11px', fontWeight: 700 }}>
        {value}{unit}
      </span>
    </div>
    <input
      type="range"
      min={min} max={max} step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        width: '100%', accentColor: ACCENT, cursor: 'pointer',
        height: '4px',
      }}
    />
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
      <span style={{ color: '#3a4a48', fontSize: '9px' }}>{min}{unit}</span>
      <span style={{ color: '#3a4a48', fontSize: '9px' }}>{max}{unit}</span>
    </div>
  </div>
);

/** 토글 행 */
const ToggleRow = ({ label, desc, value, onChange }) => (
  <div
    onClick={() => onChange(!value)}
    style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 0', cursor: 'pointer',
      borderBottom: '1px solid rgba(60,80,70,0.25)',
    }}
  >
    <div>
      <div style={{ color: '#c0d0cc', fontSize: '11px' }}>{label}</div>
      {desc && <div style={{ color: '#445550', fontSize: '9px', marginTop: '1px' }}>{desc}</div>}
    </div>
    <div style={{
      width: '34px', height: '18px', borderRadius: '9px',
      background: value ? 'rgba(103,232,214,0.3)' : 'rgba(40,50,60,0.8)',
      border: `1px solid ${value ? ACCENT : 'rgba(80,100,100,0.4)'}`,
      position: 'relative', flexShrink: 0,
      transition: 'all 0.15s',
    }}>
      <div style={{
        position: 'absolute', top: '2px',
        left: value ? '17px' : '3px',
        width: '12px', height: '12px',
        borderRadius: '50%',
        background: value ? ACCENT : '#445',
        transition: 'left 0.15s',
        boxShadow: value ? `0 0 4px ${ACCENT}88` : 'none',
      }} />
    </div>
  </div>
);

const TABS = [
  { id: 'combat', label: '⚔️ 전투' },
  { id: 'ui',     label: '🖥 화면' },
];

const GameSettingsModal = ({ settings, onUpdate, onSave, onReset, onClose }) => {
  const [tab, setTab] = useState('combat');

  return (
    <div
      style={{
        position: 'absolute',
        top: `calc(max(10px, env(safe-area-inset-top)) + 36px)`,
        right: `calc(max(10px, env(safe-area-inset-right)) + 72px)`,
        width: '220px',
        borderRadius: '12px',
        background: 'linear-gradient(180deg, rgba(10,16,24,0.97), rgba(6,10,18,0.97))',
        border: `1px solid ${BORDER}`,
        boxShadow: '0 0 18px rgba(103,232,214,0.12), 0 4px 24px rgba(0,0,0,0.65)',
        pointerEvents: 'auto',
        zIndex: 63,
        fontFamily: GAME_FONT,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* 헤더 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px 8px',
        borderBottom: `1px solid rgba(100,160,150,0.2)`,
      }}>
        <span style={{ color: GOLD, fontWeight: 700, fontSize: '12px', letterSpacing: '0.5px' }}>
          ⚙ 환경설정
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#556', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}
        >×</button>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: `1px solid rgba(100,160,150,0.15)` }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '7px 4px',
              background: tab === t.id ? 'rgba(103,232,214,0.1)' : 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? `2px solid ${ACCENT}` : '2px solid transparent',
              color: tab === t.id ? ACCENT : '#557',
              fontSize: '10px', cursor: 'pointer',
              fontFamily: GAME_FONT,
              transition: 'all 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div style={{ padding: '12px 14px', maxHeight: '60vh', overflowY: 'auto' }}>

        {tab === 'combat' && (
          <>
            <SectionTitle>자동사냥</SectionTitle>
            <SliderRow
              label="타겟 탐색 반경"
              value={settings.autoFarmRange}
              min={20} max={120} step={5} unit=" u"
              onChange={v => onUpdate('autoFarmRange', v)}
            />
            <SliderRow
              label="자동공격 사정거리"
              value={settings.autoAttackRange}
              min={10} max={60} step={5} unit=" u"
              onChange={v => onUpdate('autoAttackRange', v)}
            />
            <div style={{ color: '#3a5550', fontSize: '10px', marginTop: '4px', lineHeight: 1.5 }}>
              * 탐색 반경: 자동사냥 ON 시 이 거리 안의 몬스터만 타겟팅<br />
              * 사정거리: 이 거리 이내일 때만 마법 구체 발사
            </div>
          </>
        )}

        {tab === 'ui' && (
          <>
            <SectionTitle>화면 표시</SectionTitle>
            <ToggleRow
              label="스탯 패널"
              desc="좌상단 HP/MP/EXP 창"
              value={settings.showStatPanel}
              onChange={v => onUpdate('showStatPanel', v)}
            />
            <ToggleRow
              label="미니맵"
              desc="우상단 지도 표시"
              value={settings.showMinimap}
              onChange={v => onUpdate('showMinimap', v)}
            />
            <ToggleRow
              label="채팅창"
              desc="하단 채팅 영역"
              value={settings.showChat}
              onChange={v => onUpdate('showChat', v)}
            />
            <ToggleRow
              label="조이스틱"
              desc="이동/스킬 조이스틱"
              value={settings.showJoystick}
              onChange={v => onUpdate('showJoystick', v)}
            />
            <ToggleRow
              label="아이템 알림"
              desc="획득 아이템 팝업"
              value={settings.showItemNotif}
              onChange={v => onUpdate('showItemNotif', v)}
            />
            <ToggleRow
              label="지역명 표시"
              desc="구/동 이름 팝업"
              value={settings.showRegionTitle}
              onChange={v => onUpdate('showRegionTitle', v)}
            />
          </>
        )}
      </div>

      {/* 푸터 */}
      <div style={{
        padding: '8px 14px 10px',
        borderTop: `1px solid rgba(100,160,150,0.15)`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: '6px',
      }}>
        <button
          onClick={onReset}
          style={{
            background: 'rgba(200,60,60,0.1)', border: '1px solid rgba(200,60,60,0.3)',
            borderRadius: '6px', color: '#f87171', fontSize: '10px',
            padding: '4px 9px', cursor: 'pointer', fontFamily: GAME_FONT,
          }}
        >
          초기화
        </button>
        <button
          onClick={() => onSave?.()}
          style={{
            background: 'rgba(103,232,214,0.12)', border: '1px solid rgba(103,232,214,0.35)',
            borderRadius: '6px', color: ACCENT, fontSize: '10px', fontWeight: 700,
            padding: '4px 12px', cursor: 'pointer', fontFamily: GAME_FONT,
          }}
        >
          💾 저장
        </button>
      </div>
    </div>
  );
};

export default GameSettingsModal;
