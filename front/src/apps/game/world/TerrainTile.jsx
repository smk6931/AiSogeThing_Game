import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import client from '@api/client';
import { getTerrainHeight } from './terrainHandler';

const COLORS = {
  water: new THREE.Color(0x3a7ab5),
  forest: new THREE.Color(0x2d6a28),
  grass: new THREE.Color(0x5a9e45),
  road_major: new THREE.Color(0x8b6914),
};

// ===========================
// 절차적 잔디 텍스처 (CORS 없음)
// ===========================
let _grassTexTile = null;
const getGrassTex = (repeat) => {
  if (!_grassTexTile) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#518c3d';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 800; i++) {
      ctx.fillStyle = `rgba(40,80,30,${Math.random() * 0.3})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
    _grassTexTile = new THREE.CanvasTexture(canvas);
    _grassTexTile.wrapS = _grassTexTile.wrapT = THREE.RepeatWrapping;
  }
  _grassTexTile.repeat.set(repeat, repeat);
  return _grassTexTile;
};

// ===========================
// 고유 재질을 가진 서브 컴포넌트
// ===========================

/** 강물 (Water) - 반짝이는 수면 효과 */
const WaterMesh = ({ geometry }) => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        color={COLORS.water}
        transparent
        opacity={0.8}
        roughness={0.1}
        metalness={0.2}
        emissive={COLORS.water}
        emissiveIntensity={0.2}
      />
    </mesh>
  );
};

/** 지형 (Heightmap) */
const HeightMapMesh = ({ geometry, centerX, centerZ, size }) => {
  const tex = useMemo(() => getGrassTex(size / 40), [size]);
  return (
    <mesh geometry={geometry} position={[centerX, -0.5, centerZ]} receiveShadow>
      <meshStandardMaterial map={tex} roughness={0.9} />
    </mesh>
  );
};

const TerrainTile = ({ lat, lng, centerX, centerZ, size = 1000 }) => {
  const [data, setData] = useState(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    client.get(`/api/game/terrain?lat=${lat}&lng=${lng}&dist=${size / 2}`)
      .then(res => {
        setData(res.data);
        fetched.current = true;
      })
      .catch(err => {
        console.error('[TerrainTile] 로드 실패:', err);
      });
  }, [lat, lng, size]);

  const geometries = useMemo(() => {
    if (!data) return null;

    const buildLineGeometry = (features) => {
      const geos = [];
      for (const f of features) {
        if (!f.coords || f.coords.length < 2) continue;
        const halfW = (f.width || 8) / 2;
        for (let i = 0; i < f.coords.length - 1; i++) {
          const ax = f.coords[i][0] + centerX, az = f.coords[i][1] + centerZ;
          const bx = f.coords[i + 1][0] + centerX, bz = f.coords[i + 1][1] + centerZ;
          const dx = bx - ax, dz = bz - az, len = Math.sqrt(dx * dx + dz * dz);
          if (len < 0.1) continue;
          const nx = -dz / len * halfW, nz = dx / len * halfW;
          const ay = getTerrainHeight(ax, az), by = getTerrainHeight(bx, bz);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
            ax + nx, ay + 0.2, az + nz, bx + nx, by + 0.2, bz + nz, bx - nx, by + 0.2, bz - nz,
            ax + nx, ay + 0.2, az + nz, bx - nx, by + 0.2, bz - nz, ax - nx, ay + 0.2, az - nz
          ]), 3));
          geos.push(geo);
        }
      }
      return geos.length > 0 ? mergeGeometries(geos) : null;
    };

    const buildPolygonGeometry = (features) => {
      const geos = [];
      for (const f of features) {
        if (!f.coords || f.coords.length < 3) continue;
        const shape = new THREE.Shape();

        // 지형 높이 샘플링 (첫 번째 좌표 기준)
        const sampleX = f.coords[0][0] + centerX;
        const sampleZ = f.coords[0][1] + centerZ;
        const groundY = getTerrainHeight(sampleX, sampleZ);

        shape.moveTo(f.coords[0][0] + centerX, f.coords[0][1] + centerZ);
        for (let i = 1; i < f.coords.length; i++) {
          shape.lineTo(f.coords[i][0] + centerX, f.coords[i][1] + centerZ);
        }
        shape.closePath();

        const geo = new THREE.ShapeGeometry(shape);
        // 지형에 딱 붙게 고도 조절 (Z축이 R3F의 Y이므로 로컬 rotation 전에 조절)
        // 하지만 이미 PlaneGeometry -Math.PI/2 이므로 mesh 단계에서 조절하는 게 편함.
        geos.push(geo);
      }
      return geos.length > 0 ? mergeGeometries(geos) : null;
    };

    return {
      water: buildPolygonGeometry(data.layers.water.filter(f => f.type === 'polygon')),
      forest: buildPolygonGeometry(data.layers.forest.filter(f => f.type === 'polygon')),
      grass: buildPolygonGeometry(data.layers.grass.filter(f => f.type === 'polygon')),
      roads: buildLineGeometry(data.layers.roads)
    };
  }, [data, centerX, centerZ]);

  if (!data) return null;

  // 타일 중심점 고도 샘플링
  const tileHeight = getTerrainHeight(centerX, centerZ);

  return (
    <group name={`tile_${centerX}_${centerZ}`}>
      {/* OSM 특징들 (전역 지형 고도보다 아주 살짝만 위에 렌더링) */}
      {geometries && (
        <>
          {geometries.grass && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, tileHeight + 0.05, 0]} receiveShadow>
              <primitive object={geometries.grass} attach="geometry" />
              <meshStandardMaterial color={COLORS.grass} roughness={0.9} />
            </mesh>
          )}
          {geometries.water && (
            <group position={[0, tileHeight, 0]}>
              <WaterMesh geometry={geometries.water} />
            </group>
          )}
          {geometries.roads && (
            <mesh position={[0, 0.1, 0]}>
              <primitive object={geometries.roads} attach="geometry" />
              <meshStandardMaterial color={COLORS.road_major} roughness={0.8} />
            </mesh>
          )}
        </>
      )}
    </group>
  );
};

export default TerrainTile;

