import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls, OrthographicCamera, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import Player from '@entity/player/Player';
import RemotePlayer from '@entity/player/RemotePlayer';
import ZoomController from '@engine/ZoomController';
import { useAuth } from '@contexts/AuthContext';
import { PunchProjectile } from '@entity/player/projectile/PunchProjectile';
import Monster from '@entity/monster/Monster';
import WorldDebugger from '@entity/world/WorldDebugger';

import { getAllMaps } from '@entity/world/mapConfig';
import MapTiles from '@entity/world/MapTiles';
import SeoulHeightMap from '@entity/world/SeoulHeightMap';
import SeoulSubwayLines from '@entity/world/SeoulSubwayLines';
import ZoneOverlay from '@entity/world/ZoneOverlay';
import CityBlockOverlay from '@entity/world/CityBlockOverlay';
import SeoulDistrictOverlay from '@entity/world/SeoulDistrictOverlay';
import PartitionBoundaryOverlay from '@entity/world/PartitionBoundaryOverlay';
import SeoulTerrain from '@entity/world/SeoulTerrain';
import DongGroundMesh from '@entity/world/DongGroundMesh';
import { useSeoulDistricts } from '@hooks/useSeoulDistricts';
import { useSeoulDongs } from '@hooks/useSeoulDongs';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from '@entity/world/mapConfig';

const ROAD_ATLAS_URL = '/ground/asphalt_atlas_4x4.png';

// 몬스터 컬링 반경 — 이 값 하나만 바꾸면 시각화 원과 실제 렌더 범위 둘 다 반영됨
const MONSTER_CULL_RADIUS = 100;
const MONSTER_CULL_SQ = MONSTER_CULL_RADIUS * MONSTER_CULL_RADIUS;

const CullRadiusIndicator = ({ playerRef }) => {
  const meshRef = useRef();
  useFrame(() => {
    if (meshRef.current && playerRef.current) {
      meshRef.current.position.x = playerRef.current.position.x;
      meshRef.current.position.z = playerRef.current.position.z;
    }
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
      <ringGeometry args={[MONSTER_CULL_RADIUS - 8, MONSTER_CULL_RADIUS, 128]} />
      <meshBasicMaterial color="#ff4444" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
};

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
    // target.current가 없거나 THREE.Object3D가 아니면 실행 중단
    if (!target?.current || !target.current.position) {
      return;
    }

    if (!orbitRef?.current) {
      return;
    }

    const targetPos = new THREE.Vector3();
    targetPos.copy(target.current.position);

    // 모드 변경 감지 및 카메라 초기화
    if (modeRef.current !== cameraMode) {
      modeRef.current = cameraMode;
      lastTargetPos.current = null; // 재초기화 유도
    }

    // 1. 첫 프레임 또는 모드 변경 시 카메라 초기 위치 설정
    if (!lastTargetPos.current) {
      lastTargetPos.current = targetPos.clone();

      if (state.camera.isPerspectiveCamera && state.camera.fov !== debugConfig.cameraFov) {
        state.camera.fov = debugConfig.cameraFov;
        state.camera.updateProjectionMatrix();
      }

      // camera.zoom은 ZoomController가 단독으로 관리 — 여기서는 위치/각도만 설정
      let cx, cz, baseHeight;
      if (cameraMode === 'isometric') {
        const isoDistMult = debugConfig?.camIsoDistMult || 50;
        const dist = state.camera.isOrthographicCamera ? 10000 : isoDistMult * Math.pow(2, 16.5 - zoomLevel);
        const pitch = ((debugConfig?.camIsoPitch || 25) * Math.PI) / 180;
        cx = targetPos.x;
        cz = targetPos.z + dist * Math.sin(pitch);
        baseHeight = dist * Math.cos(pitch);
      } else {
        const playDistMult = debugConfig?.playCamDistMult || 20;
        const playPitch = ((debugConfig?.playCamPitch || 60) * Math.PI) / 180;
        const dist = state.camera.isOrthographicCamera ? 10000 : playDistMult * Math.pow(2, 16.5 - zoomLevel);
        const radius = dist * Math.cos(playPitch);
        cx = targetPos.x;
        cz = targetPos.z + radius;
        baseHeight = dist * Math.sin(playPitch);
      }

      state.camera.position.set(cx, targetPos.y + baseHeight, cz);
      orbitRef.current.target.copy(targetPos);
      orbitRef.current.update();
      return;
    }

    // 2. 캐릭터 이동량만큼 카메라도 이동 (현재 zoom/angle 유지)
    const currentOffset = new THREE.Vector3().subVectors(state.camera.position, lastTargetPos.current);
    state.camera.position.copy(targetPos).add(currentOffset);

    // 3. OrbitControls target 갱신 (angle/zoom은 OrbitControls에 위임)
    orbitRef.current.target.copy(targetPos);

    if (state.camera.isPerspectiveCamera && state.camera.fov !== debugConfig.cameraFov) {
      state.camera.fov = debugConfig.cameraFov;
      state.camera.updateProjectionMatrix();
    }

    if (cameraMode === 'isometric') {
      const az = (debugConfig?.camIsoAzimuth || 0) * (Math.PI / 180);
      const pitch = ((debugConfig?.camIsoPitch || 15) * Math.PI) / 180;
      orbitRef.current.setAzimuthalAngle(az);
      orbitRef.current.setPolarAngle(pitch);
    }

    orbitRef.current.update();
    lastTargetPos.current.copy(targetPos);
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
  roadTypeFilters = {},
  showSeoulNature,
  showLanduseTextureLayer,
  showRoadSplitLayer,
  showLanduseZones,
  landuseFilters = {},
  showHeightMap,
  showGroundMesh,
  showDistrictBoundaries = false,
  showMicroBoundaries = false,
  showGroupBoundaries = true,
  highlightCurrentGroup = true,
  showCurrentGroupTexture = false,
  showCullRadius = false,
  orbitRef,
  cameraMode,
  onMonsterClick,
  currentRegionInfo = null,
}) => {
  const [debugConfig, setDebugConfig] = useState(() => {
    // 1. 브라우저 저장소(localStorage)에서 기존 설정 불러오기 프리뷰
    const saved = localStorage.getItem('world_debug_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved world config', e);
      }
    }

    // 2. 저장된 설정이 없을 때의 기본값
    return {
      // 환경
      fogNear: 10,
      fogFar: 800,
      fogColor: '#88ccee',
      ambientIntensity: 0.4,
      hdriUrl: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_02_1k.hdr',

      // 캐릭터 (기본 모델 높이 약 3.2m 기준)
      playerHeightMeters: 2.0,
      playerScale: 0.625,

      // 카메라 (공통 및 쿼터뷰)
      isOrthographic: true,
      cameraFov: 45,
      camIsoPitch: 25,
      camIsoAzimuth: 0,
      camIsoDistMult: 40, // 초기값 최적화

      // 플레이 뷰 전용 설정
      playCamPitch: 60,
      playCamDistMult: 20,

      // 지면
      showBaseFloor: false,
      floorColor: '#1a1a1a',
      floorOpacity: 1,
      showGrid: false,
      terrainHeightScale: 1.0,
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

      // OSM 구역 패치 반경 및 도로 너비
      zoneFetchRadius: 2500,
      roadWidthMajor: 24,
      roadWidthMid: 12,
      roadWidthMinor: 8
    };
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
  const updateVisuals = () => {
    // Height(m)가 변경되면 Scale 자동 계산
    const BASE_H = 3.2;
    debugConfig.playerScale = debugConfig.playerHeightMeters / BASE_H;
    setTick(t => t + 1);
  };

  // [Zone Painting] ZoneOverlay에서 로드된 데이터를 SeoulHeightMap과 공유
  const [sharedZoneData, setSharedZoneData] = useState(null);

  // 서울 구/동 경계 데이터 + 현재 구/동 판별
  const { districts, getDistrictAt } = useSeoulDistricts();
  const { dongs, getDongAt } = useSeoulDongs();

  const [currentDistrictId, setCurrentDistrictId] = useState(null);
  const [currentDistrict, setCurrentDistrict] = useState(null);
  const [currentDongId, setCurrentDongId] = useState(null);
  const [currentDong, setCurrentDong] = useState(null);

  // 플레이어 GPS 위치 기반 현재 구/동 판별 (1초마다 체크)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerRef.current) return;
      const { x, z } = playerRef.current.position;
      const lat = GIS_ORIGIN.lat - (z / LAT_TO_M);
      const lng = GIS_ORIGIN.lng + (x / LNG_TO_M);

      // 1. 구 판별
      const foundDist = getDistrictAt(lat, lng);
      if (foundDist && foundDist.id !== currentDistrictId) {
        setCurrentDistrictId(foundDist.id);
        setCurrentDistrict(foundDist);
        console.log(`[RpgWorld] 구 전환: ${foundDist.name}`);
      }

      // 2. 동 판별 (LOD 0 스트리밍용)
      const foundDong = getDongAt(lat, lng);
      if (foundDong && foundDong.id !== currentDongId) {
        setCurrentDongId(foundDong.id);
        setCurrentDong(foundDong);
        console.log(`[RpgWorld] 동 전환 (High-Detail): ${foundDong.name}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [getDistrictAt, getDongAt, currentDistrictId, currentDongId]);

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

          const distSq =
            (currentPos.x - monster.position.x) ** 2 +
            (currentPos.z - monster.position.z) ** 2;

          if (distSq < 9.0) { // sqrt 제거: 3.0² = 9.0
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
            'Grass (Local)': '/images/image.png',
            'Rock (Local)': '/images/rock.png',
            'Sand (Local)': '/images/sand.png'
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

      {/* SceneLoader: scene.json이 있을 때만 로드 (현재 미사용) */}
      {/* <SceneLoader url="/scene.json" /> */}

      {/* [NEW] 3D 공간의 실제 바닥 지도로 렌더링 */}
      <MapTiles
        playerPos={playerRef.current ? playerRef.current.position : { x: 0, z: 0 }}
        zoomLevel={zoomLevel || 16}
        showOsmMap={showOsmMap}
        cameraMode={cameraMode}
        elevation={debugConfig.mapElevation}
        districts={districts} // 전체 서울 마스크를 위해 전달
      />

      {/* [NEW] 동 전체 기본 바닥 (Zone/Block 레이어 아래에서 빈 공간을 메움) */}
      <DongGroundMesh
        currentDong={currentDong}
        currentDistrict={currentDistrict}
        elevation={debugConfig.mapElevation + 0.02}
        visible={showGroundMesh}
      />

      {/* 2. [LOD 0] 동 단위 정밀 지형 레이어 (지하철 노선과 조화) */}
      <SeoulTerrain
        visible={showSeoulNature || showSeoulRoads}
        showRoads={showSeoulRoads}
        roadTypeFilters={roadTypeFilters}
        showNature={showSeoulNature}
        roadTextureUrl={ROAD_ATLAS_URL}
        dongId={currentDongId}
        currentDong={currentDong}
        clipToCurrentGroup={showCurrentGroupTexture}
        playerPositionRef={playerRef}
        roadWidthMajor={debugConfig.roadWidthMajor}
        roadWidthMid={debugConfig.roadWidthMid}
        roadWidthMinor={debugConfig.roadWidthMinor}
        elevation={0.05} // 지면보다 살짝 위
        shiftZ={0}
      />

      {/* 3. 지하철 노선도 (레이어 설정에 따라 표시/숨김) */}
      {/* [오해 방지] 초록색 선이 구역 경계선으로 오해되므로 일단 지하철 노선도는 비활성화 */}
      {/* <SeoulSubwayLines visible={showDistrictBoundaries || showSeoulRoads} /> */}

      {/* 4. OSM 구역 오버레이 (용도구역 등 실시간 데이터) */}
      <ZoneOverlay
        visible={(showSeoulRoads || showSeoulNature || showLanduseTextureLayer || showLanduseZones || showRoadSplitLayer || showCurrentGroupTexture)}
        categories={landuseFilters}
        playerPos={playerRef.current ? playerRef.current.position : { x: 0, z: 0 }}
        currentDistrict={currentDistrict}
        dongId={currentDongId}
        currentDong={currentDong}
        onZoneLoaded={setSharedZoneData}
        elevation={debugConfig.mapElevation + 0.1}
        heightScale={debugConfig.terrainHeightScale}
        zoneRadius={debugConfig.zoneFetchRadius}
        roadWidthMajor={debugConfig.roadWidthMajor}
        roadWidthMid={debugConfig.roadWidthMid}
        roadWidthMinor={debugConfig.roadWidthMinor}
        enabledZones={{
          water: showSeoulNature,
          park: showSeoulNature,
          forest: showSeoulNature,
          road_major: false,
          road_minor: false,
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
      />

      {/* 5. 용도별 텍스처 레이어 */}
      <CityBlockOverlay
        zoneData={sharedZoneData}
        visible={showLanduseTextureLayer}
        showOriginalBlocks={true}
        showSectorBlocks={false}
        heightScale={debugConfig.terrainHeightScale}
        currentDistrict={currentDistrict}
        dongId={currentDongId}
        currentDong={currentDong}
        elevation={debugConfig.mapElevation + 0.08}
      />

      {/* 6. 동을 큰도로 기준으로 쪼갠 블록 레이어 */}
      <CityBlockOverlay
        zoneData={sharedZoneData}
        visible={showRoadSplitLayer}
        showOriginalBlocks={false}
        showSectorBlocks={true}
        heightScale={debugConfig.terrainHeightScale}
        currentDistrict={currentDistrict}
        dongId={currentDongId}
        currentDong={currentDong}
        elevation={debugConfig.mapElevation + 0.09}
        playerPositionRef={playerRef}
      />

      {/* 7. 현재 그룹만 텍스처 — 인접 없이 캐릭터 파티션 그룹 단독 렌더 */}
      <CityBlockOverlay
        zoneData={sharedZoneData}
        visible={showCurrentGroupTexture}
        showOriginalBlocks={false}
        showSectorBlocks={true}
        currentGroupOnly={true}
        currentDistrict={currentDistrict}
        dongId={currentDongId}
        currentDong={currentDong}
        elevation={debugConfig.mapElevation + 0.11}
        playerPositionRef={playerRef}
      />

      {/* 등고선 지형 (Zone 데이터로 텍스쳐 페인팅) */}
      <group position={[0, debugConfig.terrainBaseHeight, 0]}>
        <SeoulHeightMap
          visible={showHeightMap}
          playerRef={playerRef}
          heightScale={debugConfig.terrainHeightScale}
          zoneData={sharedZoneData}
          currentDistrict={currentDistrict}
          currentDong={currentDong}
        />
      </group>

      {/* 서울 구 행정 경계 오버레이 */}
      <SeoulDistrictOverlay
        districts={districts}
        currentDistrictId={currentDistrictId}
        currentDongId={currentDongId}
        currentDong={currentDong}
        visible={showDistrictBoundaries}
        elevation={debugConfig.mapElevation + 0.3}
      />

      <PartitionBoundaryOverlay
        currentDong={currentDong}
        visibleMicro={showMicroBoundaries}
        visibleGroup={showGroupBoundaries}
        highlightCurrentGroup={highlightCurrentGroup}
        currentPartitionKey={currentRegionInfo?.currentPartition?.partition_key || null}
        currentGroupKey={currentRegionInfo?.currentPartition?.group_key || null}
        elevation={debugConfig.mapElevation + 0.34}
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
            scale={debugConfig.playerScale}
          />
        ))}

      {/* 3. Monster Rendering — 1km 컬링, 범위 내 없으면 루프 스킵 */}
      {monsters && (() => {
        const monsterKeys = Object.keys(monsters);
        if (monsterKeys.length === 0) return null;

        const playerPos = playerRef.current?.position;
        const CULL_SQ = MONSTER_CULL_SQ;

        // 범위 내 몬스터가 하나라도 있는지 먼저 확인 — 없으면 루프 전체 스킵
        const hasNearby = !playerPos || monsterKeys.some(key => {
          const m = monsters[key];
          if (!m?.position) return false;
          return (m.position.x - playerPos.x) ** 2 + (m.position.z - playerPos.z) ** 2 <= CULL_SQ;
        });
        if (!hasNearby) return null;

        return monsterKeys.map(key => {
          const m = monsters[key];
          if (!m?.position) return null;

          if (playerPos) {
            const distSq =
              (m.position.x - playerPos.x) ** 2 +
              (m.position.z - playerPos.z) ** 2;
            if (distSq > CULL_SQ) return null;
          }

          return (
            <group key={m.id} onClick={(e) => { e.stopPropagation(); onMonsterClick && onMonsterClick(m); }}>
              <Monster
                id={m.id}
                position={m.position}
                hp={m.hp}
                maxHp={m.maxHp}
                state={m.state}
                modelPath={m.modelPath || null}
                tier={m.tier || 'normal'}
                scale={debugConfig.playerScale}
              />
            </group>
          );
        });
      })()}

      {/* 몬스터 컬링 반경 시각화 (디버그) */}
      {showCullRadius && <CullRadiusIndicator playerRef={playerRef} />}



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
          scale={debugConfig.playerScale}
          {...p}
        />
      ))}

      {/* [CRITICAL] CameraRig는 항상 Player 뒤에 위치해야 1프레임 지연 없이 최신 위치를 즉시 추적합니다. */}
      <CameraRig
        target={playerRef}
        zoomLevel={zoomLevel}
        orbitRef={orbitRef}
        cameraMode={cameraMode}
        debugConfig={debugConfig}
      />
    </group>
  );
};

export default RpgWorld;
