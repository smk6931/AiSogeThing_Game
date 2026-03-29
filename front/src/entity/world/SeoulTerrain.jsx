import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import worldApi from '@api/world';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

const ROAD_TEST_TEXTURES = {
  major: '/images/image.png',
  mid: '/images/image copy 3.png',
  alley: '/images/image copy 5.png',
  pedestrian: '/images/gemini-2.5-flash-image_isometric_hand-painted_fantasy_RPG_tile_texture_of_dark_cracked_dungeon_floor_ti-0.jpg',
  service: '/images/2b8a23a7dec37e59d324efa9d0f0ef99.jpg',
};

// ===========================
// 레이어별 색상
// ===========================
const COLORS = {
  water: new THREE.Color(0x2a6ab5),
  forest: new THREE.Color(0x2d6a28),
  grass: new THREE.Color(0x5a9e45),
  road_major: new THREE.Color(0x999999), // 더 연한 주요도로
  road_mid: new THREE.Color(0xcccccc),   // 중간도로
  road_alley: new THREE.Color(0xbca98b),
  road_pedestrian: new THREE.Color(0xd4c59e),
  road_service: new THREE.Color(0x8b8274),
};

const ROAD_CLASS = {
  motorway: 'major', trunk: 'major', primary: 'major',
  motorway_link: 'major', trunk_link: 'major', primary_link: 'major',
  secondary: 'mid', secondary_link: 'mid', tertiary: 'mid', tertiary_link: 'mid',
  residential: 'alley', unclassified: 'alley', living_street: 'alley',
  pedestrian: 'pedestrian', footway: 'pedestrian', path: 'pedestrian',
  service: 'service',
};

const ROAD_TILE_REPEAT = {
  major: 0.035,
  mid: 0.05,
  alley: 0.07,
  pedestrian: 0.08,
  service: 0.06,
};
const ROAD_STYLE = {
  major: {
    color: new THREE.Color('#ffffff'),
    opacity: 1,
    roughness: 1,
    metalness: 0.02,
    renderOrder: 112,
    yOffset: 0.15,
  },
  mid: {
    color: new THREE.Color('#ffffff'),
    opacity: 1,
    roughness: 1,
    metalness: 0.01,
    renderOrder: 110,
    yOffset: 0.12,
  },
  alley: {
    color: new THREE.Color('#ffffff'),
    opacity: 1,
    roughness: 1,
    metalness: 0,
    renderOrder: 108,
    yOffset: 0.09,
  },
  pedestrian: {
    color: new THREE.Color('#ffffff'),
    opacity: 1,
    roughness: 1,
    metalness: 0,
    renderOrder: 106,
    yOffset: 0.07,
  },
  service: {
    color: new THREE.Color('#ffffff'),
    opacity: 1,
    roughness: 1,
    metalness: 0,
    renderOrder: 104,
    yOffset: 0.05,
  },
};

// GPS → 게임 좌표 변환
const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

// 폴리곤 생성
function buildPolygonGeometry(features, maskArea = null) {
  const geos = [];

  for (const f of features) {
    if (!f.coords || f.coords.length < 3) continue;

    try {
      const shape = new THREE.Shape();
      const first = gpsToGame(f.coords[0][0], f.coords[0][1]);
      shape.moveTo(first.x, -first.z);
      for (let i = 1; i < f.coords.length; i++) {
        const p = gpsToGame(f.coords[i][0], f.coords[i][1]);
        shape.lineTo(p.x, -p.z);
      }
      shape.closePath();
      geos.push(new THREE.ShapeGeometry(shape));
    } catch (_) { }
  }
  if (geos.length === 0) return null;
  try { return mergeGeometries(geos, false); } catch (_) { return null; }
}

// 단순 라인 생성
function buildSimpleLineGeometry(features, roadWidthMajor = 20, roadWidthMid = 12, roadWidthMinor = 6) {
  const geos = [];

  for (const f of features) {
    const coords = f.coords;
    if (!coords || coords.length < 2) continue;

    const rClass = ROAD_CLASS[f.highway] || 'minor';
    const width = rClass === 'major' ? roadWidthMajor : (rClass === 'mid' ? roadWidthMid : roadWidthMinor);
    const halfW = width / 2;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = gpsToGame(coords[i][0], coords[i][1]);
      const p2 = gpsToGame(coords[i + 1][0], coords[i + 1][1]);

      const ax = p1.x, az = p1.z;
      const bx = p2.x, bz = p2.z;
      const dx = bx - ax, dz = bz - az;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.1) continue;

      const nx = -dz / len * halfW;
      const nz = dx / len * halfW;
      const sy = 0.25;
      const ey = 0.25;

      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        ax + nx, sy, az + nz,
        bx + nx, ey, bz + nz,
        bx - nx, ey, bz - nz,
        ax + nx, sy, az + nz,
        bx - nx, ey, bz - nz,
        ax - nx, sy, az - nz
      ]);
      const uvs = new Float32Array([
        0, 0,
        1, 0,
        1, 1,
        0, 0,
        1, 1,
        0, 1,
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geos.push(geometry);
    }
  }
  if (geos.length === 0) return null;
  try { return mergeGeometries(geos, false); } catch (_) { return null; }
}

// 도로 전용 텍스처 라인 생성
function buildRoadAtlasGeometry(features, roadType = 'alley', roadWidthMajor = 20, roadWidthMid = 12, roadWidthMinor = 6) {
  const geos = [];

  for (const f of features) {
    const coords = f.coords;
    if (!coords || coords.length < 2) continue;

    const width = roadType === 'major' ? roadWidthMajor : (roadType === 'mid' ? roadWidthMid : roadWidthMinor);
    const halfW = width / 2;
    const style = ROAD_STYLE[roadType] || ROAD_STYLE.alley;
    const uvRepeat = ROAD_TILE_REPEAT[roadType] || 0.05;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = gpsToGame(coords[i][0], coords[i][1]);
      const p2 = gpsToGame(coords[i + 1][0], coords[i + 1][1]);

      const ax = p1.x, az = p1.z;
      const bx = p2.x, bz = p2.z;
      const dx = bx - ax, dz = bz - az;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.1) continue;

      const nx = -dz / len * halfW;
      const nz = dx / len * halfW;
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        ax + nx, style.yOffset, az + nz,
        bx + nx, style.yOffset, bz + nz,
        bx - nx, style.yOffset, bz - nz,
        ax + nx, style.yOffset, az + nz,
        bx - nx, style.yOffset, bz - nz,
        ax - nx, style.yOffset, az - nz
      ]);
      const uvs = new Float32Array([
        0, 0,
        len * uvRepeat, 0,
        len * uvRepeat, 1,
        0, 0,
        len * uvRepeat, 1,
        0, 1,
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geos.push(geometry);
    }
  }
  if (geos.length === 0) return null;
  try { return mergeGeometries(geos, false); } catch (_) { return null; }
}

const MergedMesh = ({ geometry, color, rotation = [0, 0, 0], position = [0, 0, 0], isWater = false, isRoad = false, roadType = 'alley', texture = null, useStencil = false }) => {
  if (!geometry) return null;
  const roadStyle = ROAD_STYLE[roadType] || ROAD_STYLE.alley;
  const materialProps = isWater ? {
    color: color, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.3, emissive: color, emissiveIntensity: 0.3,
  } : isRoad ? {
    color: roadStyle.color,
    map: texture,
    transparent: false,
    opacity: roadStyle.opacity,
    roughness: 1,
    metalness: 0,
    emissive: new THREE.Color('#000000'),
    emissiveIntensity: 0,
    depthWrite: false,
    toneMapped: false,
    alphaTest: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  } : { 
    color: color,
    transparent: false,
    opacity: 1.0,
    depthWrite: true,
    depthTest: true
  };

  if (useStencil) {
    materialProps.stencilWrite = true;
    materialProps.stencilRef = 1;
    materialProps.stencilFunc = THREE.EqualStencilFunc;
  }

  const finalRenderOrder = isRoad ? roadStyle.renderOrder : (isWater ? 5 : 1);

  return (
    <mesh rotation={rotation} position={position} renderOrder={finalRenderOrder}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial {...materialProps} side={THREE.DoubleSide} />
    </mesh>
  );
};

// [NEW] 구/동 경계 모양대로 스텐실 도장을 찍어주는 컴포넌트
const TerrainMask = ({ maskArea, elevation }) => {
  const geo = useMemo(() => {
    if (!maskArea || !maskArea.coords || maskArea.coords.length === 0) return null;
    try {
      const shape = new THREE.Shape();
      const first = gpsToGame(maskArea.coords[0][0], maskArea.coords[0][1]);
      shape.moveTo(first.x, -first.z);
      for (let i = 1; i < maskArea.coords.length; i++) {
        const p = gpsToGame(maskArea.coords[i][0], maskArea.coords[i][1]);
        shape.lineTo(p.x, -p.z);
      }
      return new THREE.ShapeGeometry(shape);
    } catch (e) { return null; }
  }, [maskArea]);

  if (!geo) return null;

  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, elevation, 0]} renderOrder={5}>
      <meshBasicMaterial
        colorWrite={false}
        depthWrite={false}
        depthTest={false}
        stencilWrite={true}
        stencilRef={1}
        stencilFunc={THREE.AlwaysStencilFunc}
        stencilZPass={THREE.ReplaceStencilOp}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const SeoulTerrain = ({
  visible = true, showRoads = true, showNature = true, roadTextureUrl = null,
  roadTypeFilters = {},
  districtId = null, dongId = null, currentDistrict = null, currentDong = null,
  elevation = 0, shiftX = -450, shiftZ = 320,
  roadWidthMajor = 20, roadWidthMid = 12, roadWidthMinor = 8
}) => {
  const [data, setData] = useState(null);
  const [geos, setGeos] = useState(null);
  const loadingRef = useRef(false);
  const activeRoadTypes = useMemo(() => ({
    major: roadTypeFilters.major !== false,
    mid: roadTypeFilters.mid !== false,
    alley: roadTypeFilters.alley !== false,
    pedestrian: roadTypeFilters.pedestrian !== false,
    service: roadTypeFilters.service !== false,
  }), [roadTypeFilters]);
  const roadTextures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const loadTexture = (url) => {
      const texture = loader.load(url);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.needsUpdate = true;
      return texture;
    };
    return {
      major: loadTexture(ROAD_TEST_TEXTURES.major),
      mid: loadTexture(ROAD_TEST_TEXTURES.mid),
      alley: loadTexture(ROAD_TEST_TEXTURES.alley),
      pedestrian: loadTexture(ROAD_TEST_TEXTURES.pedestrian),
      service: loadTexture(ROAD_TEST_TEXTURES.service),
    };
  }, []);

  useEffect(() => {
    if (!visible || loadingRef.current) return;
    const loadData = async () => {
      loadingRef.current = true;
      try {
        let terrainData;
        if (dongId) {
          const res = await worldApi.getDongTerrain(dongId);
          terrainData = res.data;
        } else if (districtId) {
          const res = await worldApi.getDistrictTerrain(districtId);
          terrainData = res.data;
        } else {
          const res = await fetch('/seoul_terrain.json');
          terrainData = await res.json();
        }
        setData(terrainData);
      } catch (err) {
        console.error('[SeoulTerrain] 로딩 실패:', err);
      } finally {
        loadingRef.current = false;
      }
    };
    loadData();
  }, [visible, districtId, dongId]);

  useEffect(() => {
    if (!data) return;
    const build = async () => {
      const { water, forest, grass, roads } = data.layers;
      const roadFeatures = dongId
        ? roads
        : roads.filter(r => ['major', 'mid', 'alley'].includes(ROAD_CLASS[r.highway] || 'alley'));
      const majorRoads = roadFeatures.filter((road) => (ROAD_CLASS[road.highway] || 'alley') === 'major');
      const midRoads = roadFeatures.filter((road) => (ROAD_CLASS[road.highway] || 'alley') === 'mid');
      const alleyRoads = roadFeatures.filter((road) => (ROAD_CLASS[road.highway] || 'alley') === 'alley');
      const pedestrianRoads = roadFeatures.filter((road) => (ROAD_CLASS[road.highway] || 'alley') === 'pedestrian');
      const serviceRoads = roadFeatures.filter((road) => (ROAD_CLASS[road.highway] || 'alley') === 'service');

      setGeos({
        grass: buildPolygonGeometry(grass.filter(f => f.type === 'polygon')),
        forest: buildPolygonGeometry(forest.filter(f => f.type === 'polygon')),
        waterPoly: buildPolygonGeometry(water.filter(f => f.type === 'polygon')),
        waterLine: buildSimpleLineGeometry(water.filter(f => f.type === 'line'), 30, 15, 5),
        roadMajor: buildRoadAtlasGeometry(majorRoads, 'major', roadWidthMajor, roadWidthMid, roadWidthMinor),
        roadMid: buildRoadAtlasGeometry(midRoads, 'mid', roadWidthMajor, roadWidthMid, roadWidthMinor),
        roadAlley: buildRoadAtlasGeometry(alleyRoads, 'alley', roadWidthMajor, roadWidthMid, roadWidthMinor),
        roadPedestrian: buildRoadAtlasGeometry(pedestrianRoads, 'pedestrian', roadWidthMajor, roadWidthMid, roadWidthMinor),
        roadService: buildRoadAtlasGeometry(serviceRoads, 'service', roadWidthMajor, roadWidthMid, roadWidthMinor),
        shiftX: 0, shiftZ: 0
      });
    };
    build();
  }, [data, shiftX, shiftZ, currentDistrict, currentDong, roadWidthMajor, roadWidthMid, roadWidthMinor]);

  if (!visible || !geos) return null;

  const activeMask = currentDong || currentDistrict;

  return (
    <group name="seoul-terrain-group" position={[geos.shiftX, elevation, geos.shiftZ]}>

      {/* 0. 스텐실 마스크 렌더링 (구/동 모양 도장 찍기) */}
      {activeMask && <TerrainMask maskArea={activeMask} elevation={0.01} />}

      {showNature && (
        <group name="nature-layer">
          <MergedMesh geometry={geos.grass} color={COLORS.grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} useStencil={!!activeMask} />
          <MergedMesh geometry={geos.forest} color={COLORS.forest} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} useStencil={!!activeMask} />
          <MergedMesh geometry={geos.waterPoly} color={COLORS.water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} isWater={true} useStencil={!!activeMask} />
          <MergedMesh geometry={geos.waterLine} color={COLORS.water} isWater={true} useStencil={!!activeMask} />
        </group>
      )}
      {showRoads && (
        <group name="roads-layer" position={[0, 0.1, 0]}>
          {activeRoadTypes.service && <MergedMesh geometry={geos.roadService} color={COLORS.road_service} texture={roadTextures.service} useStencil={!!activeMask} isRoad={true} roadType="service" />}
          {activeRoadTypes.pedestrian && <MergedMesh geometry={geos.roadPedestrian} color={COLORS.road_pedestrian} texture={roadTextures.pedestrian} useStencil={!!activeMask} isRoad={true} roadType="pedestrian" />}
          {activeRoadTypes.alley && <MergedMesh geometry={geos.roadAlley} color={COLORS.road_alley} texture={roadTextures.alley} useStencil={!!activeMask} isRoad={true} roadType="alley" />}
          {activeRoadTypes.mid && <MergedMesh geometry={geos.roadMid} color={COLORS.road_mid} texture={roadTextures.mid} useStencil={!!activeMask} isRoad={true} roadType="mid" />}
          {activeRoadTypes.major && <MergedMesh geometry={geos.roadMajor} color={COLORS.road_major} texture={roadTextures.major} useStencil={!!activeMask} isRoad={true} roadType="major" />}
        </group>
      )}
    </group>
  );
};

export default SeoulTerrain;
