// 프로스트 노바 AoE 이펙트 — 즉시 발동, 빙결 링 3중 확산 애니메이션
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const DURATION = 0.8;   // 전체 지속 시간 (초)
const MAX_RADIUS = 8;   // 최대 반경 (m)

export const FrostNovaEffect = ({ id, position, remove, sendHit }) => {
  const ring1Ref = useRef();   // 가장 밝고 빠른 외곽 링
  const ring2Ref = useRef();   // 중간 링
  const ring3Ref = useRef();   // 느린 내부 링
  const fillRef  = useRef();   // 내부 채움 원
  const progress = useRef(0);
  const hasSentHit = useRef(false);

  useFrame((_, delta) => {
    progress.current += delta / DURATION;
    const t = Math.min(progress.current, 1);

    if (!hasSentHit.current) {
      hasSentHit.current = true;
      sendHit?.({ skillName: 'frost_nova', aoe: true });
    }

    // Ring 1 — 빠른 외곽 (전체 MAX_RADIUS까지 확장)
    const t1 = Math.min(t / 0.5, 1);
    if (ring1Ref.current) {
      const s = t1 * MAX_RADIUS;
      ring1Ref.current.scale.set(s, 1, s);
      ring1Ref.current.material.opacity = (1 - t1) * 0.95;
    }

    // Ring 2 — 중간 속도 (MAX_RADIUS * 0.85)
    const t2 = Math.min(t / 0.7, 1);
    if (ring2Ref.current) {
      const s = t2 * MAX_RADIUS * 0.85;
      ring2Ref.current.scale.set(s, 1, s);
      ring2Ref.current.material.opacity = (1 - t2) * 0.75;
    }

    // Ring 3 — 느린 내부 링 (MAX_RADIUS * 0.65)
    if (ring3Ref.current) {
      const s = t * MAX_RADIUS * 0.65;
      ring3Ref.current.scale.set(s, 1, s);
      ring3Ref.current.material.opacity = (1 - t) * 0.55;
    }

    // 내부 채움 — 고정 크기, 서서히 소멸
    if (fillRef.current) {
      fillRef.current.material.opacity = (1 - t) * 0.35;
    }

    if (t >= 1) remove?.(id);
  });

  return (
    <group position={[position.x, 0.08, position.z]}>
      {/* Ring 1 — 밝은 외곽, 가장 빠르게 확산 */}
      <mesh ref={ring1Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.88, 1.0, 56]} />
        <meshStandardMaterial
          color="#e0f8ff"
          emissive="#88ddff"
          emissiveIntensity={6}
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Ring 2 — 중간 파란 링 */}
      <mesh ref={ring2Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.75, 0.92, 48]} />
        <meshStandardMaterial
          color="#aaddff"
          emissive="#44aaff"
          emissiveIntensity={4}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Ring 3 — 느린 짙은 내부 링 */}
      <mesh ref={ring3Ref} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.60, 0.80, 40]} />
        <meshStandardMaterial
          color="#66aaff"
          emissive="#2255cc"
          emissiveIntensity={3}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 내부 채움 — 고정 반경, 투명하게 소멸 */}
      <mesh
        ref={fillRef}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[MAX_RADIUS * 0.55, MAX_RADIUS * 0.55, 1]}
      >
        <circleGeometry args={[1, 40]} />
        <meshStandardMaterial
          color="#88ccff"
          emissive="#44aaff"
          emissiveIntensity={2}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
