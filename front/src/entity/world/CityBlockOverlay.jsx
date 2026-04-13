import React, { useMemo, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';
import worldApi from '@api/world';

// 동 ID 기준 파티션 데이터 캐시
const partitionCache = new Map();
// 동 ID 기준 그룹 boundary 캐시
const groupBoundaryCache = new Map();
// group_key 기준 geometry 캐시 (세션 전체 유지 — 재방문 시 rebuild 없음)
const groupGeometryCache = new Map(); // key: `${group_key}:${texCount}` → [{geo, texIdx, order}]

export const clearPartitionCache = () => {
  partitionCache.clear();
  groupBoundaryCache.clear();
  groupGeometryCache.clear();
};

// 브라우저 콘솔에서 window.clearPartitionCache() 로 바로 호출 가능
if (typeof window !== 'undefined') {
  window.clearPartitionCache = clearPartitionCache;
}


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

// 파티션 종횡비 캡 (Python 동일 값)
const MAX_PARTITION_ASPECT = 3.0;

// 고도 스케일: 실제 100m → 10 world unit (노량진1동 5~92m → 게임 내 0.5~9.2 unit)
// showElevation=false 시 effective scale = 0 → 전체 평지
const ELEV_SCALE = 1.0;
const BASE_Y = 0.55;

// world-space UV tile size (meters) — 인접 파티션이 같은 theme이면 텍스처가 끊김 없이 이어짐
const TILE_SIZE = 100.0;

// theme_code → 텍스처 파일 매핑 (Phase 1 단순화: 5~6종 타일링)
const THEME_TEXTURE_MAP = {
  sanctuary_green:     '/ground/forest/Lucid_Origin_isometric_25D_fantasy_RPG_background_topdown_diag_0.jpg',
  ancient_stone_route: '/ground/grounds/Lucid_Origin_isometric_25D_fantasy_RPG_background_topdown_diag_0.jpg',
  water:               '/ground/ice/Lucid_Origin_frozen_tundra_landscape_from_directly_above_with__0.jpg',
  urban_road:          '/ground/grounds/lucid-origin_top-down_view_not_rotated_not_45_degree_slight_isometric_feel_2.5D_fantasy_RPG_e-0.jpg',
  residential:         '/ground/grounds/Lucid_Origin_isometric_25D_fantasy_RPG_background_topdown_diag_1.jpg',
  special:             '/ground/p024_scene_a_test/ds_dungeon_hall_00001_.png',
  default:             '/ground/grounds/Lucid_Origin_isometric_25D_fantasy_RPG_background_topdown_diag_0.jpg',
};
const THEME_TEXTURE_PATHS = [...new Set(Object.values(THEME_TEXTURE_MAP))];

/**
 * per-partition 이미지의 UV repeat 계산
 * Python compute_image_size 와 동일한 로직: MAX_ASPECT:1 초과 → 타일링
 * @returns {{ x: number, z: number }}  UV repeat (1보다 크면 타일링)
 */
const computePartitionRepeat = (partition) => {
  const b = partition.boundary_geojson;
  if (!b?.coordinates?.[0]) return { x: 1, z: 1 };

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [lng, lat] of b.coordinates[0]) {
    const pt = gpsToGame(lat, lng);
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.z < minZ) minZ = pt.z;
    if (pt.z > maxZ) maxZ = pt.z;
  }
  const realW = maxX - minX || 1;  // meters
  const realH = maxZ - minZ || 1;  // meters

  let tileW, tileH;
  if (realW > realH * MAX_PARTITION_ASPECT) {
    tileW = realH * MAX_PARTITION_ASPECT;
    tileH = realH;
  } else if (realH > realW * MAX_PARTITION_ASPECT) {
    tileW = realW;
    tileH = realW * MAX_PARTITION_ASPECT;
  } else {
    tileW = realW;
    tileH = realH;
  }
  return { x: realW / tileW, z: realH / tileH };
};

// fitUV=false: 100m 타일 반복 (풀 텍스처용)
// fitUV=true + uvBounds: group bounding box 기준 UV (group 이미지 공유용)
// fitUV=true + uvBounds=null: 개별 polygon bounding box에 맞춤
// uvRepeat: per-partition 타일링 반복 횟수 (기본 {x:1,z:1})
const buildTerrainBlock = (coords, holes = [], fitUV = false, uvBounds = null, uvRepeat = null, elevY = BASE_Y) => {
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

  let minX, minZ, spanX, spanZ;
  if (fitUV && uvBounds) {
    // group bounding box 기준 UV: 모든 파티션이 같은 좌표계 공유
    minX = uvBounds.minX;
    minZ = uvBounds.minZ;
    spanX = uvBounds.spanX;
    spanZ = uvBounds.spanZ;
  } else {
    let maxX = -Infinity, maxZ = -Infinity;
    minX = Infinity; minZ = Infinity;
    triangulationPts.forEach((p) => {
      minX = Math.min(minX, p.x);
      minZ = Math.min(minZ, p.z);
      maxX = Math.max(maxX, p.x);
      maxZ = Math.max(maxZ, p.z);
    });
    spanX = maxX - minX || 1;
    spanZ = maxZ - minZ || 1;
  }

  const positions = new Float32Array(faces.length * 9);
  const uvs = new Float32Array(faces.length * 6);
  let vi = 0, ui = 0;

  for (const [a, b, c] of faces) {
    for (const idx of [a, b, c]) {
      const p = triangulationPts[idx];
      positions[vi++] = p.x;
      positions[vi++] = elevY;
      positions[vi++] = p.z;
      if (fitUV) {
        const rx = uvRepeat ? uvRepeat.x : 1;
        const rz = uvRepeat ? uvRepeat.z : 1;
        uvs[ui++] = ((p.x - minX) / spanX) * rx;
        uvs[ui++] = ((p.z - minZ) / spanZ) * rz;
      } else {
        // world-space UV: 인접 파티션이 같은 theme이면 경계 없이 이어짐
        uvs[ui++] = p.x / TILE_SIZE;
        uvs[ui++] = p.z / TILE_SIZE;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
};

const buildTerrainBlockFromGeoJson = (boundaryGeoJson, fitUV = false, uvBounds = null, uvRepeat = null, elevY = BASE_Y) => {
  if (!boundaryGeoJson?.coordinates?.length) return null;
  const [outer, ...holes] = boundaryGeoJson.coordinates;
  const outerCoords = outer.map(([lng, lat]) => [lat, lng]);
  const holeCoords = holes.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
  return buildTerrainBlock(outerCoords, holeCoords, fitUV, uvBounds, uvRepeat, elevY);
};

// Polygon / MultiPolygon GeoJSON → 하나의 merged BufferGeometry (그룹 단위 바닥용, flat 모드)
const buildGroupBoundaryGeometries = (boundaryGeoJson, elevY = BASE_Y) => {
  if (!boundaryGeoJson) return [];
  const { type, coordinates } = boundaryGeoJson;
  const rings = [];
  if (type === 'Polygon') {
    rings.push(coordinates);
  } else if (type === 'MultiPolygon') {
    for (const poly of coordinates) rings.push(poly);
  } else {
    return [];
  }
  const result = [];
  for (const [outer, ...holes] of rings) {
    if (!outer || outer.length < 3) continue;
    const outerCoords = outer.map(([lng, lat]) => [lat, lng]);
    const holeCoords = holes.map((ring) => ring.map(([lng, lat]) => [lat, lng]));
    const geo = buildTerrainBlock(outerCoords, holeCoords, false, null, null, elevY);
    if (geo) result.push(geo);
  }
  return result;
};

/**
 * SketchUp push/pull 방식: polygon + elevation → 상단면 + 측면벽 하나의 3D 메시
 * geometry.groups[0] = 상단면 (partition texture)
 * geometry.groups[1] = 측면벽 (cliff texture)
 * depthWrite=true 사용 → 카메라 회전에도 GPU depth sorting 정상 동작
 */
const buildExtrudedPolygon = (outerRing, holes = [], yTop, yBot = -1.0) => {
  if (!outerRing || outerRing.length < 3) return null;

  // ── 좌표 변환 ──────────────────────────────────────────────────────────
  const pts = outerRing.map(([lng, lat]) => gpsToGame(lat, lng));
  const holePts = holes.map(hole => hole.map(([lng, lat]) => gpsToGame(lat, lng)));

  // ── 상단면 삼각분할 ────────────────────────────────────────────────────
  const contour    = pts.map(p => new THREE.Vector2(p.x, p.z));
  const holeConts  = holePts.map(h => h.map(p => new THREE.Vector2(p.x, p.z)));
  const allPts     = [pts, ...holePts].flat();
  let faces;
  try { faces = THREE.ShapeUtils.triangulateShape(contour, holeConts); }
  catch(_) { return null; }
  if (!faces?.length) return null;

  // 상단면 UV bounding box
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of allPts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  const spanX = maxX - minX || 1, spanZ = maxZ - minZ || 1;

  const topCount  = faces.length * 3;
  // 외곽 링 + 홀 링 모두 벽 생성
  const allRings  = [pts, ...holePts];
  let wallCount = 0;
  for (const ring of allRings) wallCount += (ring.length - 1) * 6;

  const positions = new Float32Array((topCount + wallCount) * 3);
  const uvs       = new Float32Array((topCount + wallCount) * 2);
  let vi = 0, ui = 0;

  // ── 상단면 버텍스 ──────────────────────────────────────────────────────
  for (const [a, b, c] of faces) {
    for (const idx of [a, b, c]) {
      const p = allPts[idx];
      positions[vi++] = p.x; positions[vi++] = yTop; positions[vi++] = p.z;
      uvs[ui++] = (p.x - minX) / spanX;
      uvs[ui++] = (p.z - minZ) / spanZ;
    }
  }

  // ── 측면벽 버텍스 (외곽 + 홀 링) ──────────────────────────────────────
  const heightDiff = yTop - yBot;
  for (const ring of allRings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const p0 = ring[i], p1 = ring[i + 1];
      const edgeLen = Math.sqrt((p1.x - p0.x) ** 2 + (p1.z - p0.z) ** 2);
      if (edgeLen < 0.01) continue;
      const uS = edgeLen / 5, vS = heightDiff / 5;
      // tri 1
      positions[vi++] = p0.x; positions[vi++] = yBot;  positions[vi++] = p0.z;
      positions[vi++] = p0.x; positions[vi++] = yTop;  positions[vi++] = p0.z;
      positions[vi++] = p1.x; positions[vi++] = yTop;  positions[vi++] = p1.z;
      uvs[ui++] = 0; uvs[ui++] = 0;
      uvs[ui++] = 0; uvs[ui++] = vS;
      uvs[ui++] = uS; uvs[ui++] = vS;
      // tri 2
      positions[vi++] = p0.x; positions[vi++] = yBot;  positions[vi++] = p0.z;
      positions[vi++] = p1.x; positions[vi++] = yTop;  positions[vi++] = p1.z;
      positions[vi++] = p1.x; positions[vi++] = yBot;  positions[vi++] = p1.z;
      uvs[ui++] = 0; uvs[ui++] = 0;
      uvs[ui++] = uS; uvs[ui++] = vS;
      uvs[ui++] = uS; uvs[ui++] = 0;
    }
  }

  const geo = new THREE.BufferGeometry();
  // 실제 쓴 버텍스 수로 잘라냄 (edgeLen<0.01 skip으로 vi < totalCount 가능)
  geo.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, vi), 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvs.subarray(0, ui),       2));
  geo.addGroup(0, topCount, 0);           // 상단면
  geo.addGroup(topCount, vi / 3 - topCount, 1); // 측면벽
  return geo;
};

// 두 파티션 간 고도차 기준: 초과 → cliff, 이하 → slope
const CLIFF_DIFF_THRESHOLD = 8;
// 엣지 매칭 정밀도: 0.5m 단위 (float 변환 오차 흡수)
const EDGE_RF = 2;

/**
 * 인접 파티션 쌍 기반 절벽 생성 (구 buildPartitionSkirts 대체)
 * - 공유 엣지: 두 파티션 고도 차이만큼만 수직 면 생성
 * - 외곽 엣지: 파티션 상단 → -1.0 (동 경계, 다른 레이어 floor 의존 없음)
 */
const buildAdjacentCliffs = (partitions, effectiveScale) => {
  if (effectiveScale === 0 || !partitions?.length) return [];

  // ── 엣지 맵 구축 ──────────────────────────────────────────────────────────
  const edgeMap = new Map();
  for (const partition of partitions) {
    const b = partition.boundary_geojson;
    if (!b?.coordinates?.[0]) continue;
    const elevY = BASE_Y + (partition.elevation_m ?? 0) * effectiveScale;
    const outer = b.coordinates[0];
    for (let i = 0; i < outer.length - 1; i++) {
      const p0 = gpsToGame(outer[i][1],     outer[i][0]);
      const p1 = gpsToGame(outer[i + 1][1], outer[i + 1][0]);
      const r0x = Math.round(p0.x * EDGE_RF), r0z = Math.round(p0.z * EDGE_RF);
      const r1x = Math.round(p1.x * EDGE_RF), r1z = Math.round(p1.z * EDGE_RF);
      if (r0x === r1x && r0z === r1z) continue;
      const key = (r0x < r1x || (r0x === r1x && r0z < r1z))
        ? `${r0x},${r0z}|${r1x},${r1z}` : `${r1x},${r1z}|${r0x},${r0z}`;
      if (!edgeMap.has(key)) edgeMap.set(key, { p0, p1, elevYs: [] });
      edgeMap.get(key).elevYs.push(elevY);
    }
  }

  const cliffPos = [], cliffUv = [];
  const slopePos = [], slopeUv = [];

  for (const [, { p0, p1, elevYs }] of edgeMap) {
    let yLow, yHigh;
    if (elevYs.length >= 2) {
      // 공유 엣지: 두 파티션 고도 차이만
      yLow  = Math.min(...elevYs);
      yHigh = Math.max(...elevYs);
      if (yHigh - yLow < 0.05) continue;
    } else {
      // 외곽 엣지(동 경계): 파티션 상단 → 지표 아래
      // elevation=0이어도 바닥(BASE_Y=0.55)과 배경(Y=0) 사이 갭이 존재하므로 항상 생성
      yHigh = elevYs[0];
      yLow  = -1.0;
    }

    const heightDiff = yHigh - yLow;
    const isCliff    = heightDiff > CLIFF_DIFF_THRESHOLD;
    const edgeLen    = Math.sqrt((p1.x - p0.x) ** 2 + (p1.z - p0.z) ** 2);
    const uScale     = edgeLen / 5;
    const vScale     = heightDiff / 5;

    const pos = isCliff ? cliffPos : slopePos;
    const uv  = isCliff ? cliffUv  : slopeUv;

    pos.push(p0.x, yLow,  p0.z,  p0.x, yHigh, p0.z,  p1.x, yHigh, p1.z);
    uv.push(0, 0,  0, vScale,  uScale, vScale);
    pos.push(p0.x, yLow,  p0.z,  p1.x, yHigh, p1.z,  p1.x, yLow,  p1.z);
    uv.push(0, 0,  uScale, vScale,  uScale, 0);
  }

  const result = [];
  if (cliffPos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cliffPos), 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(cliffUv),  2));
    result.push({ geo, isWall: true, isCliff: true, order: 4 });
  }
  if (slopePos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(slopePos), 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(slopeUv),  2));
    result.push({ geo, isWall: true, isCliff: false, order: 4 });
  }
  return result;
};

/**
 * 그룹 union boundary polygon 외곽 링 → 수직 옹벽 압출
 * per-partition 엣지 매칭 불필요 — union polygon이 내부 갭 없는 깨끗한 경계 제공
 * 각 그룹의 평균 고도에서 yBot=-1.0까지 전 외곽을 덮음 (sparse gap 원천 제거)
 */
const buildGroupBoundaryCliffs = (dbGroups, groupElevMap, activeGroupKeys, effectiveScale) => {
  if (effectiveScale === 0 || !dbGroups?.length) return [];

  const cliffPos = [], cliffUv = [];
  const slopePos = [], slopeUv = [];
  const yBot = -1.0;

  for (const g of dbGroups) {
    if (!activeGroupKeys.has(g.group_key)) continue;
    if (!g.boundary_geojson) continue;

    const ge = groupElevMap.get(g.group_key);
    const avgElev = ge && ge.count > 0 ? ge.sum / ge.count : 0;
    const yHigh = BASE_Y + avgElev * effectiveScale;
    const heightDiff = yHigh - yBot;

    // Polygon / MultiPolygon 외곽 링만 추출
    const { type, coordinates } = g.boundary_geojson;
    const outerRings = [];
    if (type === 'Polygon') {
      if (coordinates[0]) outerRings.push(coordinates[0]);
    } else if (type === 'MultiPolygon') {
      for (const poly of coordinates) {
        if (poly[0]) outerRings.push(poly[0]);
      }
    }

    for (const ring of outerRings) {
      if (!ring || ring.length < 2) continue;
      for (let i = 0; i < ring.length - 1; i++) {
        const p0 = gpsToGame(ring[i][1],     ring[i][0]);
        const p1 = gpsToGame(ring[i + 1][1], ring[i + 1][0]);
        const edgeLen = Math.sqrt((p1.x - p0.x) ** 2 + (p1.z - p0.z) ** 2);
        if (edgeLen < 0.01) continue;

        const isCliff = heightDiff > CLIFF_DIFF_THRESHOLD;
        const uScale  = edgeLen / 5;
        const vScale  = heightDiff / 5;
        const pos = isCliff ? cliffPos : slopePos;
        const uv  = isCliff ? cliffUv  : slopeUv;

        pos.push(p0.x, yBot,  p0.z,  p0.x, yHigh, p0.z,  p1.x, yHigh, p1.z);
        uv.push(0, 0,  0, vScale,  uScale, vScale);
        pos.push(p0.x, yBot,  p0.z,  p1.x, yHigh, p1.z,  p1.x, yBot,  p1.z);
        uv.push(0, 0,  uScale, vScale,  uScale, 0);
      }
    }
  }

  const result = [];
  if (cliffPos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cliffPos), 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(cliffUv),  2));
    result.push({ geo, isWall: true, isCliff: true, order: 4 });
  }
  if (slopePos.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(slopePos), 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(slopeUv),  2));
    result.push({ geo, isWall: true, isCliff: false, order: 4 });
  }
  return result;
};

// group_key 단위 geometry 빌드 (캐시 우선)
// partitionTexIndexMap: Map<partition_key, texIndex> — ComfyUI 생성 이미지가 있는 파티션의 텍스처 인덱스
// poolCount: 풀 텍스처 개수 (fallback hash 계산에 사용)
const getGroupGeometries = (groupKey, allPartitions, texCount, partitionTexIndexMap, poolCount, effectiveScale = ELEV_SCALE) => {
  const mapSize = partitionTexIndexMap ? partitionTexIndexMap.size : 0;
  // elevation 합산 + scale을 캐시 키에 포함 — 고도 on/off 전환 시 geometry 재빌드
  const elevSum = allPartitions
    .filter(p => p.group_key === groupKey)
    .reduce((s, p) => s + (p.elevation_m ?? 0), 0);
  const cacheKey = `${groupKey}:${texCount}:${mapSize}:${elevSum.toFixed(1)}:${effectiveScale}`;
  if (groupGeometryCache.has(cacheKey)) return groupGeometryCache.get(cacheKey);

  const fallbackCount = poolCount || texCount;

  // group 전체 bounding box 계산 (group 이미지 공유 UV용)
  let gMinX = Infinity, gMinZ = Infinity, gMaxX = -Infinity, gMaxZ = -Infinity;
  for (const p of allPartitions) {
    if (p.group_key !== groupKey) continue;
    const b = p.boundary_geojson;
    if (!b?.coordinates?.[0]) continue;
    for (const [lng, lat] of b.coordinates[0]) {
      const pt = gpsToGame(lat, lng);
      if (pt.x < gMinX) gMinX = pt.x;
      if (pt.x > gMaxX) gMaxX = pt.x;
      if (pt.z < gMinZ) gMinZ = pt.z;
      if (pt.z > gMaxZ) gMaxZ = pt.z;
    }
  }
  const groupUvBounds = gMinX < Infinity ? {
    minX: gMinX, minZ: gMinZ,
    spanX: gMaxX - gMinX || 1,
    spanZ: gMaxZ - gMinZ || 1,
  } : null;

  // URL 공유 여부 파악: 같은 URL을 쓰는 파티션이 2개 이상 → group 이미지 → group bbox UV
  // 파티션마다 고유 URL → per-partition 이미지 → 개별 bbox UV (uvBounds=null)
  const urlCount = new Map();
  for (const p of allPartitions) {
    if (p.group_key !== groupKey || !p.texture_image_url) continue;
    urlCount.set(p.texture_image_url, (urlCount.get(p.texture_image_url) || 0) + 1);
  }

  const result = [];
  for (const partition of allPartitions) {
    if (partition.group_key !== groupKey) continue;

    const hasOwnImage = partitionTexIndexMap && partitionTexIndexMap.has(partition.partition_key);
    // group 이미지(공유 URL) → group bbox UV, per-partition 이미지(고유 URL) → 개별 bbox UV
    const isSharedGroupImage = hasOwnImage && (urlCount.get(partition.texture_image_url) || 0) > 1;
    const uvBounds = isSharedGroupImage ? groupUvBounds : null;
    // per-partition 이미지: 종횡비 초과 구역은 타일 UV repeat 적용
    const uvRepeat = (hasOwnImage && !isSharedGroupImage)
      ? computePartitionRepeat(partition)
      : null;
    const elevY = BASE_Y + (partition.elevation_m ?? 0) * effectiveScale;
    const geo = buildTerrainBlockFromGeoJson(partition.boundary_geojson, hasOwnImage, uvBounds, uvRepeat, elevY);
    if (!geo) continue;

    // partitionTexUrlMap: Map<partition_key, url> — 파일 존재 여부는 렌더 시점에 판단
    const partitionUrl = hasOwnImage ? partitionTexIndexMap.get(partition.partition_key) : null;
    const seed = hashString([
      partition.partition_key || '',
      partition.group_key || '',
      partition.group_theme_code || '',
      partition.texture_profile || '',
      partition.partition_seq || 0,
    ].join('|'));
    const texIdx = seed % fallbackCount;  // fallback (partitionUrl 로드 실패 시 사용)
    result.push({ geo, texIdx, themeCode: partition.group_theme_code || 'default', partitionUrl, order: 5, transparent: !!partitionUrl });
  }

  groupGeometryCache.set(cacheKey, result);
  return result;
};

const DongMask = ({ currentDong, currentDistrict, elevation }) => {
  // 동이 감지되기 전에는 구 경계를 마스크로 사용 (stencil=1 선공급)
  const maskSource = currentDong || currentDistrict;
  const geo = useMemo(() => {
    if (!maskSource?.coords || maskSource.coords.length < 3) return null;
    try {
      const shape = new THREE.Shape();
      const first = gpsToGame(maskSource.coords[0][0], maskSource.coords[0][1]);
      shape.moveTo(first.x, -first.z);
      for (let i = 1; i < maskSource.coords.length; i += 1) {
        const p = gpsToGame(maskSource.coords[i][0], maskSource.coords[i][1]);
        shape.lineTo(p.x, -p.z);
      }
      return new THREE.ShapeGeometry(shape);
    } catch (_) {
      return null;
    }
  }, [maskSource]);

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

// partition URL 개별 로드 — 404 시 null (useTexture는 크래시하므로 사용 불가)
function usePartitionTextures(urls) {
  const [texMap, setTexMap] = useState(() => new Map());
  const urlKey = urls.join('|');

  useEffect(() => {
    if (!urls.length) { setTexMap(new Map()); return; }
    const loader = new THREE.TextureLoader();
    const loaded = new Map();
    let remaining = urls.length;

    const onDone = (url, tex) => {
      loaded.set(url, tex);
      if (--remaining === 0) setTexMap(new Map(loaded));
    };

    urls.forEach((url) => {
      loader.load(
        url,
        (tex) => {
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.anisotropy = 16;
          tex.needsUpdate = true;
          onDone(url, tex);
        },
        undefined,
        () => onDone(url, null),  // 404 → null, 크래시 없음
      );
    });

    return () => {
      loaded.forEach((tex) => tex?.dispose());
    };
  }, [urlKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return texMap;
}

const CityBlockContent = ({
  texturePaths,     // pool 텍스처만 (항상 존재하는 파일)
  poolCount,
  partitionTexUrlMap,  // Map<partition_key, url> — 존재 여부 불문, 로드 실패 시 null
  partitionUrls,       // URL 배열 (커스텀 로딩용)
  zoneData,
  dbPartitions,
  dbGroups,
  currentDong,
  currentDistrict,
  elevation,
  showOriginalBlocks = true,
  showSectorBlocks = true,
  playerPositionRef,
  currentGroupOnly = false,
  showElevation = false,
}) => {
  const textures = useTexture(texturePaths);  // pool 텍스처 — 항상 존재하므로 안전
  const texCount = Array.isArray(textures) ? textures.length : 1;
  const partitionTextureMap = usePartitionTextures(partitionUrls);  // 개별 로드, 404 무시

  // theme_code 기반 텍스처 (world-space UV 타일링)
  const rawThemeTextures = useTexture(THEME_TEXTURE_PATHS);
  const themeTextures = Array.isArray(rawThemeTextures) ? rawThemeTextures : [rawThemeTextures];
  const themeTexMap = useMemo(() => {
    const map = {};
    for (const [code, path] of Object.entries(THEME_TEXTURE_MAP)) {
      const idx = THEME_TEXTURE_PATHS.indexOf(path);
      map[code] = themeTextures[idx] ?? themeTextures[0];
    }
    return map;
  }, [themeTextures]);

  // 지형 텍스처 로더 (404 크래시 없음)
  const loadTex = (url, setter) => {
    const loader = new THREE.TextureLoader();
    loader.load(url,
      (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; t.needsUpdate = true; setter(t); },
      undefined,
      () => setter(null),
    );
  };

  const [cliffTex, setCliffTex] = useState(null);
  const [slopeTex, setSlopeTex] = useState(null);

  useEffect(() => { loadTex('/ground/cliff/image.png', setCliffTex); }, []);
  useEffect(() => { loadTex('/ground/slope/image.png', setSlopeTex); }, []);

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
      // partitionTextureMap 텍스처는 usePartitionTextures 내부에서 이미 설정됨
    });
  }, [textures]);

  useEffect(() => {
    themeTextures.forEach((t) => {
      if (!t) return;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 16;
      t.needsUpdate = true;
    });
  }, [themeTextures]);

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
          result.push({ geo, texIdx: Math.floor(seed) % texCount, partitionUrl: null, order: 3 });
        });
      });
    }

    // showElevation on/off에 따른 effective scale
    const effectiveScale = showElevation ? ELEV_SCALE : 0;

    // 그룹 boundary 렌더링: currentGroupOnly 모드에서는 파티션 단위로 폴백
    if (showSectorBlocks && dbGroups?.length > 0 && activeGroupKeys.size > 0 && !currentGroupOnly) {
      // ── 그룹 평균 elevation 계산 (파티션별 elevation_m 평균) ──────────
      const groupElevMap = new Map();
      for (const p of dbPartitions) {
        if (!p.group_key) continue;
        const e = groupElevMap.get(p.group_key) ?? { sum: 0, count: 0 };
        e.sum += p.elevation_m ?? 0;
        e.count++;
        groupElevMap.set(p.group_key, e);
      }

      // ── 그룹 boundary 단위 렌더링 ──────────────────────────────────────
      for (const g of dbGroups) {
        if (!activeGroupKeys.has(g.group_key)) continue;
        if (!g.boundary_geojson || g.partition_count === 0) continue;

        const groupElev = groupElevMap.get(g.group_key);
        const avgElev   = groupElev && groupElev.count > 0 ? groupElev.sum / groupElev.count : 0;
        const groupElevY = BASE_Y + avgElev * effectiveScale;

        if (effectiveScale > 0) {
          // ── 등고선 ON: push/pull extruded 3D 메시 (상단면 + 측면벽 하나로) ──
          const { type, coordinates } = g.boundary_geojson;
          const polys = type === 'Polygon' ? [coordinates] : (type === 'MultiPolygon' ? coordinates : []);
          for (const [outer, ...holes] of polys) {
            if (!outer || outer.length < 3) continue;
            const geo = buildExtrudedPolygon(outer, holes, groupElevY);
            if (!geo) continue;
            result.push({ geo, themeCode: g.theme_code || 'default', order: 5, isExtruded: true });
          }
        } else {
          // ── 등고선 OFF: 기존 flat 폴리곤 ────────────────────────────────────
          const geoList = buildGroupBoundaryGeometries(g.boundary_geojson, groupElevY);
          for (const geo of geoList) {
            result.push({ geo, themeCode: g.theme_code || 'default', order: 5, transparent: false });
          }
        }
      }

      // effectiveScale > 0 시 buildGroupBoundaryCliffs 불필요 — extruded 메시에 벽 포함됨
    } else if (showSectorBlocks && dbPartitions?.length > 0) {
      // ── fallback: micro 파티션 단위 렌더링 (그룹 boundary 없을 때) ────
      const keysToRender = activeGroupKeys.size > 0
        ? activeGroupKeys
        : null;

      const targetGroupKeys = keysToRender
        ? new Set([...keysToRender])
        : (() => {
            const firstKey = dbPartitions.find(p => p.group_key)?.group_key;
            return firstKey ? new Set([firstKey]) : new Set();
          })();

      for (const groupKey of targetGroupKeys) {
        const geos = getGroupGeometries(groupKey, dbPartitions, texCount, partitionTexUrlMap, poolCount, effectiveScale);
        result.push(...geos);
      }

      // ── 파티션 단위 단차 옹벽 ─────────────────────────────────────────────
      if (effectiveScale > 0) {
        const partitionsToWall = dbPartitions.filter(p => targetGroupKeys.has(p.group_key));
        result.push(...buildAdjacentCliffs(partitionsToWall, effectiveScale));
      }
    } else if (showSectorBlocks && !currentGroupOnly && zoneData?.zones?.sectors) {
      // dbPartitions 없을 때 fallback (currentGroupOnly는 그룹 단독 렌더 — 전체 sectors 대체 불가)
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
  }, [showOriginalBlocks, showSectorBlocks, zoneData, dbPartitions, dbGroups, texCount, activeGroupKeys, partitionTexUrlMap, poolCount, showElevation]);

  // 동 경계 전체를 덮는 베이스 플레이트 — 파티션 폴리곤 좌표 불일치로 생기는
  // 흰 틈을 모두 메운다. renderOrder=3 (파티션 바닥=5 아래)
  const dongBasePlate = useMemo(() => {
    if (!currentDong?.coords?.length) return null;
    return buildTerrainBlock(currentDong.coords, currentDong.holes ?? [], false, null, null, BASE_Y - 0.05);
  }, [currentDong]);

  return (
    <group>
      <DongMask currentDong={currentDong} currentDistrict={currentDistrict} elevation={elevation + 0.01} />
      <group position={[0, elevation, 0]}>
        {blocks.map((block, index) => {
          // ── [A] Extruded 3D 메시 (showElevation ON, push/pull 방식) ────────────
          // geometry.groups[0]=상단면(partition tex), groups[1]=측면벽(cliff tex)
          // depthWrite=true → GPU depth sorting, 스텐실 불필요, 카메라 회전 안전
          if (block.isExtruded) {
            const topTex  = block.themeCode
              ? (themeTexMap[block.themeCode] ?? themeTexMap.default)
              : (Array.isArray(textures) ? textures[block.texIdx ?? 0] : textures);
            const wallTex = cliffTex ?? null;
            const wallColor = wallTex ? '#ffffff' : '#7a6850';
            return (
              <mesh key={`block-${index}`} geometry={block.geo} renderOrder={block.order}>
                <meshBasicMaterial attach="material-0" map={topTex}          side={THREE.FrontSide}   toneMapped={false} depthWrite={true} />
                <meshBasicMaterial attach="material-1" map={wallTex ?? undefined} color={wallColor} side={THREE.DoubleSide} toneMapped={false} depthWrite={true} />
              </mesh>
            );
          }

          // ── [B] 별도 cliff/slope 쿼드 (fallback: partition-level 또는 flat 모드) ──
          if (block.isWall) {
            const wallTex  = block.isCliff
              ? (cliffTex ?? null)
              : (slopeTex ?? cliffTex ?? null);
            const wallColor = wallTex ? '#ffffff' : (block.isCliff ? '#7a6850' : '#8a9a6a');
            return (
              <mesh key={`block-${index}`} geometry={block.geo} renderOrder={block.order}>
                <meshBasicMaterial
                  map={wallTex ?? undefined}
                  color={wallColor}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                  depthWrite={false}
                />
              </mesh>
            );
          }

          // ── [C] 기존 flat 파티션/존 블록 ──────────────────────────────────────
          const partTex = block.partitionUrl ? partitionTextureMap.get(block.partitionUrl) : null;
          const tex = partTex
            ?? (block.themeCode ? (themeTexMap[block.themeCode] ?? themeTexMap.default)
              : (Array.isArray(textures) ? textures[block.texIdx] : textures));
          const isTransparent = block.transparent && !!partTex;
          const useStencil = !showElevation;
          return (
          <mesh key={`block-${index}`} geometry={block.geo} renderOrder={block.order}>
            <meshBasicMaterial
              map={tex}
              transparent={isTransparent}
              alphaTest={isTransparent ? 0.1 : 0}
              opacity={1}
              stencilWrite={useStencil}
              stencilRef={useStencil ? 1 : 0}
              stencilFunc={useStencil ? THREE.EqualStencilFunc : THREE.AlwaysStencilFunc}
              side={THREE.DoubleSide}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
          );
        })}
      </group>
    </group>
  );
};

const CityBlockOverlay = ({
  zoneData,
  currentDong,
  currentDistrict,
  visible = true,
  elevation = 0.05,
  showOriginalBlocks = true,
  showSectorBlocks = true,
  playerPositionRef,
  currentGroupOnly = false,
  textureFolder = '',
  partitions = null,  // RpgWorld에서 주입 — null이면 자체 fetch
  showElevation = false,
}) => {
  const [texturePaths, setTexturePaths] = useState([]);
  const [dbPartitions, setDbPartitions] = useState([]);
  const [dbGroups, setDbGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchPaths = async () => {
      if (!cancelled) setLoading(true);
      try {
        const res = await worldApi.getBlockTextures(textureFolder);
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
  }, [textureFolder]);

  // partitions prop이 주입되면 fetch 스킵 (RpgWorld sharedPartitions 재사용)
  useEffect(() => {
    if (partitions !== null) {
      setDbPartitions(Array.isArray(partitions) ? partitions : []);
      return;
    }
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
  }, [partitions, showSectorBlocks, currentDong?.id]);

  // 그룹 boundary 데이터 (바닥 렌더링용 unioned polygon)
  useEffect(() => {
    let cancelled = false;
    if (!showSectorBlocks || !currentDong?.id) { setDbGroups([]); return; }
    if (groupBoundaryCache.has(currentDong.id)) {
      setDbGroups(groupBoundaryCache.get(currentDong.id));
      return;
    }
    worldApi.getCodexDongGroups(currentDong.id)
      .then((res) => {
        if (cancelled) return;
        const data = Array.isArray(res.data) ? res.data : [];
        // partition_count > 0 인 그룹만 (도로 corridor 제외)
        const flooring = data.filter((g) => g.partition_count > 0 && g.boundary_geojson);
        groupBoundaryCache.set(currentDong.id, flooring);
        setDbGroups(flooring);
      })
      .catch(() => { if (!cancelled) setDbGroups([]); });
    return () => { cancelled = true; };
  }, [showSectorBlocks, currentDong?.id]);

  // partition별 개별 이미지 경로 추출
  const partitionUrls = useMemo(() => {
    const seen = new Set();
    const urls = [];
    for (const p of dbPartitions) {
      if (!p.texture_image_url) continue;
      if (seen.has(p.texture_image_url)) continue;
      seen.add(p.texture_image_url);
      urls.push(p.texture_image_url);
    }
    return urls;
  }, [dbPartitions]);

  // partition_key → url 맵 (인덱스 불필요 — 개별 로딩으로 전환)
  const partitionTexUrlMap = useMemo(() => {
    if (!partitionUrls.length) return null;
    const map = new Map();
    for (const p of dbPartitions) {
      if (p.texture_image_url) map.set(p.partition_key, p.texture_image_url);
    }
    return map.size > 0 ? map : null;
  }, [partitionUrls, dbPartitions]);

  if (!visible || loading || texturePaths.length === 0) return null;

  return (
    <CityBlockContent
      texturePaths={texturePaths}
      poolCount={texturePaths.length}
      partitionTexUrlMap={partitionTexUrlMap}
      partitionUrls={partitionUrls}
      zoneData={zoneData}
      dbPartitions={dbPartitions}
      dbGroups={dbGroups}
      currentDong={currentDong}
      currentDistrict={currentDistrict}
      elevation={elevation}
      showOriginalBlocks={showOriginalBlocks}
      showSectorBlocks={showSectorBlocks}
      playerPositionRef={playerPositionRef}
      currentGroupOnly={currentGroupOnly}
      showElevation={showElevation}
    />
  );
};

export default CityBlockOverlay;
