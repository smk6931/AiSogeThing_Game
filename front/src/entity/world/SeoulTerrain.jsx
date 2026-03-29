import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import worldApi from '@api/world';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

const ROAD_ATLAS_TEXTURES = [
  '/ground/0697877e-b61e-41a0-8560-05ccbc5c07bb.png',
  '/ground/4628b0ae-fd8d-4497-8edb-338a5edcf82e.png',
  '/ground/ChatGPT%20Image.png',
];
const ROAD_ATLAS_GRID = 4;

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
  major: 0.075,
  mid: 0.1,
  alley: 0.14,
  pedestrian: 0.16,
  service: 0.13,
};
const ROAD_STYLE = {
  major: {
    color: new THREE.Color('#ffffff'),
    opacity: 1,
    roughness: 1,
    metalness: 0.02,
    renderOrder: 112,
    yOffset: 0.34,
  },
  mid: {
    color: new THREE.Color('#ffffff'),
    opacity: 1,
    roughness: 1,
    metalness: 0.01,
    renderOrder: 110,
    yOffset: 0.32,
  },
  alley: {
    color: new THREE.Color('#ffffff'),
    opacity: 1,
    roughness: 1,
    metalness: 0,
    renderOrder: 108,
    yOffset: 0.3,
  },
  pedestrian: {
    color: new THREE.Color('#ffffff'),
    opacity: 1,
    roughness: 1,
    metalness: 0,
    renderOrder: 106,
    yOffset: 0.28,
  },
  service: {
    color: new THREE.Color('#ffffff'),
    opacity: 1,
    roughness: 1,
    metalness: 0,
    renderOrder: 104,
    yOffset: 0.26,
  },
};

// GPS → 게임 좌표 변환
const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

const findNearestGroupKey = (playerPos, partitions) => {
  if (!playerPos || !partitions?.length) return null;
  let nearestGroupKey = null;
  let minDistSq = Infinity;
  for (const partition of partitions) {
    if (!partition.group_key || !partition.centroid_lat || !partition.centroid_lng) continue;
    const center = gpsToGame(partition.centroid_lat, partition.centroid_lng);
    const distSq = (center.x - playerPos.x) ** 2 + (center.z - playerPos.z) ** 2;
    if (distSq < minDistSq) {
      minDistSq = distSq;
      nearestGroupKey = partition.group_key;
    }
  }
  return nearestGroupKey;
};

const getGroupBounds = (partitions, groupKey) => {
  if (!groupKey || !partitions?.length) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const partition of partitions) {
    if (partition.group_key !== groupKey) continue;
    const rings = partition.boundary_geojson?.coordinates || [];
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
    }
  }

  if (!Number.isFinite(minLat) || !Number.isFinite(minLng)) return null;
  const pad = 0.00035;
  return {
    minLat: minLat - pad,
    maxLat: maxLat + pad,
    minLng: minLng - pad,
    maxLng: maxLng + pad,
  };
};

const featureTouchesBounds = (feature, bounds) => {
  if (!feature?.coords?.length || !bounds) return true;
  return feature.coords.some(([lat, lng]) => (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lng >= bounds.minLng &&
    lng <= bounds.maxLng
  ));
};

const cropAtlasTile = (image, col, row) => {
  const tileWidth = Math.floor(image.width / ROAD_ATLAS_GRID);
  const tileHeight = Math.floor(image.height / ROAD_ATLAS_GRID);
  const canvas = document.createElement('canvas');
  canvas.width = tileWidth;
  canvas.height = tileHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return image;

  const insetX = Math.max(2, Math.floor(tileWidth * 0.04));
  const insetY = Math.max(2, Math.floor(tileHeight * 0.04));
  const sourceX = col * tileWidth + insetX;
  const sourceY = row * tileHeight + insetY;
  const sourceW = Math.max(1, tileWidth - insetX * 2);
  const sourceH = Math.max(1, tileHeight - insetY * 2);

  ctx.filter = 'brightness(1.14) saturate(1.08) contrast(1.02)';
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceW,
    sourceH,
    0,
    0,
    tileWidth,
    tileHeight,
  );
  ctx.filter = 'none';
  return canvas;
};

const randomAtlasChoice = () => ({
  atlasUrl: ROAD_ATLAS_TEXTURES[Math.floor(Math.random() * ROAD_ATLAS_TEXTURES.length)],
  col: Math.floor(Math.random() * ROAD_ATLAS_GRID),
  row: Math.floor(Math.random() * ROAD_ATLAS_GRID),
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
    color,
    transparent: true,
    opacity: 0.85,
    roughness: 0.1,
    metalness: 0.3,
    emissive: color,
    emissiveIntensity: 0.3,
  } : isRoad ? {
    color: roadStyle.color,
    map: texture ?? null,
    transparent: false,
    opacity: roadStyle.opacity,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  } : {
    color,
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
      {isRoad ? (
        <meshBasicMaterial {...materialProps} side={THREE.DoubleSide} />
      ) : (
        <meshStandardMaterial {...materialProps} side={THREE.DoubleSide} />
      )}
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

const GroupTerrainMask = ({ partitions, groupKey, elevation }) => {
  const geometries = useMemo(() => {
    if (!groupKey || !partitions?.length) return [];
    const result = [];
    for (const partition of partitions) {
      if (partition.group_key !== groupKey) continue;
      const boundary = partition.boundary_geojson;
      if (!boundary?.coordinates?.length) continue;
      try {
        const [outer, ...holes] = boundary.coordinates;
        if (!outer?.length) continue;
        const shape = new THREE.Shape();
        const first = gpsToGame(outer[0][1], outer[0][0]);
        shape.moveTo(first.x, -first.z);
        for (let i = 1; i < outer.length; i += 1) {
          const point = gpsToGame(outer[i][1], outer[i][0]);
          shape.lineTo(point.x, -point.z);
        }
        shape.closePath();
        shape.holes = holes.map((ring) => {
          const hole = new THREE.Path();
          const firstHole = gpsToGame(ring[0][1], ring[0][0]);
          hole.moveTo(firstHole.x, -firstHole.z);
          for (let i = 1; i < ring.length; i += 1) {
            const point = gpsToGame(ring[i][1], ring[i][0]);
            hole.lineTo(point.x, -point.z);
          }
          hole.closePath();
          return hole;
        });
        result.push(new THREE.ShapeGeometry(shape));
      } catch (_) {
        // noop
      }
    }
    return result;
  }, [partitions, groupKey]);

  if (!geometries.length) return null;

  return (
    <>
      {geometries.map((geo, index) => (
        <mesh key={`group-mask-${groupKey}-${index}`} geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, elevation, 0]} renderOrder={5}>
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
      ))}
    </>
  );
};

const SeoulTerrain = ({
  visible = true, showRoads = true, showNature = true, roadTextureUrl = null,
  roadTypeFilters = {},
  districtId = null, dongId = null, currentDistrict = null, currentDong = null,
  clipToCurrentGroup = false, playerPositionRef = null,
  elevation = 0, shiftX = -450, shiftZ = 320,
  roadWidthMajor = 18, roadWidthMid = 10, roadWidthMinor = 6
}) => {
  const [data, setData] = useState(null);
  const [geos, setGeos] = useState(null);
  const [groupPartitions, setGroupPartitions] = useState([]);
  const [currentGroupKey, setCurrentGroupKey] = useState(null);
  const loadingRef = useRef(false);
  const activeRoadTypes = useMemo(() => ({
    major: roadTypeFilters.major !== false,
    mid: roadTypeFilters.mid !== false,
    alley: roadTypeFilters.alley !== false,
    pedestrian: roadTypeFilters.pedestrian !== false,
    service: roadTypeFilters.service !== false,
  }), [roadTypeFilters]);
  const roadAtlasChoices = useMemo(() => ({
    major: randomAtlasChoice(),
    mid: randomAtlasChoice(),
    alley: randomAtlasChoice(),
    pedestrian: randomAtlasChoice(),
    service: randomAtlasChoice(),
  }), []);
  const roadTextures = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const loadTexture = (atlasUrl, tile) => {
      const texture = loader.load(atlasUrl, (loaded) => {
        if (loaded.image) {
          loaded.image = cropAtlasTile(loaded.image, tile.col, tile.row);
          loaded.needsUpdate = true;
        }
        });
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        return texture;
      };
    return {
      major: loadTexture(roadAtlasChoices.major.atlasUrl, roadAtlasChoices.major),
      mid: loadTexture(roadAtlasChoices.mid.atlasUrl, roadAtlasChoices.mid),
      alley: loadTexture(roadAtlasChoices.alley.atlasUrl, roadAtlasChoices.alley),
      pedestrian: loadTexture(roadAtlasChoices.pedestrian.atlasUrl, roadAtlasChoices.pedestrian),
      service: loadTexture(roadAtlasChoices.service.atlasUrl, roadAtlasChoices.service),
    };
  }, [roadAtlasChoices]);

  useEffect(() => {
    let cancelled = false;

    const loadPartitions = async () => {
      if (!clipToCurrentGroup || !currentDong?.id) {
        setGroupPartitions([]);
        return;
      }
      try {
        const res = await worldApi.getDongPartitions(currentDong.id);
        if (!cancelled) setGroupPartitions(Array.isArray(res.data) ? res.data : []);
      } catch (_) {
        if (!cancelled) setGroupPartitions([]);
      }
    };

    loadPartitions();
    return () => {
      cancelled = true;
    };
  }, [clipToCurrentGroup, currentDong?.id]);

  useEffect(() => {
    if (!clipToCurrentGroup || !groupPartitions.length) {
      setCurrentGroupKey(null);
      return;
    }

    const updateGroupKey = () => {
      const playerPos = playerPositionRef?.current?.position;
      const nextGroupKey = findNearestGroupKey(playerPos, groupPartitions);
      setCurrentGroupKey(nextGroupKey || null);
    };

    updateGroupKey();
    const interval = setInterval(updateGroupKey, 500);
    return () => clearInterval(interval);
  }, [clipToCurrentGroup, groupPartitions, playerPositionRef]);

  useEffect(() => {
    if (!visible || loadingRef.current) return;
    const loadData = async () => {
      loadingRef.current = true;
      try {
        let terrainData = null;

        if (dongId) {
          try {
            const res = await worldApi.getDongTerrain(dongId);
            terrainData = res.data;
          } catch (_) {
            terrainData = null;
          }
        }

        if (!terrainData && districtId) {
          try {
            const res = await worldApi.getDistrictTerrain(districtId);
            terrainData = res.data;
          } catch (_) {
            terrainData = null;
          }
        }

        if (!terrainData) {
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
      const groupBounds = clipToCurrentGroup ? getGroupBounds(groupPartitions, currentGroupKey) : null;
      const filteredRoadBase = dongId
        ? roads
        : roads.filter(r => ['major', 'mid', 'alley'].includes(ROAD_CLASS[r.highway] || 'alley'));
      const roadFeatures = groupBounds
        ? filteredRoadBase.filter((road) => featureTouchesBounds(road, groupBounds))
        : filteredRoadBase;
      const majorRoads = showRoads ? roadFeatures.filter((road) => (ROAD_CLASS[road.highway] || 'alley') === 'major') : [];
      const midRoads = showRoads ? roadFeatures.filter((road) => (ROAD_CLASS[road.highway] || 'alley') === 'mid') : [];
      const alleyRoads = showRoads ? roadFeatures.filter((road) => (ROAD_CLASS[road.highway] || 'alley') === 'alley') : [];
      const pedestrianRoads = showRoads ? roadFeatures.filter((road) => (ROAD_CLASS[road.highway] || 'alley') === 'pedestrian') : [];
      const serviceRoads = showRoads ? roadFeatures.filter((road) => (ROAD_CLASS[road.highway] || 'alley') === 'service') : [];
      const grassPolygons = showNature ? grass.filter((f) => !groupBounds || featureTouchesBounds(f, groupBounds)).filter(f => f.type === 'polygon') : [];
      const forestPolygons = showNature ? forest.filter((f) => !groupBounds || featureTouchesBounds(f, groupBounds)).filter(f => f.type === 'polygon') : [];
      const waterPolygons = showNature ? water.filter((f) => !groupBounds || featureTouchesBounds(f, groupBounds)).filter(f => f.type === 'polygon') : [];
      const waterLines = showNature ? water.filter((f) => !groupBounds || featureTouchesBounds(f, groupBounds)).filter(f => f.type === 'line') : [];

      setGeos({
        grass: showNature ? buildPolygonGeometry(grassPolygons) : null,
        forest: showNature ? buildPolygonGeometry(forestPolygons) : null,
        waterPoly: showNature ? buildPolygonGeometry(waterPolygons) : null,
        waterLine: showNature ? buildSimpleLineGeometry(waterLines, 30, 15, 5) : null,
        roadMajor: showRoads ? buildRoadAtlasGeometry(majorRoads, 'major', roadWidthMajor, roadWidthMid, roadWidthMinor) : null,
        roadMid: showRoads ? buildRoadAtlasGeometry(midRoads, 'mid', roadWidthMajor, roadWidthMid, roadWidthMinor) : null,
        roadAlley: showRoads ? buildRoadAtlasGeometry(alleyRoads, 'alley', roadWidthMajor, roadWidthMid, roadWidthMinor) : null,
        roadPedestrian: showRoads ? buildRoadAtlasGeometry(pedestrianRoads, 'pedestrian', roadWidthMajor, roadWidthMid, roadWidthMinor) : null,
        roadService: showRoads ? buildRoadAtlasGeometry(serviceRoads, 'service', roadWidthMajor, roadWidthMid, roadWidthMinor) : null,
        shiftX: 0, shiftZ: 0
      });
    };
    build();
  }, [data, dongId, roadWidthMajor, roadWidthMid, roadWidthMinor, clipToCurrentGroup, currentGroupKey, groupPartitions, showNature, showRoads]);

  if (!visible || !geos) return null;

  const useGroupMask = clipToCurrentGroup && !!currentGroupKey && groupPartitions.length > 0;
  const activeMask = useGroupMask ? null : (currentDong || currentDistrict);
  const stencilEnabled = useGroupMask || !!activeMask;

  return (
    <group name="seoul-terrain-group" position={[geos.shiftX, elevation, geos.shiftZ]}>

      {/* 0. 스텐실 마스크 렌더링 (구/동 모양 도장 찍기) */}
      {useGroupMask && <GroupTerrainMask partitions={groupPartitions} groupKey={currentGroupKey} elevation={0.01} />}
      {activeMask && <TerrainMask maskArea={activeMask} elevation={0.01} />}

      {showNature && (
        <group name="nature-layer">
          <MergedMesh geometry={geos.grass} color={COLORS.grass} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} useStencil={stencilEnabled} />
          <MergedMesh geometry={geos.forest} color={COLORS.forest} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} useStencil={stencilEnabled} />
          <MergedMesh geometry={geos.waterPoly} color={COLORS.water} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]} isWater={true} useStencil={stencilEnabled} />
          <MergedMesh geometry={geos.waterLine} color={COLORS.water} isWater={true} useStencil={stencilEnabled} />
        </group>
      )}
      {showRoads && (
        <group name="roads-layer" position={[0, 0.1, 0]}>
          {activeRoadTypes.service && <MergedMesh geometry={geos.roadService} color={COLORS.road_service} texture={roadTextures.service} useStencil={stencilEnabled} isRoad={true} roadType="service" />}
          {activeRoadTypes.pedestrian && <MergedMesh geometry={geos.roadPedestrian} color={COLORS.road_pedestrian} texture={roadTextures.pedestrian} useStencil={stencilEnabled} isRoad={true} roadType="pedestrian" />}
          {activeRoadTypes.alley && <MergedMesh geometry={geos.roadAlley} color={COLORS.road_alley} texture={roadTextures.alley} useStencil={stencilEnabled} isRoad={true} roadType="alley" />}
          {activeRoadTypes.mid && <MergedMesh geometry={geos.roadMid} color={COLORS.road_mid} texture={roadTextures.mid} useStencil={stencilEnabled} isRoad={true} roadType="mid" />}
          {activeRoadTypes.major && <MergedMesh geometry={geos.roadMajor} color={COLORS.road_major} texture={roadTextures.major} useStencil={stencilEnabled} isRoad={true} roadType="major" />}
        </group>
      )}
    </group>
  );
};

export default SeoulTerrain;
