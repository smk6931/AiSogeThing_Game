/**
 * PartitionTextureOverlay.jsx
 *
 * world_level_partition 폴리곤 경계선 좌표를 기반으로
 * AI 생성 바닥 텍스처를 파티션 형태에 맞게 3D 평면에 렌더링한다.
 *
 * - boundary_geojson → ShapeGeometry + UV 매핑
 * - UV는 마스크 생성 스크립트(generate_partition_mask.py)와 동일한 좌표 계산
 * - 텍스처 로드 실패 시 조용히 스킵 (폴더에 없는 파티션 무시)
 * - elevation: DongGroundMesh(+0.02) ~ ZoneOverlay(+0.1) 사이에 배치
 */
import React, { useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// ── 상수 ──────────────────────────────────────────────────────────────────────
// 마스크 생성 시 pad = max(40, size//16) / size
// 1024px 기준: 64/1024 = 0.0625, 1536px 기준: 96/1536 = 0.0625
const PAD_FRAC = 0.0625;

// ── 좌표 변환 ─────────────────────────────────────────────────────────────────
const gpsToXZ = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

// ── partition_seq 추출 ─────────────────────────────────────────────────────────
const extractSeq = (partition) => {
  const seq = partition.partition_seq;
  if (seq != null) return parseInt(seq, 10);
  // fallback: partition_key 마지막 세그먼트에서 숫자 추출
  const key = partition.partition_key || '';
  const match = key.match(/p(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
};

// ── ShapeGeometry + UV 빌드 ───────────────────────────────────────────────────
// UV는 마스크 생성과 동일:
//   u = PAD_FRAC + (lng - lngMin) / lngRange * (1 - 2*PAD_FRAC)
//   v = PAD_FRAC + (lat - latMin) / latRange * (1 - 2*PAD_FRAC)
const buildGeoWithUV = (ring) => {
  if (!ring || ring.length < 3) return null;

  const lngs = ring.map((c) => c[0]);
  const lats  = ring.map((c) => c[1]);
  const lngMin = Math.min(...lngs), lngMax = Math.max(...lngs);
  const latMin  = Math.min(...lats),  latMax  = Math.max(...lats);
  const lngRange = lngMax - lngMin || 1e-10;
  const latRange  = latMax  - latMin  || 1e-10;

  try {
    const shape = new THREE.Shape();
    const p0 = gpsToXZ(ring[0][1], ring[0][0]);
    shape.moveTo(p0.x, -p0.z);
    for (let i = 1; i < ring.length; i++) {
      const p = gpsToXZ(ring[i][1], ring[i][0]);
      shape.lineTo(p.x, -p.z);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);

    // Shape 좌표계(XY)에서 lat/lng 역산 → UV 계산
    // positions[i*3+0] = game_x = (lng - GIS_ORIGIN.lng) * LNG_TO_M
    // positions[i*3+1] = shape_y = -game_z, game_z = (GIS_ORIGIN.lat - lat) * LAT_TO_M
    //   → lat = GIS_ORIGIN.lat + shape_y / LAT_TO_M
    const positions = geo.attributes.position.array;
    const uvs = new Float32Array((positions.length / 3) * 2);

    for (let i = 0; i < positions.length / 3; i++) {
      const gx = positions[i * 3];
      const gy = positions[i * 3 + 1];

      const lng = gx / LNG_TO_M + GIS_ORIGIN.lng;
      const lat = GIS_ORIGIN.lat + gy / LAT_TO_M;

      uvs[i * 2]     = PAD_FRAC + (lng - lngMin) / lngRange * (1 - 2 * PAD_FRAC);
      uvs[i * 2 + 1] = PAD_FRAC + (lat - latMin) / latRange * (1 - 2 * PAD_FRAC);
    }

    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    return geo;
  } catch {
    return null;
  }
};

// ── 텍스처 URL 빌더 ────────────────────────────────────────────────────────────
const buildTextureUrl = (seq, textureFolder, texturePrefix) => {
  const padded = String(seq).padStart(3, '0');
  return `/${textureFolder}/${texturePrefix}_p${padded}_floor_v1.png`;
};

// ── 단일 파티션 메시 ──────────────────────────────────────────────────────────
const PartitionTextureMesh = ({ partition, textureFolder, texturePrefix, elevation }) => {
  const [texture, setTexture] = useState(null);

  const seq = useMemo(() => extractSeq(partition), [partition]);

  const textureUrl = useMemo(() => {
    if (seq == null) return null;
    return buildTextureUrl(seq, textureFolder, texturePrefix);
  }, [seq, textureFolder, texturePrefix]);

  useEffect(() => {
    if (!textureUrl) return;
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      textureUrl,
      (tex) => {
        if (cancelled) { tex.dispose(); return; }
        // flipY=true (기본값) 유지 — PNG top = 북쪽 = UV v=1
        tex.needsUpdate = true;
        setTexture(tex);
      },
      undefined,
      () => {} // 파일 없으면 조용히 스킵
    );
    return () => {
      cancelled = true;
      setTexture((prev) => { prev?.dispose(); return null; });
    };
  }, [textureUrl]);

  const geo = useMemo(() => {
    const ring = partition.boundary_geojson?.coordinates?.[0];
    return buildGeoWithUV(ring);
  }, [partition.boundary_geojson]);

  useEffect(() => () => geo?.dispose(), [geo]);

  if (!geo || !texture) return null;

  return (
    <mesh
      geometry={geo}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, elevation, 0]}
      renderOrder={11}
    >
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={1.0}
        depthWrite={false}
        side={THREE.DoubleSide}
        alphaTest={0.01}
      />
    </mesh>
  );
};

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
const PartitionTextureOverlay = ({
  partitions = [],
  visible = false,
  textureFolder = 'ground/noryangjin2_g04', // public 기준 경로
  texturePrefix = 'g04',                     // 파일명 접두어
  elevation = 0.05,                          // DongGroundMesh 바로 위
}) => {
  if (!visible || partitions.length === 0) return null;

  return (
    <group name="partition-texture-overlay">
      {partitions.map((p) => (
        <PartitionTextureMesh
          key={p.id ?? p.partition_key}
          partition={p}
          textureFolder={textureFolder}
          texturePrefix={texturePrefix}
          elevation={elevation}
        />
      ))}
    </group>
  );
};

export default PartitionTextureOverlay;
