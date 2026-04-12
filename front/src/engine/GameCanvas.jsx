import React, { Suspense, lazy, useRef, memo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js';
import ZoomController from '@engine/ZoomController';

const RpgWorld = lazy(() => import('@entity/world/RpgWorld'));
const EnvironmentEffects = lazy(() => import('@entity/world/EnvironmentEffects'));

// 시점 제어용 줌 컨트롤러 (실제 카메라는 RpgWorld에서 동적 렌더링)
const ZoomSystem = ({ zoomLevel }) => {
  return <ZoomController zoomLevel={zoomLevel} />;
};


const GameCanvas = ({
  input, active = true, otherPlayers, sendPosition, latestChatMap, inputActions,
  sendSkill, projectiles, addProjectile, updateProjectile, removeProjectile, monsters,
  sendHit,
  myStats = null,
  skillHotbar = null,
  currentMapId, spawnPosition, onPortalEncounter,
  mapSettings = {},
  onMonsterClick,
  currentRegionInfo,
  isAutoMode = false,
  onAutoModeChange,
  playerDamageEvents = [],
  clearPlayerDamageEvent,
  autoFarmRange = 60,
  autoAttackRange = 30,
}) => {
  const { zoomLevel, cameraMode } = mapSettings;
  const orbitRef = useRef();

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      shadows
      gl={{ preserveDrawingBuffer: false, alpha: true, antialias: true, stencil: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x0a0a0a, 1);
      }}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 10
      }}
    >
      <Suspense fallback={null}>
        <EnvironmentEffects />
      </Suspense>

      <ZoomSystem zoomLevel={zoomLevel} />

      <Suspense fallback={null}>
        <RpgWorld
          input={input}
          otherPlayers={otherPlayers}
          sendPosition={sendPosition}
          latestChatMap={latestChatMap}
          inputActions={inputActions}
          sendSkill={sendSkill}
          projectiles={projectiles}
          addProjectile={addProjectile}
          updateProjectile={updateProjectile}
          removeProjectile={removeProjectile}
          monsters={monsters}
          sendHit={sendHit}
          skillHotbar={skillHotbar}
          currentMapId={currentMapId}
          spawnPosition={spawnPosition}
          onPortalEncounter={onPortalEncounter}
          mapSettings={mapSettings}
          onMonsterClick={onMonsterClick}
          currentRegionInfo={currentRegionInfo}
          orbitRef={orbitRef}
          isAutoMode={isAutoMode}
          onAutoModeChange={onAutoModeChange}
          playerDamageEvents={playerDamageEvents}
          clearPlayerDamageEvent={clearPlayerDamageEvent}
          autoFarmRange={autoFarmRange}
          autoAttackRange={autoAttackRange}
        />
      </Suspense>

      <OrbitControls
        ref={orbitRef}
        enablePan={false}
        enableRotate={cameraMode === '360'}
        enableDamping={false}
        enableZoom={false}
        makeDefault
      />
    </Canvas>
  );
};

export default memo(GameCanvas);
