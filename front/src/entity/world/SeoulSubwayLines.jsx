import React, { useMemo } from 'react';
import * as THREE from 'three';
import { MAPS } from './mapConfig';

/**
 * 서울의 주요 지하철 노선(2호선 순환, 9호선 등)을 
 * 오픈월드의 주요 이동 동선 가이드라인(빛나는 선)으로 시각화합니다.
 */
const SeoulSubwayLines = ({ visible = true }) => {
  const subwayPaths = useMemo(() => {
    // 각 노선별 중심 좌표 연결 (MapConfig의 중심점 기반)
    const line2 = [
      MAPS['map_7'].position, // 영등포
      MAPS['map_2'].position, // 마포
      MAPS['map_4'].position, // 용산
      MAPS['map_5'].position, // 성동
      MAPS['map_6'].position, // 광진
      MAPS['map_10'].position, // 강남
      MAPS['map_9'].position,  // 서초
      MAPS['map_14'].position, // 송파
      MAPS['map_7'].position, // 순환 (다시 영등포)
    ].map(p => new THREE.Vector3(p[0], 0.5, p[2]));

    const line9 = [
      MAPS['map_7'].position, // 영등포
      MAPS['map_8'].position, // 노량진(동작)
      MAPS['map_9'].position, // 서초
      MAPS['map_10'].position, // 강남
      MAPS['map_14'].position, // 송파
    ].map(p => new THREE.Vector3(p[0], 0.8, p[2]));

    return { line2, line9 };
  }, []);

  if (!visible) return null;

  return (
    <group name="seoul-subway-guide">
      {/* 2호선 (초록색) */}
      <LinePath points={subwayPaths.line2} color="#2db400" width={12} label="LINE 2 (CIRCLE)" />

      {/* 9호선 (황금색) */}
      <LinePath points={subwayPaths.line9} color="#bdb092" width={8} label="LINE 9" />
    </group>
  );
};

const LinePath = ({ points, color, width, label }) => {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const curvePoints = curve.getPoints(100);

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 100, width / 2, 8, false]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.5}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* 바닥에 맺히는 발광 효과 (바닥 가이드) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <planeGeometry args={[0, 0]} /> {/* Placeholder, we could use lines instead */}
      </mesh>
    </group>
  );
};

export default SeoulSubwayLines;
