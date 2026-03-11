/**
 * DongGroundMesh.jsx
 *
 * 현재 플레이어가 위치한 동(Dong)의 경계 전체를 기본 바닥 텍스처로 채우는 컴포넌트.
 * 용도구역(Zone), 블록 텍스처 등의 레이어가 덮이기 전에 가장 먼저 깔리는 "캔버스" 역할.
 * OSM 데이터가 누락된 빈 공간도 이 텍스처로 자연스럽게 메워집니다.
 *
 * 렌더링 순서: MapTiles(2D 지도) 바로 위, Zone/Block 오버레이 아래
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

// GPS → 게임 좌표 변환
const gpsToGame = (lat, lng) => ({
  x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
  z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
});

// ==============================================
// 프로시저럴 잔디 텍스처 생성 (CORS 무관, 즉시 사용 가능)
// ==============================================
let _groundTexture = null;

const getGroundTexture = (repeat = 200) => {
  if (!_groundTexture) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 기본 토양/잔디 색상
    ctx.fillStyle = '#5a7a3a';
    ctx.fillRect(0, 0, size, size);

    // 잔디 풀잎 디테일
    for (let i = 0; i < 1200; i++) {
      const shade = Math.random() * 0.15;
      ctx.fillStyle = `rgba(${70 + Math.random() * 30}, ${100 + Math.random() * 40}, ${40 + Math.random() * 20}, ${0.3 + shade})`;
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 3);
    }

    // 약간의 흙 디테일
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(120, 90, 50, ${Math.random() * 0.1})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
    }

    _groundTexture = new THREE.CanvasTexture(canvas);
    _groundTexture.wrapS = _groundTexture.wrapT = THREE.RepeatWrapping;
    _groundTexture.minFilter = THREE.LinearMipmapLinearFilter;
    _groundTexture.magFilter = THREE.LinearFilter;
    _groundTexture.generateMipmaps = true;
  }

  _groundTexture.repeat.set(repeat, repeat);
  return _groundTexture;
};

const DongGroundMesh = ({
  currentDong = null,
  currentDistrict = null,
  elevation = -0.1,
  visible = true,
}) => {
  // 동이 있으면 동, 없으면 구 경계를 사용
  const targetArea = currentDong || currentDistrict;

  const geometry = useMemo(() => {
    if (!targetArea || !targetArea.coords || targetArea.coords.length < 3) return null;

    try {
      const shape = new THREE.Shape();
      const first = gpsToGame(targetArea.coords[0][0], targetArea.coords[0][1]);
      shape.moveTo(first.x, -first.z); // Three.js Shape은 XY 평면

      for (let i = 1; i < targetArea.coords.length; i++) {
        const p = gpsToGame(targetArea.coords[i][0], targetArea.coords[i][1]);
        shape.lineTo(p.x, -p.z);
      }
      shape.closePath();

      const geo = new THREE.ShapeGeometry(shape);

      // UV 생성 (AABB 정규화 → 텍스처 반복 매핑 용)
      const positions = geo.attributes.position.array;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < positions.length; i += 3) {
        if (positions[i] < minX) minX = positions[i];
        if (positions[i] > maxX) maxX = positions[i];
        if (positions[i + 1] < minY) minY = positions[i + 1];
        if (positions[i + 1] > maxY) maxY = positions[i + 1];
      }
      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;

      const uvs = new Float32Array((positions.length / 3) * 2);
      for (let i = 0; i < positions.length / 3; i++) {
        uvs[i * 2] = (positions[i * 3] - minX) / rangeX;
        uvs[i * 2 + 1] = (positions[i * 3 + 1] - minY) / rangeY;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

      return geo;
    } catch (e) {
      console.error('[DongGroundMesh] 지오메트리 생성 실패:', e);
      return null;
    }
  }, [targetArea]);

  const texture = useMemo(() => getGroundTexture(200), []);

  if (!visible || !geometry) return null;

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, elevation, 0]}
      renderOrder={-1}
      receiveShadow
    >
      <meshStandardMaterial
        map={texture}
        color="#8ca86a"
        roughness={0.95}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export default DongGroundMesh;
