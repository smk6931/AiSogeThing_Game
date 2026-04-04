import React, { useEffect, useRef, useState } from 'react';
import { Home, LogOut, Settings, Shield, Sword, Users, Zap, Flame, Menu, X, BarChart2, Package, Wrench, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GameCodex from './GameCodex';

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

const LAYER_BUTTONS = [
  { key: 'showOsmMap',              label: '지도',   icon: '🗺', colorOn: 'rgba(30,80,160,0.7)' },
  { key: 'showGroundMesh',          label: '바닥',   icon: '🎨', colorOn: 'rgba(50,150,50,0.7)' },
  { key: 'showSeoulRoads',          label: '도로',   icon: '🛣', colorOn: 'rgba(255,100,0,0.7)' },
  { key: 'showSeoulNature',         label: '지형',   icon: '🌲', colorOn: 'rgba(30,120,50,0.7)' },
  { key: 'showLanduseTextureLayer', label: '용도',   icon: '🧱', colorOn: 'rgba(100,80,180,0.7)' },
  { key: 'showRoadSplitLayer',      label: '분할',   icon: '🧩', colorOn: 'rgba(150,90,200,0.7)' },
  { key: 'showDistrictBoundaries',  label: '경계',   icon: '🏛', colorOn: 'rgba(0,180,200,0.7)' },
  { key: 'showGroupBoundaries',     label: '그룹선', icon: '⬒', colorOn: 'rgba(0,210,220,0.7)' },
  { key: 'showMicroBoundaries',     label: '미세선', icon: '┼', colorOn: 'rgba(240,190,90,0.7)' },
  { key: 'highlightCurrentGroup',   label: '강조',   icon: '✦', colorOn: 'rgba(80,220,180,0.7)' },
  { key: 'showCurrentGroupTexture', label: '그룹텍', icon: '◆', colorOn: 'rgba(220,160,30,0.8)' },
  { key: 'showCullRadius',          label: '컬링선', icon: '⊙', colorOn: 'rgba(255,60,60,0.8)'  },
];
const ROAD_TYPE_BUTTONS = [
  { key: 'major', label: '큰길', icon: '═', colorOn: 'rgba(180,185,195,0.78)' },
  { key: 'mid', label: '중간길', icon: '━', colorOn: 'rgba(120,130,145,0.78)' },
  { key: 'alley', label: '골목', icon: '─', colorOn: 'rgba(125,110,90,0.78)' },
  { key: 'pedestrian', label: '보행', icon: '⋯', colorOn: 'rgba(155,140,100,0.78)' },
  { key: 'service', label: '서비스', icon: '≋', colorOn: 'rgba(90,85,78,0.78)' },
];

const GameOverlay = ({
  myPositionRef,
  onSimulateKey,
  onlineCount = 0,
  myStats,
  monsters = {},
  mapSettings = {},
  currentRegionInfo: regionState = null,
}) => {
  const { user } = useAuth();
  const { moveSpeed, setMoveSpeed } = useGameConfig();
  const navigate = useNavigate();

  const checkMobile = () => true; // 전기기 통일 클린 모바일 HUD
  const [isMobile, setIsMobile] = useState(true);
  const [uiScale, setUiScale] = useState(() => Math.max(1, Math.min(2.2, window.innerWidth / 600)));
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState(null);
  const [sidebarMode, setSidebarMode] = useState('menu');
  const [showLayerPopup, setShowLayerPopup] = useState(false);
  const [showRoadPanel, setShowRoadPanel] = useState(false);
  const [worldEditorOpen, setWorldEditorOpen] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [mapZoom, setMapZoom] = useState(15);
  const [gpsCoords, setGpsCoords] = useState({ lat: GIS_ORIGIN.lat, lng: GIS_ORIGIN.lng });
  const [currentDistrict, setCurrentDistrict] = useState(null);
  const [currentDong, setCurrentDong] = useState(null);
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

    const handleResize = () => {
      setIsMobile(checkMobile());
      setUiScale(Math.max(1, Math.min(2.2, window.innerWidth / 600)));
    };
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
    const nextPartitionKey = regionState?.currentPartition?.partition_key || '';
    if (!nextPartitionKey || nextPartitionKey === lastPartitionRef.current) return;
    lastPartitionRef.current = nextPartitionKey;
    setShowPartitionTitle(true);
    if (partitionTimerRef.current) clearTimeout(partitionTimerRef.current);
    partitionTimerRef.current = setTimeout(() => setShowPartitionTitle(false), 2200);
  }, [regionState?.currentPartition?.partition_key]);

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
  const currentRegionInfo = regionState?.dbRegion || null;
  const currentPartition = regionState?.currentPartition || null;
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
          top: 'max(10px, env(safe-area-inset-top))',
          left: 'max(10px, env(safe-area-inset-left))',
          width: '104px',
          padding: '8px',
          borderRadius: '12px',
          background: PANEL_BG,
          backdropFilter: 'blur(16px)',
          border: `1px solid ${BORDER_COLOR}`,
          boxShadow: GLOW,
          transformOrigin: 'top left',
          transform: `scale(${uiScale})`,
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

      {/* 레이어 토글 버튼 — 미니맵 왼쪽 */}
      <div
        onClick={() => setShowLayerPopup(v => !v)}
        title="레이어 설정"
        style={{
          position: 'absolute',
          top: 'max(10px, env(safe-area-inset-top))',
          right: `calc(max(10px, env(safe-area-inset-right)) + ${Math.round(96 * uiScale + 8)}px)`,
          width: '30px',
          height: '30px',
          borderRadius: '8px',
          background: showLayerPopup ? 'rgba(19,50,60,0.95)' : 'rgba(8,14,22,0.88)',
          border: `1px solid ${showLayerPopup ? ACCENT : BORDER_COLOR}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          pointerEvents: 'auto',
          boxShadow: GLOW,
          fontSize: '15px',
          zIndex: 60,
        }}
      >
        🗺
      </div>

      {/* 레이어 팝업 — 독립 플로팅 패널 (레이어 + 카메라) */}
      {showLayerPopup && (
        <div
          style={{
            position: 'absolute',
            top: `calc(max(10px, env(safe-area-inset-top)) + 36px)`,
            right: `calc(max(10px, env(safe-area-inset-right)) + ${Math.round(96 * uiScale + 8)}px)`,
            width: '164px',
            padding: '10px',
            borderRadius: '12px',
            background: 'linear-gradient(180deg, rgba(10,16,24,0.97), rgba(6,10,18,0.96))',
            border: `1px solid ${BORDER_COLOR}`,
            boxShadow: `${GLOW}, 0 4px 24px rgba(0,0,0,0.6)`,
            pointerEvents: 'auto',
            zIndex: 62,
          }}
        >
          {/* 레이어 섹션 */}
          <div style={{ color: GOLD, fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', marginBottom: '7px', textTransform: 'uppercase' }}>
            Layers
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
            {LAYER_BUTTONS.map(({ key, label, icon, colorOn }) => {
              const isOn = !!mapSettings[key];
              const setterKey = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
              const setter = mapSettings[setterKey];
              return (
                <button
                  key={key}
                  onClick={() => setter && setter(!isOn)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                    padding: '5px 4px',
                    borderRadius: '7px',
                    border: `1px solid ${isOn ? ACCENT : 'rgba(80,100,120,0.3)'}`,
                    background: isOn ? colorOn : 'rgba(10,18,28,0.6)',
                    color: isOn ? '#fff' : 'rgba(150,160,170,0.7)',
                    fontSize: '9px',
                    cursor: 'pointer',
                    fontFamily: GAME_FONT,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
            <div style={{ color: GOLD, fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              Road Types
            </div>
            <button
              onClick={() => setShowRoadPanel(prev => !prev)}
              style={{
                padding: '3px 6px',
                borderRadius: '6px',
                border: `1px solid ${showRoadPanel ? ACCENT : 'rgba(80,100,120,0.3)'}`,
                background: showRoadPanel ? 'rgba(19,50,60,0.9)' : 'rgba(10,18,28,0.6)',
                color: showRoadPanel ? ACCENT : '#9bb6b0',
                fontSize: '9px',
                cursor: 'pointer',
                fontFamily: GAME_FONT,
              }}
            >
              {showRoadPanel ? '닫기' : '세부'}
            </button>
          </div>
          {showRoadPanel && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginBottom: '10px' }}>
              {ROAD_TYPE_BUTTONS.map(({ key, label, icon, colorOn }) => {
                const roadTypeFilters = mapSettings.roadTypeFilters || {};
                const isOn = roadTypeFilters[key] !== false;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      const next = { ...roadTypeFilters, [key]: !isOn };
                      if (mapSettings.setRoadTypeFilters) {
                        mapSettings.setRoadTypeFilters(next);
                      }
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                      padding: '5px 4px',
                      borderRadius: '7px',
                      border: `1px solid ${isOn ? ACCENT : 'rgba(80,100,120,0.3)'}`,
                      background: isOn ? colorOn : 'rgba(10,18,28,0.6)',
                      color: isOn ? '#fff' : 'rgba(150,160,170,0.7)',
                      fontSize: '9px',
                      cursor: 'pointer',
                      fontFamily: GAME_FONT,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 구분선 */}
          <div style={{ borderTop: `1px solid ${BORDER_COLOR}`, marginBottom: '8px' }} />

          {/* 카메라 섹션 */}
          <div style={{ color: GOLD, fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', marginBottom: '7px', textTransform: 'uppercase' }}>
            Camera
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
            <button
              onClick={() => mapSettings.setCameraMode && mapSettings.setCameraMode(prev => prev === 'isometric' ? '360' : 'isometric')}
              style={{
                padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '9px', fontFamily: GAME_FONT,
                background: mapSettings.cameraMode === 'isometric' ? 'rgba(103,232,214,0.2)' : 'rgba(50,50,140,0.5)',
                border: `1px solid ${mapSettings.cameraMode === 'isometric' ? ACCENT : 'rgba(80,100,180,0.5)'}`,
                color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              }}
            >
              <span style={{ fontSize: '14px' }}>🎥</span>
              <span>{mapSettings.cameraMode === 'isometric' ? '쿼터뷰' : '360도'}</span>
            </button>
            <button
              onClick={() => mapSettings.onPlayView && mapSettings.onPlayView()}
              style={{
                padding: '6px 4px', borderRadius: '7px', cursor: 'pointer', fontSize: '9px', fontFamily: GAME_FONT,
                background: 'rgba(180,140,30,0.4)', border: '1px solid rgba(212,175,55,0.4)', color: '#fff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
              }}
            >
              <span style={{ fontSize: '14px' }}>🎮</span>
              <span>플레이뷰</span>
            </button>
          </div>
        </div>
      )}

      {/* 미니맵 */}
      <div
        style={{
          position: 'absolute',
          top: 'max(10px, env(safe-area-inset-top))',
          right: 'max(10px, env(safe-area-inset-right))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '6px',
          transformOrigin: 'top right',
          transform: `scale(${uiScale})`,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '96px',
            height: '76px',
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
              width: '96px',
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

      {/* ===== 이동속도 컨트롤 (우측 하단) ===== */}
      <div
        style={{
          position: 'absolute',
          bottom: '110px',
          right: '18px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '3px',
          pointerEvents: 'auto',
          zIndex: 100,
          transformOrigin: 'bottom right',
          transform: `scale(${uiScale})`,
        }}
      >
        <button
          onClick={() => setMoveSpeed(prev => Math.max(1, prev - 5))}
          style={{ width: '26px', height: '18px', background: 'rgba(8,14,22,0.86)', border: `1px solid ${BORDER_COLOR}`, borderRadius: '5px', color: ACCENT, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >-</button>
        <div style={{ textAlign: 'center', background: 'rgba(8,14,22,0.88)', border: `1px solid ${BORDER_COLOR}`, borderRadius: '6px', padding: '2px 5px', minWidth: '30px' }}>
          <div style={{ fontSize: '7px', color: GOLD }}>SPD</div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: moveSpeed >= 40 ? '#ff7a7a' : ACCENT }}>{Math.round(moveSpeed)}</div>
        </div>
        <button
          onClick={() => setMoveSpeed(prev => Math.min(50, prev + 5))}
          style={{ width: '26px', height: '18px', background: 'rgba(8,14,22,0.86)', border: `1px solid ${BORDER_COLOR}`, borderRadius: '5px', color: ACCENT, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
              transformOrigin: 'bottom right',
              transform: `scale(${uiScale})`,
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
        onClick={() => {
          if (sidebarOpen && sidebarMode === 'menu') {
            setSidebarOpen(false);
            setSidebarTab(null);
            return;
          }
          setSidebarMode('menu');
          setSidebarTab(null);
          setSidebarOpen(true);
        }}
        style={{
          position: 'absolute',
          top: '116px',
          right: '10px',
          width: '32px',
          height: '32px',
          background: (sidebarOpen && sidebarMode === 'menu') ? `rgba(19,50,60,0.95)` : 'rgba(8,14,22,0.88)',
          border: `1px solid ${(sidebarOpen && sidebarMode === 'menu') ? ACCENT : BORDER_COLOR}`,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          pointerEvents: 'auto',
          boxShadow: GLOW,
          transition: 'all 0.15s',
          transformOrigin: 'top right',
          transform: `scale(${uiScale})`,
        }}
      >
        {(sidebarOpen && sidebarMode === 'menu') ? <X size={16} color={ACCENT} /> : <Menu size={16} color={GOLD} />}
      </div>

      {/* ===== 사이드바 패널 ===== */}
      {sidebarOpen && (
        <div
          style={{
            position: 'absolute',
            top: '154px',
            right: '10px',
            width: '200px',
            background: 'linear-gradient(180deg, rgba(5,11,18,0.97), rgba(8,14,22,0.96))',
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: '12px',
            padding: '8px',
            zIndex: 100,
            pointerEvents: 'auto',
            boxShadow: GLOW,
            transformOrigin: 'top right',
            transform: `scale(${uiScale})`,
            maxHeight: `${Math.floor(window.innerHeight / uiScale - 60)}px`,
            overflowY: 'auto',
          }}
        >
          {/* 헤더 */}
          <div style={{ fontSize: '10px', color: GOLD, letterSpacing: '2px', fontWeight: '700', padding: '4px 8px 8px', borderBottom: `1px solid ${BORDER_COLOR}` }}>
            {sidebarMode === 'layers' ? 'LAYERS' : 'MENU'}
          </div>

          {/* 메뉴 항목들 */}
          {sidebarMode === 'menu' && [
            { id: 'settings', Icon: Settings, label: '환경설정', color: ACCENT },
            { id: 'stats',    Icon: BarChart2, label: '스탯',    color: '#60a5fa' },
            { id: 'items',    Icon: Package,   label: '인벤토리', color: '#a78bfa' },
            { id: 'codex',    Icon: BookOpen,  label: '도감',    color: '#fbbf24', action: () => { setShowCodex(true); setSidebarOpen(false); } },
            { id: 'editor',   Icon: Wrench,    label: '월드에디터', color: '#94a3b8' },
          ].map(({ id, Icon, label, color, action }) => (
            <div
              key={id}
              onClick={() => action ? action() : setSidebarTab(sidebarTab === id ? null : id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px',
                borderRadius: '8px',
                cursor: 'pointer',
                background: sidebarTab === id ? 'rgba(103,232,214,0.08)' : 'transparent',
                border: `1px solid ${sidebarTab === id ? ACCENT : 'transparent'}`,
                marginTop: '2px',
                transition: 'all 0.12s',
              }}
            >
              <Icon size={14} color={sidebarTab === id ? ACCENT : color} />
              <span style={{ fontSize: '12px', color: sidebarTab === id ? ACCENT : '#c8e8e2', fontWeight: sidebarTab === id ? '700' : '400' }}>
                {label}
              </span>
            </div>
          ))}

          {/* ===== 서브 패널: 환경설정 (이동속도만, 레이어/카메라는 🗺 팝업으로 이동) ===== */}
          {sidebarTab === 'settings' && (
            <div style={{ padding: '10px', borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '4px' }}>
              <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1.5px', marginBottom: '7px' }}>이동속도</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => setMoveSpeed(p => Math.max(1, p - 5))} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER_COLOR}`, color: ACCENT, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '5px 0', border: `1px solid ${BORDER_COLOR}` }}>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: moveSpeed >= 40 ? '#ff7a7a' : ACCENT }}>{Math.round(moveSpeed)}</span>
                  <span style={{ fontSize: '9px', color: '#6a9a94', marginLeft: '3px' }}>m/s</span>
                </div>
                <button onClick={() => setMoveSpeed(p => Math.min(50, p + 5))} style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: `1px solid ${BORDER_COLOR}`, color: ACCENT, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>
          )}

          {/* ===== 서브 패널: 스탯 ===== */}
          {sidebarTab === 'stats' && (
            <div style={{ padding: '10px', borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '4px' }}>
              <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1.5px', marginBottom: '8px' }}>PLAYER STATS</div>
              {[
                { label: 'Level', value: playerStats.level, color: GOLD, icon: '⭐' },
                { label: 'HP',    value: `${playerStats.hp} / ${playerStats.maxHp}`, color: '#ff6b6b', icon: '❤️' },
                { label: 'MP',    value: `${playerStats.mp} / ${playerStats.maxMp}`, color: '#60a5fa', icon: '💧' },
              ].map(({ label, value, color, icon }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', padding: '6px 4px', borderBottom: `1px solid rgba(124,171,166,0.1)` }}>
                  <span style={{ color: '#8ca6a0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '12px' }}>{icon}</span>{label}
                  </span>
                  <span style={{ color, fontWeight: '700' }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* ===== 서브 패널: 인벤토리 ===== */}
          {sidebarTab === 'items' && (
            <div style={{ padding: '10px', borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '4px' }}>
              <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1.5px', marginBottom: '8px' }}>INVENTORY</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {items.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      padding: '8px 6px',
                      background: item.name ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${item.name ? BORDER_COLOR : 'rgba(80,80,80,0.25)'}`,
                      borderRadius: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10px',
                      color: item.name ? '#c8e8e2' : '#333',
                      cursor: item.name ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{item.icon || '▫'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>{item.name || 'Empty'}</span>
                    {item.count > 0 && <span style={{ color: GOLD, fontSize: '9px' }}>×{item.count}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 서브 패널: 월드에디터 ===== */}
          {sidebarTab === 'editor' && (
            <div style={{ padding: '10px', borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '4px' }}>
              <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1.5px', marginBottom: '8px' }}>WORLD EDITOR</div>
              <div style={{ fontSize: '10px', color: '#6a8a84', marginBottom: '10px', lineHeight: 1.5 }}>
                실시간 씬 편집기 (lil-gui)
              </div>
              <button
                onClick={() => setWorldEditorOpen(v => !v)}
                style={{
                  width: '100%', padding: '9px',
                  background: worldEditorOpen ? 'rgba(103,232,214,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${worldEditorOpen ? ACCENT : BORDER_COLOR}`,
                  borderRadius: '8px',
                  color: worldEditorOpen ? ACCENT : '#8ca6a0',
                  fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  fontFamily: GAME_FONT, transition: 'all 0.15s',
                }}
              >
                <Wrench size={13} />
                {worldEditorOpen ? '에디터 닫기' : '에디터 열기'}
                <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: worldEditorOpen ? 'rgba(103,232,214,0.2)' : 'rgba(255,255,255,0.06)', color: worldEditorOpen ? ACCENT : '#555' }}>
                  {worldEditorOpen ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          )}

          {/* 구분선 + Home/Leave */}
          {sidebarMode === 'menu' && (
          <div style={{ borderTop: `1px solid ${BORDER_COLOR}`, marginTop: '8px', paddingTop: '4px' }}>
            <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', color: GOLD, fontSize: '12px' }}>
              <Home size={13} color={GOLD} /> Home
            </div>
            <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', color: '#ef4444', fontSize: '12px' }}>
              <LogOut size={13} color='#ef4444' /> Leave
            </div>
          </div>
          )}
        </div>
      )}
      {/* ===== 게임 도감 오버레이 ===== */}
      {showCodex && <GameCodex onClose={() => setShowCodex(false)} />}
    </div>
  );
};

export default GameOverlay;
