import React, { Suspense, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import RpgWorld from '@entity/world/RpgWorld';
import EnvironmentEffects from '@entity/world/EnvironmentEffects';
import ZoomController from '@engine/ZoomController';

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
  showSeoulNature,
  showCityBlocks,
  showLanduseZones,
  landuseFilters,
  showHeightMap,
  showGroundMesh,
  showDistrictBoundaries,
  cameraMode
}) => {
  const orbitRef = useRef();

  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      shadows
      gl={{ preserveDrawingBuffer: false, alpha: true, antialias: true }}
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
          showSeoulNature={showSeoulNature}
          showCityBlocks={showCityBlocks}
          showLanduseZones={showLanduseZones}
          landuseFilters={landuseFilters}
          showHeightMap={showHeightMap}
          showGroundMesh={showGroundMesh}
          showDistrictBoundaries={showDistrictBoundaries}
          cameraMode={cameraMode}
          orbitRef={orbitRef}
        />
      </Suspense>

      <OrbitControls
        ref={orbitRef}
        enablePan={false}
        enableRotate={cameraMode === '360'}
        enableDamping={false} // 캐릭터가 화면 중앙에서 벗어나지 않도록 모든 시점 모드에서 지연 효과 비활성화
        enableZoom={false}
        makeDefault
      />
    </Canvas>
  );
};

export default GameCanvas;
