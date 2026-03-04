/**
 * ZoneOverlay.jsx
 * 
 * OSM 지도 타일 위에 반투명 구역(Zone) 오버레이를 렌더링합니다.
 * MapTiles와 동일한 GPS→Game 좌표 변환을 사용하여 완벽한 정합을 보장합니다.
 * 
 * 카테고리:
 * - water: 한강, 하천
 * - park: 공원
 * - forest: 숲/산
 * - road_major: 고속도로, 간선도로
 * - road_minor: 일반도로
 * - residential: 주거지역
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import worldApi from '@api/world';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// ===================================
// Heightmap 샘플러 (Zone 높이 정합용)
// ===================================
let _heightmapData = null; // 전역 싱글톤 캐시

const loadHeightmap = async () => {
  if (_heightmapData) return _heightmapData;
  try {
    const res = await fetch('/seoul_heightmap.json');
    _heightmapData = await res.json();
    console.log('[ZoneOverlay] Heightmap 로드 완료');
  } catch (e) {
    console.warn('[ZoneOverlay] Heightmap 로드 실패, flat 렌더링');
    _heightmapData = null;
  }
  return _heightmapData;
};

// 게임 좌표 (x, z) → 지형 Y값 (쌍선형 보간)
const sampleHeight = (x, z, hm, scale = 1.0) => {
  if (!hm) return 0;
  const { grid_size, world_width, world_height, elevations, elev_min, offset_x, offset_z } = hm;
  // 지형 로컬 좌표로 변환
  const localX = x - (offset_x + world_width / 2);
  const localZ = z - (offset_z + world_height / 2);
  // 격자 UV 계산 (0~1)
  const u = (localX + world_width / 2) / world_width;
  const v = (localZ + world_height / 2) / world_height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0; // 범위 밖
  // 격자 인덱스
  const gx = u * (grid_size - 1);
  const gz = v * (grid_size - 1);
  const ix = Math.floor(gx), iy = Math.floor(gz);
  const fx = gx - ix, fy = gz - iy;
  const ix2 = Math.min(ix + 1, grid_size - 1);
  const iy2 = Math.min(iy + 1, grid_size - 1);
  // 쌍선형 보간
  const e00 = Math.max(0, (elevations[iy * grid_size + ix] ?? elev_min) - elev_min);
  const e10 = Math.max(0, (elevations[iy * grid_size + ix2] ?? elev_min) - elev_min);
  const e01 = Math.max(0, (elevations[iy2 * grid_size + ix] ?? elev_min) - elev_min);
  const e11 = Math.max(0, (elevations[iy2 * grid_size + ix2] ?? elev_min) - elev_min);
  const e = e00 * (1 - fx) * (1 - fy) + e10 * fx * (1 - fy) + e01 * (1 - fx) * fy + e11 * fx * fy;
  return e * scale;
};

// GPS → 게임 좌표 변환 (MapTiles와 동일한 공식)
const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M
});

// 카테고리별 색상 (WorldDebugger에서도 활용)
const ZONE_COLORS = {
  water: '#2a6ab5',
  park: '#4caf50',
  forest: '#2d6a28',
  road_major: '#ff9800',
  road_minor: '#ffeb3b',
  residential: '#8bc34a',
  commercial: '#2196f3',
  industrial: '#ffc107',
  institutional: '#9c27b0',
  educational: '#ff5722',
  medical: '#f44336',
  parking: '#9e9e9e',
  natural_site: '#c5e1a5',
  military: '#795548',
  religious: '#e91e63',
  sports: '#00bcd4',
  cemetery: '#607d8b',
  transport: '#455a64',
  port: '#1a237e',
  unexplored: '#4a3728'
};

const ZONE_OPACITY = {
  water: 0.35,
  park: 0.3,
  forest: 0.3,
  road_major: 0.4,
  road_minor: 0.25,
  residential: 0.25,
  commercial: 0.25,
  industrial: 0.25,
  institutional: 0.25,
  educational: 0.25,
  medical: 0.25,
  parking: 0.25,
  natural_site: 0.25,
  military: 0.25,
  religious: 0.25,
  sports: 0.25,
  cemetery: 0.25,
  transport: 0.25,
  port: 0.25,
  unexplored: 0.2
};

// 폴리곤 피처를 Three.js Geometry로 변환
const buildZonePolygonGeometry = (features) => {
  const geos = [];
  for (const f of features) {
    if (!f.coords || f.coords.length < 3) continue;
    try {
      const shape = new THREE.Shape();
      // GPS 좌표를 게임 좌표로 변환
      const first = gpsToGame(f.coords[0][0], f.coords[0][1]);
      shape.moveTo(first.x, -first.z); // Three.js Shape은 XY 평면

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
};

// 라인 피처를 Three.js Geometry로 변환 (지형 높이 추종)
const buildZoneLineGeometry = (features, width = 15, heightmap = null, heightScale = 1.0) => {
  const geos = [];
  const halfW = width / 2;

  for (const f of features) {
    const coords = f.coords;
    if (!coords || coords.length < 2) continue;

    const highway = f.tags?.highway || '';
    const actualHalfW = (highway === 'motorway' || highway === 'trunk') ? halfW * 2 : halfW;

    for (let i = 0; i < coords.length - 1; i++) {
      const a = gpsToGame(coords[i][0], coords[i][1]);
      const b = gpsToGame(coords[i + 1][0], coords[i + 1][1]);

      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len < 0.1) continue;

      const nx = -dz / len * actualHalfW;
      const nz = dx / len * actualHalfW;

      // 지형 높이 샘플링
      const yA = sampleHeight(a.x, a.z, heightmap, heightScale);
      const yB = sampleHeight(b.x, b.z, heightmap, heightScale);

      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        a.x + nx, yA, a.z + nz,
        b.x + nx, yB, b.z + nz,
        b.x - nx, yB, b.z - nz,
        a.x + nx, yA, a.z + nz,
        b.x - nx, yB, b.z - nz,
        a.x - nx, yA, a.z - nz
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();
      geos.push(geometry);
    }
  }
  if (geos.length === 0) return null;
  try { return mergeGeometries(geos, false); } catch (_) { return null; }
};

// 단일 Zone 레이어 메쉬
const ZoneMesh = React.memo(({ geometry, color, opacity, elevation }) => {
  if (!geometry) return null;
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, elevation, 0]} renderOrder={1}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        color={color}
        transparent={true}
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
});

// 라인 기반 Zone 메쉬 (도로 등)
const ZoneLineMesh = React.memo(({ geometry, color, opacity, elevation }) => {
  if (!geometry) return null;
  return (
    <mesh position={[0, elevation, 0]} renderOrder={1}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        color={color}
        transparent={true}
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
});

/**
 * 구(District) coords 배열에서 bbox 중심 lat/lng와 dist(m)을 계산
 */
const calcDistrictBbox = (coords) => {
  if (!coords || coords.length === 0) return null;
  const lats = coords.map(c => c[0]);
  const lngs = coords.map(c => c[1]);
  const latMin = Math.min(...lats), latMax = Math.max(...lats);
  const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
  const centerLat = (latMin + latMax) / 2;
  const centerLng = (lngMin + lngMax) / 2;
  const latDist = (latMax - latMin) * 111000 / 2 * 1.1;
  const lngDist = (lngMax - lngMin) * 88200 / 2 * 1.1;
  const dist = Math.ceil(Math.max(latDist, lngDist));
  return { lat: centerLat, lng: centerLng, dist };
};

/**
 * 메인 Zone 오버레이 컴포넌트
 *
 * Props:
 * - playerPos: { x, z } 플레이어 위치
 * - currentDistrict: { id, name, coords, center } 현재 구 객체
 * - visible: 전체 표시 여부
 * - enabledZones: { water: true, park: true, ... } 카테고리별 표시 여부
 * - elevation: Y축 높이 (지도 위에 올려야 함)
 */
const ZoneOverlay = ({
  playerPos, currentDistrict = null, elevation = 0.05, heightScale = 1.0, onZoneLoaded, visible = true, enabledZones = {},
  zoneRadius = 2500
}) => {
  const [zoneData, setZoneData] = useState({ zones: {}, categories: {} });
  const [loadingGroups, setLoadingGroups] = useState({});
  const [heightmap, setHeightmap] = useState(null);
  const lastFetchPos = useRef({ x: -9999, z: -9999 });

  // 프론트엔드 세션 캐시
  const zoneCache = useRef(new Map());

  const FETCH_DISTANCE = 2000; // currentDistrict 없을 때 fallback 기준

  // 마운트 시 heightmap 한 번만 로드
  useEffect(() => {
    loadHeightmap().then(hm => setHeightmap(hm));
  }, []);

  // 현재 플레이어의 GPS 좌표
  const playerGps = useMemo(() => ({
    lat: GIS_ORIGIN.lat - ((playerPos?.z || 0) / LAT_TO_M),
    lng: GIS_ORIGIN.lng + ((playerPos?.x || 0) / LNG_TO_M)
  }), [playerPos?.x, playerPos?.z]);

  // 공통 상태 업데이트 함수
  const updateState = (data) => {
    setZoneData(prev => ({
      ...prev,
      zones: { ...prev.zones, ...data.zones },
      categories: { ...prev.categories, ...data.categories }
    }));
  };

  // [핵심] 구(District) 기반 Zone 로드 — 구가 바뀔 때만 fetch
  useEffect(() => {
    if (!visible || !currentDistrict) return;

    const cacheKey = `world_zones_district_${currentDistrict.id}`;

    const fetchForDistrict = async () => {
      // 1. 메모리 캐시
      if (zoneCache.current.has(cacheKey)) {
        console.log(`[ZoneOverlay] 구 메모리 캐시: ${currentDistrict.name}`);
        setZoneData({ zones: {}, categories: {} });
        updateState(zoneCache.current.get(cacheKey));
        return;
      }
      // 2. 브라우저 영구 캐시
      try {
        const browserCache = await caches.open('zone-data-v8');
        const cachedRes = await browserCache.match(cacheKey);
        if (cachedRes) {
          const data = await cachedRes.json();
          if (Date.now() - (data._timestamp || 0) < 86400000 * 7) {
            console.log(`[ZoneOverlay] 구 로컬 캐시: ${currentDistrict.name}`);
            setZoneData({ zones: {}, categories: {} });
            updateState(data);
            zoneCache.current.set(cacheKey, data);
            return;
          }
        }
      } catch (e) { console.warn('Browser Cache Error:', e); }

      // 3. 구 bbox 계산 후 서버 패치
      const bbox = calcDistrictBbox(currentDistrict.coords);
      if (!bbox) return;
      console.log(`[ZoneOverlay] 구 서버 패치: ${currentDistrict.name} (dist=${bbox.dist}m)`);
      setLoadingGroups({ world_zones: true });
      setZoneData({ zones: {}, categories: {} }); // 이전 구 데이터 클리어

      try {
        const ALL_CATS = [
          'water', 'park', 'forest', 'natural_site',
          'residential', 'commercial', 'industrial', 'institutional', 'educational', 'medical', 'parking',
          'military', 'religious', 'sports', 'cemetery', 'transport', 'port',
          'road_major', 'road_minor', 'unexplored'
        ];
        const response = await worldApi.getZones(bbox.lat, bbox.lng, bbox.dist, ALL_CATS.join(','));
        const data = response.data;
        data._timestamp = Date.now();
        updateState(data);
        zoneCache.current.set(cacheKey, data);
        const browserCache = await caches.open('zone-data-v8');
        browserCache.put(cacheKey, new Response(JSON.stringify(data)));
        console.log(`[ZoneOverlay] 구 로드 완료: ${currentDistrict.name}`);
      } catch (err) {
        console.error('[ZoneOverlay] 구 패치 실패:', err);
      } finally {
        setLoadingGroups({});
      }
    };

    fetchForDistrict();
  }, [visible, currentDistrict?.id]); // 구 ID가 바뀔 때만

  // [Fallback] currentDistrict 없을 때 기존 이동거리 방식 유지
  useEffect(() => {
    if (!visible || currentDistrict) return; // 구가 있으면 위 effect가 담당

    const gridKey = `${playerGps.lat.toFixed(2)}_${playerGps.lng.toFixed(2)}`;
    const dx = (playerPos?.x || 0) - lastFetchPos.current.x;
    const dz = (playerPos?.z || 0) - lastFetchPos.current.z;
    const moveDist = Math.sqrt(dx * dx + dz * dz);
    if (moveDist < FETCH_DISTANCE && Object.keys(zoneData.zones).length > 0) return;
    lastFetchPos.current = { x: playerPos?.x || 0, z: playerPos?.z || 0 };

    const fetchGroup = async (groupName, categories) => {
      const cacheKey = `${groupName}_${gridKey}`;
      if (zoneCache.current.has(cacheKey)) { updateState(zoneCache.current.get(cacheKey)); return; }
      try {
        const browserCache = await caches.open('zone-data-v8');
        const cachedRes = await browserCache.match(cacheKey);
        if (cachedRes) {
          const data = await cachedRes.json();
          if (Date.now() - (data._timestamp || 0) < 86400000 * 7) {
            updateState(data); zoneCache.current.set(cacheKey, data); return;
          }
        }
      } catch (e) { console.warn('Browser Cache Error:', e); }
      setLoadingGroups(prev => ({ ...prev, [groupName]: true }));
      try {
        const response = await worldApi.getZones(playerGps.lat, playerGps.lng, zoneRadius, categories.join(','));
        const data = response.data;
        data._timestamp = Date.now();
        updateState(data);
        zoneCache.current.set(cacheKey, data);
        const browserCache = await caches.open('zone-data-v8');
        browserCache.put(cacheKey, new Response(JSON.stringify(data)));
      } catch (err) {
        console.error(`[ZoneOverlay] ${groupName} 로드 실패:`, err);
      } finally {
        setLoadingGroups(prev => ({ ...prev, [groupName]: false }));
      }
    };
    const ALL_CATS = [
      'water', 'park', 'forest', 'natural_site',
      'residential', 'commercial', 'industrial', 'institutional', 'educational', 'medical', 'parking',
      'military', 'religious', 'sports', 'cemetery', 'transport', 'port',
      'road_major', 'road_minor', 'unexplored'
    ];
    fetchGroup('world_zones', ALL_CATS);
  }, [visible, playerGps.lat, playerGps.lng]);

  // Zone 데이터가 축적될 때마다 부모(RpgWorld)에게 전달 → SeoulHeightMap 텍스처 페인팅용
  useEffect(() => {
    if (onZoneLoaded && zoneData && Object.keys(zoneData.zones).length > 0) {
      onZoneLoaded(zoneData);
    }
  }, [zoneData, onZoneLoaded]);

  // Zone 데이터를 Three.js Geometry로 변환 (heightmap이 로드되면 재빌드)
  const geometries = useMemo(() => {
    if (!zoneData?.zones) return {};

    const geos = {};
    const zones = zoneData.zones;

    const ALL_POLYGON_CATS = [
      'water', 'park', 'forest', 'natural_site',
      'residential', 'commercial', 'industrial', 'institutional',
      'educational', 'medical', 'parking',
      'military', 'religious', 'sports', 'cemetery', 'transport', 'port',
      'unexplored'
    ];
    // 폴리곤 카테고리
    for (const cat of ALL_POLYGON_CATS) {
      const polygons = (zones[cat] || []).filter(f => f.type === 'polygon');
      if (polygons.length > 0) {
        geos[cat] = { type: 'polygon', geometry: buildZonePolygonGeometry(polygons) };
      }
    }

    // 라인 카테고리 (도로) - heightmap 전달로 지형 추종
    for (const cat of ['road_major', 'road_minor']) {
      const lines = (zones[cat] || []).filter(f => f.type === 'line');
      const lineGeo = lines.length > 0
        ? buildZoneLineGeometry(lines, cat === 'road_major' ? 25 : 12, heightmap, heightScale)
        : null;
      if (lineGeo) {
        geos[cat] = { type: 'line', geometry: lineGeo };
      }
    }

    // 수계(강) 라인도 지형 추종
    const waterLines = (zones.water || []).filter(f => f.type === 'line');
    if (waterLines.length > 0) {
      geos['water_line'] = { type: 'line', geometry: buildZoneLineGeometry(waterLines, 30, heightmap, heightScale) };
    }

    return geos;
  }, [zoneData, heightmap]); // heightmap 로드 시 자동 재빌드

  if (!visible || !zoneData) return null;

  // 기본: 모든 Zone 활성화
  const defaults = {
    water: true, park: true, forest: true, natural_site: true, road_major: true, road_minor: true,
    residential: true, commercial: true, industrial: true, institutional: true,
    educational: true, medical: true, parking: true,
    military: true, religious: true, sports: true, cemetery: true, transport: true, port: true,
    unexplored: true
  };
  const enabled = { ...defaults, ...enabledZones };

  return (
    <group name="zone-overlay-group">
      {/* 폴리곤 기반 Zone */}
      {enabled.water && geometries.water && (
        <ZoneMesh geometry={geometries.water.geometry} color={ZONE_COLORS.water} opacity={ZONE_OPACITY.water} elevation={elevation} />
      )}
      {enabled.water && geometries.water_line && (
        <ZoneLineMesh geometry={geometries.water_line.geometry} color={ZONE_COLORS.water} opacity={ZONE_OPACITY.water} elevation={elevation} />
      )}
      {enabled.park && geometries.park && (
        <ZoneMesh geometry={geometries.park.geometry} color={ZONE_COLORS.park} opacity={ZONE_OPACITY.park} elevation={elevation + 0.01} />
      )}
      {enabled.forest && geometries.forest && (
        <ZoneMesh geometry={geometries.forest.geometry} color={ZONE_COLORS.forest} opacity={ZONE_OPACITY.forest} elevation={elevation + 0.02} />
      )}
      {enabled.natural_site && geometries.natural_site && (
        <ZoneMesh geometry={geometries.natural_site.geometry} color={ZONE_COLORS.natural_site} opacity={ZONE_OPACITY.natural_site} elevation={elevation + 0.015} />
      )}
      {enabled.residential && geometries.residential && (
        <ZoneMesh geometry={geometries.residential.geometry} color={ZONE_COLORS.residential} opacity={ZONE_OPACITY.residential} elevation={elevation + 0.005} />
      )}
      {enabled.commercial && geometries.commercial && (
        <ZoneMesh geometry={geometries.commercial.geometry} color={ZONE_COLORS.commercial} opacity={ZONE_OPACITY.commercial} elevation={elevation + 0.005} />
      )}
      {enabled.industrial && geometries.industrial && (
        <ZoneMesh geometry={geometries.industrial.geometry} color={ZONE_COLORS.industrial} opacity={ZONE_OPACITY.industrial} elevation={elevation + 0.005} />
      )}
      {enabled.institutional && geometries.institutional && (
        <ZoneMesh geometry={geometries.institutional.geometry} color={ZONE_COLORS.institutional} opacity={ZONE_OPACITY.institutional} elevation={elevation + 0.005} />
      )}
      {enabled.educational && geometries.educational && (
        <ZoneMesh geometry={geometries.educational.geometry} color={ZONE_COLORS.educational} opacity={ZONE_OPACITY.educational} elevation={elevation + 0.005} />
      )}
      {enabled.medical && geometries.medical && (
        <ZoneMesh geometry={geometries.medical.geometry} color={ZONE_COLORS.medical} opacity={ZONE_OPACITY.medical} elevation={elevation + 0.005} />
      )}
      {enabled.parking && geometries.parking && (
        <ZoneMesh geometry={geometries.parking.geometry} color={ZONE_COLORS.parking} opacity={ZONE_OPACITY.parking} elevation={elevation + 0.005} />
      )}
      {enabled.military && geometries.military && (
        <ZoneMesh geometry={geometries.military.geometry} color={ZONE_COLORS.military} opacity={ZONE_OPACITY.military} elevation={elevation + 0.005} />
      )}
      {enabled.religious && geometries.religious && (
        <ZoneMesh geometry={geometries.religious.geometry} color={ZONE_COLORS.religious} opacity={ZONE_OPACITY.religious} elevation={elevation + 0.005} />
      )}
      {enabled.sports && geometries.sports && (
        <ZoneMesh geometry={geometries.sports.geometry} color={ZONE_COLORS.sports} opacity={ZONE_OPACITY.sports} elevation={elevation + 0.005} />
      )}
      {enabled.cemetery && geometries.cemetery && (
        <ZoneMesh geometry={geometries.cemetery.geometry} color={ZONE_COLORS.cemetery} opacity={ZONE_OPACITY.cemetery} elevation={elevation + 0.005} />
      )}
      {enabled.transport && geometries.transport && (
        <ZoneMesh geometry={geometries.transport.geometry} color={ZONE_COLORS.transport} opacity={ZONE_OPACITY.transport} elevation={elevation + 0.005} />
      )}
      {enabled.port && geometries.port && (
        <ZoneMesh geometry={geometries.port.geometry} color={ZONE_COLORS.port} opacity={ZONE_OPACITY.port} elevation={elevation + 0.005} />
      )}
      {/* 미개척 지형 — 가장 밑에 렌더 (다른 레이어가 없는 빈 공간 채우기) */}
      {enabled.unexplored && geometries.unexplored && (
        <ZoneMesh geometry={geometries.unexplored.geometry} color={ZONE_COLORS.unexplored} opacity={ZONE_OPACITY.unexplored} elevation={elevation + 0.001} />
      )}

      {/* 라인 기반 Zone (도로) */}
      {enabled.road_major && geometries.road_major && (
        <ZoneLineMesh geometry={geometries.road_major.geometry} color={ZONE_COLORS.road_major} opacity={ZONE_OPACITY.road_major} elevation={elevation + 0.03} />
      )}
      {enabled.road_minor && geometries.road_minor && (
        <ZoneLineMesh geometry={geometries.road_minor.geometry} color={ZONE_COLORS.road_minor} opacity={ZONE_OPACITY.road_minor} elevation={elevation + 0.025} />
      )}
    </group>
  );
};

export { ZONE_COLORS };
export default ZoneOverlay;
