// 인벤토리 창 — 아이템 격자 슬롯 + 장착 시스템 + 상세 패널
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@contexts/AuthContext';
import itemApi from '@api/item';

const RARITY_COLOR = {
  common:    { border: '#555',    label: '#ccc',    glow: 'none',               badge: '#666' },
  rare:      { border: '#3b82f6', label: '#60a5fa', glow: '0 0 8px #3b82f688', badge: '#3b82f6' },
  epic:      { border: '#9333ea', label: '#c084fc', glow: '0 0 10px #9333ea99',badge: '#9333ea' },
  legendary: { border: '#f59e0b', label: '#fcd34d', glow: '0 0 14px #f59e0baa',badge: '#f59e0b' },
};
const RARITY_KO = { common: '일반', rare: '희귀', epic: '에픽', legendary: '전설' };
const ICON_MAP = {
  potion_hp_s: '🧪', potion_hp_m: '🫙', potion_hp_l: '⚗️',
  mat_goblin_ear: '👂', mat_orc_hide: '🐗', mat_slime_gel: '💧',
  mat_witch_horn: '🌙', mat_zombie_bone: '🦴', mat_dragon_scale: '🐉',
  mat_ogre_heart: '❤️',
  weapon_wood_sword: '🗡️', weapon_iron_dagger: '🔪',
  armor_leather: '🛡️', armor_mage_hat: '🎩', armor_chain: '⛓️',
  helmet_leather: '🪖', helmet_steel: '⛑️',
  gloves_leather: '🧤', gloves_magic: '✨',
  boots_leather: '👟', boots_wind: '👢',
};
const TYPE_LABEL = { weapon: '무기', armor: '갑옷', helmet: '투구', gloves: '장갑', boots: '각반', potion: '포션', material: '소재' };
const STAT_LABEL = { hp: 'HP', attack: '공격력', defense: '방어력', speed: '이동속도', mp: 'MP' };
const SLOT_LABEL = { helmet: '투구', weapon: '무기', armor: '갑옷', gloves: '장갑', boots: '각반' };
const SLOT_ICON  = { helmet: '🪖', weapon: '⚔️', armor: '🛡️', gloves: '🧤', boots: '👢' };
// item_type → 장착 슬롯명 매핑 (백엔드와 동일)
const TYPE_TO_SLOT = { weapon: 'weapon', armor: 'armor', helmet: 'helmet', gloves: 'gloves', boots: 'boots' };
const EQUIPPABLE = new Set(Object.keys(TYPE_TO_SLOT));

const COLS = 5;
const TOTAL_SLOTS = 30;

/** 인벤토리 슬롯 */
const Slot = ({ item, isSelected, isEquipped, onClick }) => {
  const r = RARITY_COLOR[item?.rarity] || RARITY_COLOR.common;
  const icon = item ? (ICON_MAP[item.icon_key] || '📦') : null;

  return (
    <div
      onClick={() => item && onClick(item)}
      style={{
        width: '52px', height: '52px',
        border: `1px solid ${item ? (isSelected ? '#67e8d6' : r.border) : '#1e2530'}`,
        borderRadius: '7px',
        background: item
          ? isSelected ? 'rgba(30,50,60,0.95)' : 'rgba(16,24,34,0.9)'
          : 'rgba(8,12,18,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', cursor: item ? 'pointer' : 'default',
        boxShadow: isSelected ? '0 0 0 2px #67e8d655' : (item && r.glow !== 'none' ? r.glow : 'none'),
        transition: 'border-color 0.12s, box-shadow 0.12s',
      }}
    >
      {item && (
        <>
          <span style={{ fontSize: '24px', lineHeight: 1, userSelect: 'none' }}>{icon}</span>
          {item.quantity > 1 && (
            <span style={{
              position: 'absolute', bottom: '2px', right: '4px',
              fontSize: '10px', color: '#ccc', fontWeight: 700, textShadow: '0 1px 3px #000',
            }}>
              {item.quantity}
            </span>
          )}
          {isEquipped && (
            <span style={{
              position: 'absolute', top: '2px', right: '3px',
              fontSize: '9px', color: '#67e8d6', fontWeight: 700, textShadow: '0 1px 2px #000',
            }}>E</span>
          )}
        </>
      )}
    </div>
  );
};

/** 장비 슬롯 단일 셀 */
const EquipSlotCell = ({ slot, item, onUnequip }) => {
  const icon = item ? (ICON_MAP[item.icon_key] || '📦') : null;
  const r = item ? (RARITY_COLOR[item.rarity] || RARITY_COLOR.common) : null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
      <div style={{ color: '#3a4555', fontSize: '9px' }}>{SLOT_LABEL[slot]}</div>
      <div
        onClick={() => item && onUnequip(slot)}
        title={item ? `${item.name_ko} — 클릭해서 해제` : '비어있음'}
        style={{
          width: '44px', height: '44px', borderRadius: '7px',
          border: `1px solid ${item ? (r.border + '99') : '#1e2530'}`,
          background: item ? 'rgba(20,40,50,0.9)' : 'rgba(8,12,18,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: item ? 'pointer' : 'default', fontSize: '22px',
          position: 'relative',
          boxShadow: item && r.glow !== 'none' ? r.glow : 'none',
        }}
      >
        {item
          ? <span style={{ userSelect: 'none' }}>{icon}</span>
          : <span style={{ color: '#1e2530', fontSize: '16px' }}>{SLOT_ICON[slot]}</span>
        }
        {item && (
          <span style={{
            position: 'absolute', bottom: '2px', right: '3px',
            fontSize: '8px', color: '#67e8d6', fontWeight: 700,
          }}>E</span>
        )}
      </div>
    </div>
  );
};

/** 장비 슬롯 패널 — 디아블로 스타일 (투구/무기·갑옷·장갑/각반) */
const EquipmentPanel = ({ equipment, onUnequip }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ color: '#3a4555', fontSize: '10px', marginBottom: '6px' }}>장착 장비</div>
    {/* Row 1: 투구 (가운데) */}
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
      <EquipSlotCell slot="helmet" item={equipment.helmet} onUnequip={onUnequip} />
    </div>
    {/* Row 2: 무기 / 갑옷 / 장갑 */}
    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
      <EquipSlotCell slot="weapon" item={equipment.weapon} onUnequip={onUnequip} />
      <EquipSlotCell slot="armor"  item={equipment.armor}  onUnequip={onUnequip} />
      <EquipSlotCell slot="gloves" item={equipment.gloves} onUnequip={onUnequip} />
    </div>
    {/* Row 3: 각반 (가운데) */}
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <EquipSlotCell slot="boots" item={equipment.boots} onUnequip={onUnequip} />
    </div>
  </div>
);

/** 상세 + 장착 버튼 패널 */
const DetailPanel = ({ item, equipment, onEquip, onUnequip, onUseItem }) => {
  if (!item) return (
    <div style={{
      height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#2a3540', fontSize: '11px', borderTop: '1px solid #111', marginTop: '10px',
    }}>
      슬롯을 클릭하면 상세 정보가 표시됩니다
    </div>
  );

  const r = RARITY_COLOR[item.rarity] || RARITY_COLOR.common;
  const icon = ICON_MAP[item.icon_key] || '📦';
  const statEntries = item.stat_bonus ? Object.entries(item.stat_bonus) : [];
  const canEquip = EQUIPPABLE.has(item.item_type);
  const isPotion = item.item_type === 'potion';
  const slot = TYPE_TO_SLOT[item.item_type] || null;
  const isEquipped = slot && equipment[slot]?.item_id === item.item_id;

  return (
    <div style={{ borderTop: '1px solid #1a2535', marginTop: '10px', paddingTop: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{
          width: '44px', height: '44px',
          border: `1px solid ${r.border}`, borderRadius: '8px',
          background: 'rgba(16,24,34,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', boxShadow: r.glow !== 'none' ? r.glow : 'none', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: r.label, fontWeight: 700, fontSize: '13px' }}>{item.name_ko}</div>
          <div style={{ fontSize: '11px', marginTop: '2px', display: 'flex', gap: '5px', alignItems: 'center' }}>
            <span style={{ color: '#555' }}>{TYPE_LABEL[item.item_type] || item.item_type}</span>
            <span style={{
              color: r.label, background: `${r.badge}22`,
              border: `1px solid ${r.badge}44`, borderRadius: '4px',
              padding: '1px 5px', fontSize: '10px',
            }}>
              {RARITY_KO[item.rarity] || item.rarity}
            </span>
          </div>
        </div>
        {/* 포션 사용 버튼 */}
        {isPotion && (
          <button
            onClick={() => onUseItem?.(item.item_id)}
            style={{
              background: 'rgba(74,222,128,0.12)',
              border: '1px solid rgba(74,222,128,0.35)',
              borderRadius: '6px', color: '#4ade80',
              fontSize: '11px', fontWeight: 700,
              padding: '5px 10px', cursor: 'pointer',
            }}
          >
            사용
          </button>
        )}
        {/* 장착/해제 버튼 */}
        {canEquip && (
          isEquipped ? (
            <button
              onClick={() => onUnequip(slot)}
              style={{
                background: 'rgba(200,60,60,0.15)',
                border: '1px solid rgba(200,60,60,0.4)',
                borderRadius: '6px', color: '#f87171',
                fontSize: '11px', fontWeight: 700,
                padding: '5px 10px', cursor: 'pointer',
              }}
            >
              해제
            </button>
          ) : (
            <button
              onClick={() => onEquip(item.item_id)}
              style={{
                background: 'rgba(103,232,214,0.12)',
                border: '1px solid rgba(103,232,214,0.35)',
                borderRadius: '6px', color: '#67e8d6',
                fontSize: '11px', fontWeight: 700,
                padding: '5px 10px', cursor: 'pointer',
              }}
            >
              장착
            </button>
          )
        )}
      </div>

      {statEntries.length > 0 && (
        <div style={{
          background: 'rgba(103,232,214,0.05)', border: '1px solid rgba(103,232,214,0.1)',
          borderRadius: '6px', padding: '5px 10px', marginBottom: '6px',
          display: 'flex', flexWrap: 'wrap', gap: '8px',
        }}>
          {statEntries.map(([k, v]) => (
            <span key={k} style={{ color: '#67e8d6', fontSize: '12px' }}>
              {STAT_LABEL[k] || k} <span style={{ color: '#a3e8d0', fontWeight: 700 }}>+{v}</span>
            </span>
          ))}
        </div>
      )}

      {item.description && (
        <div style={{ color: '#555', fontSize: '11px', lineHeight: 1.5, marginBottom: '5px' }}>
          {item.description}
        </div>
      )}
      <div style={{ color: '#333', fontSize: '11px', textAlign: 'right' }}>
        보유: <span style={{ color: '#666' }}>{item.quantity}개</span>
      </div>
    </div>
  );
};

const InventoryModal = ({ onClose, myStats, onStatsUpdate, onUseItem }) => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [equipment, setEquipment] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [invRes, eqRes] = await Promise.all([
        itemApi.getInventory(user.id),
        itemApi.getEquipment(user.id),
      ]);
      setItems(invRes.data?.items || []);
      setEquipment(eqRes.data?.equipment || {});
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

  const handleEquip = async (itemId) => {
    try {
      const res = await itemApi.equip(user.id, itemId);
      setEquipment(prev => ({ ...prev, [res.data.slot]: res.data.item }));
      if (res.data.stats && onStatsUpdate) onStatsUpdate(res.data.stats);
    } catch (e) {
      console.warn('equip failed', e);
    }
  };

  const handleUnequip = async (slot) => {
    try {
      const res = await itemApi.unequip(user.id, slot);
      setEquipment(prev => { const n = { ...prev }; delete n[slot]; return n; });
      if (res.data.stats && onStatsUpdate) onStatsUpdate(res.data.stats);
    } catch (e) {
      console.warn('unequip failed', e);
    }
  };

  const handleSlotClick = (item) => {
    setSelectedItem(prev => prev?.item_id === item.item_id ? null : item);
  };

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) => items[i] || null);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg, rgba(10,16,26,0.98), rgba(6,10,18,0.98))',
          border: '1px solid rgba(100,160,150,0.3)',
          borderRadius: '14px', padding: '18px 20px', width: '316px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.75)',
          fontFamily: "'Noto Sans KR', sans-serif",
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ color: '#d0b16b', fontWeight: 700, fontSize: '15px' }}>인벤토리</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: '#444', fontSize: '11px' }}>{items.length} / {TOTAL_SLOTS}</span>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#555', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
            >×</button>
          </div>
        </div>

        {/* 골드 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(208,177,107,0.07)', border: '1px solid rgba(208,177,107,0.2)',
          borderRadius: '7px', padding: '5px 10px', marginBottom: '12px',
        }}>
          <span style={{ fontSize: '15px' }}>💰</span>
          <span style={{ color: '#d0b16b', fontWeight: 700, fontSize: '13px' }}>
            {(myStats?.gold ?? 0).toLocaleString()}
          </span>
          <span style={{ color: '#5a4a2a', fontSize: '11px' }}>Gold</span>
        </div>

        {/* 장착 슬롯 패널 */}
        {!loading && <EquipmentPanel equipment={equipment} onUnequip={handleUnequip} />}

        {/* 아이템 격자 */}
        {loading ? (
          <div style={{ color: '#444', textAlign: 'center', padding: '30px 0', fontSize: '13px' }}>불러오는 중...</div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: `repeat(${COLS}, 52px)`,
            gap: '6px', justifyContent: 'center',
          }}>
            {slots.map((item, i) => {
              const slot = item ? (TYPE_TO_SLOT[item.item_type] || null) : null;
              const isEquipped = slot ? equipment[slot]?.item_id === item?.item_id : false;
              return (
                <Slot
                  key={i} item={item}
                  isSelected={selectedItem?.item_id === item?.item_id}
                  isEquipped={isEquipped}
                  onClick={handleSlotClick}
                />
              );
            })}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div style={{ color: '#333', textAlign: 'center', fontSize: '12px', marginTop: '8px' }}>
            아이템이 없습니다. 몬스터를 처치해보세요!
          </div>
        )}

        {/* 상세 패널 */}
        {!loading && (
          <DetailPanel
            item={selectedItem}
            equipment={equipment}
            onEquip={handleEquip}
            onUnequip={handleUnequip}
            onUseItem={onUseItem}
          />
        )}
      </div>
    </div>
  );
};

export default InventoryModal;
