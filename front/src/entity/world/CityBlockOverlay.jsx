/**
 * CityBlockOverlay.jsx
 * 
 * [동(Dong) 단위 스트리밍 원칙 적용]
 * 1. 블록(CityBlocks): 동 경계선 안쪽의 용도 구역만 텍스처로 렌더링
 * 2. 스텐실 마스크: 현재 동 경계면을 기준으로 레이어를 도려내어 정확히 동 안쪽만 표시
 */
import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

export const BLOCK_IMAGES = [
  '/images/2b8a23a7dec37e59d324efa9d0f0ef99.jpg',
  '/images/2cd8ebd98fadce0b168e865df1ce7a7c.jpg',
  '/images/327b36da6402f56e679184d5cf7d7c26.jpg',
  '/images/447c1be047db0362550eac42c361e35c.jpg',
  '/images/59c7288fe0c809ecefb03e0610fca467.jpg',
  '/images/5ee644c3dd0996505e2e8c2904448a8d.jpg',
  '/images/64e5d8778128da07aa4ae0b2cbb79292.jpg',
  '/images/735e3a457fd48501e95f1f23832ba1ad.jpg',
  '/images/7b277889e448e30f490a55074e694ff5.jpg',
  '/images/c26ed8d33fdd167d4688a38dc3f262d5.jpg',
  '/images/dbe11e2e0165a947ff3943289e46a46a.jpg',
  '/images/e2d883e3f30b7ac9e222195601498684.jpg',
  '/images/ec1cbe7ba65ab0e674808182127c8b6b.jpg',
  '/images/f9b808c6e9318d035e1d64cd546d23d3.jpg',
  '/images/image.png',
  '/images/rock.png',
  '/images/sand.png',
];

const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

const buildTerrainBlock = (coords) => {
  if (!coords || coords.length < 3) return null;
  const pts = coords.map(([lat, lng]) => gpsToGame(lat, lng));
  const contour = pts.map(p => new THREE.Vector2(p.x, p.z));
  let faces;
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch (_) { return null; }
  if (!faces || faces.length === 0) return null;

  const vertCount = faces.length * 3;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);
  let vi = 0, ui = 0;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  pts.forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  });
  const rX = maxX - minX || 1; const rZ = maxZ - minZ || 1;

  for (const [a, b, c] of faces) {
    for (const idx of [a, b, c]) {
      const p = pts[idx];
      positions[vi++] = p.x;
      positions[vi++] = 0.55;
      positions[vi++] = p.z;
      uvs[ui++] = (p.x - minX) / rX;
      uvs[ui++] = (p.z - minZ) / rZ;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
};

// [NEW] 동 경계선을 뚫어주는 스텐실 마스크 컴포넌트
const DongMask = ({ currentDong, elevation }) => {
  const geo = useMemo(() => {
    if (!currentDong?.coords || currentDong.coords.length < 3) return null;
    try {
      const shape = new THREE.Shape();
      const first = gpsToGame(currentDong.coords[0][0], currentDong.coords[0][1]);
      shape.moveTo(first.x, first.z);
      for (let i = 1; i < currentDong.coords.length; i++) {
        const p = gpsToGame(currentDong.coords[i][0], currentDong.coords[i][1]);
        shape.lineTo(p.x, p.z);
      }
      return new THREE.ShapeGeometry(shape);
    } catch (e) { return null; }
  }, [currentDong]);

  if (!geo) return null;

  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, elevation, 0]} renderOrder={3}>
      <meshBasicMaterial
        colorWrite={false}
        depthWrite={false}
        stencilWrite={true}
        stencilRef={1}
        stencilFunc={THREE.AlwaysStencilFunc}
        stencilPass={THREE.ReplaceStencilOp}
      />
    </mesh>
  );
};

const CityBlockOverlay = ({ zoneData, currentDong, visible = true, elevation = 0.05 }) => {
  const textures = useTexture(BLOCK_IMAGES);

  const { originalBlocks, sectorBlocks } = useMemo(() => {
    if (!zoneData?.zones) return { originalBlocks: [], sectorBlocks: [] };

    const ob = [];
    const sb = [];
    const blockCats = [
      'residential', 'commercial', 'industrial', 'park', 'forest',
      'educational', 'medical', 'parking', 'natural_site',
      'military', 'religious', 'sports', 'cemetery', 'transport', 'port', 'water'
    ];

    blockCats.forEach(cat => {
      const features = zoneData.zones[cat] || [];
      features.forEach((f, idx) => {
        if (f.type === 'polygon' && f.coords?.length >= 3) {
          const geo = buildTerrainBlock(f.coords);
          if (geo) {
            const hash = (cat.charCodeAt(0) * 13 + cat.length * 17 + idx * 7) % BLOCK_IMAGES.length;
            ob.push({ geo, texIdx: hash });
          }
        }
      });
    });

    // 섹터 (사용자 요청 시 다시 활성화할 수 있도록 로직만 유지)
    const sectorFeatures = zoneData.zones['sectors'] || [];
    sectorFeatures.forEach((f, idx) => {
      if (f.type === 'polygon' && f.coords?.length >= 3) {
        const geo = buildTerrainBlock(f.coords);
        if (geo) sb.push({ geo, texIdx: (idx * 31 + 42) % BLOCK_IMAGES.length });
      }
    });

    return { originalBlocks: ob, sectorBlocks: sb };
  }, [zoneData]);

  if (!visible) return null;

  return (
    <group>
      {/* 동 마스크: 이 경계 안쪽만 렌더링됨 */}
      <DongMask currentDong={currentDong} elevation={elevation + 0.01} />

      <group position={[0, elevation, 0]}>
        {originalBlocks.map((b, i) => (
          <mesh key={`ob-${i}`} geometry={b.geo} renderOrder={4}>
            <meshStandardMaterial
              map={textures[b.texIdx]}
              transparent
              opacity={0.7}
              stencilWrite={true}
              stencilRef={1}
              stencilFunc={THREE.EqualStencilFunc}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
};

export default CityBlockOverlay;
