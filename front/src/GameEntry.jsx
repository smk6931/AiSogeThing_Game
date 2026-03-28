import React, { useState, useEffect, useRef } from 'react';
import { Joystick } from 'react-joystick-component';
import { useAuth } from '@contexts/AuthContext';
import userApi from '@api/auth';
import { useGameInput } from '@engine/useGameInput';
import { useProjectiles } from '@hooks/useProjectiles';
import { useGameSocket } from '@engine/useGameSocket';
import GameOverlay from '@ui/GameOverlay';
import ChatBox from '@ui/ChatBox';
import WorldMapModal from '@ui/WorldMapModal';
import { getMap } from '@entity/world/mapConfig';
import LeafletMapBackground from '@ui/LeafletMapBackground'; // [NEW] 실시간 지도 모듈
import { loadHeightMap } from '@entity/world/terrainHandler';
import MapControlOverlay from '@ui/MapControlOverlay';
import { useGameConfig } from '@contexts/GameConfigContext';
import GameCanvas from '@engine/GameCanvas';
import MonsterInfoPanel from '@entity/monster/MonsterInfoPanel';

const GameEntry = () => {
  const { moveSpeed, setMoveSpeed } = useGameConfig();

  // Website online count (optional, can be removed if not used)
  const [websiteOnlineCount, setWebsiteOnlineCount] = useState(0);

  const [selectedMonster, setSelectedMonster] = useState(null);

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

  // 2. 소켓에 addProjectile 함수 전달 (남이 쏜 스킬 그리기용)
  const { otherPlayers, sendPosition: originalSendPosition, chatMessages, sendChatMessage, latestChatMap, myStats, sendSkill, monsters, sendHit } = useGameSocket(addProjectile);

  const [zoomLevel, setZoomLevel] = useState(16.5);
  const [showOsmMap, setShowOsmMap] = useState(true);
  const [showSeoulRoads, setShowSeoulRoads] = useState(true);
  const [showSeoulNature, setShowSeoulNature] = useState(true);
  const [showLanduseTextureLayer, setShowLanduseTextureLayer] = useState(true);
  const [showRoadSplitLayer, setShowRoadSplitLayer] = useState(true);
  const [showLanduseZones, setShowLanduseZones] = useState(false);
  const [landuseFilters, setLanduseFilters] = useState({
    residential: true, commercial: true, industrial: true,
    institutional: true, educational: true, medical: true, parking: true,
    natural_site: true, military: true, religious: true, sports: true,
    cemetery: true, transport: true, port: true, unexplored: true
  });
  const [showHeightMap, setShowHeightMap] = useState(false); // [OFF] 등고선 비활성화 (나중에 true로 복원 가능)
  const [showGroundMesh, setShowGroundMesh] = useState(true);
  const [showDistrictBoundaries, setShowDistrictBoundaries] = useState(false);
  const [showMicroBoundaries, setShowMicroBoundaries] = useState(false);
  const [showGroupBoundaries, setShowGroupBoundaries] = useState(true);
  const [highlightCurrentGroup, setHighlightCurrentGroup] = useState(true);
  const [cameraMode, setCameraMode] = useState('isometric'); // 'isometric' or '360'


  // [복구] 위치 동기화 핸들러
  const handlePositionSync = (pos) => {
    myPositionRef.current = { x: pos.x, z: pos.z };
    if (pos.isServerSync && originalSendPosition) {
      originalSendPosition(pos);
    }
  };

  // 마우스 휠 줌 핸들러
  useEffect(() => {
    const handleWheel = (e) => {
      // 입력창(Chat)이나 UI 요소 위에서는 줌 방지
      if (e.target.closest('input, textarea, button')) return;

      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.max(4, Math.min(22, prev + delta)));
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []); // [] 이므로 한 번만 등록됨

  const checkMobile = () => window.innerWidth <= 768 || (window.innerHeight <= 500 && window.innerWidth <= 1024);
  const [isMobile, setIsMobile] = useState(checkMobile());

  // 화면 크기 감지
  useEffect(() => {
    const handleResize = () => setIsMobile(checkMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 접속자 수 폴링 [임시 비활성 - auth 라우터 미연결]
  useEffect(() => {
    // const fetchStatus = async () => {
    //   try {
    //     const response = await userApi.getOnlineStats();
    //     setWebsiteOnlineCount(response.data.online_users);
    //   } catch (error) {
    //     console.error('Status Error:', error);
    //   }
    // };
    // fetchStatus();
    // const interval = setInterval(fetchStatus, 10000);
    // [OFF] 등고선 비활성화 - heightmap 미리 로딩 건너뛰기
    // loadHeightMap();
    // return () => clearInterval(interval);
  }, []);

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
    }}>

      {/* ================= 3D Game World ================= */}
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
          cameraMode={cameraMode}
          onMonsterClick={setSelectedMonster}
        />
      </div>

      {/* ================= World Map Modal ================= */}
      {isWorldMapOpen && (
        <div style={{ position: 'absolute', zIndex: 200, inset: 0 }}>
          <WorldMapModal
            isOpen={isWorldMapOpen}
            onClose={() => setIsWorldMapOpen(false)}
            onSelectMap={(mapId) => handleMapChange(mapId)}
          />
        </div>
      )}

      {/* ================= Game UI Overlay (HP, Skill, Minimap, Stats) ================= */}
      <GameOverlay
        myPositionRef={myPositionRef}
        onSimulateKey={simulateKey}
        onlineCount={otherPlayers ? Object.keys(otherPlayers).length + 1 : 1}
        myStats={myStats}
        monsters={monsters}
      />

      {/* ================= Monster Info Panel ================= */}
      {selectedMonster && (
        <MonsterInfoPanel
          monster={selectedMonster}
          onClose={() => setSelectedMonster(null)}
        />
      )}


      {/* ================= Chat Box ================= */}
      <ChatBox messages={chatMessages} onSend={sendChatMessage} isMobile={isMobile} />

      {/* ================= Map Toggle Control Overlay ================= */}
      <MapControlOverlay
        showOsmMap={showOsmMap} setShowOsmMap={setShowOsmMap}
        showSeoulRoads={showSeoulRoads} setShowSeoulRoads={setShowSeoulRoads}
        showSeoulNature={showSeoulNature} setShowSeoulNature={setShowSeoulNature}
        showLanduseTextureLayer={showLanduseTextureLayer} setShowLanduseTextureLayer={setShowLanduseTextureLayer}
        showRoadSplitLayer={showRoadSplitLayer} setShowRoadSplitLayer={setShowRoadSplitLayer}
        showLanduseZones={showLanduseZones} setShowLanduseZones={setShowLanduseZones}
        landuseFilters={landuseFilters} setLanduseFilters={setLanduseFilters}
        showGroundMesh={showGroundMesh} setShowGroundMesh={setShowGroundMesh}
        showDistrictBoundaries={showDistrictBoundaries} setShowDistrictBoundaries={setShowDistrictBoundaries}
        showMicroBoundaries={showMicroBoundaries} setShowMicroBoundaries={setShowMicroBoundaries}
        showGroupBoundaries={showGroupBoundaries} setShowGroupBoundaries={setShowGroupBoundaries}
        highlightCurrentGroup={highlightCurrentGroup} setHighlightCurrentGroup={setHighlightCurrentGroup}
        cameraMode={cameraMode} setCameraMode={setCameraMode}
        moveSpeed={moveSpeed} setMoveSpeed={setMoveSpeed}
        isMobile={isMobile}
        onPlayView={() => {
          setZoomLevel(18.5); // 캐릭터가 크게 보이도록 줌인
          setCameraMode('isometric');
        }}
      />

      {/* ================= Joystick ================= */}
      <div style={{
        position: 'absolute',
        bottom: 30,
        left: isMobile ? 16 : 20,
        zIndex: 90,
        opacity: 0.8
      }}>
        <Joystick
          size={isMobile ? 72 : 80}
          sticky={false}
          baseColor="rgba(255, 255, 255, 0.2)"
          stickColor="rgba(255, 255, 255, 0.5)"
          move={handleJoystickMove}
          stop={handleJoystickMove}
        />
      </div>

      {/* ================= Right Joystick (Skill) ================= */}
      <div style={{
        position: 'absolute',
        bottom: 30,
        right: isMobile ? 16 : 20,
        zIndex: 90,
        opacity: 0.8
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
