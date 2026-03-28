// 게임 도감 오버레이 — 몬스터/아이템/스킬/월드 정보
import React, { useEffect, useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import monsterApi from '@api/monster';

const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const PANEL_BG = 'linear-gradient(180deg, rgba(5,11,18,0.99), rgba(8,14,22,0.98))';
const BORDER = 'rgba(124, 171, 166, 0.35)';
const GOLD = '#d0b16b';
const ACCENT = '#67e8d6';

const TIER_COLOR  = { boss: '#ff4444', elite: '#ff9900', normal: '#67e8d6' };
const TIER_LABEL  = { boss: 'BOSS',    elite: 'ELITE',   normal: 'NORMAL' };
const PROP_COLOR  = {
  fire: '#ff6b35', water: '#38bdf8', forest: '#4ade80',
  stone: '#a8a29e', dark: '#a78bfa', magic: '#e879f9', earth: '#ca8a04',
};
const PROP_LABEL  = {
  fire: '불꽃', water: '물', forest: '숲', stone: '돌',
  dark: '어둠', magic: '마법', earth: '대지',
};

const CODEX_TABS = [
  { id: 'monster', label: '몬스터', emoji: '⚔️' },
  { id: 'item',    label: '아이템', emoji: '🎒' },
  { id: 'skill',   label: '스킬',   emoji: '✨' },
  { id: 'world',   label: '월드',   emoji: '🗺️' },
];

/** 몬스터 상세 모달 */
const MonsterDetail = ({ monster, onBack }) => {
  const tier = monster.tier || 'normal';
  const tc = TIER_COLOR[tier];
  const pc = PROP_COLOR[monster.property_type] || '#aaa';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <button
        onClick={onBack}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: '12px', marginBottom: '16px', padding: 0, fontFamily: GAME_FONT }}
      >
        ← 목록으로
      </button>

      {/* 헤더 */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: '14px', flexShrink: 0,
          background: `linear-gradient(135deg, ${tc}22, ${tc}44)`,
          border: `2px solid ${tc}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '40px',
        }}>
          {monster.icon_emoji || '👾'}
        </div>
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '4px', border: `1px solid ${tc}`, color: tc, background: `${tc}18` }}>
              {TIER_LABEL[tier]}
            </span>
            <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '4px', border: `1px solid ${pc}`, color: pc, background: `${pc}18` }}>
              {PROP_LABEL[monster.property_type] || monster.property_type}
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#fff', lineHeight: 1.2 }}>{monster.name_ko}</div>
          <div style={{ fontSize: '11px', color: '#6a9a94', marginTop: '2px' }}>{monster.name_en} · #{String(monster.id).padStart(3, '0')}</div>
        </div>
      </div>

      {/* 스탯 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: 'HP',     value: monster.base_hp?.toLocaleString(), color: '#ef4444' },
          { label: 'EXP',    value: `+${monster.base_exp}`,             color: '#fbbf24' },
          { label: '서식지', value: monster.origin_region || '-',       color: '#c084fc' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: '9px', color: '#6a9a94', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 설명 */}
      {monster.description && (
        <div style={{ fontSize: '11px', color: '#9ca3af', lineHeight: 1.8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${BORDER}`, marginBottom: '16px' }}>
          {monster.description}
        </div>
      )}

      {/* 드롭 아이템 */}
      {monster.drop_items?.length > 0 && (
        <div>
          <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1.5px', marginBottom: '8px' }}>DROP ITEMS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {monster.drop_items.map((drop, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'rgba(255,255,255,0.04)',
                borderRadius: '8px', border: `1px solid ${BORDER}`,
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{drop.icon}</span>
                  <span style={{ fontSize: '12px', color: '#e2e8f0' }}>{drop.item}</span>
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: '700',
                  color: drop.rate >= 1 ? '#4ade80' : drop.rate >= 0.5 ? GOLD : '#94a3b8',
                }}>
                  {drop.rate >= 1 ? '100%' : `${Math.round(drop.rate * 100)}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** 몬스터 목록 그리드 */
const MonsterList = ({ onSelect }) => {
  const [monsters, setMonsters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    monsterApi.getAllTemplates()
      .then(res => setMonsters(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tiers = ['all', 'normal', 'elite', 'boss'];
  const filtered = filter === 'all' ? monsters : monsters.filter(m => m.tier === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 필터 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {tiers.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
            border: `1px solid ${filter === t ? TIER_COLOR[t] || ACCENT : BORDER}`,
            background: filter === t ? `${TIER_COLOR[t] || ACCENT}20` : 'transparent',
            color: filter === t ? (TIER_COLOR[t] || ACCENT) : '#8ca6a0',
            fontFamily: GAME_FONT,
          }}>
            {t === 'all' ? 'ALL' : TIER_LABEL[t]}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4a6a66', alignSelf: 'center' }}>
          {filtered.length} / {monsters.length}
        </span>
      </div>

      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a66', fontSize: '13px' }}>
          불러오는 중...
        </div>
      )}

      {/* 몬스터 카드 그리드 */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', paddingRight: '4px' }}>
        {filtered.map(m => {
          const tc = TIER_COLOR[m.tier] || ACCENT;
          const pc = PROP_COLOR[m.property_type] || '#aaa';
          return (
            <div
              key={m.id}
              onClick={() => onSelect(m)}
              style={{
                padding: '12px 10px',
                background: `linear-gradient(160deg, rgba(8,14,22,0.9), ${tc}0d)`,
                border: `1px solid ${tc}44`,
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              }}
              onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${tc}bb`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${tc}44`; e.currentTarget.style.transform = 'none'; }}
            >
              {/* 이모지 아바타 */}
              <div style={{
                width: '52px', height: '52px', borderRadius: '10px',
                background: `linear-gradient(135deg, ${tc}20, ${tc}38)`,
                border: `1px solid ${tc}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px',
              }}>
                {m.icon_emoji || '👾'}
              </div>

              {/* 이름 */}
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#e2e8f0', textAlign: 'center', lineHeight: 1.3 }}>
                {m.name_ko}
              </div>
              <div style={{ fontSize: '9px', color: '#5a7a74' }}>{m.name_en}</div>

              {/* 배지 행 */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '3px', border: `1px solid ${tc}66`, color: tc }}>
                  {TIER_LABEL[m.tier]}
                </span>
                <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '3px', border: `1px solid ${pc}66`, color: pc }}>
                  {PROP_LABEL[m.property_type] || m.property_type}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '9px', color: '#6a9a94', marginTop: '2px' }}>
                <span>HP {m.base_hp?.toLocaleString()}</span>
                <span>+{m.base_exp} EXP</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** 준비 중 탭 */
const ComingSoon = ({ label }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#2a4a44', gap: '12px' }}>
    <div style={{ fontSize: '48px', opacity: 0.4 }}>🚧</div>
    <div style={{ fontSize: '14px' }}>{label} — 준비 중</div>
  </div>
);

/** 도감 메인 오버레이 */
const GameCodex = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('monster');
  const [selectedMonster, setSelectedMonster] = useState(null);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.88)',
      zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'auto',
    }}>
      <div style={{
        width: 'min(680px, 92vw)',
        height: 'min(560px, 88vh)',
        background: PANEL_BG,
        border: `1px solid ${BORDER}`,
        borderRadius: '18px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 0 48px rgba(103,232,214,0.08)',
        fontFamily: GAME_FONT,
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📖</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: GOLD, letterSpacing: '2px' }}>GAME CODEX</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={18} color='#5a7a74' />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* 왼쪽 탭 메뉴 */}
          <div style={{ width: '90px', borderRight: `1px solid ${BORDER}`, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
            {CODEX_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedMonster(null); }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                  padding: '10px 6px', margin: '0 8px', borderRadius: '8px',
                  background: activeTab === tab.id ? 'rgba(103,232,214,0.1)' : 'transparent',
                  border: `1px solid ${activeTab === tab.id ? ACCENT : 'transparent'}`,
                  cursor: 'pointer', color: activeTab === tab.id ? ACCENT : '#4a6a64',
                }}
              >
                <span style={{ fontSize: '20px' }}>{tab.emoji}</span>
                <span style={{ fontSize: '9px', fontFamily: GAME_FONT }}>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* 오른쪽 콘텐츠 */}
          <div style={{ flex: 1, padding: '16px 18px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'monster' && (
              selectedMonster
                ? <MonsterDetail monster={selectedMonster} onBack={() => setSelectedMonster(null)} />
                : <MonsterList onSelect={setSelectedMonster} />
            )}
            {activeTab === 'item'  && <ComingSoon label="아이템 도감" />}
            {activeTab === 'skill' && <ComingSoon label="스킬 도감" />}
            {activeTab === 'world' && <ComingSoon label="월드 정보" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCodex;
