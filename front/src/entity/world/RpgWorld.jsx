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
import { LightningBoltProjectile } from '@entity/player/projectile/LightningBoltProjectile';
import { FrostNovaEffect } from '@entity/player/projectile/FrostNovaEffect';
import Monster from '@entity/monster/Monster';
import { DamageNumber } from '@entity/monster/DamageNumber';
import { useSkillRotation } from '@hooks/useSkillRotation';
import { useAutoFarm } from '@hooks/useAutoFarm';
import { useSeoulDistricts } from '@hooks/useSeoulDistricts';
import { useSeoulDongs } from '@hooks/useSeoulDongs';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M, LAYER_Y } from '@entity/world/mapConfig';
import CameraRig from '@entity/world/CameraRig';
import CullRadiusIndicator from '@entity/world/CullRadiusIndicator';
import worldApi from '@api/world';
import { updatePartitionElevations } from '@entity/world/terrainHandler';

// 개별 몬스터 — 자기 자신의 hp/state/position/targeting만 변경될 때 리렌더
const MonsterItem = React.memo(
  ({ monster, isTargeted, scale, onMonsterClick, onInfoClick }) => (
    <group onClick={(e) => { e.stopPropagation(); onMonsterClick(monster); }}>
      <Monster
        id={monster.id}
        position={monster.position}
        hp={monster.hp}
        maxHp={monster.maxHp}
        state={monster.state}
        modelPath={monster.modelPath || null}
        tier={monster.tier || 'normal'}
        scale={scale}
        isTargeted={isTargeted}
        onInfoClick={() => onInfoClick(monster)}
      />
    </group>
  ),
  (prev, next) =>
    prev.isTargeted === next.isTargeted &&
    prev.monster.hp === next.monster.hp &&
    prev.monster.state === next.monster.state &&
    prev.monster.position?.x === next.monster.position?.x &&
    prev.monster.position?.z === next.monster.position?.z &&
    prev.scale === next.scale,
);

const MapTiles = lazy(() => import('@entity/world/MapTiles'));
const ZoneOverlay = lazy(() => import('@entity/world/ZoneOverlay'));
const CityBlockOverlay = lazy(() => import('@entity/world/CityBlockOverlay'));
const SeoulDistrictOverlay = lazy(() => import('@entity/world/SeoulDistrictOverlay'));
const PartitionBoundaryOverlay = lazy(() => import('@entity/world/PartitionBoundaryOverlay'));
const GroupColorOverlay = lazy(() => import('@entity/world/GroupColorOverlay'));
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
  skillHotbar = null,
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
    showGroupColors = false,
    showGroupArea = false,
    showPartitionFill = false,
    showElevation = false,
    groundTextureFolder = '',
    roadTextureFolder = '',
    worldEditorOpen = false,
    groundMode = 'partition',
  } = mapSettings;
  const [debugConfig, setDebugConfig] = useState(() => {
    const defaults = {
      fogNear: 10,
      fogFar: 400,
      fogColor: '#88ccee',
      ambientIntensity: 0.4,
      hdriUrl: '',
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
      mapElevation: 0,
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

    const CONFIG_VERSION = 2; // 구조 변경 시 올리면 localStorage 자동 초기화
    const saved = localStorage.getItem('world_debug_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed._version === CONFIG_VERSION) {
          return { ...defaults, ...parsed };
        }
        // 버전 불일치 → 구버전 삭제 후 defaults 사용
        localStorage.removeItem('world_debug_config');
      } catch (error) {
        console.error('Failed to parse saved world config', error);
        localStorage.removeItem('world_debug_config');
      }
    }
    return defaults;
  });
  const [controlMode, setControlMode] = useState('translate');
  const [sharedZoneData, setSharedZoneData] = useState(null);
  const [currentDistrictId, setCurrentDistrictId] = useState(null);
  const [currentDistrict, setCurrentDistrict] = useState(null);
  const [currentDongId, setCurrentDongId] = useState(null);
  const [currentDong, setCurrentDong] = useState(null);
  const [worldLoadStage, setWorldLoadStage] = useState(0);
  // 파티션 데이터: PartitionBoundaryOverlay + GroupColorOverlay 공유 (dong당 1회 fetch)
  const [sharedPartitions, setSharedPartitions] = useState([]);
  const [, setTick] = useState(0);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const selectedTargetIdRef = useRef(null);
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

  // 스킬 퀵슬롯 — GameEntry에서 주입
  const useSkill = skillHotbar?.useSkill ?? (() => null);
  const skillSlots = skillHotbar?.slots ?? ['magic_orb', 'pyramid_punch', 'lightning_bolt', 'frost_nova'];

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

  // 파티션 고도 데이터를 terrainHandler에 주입 (showElevation 토글/파티션 로드 시 갱신)
  const ELEV_SCALE = 1.0; // CityBlockOverlay.ELEV_SCALE 과 동일값 유지
  useEffect(() => {
    updatePartitionElevations(sharedPartitions, showElevation ? ELEV_SCALE : 0);
  }, [sharedPartitions, showElevation]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // selectedTargetIdRef 최신값 유지 (useSkillRotation stale closure 방지)
  useEffect(() => { selectedTargetIdRef.current = selectedTargetId; }, [selectedTargetId]);

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

  // 자동사냥 스킬 순환 — 슬롯 0~2를 쿨다운 기반으로 자동 발사 (frost_nova 제외)
  useSkillRotation({
    isAutoMode,
    skillHotbar,
    playerRef,
    selectedTargetIdRef,
    monstersRef,
    addProjectile,
  });

  useEffect(() => {
    // 마지막으로 체크한 위치 추적 — 5m 이내 이동 시 polygon 연산 스킵
    const lastChecked = { x: null, z: null };
    const MOVE_THRESHOLD_SQ = 25; // 5m²

    const interval = setInterval(() => {
      if (!playerRef.current) return;

      const { x, z } = playerRef.current.position;

      // 거의 안 움직였으면 polygon 연산 생략
      if (
        lastChecked.x !== null &&
        (x - lastChecked.x) ** 2 + (z - lastChecked.z) ** 2 < MOVE_THRESHOLD_SQ
      ) return;
      lastChecked.x = x;
      lastChecked.z = z;

      const lat = GIS_ORIGIN.lat - (z / LAT_TO_M);
      const lng = GIS_ORIGIN.lng + (x / LNG_TO_M);

      const nextDistrict = getDistrictAt(lat, lng);
      if (nextDistrict && nextDistrict.id !== currentDistrictId) {
        setCurrentDistrictId(nextDistrict.id);
        setCurrentDistrict(nextDistrict);
      }

      const nextDong = getDongAt(lat, lng);
      if (nextDong && nextDong.id !== currentDongId) {
        setCurrentDongId(nextDong.id);
        setCurrentDong(nextDong);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [currentDistrictId, currentDongId, getDistrictAt, getDongAt]);

  useEffect(() => {
    setWorldLoadStage(0);
    const timers = WORLD_STAGE_DELAYS.slice(1).map((delay, index) => (
      window.setTimeout(() => setWorldLoadStage(index + 1), delay)
    ));
    return () => timers.forEach(window.clearTimeout);
  }, [currentDistrictId, currentDongId]);

  // 파티션 데이터 단일 fetch — PartitionBoundaryOverlay + GroupColorOverlay 공유
  useEffect(() => {
    if (!currentDong?.id) { setSharedPartitions([]); return; }
    let cancelled = false;
    worldApi.getDongPartitions(currentDong.id)
      .then((res) => { if (!cancelled) setSharedPartitions(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (!cancelled) setSharedPartitions([]); });
    return () => { cancelled = true; };
  }, [currentDong?.id]);

  // playerScale은 ref로 관리 — 스케일 변경이 전체 몬스터 리스트 재계산을 유발하지 않도록
  const monsterScaleRef = useRef(debugConfig.playerScale);
  monsterScaleRef.current = debugConfig.playerScale;

  const visibleMonsterElements = useMemo(() => {
    const monsterKeys = Object.keys(monsters);
    if (monsterKeys.length === 0) return null;

    return monsterKeys.map((key) => {
      const monster = monsters[key];
      if (!monster?.position) return null;
      return (
        <MonsterItem
          key={monster.id}
          monster={monster}
          isTargeted={String(selectedTargetId) === String(monster.id)}
          scale={monsterScaleRef.current}
          onMonsterClick={handleMonsterClick}
          onInfoClick={handleMonsterInfoClick}
        />
      );
    });
  }, [monsters, selectedTargetId, handleMonsterClick, handleMonsterInfoClick]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // magic_orb, lightning_bolt, frost_nova는 컴포넌트 내부에서 자체 충돌 처리
      if (projectile.type === 'magic_orb') return;
      if (projectile.type === 'lightning_bolt') return;
      if (projectile.type === 'frost_nova') return;
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

      {/* 등고선 ON: 카메라가 대각선으로 볼 때 파티션 외곽 시야에 검정 void 노출 방지용
          renderOrder=0 (최하단), 스텐실 없음, 30km 광역 커버 */}
      {showElevation && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.8, 0]} renderOrder={0}>
          <planeGeometry args={[30000, 30000]} />
          <meshBasicMaterial color="#3a3020" toneMapped={false} depthWrite={true} />
        </mesh>
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
          showElevation={showElevation}
        />
      </Suspense>

      {worldLoadStage >= 1 && (
        <Suspense fallback={null}>
          <DongGroundMesh
            currentDong={currentDong}
            currentDistrict={currentDistrict}
            elevation={debugConfig.mapElevation + LAYER_Y.ground_mesh}
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
            clipToCurrentGroup={false}
            playerPositionRef={playerRef}
            roadWidthMajor={debugConfig.roadWidthMajor}
            roadWidthMid={debugConfig.roadWidthMid}
            roadWidthMinor={debugConfig.roadWidthMinor}
            elevation={debugConfig.mapElevation + LAYER_Y.road}
            shiftZ={0}
            partitions={sharedPartitions}
            showElevation={showElevation}
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
            elevation={debugConfig.mapElevation + LAYER_Y.zone}
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
            showElevation={showElevation}
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
            elevation={debugConfig.mapElevation + LAYER_Y.landuse}
            groundMode={groundMode}
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
            elevation={debugConfig.mapElevation + LAYER_Y.road_split}
            playerPositionRef={playerRef}
            partitions={sharedPartitions}
            showElevation={showElevation}
            groundMode={groundMode}
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
            elevation={debugConfig.mapElevation + LAYER_Y.current_group_tex}
            playerPositionRef={playerRef}
            partitions={sharedPartitions}
            showElevation={showElevation}
            groundMode={groundMode}
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
            elevation={debugConfig.mapElevation + LAYER_Y.district_boundary - 0.04}
          />
        </Suspense>
      )}

      {worldLoadStage >= 1 && (
        <Suspense fallback={null}>
          <PartitionBoundaryOverlay
            partitions={sharedPartitions}
            visibleMicro={showMicroBoundaries || showGroupArea || showGroupColors}
            visibleGroup={showGroupBoundaries || showGroupArea || showGroupColors}
            highlightCurrentGroup={highlightCurrentGroup}
            currentPartitionKey={currentRegionInfo?.currentPartition?.partition_key || null}
            currentGroupKey={currentRegionInfo?.currentPartition?.group_key || null}
            elevation={debugConfig.mapElevation + LAYER_Y.district_boundary}
            microOpacity={(showGroupArea || showGroupColors) ? 0.55 : 0.24}
          />
        </Suspense>
      )}

      {worldLoadStage >= 1 && (showGroupColors || showGroupArea || showPartitionFill) && (
        <Suspense fallback={null}>
          <GroupColorOverlay
            partitions={sharedPartitions}
            showGroupColors={showGroupColors}
            showGroupArea={showGroupArea}
            showPartitionFill={showPartitionFill}
            elevation={debugConfig.mapElevation + LAYER_Y.group_color}
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
        onAction={(slotIdx, pos, rot) => {
          const skillId = useSkill(slotIdx);
          if (!skillId) return; // 쿨다운/MP 부족

          const startPos = { x: pos.x, y: pos.y + 1.5, z: pos.z };

          if (skillId === 'pyramid_punch') {
            addProjectile({ type: 'pyramid_punch', startPos, playerRot: rot, side: 'left' });
            addProjectile({ type: 'pyramid_punch', startPos, playerRot: rot, side: 'right' });
            sendSkill?.({ skillName: 'pyramid_punch', startPos, playerRot: rot });
          } else if (skillId === 'lightning_bolt') {
            addProjectile({ type: 'lightning_bolt', startPos, playerRot: rot });
            sendSkill?.({ skillName: 'lightning_bolt', startPos, playerRot: rot });
          } else if (skillId === 'frost_nova') {
            addProjectile({ type: 'frost_nova', position: pos });
            sendSkill?.({ skillName: 'frost_nova' });
            // AoE 피격은 FrostNovaEffect 내부에서 sendHit 호출
          } else if (skillId === 'magic_orb') {
            // magic_orb는 타겟 필요 — 타겟 있을 때만
            if (selectedTargetId && monsters[selectedTargetId]) {
              const m = monsters[selectedTargetId];
              addProjectile({
                type: 'magic_orb',
                startPos,
                targetPos: { x: m.position.x, y: 1.5, z: m.position.z },
                targetMonsterId: selectedTargetId,
              });
            }
          }
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
        if (projectile.type === 'lightning_bolt') {
          return (
            <LightningBoltProjectile
              key={projectile.id}
              id={projectile.id}
              remove={handleRemoveProjectile}
              sendHit={sendHit}
              monsters={projectile.isRemote ? {} : monsters}
              {...projectile}
            />
          );
        }
        if (projectile.type === 'frost_nova') {
          return (
            <FrostNovaEffect
              key={projectile.id}
              id={projectile.id}
              remove={handleRemoveProjectile}
              sendHit={projectile.isRemote ? null : sendHit}
              position={projectile.position || projectile.startPos || { x: 0, y: 0, z: 0 }}
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

export default React.memo(RpgWorld);
