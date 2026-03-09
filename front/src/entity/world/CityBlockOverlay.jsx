/**
 * CityBlockOverlay.jsx
 *
 * 도로로 나뉜 구역(파티션)에 이미지 텍스처를 입히는 시스템
 * - THREE.ShapeUtils.triangulateShape 로 안정적인 삼각분할
 * - 각 버텍스마다 heightmap 샘플링 → 등고선 면에 데칼처럼 정확히 밀착
 * - 블록 클릭 → 이미지 팔레트 팝업 → 텍스처 개별 교체
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture, Html } from '@react-three/drei';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// ==============================================
// 사용할 이미지 목록 (public/images 폴더)
// ==============================================
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
];

// ==============================================
// GPS → 게임 좌표 변환
// ==============================================
const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

// ==============================================
// Heightmap 샘플러 (ZoneOverlay과 동일한 로직)
// ==============================================
let _hmData = null;

const loadHm = async () => {
  if (_hmData) return _hmData;
  try {
    const res = await fetch('/seoul_heightmap.json');
    _hmData = await res.json();
    console.log('[CityBlock] heightmap 로드 완료');
  } catch (_) {
    console.warn('[CityBlock] heightmap 로드 실패 → flat 렌더링');
    _hmData = null;
  }
  return _hmData;
};

const sampleHm = (x, z, hm, scale = 1.0) => {
  if (!hm) return 0;
  const { grid_size, world_width, world_height, elevations, elev_min, offset_x, offset_z } = hm;
  const localX = x - (offset_x + world_width / 2);
  const localZ = z - (offset_z + world_height / 2);
  const u = (localX + world_width / 2) / world_width;
  const v = (localZ + world_height / 2) / world_height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
  const gx = u * (grid_size - 1);
  const gz = v * (grid_size - 1);
  const ix = Math.floor(gx), iy = Math.floor(gz);
  const fx = gx - ix, fy = gz - iy;
  const ix2 = Math.min(ix + 1, grid_size - 1);
  const iy2 = Math.min(iy + 1, grid_size - 1);
  const e00 = Math.max(0, (elevations[iy * grid_size + ix] ?? elev_min) - elev_min);
  const e10 = Math.max(0, (elevations[iy * grid_size + ix2] ?? elev_min) - elev_min);
  const e01 = Math.max(0, (elevations[iy2 * grid_size + ix] ?? elev_min) - elev_min);
  const e11 = Math.max(0, (elevations[iy2 * grid_size + ix2] ?? elev_min) - elev_min);
  return (e00 * (1 - fx) * (1 - fy) + e10 * fx * (1 - fy) + e01 * (1 - fx) * fy + e11 * fx * fy) * scale;
};

// ==============================================
// 폴리곤 → 지형 밀착 BufferGeometry 빌드
//
// 핵심: ShapeUtils.triangulateShape → 삼각형 인덱스 추출
//       각 버텍스 Y = heightmap 샘플값 + 오프셋 (데칼 효과)
//       UV = 폴리곤 AABB 정규화 → 텍스처가 블록 전체에 꽉 참
// ==============================================
const buildTerrainBlock = (coords, hm, heightScale) => {
  if (!coords || coords.length < 3) return null;

  // GPS → 게임 좌표
  const pts = coords.map(([lat, lng]) => gpsToGame(lat, lng));

  // AABB 계산 (UV 정규화용)
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  pts.forEach(p => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  });
  const rangeX = maxX - minX || 1;
  const rangeZ = maxZ - minZ || 1;

  // THREE.ShapeUtils.triangulateShape 용 Vector2 배열
  // Shape 좌표계: x = game X, y = game Z (부호 유지, 이후 UV에서 처리)
  const contour = pts.map(p => new THREE.Vector2(p.x, p.z));

  let faces;
  try {
    faces = THREE.ShapeUtils.triangulateShape(contour, []);
  } catch (_) {
    return null; // 자기교차 폴리곤 등 삼각분할 실패 시 스킵
  }
  if (!faces || faces.length === 0) return null;

  // BufferGeometry 직접 구성
  const vertCount = faces.length * 3;
  const positions = new Float32Array(vertCount * 3);
  const uvs = new Float32Array(vertCount * 2);

  const DECAL_OFFSET = 0.5; // 지형 면보다 이 만큼 위에 올림 (Z-fighting 방지)

  let vi = 0, ui = 0;
  for (const [a, b, c] of faces) {
    for (const idx of [a, b, c]) {
      const gx = contour[idx].x; // game X
      const gz = contour[idx].y; // game Z
      const gy = sampleHm(gx, gz, hm, heightScale) + DECAL_OFFSET;

      positions[vi++] = gx;
      positions[vi++] = gy;
      positions[vi++] = gz;

      // UV: AABB 정규화 → 텍스처가 블록 전체를 꽉 채움
      uvs[ui++] = (gx - minX) / rangeX;
      uvs[ui++] = (gz - minZ) / rangeZ;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();

  return { geo, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2 };
};

// ==============================================
// 단일 블록 메쉬 (회전 없이 XZ 평면에 직접 배치)
// ==============================================
const BlockMesh = React.memo(({ geoData, texture, isSelected, onClick }) => {
  if (!geoData?.geo) return null;
  return (
    <mesh
      geometry={geoData.geo}
      onClick={onClick}
      renderOrder={3}
    >
      <meshBasicMaterial
        map={texture}
        transparent={true}
        opacity={isSelected ? 0.95 : 0.72}
        side={THREE.DoubleSide}
        depthWrite={false}
        polygonOffset={true}
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        color={isSelected ? '#ffffff' : '#dddddd'}
      />
    </mesh>
  );
});

// ==============================================
// 이미지 팔레트 UI
// ==============================================
const TexturePaletteUI = ({ images, selectedBlock, onSelectImage, onClose }) => (
  <div style={{
    position: 'fixed',
    right: '220px',
    top: '80px',
    width: '196px',
    background: 'rgba(8, 8, 18, 0.95)',
    border: '1px solid rgba(212, 175, 55, 0.55)',
    borderRadius: '14px',
    padding: '14px',
    zIndex: 9000,
    backdropFilter: 'blur(14px)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.7)',
    fontFamily: "'Cinzel', sans-serif",
    color: 'white',
    pointerEvents: 'auto',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
      <span style={{ fontSize: '11px', color: '#d4af37', fontWeight: 'bold', letterSpacing: '0.5px' }}>
        블록 텍스처 선택 #{selectedBlock}
      </span>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '15px',
      }}>✕</button>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px' }}>
      {images.map((img, idx) => (
        <div key={idx} onClick={() => onSelectImage(img)} style={{
          width: '54px', height: '54px', borderRadius: '6px', overflow: 'hidden',
          cursor: 'pointer', border: '2px solid transparent', transition: 'border 0.12s',
        }}
          onMouseOver={e => e.currentTarget.style.border = '2px solid #d4af37'}
          onMouseOut={e => e.currentTarget.style.border = '2px solid transparent'}
        >
          <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      ))}
    </div>
  </div>
);

// Ray-casting Point-in-Polygon
const pointInPolygon = (lat, lng, coords) => {
  let inside = false;
  const n = coords.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const yi = coords[i][0], xi = coords[i][1];
    const yj = coords[j][0], xj = coords[j][1];
    if (((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

// ==============================================
// 메인 컴포넌트
// ==============================================
const CityBlockOverlay = ({
  zoneData, visible = true, heightScale = 1.0,
  currentDistrict = null, dongId = null, currentDong = null
}) => {
  const [hm, setHm] = useState(null);
  const textures = useTexture(BLOCK_IMAGES);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [blockTextureMap, setBlockTextureMap] = useState({});

  // heightmap 로드 (전역 캐시 활용)
  useEffect(() => {
    loadHm().then(data => setHm(data));
  }, []);

  // 가용한 모든 지역 폴리곤(주거, 상업, 공원, 숲 등)을 하나로 모아 밀착 블록 생성
  const blocks = useMemo(() => {
    if (!zoneData?.zones || !hm) return [];

    const districtCoords = currentDistrict?.coords;
    const dongCoords = currentDong?.coords;
    const maskCoords = dongCoords || districtCoords; // 동 경계가 있으면 동으로, 없으면 구로 마스킹

    // 여러 카테고리의 폴리곤들을 하나의 배열로 통합
    let allPolygons = [];
    ['residential', 'commercial', 'industrial', 'institutional', 'educational', 'medical', 'parking',
      'natural_site', 'military', 'religious', 'sports', 'cemetery', 'transport', 'port',
      'park', 'forest'].forEach(cat => {
        if (zoneData.zones[cat]) {
          const filtered = maskCoords
            ? zoneData.zones[cat].filter(f => {
              if (f.type !== 'polygon' || !f.coords?.length) return false;
              // [성능 최적화] 첫 번째 좌표만 검사하여 마스크 역내 데이터인지 판별
              const [lat, lng] = f.coords[0];
              return pointInPolygon(lat, lng, maskCoords);
            })
            : zoneData.zones[cat].filter(f => f.type === 'polygon' && f.coords?.length >= 3);

          allPolygons = allPolygons.concat(filtered);
        }
      });

    console.log(`[CityBlock] ${allPolygons.length}개 블록 통합 빌드 (구 마스킹 적용)`);

    return allPolygons.map((f, idx) => {
      const geoData = buildTerrainBlock(f.coords, hm, heightScale);
      const defaultTexIdx = idx % BLOCK_IMAGES.length;
      return { idx, geoData, defaultTexIdx };
    }).filter(b => b.geoData !== null);
  }, [zoneData, hm, heightScale, currentDistrict, currentDong]);

  const handleBlockClick = useCallback((e, blockIdx) => {
    e.stopPropagation();
    setSelectedBlock(prev => (prev === blockIdx ? null : blockIdx)); // 같은 블록 재클릭 시 닫기
  }, []);

  const handleSelectImage = useCallback((imgPath) => {
    if (selectedBlock === null) return;
    const texIdx = BLOCK_IMAGES.indexOf(imgPath);
    setBlockTextureMap(prev => ({ ...prev, [selectedBlock]: texIdx >= 0 ? texIdx : 0 }));
  }, [selectedBlock]);

  const handleClosePalette = useCallback(() => setSelectedBlock(null), []);

  if (!visible || blocks.length === 0) return null;

  return (
    <>
      {blocks.map(({ idx, geoData, defaultTexIdx }) => {
        const texIdx = blockTextureMap[idx] ?? defaultTexIdx;
        const texture = Array.isArray(textures) ? textures[texIdx] : textures;
        return (
          <BlockMesh
            key={idx}
            geoData={geoData}
            texture={texture}
            isSelected={selectedBlock === idx}
            onClick={(e) => handleBlockClick(e, idx)}
          />
        );
      })}

      {selectedBlock !== null && (
        <Html position={[0, 0, 0]} zIndexRange={[9000, 9001]} prepend fullscreen>
          <TexturePaletteUI
            images={BLOCK_IMAGES}
            selectedBlock={selectedBlock}
            onSelectImage={handleSelectImage}
            onClose={handleClosePalette}
          />
        </Html>
      )}
    </>
  );
};

export default CityBlockOverlay;
