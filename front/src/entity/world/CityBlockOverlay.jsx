import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';
import worldApi from '@api/world';

// GPS → 게임 좌표 변환
const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

/**
 * 지형 지오메트리 생성 및 UV 설정
 */
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
      // [NEW] 로컬 좌표 기반 UV 설정 (30.0m당 1회 반복되도록 스케일 고정)
      // 각 블록의 시작점(minX, minZ)을 기준으로 UV를 계산하여 텍스처가 밀리지 않게 함
      const TILE_SIZE = 30.0; 
      uvs[ui++] = (p.x - minX) / TILE_SIZE;
      uvs[ui++] = (p.z - minZ) / TILE_SIZE;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
};

/**
 * 동 경계선을 뚫어주는 스텐실 마스크
 */
const DongMask = ({ currentDong, elevation }) => {
  const geo = useMemo(() => {
    if (!currentDong?.coords || currentDong.coords.length < 3) return null;
    try {
      const shape = new THREE.Shape();
      const first = gpsToGame(currentDong.coords[0][0], currentDong.coords[0][1]);
      shape.moveTo(first.x, -first.z);
      for (let i = 1; i < currentDong.coords.length; i++) {
        const p = gpsToGame(currentDong.coords[i][0], currentDong.coords[i][1]);
        shape.lineTo(p.x, -p.z);
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

/**
 * 실제 렌더링을 담당하는 내부 컴포넌트
 */
const CityBlockContent = ({ texturePaths, zoneData, currentDong, elevation }) => {
  const textures = useTexture(texturePaths);

  // [NEW] 텍스처 속성 실시간 반영 (Wrapping 및 선명도 최적화)
  useEffect(() => {
    const texArray = Array.isArray(textures) ? textures : [textures];
    texArray.forEach(t => {
      if (t) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = 16; // 경사면에서 텍스처 생버벅임(Blur) 방지
        t.needsUpdate = true;
      }
    });
  }, [textures]);

  const { blocks } = useMemo(() => {
    if (!zoneData?.zones) return { blocks: [] };

    const result = [];
    const texCount = Array.isArray(textures) ? textures.length : 1;
    
    // 1. 용도구역 블록 (Original Blocks) - 기본 배경
    const blockCats = Object.keys(zoneData.zones).filter(cat => cat !== 'sectors' && cat !== 'road_major' && cat !== 'road_minor' && cat !== 'unexplored');
    
    blockCats.forEach((cat) => {
      const features = zoneData.zones[cat] || [];
      features.forEach((f, idx) => {
        if (f.type === 'polygon' && f.coords?.length >= 3) {
          const geo = buildTerrainBlock(f.coords);
          if (geo) {
            // 위치 기반 시드 생성 (고정 무작위성)
            const seed = Math.abs(f.coords[0][0] * 12345 + f.coords[0][1] * 67890);
            const texIdx = Math.floor(seed) % texCount;
            result.push({ geo, texIdx, order: 3 });
          }
        }
      });
    });

    // 2. 섹터 블록 (Divided by Roads) - 더 세밀한 무작위성
    const sectors = zoneData.zones['sectors'] || [];
    sectors.forEach((f, idx) => {
      if (f.type === 'polygon' && f.coords?.length >= 3) {
        const geo = buildTerrainBlock(f.coords);
        if (geo) {
          // 섹터는 더 높은 우선순위(Order 5)를 주어 겹칠 경우 위로 오게 함
          const seed = Math.abs(f.coords[0][0] * 99999 + f.coords[0][1] * 11111 + idx);
          const texIdx = (Math.floor(seed) + 7) % texCount;
          result.push({ geo, texIdx, order: 5 });
        }
      }
    });

    return { blocks: result };
  }, [zoneData, textures]);

  return (
    <group>
      <DongMask currentDong={currentDong} elevation={elevation + 0.01} />
      <group position={[0, elevation, 0]}>
        {blocks.map((b, i) => (
          <mesh key={`block-${i}`} geometry={b.geo} renderOrder={b.order}>
            <meshStandardMaterial
              map={(Array.isArray(textures) ? textures[b.texIdx] : textures)}
              transparent={false}
              opacity={1.0}
              stencilWrite={true}
              stencilRef={1}
              stencilFunc={THREE.EqualStencilFunc}
              side={THREE.DoubleSide}
              roughness={1.0}
              metalness={0.0}
              depthWrite={true}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
};

const CityBlockOverlay = ({ zoneData, currentDong, visible = true, elevation = 0.05 }) => {
  const [texturePaths, setTexturePaths] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPaths = async () => {
      try {
        const res = await worldApi.getBlockTextures();
        console.log("[CityBlockOverlay] 로딩된 텍스처 목록:", res.data);
        if (res.data && res.data.length > 0) {
          setTexturePaths(res.data);
        } else {
          setTexturePaths(['/images/image.png', '/images/rock.png', '/images/sand.png']);
        }
      } catch (e) {
        setTexturePaths(['/images/image.png']);
      } finally {
        setLoading(false);
      }
    };
    fetchPaths();
  }, []);

  if (!visible || loading || texturePaths.length === 0) return null;

  return (
    <CityBlockContent 
      texturePaths={texturePaths}
      zoneData={zoneData}
      currentDong={currentDong}
      elevation={elevation}
    />
  );
};

export default CityBlockOverlay;
