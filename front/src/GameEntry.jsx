import React, { Suspense, lazy, useState, useEffect, useRef, useCallback } from 'react';
import { Joystick } from 'react-joystick-component';
import { useAuth } from '@contexts/AuthContext';
import { useGameInput } from '@engine/useGameInput';
import { useProjectiles } from '@hooks/useProjectiles';
import { useGameSocket } from '@engine/useGameSocket';
import { useCurrentRegionInfo } from '@hooks/useCurrentRegionInfo';
import { useGameSettings } from '@hooks/useGameSettings';
import GameOverlay from '@ui/GameOverlay';
import ChatBox from '@ui/ChatBox';
import { getMap } from '@entity/world/mapConfig';
import { useGameConfig } from '@contexts/GameConfigContext';
import worldApi from '@api/world';
const WorldMapModal = lazy(() => import('@ui/WorldMapModal'));
const MonsterInfoPanel = lazy(() => import('@entity/monster/MonsterInfoPanel'));
const InventoryModal = lazy(() => import('@ui/InventoryModal'));
const GameCanvas = lazy(() => import('@engine/GameCanvas'));

const CAMERA_STORAGE_KEYS = {
  zoomLevel: 'game_camera_zoom_level',
  cameraMode: 'game_camera_mode',
};

const DEFAULT_ZOOM_LEVEL = 16.5;
const DEFAULT_CAMERA_MODE = 'isometric';

const loadStoredZoomLevel = () => {
  try {
    const raw = Number(localStorage.getItem(CAMERA_STORAGE_KEYS.zoomLevel));
    if (Number.isFinite(raw)) {
      return Math.max(6, Math.min(23.5, raw));
    }
  } catch (_) {}
  return DEFAULT_ZOOM_LEVEL;
};

const loadStoredCameraMode = () => {
  try {
    const raw = localStorage.getItem(CAMERA_STORAGE_KEYS.cameraMode);
    if (raw === 'isometric' || raw === '360') {
      return raw;
    }
  } catch (_) {}
  return DEFAULT_CAMERA_MODE;
};

const clampZoomLevel = (value) => Math.max(6, Math.min(23.5, value));

const GameEntry = () => {
  const { moveSpeed, setMoveSpeed } = useGameConfig();
  const { settings, updateSetting, saveToDb, resetSettings } = useGameSettings();

  const [selectedMonster, setSelectedMonster] = useState(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);

  // Map & Spawn State
  const [currentMapId, setCurrentMapId] = useState('map_0');
  const [spawnPosition, setSpawnPosition] = useState([0, 1, 0]);
  const [isWorldMapOpen, setIsWorldMapOpen] = useState(false);

  // 맵 이동 처리 (실제 이동 - Seamless Teleport)
  const handleMapChange = (mapId, spawnPos) => {
    setCurrentMapId(mapId); // UI 상태 업데이트 (옵션)

    if (spawnPos) {
      setSpawnPosition(spawnPos);
    } else {
      // 맵 ID로 위치 찾아서 이동 (UI 선택 시)
      const targetMap = getMap(mapId);
      if (targetMap) {
        // 해당 맵의 중심으로 이동 (Y=1)
        setSpawnPosition([targetMap.position[0], 1, targetMap.position[2]]);
      } else {
        setSpawnPosition([0, 1, 0]); // Fallback
      }
    }
    setIsWorldMapOpen(false); // 이동 시 모달 닫기
  };

  // 포탈 진입/클릭 시 처리 (모달 열기)
  const handlePortalEncounter = (targetMapId) => {
    console.log("Portal Encountered!", targetMapId);
    setIsWorldMapOpen(true);
  };

  // 1. 투사체 상태 관리 (Socket과 World 양쪽에서 쓰기 위해 상위로 이동)
  const { projectiles, add: addProjectile, update: updateProjectile, remove: removeProjectile } = useProjectiles();

  const { input, actions, handleJoystickMove, skillInput, handleSkillMove, handleSkillStop, simulateKey } = useGameInput();

  // [최적화] 내 캐릭터 위치를 ref로 관리하여 리렌더링 방지
  const myPositionRef = useRef({ x: 0, z: 0 });
  const currentRegionInfo = useCurrentRegionInfo(myPositionRef, true);

  // 2. 소켓에 addProjectile 함수 전달 (남이 쏜 스킬 그리기용)
  const { otherPlayers, sendPosition: originalSendPosition, chatMessages, sendChatMessage, latestChatMap, myStats, setMyStats, sendSkill, monsters, sendHit, sendUseItem, droppedItems, setDroppedItems, playerDamageEvents, clearPlayerDamageEvent } = useGameSocket(addProjectile);

  // 알림 자동 제거 (3초 후)
  useEffect(() => {
    if (droppedItems.length === 0) return;
    const timer = setTimeout(() => {
      setDroppedItems(prev => prev.slice(1));
    }, 3000);
    return () => clearTimeout(timer);
  }, [droppedItems, setDroppedItems]);

  const [zoomLevel, setZoomLevel] = useState(loadStoredZoomLevel);
  const [showOsmMap, setShowOsmMap] = useState(true);
  const [showSeoulRoads, setShowSeoulRoads] = useState(true);
  const [roadTypeFilters, setRoadTypeFilters] = useState({
    major: true,
    mid: true,
    alley: true,
    pedestrian: true,
    service: true,
  });
  const [showSeoulNature, setShowSeoulNature] = useState(false);
  const [showLanduseTextureLayer, setShowLanduseTextureLayer] = useState(false);
  const [showRoadSplitLayer, setShowRoadSplitLayer] = useState(false);
  const [showLanduseZones, setShowLanduseZones] = useState(false);
  const [landuseFilters, setLanduseFilters] = useState({
    residential: true, commercial: true, industrial: true,
    institutional: true, educational: true, medical: true, parking: true,
    natural_site: true, military: true, religious: true, sports: true,
    cemetery: true, transport: true, port: true, unexplored: true
  });
  const [showHeightMap, setShowHeightMap] = useState(false); // [OFF] 등고선 비활성화 (나중에 true로 복원 가능)
  const [showGroundMesh, setShowGroundMesh] = useState(false);
  const [showDistrictBoundaries, setShowDistrictBoundaries] = useState(false);
  const [showMicroBoundaries, setShowMicroBoundaries] = useState(false);
  const [showGroupBoundaries, setShowGroupBoundaries] = useState(true);
  const [highlightCurrentGroup, setHighlightCurrentGroup] = useState(true);
  const [showCurrentGroupTexture, setShowCurrentGroupTexture] = useState(true);
  const [showCullRadius, setShowCullRadius] = useState(false);
  const [cameraMode, setCameraMode] = useState(loadStoredCameraMode); // 'isometric' or '360'
  const [worldEditorOpen, setWorldEditorOpen] = useState(false);
  const [availableGroundTextureFolders, setAvailableGroundTextureFolders] = useState([]);
  const [groundTextureFolder, setGroundTextureFolder] = useState(() => localStorage.getItem('ground_texture_folder') || '');
  const [availableRoadTextureFolders, setAvailableRoadTextureFolders] = useState([]);
  const [roadTextureFolder, setRoadTextureFolder] = useState(() => localStorage.getItem('road_texture_folder') || '');
  const pinchDistanceRef = useRef(null);


  // [복구] 위치 동기화 핸들러
  const handlePositionSync = (pos) => {
    myPositionRef.current = { x: pos.x, z: pos.z };
    if (pos.isServerSync && originalSendPosition) {
      originalSendPosition(pos);
    }
  };

  // I키: 인벤토리 / Z키: 자동사냥 토글
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'i' || e.key === 'I') setInventoryOpen(prev => !prev);
      if (e.key === 'z' || e.key === 'Z') setIsAutoMode(prev => !prev);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 마우스 휠 줌 핸들러
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.target.closest('input, textarea, button')) return;
      e.preventDefault();
      // 모든 휠 이벤트를 ZoomController 단일 경로로 통일 (OrbitControls zoom 비활성화)
      const delta = e.deltaY > 0 ? -0.4 : 0.4;
      setZoomLevel(prev => Math.max(6, Math.min(23.5, prev + delta)));
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const checkMobile = () => true; // 전기기 통일 클린 모바일 HUD
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  // 화면 크기 감지
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchTextureFolders = async () => {
      try {
        const res = await worldApi.getBlockTextureFolders();
        const folders = Array.isArray(res.data) ? res.data : [];
        if (cancelled) return;
        setAvailableGroundTextureFolders(folders);
        if (groundTextureFolder && !folders.includes(groundTextureFolder)) {
          setGroundTextureFolder('');
        }
      } catch (_) {
        if (!cancelled) setAvailableGroundTextureFolders([]);
      }
    };

    fetchTextureFolders();
    return () => { cancelled = true; };
  }, [groundTextureFolder]);

  useEffect(() => {
    if (groundTextureFolder) {
      localStorage.setItem('ground_texture_folder', groundTextureFolder);
    } else {
      localStorage.removeItem('ground_texture_folder');
    }
  }, [groundTextureFolder]);

  useEffect(() => {
    let cancelled = false;

    const fetchTextureFolders = async () => {
      try {
        const res = await worldApi.getRoadTextureFolders();
        const folders = Array.isArray(res.data) ? res.data : [];
        if (cancelled) return;
        setAvailableRoadTextureFolders(folders);
        if (roadTextureFolder && !folders.includes(roadTextureFolder)) {
          setRoadTextureFolder('');
        }
      } catch (_) {
        if (!cancelled) setAvailableRoadTextureFolders([]);
      }
    };

    fetchTextureFolders();
    return () => { cancelled = true; };
  }, [roadTextureFolder]);

  useEffect(() => {
    if (roadTextureFolder) {
      localStorage.setItem('road_texture_folder', roadTextureFolder);
    } else {
      localStorage.removeItem('road_texture_folder');
    }
  }, [roadTextureFolder]);

  useEffect(() => {
    try {
      localStorage.setItem(CAMERA_STORAGE_KEYS.zoomLevel, String(zoomLevel));
    } catch (_) {}
  }, [zoomLevel]);

  useEffect(() => {
    try {
      localStorage.setItem(CAMERA_STORAGE_KEYS.cameraMode, cameraMode);
    } catch (_) {}
  }, [cameraMode]);

  const getTouchDistance = useCallback((touches) => {
    if (!touches || touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }, []);

  const handleTouchStart = useCallback((event) => {
    if (event.touches.length >= 2) {
      pinchDistanceRef.current = getTouchDistance(event.touches);
    }
  }, [getTouchDistance]);

  const handleTouchMove = useCallback((event) => {
    if (event.touches.length < 2) {
      pinchDistanceRef.current = null;
      return;
    }

    const nextDistance = getTouchDistance(event.touches);
    const prevDistance = pinchDistanceRef.current;
    if (!nextDistance || !prevDistance) {
      pinchDistanceRef.current = nextDistance;
      return;
    }

    const delta = nextDistance - prevDistance;
    if (Math.abs(delta) < 4) return;

    event.preventDefault();
    setZoomLevel((prev) => clampZoomLevel(prev + delta * 0.015));
    pinchDistanceRef.current = nextDistance;
  }, [getTouchDistance]);

  const handleTouchEnd = useCallback((event) => {
    pinchDistanceRef.current = event.touches.length >= 2 ? getTouchDistance(event.touches) : null;
  }, [getTouchDistance]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: '#0a0a0a',
      color: 'white',
      touchAction: 'none'
    }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >

      {/* ================= 3D Game World ================= */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <Suspense fallback={null}>
          <GameCanvas
          input={input}
          active={true}
          otherPlayers={otherPlayers}
          sendPosition={handlePositionSync}
          sendSkill={sendSkill}
          monsters={monsters}
          sendHit={sendHit}
          latestChatMap={latestChatMap}
          inputActions={actions}
          projectiles={projectiles}
          addProjectile={addProjectile}
          updateProjectile={updateProjectile}
          removeProjectile={removeProjectile}
          currentMapId={currentMapId}
          spawnPosition={spawnPosition}
          onPortalEncounter={handlePortalEncounter}
          zoomLevel={zoomLevel} // [NEW] 줌 레벨 전달
          showOsmMap={showOsmMap}
          showSeoulRoads={showSeoulRoads}
          roadTypeFilters={roadTypeFilters}
          showSeoulNature={showSeoulNature}
          showLanduseTextureLayer={showLanduseTextureLayer}
          showRoadSplitLayer={showRoadSplitLayer}
          showLanduseZones={showLanduseZones}
          landuseFilters={landuseFilters}
          showHeightMap={showHeightMap}
          showGroundMesh={showGroundMesh}
          showDistrictBoundaries={showDistrictBoundaries}
          showMicroBoundaries={showMicroBoundaries}
          showGroupBoundaries={showGroupBoundaries}
          highlightCurrentGroup={highlightCurrentGroup}
          showCurrentGroupTexture={showCurrentGroupTexture}
          showCullRadius={showCullRadius}
          groundTextureFolder={groundTextureFolder}
          roadTextureFolder={roadTextureFolder}
          cameraMode={cameraMode}
          onMonsterClick={setSelectedMonster}
          currentRegionInfo={currentRegionInfo}
          worldEditorOpen={worldEditorOpen}
          isAutoMode={isAutoMode}
          onAutoModeChange={setIsAutoMode}
          playerDamageEvents={playerDamageEvents}
          clearPlayerDamageEvent={clearPlayerDamageEvent}
          autoFarmRange={settings.autoFarmRange}
          autoAttackRange={settings.autoAttackRange}
          />
        </Suspense>
      </div>

      {/* ================= World Map Modal ================= */}
      {isWorldMapOpen && (
        <div style={{ position: 'absolute', zIndex: 200, inset: 0 }}>
          <Suspense fallback={null}>
            <WorldMapModal
              isOpen={isWorldMapOpen}
              onClose={() => setIsWorldMapOpen(false)}
              onSelectMap={(mapId) => handleMapChange(mapId)}
            />
          </Suspense>
        </div>
      )}

      {/* ================= Game UI Overlay (HP, Skill, Minimap, Stats) ================= */}
      <GameOverlay
        myPositionRef={myPositionRef}
        onSimulateKey={simulateKey}
        onlineCount={otherPlayers ? Object.keys(otherPlayers).length + 1 : 1}
        myStats={myStats}
        monsters={monsters}
        currentRegionInfo={currentRegionInfo}
        availableGroundTextureFolders={availableGroundTextureFolders}
        availableRoadTextureFolders={availableRoadTextureFolders}
        droppedItems={droppedItems}
        onInventoryOpen={() => setInventoryOpen(true)}
        isAutoMode={isAutoMode}
        onAutoModeToggle={() => setIsAutoMode(prev => !prev)}
        gameSettings={settings}
        onSettingUpdate={updateSetting}
        onSettingsSave={saveToDb}
        onSettingsReset={resetSettings}
        mapSettings={{
          zoomLevel, setZoomLevel,
          showOsmMap, setShowOsmMap,
          showSeoulRoads, setShowSeoulRoads,
          roadTypeFilters, setRoadTypeFilters,
          showSeoulNature, setShowSeoulNature,
          showLanduseTextureLayer, setShowLanduseTextureLayer,
          showRoadSplitLayer, setShowRoadSplitLayer,
          showLanduseZones, setShowLanduseZones,
          landuseFilters, setLanduseFilters,
          showGroundMesh, setShowGroundMesh,
          showDistrictBoundaries, setShowDistrictBoundaries,
          showMicroBoundaries, setShowMicroBoundaries,
          showGroupBoundaries, setShowGroupBoundaries,
          highlightCurrentGroup, setHighlightCurrentGroup,
          showCurrentGroupTexture, setShowCurrentGroupTexture,
          showCullRadius, setShowCullRadius,
          groundTextureFolder, setGroundTextureFolder,
          roadTextureFolder, setRoadTextureFolder,
          cameraMode, setCameraMode,
          worldEditorOpen, setWorldEditorOpen,
          onPlayView: () => { setZoomLevel(18.5); setCameraMode('isometric'); },
        }}
      />

      {/* ================= Monster Info Panel ================= */}
      {selectedMonster && (
        <Suspense fallback={null}>
          <MonsterInfoPanel
            monster={selectedMonster}
            onClose={() => setSelectedMonster(null)}
          />
        </Suspense>
      )}

      {/* ================= Inventory Modal ================= */}
      {inventoryOpen && (
        <Suspense fallback={null}>
          <InventoryModal
            onClose={() => setInventoryOpen(false)}
            myStats={myStats}
            onStatsUpdate={setMyStats}
            onUseItem={sendUseItem}
          />
        </Suspense>
      )}

      {/* ================= Chat Box ================= */}
      {settings.showChat !== false && (
        <ChatBox messages={chatMessages} onSend={sendChatMessage} isMobile={isMobile} />
      )}

      {/* ================= Joystick ================= */}
      {settings.showJoystick !== false && (
        <>
          <div style={{
            position: 'absolute',
            bottom: isMobile ? 22 : 30,
            left: isMobile ? 12 : 20,
            zIndex: 90,
            opacity: 0.95,
            width: isMobile ? 124 : 'auto',
            height: isMobile ? 124 : 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: isMobile ? '50%' : 0,
            background: isMobile ? 'radial-gradient(circle, rgba(255,255,255,0.08), rgba(255,255,255,0.01) 68%)' : 'transparent'
          }}>
            <Joystick
              size={isMobile ? 94 : 80}
              sticky={isMobile}
              baseColor={isMobile ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.2)"}
              stickColor={isMobile ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.5)"}
              move={handleJoystickMove}
              stop={handleJoystickMove}
            />
          </div>

          {/* ================= Right Joystick (Skill) ================= */}
          <div style={{
            position: 'absolute',
            bottom: isMobile ? 24 : 30,
            right: isMobile ? 14 : 20,
            zIndex: 90,
            opacity: isMobile ? 0 : 0.8,
            pointerEvents: isMobile ? 'none' : 'auto'
          }}>
            <Joystick
              size={isMobile ? 72 : 80}
              sticky={false}
              baseColor="rgba(255, 0, 0, 0.2)"
              stickColor="rgba(255, 0, 0, 0.5)"
              move={handleSkillMove}
              stop={handleSkillStop}
            />
          </div>
        </>
      )}

      {/* ================= Game Info (Bottom Center) ================= */}
      <div style={{
        position: 'absolute',
        bottom: 25,
        left: 0,
        right: 0,
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 80
      }}>
        <div style={{
          color: 'white',
          textShadow: '1px 1px 2px black',
          fontSize: '12px',
          opacity: 0.7
        }}>
          {/* Use WASD keys or joystick to move */}
        </div>
      </div>

    </div>
  );
};

export default GameEntry;
