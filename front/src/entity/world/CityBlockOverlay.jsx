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

// ── 절벽 Triplanar + FBM ShaderMaterial ──────────────────────────────────────
// 기법: Triplanar Mapping (UE5/Unity HDRP 표준)
//   UV 좌표 완전 무시, world position으로 XZ/YZ/XY 3축 샘플링 후
//   surface normal 크기 기반 블렌딩 → UV 반복·왜곡 원천 차단
//   + FBM noise로 미세 명암 변화 추가
const CLIFF_VERT = `
varying vec3 vWorldPos;
void main() {
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CLIFF_FRAG = `
#extension GL_OES_standard_derivatives : enable
uniform sampler2D uTex;
uniform float uScale;
varying vec3 vWorldPos;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p) {
  return vnoise(p*1.0)*0.50 + vnoise(p*2.1)*0.25
       + vnoise(p*4.3)*0.15 + vnoise(p*8.7)*0.10;
}

void main() {
  // normal 속성 없어도 face normal을 fragment derivative로 계산
  vec3 dx = dFdx(vWorldPos);
  vec3 dy = dFdy(vWorldPos);
  vec3 faceNormal = normalize(cross(dx, dy));

  // ── Triplanar: world pos로 3축 샘플링 ──
  vec3 pos = vWorldPos * uScale;
  vec4 cX = texture2D(uTex, pos.yz);
  vec4 cY = texture2D(uTex, pos.xz);
  vec4 cZ = texture2D(uTex, pos.xy);

  // face normal 기반 blend (sharpness=4)
  vec3 blend = pow(abs(faceNormal), vec3(4.0));
  float bSum = dot(blend, vec3(1.0));
  blend = (bSum > 0.0001) ? blend / bSum : vec3(0.0, 1.0, 0.0);

  vec4 col = cX * blend.x + cY * blend.y + cZ * blend.z;

  // ── FBM noise 명암 오버레이 ──
  float n = fbm(vWorldPos.xz * 0.012 + vec2(vWorldPos.y * 0.035));
  col.rgb *= mix(0.52, 1.05, n);

  gl_FragColor = col;
}
`;

// attach prop 전달 가능한 primitive 방식
const CliffShaderMat = React.memo(({ texture, attach }) => {
  const uniforms = useMemo(() => ({
    uTex:   { value: null },
    uScale: { value: 0.022 },
  }), []);

  useEffect(() => { uniforms.uTex.value = texture ?? null; }, [texture, uniforms]);

  return (
    <shaderMaterial
      attach={attach}
      vertexShader={CLIFF_VERT}
      fragmentShader={CLIFF_FRAG}
      uniforms={uniforms}
      side={THREE.DoubleSide}
      toneMapped={false}
      depthWrite={true}
    />
  );
});

// 고도 스케일: 실제 100m → 10 world unit (노량진1동 5~92m → 게임 내 0.5~9.2 unit)
// showElevation=false 시 effective scale = 0 → 전체 평지
const ELEV_SCALE = 1.0;
const BASE_Y = 0.55;

// world-space UV tile size (meters) — 인접 파티션이 같은 theme이면 텍스처가 끊김 없이 이어짐
const TILE_SIZE = 100.0;

// theme_code → 텍스처 파일 매핑 (Phase 1 단순화: 5~6종 타일링)
const THEME_TEXTURE_MAP = {
  sanctuary_green:     '/ground/rune/image.png',
  ancient_stone_route: '/ground/rune/image.png',
  water:               '/ground/ice/Lucid_Origin_frozen_tundra_landscape_from_directly_above_with__0.jpg',
  urban_road:          '/ground/rune/image.png',
  residential:         '/ground/rune/image.png',
  special:             '/ground/rune/image.png',
  default:             '/ground/rune/image.png',
};
const THEME_TEXTURE_PATHS = [...new Set(Object.values(THEME_TEXTURE_MAP))];

// ── terrain 모드: 고도 버킷 기반 텍스처 ────────────────────────────────────
const ELEV_LOW_MAX  = 10;   // elevation_m < 10  → low  (저지대/수변)
const ELEV_HIGH_MIN = 35;   // elevation_m >= 35 → high (고지대/산악)

const ELEV_TEXTURE_MAP = {
  elev_low:  '/ground/rune/image.png',
  elev_mid:  '/ground/rune/image.png',
  elev_high: '/ground/rune/image.png',
};
// low/mid/high 버킷별 색 tint (고도감 강조)
const ELEV_TINT = {
  elev_low:  '#7aaa88',   // 푸른빛 저지대
  elev_mid:  '#a09060',   // 중간 흙빛
  elev_high: '#888070',   // 회갈색 고지대
};
const ELEV_TEXTURE_PATHS = [...new Set(Object.values(ELEV_TEXTURE_MAP))];

// 노이즈 텍스처 (terrain 모드 오버레이용, 1회 생성 후 재사용)
let _noiseTexture = null;
const getNoiseTexture = () => {
  if (_noiseTexture) return _noiseTexture;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  // 4 옥타브 노이즈: 큰 패치 → 세밀한 그레인 순서로 쌓기
  const octaves = [
    { count: 300,   size: 32, alpha: 0.25 },
    { count: 1200,  size: 12, alpha: 0.20 },
    { count: 5000,  size: 4,  alpha: 0.15 },
    { count: 15000, size: 2,  alpha: 0.10 },
  ];
  for (const { count, size: dotSize, alpha } of octaves) {
    for (let i = 0; i < count; i++) {
      const v = Math.floor(Math.random() * 255);
      ctx.fillStyle = `rgba(${v},${v},${v},${alpha})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, dotSize, dotSize);
    }
  }
  _noiseTexture = new THREE.CanvasTexture(canvas);
  _noiseTexture.wrapS = _noiseTexture.wrapT = THREE.RepeatWrapping;
  _noiseTexture.minFilter = THREE.LinearMipmapLinearFilter;
  _noiseTexture.generateMipmaps = true;
  return _noiseTexture;
};

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
/**
 * includeWalls=false: 상단면만 생성 (벽면은 buildGroupCliffsDeduplicated가 별도 처리)
 * includeWalls=true : 기존처럼 상단면+벽면 포함 (단독 그룹 렌더링 시 사용)
 */
const buildExtrudedPolygon = (outerRing, holes = [], yTop, yBot = -1.0, includeWalls = true) => {
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

  // includeWalls=false: 상단면만 (인접 그룹 공유 엣지 Z-fighting 방지)
  const allRings  = includeWalls ? [pts, ...holePts] : [];
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

  // ── 측면벽 버텍스 (includeWalls=true 시에만) ────────────────────────────
  if (includeWalls) {
    const heightDiff = yTop - yBot;
    for (const ring of allRings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const p0 = ring[i], p1 = ring[i + 1];
        const edgeLen = Math.sqrt((p1.x - p0.x) ** 2 + (p1.z - p0.z) ** 2);
        if (edgeLen < 0.01) continue;
        const uS = edgeLen / TILE_SIZE, vS = heightDiff / TILE_SIZE;
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
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, vi), 3));
  geo.setAttribute('uv',       new THREE.BufferAttribute(uvs.subarray(0, ui),       2));
  geo.addGroup(0, topCount, 0);                    // 상단면 (material-0)
  geo.addGroup(topCount, vi / 3 - topCount, 1);    // 측면벽 (material-1, includeWalls=false면 count=0)
  return geo;
};

// ── 절벽 노이즈 유틸 ────────────────────────────────────────────────────────
// 세계 좌표 기반 결정론적 value noise (외부 라이브러리 불필요)
const _noiseHash = (ix, iy) => {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
};
const _valueNoise2D = (x, y) => {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const n00 = _noiseHash(ix,   iy),   n10 = _noiseHash(ix+1, iy);
  const n01 = _noiseHash(ix,   iy+1), n11 = _noiseHash(ix+1, iy+1);
  return n00*(1-ux)*(1-uy) + n10*ux*(1-uy) + n01*(1-ux)*uy + n11*ux*uy;
};
// fBm: 4 옥타브 (결과 ≈ -0.9 ~ +0.9)
const _fbm2D = (x, y) => {
  let v = 0, amp = 0.5, freq = 1.0;
  for (let i = 0; i < 4; i++) {
    v += (_valueNoise2D(x * freq, y * freq) * 2 - 1) * amp;
    freq *= 2.1; amp *= 0.5;
  }
  return v;
};

/**
 * 절벽 엣지를 수평·수직 세분화하고 fBm 노이즈로 불규칙하게 만든 삼각형 배열 반환.
 * - 상단(yHigh)·하단(yLow) 엣지는 변위 없음 → 인접 상단면/바닥과 갭 없음
 * - 중간 레이어의 내부 정점에 법선 방향 XZ 변위 + Y 변위 적용
 */
const buildNoisyCliffWall = (p0, p1, yLow, yHigh) => {
  const dx = p1.x - p0.x, dz = p1.z - p0.z;
  const edgeLen = Math.sqrt(dx * dx + dz * dz);
  if (edgeLen < 0.01) return { pos: [], uv: [] };

  const heightDiff = yHigh - yLow;
  // 수평 세분화: 5m 단위, 최대 30
  const hSegs = Math.min(30, Math.max(1, Math.round(edgeLen / 5)));
  // 수직 레벨: 고도차 3m마다 1단, 최소 2, 최대 5
  const vLevels = Math.min(5, Math.max(2, Math.round(heightDiff / 3)));

  // 엣지 단위벡터 및 오른쪽 법선
  const nx = dz / edgeLen, nz = -dx / edgeLen;
  // 노이즈 스케일: ~0.05/m → 절벽 불규칙 패턴 10~20m 주기
  const NS = 0.05;

  // 정점 그리드 [vLevels+1][hSegs+1]
  // 상단(j=0)·하단(j=vLevels) 고정 → 인접 면과 갭 없음
  // 중간 레이어만 noise 변위
  const grid = [];
  for (let j = 0; j <= vLevels; j++) {
    const vt = j / vLevels;
    const baseY = yHigh - heightDiff * vt;
    const isEdge = (j === 0 || j === vLevels);
    const env = isEdge ? 0 : (1 - Math.abs(vt * 2 - 1));

    const row = [];
    for (let i = 0; i <= hSegs; i++) {
      const wt = i / hSegs;
      const wx = p0.x + dx * wt, wz = p0.z + dz * wt;
      if (isEdge) {
        row.push({ x: wx, y: baseY, z: wz });
      } else {
        const n1 = _fbm2D(wx * NS,       wz * NS);
        const n2 = _fbm2D(wx * NS + 50,  wz * NS + 50);
        const n3 = _fbm2D(wx * NS * 1.8, wz * NS * 1.8 + 200);
        row.push({
          x: wx + nx * n1 * 2.5 * env + (dx / edgeLen) * n2 * 1.0 * env,
          y: baseY + n3 * 1.2 * env,
          z: wz + nz * n1 * 2.5 * env + (dz / edgeLen) * n2 * 1.0 * env,
        });
      }
    }
    grid.push(row);
  }

  const pos = [], uv = [];
  for (let j = 0; j < vLevels; j++) {
    for (let i = 0; i < hSegs; i++) {
      const v00 = grid[j][i],   v10 = grid[j][i+1];
      const v01 = grid[j+1][i], v11 = grid[j+1][i+1];
      const u0 = (i     / hSegs) * (edgeLen / TILE_SIZE);
      const u1 = ((i+1) / hSegs) * (edgeLen / TILE_SIZE);
      const vv0 = ((vLevels - j)     / vLevels) * (heightDiff / TILE_SIZE);
      const vv1 = ((vLevels - j - 1) / vLevels) * (heightDiff / TILE_SIZE);
      pos.push(v00.x, v00.y, v00.z,  v01.x, v01.y, v01.z,  v11.x, v11.y, v11.z);
      uv.push(u0, vv0,  u0, vv1,  u1, vv1);
      pos.push(v00.x, v00.y, v00.z,  v11.x, v11.y, v11.z,  v10.x, v10.y, v10.z);
      uv.push(u0, vv0,  u1, vv1,  u1, vv0);
    }
  }
  return { pos, uv };
};

// 엣지 매칭 정밀도: 0.5m 단위 (float 변환 오차 흡수)
const EDGE_RF = 2;

/**
 * 파티션 단위 절벽 — partition 개별 texture_image_url을 벽면에 그대로 사용
 * - 공유 엣지 → 높은 쪽 파티션의 텍스처 사용
 * - 외곽 엣지 → 해당 파티션의 텍스처 사용
 */
const buildPartitionCliffs = (partitions, effectiveScale, partitionTexUrlMap) => {
  if (effectiveScale === 0 || !partitions?.length) return [];

  const edgeMap = new Map();
  for (const partition of partitions) {
    const b = partition.boundary_geojson;
    if (!b?.coordinates?.[0]) continue;
    const elevY     = BASE_Y + (partition.elevation_m ?? 0) * effectiveScale;
    const partUrl   = partitionTexUrlMap?.get(partition.partition_key) ?? null;
    const themeCode = partition.group_theme_code || 'default';
    const outer     = b.coordinates[0];

    for (let i = 0; i < outer.length - 1; i++) {
      const p0 = gpsToGame(outer[i][1],     outer[i][0]);
      const p1 = gpsToGame(outer[i + 1][1], outer[i + 1][0]);
      const r0x = Math.round(p0.x * EDGE_RF), r0z = Math.round(p0.z * EDGE_RF);
      const r1x = Math.round(p1.x * EDGE_RF), r1z = Math.round(p1.z * EDGE_RF);
      if (r0x === r1x && r0z === r1z) continue;
      const key = (r0x < r1x || (r0x === r1x && r0z < r1z))
        ? `${r0x},${r0z}|${r1x},${r1z}` : `${r1x},${r1z}|${r0x},${r0z}`;
      if (!edgeMap.has(key)) edgeMap.set(key, { p0, p1, sides: [] });
      edgeMap.get(key).sides.push({ elevY, partUrl, themeCode });
    }
  }

  const texBuffers = new Map();
  const getTexBuf = (partUrl, themeCode) => {
    const k = partUrl ?? `theme:${themeCode}`;
    if (!texBuffers.has(k)) texBuffers.set(k, { pos: [], uv: [], partUrl, themeCode });
    return texBuffers.get(k);
  };

  const yBot = -1.0;
  for (const [, { p0, p1, sides }] of edgeMap) {
    let yLow, yHigh, partUrl, themeCode;
    if (sides.length >= 2) {
      const lo = sides.reduce((a, b) => a.elevY < b.elevY ? a : b);
      const hi = sides.reduce((a, b) => a.elevY > b.elevY ? a : b);
      yLow = lo.elevY; yHigh = hi.elevY;
      if (yHigh - yLow < 0.05) continue;
      partUrl = hi.partUrl; themeCode = hi.themeCode;
    } else {
      yHigh = sides[0].elevY; yLow = yBot;
      partUrl = sides[0].partUrl; themeCode = sides[0].themeCode;
    }

    const heightDiff = yHigh - yLow;
    const edgeLen    = Math.sqrt((p1.x - p0.x) ** 2 + (p1.z - p0.z) ** 2);
    if (edgeLen < 0.01) continue;

    const buf = getTexBuf(partUrl, themeCode);
    if (heightDiff > 1.5) {
      const { pos: nPos, uv: nUv } = buildNoisyCliffWall(p0, p1, yLow, yHigh);
      for (const v of nPos) buf.pos.push(v);
      for (const v of nUv)  buf.uv.push(v);
    } else {
      const uS = edgeLen / TILE_SIZE, vS = heightDiff / TILE_SIZE;
      buf.pos.push(p0.x, yLow, p0.z,  p0.x, yHigh, p0.z,  p1.x, yHigh, p1.z);
      buf.uv.push(0, 0,  0, vS,  uS, vS);
      buf.pos.push(p0.x, yLow, p0.z,  p1.x, yHigh, p1.z,  p1.x, yLow,  p1.z);
      buf.uv.push(0, 0,  uS, vS,  uS, 0);
    }
  }

  const result = [];
  for (const [, buf] of texBuffers) {
    if (!buf.pos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf.pos), 3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(buf.uv),  2));
    result.push({ geo, isWall: true, partitionUrl: buf.partUrl, themeCode: buf.themeCode, order: 4 });
  }
  return result;
};

/**
 * 인접 파티션 쌍 기반 절벽 생성 (구 buildPartitionSkirts 대체)
 * - 공유 엣지: 두 파티션 고도 차이만큼만 수직 면 생성
 * - 외곽 엣지: 파티션 상단 → -1.0 (동 경계, 다른 레이어 floor 의존 없음)
 */

// group_key 단위 geometry 빌드 (캐시 우선)
// partitionTexIndexMap: Map<partition_key, texIndex> — ComfyUI 생성 이미지가 있는 파티션의 텍스처 인덱스
// poolCount: 풀 텍스처 개수 (fallback hash 계산에 사용)
const getGroupGeometries = (groupKey, allPartitions, texCount, partitionTexIndexMap, poolCount, effectiveScale = ELEV_SCALE, groundMode = 'partition') => {
  const mapSize = partitionTexIndexMap ? partitionTexIndexMap.size : 0;
  // elevation 합산 + scale + groundMode를 캐시 키에 포함
  const elevSum = allPartitions
    .filter(p => p.group_key === groupKey)
    .reduce((s, p) => s + (p.elevation_m ?? 0), 0);
  const cacheKey = `${groupKey}:${texCount}:${mapSize}:${elevSum.toFixed(1)}:${effectiveScale}:${groundMode}`;
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

    const elevY = BASE_Y + (partition.elevation_m ?? 0) * effectiveScale;

    // ── terrain 모드: 고도 버킷 기반 텍스처, world-space UV (fitUV=false) ──
    if (groundMode === 'terrain') {
      const elev = partition.elevation_m ?? 0;
      const elevBucket = elev < ELEV_LOW_MAX ? 'elev_low'
        : elev < ELEV_HIGH_MIN ? 'elev_mid'
        : 'elev_high';
      const geo = buildTerrainBlockFromGeoJson(partition.boundary_geojson, false, null, null, elevY);
      if (!geo) continue;
      result.push({ geo, themeCode: elevBucket, elevBucket, order: 5, transparent: false });
      continue;
    }

    // ── partition 모드 (기존 로직) ─────────────────────────────────────────
    const hasOwnImage = partitionTexIndexMap && partitionTexIndexMap.has(partition.partition_key);
    // group 이미지(공유 URL) → group bbox UV, per-partition 이미지(고유 URL) → 개별 bbox UV
    const isSharedGroupImage = hasOwnImage && (urlCount.get(partition.texture_image_url) || 0) > 1;
    const uvBounds = isSharedGroupImage ? groupUvBounds : null;
    // per-partition 이미지: 종횡비 초과 구역은 타일 UV repeat 적용
    const uvRepeat = (hasOwnImage && !isSharedGroupImage)
      ? computePartitionRepeat(partition)
      : null;
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
  groundMode = 'partition',
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

  // terrain 모드: 고도 버킷 텍스처 (useTexture로 일괄 로드)
  const rawElevTextures = useTexture(ELEV_TEXTURE_PATHS);
  const elevTextures = Array.isArray(rawElevTextures) ? rawElevTextures : [rawElevTextures];
  const elevTexMap = useMemo(() => {
    const map = {};
    for (const [code, path] of Object.entries(ELEV_TEXTURE_MAP)) {
      const idx = ELEV_TEXTURE_PATHS.indexOf(path);
      map[code] = elevTextures[idx] ?? elevTextures[0];
    }
    return map;
  }, [elevTextures]);

  // terrain 모드 노이즈 오버레이 텍스처 (1회 생성)
  const noiseTex = useMemo(() => {
    const t = getNoiseTexture();
    t.repeat.set(15, 15);  // 100m 기준으로 촘촘히
    t.needsUpdate = true;
    return t;
  }, []);

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

  useEffect(() => { loadTex('/ground/rune/image.png', setCliffTex); }, []);

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
          // ── 등고선 ON: 상단면만 (벽면은 buildGroupCliffsDeduplicated가 일괄 처리)
          // includeWalls=false → 인접 그룹 공유 엣지 중복 Z-fighting 방지
          const { type, coordinates } = g.boundary_geojson;
          const polys = type === 'Polygon' ? [coordinates] : (type === 'MultiPolygon' ? coordinates : []);
          for (const [outer, ...holes] of polys) {
            if (!outer || outer.length < 3) continue;
            const geo = buildExtrudedPolygon(outer, holes, groupElevY, -1.0, false);
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

      // effectiveScale > 0: 파티션 단위 절벽 (개별 texture_image_url 사용)
      if (effectiveScale > 0) {
        const partitionsToWall = dbPartitions.filter(p => activeGroupKeys.has(p.group_key));
        result.push(...buildPartitionCliffs(partitionsToWall, effectiveScale, partitionTexUrlMap));
      }
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
        const geos = getGroupGeometries(groupKey, dbPartitions, texCount, partitionTexUrlMap, poolCount, effectiveScale, groundMode);
        result.push(...geos);
      }

      if (effectiveScale > 0) {
        const partitionsToWall = dbPartitions.filter(p => targetGroupKeys.has(p.group_key));
        result.push(...buildPartitionCliffs(partitionsToWall, effectiveScale, partitionTexUrlMap));
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
  }, [showOriginalBlocks, showSectorBlocks, zoneData, dbPartitions, dbGroups, texCount, activeGroupKeys, partitionTexUrlMap, poolCount, showElevation, groundMode]);

  // 동 경계 전체를 덮는 베이스 플레이트 — flat 모드에서 파티션 좌표 불일치 틈 메움
  // showElevation ON: extruded 메시가 자체 벽을 가지므로 불필요
  const dongBasePlate = useMemo(() => {
    if (showElevation || !currentDong?.coords?.length) return null;
    return buildTerrainBlock(currentDong.coords, currentDong.holes ?? [], false, null, null, BASE_Y - 0.05);
  }, [currentDong, showElevation]);

  return (
    <group>
      <DongMask currentDong={currentDong} currentDistrict={currentDistrict} elevation={elevation + 0.01} />
      <group position={[0, elevation, 0]}>
        {blocks.map((block, index) => {
          // ── [A] Extruded 3D 메시 (showElevation ON, push/pull 방식) ────────────
          // geometry.groups[0]=상단면(partition tex), groups[1]=측면벽(cliff tex)
          if (block.isExtruded) {
            const partTex = block.partitionUrl ? partitionTextureMap.get(block.partitionUrl) : null;
            const topTex  = partTex
              ?? (block.themeCode ? (themeTexMap[block.themeCode] ?? themeTexMap.default)
                : (Array.isArray(textures) ? textures[block.texIdx ?? 0] : textures));
            return (
              <mesh key={`block-${index}`} geometry={block.geo} renderOrder={block.order}>
                <meshBasicMaterial
                  attach="material-0"
                  map={topTex}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                  transparent
                  opacity={0.88}
                  depthWrite={false}
                />
                <CliffShaderMat attach="material-1" texture={cliffTex} />
              </mesh>
            );
          }

          // ── [B] 별도 cliff/slope 쿼드 ────────────────────────────────────────
          if (block.isWall) {
            const wallTex = (block.partitionUrl ? partitionTextureMap.get(block.partitionUrl) : null)
              ?? (block.themeCode ? (themeTexMap[block.themeCode] ?? themeTexMap.default) : cliffTex);
            return (
              <mesh key={`block-${index}`} geometry={block.geo} renderOrder={block.order}>
                <meshBasicMaterial
                  map={wallTex}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                  depthWrite={true}
                />
              </mesh>
            );
          }

          // ── [C] flat 파티션/존 블록 ───────────────────────────────────────────
          // terrain 모드: elevTexMap 우선 사용, color tint 적용
          // partition 모드: 기존 partTex → themeTexMap → pool 순서
          const isTerrainBlock = groundMode === 'terrain' && block.elevBucket;
          const partTex = block.partitionUrl ? partitionTextureMap.get(block.partitionUrl) : null;
          const tex = isTerrainBlock
            ? (elevTexMap[block.elevBucket] ?? elevTexMap.elev_mid)
            : (partTex
                ?? (block.themeCode ? (themeTexMap[block.themeCode] ?? themeTexMap.default)
                  : (Array.isArray(textures) ? textures[block.texIdx] : textures)));
          const tint = isTerrainBlock ? (ELEV_TINT[block.elevBucket] ?? '#ffffff') : '#ffffff';
          const isTransparent = !isTerrainBlock && block.transparent && !!partTex;
          const useStencil = !showElevation;
          return (
          <mesh key={`block-${index}`} geometry={block.geo} renderOrder={block.order}>
            <meshBasicMaterial
              map={tex}
              color={tint}
              transparent={isTransparent}
              alphaTest={isTransparent ? 0.1 : 0}
              opacity={1}
              stencilWrite={useStencil}
              stencilRef={useStencil ? 1 : 0}
              stencilFunc={useStencil ? THREE.EqualStencilFunc : THREE.AlwaysStencilFunc}
              side={THREE.DoubleSide}
              toneMapped={false}
              depthWrite={!isTransparent}
            />
          </mesh>
          );
        })}

        {/* terrain 모드 노이즈 오버레이: 동 전체를 덮는 반투명 노이즈 그레인 */}
        {groundMode === 'terrain' && dongBasePlate && (
          <mesh geometry={dongBasePlate} renderOrder={6}>
            <meshBasicMaterial
              map={noiseTex}
              transparent
              opacity={0.18}
              blending={THREE.MultiplyBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        )}
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
  groundMode = 'partition',
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
      groundMode={groundMode}
    />
  );
};

export default CityBlockOverlay;
