import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture, OrbitControls, Html, TransformControls, Environment, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import Player from '../entities/Player';
import RemotePlayer from '../entities/RemotePlayer';
import ZoomController from '../core/ZoomController';
import { useAuth } from '@shared/context/AuthContext';
import { PunchProjectile } from '../entities/projectile/PunchProjectile';
import Monster from '../entities/Monster';
import SceneLoader from './SceneLoader';
import WorldDebugger from './WorldDebugger';
import { useState, useMemo } from 'react';

import { getAllMaps, getMap } from './mapConfig';
import Portal from './Portal';
import MapTiles from './MapTiles';
import SeoulHeightMap from './SeoulHeightMap';
import SeoulSubwayLines from './SeoulSubwayLines';
import ZoneOverlay from './ZoneOverlay';
import CityBlockOverlay from './CityBlockOverlay';
import SeoulDistrictOverlay from './SeoulDistrictOverlay';
import { useSeoulDistricts } from '../hooks/useSeoulDistricts';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// 각도 보간 함수 (Shortest path lerp for angles)
const lerpAngle = (start, end, t) => {
  let diff = (end - start) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return start + diff * t;
};

const CameraRig = ({ target, zoomLevel, orbitRef, cameraMode, debugConfig }) => {
  const lastTargetPos = useRef(null);
  const modeRef = useRef(cameraMode);

  useFrame((state, delta) => {
    if (target.current && orbitRef.current) {
      const targetPos = new THREE.Vector3();
      targetPos.copy(target.current.position); // getWorldPosition은 한 프레임 지연을 유발할 수 있으므로 직접 position 사용

      // 모드 변경 감지 및 카메라 초기화
      if (modeRef.current !== cameraMode) {
        modeRef.current = cameraMode;
        lastTargetPos.current = null; // 다음 프레임에 재초기화 유도
      }

      // 1. 첫 프레임 또는 모드 변경 시 초기화
      if (!lastTargetPos.current) {
        lastTargetPos.current = targetPos.clone();

        let cx, cz, baseHeight;

        // 카메라 FOV 실시간 동기화 (PerspectiveCamera에서만)
        if (state.camera.isPerspectiveCamera && state.camera.fov !== debugConfig.cameraFov) {
          state.camera.fov = debugConfig.cameraFov;
          state.camera.updateProjectionMatrix();
        }

        if (cameraMode === 'isometric') {
          // Orthographic은 원근감이 없으므로 거리가 멀어도 크기가 작아지지 않습니다.
          // 지형(산 등)이 near 클리핑 평면에 잘리지 않도록 아주 먼 거리를 기본으로 설정합니다.
          const dist = state.camera.isOrthographicCamera
            ? 10000
            : (debugConfig?.camIsoDistMult || 50) * Math.pow(2, 16.5 - zoomLevel);
          const pitch = ((debugConfig?.camIsoPitch || 15) * Math.PI) / 180;

          cx = targetPos.x;
          cz = targetPos.z + dist * Math.sin(pitch);
          baseHeight = dist * Math.cos(pitch);
        }
        else {
          // 360뷰: 캐릭터 스케일에 맞게 거리 조정
          const dist = state.camera.isOrthographicCamera
            ? 10000
            : 30 * Math.pow(2, 16.5 - zoomLevel);
          const radius = dist * 0.45;
          cx = targetPos.x;
          cz = targetPos.z + radius;
          baseHeight = dist * 0.8;
        }

        state.camera.position.set(cx, targetPos.y + baseHeight, cz);

        orbitRef.current.target.copy(targetPos);
        orbitRef.current.update();
        return;
      }

      // 2. 캐릭터 이동량 만큼 카메라도 이동 (보간/지연 없는 즉시 추적)
      // 이전 타겟 위치와 현재 타겟 위치의 차이를 직접 카메라에 반영
      const currentOffset = new THREE.Vector3().subVectors(state.camera.position, lastTargetPos.current);
      state.camera.position.copy(targetPos).add(currentOffset);

      // 3. OrbitControls의 바라보는 타겟 갱신
      if (orbitRef.current) {
        orbitRef.current.target.copy(targetPos);

        // 카메라 FOV 매 프레임 체크 및 업데이트 (PerspectiveCamera에서만)
        if (state.camera.isPerspectiveCamera && state.camera.fov !== debugConfig.cameraFov) {
          state.camera.fov = debugConfig.cameraFov;
          state.camera.updateProjectionMatrix();
        }

        // 쿼터뷰일 때, 강제로 회전각 고정 (사용자가 드래그해도 돌아감 방지 + 모드 전환 시 즉시 고정)
        if (cameraMode === 'isometric') {
          const az = (debugConfig?.camIsoAzimuth || 0) * (Math.PI / 180);
          const pitch = ((debugConfig?.camIsoPitch || 15) * Math.PI) / 180;
          orbitRef.current.setAzimuthalAngle(az);
          orbitRef.current.setPolarAngle(pitch);
        }

        orbitRef.current.update();
      }

      lastTargetPos.current.copy(targetPos);
    }
  });

  return null;
};


const RpgWorld = ({
  input, otherPlayers = {}, sendPosition, latestChatMap, inputActions,
  sendSkill, projectiles = [], addProjectile, updateProjectile, removeProjectile,
  monsters = {},
  spawnPosition,

  onPortalEncounter,
  sendHit,
  zoomLevel,
  showOsmMap,
  showSeoulRoads,
  showSeoulNature,
  showCityBlocks,
  showLanduseZones,
  landuseFilters = {},
  showHeightMap,
  showDistrictBoundaries = false,
  orbitRef,
  cameraMode
}) => {
  const [debugConfig, setDebugConfig] = useState({
    // 환경
    fogNear: 10,
    fogFar: 800,
    fogColor: '#88ccee',
    ambientIntensity: 0.4,
    hdriUrl: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_02_1k.hdr',


    // 캐릭터
    playerScale: 0.55,

    // 카메라 (공통 및 쿼터뷰)
    isOrthographic: true, // 기본 무원근(투시도 제거)
    cameraFov: 15, // Perspective 모드일 때 사용
    camIsoPitch: 15,
    camIsoAzimuth: 0,
    camIsoDistMult: 50,

    // 지면
    showBaseFloor: false,
    floorColor: '#1a1a1a',
    floorOpacity: 1,
    showGrid: false,
    terrainHeightScale: 1.0, // 1.0 = 실제 비율 (1 게임 유닛 = 1미터)
    terrainBaseHeight: 0.0,
    mapElevation: -0.2,
    baseFloorElevation: -1.0,
    gridElevation: 0.05,

    // 오브젝트
    objectState: {
      position: [15, 0.1, 15],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },

    // OSM 구역 패치 반경
    zoneFetchRadius: 2500
  });

  const [controlMode, setControlMode] = useState('translate');
  const transformGroupRef = useRef();

  // [중요] WorldDebugger의 재생성을 막기 위해 객체 참조 고정
  const debuggerControls = useMemo(() => ({
    mode: controlMode,
    onChange: setControlMode
  }), [controlMode]);

  // [추가] 초기 설정 저장 및 초기화 함수
  const initialConfig = useRef({ ...debugConfig });
  const resetDebugConfig = () => setDebugConfig({ ...initialConfig.current });

  // 특정 파라미터 업데이트 시 리렌더링 강제용 (lil-gui 연동)
  const [, setTick] = useState(0);
  const updateVisuals = () => setTick(t => t + 1);

  // [Zone Painting] ZoneOverlay에서 로드된 데이터를 SeoulHeightMap과 공유
  const [sharedZoneData, setSharedZoneData] = useState(null);

  // 서울 구 경계 데이터 + 현재 구 판별
  const { districts, getDistrictAt } = useSeoulDistricts();
  const [currentDistrictId, setCurrentDistrictId] = useState(null);

  // 플레이어 GPS 위치 기반 현재 구 판별 (1초마다 체크)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerRef.current) return;
      const { x, z } = playerRef.current.position;
      const lat = GIS_ORIGIN.lat - (z / LAT_TO_M);
      const lng = GIS_ORIGIN.lng + (x / LNG_TO_M);
      const found = getDistrictAt(lat, lng);
      if (found && found.id !== currentDistrictId) {
        setCurrentDistrictId(found.id);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [getDistrictAt, currentDistrictId]);

  const playerRef = useRef();
  // [삭제] 인위적인 스케일(15) 대신 현실 미터(0.55) 기반 스케일을 직접 사용합니다.
  const { user } = useAuth();
  const allMaps = getAllMaps();

  const projectilePositions = useRef({});
  const projectileHits = useRef({});

  const handleProjectileUpdate = (id, pos) => {
    projectilePositions.current[id] = pos;
  };

  const handleRemoveProjectile = (id) => {
    if (projectilePositions.current[id]) delete projectilePositions.current[id];
    if (projectileHits.current[id]) delete projectileHits.current[id];
    removeProjectile(id);
  };

  // Logic
  useFrame(({ clock }) => {
    // Projectile vs Monster Collision
    if (projectiles.length > 0 && Object.keys(monsters).length > 0) {
      projectiles.forEach(p => {
        if (p.isRemote) return;
        const currentPos = projectilePositions.current[p.id] || p.position;
        if (!currentPos) return;

        Object.keys(monsters).forEach(mId => {
          const monster = monsters[mId];
          if (!monster || !monster.position) return;
          if (monster.state === 'dead') return;
          if (projectileHits.current[p.id]?.has(mId)) return;

          const dist = Math.sqrt(
            (currentPos.x - monster.position.x) ** 2 +
            (currentPos.z - monster.position.z) ** 2
          );

          if (dist < 3.0) {
            if (sendHit) {
              sendHit({
                monsterId: parseInt(mId),
                damage: 20,
                skillName: 'pyramid_punch'
              });
            }
            if (!projectileHits.current[p.id]) projectileHits.current[p.id] = new Set();
            projectileHits.current[p.id].add(mId);
          }
        });
      });
    }
  });

  return (
    <group>
      {/* ================= 카메라 오버라이드 (투시/무원근) ================= */}
      {debugConfig.isOrthographic ? (
        <OrthographicCamera makeDefault position={[0, 500, 0]} near={1} far={100000} />
      ) : (
        <PerspectiveCamera makeDefault position={[0, 500, 0]} fov={debugConfig.cameraFov} near={1} far={100000} />
      )}

      {/* ================= 조명 및 씬 설정 ================= */}
      {/* 0. lil-gui 디버거 활성화 */}
      <WorldDebugger
        config={debugConfig}
        onUpdate={updateVisuals}
        resetToDefaults={resetDebugConfig}
        playerPos={playerRef.current?.position}
        controls={debuggerControls}
        options={{
          hdriPresets: {
            'Sunset (Default)': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_02_1k.hdr',
            'Meadow': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/meadow_2_1k.hdr',
            'Night': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/st_peters_square_night_1k.hdr',
            'Studio': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr'
          },
          roadPresets: {
            'Checkerboard': 'https://threejs.org/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg',
            'Grid': 'https://threejs.org/examples/textures/grid.png',
            'Grass (Local)': '/textures/grass.png',
            'Rock (Local)': '/textures/rock.png',
            'Sand (Local)': '/textures/sand.png'
          }
        }}
      />

      {/* 0. 오픈월드 분위기를 위한 안개 (먼 곳이 자연스럽게 흐려짐) */}
      <fog attach="fog" args={[debugConfig.fogColor, debugConfig.fogNear, debugConfig.fogFar]} />

      <ambientLight intensity={debugConfig.ambientIntensity} color="#ffffff" />

      {/* 실시간 HDRI 스카이박스 적용 (EnvironmentEffects와 별개로 우선권 가짐) */}
      {debugConfig.hdriUrl && (
        <Environment files={debugConfig.hdriUrl} background />
      )}

      <CameraRig
        target={playerRef}
        zoomLevel={zoomLevel}
        orbitRef={orbitRef}
        cameraMode={cameraMode}
        debugConfig={debugConfig}
      />

      {/* 0. 베이스 지면 (어떠한 맵타일도 없는 곳의 기본 바닥) */}
      {debugConfig.showBaseFloor && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, debugConfig.baseFloorElevation, 0]} receiveShadow>
          <planeGeometry args={[20000, 20000]} />
          <meshStandardMaterial
            color={debugConfig.floorColor}
            roughness={0.8}
            transparent={debugConfig.floorOpacity < 1}
            opacity={debugConfig.floorOpacity}
          />
        </mesh>
      )}

      {/* 배치 도우미 그리드 */}
      {debugConfig.showGrid && (
        <gridHelper args={[2000, 100, '#444444', '#222222']} position={[0, debugConfig.gridElevation, 0]} />
      )}

      {/* [NEW] Three.js Editor와 협업: public/scene.json 파일을 커스텀 배치용으로 사용 */}
      <SceneLoader url="/scene.json" />


      {/* [NEW] 3D 공간의 실제 바닥 지도로 렌더링 */}
      <MapTiles
        playerPos={playerRef.current ? playerRef.current.position : { x: 0, z: 0 }}
        zoomLevel={zoomLevel || 16}
        showOsmMap={showOsmMap}

        cameraMode={cameraMode}
        elevation={debugConfig.mapElevation}
      />

      {/* Zone 오버레이 시스템 (지도 위에 반투명 구역 표시) + 데이터를 SeoulHeightMap에 공급 */}
      <ZoneOverlay
        playerPos={playerRef.current ? playerRef.current.position : { x: 0, z: 0 }}
        visible={(showSeoulRoads || showSeoulNature || showCityBlocks || showLanduseZones)}
        enabledZones={{
          water: showSeoulNature,
          park: showSeoulNature,
          forest: showSeoulNature,
          road_major: showSeoulRoads,
          road_minor: showSeoulRoads,
          residential: showLanduseZones && landuseFilters.residential,
          commercial: showLanduseZones && landuseFilters.commercial,
          industrial: showLanduseZones && landuseFilters.industrial,
          institutional: showLanduseZones && landuseFilters.institutional,
          educational: showLanduseZones && landuseFilters.educational,
          medical: showLanduseZones && landuseFilters.medical,
          parking: showLanduseZones && landuseFilters.parking,
          natural_site: showLanduseZones && landuseFilters.natural_site,
          military: showLanduseZones && landuseFilters.military,
          religious: showLanduseZones && landuseFilters.religious,
          sports: showLanduseZones && landuseFilters.sports,
          cemetery: showLanduseZones && landuseFilters.cemetery,
          transport: showLanduseZones && landuseFilters.transport,
          port: showLanduseZones && landuseFilters.port,
          unexplored: showLanduseZones && landuseFilters.unexplored
        }}
        elevation={debugConfig.mapElevation + 0.1}
        heightScale={debugConfig.terrainHeightScale}
        onZoneLoaded={setSharedZoneData}
        zoneRadius={debugConfig.zoneFetchRadius}
      />

      {/* 등고선 지형 (Zone 데이터로 텍스쳐 페인팅) */}
      <group position={[0, debugConfig.terrainBaseHeight, 0]}>
        <SeoulHeightMap
          visible={showHeightMap}
          playerRef={playerRef}
          heightScale={debugConfig.terrainHeightScale}
          zoneData={sharedZoneData}
        />
      </group>

      <CityBlockOverlay
        zoneData={sharedZoneData}
        visible={showCityBlocks}
        heightScale={debugConfig.terrainHeightScale}
      />

      {/* 서울 구 행정 경계 오버레이 */}
      <SeoulDistrictOverlay
        districts={districts}
        currentDistrictId={currentDistrictId}
        visible={showDistrictBoundaries}
        elevation={debugConfig.mapElevation + 0.3}
      />

      {/* 2. Remote Players (지면보다 높게 렌더링) */}
      {Object.entries(otherPlayers)
        .filter(([id, data]) => user && id !== user.id) // 내 자신은 중복 렌더링 방지
        .map(([id, data]) => (
          <RemotePlayer
            key={id}
            position={{
              x: data.position?.x || 0,
              y: data.position?.y ?? 1, // [수정] 서버에서 받은 Y 고도 사용 (없으면 1)
              z: data.position?.z || 0
            }}
            rotation={data.rotation}
            nickname={data.nickname || 'Unknown'}
            chat={latestChatMap[id]}
            scale={0.55}
          />
        ))}

      {/* 3. Monster Rendering (Culling & Dynamic Texture) */}
      {monsters && Object.keys(monsters).map(key => {
        const m = monsters[key];
        // [Culling] 플레이어와 거리가 너무 먼 몬스터만 렌더링하지 않음 (최적화)
        if (playerRef.current) {
          const dist = Math.sqrt(
            (m.position.x - playerRef.current.position.x) ** 2 +
            (m.position.z - playerRef.current.position.z) ** 2
          );
          // 쿼터뷰 모드일 때는 시야각이 고정되므로 더 공격적인 컬링 적용 (성능 향상)
          const cullDistance = 600;
          if (dist > cullDistance) return null;
        }

        // [Texture] 서버에서 내려준 monsterType 우선 사용, 없으면 거리 기반
        const monsterMap = (m.monsterType !== undefined && allMaps[m.monsterType])
          ? allMaps[m.monsterType]
          : null;

        let targetTexture = monsterMap ? monsterMap.monsterTexture : allMaps[0].monsterTexture;

        // Fallback: 위치 기반 (이미 타입이 결정되었으면 생략 가능하지만 구조 유지용)
        if (!monsterMap) {
          let minMapDist = 99999;
          for (const map of allMaps) {
            const d = Math.sqrt(
              (m.position.x - map.position[0]) ** 2 +
              (m.position.z - map.position[2]) ** 2
            );
            if (d < minMapDist) {
              minMapDist = d;
              targetTexture = map.monsterTexture;
            }
          }
        }

        return (
          <Monster
            key={m.id}
            id={m.id}
            position={m.position}
            hp={m.hp}
            maxHp={m.maxHp}
            state={m.state}
            textureUrl={targetTexture}
            scale={0.55}
          />
        );
      })}



      {/* 1. Local Player (내 닉네임도 표시) */}
      <Player
        ref={playerRef}
        // [수정] 지형 위에 생성되도록 초기 Y를 넉넉히(10m) 잡습니다.
        // 추후 바닥 감지 로직으로 정밀 고착 예정
        position={spawnPosition || [0, 5, 0]}
        input={input}
        actions={inputActions}
        onMove={sendPosition}
        zoomLevel={zoomLevel}
        scale={debugConfig.playerScale}
        nickname={user?.nickname}
        onAction={(pos, rot) => {
          // [수정] 발바닥이 아닌 허리 높이(Y+1.5)에서 발사
          const params = { startPos: { x: pos.x, y: pos.y + 1.5, z: pos.z }, playerRot: rot };
          addProjectile({ ...params, side: 'left' });
          addProjectile({ ...params, side: 'right' });

          if (sendSkill) {
            sendSkill({
              skillName: 'pyramid_punch',
              startPos: { x: pos.x, y: pos.y + 1.5, z: pos.z },
              playerRot: rot
            });
          }
        }}
        chat={user && latestChatMap ? latestChatMap[user.id] : null}
      />

      {projectiles.map(p => (
        <PunchProjectile
          key={p.id}
          id={p.id}
          remove={handleRemoveProjectile}
          onUpdatePosition={(pos) => handleProjectileUpdate(p.id, pos)}
          add={addProjectile}
          scale={0.55}
          {...p}
        />
      ))}
    </group>
  );
};

export default RpgWorld;
