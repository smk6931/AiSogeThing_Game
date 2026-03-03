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

/** 구 경계를 10m 높이의 투명한 벽(결계)으로 렌더링 */
function DistrictWall({ coords, color, wallHeight = 10, elevation = 0.5 }) {
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

      // v0: p1 bottom, v1: p2 bottom
      positions.push(p1.x, elevation, p1.z);
      positions.push(p2.x, elevation, p2.z);
      // v2: p1 top, v3: p2 top
      positions.push(p1.x, elevation + wallHeight, p1.z);
      positions.push(p2.x, elevation + wallHeight, p2.z);

      const v0 = vertexIndex;
      const v1 = vertexIndex + 1;
      const v2 = vertexIndex + 2;
      const v3 = vertexIndex + 3;

      // 두 개의 삼각형으로 쿼드(사각형 벽) 구성
      indices.push(v0, v1, v2);
      indices.push(v1, v3, v2);

      vertexIndex += 4;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [coords, elevation, wallHeight]);

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.15}
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
            {/* 구 경계벽 (투명 결계, 10m) */}
            <DistrictWall
              coords={district.coords}
              color={color}
              wallHeight={10}
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
