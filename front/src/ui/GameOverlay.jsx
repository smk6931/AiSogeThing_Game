import React, { useEffect, useRef, useState } from 'react';
import { Home, LogOut, Settings, Shield, Sword, Users, Zap, Flame, Menu, X, BarChart2, Package, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import worldApi from '@api/world';
import { useAuth } from '@contexts/AuthContext';
import { useGameConfig } from '@contexts/GameConfigContext';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from '@entity/world/mapConfig';
import { useSeoulDistricts } from '@hooks/useSeoulDistricts';
import { useSeoulDongs } from '@hooks/useSeoulDongs';

import LeafletMapBackground from './LeafletMapBackground';

const GAME_FONT = "'Cinzel', 'Noto Sans KR', serif";
const PANEL_BG = 'linear-gradient(180deg, rgba(14, 20, 28, 0.88), rgba(8, 10, 16, 0.86))';
const BORDER_COLOR = 'rgba(124, 171, 166, 0.45)';
const GOLD = '#d0b16b';
const ACCENT = '#67e8d6';
const GLOW = '0 0 18px rgba(103, 232, 214, 0.18)';

const injectFont = () => {
  if (document.getElementById('game-font-link')) return;
  const link = document.createElement('link');
  link.id = 'game-font-link';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Noto+Sans+KR:wght@400;500;700&display=swap';
  document.head.appendChild(link);
};

const GameOverlay = ({ myPositionRef, onSimulateKey, onlineCount = 0, myStats, monsters = {} }) => {
  const { user } = useAuth();
  const { moveSpeed, setMoveSpeed } = useGameConfig();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState(null);
  const [worldEditorOpen, setWorldEditorOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(15);
  const [gpsCoords, setGpsCoords] = useState({ lat: GIS_ORIGIN.lat, lng: GIS_ORIGIN.lng });
  const [currentDistrict, setCurrentDistrict] = useState(null);
  const [currentDong, setCurrentDong] = useState(null);
  const [currentRegionInfo, setCurrentRegionInfo] = useState(null);
  const [currentPartition, setCurrentPartition] = useState(null);
  const [showZoneTitle, setShowZoneTitle] = useState(false);
  const [showPartitionTitle, setShowPartitionTitle] = useState(false);
  const [showPartitionPanel, setShowPartitionPanel] = useState(false);

  const lastDistrictRef = useRef('');
  const lastDongRef = useRef('');
  const lastPartitionRef = useRef('');
  const partitionTimerRef = useRef(null);
  const zoneTimerRef = useRef(null);

  const { districts, getDistrictAt } = useSeoulDistricts();
  const { dongs, getDongAt } = useSeoulDongs();

  useEffect(() => {
    injectFont();

    const styleId = 'game-overlay-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -40%); }
          15% { opacity: 1; transform: translate(-50%, -50%); }
          85% { opacity: 1; transform: translate(-50%, -50%); }
          100% { opacity: 0; transform: translate(-50%, -60%); }
        }
      `;
      document.head.appendChild(style);
    }

    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const updateGps = () => {
      if (!myPositionRef?.current) return;

      const { x, z } = myPositionRef.current;
      const lat = GIS_ORIGIN.lat - (z / LAT_TO_M);
      const lng = GIS_ORIGIN.lng + (x / LNG_TO_M);
      setGpsCoords({ lat, lng });

      if (getDistrictAt) {
        const foundDistrict = getDistrictAt(lat, lng);
        const districtName = foundDistrict?.name || '';
        if (districtName && districtName !== lastDistrictRef.current) {
          setCurrentDistrict(foundDistrict);
          lastDistrictRef.current = districtName;
          setShowZoneTitle(true);
          if (zoneTimerRef.current) clearTimeout(zoneTimerRef.current);
          zoneTimerRef.current = setTimeout(() => setShowZoneTitle(false), 3000);
        }
      }

      if (getDongAt) {
        const foundDong = getDongAt(lat, lng);
        const dongName = foundDong?.name || '';
        if (dongName && dongName !== lastDongRef.current) {
          setCurrentDong(foundDong);
          lastDongRef.current = dongName;
        }
      }
    };

    const interval = setInterval(updateGps, 500);
    return () => clearInterval(interval);
  }, [myPositionRef, getDistrictAt, getDongAt]);

  useEffect(() => {
    let cancelled = false;

    const loadRegionInfo = async () => {
      if (!currentDong?.id) {
        setCurrentRegionInfo(null);
        setCurrentPartition(null);
        return;
      }

      try {
        const response = await worldApi.getCurrentRegion(gpsCoords.lat, gpsCoords.lng);
        if (cancelled) return;

        const nextRegion = response.data?.db_region || null;
        const nextPartition = response.data?.current_partition || null;
        setCurrentRegionInfo(nextRegion);
        setCurrentPartition(nextPartition);

        const nextPartitionKey = nextPartition?.partition_key || '';
        if (nextPartitionKey && nextPartitionKey !== lastPartitionRef.current) {
          lastPartitionRef.current = nextPartitionKey;
          setShowPartitionTitle(true);
          if (partitionTimerRef.current) clearTimeout(partitionTimerRef.current);
          partitionTimerRef.current = setTimeout(() => setShowPartitionTitle(false), 2200);
        }
      } catch (error) {
        if (cancelled) return;
        setCurrentRegionInfo(null);
        setCurrentPartition(null);
      }
    };

    const timer = setTimeout(loadRegionInfo, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentDong?.id, gpsCoords.lat, gpsCoords.lng]);

  useEffect(() => {
    if (window.__worldGui) {
      if (worldEditorOpen) window.__worldGui.show();
      else window.__worldGui.hide();
    }
  }, [worldEditorOpen]);

  const playerStats = {
    hp: myStats?.hp || 100,
    maxHp: myStats?.maxHp || 100,
    mp: myStats?.mp || 50,
    maxMp: myStats?.maxMp || 50,
    level: myStats?.level || 1,
    nickname: user?.nickname || 'Guest',
  };

  const hpPct = Math.max(0, Math.min(100, (playerStats.hp / playerStats.maxHp) * 100));
  const mpPct = Math.max(0, Math.min(100, (playerStats.mp / playerStats.maxMp) * 100));
  const currentPartitionTitle = currentPartition?.group_display_name || currentPartition?.display_name || '';
  const currentPartitionTheme = currentPartition?.group_theme_code || currentPartition?.theme_code || '-';

  const skills = [
    { key: 'Q', icon: Sword, label: 'Slash', cooldown: 0 },
    { key: 'W', icon: Shield, label: 'Guard', cooldown: 2 },
    { key: 'E', icon: Zap, label: 'Spark', cooldown: 0 },
    { key: 'R', icon: Flame, label: 'Burst', cooldown: 10 },
  ];

  const items = [
    { key: '1', name: 'Potion', count: 5, icon: '🧪' },
    { key: '2', name: 'Mana', count: 3, icon: '💧' },
    { key: '3', name: '', count: 0, icon: '' },
    { key: '4', name: '', count: 0, icon: '' },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
        fontFamily: GAME_FONT,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: isMobile ? 'max(10px, env(safe-area-inset-top))' : '18px',
          left: isMobile ? 'max(10px, env(safe-area-inset-left))' : '18px',
          width: isMobile ? '104px' : '260px',
          padding: isMobile ? '8px' : '12px',
          borderRadius: isMobile ? '12px' : '14px',
          background: PANEL_BG,
          backdropFilter: 'blur(16px)',
          border: `1px solid ${BORDER_COLOR}`,
          boxShadow: GLOW,
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
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
          <span style={{ color: GOLD, fontWeight: '700', fontSize: isMobile ? '10px' : '15px' }}>
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

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: isMobile ? '8px' : '11px', color: '#aaa' }}>
            <span style={{ color: '#60a5fa' }}>MP</span>
            <span>{playerStats.mp}/{playerStats.maxMp}</span>
          </div>
          <div style={{ height: isMobile ? '6px' : '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${mpPct}%`, height: '100%', background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)' }} />
          </div>
        </div>
      </div>

      {/* 미니맵 */}
      <div
        style={{
          position: 'absolute',
          top: isMobile ? 'max(10px, env(safe-area-inset-top))' : '18px',
          right: isMobile ? 'max(10px, env(safe-area-inset-right))' : '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: isMobile ? '96px' : '136px',
            height: isMobile ? '76px' : '136px',
            background: PANEL_BG,
            borderRadius: isMobile ? '14px' : '24px',
            border: `2px solid ${BORDER_COLOR}`,
            overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: GLOW,
          }}
          onClick={() => setIsMapExpanded(true)}
        >
          <div style={{ position: 'absolute', inset: -5, opacity: 0.85 }}>
            <LeafletMapBackground
              playerPositionRef={myPositionRef}
              zoomLevel={mapZoom}
              districts={districts}
              dongs={dongs}
              currentDistrictId={currentDistrict?.id || null}
              currentDongId={currentDong?.id || null}
              monsters={monsters}
            />
          </div>


          {/* 줌 버튼 — 미니맵 내부 우상단 */}
          <div
            style={{
              position: 'absolute',
              top: '5px',
              right: '5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              zIndex: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMapZoom((z) => Math.min(z + 1, 19))}
              style={{
                width: '18px', height: '18px',
                background: 'rgba(4,12,18,0.75)',
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '4px',
                color: ACCENT,
                fontSize: '11px',
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >+</button>
            <button
              onClick={() => setMapZoom((z) => Math.max(z - 1, 10))}
              style={{
                width: '18px', height: '18px',
                background: 'rgba(4,12,18,0.75)',
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '4px',
                color: ACCENT,
                fontSize: '11px',
                lineHeight: 1,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >−</button>
          </div>

          {/* 온라인 수 — 미니맵 내부 하단 */}
          <div
            style={{
              position: 'absolute',
              bottom: '5px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '9px',
              color: '#dffdfa',
              background: 'rgba(4,12,18,0.72)',
              padding: '1px 6px',
              borderRadius: '8px',
              zIndex: 11,
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              pointerEvents: 'none',
            }}
          >
            <Users size={9} color={GOLD} /> {onlineCount}
          </div>
        </div>

        {/* PARTITION 컴팩트 버튼 */}
        {!isMapExpanded && currentPartition && (
          <button
            onClick={() => setShowPartitionPanel((prev) => !prev)}
            style={{
              pointerEvents: 'auto',
              border: `1px solid ${showPartitionPanel ? ACCENT : BORDER_COLOR}`,
              background: showPartitionPanel ? 'rgba(19, 50, 60, 0.95)' : 'rgba(8, 14, 20, 0.88)',
              color: showPartitionPanel ? ACCENT : '#c8e8e2',
              borderRadius: '8px',
              padding: '5px 9px',
              width: isMobile ? '96px' : '136px',
              textAlign: 'left',
              cursor: 'pointer',
              boxShadow: GLOW,
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {currentPartitionTitle}
              </span>
              {currentPartition?.display_name && currentPartition?.display_name !== currentPartitionTitle && (
                <span
                  style={{
                    fontSize: '8px',
                    color: '#8ca6a0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {currentPartition.display_name}
                </span>
              )}
            </span>
            <span style={{ fontSize: '9px', color: '#6a9a94', flexShrink: 0 }}>
              {showPartitionPanel ? '▲' : '▼'}
            </span>
          </button>
        )}

        {/* PARTITION 상세 패널 */}
        {!isMapExpanded && showPartitionPanel && currentPartition && (
          <div
            style={{
              width: isMobile ? '200px' : '280px',
              padding: isMobile ? '10px' : '14px',
              borderRadius: '12px',
              background: 'linear-gradient(180deg, rgba(5, 11, 18, 0.97), rgba(8, 14, 22, 0.95))',
              border: `1px solid ${BORDER_COLOR}`,
              boxShadow: GLOW,
              color: '#eefaf7',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1px', marginBottom: '6px' }}>REGION</div>
            <div style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: '700', color: ACCENT, marginBottom: '2px', lineHeight: 1.3 }}>
              {currentPartitionTitle}
            </div>
            <div style={{ fontSize: '10px', color: '#8ca6a0', marginBottom: '8px' }}>
              {currentDong?.name} · G{currentPartition.group_seq || '-'} · #{currentPartition.partition_seq}
            </div>
            {currentPartition?.display_name && currentPartition?.display_name !== currentPartitionTitle && (
              <div style={{ fontSize: '10px', color: '#d6e7e3', marginBottom: '8px' }}>
                Micro: {currentPartition.display_name}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: '3px 8px', fontSize: '10px', marginBottom: '8px' }}>
              <div style={{ color: GOLD }}>Theme</div>
              <div>{currentPartitionTheme}</div>
              <div style={{ color: GOLD }}>Landuse</div>
              <div>{currentPartition.landuse_code || '-'}</div>
            </div>
            {currentPartition.summary && (
              <div style={{ fontSize: '10px', color: '#c8deda', lineHeight: 1.5 }}>
                {currentPartition.summary}
              </div>
            )}
          </div>
        )}
      </div>

      {isMapExpanded && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: '80vw',
              height: '70vh',
              background: PANEL_BG,
              borderRadius: '16px',
              border: `2px solid ${BORDER_COLOR}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', inset: 0, opacity: 0.9 }}>
              <LeafletMapBackground
                playerPositionRef={myPositionRef}
                zoomLevel={mapZoom + 1}
                districts={districts}
                dongs={dongs}
                currentDistrictId={currentDistrict?.id || null}
                currentDongId={currentDong?.id || null}
                interactive
                showSeoulMask
                onZoomChange={(newZoom) => setMapZoom(newZoom - 1)}
                monsters={monsters}
              />
            </div>

            <div
              style={{ position: 'absolute', top: '16px', right: '16px', color: '#ff4444', fontSize: '24px', cursor: 'pointer', zIndex: 10 }}
              onClick={() => setIsMapExpanded(false)}
            >
              ×
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                background: 'rgba(0,0,0,0.8)',
                padding: '10px',
                borderRadius: '8px',
                color: '#4ade80',
                zIndex: 10,
              }}
            >
              <div style={{ fontSize: '10px', color: '#aaa' }}>GPS TRACKING</div>
              <div style={{ fontSize: '14px' }}>
                LAT: {gpsCoords.lat.toFixed(6)}° / LNG: {gpsCoords.lng.toFixed(6)}°
              </div>
            </div>

          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: isMobile ? '18px' : '30px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: isMobile ? 'none' : 'flex',
          gap: '12px',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          {skills.map((skill) => (
            <div
              key={skill.key}
              style={{
                width: '60px',
                height: '60px',
                background: PANEL_BG,
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '8px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ position: 'absolute', top: '4px', left: '6px', fontSize: '10px', color: GOLD }}>
                {skill.key}
              </span>
              <skill.icon size={24} color="#fff" />
              {skill.cooldown > 0 && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                  {skill.cooldown}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ width: '1px', height: '60px', background: BORDER_COLOR, opacity: 0.5 }} />

        <div style={{ display: 'flex', gap: '6px' }}>
          {items.map((item) => (
            <div
              key={item.key}
              style={{
                width: '50px',
                height: '50px',
                background: PANEL_BG,
                border: `1px solid ${BORDER_COLOR}`,
                borderRadius: '8px',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
              }}
            >
              <span style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '9px', color: '#888' }}>
                {item.key}
              </span>
              {item.icon}
              {item.count > 0 && (
                <span style={{ position: 'absolute', bottom: '2px', right: '4px', fontSize: '10px', color: GOLD, fontWeight: 'bold' }}>
                  {item.count}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: isMobile ? '128px' : '28px',
          right: isMobile ? '18px' : '104px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          gap: isMobile ? '4px' : '6px',
          pointerEvents: 'auto',
          zIndex: 100,
        }}
      >
        <button
          onClick={() => setMoveSpeed(prev => prev <= 5 ? Math.max(1, prev - 1) : Math.max(5, prev - 5))}
          style={{
            width: isMobile ? '28px' : '30px',
            height: isMobile ? '20px' : '30px',
            background: 'rgba(8,14,22,0.86)',
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: '6px',
            color: ACCENT,
            fontSize: isMobile ? '13px' : '16px',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >-</button>

        <div
          style={{
            minWidth: isMobile ? '32px' : '52px',
            textAlign: 'center',
            background: 'rgba(8,14,22,0.88)',
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: '7px',
            padding: isMobile ? '3px 4px' : '6px 8px',
            fontFamily: GAME_FONT,
            boxShadow: GLOW,
          }}
        >
          <div style={{ fontSize: isMobile ? '8px' : '9px', color: GOLD, letterSpacing: '0.8px' }}>SPD</div>
          <div style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: '700', color: moveSpeed >= 40 ? '#ff7a7a' : ACCENT }}>
            {Math.round(moveSpeed)}
          </div>
        </div>

        <button
          onClick={() => setMoveSpeed(prev => prev < 5 ? prev + 1 : Math.min(50, prev + 5))}
          style={{
            width: isMobile ? '28px' : '30px',
            height: isMobile ? '20px' : '30px',
            background: 'rgba(8,14,22,0.86)',
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: '6px',
            color: ACCENT,
            fontSize: isMobile ? '13px' : '16px',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >+</button>
      </div>

      {isMobile && (
        <>

          {/* 공격 버튼 */}
          <div
            onClick={() => onSimulateKey('r', true)}
            style={{
              position: 'absolute',
              bottom: '28px',
              right: '18px',
              width: '58px',
              height: '58px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, rgba(255,120,120,0.95), rgba(220,38,38,0.82))',
              border: '1px solid rgba(255,210,180,0.32)',
              boxShadow: '0 10px 24px rgba(220,38,38,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              pointerEvents: 'auto',
            }}
          >
            ⚔
          </div>
        </>
      )}

      {showZoneTitle && (
        <div
          style={{
            position: 'absolute',
            top: '25%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'fadeInOut 3s forwards',
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: GOLD, fontSize: '14px', fontWeight: 'bold', letterSpacing: '4px', marginBottom: '4px' }}>
            NOW ENTERING
          </div>
          <div style={{ color: '#fff', fontSize: isMobile ? '28px' : '48px', fontWeight: 'bold', letterSpacing: '2px' }}>
            {currentDistrict?.name || ''}
          </div>
          {currentDistrict?.name_en && (
            <div style={{ color: '#aaa', fontSize: '18px', marginTop: '4px' }}>{currentDistrict.name_en}</div>
          )}
          <div style={{ width: '200px', height: '1px', background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: '10px' }} />
        </div>
      )}

      {showPartitionTitle && currentPartition && (
        <div
          style={{
            position: 'absolute',
            top: '35%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'fadeInOut 2.2s forwards',
            pointerEvents: 'none',
          }}
        >
          <div style={{ color: ACCENT, fontSize: '12px', fontWeight: '700', letterSpacing: '3px', marginBottom: '4px' }}>
            REGION ENTERED
          </div>
          <div style={{ color: GOLD, fontSize: '12px', marginBottom: '4px' }}>
            {currentPartitionTitle}
          </div>
          <div style={{ color: '#fff', fontSize: isMobile ? '20px' : '30px', fontWeight: '700', textAlign: 'center' }}>
            {currentPartition.display_name}
          </div>
        </div>
      )}

      {/* ===== 사이드바 토글 버튼 ===== */}
      <div
        onClick={() => { setSidebarOpen(v => !v); if (sidebarOpen) setSidebarTab(null); }}
        style={{
          position: 'absolute',
          top: isMobile ? '116px' : '170px',
          right: isMobile ? '10px' : '20px',
          width: '32px',
          height: '32px',
          background: sidebarOpen ? `rgba(19,50,60,0.95)` : 'rgba(8,14,22,0.88)',
          border: `1px solid ${sidebarOpen ? ACCENT : BORDER_COLOR}`,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          pointerEvents: 'auto',
          boxShadow: GLOW,
          transition: 'all 0.15s',
        }}
      >
        {sidebarOpen ? <X size={16} color={ACCENT} /> : <Menu size={16} color={GOLD} />}
      </div>

      {/* ===== 사이드바 패널 ===== */}
      {sidebarOpen && (
        <div
          style={{
            position: 'absolute',
            top: isMobile ? '154px' : '208px',
            right: isMobile ? '10px' : '20px',
            width: isMobile ? '180px' : '220px',
            background: 'linear-gradient(180deg, rgba(5,11,18,0.97), rgba(8,14,22,0.96))',
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: '12px',
            padding: '8px',
            zIndex: 100,
            pointerEvents: 'auto',
            boxShadow: GLOW,
          }}
        >
          {/* 헤더 */}
          <div style={{ fontSize: '10px', color: GOLD, letterSpacing: '2px', fontWeight: '700', padding: '4px 8px 8px', borderBottom: `1px solid ${BORDER_COLOR}` }}>
            MENU
          </div>

          {/* 메뉴 항목들 */}
          {[
            { id: 'editor', Icon: Wrench, label: 'World Editor', color: ACCENT },
            { id: 'stats', Icon: BarChart2, label: 'Stats', color: '#60a5fa' },
            { id: 'items', Icon: Package, label: 'Items', color: '#a78bfa' },
          ].map(({ id, Icon, label, color }) => (
            <div
              key={id}
              onClick={() => setSidebarTab(sidebarTab === id ? null : id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: sidebarTab === id ? 'rgba(103,232,214,0.08)' : 'transparent',
                border: `1px solid ${sidebarTab === id ? ACCENT : 'transparent'}`,
                marginTop: '4px',
                transition: 'all 0.12s',
              }}
            >
              <Icon size={15} color={sidebarTab === id ? ACCENT : color} />
              <span style={{ fontSize: '13px', color: sidebarTab === id ? ACCENT : '#c8e8e2', fontWeight: sidebarTab === id ? '700' : '400' }}>
                {label}
              </span>
            </div>
          ))}

          {/* 서브 패널: World Editor */}
          {sidebarTab === 'editor' && (
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '4px' }}>
              <div style={{ fontSize: '10px', color: '#8ca6a0', marginBottom: '8px' }}>lil-gui 기반 실시간 편집기</div>
              <button
                onClick={() => setWorldEditorOpen(v => !v)}
                style={{
                  width: '100%',
                  padding: '8px',
                  background: worldEditorOpen ? 'rgba(103,232,214,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${worldEditorOpen ? ACCENT : BORDER_COLOR}`,
                  borderRadius: '7px',
                  color: worldEditorOpen ? ACCENT : '#c8e8e2',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  fontFamily: GAME_FONT,
                }}
              >
                <Wrench size={13} /> {worldEditorOpen ? 'Hide Editor' : 'Open Editor'}
              </button>
            </div>
          )}

          {/* 서브 패널: Stats */}
          {sidebarTab === 'stats' && (
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '4px' }}>
              {[
                { label: 'Level', value: playerStats.level, color: GOLD },
                { label: 'HP', value: `${playerStats.hp} / ${playerStats.maxHp}`, color: '#ff6b6b' },
                { label: 'MP', value: `${playerStats.mp} / ${playerStats.maxMp}`, color: '#60a5fa' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: `1px solid rgba(124,171,166,0.1)` }}>
                  <span style={{ color: '#8ca6a0' }}>{label}</span>
                  <span style={{ color, fontWeight: '700' }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* 서브 패널: Items */}
          {sidebarTab === 'items' && (
            <div style={{ padding: '8px 10px', borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '4px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {items.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      padding: '8px',
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${BORDER_COLOR}`,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: item.name ? '#c8e8e2' : '#444',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{item.icon || '▫'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || 'Empty'}</div>
                      {item.count > 0 && <div style={{ color: GOLD, fontSize: '10px' }}>×{item.count}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 구분선 + Home/Leave */}
          <div style={{ borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '8px', paddingTop: '4px' }}>
            <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', color: GOLD, fontSize: '13px' }}>
              <Home size={14} color={GOLD} /> Home
            </div>
            <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', fontSize: '13px' }}>
              <LogOut size={14} color='#ef4444' /> Leave
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameOverlay;
