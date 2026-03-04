/**
 * SeoulDistrictOverlay.jsx
 * 서울 25개 구 행정 경계를 Three.js 씬 위에 렌더링하는 컴포넌트.
 * - 각 구의 GPS 폴리곤 → 게임 XZ 좌표로 변환 → 지면 위 라인으로 표시
 * - 현재 플레이어가 위치한 구는 밝은 황금색으로 강조
 * - 구 이름 레이블은 Html 2D 오버레이로 표시
 */
import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GIS_ORIGIN, LAT_TO_M, LNG_TO_M } from './mapConfig';

/** GPS → 게임 XZ 좌표 */
function gpsToXZ(lat, lng) {
  return {
    x: (lng - GIS_ORIGIN.lng) * LNG_TO_M,
    z: (GIS_ORIGIN.lat - lat) * LAT_TO_M,
  };
}

/** 구 경계를 Three.js Line으로 렌더링 */
function DistrictLine({ coords, color, lineWidth = 1, elevation = 0.5 }) {
  const geometry = useMemo(() => {
    const pts = coords.map(([lat, lng]) => {
      const { x, z } = gpsToXZ(lat, lng);
      return new THREE.Vector3(x, elevation, z);
    });
    // 닫힌 폴리곤
    if (pts.length > 1) pts.push(pts[0].clone());
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    return geom;
  }, [coords, elevation]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} linewidth={lineWidth} transparent opacity={0.85} />
    </line>
  );
}

/** 구 경계를 지정된 높이와 두께를 가진 장엄한 투명 결계로 렌더링 */
function DistrictWall({ coords, color, wallHeight = 100, wallThickness = 20, elevation = 0.5 }) {
  const geometry = useMemo(() => {
    const pts = coords.map(([lat, lng]) => {
      const { x, z } = gpsToXZ(lat, lng);
      return new THREE.Vector3(x, elevation, z);
    });
    // 닫힌 폴리곤
    if (pts.length > 1) pts.push(pts[0].clone());

    const positions = [];
    const indices = [];
    let vertexIndex = 0;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];

      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len === 0) continue;

      // 선분 법선 벡터 (좌우 폭 계산용)
      const nx = -dz / len;
      const nz = dx / len;
      const hw = wallThickness / 2;

      // 4 모서리 (좌측/우측)
      const v0x = p1.x + nx * hw, v0z = p1.z + nz * hw;
      const v1x = p1.x - nx * hw, v1z = p1.z - nz * hw;
      const v2x = p2.x + nx * hw, v2z = p2.z + nz * hw;
      const v3x = p2.x - nx * hw, v3z = p2.z - nz * hw;

      // 수직 벽(Quad) 헬퍼 함수
      const addVerticalQuad = (ax, az, bx, bz) => {
        const base = vertexIndex;
        positions.push(
          ax, elevation, az,               // 바닥 A 
          bx, elevation, bz,               // 바닥 B
          ax, elevation + wallHeight, az,  // 상단 A
          bx, elevation + wallHeight, bz   // 상단 B
        );
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        vertexIndex += 4;
      };

      // 1. 좌측 외벽
      addVerticalQuad(v0x, v0z, v2x, v2z);
      // 2. 우측 내벽
      addVerticalQuad(v3x, v3z, v1x, v1z);

      // 3. 상단 뚜껑 (Top Lid)
      const base = vertexIndex;
      positions.push(
        v0x, elevation + wallHeight, v0z,
        v1x, elevation + wallHeight, v1z,
        v2x, elevation + wallHeight, v2z,
        v3x, elevation + wallHeight, v3z
      );
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      vertexIndex += 4;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [coords, elevation, wallHeight, wallThickness]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.12} // 폭이 생겨 면적/중첩이 많으므로 불투명도를 살짝 낮춤
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

const SeoulDistrictOverlay = ({
  districts = [],
  currentDistrictId = null,
  visible = true,
  elevation = 0.5,
}) => {
  if (!visible || districts.length === 0) return null;

  return (
    <group name="seoul-district-overlay">
      {districts.map((district) => {
        const isActive = district.id === currentDistrictId;
        const color = isActive ? '#ffd700' : '#4488ff';
        const labelColor = isActive ? '#ffd700' : '#88aaff';

        return (
          <group key={district.id}>
            {/* 구 경계선 (바닥) */}
            <DistrictLine
              coords={district.coords}
              color={color}
              elevation={elevation}
            />
            {/* 구 경계벽 (투명 결계, 높이 100m 두께 20m) */}
            <DistrictWall
              coords={district.coords}
              color={color}
              wallHeight={100}
              wallThickness={20}
              elevation={elevation}
            />
            {/* 구 이름 레이블 (중심점) */}
            {district.center && district.center.length === 2 && (() => {
              const { x, z } = gpsToXZ(district.center[0], district.center[1]);
              return (
                <Html
                  position={[x, elevation + 0.2, z]}
                  center
                  zIndexRange={[0, 10]}
                >
                  <div style={{
                    color: labelColor,
                    fontSize: isActive ? '14px' : '11px',
                    fontWeight: isActive ? 'bold' : 'normal',
                    textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    fontFamily: "'Noto Sans KR', sans-serif",
                    letterSpacing: '0.5px',
                  }}>
                    {district.name}
                  </div>
                </Html>
              );
            })()}
          </group>
        );
      })}
    </group>
  );
};

export default SeoulDistrictOverlay;
