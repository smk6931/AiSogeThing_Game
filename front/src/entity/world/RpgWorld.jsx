import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei/core/OrthographicCamera.js';
import { PerspectiveCamera } from '@react-three/drei/core/PerspectiveCamera.js';
import { Environment } from '@react-three/drei/core/Environment.js';
import * as THREE from 'three';
import Player from '@entity/player/Player';
import RemotePlayer from '@entity/player/RemotePlayer';
import { useAuth } from '@contexts/AuthContext';
import { PunchProjectile } from '@entity/player/projectile/PunchProjectile';
import { MagicOrbProjectile } from '@entity/player/projectile/MagicOrbProjectile';
import Monster from '@entity/monster/Monster';
import { DamageNumber } from '@entity/monster/DamageNumber';
import { useAutoAttack } from '@hooks/useAutoAttack';
import { useAutoFarm } from '@hooks/useAutoFarm';
import { useSeoulDistricts } from '@hooks/useSeoulDistricts';
import { useSeoulDongs } from '@hooks/useSeoulDongs';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from '@entity/world/mapConfig';
import CameraRig from '@entity/world/CameraRig';
import CullRadiusIndicator from '@entity/world/CullRadiusIndicator';

const MapTiles = lazy(() => import('@entity/world/MapTiles'));
const ZoneOverlay = lazy(() => import('@entity/world/ZoneOverlay'));
const CityBlockOverlay = lazy(() => import('@entity/world/CityBlockOverlay'));
const SeoulDistrictOverlay = lazy(() => import('@entity/world/SeoulDistrictOverlay'));
const PartitionBoundaryOverlay = lazy(() => import('@entity/world/PartitionBoundaryOverlay'));
const SeoulTerrain = lazy(() => import('@entity/world/SeoulTerrain'));
const DongGroundMesh = lazy(() => import('@entity/world/DongGroundMesh'));
const WorldDebugger = lazy(() => import('@entity/world/WorldDebugger'));
const SeoulHeightMap = lazy(() => import('@entity/world/SeoulHeightMap'));

const ROAD_ATLAS_URL = '/ground/asphalt_atlas_4x4.png';
const MONSTER_CULL_RADIUS = 100;
const MONSTER_CULL_SQ = MONSTER_CULL_RADIUS * MONSTER_CULL_RADIUS;
const WORLD_STAGE_DELAYS = [0, 120, 260, 420];


const RpgWorld = ({
  input,
  otherPlayers = {},
  sendPosition,
  latestChatMap,
  inputActions,
  sendSkill,
  projectiles = [],
  addProjectile,
  updateProjectile,
  removeProjectile,
  monsters = {},
  spawnPosition,
  sendHit,
  mapSettings = {},
  orbitRef,
  onMonsterClick,
  currentRegionInfo = null,
  isAutoMode = false,
  onAutoModeChange,
  playerDamageEvents = [],
  clearPlayerDamageEvent,
  autoFarmRange = 60,
  autoAttackRange = 30,
}) => {
  const {
    zoomLevel,
    cameraMode,
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
    groundTextureFolder = '',
    roadTextureFolder = '',
    worldEditorOpen = false,
  } = mapSettings;
  const [debugConfig, setDebugConfig] = useState(() => {
    const saved = localStorage.getItem('world_debug_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (error) {
        console.error('Failed to parse saved world config', error);
      }
    }

    return {
      fogNear: 10,
      fogFar: 800,
      fogColor: '#88ccee',
      ambientIntensity: 0.4,
      hdriUrl: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_02_1k.hdr',
      playerHeightMeters: 2.0,
      playerScale: 0.625,
      isOrthographic: true,
      cameraFov: 45,
      camIsoPitch: 25,
      camIsoAzimuth: 0,
      camIsoDistMult: 40,
      playCamPitch: 60,
      playCamDistMult: 20,
      showBaseFloor: false,
      floorColor: '#1a1a1a',
      floorOpacity: 1,
      showGrid: false,
      terrainHeightScale: 1.0,
      terrainBaseHeight: 0.0,
      mapElevation: -0.2,
      baseFloorElevation: -1.0,
      gridElevation: 0.05,
      objectState: {
        position: [15, 0.1, 15],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
      zoneFetchRadius: 2500,
      roadWidthMajor: 24,
      roadWidthMid: 12,
      roadWidthMinor: 8,
    };
  });
  const [controlMode, setControlMode] = useState('translate');
  const [sharedZoneData, setSharedZoneData] = useState(null);
  const [currentDistrictId, setCurrentDistrictId] = useState(null);
  const [currentDistrict, setCurrentDistrict] = useState(null);
  const [currentDongId, setCurrentDongId] = useState(null);
  const [currentDong, setCurrentDong] = useState(null);
  const [worldLoadStage, setWorldLoadStage] = useState(0);
  const [, setTick] = useState(0);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [damageNumbers, setDamageNumbers] = useState([]);

  const playerRef = useRef();
  const projectilePositions = useRef({});
  const projectileHits = useRef({});
  const collisionFrameRef = useRef(0);
  const initialConfig = useRef({ ...debugConfig });
  // monsters를 interval/ref에서 최신값으로 읽기 위한 ref
  const monstersRef = useRef(monsters);
  // 이전 몬스터 HP 추적 (데미지 숫자 감지용)
  const prevMonstersRef = useRef({});
  // 플레이어 피격 이벤트 중복 방지 (stale closure 방어)
  const processedPlayerHitIds = useRef(new Set());

  const { user } = useAuth();
  const { districts, getDistrictAt } = useSeoulDistricts();
  const { getDongAt } = useSeoulDongs();

  const debuggerControls = useMemo(() => ({
    mode: controlMode,
    onChange: setControlMode,
  }), [controlMode]);

  const resetDebugConfig = () => setDebugConfig({ ...initialConfig.current });

  const updateVisuals = () => {
    debugConfig.playerScale = debugConfig.playerHeightMeters / 3.2;
    setTick((tick) => tick + 1);
  };

  // monstersRef 최신값 유지
  useEffect(() => { monstersRef.current = monsters; }, [monsters]);

  // 몬스터 HP 감소 감지 → 데미지 숫자 생성
  useEffect(() => {
    const newDamages = [];
    Object.entries(monsters).forEach(([id, monster]) => {
      const prev = prevMonstersRef.current[id];
      if (prev && prev.hp > 0 && monster.hp < prev.hp) {
        const dmg = prev.hp - monster.hp;
        newDamages.push({
          id: `dmg_${id}_${Date.now()}_${Math.random()}`,
          damage: dmg,
          position: { x: monster.position.x, y: 0, z: monster.position.z },
        });
      }
    });
    if (newDamages.length > 0) {
      setDamageNumbers(prev => [...prev, ...newDamages]);
    }
    prevMonstersRef.current = monsters;
  }, [monsters]);

  const removeDamageNumber = useCallback((id) => {
    setDamageNumbers(prev => prev.filter(d => d.id !== id));
    clearPlayerDamageEvent?.(id);
    processedPlayerHitIds.current.delete(id);
  }, [clearPlayerDamageEvent]);

  // 플레이어 피격 데미지 숫자 — playerRef 위치에 빨간 숫자 표시
  // processedPlayerHitIds ref로 중복 방지 (damageNumbers 클로저 stale 문제 회피)
  useEffect(() => {
    if (!playerDamageEvents.length) return;
    const newDamages = playerDamageEvents
      .filter(e => !processedPlayerHitIds.current.has(e.id))
      .map(e => {
        processedPlayerHitIds.current.add(e.id);
        return {
          id: e.id,
          damage: e.damage,
          position: playerRef.current
            ? { x: playerRef.current.position.x, y: 0, z: playerRef.current.position.z }
            : { x: 0, y: 0, z: 0 },
          isPlayerDamage: true,
        };
      });
    if (newDamages.length > 0) {
      setDamageNumbers(prev => [...prev, ...newDamages]);
    }
  }, [playerDamageEvents]);

  // 타겟 몬스터 사망 시 자동 해제
  useEffect(() => {
    if (!selectedTargetId) return;
    const m = monsters[selectedTargetId];
    if (!m || m.state === 'dead' || m.hp <= 0) setSelectedTargetId(null);
  }, [monsters, selectedTargetId]);

  // ESC: 타겟 해제 + 자동사냥 OFF
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') { setSelectedTargetId(null); onAutoModeChange?.(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAutoModeChange]);

  // 몬스터 본체 클릭은 전투 타겟 선택만 처리
  const handleMonsterClick = useCallback((monster) => {
    setSelectedTargetId(prev => String(prev) === String(monster.id) ? null : String(monster.id));
  }, []);

  // 상세 정보는 이름 옆 정보 버튼으로만 연다
  const handleMonsterInfoClick = useCallback((monster) => {
    onMonsterClick?.(monster);
  }, [onMonsterClick]);

  // 자동사냥 모드 — 가장 가까운 몬스터 자동 타겟
  useAutoFarm({
    isAutoMode,
    monstersRef,
    playerRef,
    setTargetMonsterId: setSelectedTargetId,
    range: autoFarmRange,
  });

  // 자동 공격 훅
  useAutoAttack({
    targetMonsterId: selectedTargetId,
    monstersRef,
    playerRef,
    addProjectile,
    attackRange: autoAttackRange,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (!playerRef.current) return;

      const { x, z } = playerRef.current.position;
      const lat = GIS_ORIGIN.lat - (z / LAT_TO_M);
      const lng = GIS_ORIGIN.lng + (x / LNG_TO_M);

      const nextDistrict = getDistrictAt(lat, lng);
      if (nextDistrict && nextDistrict.id !== currentDistrictId) {
        setCurrentDistrictId(nextDistrict.id);
        setCurrentDistrict(nextDistrict);
        console.log(`[RpgWorld] district changed: ${nextDistrict.name}`);
      }

      const nextDong = getDongAt(lat, lng);
      if (nextDong && nextDong.id !== currentDongId) {
        setCurrentDongId(nextDong.id);
        setCurrentDong(nextDong);
        console.log(`[RpgWorld] dong changed: ${nextDong.name}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentDistrictId, currentDongId, getDistrictAt, getDongAt]);

  useEffect(() => {
    setWorldLoadStage(0);
    const timers = WORLD_STAGE_DELAYS.slice(1).map((delay, index) => (
      window.setTimeout(() => setWorldLoadStage(index + 1), delay)
    ));
    return () => timers.forEach(window.clearTimeout);
  }, [currentDistrictId, currentDongId]);

  const visibleMonsterElements = useMemo(() => {
    const monsterKeys = Object.keys(monsters);
    if (monsterKeys.length === 0) return null;

    const playerPos = playerRef.current?.position;

    return monsterKeys.map((key) => {
      const monster = monsters[key];
      if (!monster?.position) return null;

      if (playerPos) {
        const distSq = (monster.position.x - playerPos.x) ** 2 + (monster.position.z - playerPos.z) ** 2;
        if (distSq > MONSTER_CULL_SQ) return null;
      }

      return (
        <group key={monster.id} onClick={(event) => { event.stopPropagation(); handleMonsterClick(monster); }}>
          <Monster
            id={monster.id}
            position={monster.position}
            hp={monster.hp}
            maxHp={monster.maxHp}
            state={monster.state}
            modelPath={monster.modelPath || null}
            tier={monster.tier || 'normal'}
            scale={debugConfig.playerScale}
            isTargeted={String(selectedTargetId) === String(monster.id)}
            onInfoClick={() => handleMonsterInfoClick(monster)}
          />
        </group>
      );
    });
  }, [monsters, selectedTargetId, handleMonsterClick, handleMonsterInfoClick, debugConfig.playerScale]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProjectileUpdate = (id, pos) => {
    projectilePositions.current[id] = pos;
  };

  const handleRemoveProjectile = (id) => {
    delete projectilePositions.current[id];
    delete projectileHits.current[id];
    removeProjectile(id);
  };

  useFrame(() => {
    collisionFrameRef.current = (collisionFrameRef.current + 1) % 2;
    if (collisionFrameRef.current !== 0) return;
    if (projectiles.length === 0 || Object.keys(monsters).length === 0) return;

    projectiles.forEach((projectile) => {
      // magic_orb는 컴포넌트 내부에서 자체 충돌 처리
      if (projectile.type === 'magic_orb') return;
      if (projectile.isRemote) return;
      const currentPos = projectilePositions.current[projectile.id] || projectile.position;
      if (!currentPos) return;

      Object.keys(monsters).forEach((monsterId) => {
        const monster = monsters[monsterId];
        if (!monster?.position || monster.state === 'dead') return;
        if (projectileHits.current[projectile.id]?.has(monsterId)) return;

        const distSq =
          (currentPos.x - monster.position.x) ** 2 +
          (currentPos.z - monster.position.z) ** 2;

        if (distSq < 9.0) {
          sendHit?.({
            monsterId: parseInt(monsterId, 10),
            damage: 20,
            skillName: 'pyramid_punch',
          });
          if (!projectileHits.current[projectile.id]) projectileHits.current[projectile.id] = new Set();
          projectileHits.current[projectile.id].add(monsterId);
        }
      });
    });
  });

  return (
    <group>
      {debugConfig.isOrthographic ? (
        <OrthographicCamera makeDefault position={[0, 500, 0]} near={1} far={100000} />
      ) : (
        <PerspectiveCamera makeDefault position={[0, 500, 0]} fov={debugConfig.cameraFov} near={1} far={100000} />
      )}

      {worldEditorOpen && (
        <Suspense fallback={null}>
          <WorldDebugger
            config={debugConfig}
            onUpdate={updateVisuals}
            resetToDefaults={resetDebugConfig}
            playerPos={playerRef.current?.position}
            controls={debuggerControls}
            options={{
              hdriPresets: {
                'Sunset (Default)': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_02_1k.hdr',
                Meadow: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/meadow_2_1k.hdr',
                Night: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/st_peters_square_night_1k.hdr',
                Studio: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr',
              },
            }}
          />
        </Suspense>
      )}

      <fog attach="fog" args={[debugConfig.fogColor, debugConfig.fogNear, debugConfig.fogFar]} />
      <ambientLight intensity={debugConfig.ambientIntensity} color="#ffffff" />

      {debugConfig.hdriUrl && (
        <Environment files={debugConfig.hdriUrl} background />
      )}

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

      {debugConfig.showGrid && (
        <gridHelper args={[2000, 100, '#444444', '#222222']} position={[0, debugConfig.gridElevation, 0]} />
      )}

      <Suspense fallback={null}>
        <MapTiles
          playerPos={playerRef.current ? playerRef.current.position : { x: 0, z: 0 }}
          zoomLevel={zoomLevel || 16}
          showOsmMap={showOsmMap}
          cameraMode={cameraMode}
          elevation={debugConfig.mapElevation}
          districts={districts}
        />
      </Suspense>

      {worldLoadStage >= 1 && (
        <Suspense fallback={null}>
          <DongGroundMesh
            currentDong={currentDong}
            currentDistrict={currentDistrict}
            elevation={debugConfig.mapElevation + 0.02}
            visible={showGroundMesh}
          />
        </Suspense>
      )}

      {worldLoadStage >= 2 && (
        <Suspense fallback={null}>
          <SeoulTerrain
            visible={showSeoulNature || showSeoulRoads}
            showRoads={showSeoulRoads}
            roadTypeFilters={roadTypeFilters}
            roadTextureFolder={roadTextureFolder}
            showNature={showSeoulNature}
            roadTextureUrl={ROAD_ATLAS_URL}
            dongId={currentDongId}
            currentDong={currentDong}
            clipToCurrentGroup={showCurrentGroupTexture}
            playerPositionRef={playerRef}
            roadWidthMajor={debugConfig.roadWidthMajor}
            roadWidthMid={debugConfig.roadWidthMid}
            roadWidthMinor={debugConfig.roadWidthMinor}
            elevation={0.05}
            shiftZ={0}
          />
        </Suspense>
      )}

      {worldLoadStage >= 2 && (
        <Suspense fallback={null}>
          <ZoneOverlay
            visible={showSeoulRoads || showSeoulNature || showLanduseTextureLayer || showLanduseZones || showRoadSplitLayer || showCurrentGroupTexture}
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
              unexplored: false,
            }}
          />
        </Suspense>
      )}

      {worldLoadStage >= 3 && (
        <Suspense fallback={null}>
          <CityBlockOverlay
            zoneData={sharedZoneData}
            visible={showLanduseTextureLayer}
            showOriginalBlocks
            showSectorBlocks={false}
            textureFolder={groundTextureFolder}
            heightScale={debugConfig.terrainHeightScale}
            currentDistrict={currentDistrict}
            dongId={currentDongId}
            currentDong={currentDong}
            elevation={debugConfig.mapElevation + 0.08}
          />
        </Suspense>
      )}

      {worldLoadStage >= 3 && (
        <Suspense fallback={null}>
          <CityBlockOverlay
            zoneData={sharedZoneData}
            visible={showRoadSplitLayer}
            showOriginalBlocks={false}
            showSectorBlocks
            textureFolder={groundTextureFolder}
            heightScale={debugConfig.terrainHeightScale}
            currentDistrict={currentDistrict}
            dongId={currentDongId}
            currentDong={currentDong}
            elevation={debugConfig.mapElevation + 0.09}
            playerPositionRef={playerRef}
          />
        </Suspense>
      )}

      {worldLoadStage >= 3 && (
        <Suspense fallback={null}>
          <CityBlockOverlay
            zoneData={sharedZoneData}
            visible={showCurrentGroupTexture}
            showOriginalBlocks={false}
            showSectorBlocks
            currentGroupOnly
            textureFolder={groundTextureFolder}
            currentDistrict={currentDistrict}
            dongId={currentDongId}
            currentDong={currentDong}
            elevation={debugConfig.mapElevation + 0.11}
            playerPositionRef={playerRef}
          />
        </Suspense>
      )}

      {showHeightMap && (
        <group position={[0, debugConfig.terrainBaseHeight, 0]}>
          <Suspense fallback={null}>
            <SeoulHeightMap
              visible={showHeightMap}
              playerRef={playerRef}
              heightScale={debugConfig.terrainHeightScale}
              zoneData={sharedZoneData}
              currentDistrict={currentDistrict}
              currentDong={currentDong}
            />
          </Suspense>
        </group>
      )}

      {worldLoadStage >= 1 && (
        <Suspense fallback={null}>
          <SeoulDistrictOverlay
            districts={districts}
            currentDistrictId={currentDistrictId}
            currentDongId={currentDongId}
            currentDong={currentDong}
            visible={showDistrictBoundaries}
            elevation={debugConfig.mapElevation + 0.3}
          />
        </Suspense>
      )}

      {worldLoadStage >= 1 && (
        <Suspense fallback={null}>
          <PartitionBoundaryOverlay
            currentDong={currentDong}
            visibleMicro={showMicroBoundaries}
            visibleGroup={showGroupBoundaries}
            highlightCurrentGroup={highlightCurrentGroup}
            currentPartitionKey={currentRegionInfo?.currentPartition?.partition_key || null}
            currentGroupKey={currentRegionInfo?.currentPartition?.group_key || null}
            elevation={debugConfig.mapElevation + 0.34}
          />
        </Suspense>
      )}

      {Object.entries(otherPlayers)
        .filter(([id]) => user && id !== user.id)
        .map(([id, data]) => (
          <RemotePlayer
            key={id}
            position={{
              x: data.position?.x || 0,
              y: data.position?.y ?? 1,
              z: data.position?.z || 0,
            }}
            rotation={data.rotation}
            nickname={data.nickname || 'Unknown'}
            chat={latestChatMap[id]}
            scale={debugConfig.playerScale}
          />
        ))}

      {visibleMonsterElements}

      {showCullRadius && <CullRadiusIndicator playerRef={playerRef} />}

      {damageNumbers.map(d => (
        <DamageNumber
          key={d.id}
          id={d.id}
          damage={d.damage}
          position={d.position}
          onRemove={removeDamageNumber}
          color={d.isPlayerDamage ? '#ff4444' : undefined}
          outlineColor={d.isPlayerDamage ? '#660000' : undefined}
        />
      ))}

      <Player
        ref={playerRef}
        position={spawnPosition || [0, 5, 0]}
        input={input}
        actions={inputActions}
        onMove={sendPosition}
        zoomLevel={zoomLevel}
        scale={debugConfig.playerScale}
        nickname={user?.nickname}
        onAction={(pos, rot) => {
          const params = { startPos: { x: pos.x, y: pos.y + 1.5, z: pos.z }, playerRot: rot };
          addProjectile({ ...params, side: 'left' });
          addProjectile({ ...params, side: 'right' });
          sendSkill?.({
            skillName: 'pyramid_punch',
            startPos: { x: pos.x, y: pos.y + 1.5, z: pos.z },
            playerRot: rot,
          });
        }}
        chat={user && latestChatMap ? latestChatMap[user.id] : null}
      />

      {projectiles.map((projectile) => {
        if (projectile.type === 'magic_orb') {
          return (
            <MagicOrbProjectile
              key={projectile.id}
              id={projectile.id}
              remove={handleRemoveProjectile}
              sendHit={sendHit}
              {...projectile}
            />
          );
        }
        return (
          <PunchProjectile
            key={projectile.id}
            id={projectile.id}
            remove={handleRemoveProjectile}
            onUpdatePosition={(pos) => handleProjectileUpdate(projectile.id, pos)}
            add={addProjectile}
            scale={debugConfig.playerScale}
            {...projectile}
          />
        );
      })}

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
