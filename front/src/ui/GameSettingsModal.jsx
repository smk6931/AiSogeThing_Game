// 환경설정 모달 — 전투 범위 슬라이더 + UI 토글 + 몬스터 스폰 설정
import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_SETTINGS } from '@hooks/useGameSettings';
import monsterApi from '@api/monster';

const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const ACCENT = '#67e8d6';
const GOLD = '#d0b16b';
const BORDER = 'rgba(124,171,166,0.35)';

const TIER_COLOR = {
  normal: '#7ec8a0',
  elite:  '#8ba8e8',
  boss:   '#e87878',
};
const TIER_LABEL = {
  normal: 'N',
  elite:  'E',
  boss:   'B',
};

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

const SliderRow = ({ label, value, min, max, step = 1, unit = '', onChange }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
      <span style={{ color: '#aabbb8', fontSize: '11px' }}>{label}</span>
      <span style={{ color: ACCENT, fontSize: '11px', fontWeight: 700 }}>{value}{unit}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: '100%', accentColor: ACCENT, cursor: 'pointer', height: '4px' }}
    />
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
      <span style={{ color: '#3a4a48', fontSize: '9px' }}>{min}{unit}</span>
      <span style={{ color: '#3a4a48', fontSize: '9px' }}>{max}{unit}</span>
    </div>
  </div>
);

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
      position: 'relative', flexShrink: 0, transition: 'all 0.15s',
    }}>
      <div style={{
        position: 'absolute', top: '2px', left: value ? '17px' : '3px',
        width: '12px', height: '12px', borderRadius: '50%',
        background: value ? ACCENT : '#445',
        transition: 'left 0.15s',
        boxShadow: value ? `0 0 4px ${ACCENT}88` : 'none',
      }} />
    </div>
  </div>
);

// ── 몬스터 카드 ──────────────────────────────────────────────
const MonsterCard = ({ monster, enabled, onToggle }) => {
  const tier = monster.tier || 'normal';
  const tierColor = TIER_COLOR[tier] || '#aaa';
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 8px', borderRadius: '7px', cursor: 'pointer',
        background: enabled ? 'rgba(103,232,214,0.07)' : 'rgba(20,28,36,0.6)',
        border: `1px solid ${enabled ? 'rgba(103,232,214,0.3)' : 'rgba(60,80,80,0.25)'}`,
        marginBottom: '5px',
        transition: 'all 0.12s',
        opacity: enabled ? 1 : 0.55,
      }}
    >
      {/* 등급 배지 */}
      <div style={{
        width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
        background: enabled ? tierColor + '33' : 'rgba(40,50,60,0.8)',
        border: `1px solid ${enabled ? tierColor : 'rgba(80,100,100,0.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '9px', fontWeight: 700, color: enabled ? tierColor : '#445',
      }}>
        {TIER_LABEL[tier] || '?'}
      </div>
      {/* 이름 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: enabled ? '#c8ddd8' : '#556', fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {monster.name_ko} <span style={{ color: '#3a5550', fontWeight: 400 }}>({monster.name_en})</span>
        </div>
        <div style={{ color: '#3a5550', fontSize: '9px', marginTop: '1px' }}>
          HP {monster.base_hp?.toLocaleString()} · EXP {monster.base_exp}
        </div>
      </div>
      {/* 토글 점 */}
      <div style={{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        background: enabled ? ACCENT : '#2a3a38',
        boxShadow: enabled ? `0 0 5px ${ACCENT}88` : 'none',
        transition: 'all 0.12s',
      }} />
    </div>
  );
};

const TABS = [
  { id: 'combat',  label: '⚔️ 전투' },
  { id: 'ui',      label: '🖥 화면' },
  { id: 'monster', label: '🐉 몬스터' },
];

const GameSettingsModal = ({ settings, onUpdate, onSave, onReset, onClose }) => {
  const [tab, setTab] = useState('combat');
  const [allMonsters, setAllMonsters] = useState([]);
  const [enabledIds, setEnabledIds] = useState(null); // null = 전체
  const [spawnLoading, setSpawnLoading] = useState(false);
  const [spawnMsg, setSpawnMsg] = useState('');

  // 몬스터 탭 열릴 때 데이터 로드
  useEffect(() => {
    if (tab !== 'monster') return;
    Promise.all([
      monsterApi.getAllTemplates(),
      monsterApi.getSpawnConfig(),
    ]).then(([tmplRes, cfgRes]) => {
      setAllMonsters(tmplRes.data || []);
      const cfg = cfgRes.data;
      if (cfg.is_all || !cfg.enabled_template_ids?.length) {
        setEnabledIds(null);
      } else {
        setEnabledIds(new Set(cfg.enabled_template_ids));
      }
    }).catch(() => {});
  }, [tab]);

  const isEnabled = useCallback((id) => {
    if (enabledIds === null) return true;
    return enabledIds.has(id);
  }, [enabledIds]);

  const toggleMonster = useCallback((id) => {
    setEnabledIds(prev => {
      if (prev === null) {
        // 전체 → 이 몬스터만 OFF
        const next = new Set(allMonsters.map(m => m.id));
        next.delete(id);
        return next;
      }
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // 전체 선택되면 null로 복귀
      if (next.size === allMonsters.length) return null;
      return next;
    });
  }, [allMonsters]);

  const selectAll = () => setEnabledIds(null);
  const selectNone = () => setEnabledIds(new Set());

  const applySpawnConfig = async () => {
    setSpawnLoading(true);
    setSpawnMsg('');
    try {
      const ids = enabledIds === null ? [] : Array.from(enabledIds);
      await monsterApi.setSpawnConfig(ids);
      const respawnRes = await monsterApi.respawn();
      setSpawnMsg(`✓ ${respawnRes.data.spawned}마리 리스폰 완료`);
    } catch {
      setSpawnMsg('✗ 적용 실패');
    } finally {
      setSpawnLoading(false);
      setTimeout(() => setSpawnMsg(''), 3000);
    }
  };

  // 등급별 그룹핑
  const grouped = {
    boss:   allMonsters.filter(m => m.tier === 'boss'),
    elite:  allMonsters.filter(m => m.tier === 'elite'),
    normal: allMonsters.filter(m => m.tier === 'normal'),
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: `calc(max(10px, env(safe-area-inset-top)) + 36px)`,
        right: `calc(max(10px, env(safe-area-inset-right)) + 72px)`,
        width: '240px',
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
              flex: 1, padding: '7px 2px',
              background: tab === t.id ? 'rgba(103,232,214,0.1)' : 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? `2px solid ${ACCENT}` : '2px solid transparent',
              color: tab === t.id ? ACCENT : '#557',
              fontSize: '9px', cursor: 'pointer',
              fontFamily: GAME_FONT, transition: 'all 0.12s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      <div style={{ padding: '12px 14px', maxHeight: '65vh', overflowY: 'auto' }}>

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
            <ToggleRow label="스탯 패널" desc="좌상단 HP/MP/EXP 창" value={settings.showStatPanel} onChange={v => onUpdate('showStatPanel', v)} />
            <ToggleRow label="미니맵" desc="우상단 지도 표시" value={settings.showMinimap} onChange={v => onUpdate('showMinimap', v)} />
            <ToggleRow label="채팅창" desc="하단 채팅 영역" value={settings.showChat} onChange={v => onUpdate('showChat', v)} />
            <ToggleRow label="조이스틱" desc="이동/스킬 조이스틱" value={settings.showJoystick} onChange={v => onUpdate('showJoystick', v)} />
            <ToggleRow label="아이템 알림" desc="획득 아이템 팝업" value={settings.showItemNotif} onChange={v => onUpdate('showItemNotif', v)} />
            <ToggleRow label="지역명 표시" desc="구/동 이름 팝업" value={settings.showRegionTitle} onChange={v => onUpdate('showRegionTitle', v)} />
          </>
        )}

        {tab === 'monster' && (
          <>
            <SectionTitle>스폰 몬스터 설정</SectionTitle>

            {/* 전체/해제 버튼 */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <button
                onClick={selectAll}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: '5px', cursor: 'pointer', fontSize: '9px',
                  background: enabledIds === null ? 'rgba(103,232,214,0.15)' : 'transparent',
                  border: `1px solid ${enabledIds === null ? ACCENT : 'rgba(80,100,100,0.3)'}`,
                  color: enabledIds === null ? ACCENT : '#557',
                  fontFamily: GAME_FONT,
                }}
              >전체 선택</button>
              <button
                onClick={selectNone}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: '5px', cursor: 'pointer', fontSize: '9px',
                  background: 'transparent',
                  border: '1px solid rgba(80,100,100,0.3)',
                  color: '#557', fontFamily: GAME_FONT,
                }}
              >전체 해제</button>
            </div>

            {allMonsters.length === 0 && (
              <div style={{ color: '#3a5550', fontSize: '10px', textAlign: 'center', padding: '16px 0' }}>
                로딩 중...
              </div>
            )}

            {/* 보스 */}
            {grouped.boss.length > 0 && (
              <>
                <div style={{ color: TIER_COLOR.boss, fontSize: '9px', fontWeight: 700, letterSpacing: '1px', marginBottom: '6px' }}>
                  ◆ BOSS
                </div>
                {grouped.boss.map(m => (
                  <MonsterCard key={m.id} monster={m} enabled={isEnabled(m.id)} onToggle={() => toggleMonster(m.id)} />
                ))}
                <Divider />
              </>
            )}

            {/* 엘리트 */}
            {grouped.elite.length > 0 && (
              <>
                <div style={{ color: TIER_COLOR.elite, fontSize: '9px', fontWeight: 700, letterSpacing: '1px', marginBottom: '6px' }}>
                  ◇ ELITE
                </div>
                {grouped.elite.map(m => (
                  <MonsterCard key={m.id} monster={m} enabled={isEnabled(m.id)} onToggle={() => toggleMonster(m.id)} />
                ))}
                <Divider />
              </>
            )}

            {/* 일반 */}
            {grouped.normal.length > 0 && (
              <>
                <div style={{ color: TIER_COLOR.normal, fontSize: '9px', fontWeight: 700, letterSpacing: '1px', marginBottom: '6px' }}>
                  · NORMAL
                </div>
                {grouped.normal.map(m => (
                  <MonsterCard key={m.id} monster={m} enabled={isEnabled(m.id)} onToggle={() => toggleMonster(m.id)} />
                ))}
              </>
            )}

            {/* 적용 버튼 + 결과 메시지 */}
            <div style={{ marginTop: '12px' }}>
              {spawnMsg && (
                <div style={{
                  color: spawnMsg.startsWith('✓') ? ACCENT : '#f87171',
                  fontSize: '10px', marginBottom: '6px', textAlign: 'center',
                }}>
                  {spawnMsg}
                </div>
              )}
              <button
                onClick={applySpawnConfig}
                disabled={spawnLoading}
                style={{
                  width: '100%', padding: '7px 0', borderRadius: '7px',
                  background: spawnLoading ? 'rgba(103,232,214,0.05)' : 'rgba(103,232,214,0.12)',
                  border: `1px solid ${spawnLoading ? 'rgba(103,232,214,0.15)' : 'rgba(103,232,214,0.35)'}`,
                  color: spawnLoading ? '#3a5550' : ACCENT,
                  fontSize: '11px', fontWeight: 700, cursor: spawnLoading ? 'default' : 'pointer',
                  fontFamily: GAME_FONT,
                }}
              >
                {spawnLoading ? '적용 중...' : '⚡ 스폰 설정 적용 & 리스폰'}
              </button>
              <div style={{ color: '#3a5550', fontSize: '9px', marginTop: '5px', lineHeight: 1.4 }}>
                * 적용 시 현재 필드의 몬스터가 즉시 초기화됩니다
              </div>
            </div>
          </>
        )}
      </div>

      {/* 푸터 (몬스터 탭 제외) */}
      {tab !== 'monster' && (
        <div style={{
          padding: '8px 14px 10px',
          borderTop: `1px solid rgba(100,160,150,0.15)`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px',
        }}>
          <button
            onClick={onReset}
            style={{
              background: 'rgba(200,60,60,0.1)', border: '1px solid rgba(200,60,60,0.3)',
              borderRadius: '6px', color: '#f87171', fontSize: '10px',
              padding: '4px 9px', cursor: 'pointer', fontFamily: GAME_FONT,
            }}
          >초기화</button>
          <button
            onClick={() => onSave?.()}
            style={{
              background: 'rgba(103,232,214,0.12)', border: '1px solid rgba(103,232,214,0.35)',
              borderRadius: '6px', color: ACCENT, fontSize: '10px', fontWeight: 700,
              padding: '4px 12px', cursor: 'pointer', fontFamily: GAME_FONT,
            }}
          >💾 저장</button>
        </div>
      )}
    </div>
  );
};

export default GameSettingsModal;
