import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Home, LogOut, Settings, Sword, Users, Menu, X, BarChart2, Package, Wrench, BookOpen, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@contexts/AuthContext';
import { useGameConfig } from '@contexts/GameConfigContext';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from '@entity/world/mapConfig';
import { useSeoulDistricts } from '@hooks/useSeoulDistricts';
import { useSeoulDongs } from '@hooks/useSeoulDongs';
import { useIsMobile } from '@hooks/useIsMobile';
import { GAME_FONT, PANEL_BG, BORDER_COLOR, GOLD, ACCENT, GLOW, RARITY_COLOR } from '@ui/overlay/overlayConstants';
import StatusPanel from '@ui/overlay/StatusPanel';
const SkillHotbar = lazy(() => import('@ui/SkillHotbar'));
const SkillPanel = lazy(() => import('@ui/SkillPanel'));

const GameCodex = lazy(() => import('./GameCodex'));
const LeafletMapBackground = lazy(() => import('./LeafletMapBackground'));
const GameSettingsModal = lazy(() => import('./GameSettingsModal'));

const MAP_PLACEHOLDER_STYLE = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(circle at 50% 50%, rgba(20,30,40,0.9), rgba(7,10,14,0.96))',
  color: '#6a9a94',
  fontSize: '10px',
  letterSpacing: '1.2px',
};

const REGION_ENTRY_BG = '/images/ui/region-entry-fantasy-v1.png';
const REGION_ENTRY_VIGNETTE = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(circle at center, rgba(8,12,18,0.12), rgba(4,7,12,0.56) 72%)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  pointerEvents: 'none',
};

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
  { key: 'showGroupColors',         label: '그룹색', icon: '🌈', colorOn: 'rgba(180,80,220,0.75)' },
  { key: 'showGroupArea',           label: '그룹영역', icon: '◩', colorOn: 'rgba(100,180,255,0.75)' },
  { key: 'showPartitionFill',       label: '파티션', icon: '▦', colorOn: 'rgba(255,200,60,0.75)' },
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
  droppedItems = [],
  onClearDrop,
  onInventoryOpen,
  isAutoMode = false,
  onAutoModeToggle,
  gameSettings = {},
  onSettingUpdate,
  onSettingsSave,
  onSettingsReset,
  skillHotbar = null,
  localMp = 100,
}) => {
  const { user } = useAuth();
  const { moveSpeed, setMoveSpeed } = useGameConfig();
  const navigate = useNavigate();

  const isMobile = useIsMobile();
  const [uiScale, setUiScale] = useState(() => Math.max(1, Math.min(2.2, window.innerWidth / 600)));
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState(null);
  const [sidebarMode, setSidebarMode] = useState('menu');
  const [showLayerPopup, setShowLayerPopup] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [showWorldToolsPopup, setShowWorldToolsPopup] = useState(false);
  const [showZoomPopup, setShowZoomPopup] = useState(false);
  const [showRoadPanel, setShowRoadPanel] = useState(false);
  const [showCodex, setShowCodex] = useState(false);
  const [showMobileStatsPopup, setShowMobileStatsPopup] = useState(false);
  const [showSkillPanel, setShowSkillPanel] = useState(false);
  const [mapZoom, setMapZoom] = useState(15);
  const [gpsCoords, setGpsCoords] = useState({ lat: GIS_ORIGIN.lat, lng: GIS_ORIGIN.lng });
  const [currentDistrict, setCurrentDistrict] = useState(null);
  const [currentDong, setCurrentDong] = useState(null);
  const [showZoneTitle, setShowZoneTitle] = useState(false);
  const [showPartitionTitle, setShowPartitionTitle] = useState(false);
  const [showPartitionPanel, setShowPartitionPanel] = useState(false);
  const [topButtonsCollapsed, setTopButtonsCollapsed] = useState(() => window.innerWidth <= 768);

  const lastDistrictRef = useRef('');
  const lastDongRef = useRef('');
  const lastPartitionRef = useRef('');
  const partitionTimerRef = useRef(null);
  const zoneTimerRef = useRef(null);
  const districtInitializedRef = useRef(false);

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
        @keyframes itemDropIn {
          0%   { opacity: 0; transform: translateY(8px); }
          12%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; transform: translateY(-3px); }
          100% { opacity: 0; transform: translateY(-10px); }
        }
      `;
      document.head.appendChild(style);
    }

    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setUiScale(Math.max(1, Math.min(2.2, window.innerWidth / 600)));
      if (!mobile) {
        setTopButtonsCollapsed(false);
      } else {
        setSidebarOpen(false);
        setSidebarTab(null);
      }
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
          if (!districtInitializedRef.current) {
            // 첫 감지: 새로고침 직후 현재 구를 조용히 초기화만 하고 오버레이 띄우지 않음
            districtInitializedRef.current = true;
          } else {
            setShowZoneTitle(true);
            if (zoneTimerRef.current) clearTimeout(zoneTimerRef.current);
            zoneTimerRef.current = setTimeout(() => setShowZoneTitle(false), 3000);
          }
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

  const playerStats = {
    hp: myStats?.hp || 100,
    maxHp: myStats?.maxHp || 100,
    mp: myStats?.mp || 50,
    maxMp: myStats?.maxMp || 50,
    level: myStats?.level || 1,
    exp: myStats?.exp || 0,
    gold: myStats?.gold || 0,
    nickname: user?.nickname || 'Guest',
  };

  const currentRegionInfo = regionState?.dbRegion || null;
  const currentPartition = regionState?.currentPartition || null;
  const currentPartitionTitle = currentPartition?.group_display_name || currentPartition?.display_name || '';
  const currentPartitionTheme = currentPartition?.group_theme_code || currentPartition?.theme_code || '-';
  const showRegionEntryOverlay = gameSettings.showRegionTitle !== false && showZoneTitle;
  const worldEditorOpen = mapSettings.worldEditorOpen ?? false;
  const setWorldEditorOpen = mapSettings.setWorldEditorOpen ?? (() => {});
  const groundTextureFolder = mapSettings.groundTextureFolder ?? '';
  const setGroundTextureFolder = mapSettings.setGroundTextureFolder ?? (() => {});
  const roadTextureFolder = mapSettings.roadTextureFolder ?? '';
  const setRoadTextureFolder = mapSettings.setRoadTextureFolder ?? (() => {});
  const setWorldZoomLevel = mapSettings.setZoomLevel ?? (() => {});
  const availableGroundTextureFolders = mapSettings.availableGroundTextureFolders ?? [];
  const availableRoadTextureFolders = mapSettings.availableRoadTextureFolders ?? [];
  const topToolSize = isMobile ? 28 : 30;
  const topToolStep = isMobile ? 34 : 36;
  const layerButtonOffset = topToolStep;
  const worldButtonOffset = topToolStep * 2;
  const settingsButtonOffset = topToolStep * 3;
  const zoomButtonsOffset = topToolStep * 4;
  const collapseButtonOffset = topToolStep * 5;
  const showTopToolButtons = !isMobile || !topButtonsCollapsed;
  const minimapWidth = isMobile ? 92 : 96;
  const topPanelWidth = isMobile ? '92px' : '104px';
  const topPanelPadding = isMobile ? '7px' : '8px';
  const mobileCombatRight = '18px';
  const mobileCombatBottom = '26px';
  const mobileQuickMenuWidth = isMobile ? `${minimapWidth}px` : 'auto';


  const openSidebarMenu = () => {
    setSidebarMode('menu');
    setSidebarTab(null);
    setSidebarOpen(true);
  };

  const openSidebarTabPanel = (tab) => {
    setSidebarMode('menu');
    setSidebarTab((prev) => prev === tab && sidebarOpen ? null : tab);
    setSidebarOpen(true);
  };

  const toggleMobileStatsPopup = () => {
    setShowMobileStatsPopup((prev) => !prev);
    setShowSettingsPopup(false);
    setShowCodex(false);
  };

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
      {gameSettings.showStatPanel !== false && myStats && (
        <StatusPanel
          playerStats={playerStats}
          isMobile={isMobile}
          uiScale={uiScale}
          topPanelWidth={topPanelWidth}
          topPanelPadding={topPanelPadding}
          isAutoMode={isAutoMode}
          onInventoryOpen={onInventoryOpen}
          onAutoModeToggle={onAutoModeToggle}
        />
      )}

      {/* 아이템 드롭 알림 - 화면 상단 중앙 */}
      {gameSettings.showItemNotif !== false && <div style={{
        position: 'absolute',
        top: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        pointerEvents: 'none',
        zIndex: 120,
        alignItems: 'center',
      }}>
        {droppedItems.slice(-5).map((item) => (
          <div
            key={item.notifId}
            style={{
              background: 'rgba(6,10,18,0.94)',
              border: `1px solid ${RARITY_COLOR[item.rarity] || '#ccc'}`,
              borderRadius: '8px',
              padding: '5px 14px',
              color: RARITY_COLOR[item.rarity] || '#ccc',
              fontSize: '13px',
              fontWeight: '700',
              boxShadow: `0 0 14px ${RARITY_COLOR[item.rarity] || '#ccc'}55`,
              animation: 'itemDropIn 3s ease forwards',
              whiteSpace: 'nowrap',
              letterSpacing: '0.3px',
            }}
          >
            {item.isGold ? `💰 ${item.name_ko}` : `🎁 ${item.name_ko}`}
            {!item.isGold && item.quantity != null && (
              <span style={{ color: '#888', fontWeight: 400, fontSize: '11px' }}> ×{item.quantity}</span>
            )}
          </div>
        ))}
      </div>}

      {isMobile && (
        <div
          onClick={() => {
            setTopButtonsCollapsed((prev) => !prev);
            setShowSettingsPopup(false);
            setShowLayerPopup(false);
            setShowWorldToolsPopup(false);
            setShowZoomPopup(false);
          }}
          title={topButtonsCollapsed ? '툴 버튼 열기' : '툴 버튼 접기'}
          style={{
            position: 'absolute',
            top: 'max(10px, env(safe-area-inset-top))',
            right: `calc(max(10px, env(safe-area-inset-right)) + ${collapseButtonOffset}px)`,
            width: `${topToolSize}px`,
            height: `${topToolSize}px`,
            borderRadius: '8px',
            background: topButtonsCollapsed ? 'rgba(19,50,60,0.95)' : 'rgba(8,14,22,0.88)',
            border: `1px solid ${topButtonsCollapsed ? ACCENT : BORDER_COLOR}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'auto',
            boxShadow: GLOW,
            fontSize: isMobile ? '14px' : '15px',
            zIndex: 61,
          }}
        >
          {topButtonsCollapsed ? <Menu size={15} color={ACCENT} /> : <X size={15} color={GOLD} />}
        </div>
      )}

      {isMobile && showTopToolButtons && (
        <div
          onClick={() => {
            setShowZoomPopup((prev) => !prev);
            setShowSettingsPopup(false);
            setShowLayerPopup(false);
            setShowWorldToolsPopup(false);
          }}
          title="카메라 줌"
          style={{
            position: 'absolute',
            top: 'max(10px, env(safe-area-inset-top))',
            right: `calc(max(10px, env(safe-area-inset-right)) + ${zoomButtonsOffset}px)`,
            width: `${topToolSize}px`,
            height: `${topToolSize}px`,
            borderRadius: '8px',
            background: showZoomPopup ? 'rgba(19,50,60,0.95)' : 'rgba(8,14,22,0.9)',
            border: `1px solid ${showZoomPopup ? ACCENT : BORDER_COLOR}`,
            boxShadow: GLOW,
            color: showZoomPopup ? ACCENT : GOLD,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'auto',
            zIndex: 60,
          }}
        >
          <Search size={isMobile ? 14 : 15} color={showZoomPopup ? ACCENT : GOLD} />
        </div>
      )}

      {isMobile && showTopToolButtons && showZoomPopup && (
        <div
          style={{
            position: 'absolute',
            top: `calc(max(10px, env(safe-area-inset-top)) + 46px)`,
            right: `calc(max(10px, env(safe-area-inset-right)) + ${zoomButtonsOffset}px)`,
            width: '184px',
            padding: '12px',
            borderRadius: '14px',
            background: 'linear-gradient(180deg, rgba(10,16,24,0.97), rgba(6,10,18,0.96))',
            border: `1px solid ${BORDER_COLOR}`,
            boxShadow: `${GLOW}, 0 4px 24px rgba(0,0,0,0.6)`,
            pointerEvents: 'auto',
            zIndex: 62,
          }}
        >
          <div style={{ color: GOLD, fontSize: '10px', fontWeight: '700', letterSpacing: '1.5px', marginBottom: '10px', textTransform: 'uppercase' }}>
            Camera Zoom
          </div>
          <input
            type="range"
            min="6"
            max="23.5"
            step="0.1"
            value={mapSettings.zoomLevel ?? 16.5}
            onChange={(event) => setWorldZoomLevel(Number(event.target.value))}
            style={{
              width: '100%',
              height: '22px',
              accentColor: ACCENT,
              cursor: 'pointer',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '11px', color: '#9bb6b0' }}>
            <span>Far</span>
            <span style={{ color: ACCENT, fontWeight: '700', fontSize: '12px' }}>{(mapSettings.zoomLevel ?? 16.5).toFixed(1)}</span>
            <span>Near</span>
          </div>
          <button
            onClick={() => setWorldZoomLevel(18.5)}
            style={{
              marginTop: '10px',
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              border: `1px solid ${BORDER_COLOR}`,
              background: 'rgba(255,255,255,0.05)',
              color: '#d7ece8',
              fontSize: '12px',
              cursor: 'pointer',
              fontFamily: GAME_FONT,
            }}
          >
            Reset View
          </button>
        </div>
      )}

      {/* 환경설정 버튼 — 레이어 버튼 왼쪽 */}
      {showTopToolButtons && <div
        onClick={() => {
          setShowSettingsPopup(v => !v);
          setShowLayerPopup(false);
          setShowWorldToolsPopup(false);
          setShowZoomPopup(false);
        }}
        title="환경설정"
        style={{
          position: 'absolute',
          top: 'max(10px, env(safe-area-inset-top))',
          right: `calc(max(10px, env(safe-area-inset-right)) + ${settingsButtonOffset}px)`,
          width: `${topToolSize}px`,
          height: `${topToolSize}px`,
          borderRadius: '8px',
          background: showSettingsPopup ? 'rgba(40,30,60,0.95)' : 'rgba(8,14,22,0.88)',
          border: `1px solid ${showSettingsPopup ? '#a78bfa' : BORDER_COLOR}`,
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
        <Settings size={isMobile ? 14 : 15} color={showSettingsPopup ? '#c4b5fd' : GOLD} />
      </div>}

      {/* 환경설정 팝업 */}
      {showSettingsPopup && (
        <Suspense fallback={null}>
          <GameSettingsModal
            settings={gameSettings}
            onUpdate={onSettingUpdate}
            onSave={onSettingsSave}
            onReset={onSettingsReset}
            onClose={() => setShowSettingsPopup(false)}
          />
        </Suspense>
      )}

      {/* 레이어 토글 버튼 — 미니맵 왼쪽 */}
      {showTopToolButtons && <div
        onClick={() => {
          setShowLayerPopup(v => !v);
          setShowSettingsPopup(false);
          setShowWorldToolsPopup(false);
          setShowZoomPopup(false);
        }}
        title="레이어 설정"
        style={{
          position: 'absolute',
          top: 'max(10px, env(safe-area-inset-top))',
          right: `calc(max(10px, env(safe-area-inset-right)) + ${layerButtonOffset}px)`,
          width: `${topToolSize}px`,
          height: `${topToolSize}px`,
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
        <Menu size={isMobile ? 14 : 15} color={showLayerPopup ? ACCENT : GOLD} />
      </div>}

      {/* 레이어 팝업 — 독립 플로팅 패널 (레이어 + 카메라) */}
      {showLayerPopup && (
        <div
          style={{
            position: 'absolute',
            top: `calc(max(10px, env(safe-area-inset-top)) + 36px)`,
            right: `calc(max(10px, env(safe-area-inset-right)) + ${layerButtonOffset}px)`,
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
      {gameSettings.showMinimap !== false && <div
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
            width: `${minimapWidth}px`,
            height: isMobile ? '74px' : '76px',
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
            <Suspense fallback={<div style={MAP_PLACEHOLDER_STYLE}>MAP LOADING</div>}>
              <LeafletMapBackground
                playerPositionRef={myPositionRef}
                zoomLevel={mapZoom}
                districts={districts}
                dongs={dongs}
                currentDistrictId={currentDistrict?.id || null}
                currentDongId={currentDong?.id || null}
                monsters={monsters}
              />
            </Suspense>
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
              width: mobileQuickMenuWidth,
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

        {!isMapExpanded && isMobile && (
          <div
            style={{
              width: mobileQuickMenuWidth,
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '5px',
              pointerEvents: 'auto',
            }}
          >
            {[
              { id: 'stats', icon: BarChart2, label: '스탯', color: '#60a5fa', onClick: toggleMobileStatsPopup },
              { id: 'items', icon: Package, label: '인벤', color: '#a78bfa', onClick: onInventoryOpen },
              { id: 'codex', icon: BookOpen, label: '도감', color: '#fbbf24', onClick: () => { setShowMobileStatsPopup(false); setShowCodex(true); } },
              { id: 'settings', icon: Settings, label: '설정', color: ACCENT, onClick: () => { setShowMobileStatsPopup(false); setShowSettingsPopup(true); } },
            ].map(({ id, icon: Icon, label, color, onClick }) => (
              <button
                key={id}
                onClick={onClick}
                style={{
                  minHeight: '28px',
                  padding: '4px 0',
                  borderRadius: '8px',
                  border: `1px solid ${BORDER_COLOR}`,
                  background: 'rgba(8, 14, 20, 0.9)',
                  color: '#dceeed',
                  boxShadow: GLOW,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1px',
                  fontSize: '8px',
                  fontFamily: GAME_FONT,
                  cursor: 'pointer',
                }}
              >
                <Icon size={11} color={color} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {!isMapExpanded && isMobile && showMobileStatsPopup && (
          <div
            style={{
              width: '154px',
              padding: '10px',
              borderRadius: '12px',
              background: 'linear-gradient(180deg, rgba(5,11,18,0.97), rgba(8,14,22,0.96))',
              border: `1px solid ${BORDER_COLOR}`,
              boxShadow: GLOW,
              color: '#eefaf7',
              pointerEvents: 'auto',
            }}
          >
            <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1.5px', marginBottom: '8px' }}>PLAYER STATS</div>
            {[
              { label: 'Level', value: playerStats.level, color: GOLD, icon: '⭐' },
              { label: 'HP', value: `${playerStats.hp} / ${playerStats.maxHp}`, color: '#ff6b6b', icon: '❤️' },
              { label: 'MP', value: `${playerStats.mp} / ${playerStats.maxMp}`, color: '#60a5fa', icon: '💧' },
              { label: 'Gold', value: `${playerStats.gold}G`, color: GOLD, icon: '💰' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', padding: '5px 2px', borderBottom: '1px solid rgba(124,171,166,0.1)' }}>
                <span style={{ color: '#8ca6a0', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ fontSize: '11px' }}>{icon}</span>{label}
                </span>
                <span style={{ color, fontWeight: '700' }}>{value}</span>
              </div>
            ))}
          </div>
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

      }

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
              <Suspense fallback={<div style={MAP_PLACEHOLDER_STYLE}>MAP LOADING</div>}>
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
              </Suspense>
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

      {/* ── 스킬 퀵슬롯 바 (데스크탑) ── */}
      {!isMobile && skillHotbar && (
        <div
          style={{
            position: 'absolute',
            bottom: '22px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            pointerEvents: 'auto',
            zIndex: 100,
          }}
        >
          <Suspense fallback={null}>
            <SkillHotbar
              slots={skillHotbar.slots}
              getCooldownFraction={skillHotbar.getCooldownFraction}
              canUse={skillHotbar.canUse}
              onSlotDrop={skillHotbar.setSlot}
              mp={localMp}
              maxMp={myStats?.maxMp ?? 100}
              isMobile={false}
            />
          </Suspense>

          {/* 스킬 패널 토글 버튼 */}
          <button
            onClick={() => setShowSkillPanel(prev => !prev)}
            title="스킬 목록"
            style={{
              background: showSkillPanel ? 'rgba(60,100,80,0.85)' : 'rgba(16,26,20,0.75)',
              border: `1px solid ${showSkillPanel ? 'rgba(100,210,150,0.55)' : 'rgba(80,110,90,0.35)'}`,
              borderRadius: 8,
              color: showSkillPanel ? '#80ffb0' : '#8aaa9a',
              fontSize: 11,
              padding: '6px 9px',
              cursor: 'pointer',
              fontFamily: GAME_FONT,
              whiteSpace: 'nowrap',
            }}
          >
            스킬 ▲
          </button>
        </div>
      )}

      {/* ── 스킬 패널 (데스크탑, 토글) ── */}
      {!isMobile && showSkillPanel && skillHotbar && (
        <Suspense fallback={null}>
          <SkillPanel
            playerLevel={myStats?.level ?? 1}
            onClose={() => setShowSkillPanel(false)}
            isMobile={false}
          />
        </Suspense>
      )}

      {/* ===== 이동속도 컨트롤 (우측 하단) ===== */}
      {!isMobile && <div
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
      </div>}

      {isMobile && (
        <>
          <div
            style={{
              position: 'absolute',
              bottom: mobileCombatBottom,
              right: mobileCombatRight,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '10px',
              width: '144px',
              pointerEvents: 'auto',
              zIndex: 101,
            }}
          >
            {/* 스킬 퀵슬롯 (모바일) */}
            {skillHotbar && (
              <Suspense fallback={null}>
                <SkillHotbar
                  slots={skillHotbar.slots}
                  getCooldownFraction={skillHotbar.getCooldownFraction}
                  canUse={skillHotbar.canUse}
                  onSlotDrop={skillHotbar.setSlot}
                  onSlotPress={(idx) => {
                    const keyMap = ['q', 'e', 'r', 'f'];
                    onSimulateKey?.(keyMap[idx], true);
                  }}
                  onSlotRelease={(idx) => {
                    const keyMap = ['q', 'e', 'r', 'f'];
                    onSimulateKey?.(keyMap[idx], false);
                  }}
                  mp={localMp}
                  maxMp={myStats?.maxMp ?? 100}
                  isMobile
                  style={{ flexWrap: 'wrap', width: '110px', justifyContent: 'flex-end' }}
                />
              </Suspense>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
              <button
                onClick={onAutoModeToggle}
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '16px',
                  border: `1px solid ${isAutoMode ? 'rgba(255,170,68,0.8)' : BORDER_COLOR}`,
                  background: isAutoMode ? 'linear-gradient(180deg, rgba(255,140,55,0.25), rgba(120,40,10,0.88))' : 'linear-gradient(180deg, rgba(12,18,26,0.96), rgba(6,10,16,0.94))',
                  boxShadow: isAutoMode ? '0 12px 26px rgba(255,140,55,0.28)' : '0 10px 18px rgba(0,0,0,0.24)',
                  color: isAutoMode ? '#ffd39d' : '#9db7b2',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  cursor: 'pointer',
                  fontFamily: GAME_FONT,
                }}
              >
                <Sword size={16} color={isAutoMode ? '#ffd39d' : '#9db7b2'} />
                <span style={{ fontSize: '8px', fontWeight: '700' }}>{isAutoMode ? '자동ON' : '자동'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 4px',
                  borderRadius: '12px',
                  background: 'rgba(8,14,22,0.88)',
                  border: `1px solid ${BORDER_COLOR}`,
                  boxShadow: GLOW,
                }}
              >
                <button
                  onClick={() => setMoveSpeed(prev => Math.max(1, prev - 5))}
                  style={{ width: '22px', height: '22px', borderRadius: '7px', border: `1px solid ${BORDER_COLOR}`, background: 'rgba(255,255,255,0.04)', color: ACCENT, cursor: 'pointer' }}
                >-</button>
                <div style={{ minWidth: '26px', textAlign: 'center' }}>
                  <div style={{ fontSize: '6px', color: GOLD }}>SPD</div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: moveSpeed >= 40 ? '#ff7a7a' : ACCENT }}>{Math.round(moveSpeed)}</div>
                </div>
                <button
                  onClick={() => setMoveSpeed(prev => Math.min(50, prev + 5))}
                  style={{ width: '22px', height: '22px', borderRadius: '7px', border: `1px solid ${BORDER_COLOR}`, background: 'rgba(255,255,255,0.04)', color: ACCENT, cursor: 'pointer' }}
                >+</button>
              </div>
            </div>
          </div>
        </>
      )}

      {showRegionEntryOverlay && (
        <>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `linear-gradient(180deg, rgba(2,6,10,0.18), rgba(2,6,10,0.44)), url(${REGION_ENTRY_BG})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              pointerEvents: 'none',
              zIndex: 107,
            }}
          />
          <div
            style={{
              ...REGION_ENTRY_VIGNETTE,
              animation: 'fadeInOut 3s forwards',
              zIndex: 108,
            }}
          />
        </>
      )}

      {showZoneTitle && gameSettings.showRegionTitle !== false && (
        <div
          style={{
            position: 'absolute',
            top: '28%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'fadeInOut 3s forwards',
            pointerEvents: 'none',
            zIndex: 109,
            width: isMobile ? '86vw' : 'min(70vw, 720px)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: GOLD, fontSize: isMobile ? '12px' : '14px', fontWeight: 'bold', letterSpacing: '4px', marginBottom: '10px' }}>
            NOW ENTERING
          </div>
          <div style={{ color: '#fff', fontSize: isMobile ? '34px' : '56px', fontWeight: 'bold', letterSpacing: '2px', textShadow: '0 10px 30px rgba(0,0,0,0.45)' }}>
            {currentDistrict?.name || ''}
          </div>
          {currentDistrict?.name_en && (
            <div style={{ color: 'rgba(245,240,226,0.85)', fontSize: isMobile ? '16px' : '20px', marginTop: '8px', letterSpacing: '1px', textShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
              {currentDistrict.name_en}
            </div>
          )}
          <div style={{ width: isMobile ? '160px' : '220px', height: '1px', background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, marginTop: '18px' }} />
        </div>
      )}

      {showPartitionTitle && currentPartition && gameSettings.showRegionTitle !== false && (
        <div
          style={{
            position: 'absolute',
            top: '39%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'fadeInOut 2.2s forwards',
            pointerEvents: 'none',
            zIndex: 109,
            width: isMobile ? '80vw' : 'min(58vw, 620px)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: ACCENT, fontSize: '12px', fontWeight: '700', letterSpacing: '3px', marginBottom: '8px', textShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
            REGION ENTERED
          </div>
          <div style={{ color: GOLD, fontSize: isMobile ? '12px' : '13px', marginBottom: '6px', textShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
            {currentPartitionTitle}
          </div>
          <div style={{ color: '#fff', fontSize: isMobile ? '24px' : '34px', fontWeight: '700', textShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
            {currentPartition.display_name}
          </div>
        </div>
      )}

      {/* ===== 사이드바 토글 버튼 ===== */}
      {!isMobile && <div
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
      </div>}

      {/* ===== 사이드바 패널 ===== */}
      {!isMobile && sidebarOpen && (
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
            { id: 'items',    Icon: Package,   label: '인벤토리', color: '#a78bfa', action: () => { onInventoryOpen?.(); setSidebarOpen(false); } },
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
              <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1.5px', margin: '4px 0 7px' }}>GROUND DIR</div>
              <select
                value={groundTextureFolder}
                onChange={(event) => setGroundTextureFolder(event.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${BORDER_COLOR}`,
                  color: '#d7ece8',
                  fontSize: '11px',
                  fontFamily: GAME_FONT,
                  outline: 'none',
                }}
              >
                <option value="">root</option>
                {availableGroundTextureFolders.map((folder) => (
                  <option key={folder} value={folder}>{folder}</option>
                ))}
              </select>
              <div style={{ fontSize: '10px', color: '#6a8a84', marginTop: '6px', lineHeight: 1.5 }}>
                use `front/public/ground/{groundTextureFolder || 'root'}` as the active floor texture directory
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
      {!isMobile && showTopToolButtons && <div
        onClick={() => {
          setShowWorldToolsPopup(v => !v);
          setShowSettingsPopup(false);
          setShowLayerPopup(false);
          setShowZoomPopup(false);
        }}
        title="월드 툴"
        style={{
          position: 'absolute',
          top: 'max(10px, env(safe-area-inset-top))',
          right: `calc(max(10px, env(safe-area-inset-right)) + ${worldButtonOffset}px)`,
          width: `${topToolSize}px`,
          height: `${topToolSize}px`,
          background: showWorldToolsPopup ? 'rgba(19,50,60,0.95)' : 'rgba(8,14,22,0.88)',
          border: `1px solid ${showWorldToolsPopup ? ACCENT : BORDER_COLOR}`,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          pointerEvents: 'auto',
          boxShadow: GLOW,
          zIndex: 100,
          color: showWorldToolsPopup ? ACCENT : GOLD,
          fontSize: '12px',
          fontWeight: '700',
        }}
      >
        W
      </div>}
      {!isMobile && showWorldToolsPopup && (
        <div
          style={{
            position: 'absolute',
            top: `calc(max(10px, env(safe-area-inset-top)) + 36px)`,
            right: `calc(max(10px, env(safe-area-inset-right)) + ${worldButtonOffset}px)`,
            width: '190px',
            background: 'linear-gradient(180deg, rgba(5,11,18,0.97), rgba(8,14,22,0.96))',
            border: `1px solid ${BORDER_COLOR}`,
            borderRadius: '12px',
            padding: '10px',
            zIndex: 100,
            pointerEvents: 'auto',
            boxShadow: GLOW,
          }}
        >
          <div style={{ fontSize: '10px', color: GOLD, letterSpacing: '2px', fontWeight: '700', marginBottom: '8px' }}>
            WORLD TOOLS
          </div>
          <button
            onClick={() => setWorldEditorOpen(v => !v)}
            style={{
              width: '100%',
              padding: '9px',
              marginBottom: '8px',
              background: worldEditorOpen ? 'rgba(103,232,214,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${worldEditorOpen ? ACCENT : BORDER_COLOR}`,
              borderRadius: '8px',
              color: worldEditorOpen ? ACCENT : '#8ca6a0',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              fontFamily: GAME_FONT,
            }}
          >
            <Wrench size={13} />
            {worldEditorOpen ? 'Editor ON' : 'Editor OFF'}
          </button>
          <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1.5px', marginBottom: '6px' }}>GROUND DIR</div>
          <select
            value={groundTextureFolder}
            onChange={(event) => setGroundTextureFolder(event.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${BORDER_COLOR}`,
              color: '#d7ece8',
              fontSize: '11px',
              fontFamily: GAME_FONT,
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            <option value="" style={{ background: '#111827', color: '#e5e7eb' }}>root</option>
            {availableGroundTextureFolders.map((folder) => (
              <option key={folder} value={folder} style={{ background: '#111827', color: '#e5e7eb' }}>{folder}</option>
            ))}
          </select>
          <div style={{ fontSize: '10px', color: '#6a8a84', marginTop: '6px', lineHeight: 1.5 }}>
            current: {groundTextureFolder || 'root'}
          </div>
          <div style={{ fontSize: '9px', color: GOLD, letterSpacing: '1.5px', margin: '10px 0 6px' }}>ROAD DIR</div>
          <select
            value={roadTextureFolder}
            onChange={(event) => setRoadTextureFolder(event.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${BORDER_COLOR}`,
              color: '#d7ece8',
              fontSize: '11px',
              fontFamily: GAME_FONT,
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          >
            <option value="" style={{ background: '#111827', color: '#e5e7eb' }}>root</option>
            {availableRoadTextureFolders.map((folder) => (
              <option key={folder} value={folder} style={{ background: '#111827', color: '#e5e7eb' }}>{folder}</option>
            ))}
          </select>
          <div style={{ fontSize: '10px', color: '#6a8a84', marginTop: '6px', lineHeight: 1.5 }}>
            current road: {roadTextureFolder || 'root'}
          </div>
        </div>
      )}
      {showCodex && (
        <Suspense fallback={null}>
          <GameCodex onClose={() => setShowCodex(false)} />
        </Suspense>
      )}

    </div>
  );
};

export default GameOverlay;
