import React, { useMemo, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';
import worldApi from '@api/world';

// 동 ID 기준 파티션 데이터 캐시
const partitionCache = new Map();
// group_key 기준 geometry 캐시 (세션 전체 유지 — 재방문 시 rebuild 없음)
const groupGeometryCache = new Map(); // key: `${group_key}:${texCount}` → [{geo, texIdx, order}]

const hashString = (value = '') => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

// 파티션 centroid 기준 가장 가까운 group_key 반환
const findNearestGroupKey = (playerPos, partitions) => {
  if (!playerPos || !partitions.length) return null;
  let minDistSq = Infinity;
  let nearestGroupKey = null;
  for (const p of partitions) {
    if (!p.centroid_lat || !p.centroid_lng || !p.group_key) continue;
    const c = gpsToGame(p.centroid_lat, p.centroid_lng);
    const dSq = (c.x - playerPos.x) ** 2 + (c.z - playerPos.z) ** 2;
    if (dSq < minDistSq) {
      minDistSq = dSq;
      nearestGroupKey = p.group_key;
    }
  }
  return nearestGroupKey;
};

// 현재 그룹 centroid 기준 반경(기본 700m) 내 인접 group_key 집합 반환
const findAdjacentGroupKeys = (currentGroupKey, partitions, radius = 700) => {
  if (!currentGroupKey) return new Set();
  const radiusSq = radius * radius;

  const currentParts = partitions.filter(p => p.group_key === currentGroupKey && p.centroid_lat && p.centroid_lng);
  if (!currentParts.length) return new Set();

  let sumX = 0, sumZ = 0;
  for (const p of currentParts) {
    const c = gpsToGame(p.centroid_lat, p.centroid_lng);
    sumX += c.x; sumZ += c.z;
  }
  const cx = sumX / currentParts.length;
  const cz = sumZ / currentParts.length;

  const adjacent = new Set();
  for (const p of partitions) {
    if (!p.group_key || p.group_key === currentGroupKey || !p.centroid_lat || !p.centroid_lng) continue;
    const c = gpsToGame(p.centroid_lat, p.centroid_lng);
    if ((c.x - cx) ** 2 + (c.z - cz) ** 2 < radiusSq) adjacent.add(p.group_key);
  }
  return adjacent;
};

const buildTerrainBlock = (coords, holes = []) => {
  if (!coords || coords.length < 3) return null;

  const pts = coords.map(([lat, lng]) => gpsToGame(lat, lng));
  const contour = pts.map((p) => new THREE.Vector2(p.x, p.z));
  const holePts = (holes || []).map((hole) => hole.map(([lat, lng]) => gpsToGame(lat, lng)));
  const holeContours = holePts.map((hole) => hole.map((p) => new THREE.Vector2(p.x, p.z)));
  const triangulationPts = [pts, ...holePts].flat();

  let faces;
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, holeContours);
  } catch (_) {
    return null;
  }
  if (!faces || faces.length === 0) return null;

  let minX = Infinity, minZ = Infinity;
  triangulationPts.forEach((p) => {
    minX = Math.min(minX, p.x);
    minZ = Math.min(minZ, p.z);
  });

  const positions = new Float32Array(faces.length * 9);
  const uvs = new Float32Array(faces.length * 6);
  let vi = 0, ui = 0;
  const tileSize = 100.0;

  for (const [a, b, c] of faces) {
    for (const idx of [a, b, c]) {
      const p = triangulationPts[idx];
      positions[vi++] = p.x;
      positions[vi++] = 0.55;
      positions[vi++] = p.z;
      uvs[ui++] = (p.x - minX) / tileSize;
      uvs[ui++] = (p.z - minZ) / tileSize;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
};

const buildTerrainBlockFromGeoJson = (boundaryGeoJson) => {
  if (!boundaryGeoJson?.coordinates?.length) return null;
  const [outer, ...holes] = boundaryGeoJson.coordinates;
  const outerCoords = outer.map(([lng, lat]) => [lat, lng]);
  const holeCoords = holes.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  return buildTerrainBlock(outerCoords, holeCoords);
};

// group_key 단위 geometry 빌드 (캐시 우선)
const getGroupGeometries = (groupKey, allPartitions, texCount) => {
  const cacheKey = `${groupKey}:${texCount}`;
  if (groupGeometryCache.has(cacheKey)) return groupGeometryCache.get(cacheKey);

  const result = [];
  for (const partition of allPartitions) {
    if (partition.group_key !== groupKey) continue;
    const geo = buildTerrainBlockFromGeoJson(partition.boundary_geojson);
    if (!geo) continue;
    const seed = hashString([
      partition.group_key || '',
      partition.group_theme_code || '',
      partition.texture_profile || '',
      partition.partition_seq || 0,
    ].join('|'));
    result.push({ geo, texIdx: seed % texCount, order: 5 });
  }

  groupGeometryCache.set(cacheKey, result);
  return result;
};

const DongMask = ({ currentDong, elevation }) => {
  const geo = useMemo(() => {
    if (!currentDong?.coords || currentDong.coords.length < 3) return null;
    try {
      const shape = new THREE.Shape();
      const first = gpsToGame(currentDong.coords[0][0], currentDong.coords[0][1]);
      shape.moveTo(first.x, -first.z);
      for (let i = 1; i < currentDong.coords.length; i += 1) {
        const p = gpsToGame(currentDong.coords[i][0], currentDong.coords[i][1]);
        shape.lineTo(p.x, -p.z);
      }
      return new THREE.ShapeGeometry(shape);
    } catch (_) {
      return null;
    }
  }, [currentDong]);

  if (!geo) return null;

  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, elevation, 0]} renderOrder={1}>
      <meshBasicMaterial
        colorWrite={false}
        depthWrite={false}
        stencilWrite
        stencilRef={1}
        stencilFunc={THREE.AlwaysStencilFunc}
        stencilPass={THREE.ReplaceStencilOp}
      />
    </mesh>
  );
};

const CityBlockContent = ({
  texturePaths,
  zoneData,
  dbPartitions,
  currentDong,
  elevation,
  showOriginalBlocks = true,
  showSectorBlocks = true,
  playerPositionRef,
  currentGroupOnly = false,
}) => {
  const textures = useTexture(texturePaths);
  const texCount = Array.isArray(textures) ? textures.length : 1;

  // 현재 그룹 + 인접 그룹 key 집합 (500ms 간격 갱신)
  const [activeGroupKeys, setActiveGroupKeys] = useState(() => new Set());
  const activeGroupKeysRef = useRef(new Set());

  useEffect(() => {
    if (!showSectorBlocks || !dbPartitions.length) return;

    const update = () => {
      const playerPos = playerPositionRef?.current?.position;
      const curKey = findNearestGroupKey(playerPos, dbPartitions);
      if (!curKey) return;
      const adjacent = currentGroupOnly ? new Set() : findAdjacentGroupKeys(curKey, dbPartitions);
      const newKeys = new Set([curKey, ...adjacent]);

      // 변경된 경우에만 setState (불필요한 리렌더 방지)
      const prev = activeGroupKeysRef.current;
      const changed = newKeys.size !== prev.size || [...newKeys].some(k => !prev.has(k));
      if (changed) {
        activeGroupKeysRef.current = newKeys;
        setActiveGroupKeys(newKeys);
      }
    };

    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [showSectorBlocks, dbPartitions, playerPositionRef, currentGroupOnly]);

  useEffect(() => {
    const texArray = Array.isArray(textures) ? textures : [textures];
    texArray.forEach((t) => {
      if (!t) return;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 16;
      t.needsUpdate = true;
    });
  }, [textures]);

  const blocks = useMemo(() => {
    const result = [];

    if (showOriginalBlocks && zoneData?.zones) {
      const blockCats = Object.keys(zoneData.zones).filter(
        (cat) => cat !== 'sectors' && cat !== 'road_major' && cat !== 'road_minor' && cat !== 'unexplored',
      );
      blockCats.forEach((cat) => {
        const features = zoneData.zones[cat] || [];
        features.forEach((feature) => {
          if (feature.type !== 'polygon' || !feature.coords?.length) return;
          const geo = buildTerrainBlock(feature.coords, feature.holes);
          if (!geo) return;
          const seed = Math.abs(feature.coords[0][0] * 12345 + feature.coords[0][1] * 67890);
          result.push({ geo, texIdx: Math.floor(seed) % texCount, order: 3 });
        });
      });
    }

    if (showSectorBlocks && dbPartitions?.length > 0) {
      // 활성 그룹만 렌더링 (activeGroupKeys가 결정되기 전이면 가장 가까운 그룹 하나만)
      const keysToRender = activeGroupKeys.size > 0
        ? activeGroupKeys
        : null;

      const targetGroupKeys = keysToRender
        ? new Set([...keysToRender])
        : (() => {
            // fallback: 전체 파티션 중 첫 group_key만
            const firstKey = dbPartitions.find(p => p.group_key)?.group_key;
            return firstKey ? new Set([firstKey]) : new Set();
          })();

      // group_key 단위 캐시 활용
      for (const groupKey of targetGroupKeys) {
        const geos = getGroupGeometries(groupKey, dbPartitions, texCount);
        result.push(...geos);
      }
    } else if (showSectorBlocks && zoneData?.zones?.sectors) {
      // dbPartitions 없을 때 fallback
      const sectors = zoneData.zones.sectors || [];
      sectors.forEach((feature, idx) => {
        if (feature.type !== 'polygon' || !feature.coords?.length) return;
        const geo = buildTerrainBlock(feature.coords, feature.holes);
        if (!geo) return;
        const seed = Math.abs(feature.coords[0][0] * 99999 + feature.coords[0][1] * 11111 + idx);
        result.push({ geo, texIdx: (Math.floor(seed) + 7) % texCount, order: 5 });
      });
    }

    return result;
  }, [showOriginalBlocks, showSectorBlocks, zoneData, dbPartitions, texCount, activeGroupKeys]);

  return (
    <group>
      <DongMask currentDong={currentDong} elevation={elevation + 0.01} />
      <group position={[0, elevation, 0]}>
        {blocks.map((block, index) => (
          <mesh key={`block-${index}`} geometry={block.geo} renderOrder={block.order}>
            <meshStandardMaterial
              map={Array.isArray(textures) ? textures[block.texIdx] : textures}
              transparent={false}
              opacity={1}
              stencilWrite
              stencilRef={1}
              stencilFunc={THREE.EqualStencilFunc}
              side={THREE.DoubleSide}
              roughness={1}
              metalness={0}
              depthWrite
            />
          </mesh>
        ))}
      </group>
    </group>
  );
};

const CityBlockOverlay = ({
  zoneData,
  currentDong,
  visible = true,
  elevation = 0.05,
  showOriginalBlocks = true,
  showSectorBlocks = true,
  playerPositionRef,
  currentGroupOnly = false,
}) => {
  const [texturePaths, setTexturePaths] = useState([]);
  const [dbPartitions, setDbPartitions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchPaths = async () => {
      try {
        const res = await worldApi.getBlockTextures();
        const serverPaths = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) setTexturePaths(serverPaths);
      } catch (_) {
        if (!cancelled) setTexturePaths([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPaths();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchPartitions = async () => {
      if (!showSectorBlocks || !currentDong?.id) {
        setDbPartitions([]);
        return;
      }
      if (partitionCache.has(currentDong.id)) {
        setDbPartitions(partitionCache.get(currentDong.id));
        return;
      }
      try {
        const res = await worldApi.getDongPartitions(currentDong.id);
        const data = Array.isArray(res.data) ? res.data : [];
        partitionCache.set(currentDong.id, data);
        if (!cancelled) setDbPartitions(data);
      } catch (_) {
        if (!cancelled) setDbPartitions([]);
      }
    };
    fetchPartitions();
    return () => { cancelled = true; };
  }, [showSectorBlocks, currentDong?.id]);

  if (!visible || loading || texturePaths.length === 0) return null;

  return (
    <CityBlockContent
      texturePaths={texturePaths}
      zoneData={zoneData}
      dbPartitions={dbPartitions}
      currentDong={currentDong}
      elevation={elevation}
      showOriginalBlocks={showOriginalBlocks}
      showSectorBlocks={showSectorBlocks}
      playerPositionRef={playerPositionRef}
      currentGroupOnly={currentGroupOnly}
    />
  );
};

export default CityBlockOverlay;
