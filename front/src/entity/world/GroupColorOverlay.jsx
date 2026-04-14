/**
 * GroupColorOverlay.jsx
 *
 * 3가지 디버그/분석용 파티션 시각화 레이어:
 *  showGroupColors  — 그룹별 컬러 fill + 이름/개수 라벨
 *  showGroupArea    — 그룹별 fill + 면적(m²) 라벨
 *  showPartitionFill— 개별 파티션 landuse 색 fill + 경계선
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Html } from '@react-three/drei';

import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// ── 좌표 변환 ─────────────────────────────────────────────────────────────────
const gpsToXZ = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

// ── 그룹 팔레트 ───────────────────────────────────────────────────────────────
const GROUP_PALETTE = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c',
  '#3498db', '#9b59b6', '#e91e63', '#00bcd4', '#8bc34a',
  '#ff5722', '#607d8b', '#795548', '#cddc39', '#ff9800',
  '#4caf50', '#2196f3', '#9c27b0', '#f44336', '#009688',
];
const groupColor = (index) => GROUP_PALETTE[index % GROUP_PALETTE.length];

// ── dominant_landuse 색상 ─────────────────────────────────────────────────────
const LANDUSE_COLOR = {
  water:       '#4fc3f7',
  park:        '#81c784',
  forest:      '#388e3c',
  residential: '#ffb74d',
  commercial:  '#42a5f5',
  educational: '#ce93d8',
  medical:     '#ef9a9a',
  industrial:  '#bcaaa4',
  military:    '#a5d6a7',
  cemetery:    '#90a4ae',
};
const LANDUSE_COLOR_DEFAULT = '#bdbdbd';
const landuseColor = (lu) => LANDUSE_COLOR[lu] || LANDUSE_COLOR_DEFAULT;

// ── GeoJSON ring → ShapeGeometry (XZ 수평면용 회전 전) ───────────────────────
const ringToShapeGeometry = (ring) => {
  if (!ring || ring.length < 3) return null;
  try {
    const shape = new THREE.Shape();
    const [lng0, lat0] = ring[0];
    const p0 = gpsToXZ(lat0, lng0);
    shape.moveTo(p0.x, -p0.z);
    for (let i = 1; i < ring.length; i++) {
      const [lng, lat] = ring[i];
      const p = gpsToXZ(lat, lng);
      shape.lineTo(p.x, -p.z);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  } catch {
    return null;
  }
};

// ── GeoJSON ring → Line geometry (XZ 평면 경계선) ────────────────────────────
const ringToLineGeometry = (ring) => {
  if (!ring || ring.length < 2) return null;
  try {
    // 닫힌 루프: 마지막 점 = 첫 점
    const pts = ring.map(([lng, lat]) => {
      const p = gpsToXZ(lat, lng);
      return new THREE.Vector3(p.x, 0, p.z);
    });
    if (pts[0].distanceTo(pts[pts.length - 1]) > 0.01) {
      pts.push(pts[0].clone());
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  } catch {
    return null;
  }
};

// ── 파티션 geometry 빌드 ─────────────────────────────────────────────────────
const buildPartitionGeometry = (boundaryGeoJson) => {
  if (!boundaryGeoJson?.coordinates?.length) return null;
  return ringToShapeGeometry(boundaryGeoJson.coordinates[0]);
};

const buildPartitionLineGeometry = (boundaryGeoJson) => {
  if (!boundaryGeoJson?.coordinates?.length) return null;
  return ringToLineGeometry(boundaryGeoJson.coordinates[0]);
};

// ── 그룹 merged geometry ─────────────────────────────────────────────────────
const buildGroupGeometry = (partitions) => {
  const geos = partitions.map((p) => buildPartitionGeometry(p.boundary_geojson)).filter(Boolean);
  if (geos.length === 0) return null;
  if (geos.length === 1) return geos[0];
  return mergeGeometries(geos, false);
};

// ── 그룹 centroid ─────────────────────────────────────────────────────────────
const groupCentroid = (partitions) => {
  let sx = 0, sz = 0, count = 0;
  partitions.forEach((p) => {
    const ring = p.boundary_geojson?.coordinates?.[0];
    if (!ring) return;
    ring.forEach(([lng, lat]) => {
      const pos = gpsToXZ(lat, lng);
      sx += pos.x; sz += pos.z; count++;
    });
  });
  if (count === 0) return { x: 0, z: 0 };
  return { x: sx / count, z: sz / count };
};

// ── ring 중심점 ───────────────────────────────────────────────────────────────
const ringCentroid = (ring) => {
  if (!ring || ring.length < 2) return { x: 0, z: 0 };
  let sx = 0, sz = 0;
  ring.forEach(([lng, lat]) => { const p = gpsToXZ(lat, lng); sx += p.x; sz += p.z; });
  return { x: sx / ring.length, z: sz / ring.length };
};

// ── 면적 계산 (Shoelace, m²) ─────────────────────────────────────────────────
const calcAreaM2 = (boundaryGeoJson) => {
  const ring = boundaryGeoJson?.coordinates?.[0];
  if (!ring || ring.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    area += (lng1 * LNG_TO_M) * (lat2 * LAT_TO_M) - (lng2 * LNG_TO_M) * (lat1 * LAT_TO_M);
  }
  return Math.abs(area) / 2;
};

const groupTotalArea = (partitions) =>
  partitions.reduce((sum, p) => sum + calcAreaM2(p.boundary_geojson), 0);

const formatArea = (m2) => {
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)}km²`;
  if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(1)}ha`;
  return `${Math.round(m2).toLocaleString()}m²`;
};

// ── 라벨 스타일 ───────────────────────────────────────────────────────────────
const labelBox = (borderColor) => ({
  background: 'rgba(4,8,14,0.82)',
  border: `1px solid ${borderColor}`,
  borderRadius: 4,
  padding: '2px 6px',
  color: '#ddeeff',
  fontSize: 10,
  fontFamily: "'Noto Sans KR', monospace, sans-serif",
  whiteSpace: 'nowrap',
  lineHeight: 1.45,
  textAlign: 'center',
  userSelect: 'none',
  pointerEvents: 'none',
  boxShadow: `0 0 6px ${borderColor}55`,
});


// ══════════════════════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ══════════════════════════════════════════════════════════════════════════════
const GroupColorOverlay = ({
  partitions = [],
  showGroupColors = false,
  showGroupArea = false,
  showPartitionFill = false,
  elevation = 0.36,
}) => {
  const anyVisible = showGroupColors || showGroupArea || showPartitionFill;

  // ── 그룹별 데이터 ────────────────────────────────────────────────────────
  const groupData = useMemo(() => {
    const map = new Map();
    partitions.forEach((p) => {
      const key = p.group_key || '__ungrouped__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return Array.from(map.entries()).map(([key, members], idx) => ({
      key,
      members,
      color: groupColor(idx),
      geometry: buildGroupGeometry(members),
      centroid: groupCentroid(members),
      totalArea: groupTotalArea(members),
      label: members[0]?.group_display_name || key,
    }));
  }, [partitions]);

  // ── 파티션별 데이터 ──────────────────────────────────────────────────────
  const partitionData = useMemo(() =>
    partitions.map((p) => ({
      id: p.id,
      key: p.partition_key,
      color: landuseColor(p.dominant_landuse),
      fillGeo: buildPartitionGeometry(p.boundary_geojson),
      lineGeo: buildPartitionLineGeometry(p.boundary_geojson),
      centroid: ringCentroid(p.boundary_geojson?.coordinates?.[0]),
    })).filter((d) => d.fillGeo),
  [partitions]);

  if (!anyVisible || partitions.length === 0) return null;

  return (
    <group name="group-color-overlay" position={[0, elevation, 0]}>

      {/* ── 그룹색: Fill ───────────────────────────────────────────────── */}
      {showGroupColors && groupData.map((g) => g.geometry && (
        <mesh key={`gc-${g.key}`} geometry={g.geometry} rotation={[-Math.PI / 2, 0, 0]} renderOrder={20}>
          <meshBasicMaterial color={g.color} transparent opacity={0.28} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* ── 그룹색: 라벨 (그룹명 + 파티션 수) — distanceFactor 없이 고정 크기 */}
      {showGroupColors && groupData.map((g) => (
        <Html key={`gc-lbl-${g.key}`} position={[g.centroid.x, 2, g.centroid.z]} center zIndexRange={[20, 30]}>
          <div style={labelBox(g.color)}>
            <div style={{ color: g.color, fontWeight: 700, fontSize: 10 }}>{g.label}</div>
            <div style={{ opacity: 0.8 }}>{g.members.length}개 파티션</div>
          </div>
        </Html>
      ))}

      {/* ── 그룹영역: Fill + 면적 라벨 ────────────────────────────────── */}
      {showGroupArea && groupData.map((g) => g.geometry && (
        <React.Fragment key={`ga-${g.key}`}>
          <mesh geometry={g.geometry} rotation={[-Math.PI / 2, 0, 0]} renderOrder={21}>
            <meshBasicMaterial color={g.color} transparent opacity={0.20} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
          </mesh>
          <Html position={[g.centroid.x, 2, g.centroid.z]} center zIndexRange={[21, 31]}>
            <div style={labelBox(g.color)}>
              <div style={{ color: g.color, fontWeight: 700, fontSize: 10 }}>{g.label}</div>
              <div style={{ color: '#b0d0ff' }}>{formatArea(g.totalArea)}</div>
              <div style={{ opacity: 0.65, fontSize: 9 }}>{g.members.length}개</div>
            </div>
          </Html>
        </React.Fragment>
      ))}

      {/* ── 파티션 Fill + 경계선 ───────────────────────────────────────── */}
      {showPartitionFill && partitionData.map((p) => (
        <React.Fragment key={`pf-${p.id}`}>
          {/* 색상 fill */}
          <mesh geometry={p.fillGeo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={22}>
            <meshBasicMaterial color={p.color} transparent opacity={0.36} depthWrite={false} depthTest={false} side={THREE.DoubleSide} />
          </mesh>
          {/* 경계선 */}
          {p.lineGeo && (
            <line geometry={p.lineGeo} renderOrder={23}>
              <lineBasicMaterial color={p.color} transparent opacity={0.85} depthWrite={false} depthTest={false} />
            </line>
          )}
        </React.Fragment>
      ))}

    </group>
  );
};

export default GroupColorOverlay;
