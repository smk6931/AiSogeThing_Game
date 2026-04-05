// 타겟 몬스터를 향해 직선 비행하는 마법 구체 투사체
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const ORB_SPEED = 18;
const HIT_DISTANCE = 2.5;
const MAX_LIFETIME = 5;

export const MagicOrbProjectile = ({ id, startPos, targetPos, targetMonsterId, remove, sendHit }) => {
  const meshRef = useRef();
  const pos = useRef(new THREE.Vector3(startPos.x, startPos.y ?? 1.5, startPos.z));
  const target = useRef(new THREE.Vector3(targetPos.x, targetPos.y ?? 1.5, targetPos.z));
  const lifetime = useRef(0);
  const hit = useRef(false);

  useFrame((_, delta) => {
    if (!meshRef.current || hit.current) return;

    lifetime.current += delta;
    if (lifetime.current > MAX_LIFETIME) {
      remove?.(id);
      return;
    }

    const dir = new THREE.Vector3().subVectors(target.current, pos.current);
    const dist = dir.length();

    if (dist < HIT_DISTANCE) {
      hit.current = true;
      sendHit?.({ monsterId: parseInt(targetMonsterId, 10), damage: 15, skillName: 'magic_orb' });
      remove?.(id);
      return;
    }

    dir.normalize().multiplyScalar(ORB_SPEED * delta);
    pos.current.add(dir);
    meshRef.current.position.copy(pos.current);

    // 구체 회전 (시각 효과)
    meshRef.current.rotation.x += delta * 2;
    meshRef.current.rotation.y += delta * 3;
  });

  return (
    <mesh ref={meshRef} position={[startPos.x, startPos.y ?? 1.5, startPos.z]}>
      <sphereGeometry args={[0.35, 10, 10]} />
      <meshStandardMaterial
        color="#44aaff"
        emissive="#2255ff"
        emissiveIntensity={3}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
};
