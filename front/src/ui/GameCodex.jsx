import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, Sparkles, X } from 'lucide-react';

import { useAuth } from '@contexts/AuthContext';
import itemApi from '@api/item';
import monsterApi from '@api/monster';

const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const PANEL_BG = 'linear-gradient(180deg, rgba(5,11,18,0.99), rgba(8,14,22,0.98))';
const BORDER = 'rgba(124, 171, 166, 0.35)';
const GOLD = '#d0b16b';
const ACCENT = '#67e8d6';

const TIER_COLOR = { boss: '#ff4444', elite: '#ff9900', normal: '#67e8d6' };
const TIER_LABEL = { boss: 'BOSS', elite: 'ELITE', normal: 'NORMAL' };
const PROP_COLOR = {
  fire: '#ff6b35',
  water: '#38bdf8',
  forest: '#4ade80',
  stone: '#a8a29e',
  dark: '#a78bfa',
  magic: '#e879f9',
  earth: '#ca8a04',
};
const PROP_LABEL = {
  fire: '불',
  water: '물',
  forest: '숲',
  stone: '암석',
  dark: '암흑',
  magic: '마법',
  earth: '대지',
};

const RARITY_COLOR = {
  common: '#cbd5e1',
  rare: '#60a5fa',
  epic: '#c084fc',
  legendary: '#fbbf24',
};
const RARITY_LABEL = {
  common: '일반',
  rare: '희귀',
  epic: '영웅',
  legendary: '전설',
};
const TYPE_LABEL = {
  weapon: '무기',
  armor: '갑옷',
  helmet: '투구',
  gloves: '장갑',
  boots: '각반',
  potion: '포션',
  material: '재료',
};
const ICON_MAP = {
  potion_hp_s: '🧪',
  potion_hp_m: '🧴',
  potion_hp_l: '⚗️',
  mat_goblin_ear: '👂',
  mat_orc_hide: '🧥',
  mat_slime_gel: '🫧',
  mat_witch_horn: '🦄',
  mat_zombie_bone: '🦴',
  mat_dragon_scale: '🐉',
  mat_ogre_heart: '❤️',
  weapon_wood_sword: '🗡️',
  weapon_iron_dagger: '🗡',
  armor_leather: '🦺',
  armor_mage_hat: '🎩',
  armor_chain: '⛓️',
  helmet_leather: '⛑️',
  helmet_steel: '🪖',
  gloves_leather: '🧤',
  gloves_magic: '✨',
  boots_leather: '🥾',
  boots_wind: '👢',
};

const CODEX_TABS = [
  { id: 'monster', label: '몬스터', emoji: '👾' },
  { id: 'item', label: '아이템', emoji: '🎒' },
  { id: 'skill', label: '스킬', emoji: '✨' },
  { id: 'world', label: '월드', emoji: '🗺️' },
];

const ComingSoon = ({ label }) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#52736d',
      gap: '12px',
    }}
  >
    <Sparkles size={34} color="#35534d" />
    <div style={{ fontSize: '14px' }}>{label} 준비 중</div>
  </div>
);

const MonsterDetail = ({ monster, onBack }) => {
  const tier = monster.tier || 'normal';
  const tierColor = TIER_COLOR[tier] || ACCENT;
  const propertyColor = PROP_COLOR[monster.property_type] || '#aaa';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: ACCENT,
          cursor: 'pointer',
          fontSize: '12px',
          marginBottom: '16px',
          padding: 0,
          fontFamily: GAME_FONT,
        }}
      >
        <ChevronLeft size={14} />
        목록으로
      </button>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center' }}>
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '14px',
            background: `linear-gradient(135deg, ${tierColor}22, ${tierColor}44)`,
            border: `2px solid ${tierColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '42px',
            flexShrink: 0,
          }}
        >
          {monster.icon_emoji || '👹'}
        </div>
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '999px', border: `1px solid ${tierColor}`, color: tierColor }}>
              {TIER_LABEL[tier]}
            </span>
            <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '999px', border: `1px solid ${propertyColor}`, color: propertyColor }}>
              {PROP_LABEL[monster.property_type] || monster.property_type}
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#fff', lineHeight: 1.2 }}>{monster.name_ko}</div>
          <div style={{ fontSize: '11px', color: '#6a9a94', marginTop: '3px' }}>{monster.name_en} · #{String(monster.id).padStart(3, '0')}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: 'HP', value: monster.base_hp?.toLocaleString(), color: '#ef4444' },
          { label: 'EXP', value: `+${monster.base_exp}`, color: '#fbbf24' },
          { label: '출신', value: monster.origin_region || '-', color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: '9px', color: '#6a9a94', marginBottom: '3px' }}>{label}</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color }}>{value}</div>
          </div>
        ))}
      </div>

      {monster.description && (
        <div style={{ fontSize: '11px', color: '#b6c5c2', lineHeight: 1.8, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: `1px solid ${BORDER}`, marginBottom: '16px' }}>
          {monster.description}
        </div>
      )}

      {monster.drop_items?.length > 0 && (
        <div>
          <div style={{ fontSize: '10px', color: GOLD, letterSpacing: '1.5px', marginBottom: '8px' }}>DROP ITEMS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {monster.drop_items.map((drop, index) => (
              <div
                key={`${monster.id}_${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '8px',
                  border: `1px solid ${BORDER}`,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#e2e8f0', fontSize: '12px' }}>
                  <span style={{ fontSize: '18px' }}>{drop.icon || '🎁'}</span>
                  {drop.item}
                </span>
                <span style={{ color: drop.rate >= 1 ? '#4ade80' : GOLD, fontSize: '11px', fontWeight: '700' }}>
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

const MonsterList = ({ onSelect }) => {
  const [monsters, setMonsters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    monsterApi.getAllTemplates()
      .then((res) => setMonsters(Array.isArray(res.data) ? res.data : []))
      .catch(() => setMonsters([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? monsters : monsters.filter((monster) => monster.tier === filter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {['all', 'normal', 'elite', 'boss'].map((tier) => (
          <button
            key={tier}
            onClick={() => setFilter(tier)}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '11px',
              cursor: 'pointer',
              border: `1px solid ${filter === tier ? TIER_COLOR[tier] || ACCENT : BORDER}`,
              background: filter === tier ? `${TIER_COLOR[tier] || ACCENT}20` : 'transparent',
              color: filter === tier ? (TIER_COLOR[tier] || ACCENT) : '#8ca6a0',
              fontFamily: GAME_FONT,
            }}
          >
            {tier === 'all' ? 'ALL' : TIER_LABEL[tier]}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4a6a66', alignSelf: 'center' }}>{filtered.length} / {monsters.length}</span>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a66', fontSize: '13px' }}>
          불러오는 중...
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))', gap: '10px', paddingRight: '4px' }}>
          {filtered.map((monster) => {
            const tierColor = TIER_COLOR[monster.tier] || ACCENT;
            const propertyColor = PROP_COLOR[monster.property_type] || '#aaa';
            return (
              <button
                key={monster.id}
                onClick={() => onSelect(monster)}
                style={{
                  padding: '12px 10px',
                  background: `linear-gradient(160deg, rgba(8,14,22,0.9), ${tierColor}0d)`,
                  border: `1px solid ${tierColor}44`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#e2e8f0',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${tierColor}20, ${tierColor}38)`,
                    border: `1px solid ${tierColor}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                  }}
                >
                  {monster.icon_emoji || '👹'}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', textAlign: 'center', lineHeight: 1.3 }}>{monster.name_ko}</div>
                <div style={{ fontSize: '9px', color: '#5a7a74' }}>{monster.name_en}</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', border: `1px solid ${tierColor}66`, color: tierColor }}>
                    {TIER_LABEL[monster.tier]}
                  </span>
                  <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', border: `1px solid ${propertyColor}66`, color: propertyColor }}>
                    {PROP_LABEL[monster.property_type] || monster.property_type}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '9px', color: '#6a9a94', marginTop: '2px' }}>
                  <span>HP {monster.base_hp?.toLocaleString()}</span>
                  <span>+{monster.base_exp} EXP</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ItemDetail = ({ item, onBack }) => {
  if (!item) return null;

  const rarityColor = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
  const stats = item.stat_bonus ? Object.entries(item.stat_bonus) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'none',
          border: 'none',
          color: ACCENT,
          cursor: 'pointer',
          fontSize: '12px',
          marginBottom: '16px',
          padding: 0,
          fontFamily: GAME_FONT,
        }}
      >
        <ChevronLeft size={14} />
        목록으로
      </button>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center' }}>
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '14px',
            background: `linear-gradient(135deg, ${rarityColor}20, ${rarityColor}45)`,
            border: `2px solid ${rarityColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            flexShrink: 0,
          }}
        >
          {ICON_MAP[item.icon_key] || '📦'}
        </div>
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '999px', border: `1px solid ${rarityColor}`, color: rarityColor }}>
              {RARITY_LABEL[item.rarity] || item.rarity}
            </span>
            <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '999px', border: `1px solid ${BORDER}`, color: '#c8e8e2' }}>
              {TYPE_LABEL[item.item_type] || item.item_type}
            </span>
            {item.quantity > 0 && (
              <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '999px', border: '1px solid rgba(103,232,214,0.45)', color: ACCENT }}>
                보유 x{item.quantity}
              </span>
            )}
          </div>
          <div style={{ fontSize: '22px', fontWeight: '700', color: '#fff', lineHeight: 1.2 }}>{item.name_ko}</div>
          <div style={{ fontSize: '11px', color: '#6a9a94', marginTop: '3px' }}>{item.name_en} · #{String(item.item_id).padStart(3, '0')}</div>
        </div>
      </div>

      {stats.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {stats.map(([stat, value]) => (
            <div key={stat} style={{ padding: '8px 10px', background: 'rgba(103,232,214,0.06)', borderRadius: '8px', border: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: '9px', color: '#7ea9a1' }}>{stat.toUpperCase()}</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: ACCENT }}>+{value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, color: '#c7d4d1', fontSize: '12px', lineHeight: 1.7 }}>
        {item.description || '설명이 아직 없습니다.'}
      </div>
    </div>
  );
};

const ItemList = ({ userId, onSelect }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [ownedOnlyFallback, setOwnedOnlyFallback] = useState(false);

  useEffect(() => {
    setLoading(true);
    setOwnedOnlyFallback(false);
    itemApi.getTemplates(userId)
      .then((res) => {
        setItems(Array.isArray(res.data?.items) ? res.data.items : []);
      })
      .catch(async () => {
        if (!userId) {
          setItems([]);
          return;
        }
        try {
          const res = await itemApi.getInventory(userId);
          setItems(Array.isArray(res.data?.items) ? res.data.items : []);
          setOwnedOnlyFallback(true);
        } catch (_) {
          setItems([]);
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'owned') return items.filter((item) => Number(item.quantity) > 0);
    return items.filter((item) => item.rarity === filter || item.item_type === filter);
  }, [filter, items]);

  const filters = [
    { id: 'all', label: '전체' },
    { id: 'owned', label: '보유' },
    { id: 'weapon', label: '무기' },
    { id: 'armor', label: '방어구' },
    { id: 'potion', label: '포션' },
    { id: 'material', label: '재료' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {filters.map((entry) => (
          <button
            key={entry.id}
            onClick={() => setFilter(entry.id)}
            style={{
              padding: '4px 12px',
              borderRadius: '999px',
              fontSize: '11px',
              cursor: 'pointer',
              border: `1px solid ${filter === entry.id ? ACCENT : BORDER}`,
              background: filter === entry.id ? 'rgba(103,232,214,0.14)' : 'transparent',
              color: filter === entry.id ? ACCENT : '#8ca6a0',
              fontFamily: GAME_FONT,
            }}
          >
            {entry.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4a6a66', alignSelf: 'center' }}>{filtered.length} / {items.length}</span>
      </div>

      {ownedOnlyFallback && (
        <div style={{ marginBottom: '10px', fontSize: '10px', color: '#d0b16b' }}>
          전체 아이템 API 응답이 없어 보유 아이템만 표시 중
        </div>
      )}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a6a66', fontSize: '13px' }}>
          불러오는 중...
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))', gap: '10px', paddingRight: '4px' }}>
          {filtered.map((item) => {
            const rarityColor = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
            const owned = Number(item.quantity) > 0;
            return (
              <button
                key={item.item_id}
                onClick={() => onSelect(item)}
                style={{
                  padding: '12px 10px',
                  background: owned
                    ? `linear-gradient(160deg, rgba(8,14,22,0.9), ${rarityColor}10)`
                    : 'linear-gradient(160deg, rgba(8,14,22,0.86), rgba(90,100,110,0.08))',
                  border: `1px solid ${owned ? `${rarityColor}55` : 'rgba(90,100,110,0.22)'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  color: owned ? '#e2e8f0' : '#6b7280',
                  filter: owned ? 'none' : 'saturate(0.2)',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${rarityColor}20, ${rarityColor}38)`,
                    border: `1px solid ${owned ? `${rarityColor}66` : 'rgba(90,100,110,0.22)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                  }}
                >
                  {ICON_MAP[item.icon_key] || '📦'}
                </div>
                <div style={{ fontSize: '12px', fontWeight: '700', textAlign: 'center', lineHeight: 1.3 }}>{item.name_ko}</div>
                <div style={{ fontSize: '9px', color: owned ? '#5a7a74' : '#5f6972' }}>{TYPE_LABEL[item.item_type] || item.item_type}</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', border: `1px solid ${owned ? `${rarityColor}66` : 'rgba(90,100,110,0.22)'}`, color: owned ? rarityColor : '#6b7280' }}>
                    {RARITY_LABEL[item.rarity] || item.rarity}
                  </span>
                  <span style={{ fontSize: '8px', padding: '1px 5px', borderRadius: '999px', border: `1px solid ${owned ? 'rgba(103,232,214,0.45)' : 'rgba(90,100,110,0.22)'}`, color: owned ? ACCENT : '#6b7280' }}>
                    {owned ? `보유 ${item.quantity}` : '미획득'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const GameCodex = ({ onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('monster');
  const [selectedMonster, setSelectedMonster] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const resetSelection = () => {
    setSelectedMonster(null);
    setSelectedItem(null);
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          width: 'min(760px, 92vw)',
          height: 'min(600px, 88vh)',
          background: PANEL_BG,
          border: `1px solid ${BORDER}`,
          borderRadius: '18px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 0 48px rgba(103,232,214,0.08)',
          fontFamily: GAME_FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={18} color={GOLD} />
            <span style={{ fontSize: '15px', fontWeight: '700', color: GOLD, letterSpacing: '2px' }}>GAME CODEX</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={18} color="#5a7a74" />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: '92px', borderRight: `1px solid ${BORDER}`, padding: '12px 0', display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
            {CODEX_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  resetSelection();
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '10px 6px',
                  margin: '0 8px',
                  borderRadius: '8px',
                  background: activeTab === tab.id ? 'rgba(103,232,214,0.1)' : 'transparent',
                  border: `1px solid ${activeTab === tab.id ? ACCENT : 'transparent'}`,
                  cursor: 'pointer',
                  color: activeTab === tab.id ? ACCENT : '#4a6a64',
                }}
              >
                <span style={{ fontSize: '20px' }}>{tab.emoji}</span>
                <span style={{ fontSize: '9px', fontFamily: GAME_FONT }}>{tab.label}</span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: '16px 18px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'monster' && (
              selectedMonster
                ? <MonsterDetail monster={selectedMonster} onBack={() => setSelectedMonster(null)} />
                : <MonsterList onSelect={setSelectedMonster} />
            )}
            {activeTab === 'item' && (
              selectedItem
                ? <ItemDetail item={selectedItem} onBack={() => setSelectedItem(null)} />
                : <ItemList userId={user?.id} onSelect={setSelectedItem} />
            )}
            {activeTab === 'skill' && <ComingSoon label="스킬 도감" />}
            {activeTab === 'world' && <ComingSoon label="월드 정보" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCodex;
