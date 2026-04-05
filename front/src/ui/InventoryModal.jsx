// 인벤토리 창 — 아이템 격자 슬롯 + 클릭 상세 패널
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import itemApi from '@api/item';

const RARITY_COLOR = {
  common:    { border: '#555',    label: '#ccc',    glow: 'none',                    badge: '#666' },
  rare:      { border: '#3b82f6', label: '#60a5fa', glow: '0 0 8px #3b82f688',       badge: '#3b82f6' },
  epic:      { border: '#9333ea', label: '#c084fc', glow: '0 0 10px #9333ea99',      badge: '#9333ea' },
  legendary: { border: '#f59e0b', label: '#fcd34d', glow: '0 0 14px #f59e0baa',     badge: '#f59e0b' },
};

const RARITY_KO = { common: '일반', rare: '희귀', epic: '에픽', legendary: '전설' };

const ICON_MAP = {
  potion_hp_s:       '🧪',
  potion_hp_m:       '🫙',
  potion_hp_l:       '⚗️',
  mat_goblin_ear:    '👂',
  mat_orc_hide:      '🐗',
  mat_slime_gel:     '💧',
  mat_witch_horn:    '🌙',
  mat_zombie_bone:   '🦴',
  mat_dragon_scale:  '🐉',
  mat_ogre_heart:    '❤️',
  weapon_wood_sword: '🗡️',
  armor_leather:     '🛡️',
  armor_mage_hat:    '🎩',
};

const TYPE_LABEL = { weapon: '무기', armor: '방어구', potion: '포션', material: '소재' };
const STAT_LABEL = { hp: 'HP', attack: '공격력', defense: '방어력', speed: '이동속도', mp: 'MP' };

const COLS = 5;
const TOTAL_SLOTS = 30;

/** 슬롯 — 클릭 시 상세 패널 열기 */
const Slot = ({ item, isSelected, onClick }) => {
  const r = RARITY_COLOR[item?.rarity] || RARITY_COLOR.common;
  const icon = item ? (ICON_MAP[item.icon_key] || '📦') : null;

  return (
    <div
      onClick={() => item && onClick(item)}
      style={{
        width: '52px',
        height: '52px',
        border: `1px solid ${item ? (isSelected ? '#67e8d6' : r.border) : '#1e2530'}`,
        borderRadius: '7px',
        background: item
          ? isSelected ? 'rgba(30,50,60,0.95)' : 'rgba(16,24,34,0.9)'
          : 'rgba(8,12,18,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: item ? 'pointer' : 'default',
        boxShadow: isSelected
          ? '0 0 0 2px #67e8d655'
          : item && r.glow !== 'none' ? r.glow : 'none',
        transition: 'border-color 0.12s, box-shadow 0.12s',
      }}
    >
      {item && (
        <>
          <span style={{ fontSize: '24px', lineHeight: 1, userSelect: 'none' }}>{icon}</span>
          {item.quantity > 1 && (
            <span style={{
              position: 'absolute',
              bottom: '2px',
              right: '4px',
              fontSize: '10px',
              color: '#ccc',
              fontWeight: 700,
              textShadow: '0 1px 3px #000',
            }}>
              {item.quantity}
            </span>
          )}
        </>
      )}
    </div>
  );
};

/** 상세 패널 — 선택된 아이템 정보 */
const DetailPanel = ({ item, onClose }) => {
  if (!item) return (
    <div style={{
      height: '130px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#333',
      fontSize: '12px',
      borderTop: '1px solid #111',
      marginTop: '12px',
    }}>
      슬롯을 클릭하면 상세 정보가 표시됩니다
    </div>
  );

  const r = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
  const icon = ICON_MAP[item.icon_key] || '📦';
  const statEntries = item.stat_bonus ? Object.entries(item.stat_bonus) : [];

  return (
    <div style={{
      borderTop: '1px solid #1a2535',
      marginTop: '12px',
      paddingTop: '12px',
    }}>
      {/* 이름 + 아이콘 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{
          width: '46px',
          height: '46px',
          border: `1px solid ${r.border}`,
          borderRadius: '8px',
          background: 'rgba(16,24,34,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
          boxShadow: r.glow !== 'none' ? r.glow : 'none',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ color: r.label, fontWeight: 700, fontSize: '14px' }}>{item.name_ko}</div>
          <div style={{ fontSize: '11px', marginTop: '2px' }}>
            <span style={{ color: '#666' }}>{TYPE_LABEL[item.item_type] || item.item_type}</span>
            <span style={{ color: '#333', margin: '0 5px' }}>·</span>
            <span style={{
              color: r.label,
              background: `${r.badge}22`,
              border: `1px solid ${r.badge}55`,
              borderRadius: '4px',
              padding: '1px 5px',
              fontSize: '10px',
            }}>
              {RARITY_KO[item.rarity] || item.rarity}
            </span>
          </div>
        </div>
      </div>

      {/* 스탯 */}
      {statEntries.length > 0 && (
        <div style={{
          background: 'rgba(103,232,214,0.06)',
          border: '1px solid rgba(103,232,214,0.12)',
          borderRadius: '6px',
          padding: '6px 10px',
          marginBottom: '7px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}>
          {statEntries.map(([k, v]) => (
            <span key={k} style={{ color: '#67e8d6', fontSize: '12px' }}>
              {STAT_LABEL[k] || k} <span style={{ color: '#a3e8d0', fontWeight: 700 }}>+{v}</span>
            </span>
          ))}
        </div>
      )}

      {/* 설명 */}
      {item.description && (
        <div style={{ color: '#666', fontSize: '11px', lineHeight: 1.5, marginBottom: '6px' }}>
          {item.description}
        </div>
      )}

      {/* 수량 */}
      <div style={{ color: '#444', fontSize: '11px', textAlign: 'right' }}>
        보유 수량: <span style={{ color: '#888' }}>{item.quantity}개</span>
      </div>
    </div>
  );
};

const InventoryModal = ({ onClose }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await itemApi.getInventory(user.id);
      setItems(res.data?.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape' || e.key === 'i' || e.key === 'I') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSlotClick = (item) => {
    setSelectedItem(prev => prev?.item_id === item.item_id ? null : item);
  };

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => items[i] || null);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, rgba(10,16,26,0.98), rgba(6,10,18,0.98))',
          border: '1px solid rgba(100,160,150,0.3)',
          borderRadius: '14px',
          padding: '18px 20px',
          width: '316px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.75)',
          fontFamily: "'Noto Sans KR', sans-serif",
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <span style={{ color: '#d0b16b', fontWeight: 700, fontSize: '15px', letterSpacing: '0.5px' }}>
            인벤토리
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: '#444', fontSize: '11px' }}>{items.length} / {TOTAL_SLOTS}</span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#555',
                fontSize: '20px',
                cursor: 'pointer',
                lineHeight: 1,
                padding: '0 2px',
              }}
            >×</button>
          </div>
        </div>

        {/* 아이템 격자 */}
        {loading ? (
          <div style={{ color: '#444', textAlign: 'center', padding: '30px 0', fontSize: '13px' }}>
            불러오는 중...
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${COLS}, 52px)`,
            gap: '6px',
            justifyContent: 'center',
          }}>
            {slots.map((item, i) => (
              <Slot
                key={i}
                item={item}
                isSelected={selectedItem?.item_id === item?.item_id}
                onClick={handleSlotClick}
              />
            ))}
          </div>
        )}

        {/* 상세 패널 */}
        {!loading && <DetailPanel item={selectedItem} />}
      </div>
    </div>
  );
};

export default InventoryModal;
