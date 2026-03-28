// 몬스터 클릭 시 표시되는 정보 패널 (이름/티어/스탯/아이템 드롭)
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import monsterApi from '@api/monster';

const TIER_COLOR = { boss: '#ff4444', elite: '#ff9900', normal: '#67e8d6' };
const TIER_LABEL = { boss: 'BOSS', elite: 'ELITE', normal: 'NORMAL' };
const PANEL_BG = 'linear-gradient(180deg, rgba(5,11,18,0.97), rgba(8,14,22,0.96))';
const BORDER_COLOR = 'rgba(124, 171, 166, 0.45)';
const GOLD = '#d0b16b';
const ACCENT = '#67e8d6';
const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";

const MonsterInfoPanel = ({ monster, onClose }) => {
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!monster?.templateId) { setLoading(false); return; }
    monsterApi.getTemplate(monster.templateId)
      .then(res => setTemplate(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [monster?.templateId]);

  if (!monster) return null;

  const tier = monster.tier || 'normal';
  const tierColor = TIER_COLOR[tier] || ACCENT;
  const hpPct = monster.maxHp > 0 ? (monster.hp / monster.maxHp) * 100 : 0;
  const hpColor = hpPct > 50 ? '#4ade80' : hpPct > 20 ? '#fb923c' : '#ef4444';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '300px',
        background: PANEL_BG,
        border: `1px solid ${tierColor}`,
        borderRadius: '14px',
        padding: '16px',
        zIndex: 200,
        pointerEvents: 'auto',
        boxShadow: `0 0 24px ${tierColor}44`,
        fontFamily: GAME_FONT,
      }}
    >
      {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: '10px', right: '10px',
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
        }}
      >
        <X size={16} color='#888' />
      </button>

      {/* 티어 배지 + 이름 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{
          fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px',
          padding: '3px 7px', borderRadius: '4px',
          background: `${tierColor}22`, border: `1px solid ${tierColor}`, color: tierColor,
        }}>
          {TIER_LABEL[tier]}
        </span>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff', lineHeight: 1.2 }}>
            {template?.name_ko || (monster.tier === 'boss' ? '????' : `Monster #${monster.id}`)}
          </div>
          {template?.name_en && (
            <div style={{ fontSize: '10px', color: '#8ca6a0' }}>{template.name_en}</div>
          )}
        </div>
      </div>

      {/* HP 바 */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#aaa', marginBottom: '3px' }}>
          <span style={{ color: '#ff6b6b' }}>HP</span>
          <span>{monster.hp} / {monster.maxHp}</span>
        </div>
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${hpPct}%`, height: '100%', background: `linear-gradient(90deg, ${hpColor}99, ${hpColor})`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {loading && (
        <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '8px' }}>Loading...</div>
      )}

      {template && !loading && (
        <>
          {/* 스탯 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
            {[
              { label: 'EXP', value: `+${template.base_exp}`, color: '#fbbf24' },
              { label: 'Property', value: template.property_type || '-', color: ACCENT },
              { label: 'Region', value: template.origin_region || '-', color: '#c084fc' },
              { label: 'Scale', value: `×${template.model_scale}`, color: '#94a3b8' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                padding: '6px 8px', background: 'rgba(255,255,255,0.04)',
                borderRadius: '7px', border: `1px solid ${BORDER_COLOR}`,
              }}>
                <div style={{ fontSize: '9px', color: '#6a9a94', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: '12px', fontWeight: '700', color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* 설명 */}
          {template.description && (
            <div style={{
              fontSize: '10px', color: '#9ca3af', lineHeight: 1.6,
              padding: '8px', background: 'rgba(255,255,255,0.02)',
              borderRadius: '7px', border: `1px solid ${BORDER_COLOR}`,
              marginBottom: '12px',
            }}>
              {template.description}
            </div>
          )}

          {/* 드롭 아이템 */}
          {template.drop_items && template.drop_items.length > 0 && (
            <div>
              <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1px', marginBottom: '6px' }}>DROP ITEMS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {template.drop_items.map((drop, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '5px 8px', background: 'rgba(255,255,255,0.04)',
                    borderRadius: '6px', border: `1px solid ${BORDER_COLOR}`,
                  }}>
                    <span style={{ fontSize: '12px' }}>{drop.icon} <span style={{ fontSize: '11px', color: '#e2e8f0' }}>{drop.item}</span></span>
                    <span style={{ fontSize: '10px', color: drop.rate >= 1 ? '#4ade80' : drop.rate >= 0.5 ? GOLD : '#94a3b8' }}>
                      {drop.rate >= 1 ? '100%' : `${Math.round(drop.rate * 100)}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MonsterInfoPanel;
