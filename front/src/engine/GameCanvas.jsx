import React, { Suspense, lazy, useRef } from 'react';
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
  currentMapId, spawnPosition, onPortalEncounter,
  zoomLevel,
  showOsmMap,
  showSeoulRoads,
  roadTypeFilters,
  showSeoulNature,
  showLanduseTextureLayer,
  showRoadSplitLayer,
  showLanduseZones,
  landuseFilters,
  showHeightMap,
  showGroundMesh,
  showDistrictBoundaries,
  showMicroBoundaries,
  showGroupBoundaries,
  highlightCurrentGroup,
  showCurrentGroupTexture,
  showCullRadius,
  cameraMode,
  onMonsterClick,
  currentRegionInfo,
  worldEditorOpen = false,
}) => {
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
          currentMapId={currentMapId}
          spawnPosition={spawnPosition}
          onPortalEncounter={onPortalEncounter}
          zoomLevel={zoomLevel}
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
          cameraMode={cameraMode}
          onMonsterClick={onMonsterClick}
          currentRegionInfo={currentRegionInfo}
          worldEditorOpen={worldEditorOpen}
          orbitRef={orbitRef}
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

export default GameCanvas;
