/**
 * SeoulDistrictOverlay.jsx
 * 서울 25개 구 행정 경계를 Three.js 씬 위에 렌더링하는 컴포넌트.
 * - 각 구의 GPS 폴리곤 → 게임 XZ 좌표로 변환 → 지면 위 라인으로 표시
 * - [업데이트] 현재 플레이어가 위치한 구는 강렬한 빨간색(#ff3333)으로 표시
 * - [업데이트] 현재 구 외의 다른 지역은 렌더링하지 않음 (레이어 마스크 효과)
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
function DistrictLine({ coords, color, lineWidth = 2, elevation = 0.5 }) {
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
      <lineBasicMaterial color={color} linewidth={lineWidth} transparent opacity={0.9} />
    </line>
  );
}

/** 구 경계를 지정된 높이와 두께를 가진 장엄한 투명 결계로 렌더링 */
function DistrictWall({ coords, color, wallHeight = 150, wallThickness = 25, elevation = 0.5, opacity = 0.2 }) {
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

      const nx = -dz / len;
      const nz = dx / len;
      const hw = wallThickness / 2;

      const v0x = p1.x + nx * hw, v0z = p1.z + nz * hw;
      const v1x = p1.x - nx * hw, v1z = p1.z - nz * hw;
      const v2x = p2.x + nx * hw, v2z = p2.z + nz * hw;
      const v3x = p2.x - nx * hw, v3z = p2.z - nz * hw;

      const addVerticalQuad = (ax, az, bx, bz) => {
        const base = vertexIndex;
        positions.push(
          ax, elevation, az,
          bx, elevation, bz,
          ax, elevation + wallHeight, az,
          bx, elevation + wallHeight, bz
        );
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        vertexIndex += 4;
      };

      addVerticalQuad(v0x, v0z, v2x, v2z); // 외벽
      addVerticalQuad(v3x, v3z, v1x, v1z); // 내벽

      // 뚜껑
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
        opacity={opacity}
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

        // [레이어 마스크] 현재 속한 구가 아닐 경우 렌더링 스킵
        if (!isActive) return null;

        const color = '#ff3333'; // 캐릭터가 속한 구는 레드로 강조
        const labelColor = '#ff5555';

        return (
          <group key={district.id}>
            {/* 바닥 경계선 */}
            <DistrictLine
              coords={district.coords}
              color={color}
              lineWidth={2}
              elevation={elevation}
            />
            {/* 거대한 경계벽 (Mask Effect) */}
            <DistrictWall
              coords={district.coords}
              color={color}
              wallHeight={150}
              wallThickness={25}
              elevation={elevation}
              opacity={0.15}
            />
            {/* 구 이름 레이블 (중심점) */}
            {district.center && district.center.length === 2 && (() => {
              const { x, z } = gpsToXZ(district.center[0], district.center[1]);
              return (
                <Html
                  position={[x, elevation + 10, z]}
                  center
                  zIndexRange={[0, 100]}
                >
                  <div style={{
                    color: labelColor,
                    fontSize: '18px',
                    fontWeight: 'bold',
                    textShadow: '0 0 10px rgba(0,0,0,1)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    background: 'rgba(0,0,0,0.6)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    border: `1px solid ${color}`,
                    fontFamily: "'Noto Sans KR', sans-serif",
                    letterSpacing: '1px',
                  }}>
                    {district.name} (ACTIVE ZONE)
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
