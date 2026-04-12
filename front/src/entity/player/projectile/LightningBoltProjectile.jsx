// 직선 고속 관통 번개 투사체 — 최대 2개 몬스터 관통 후 소멸
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const BOLT_SPEED = 30;
const HIT_DISTANCE = 2.5;
const MAX_LIFETIME = 3;
const MAX_PIERCE = 2;

export const LightningBoltProjectile = ({
  id,
  startPos,
  playerRot = 0,
  remove,
  sendHit,
  monsters = {},
  isRemote = false,
}) => {
  const groupRef = useRef();
  const pos = useRef(new THREE.Vector3(startPos.x, startPos.y ?? 1.5, startPos.z));
  const dir = useRef(new THREE.Vector3(Math.sin(playerRot), 0, Math.cos(playerRot)).normalize());
  const lifetime = useRef(0);
  const pierced = useRef(0);
  const hitSet = useRef(new Set());

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    lifetime.current += delta;
    if (lifetime.current > MAX_LIFETIME || pierced.current >= MAX_PIERCE) {
      remove?.(id);
      return;
    }

    pos.current.add(dir.current.clone().multiplyScalar(BOLT_SPEED * delta));
    groupRef.current.position.copy(pos.current);

    if (isRemote) return;

    for (const [monsterId, monster] of Object.entries(monsters)) {
      if (!monster?.position || monster.state === 'dead') continue;
      if (hitSet.current.has(monsterId)) continue;

      const dx = pos.current.x - monster.position.x;
      const dz = pos.current.z - monster.position.z;
      if (dx * dx + dz * dz < HIT_DISTANCE * HIT_DISTANCE) {
        hitSet.current.add(monsterId);
        pierced.current += 1;
        sendHit?.({ monsterId: parseInt(monsterId, 10), skillName: 'lightning_bolt' });
        if (pierced.current >= MAX_PIERCE) {
          remove?.(id);
          return;
        }
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={[startPos.x, startPos.y ?? 1.5, startPos.z]}
      rotation={[0, playerRot, 0]}
    >
      {/* 번개 본체 — Z축 방향 박스 (진행 방향과 일치) */}
      <mesh>
        <boxGeometry args={[0.07, 0.07, 1.8]} />
        <meshStandardMaterial
          color="#ffee00"
          emissive="#ffcc00"
          emissiveIntensity={7}
          transparent
          opacity={0.95}
        />
      </mesh>
      {/* 외곽 글로우 */}
      <mesh>
        <boxGeometry args={[0.22, 0.22, 1.6]} />
        <meshStandardMaterial
          color="#ffe066"
          emissive="#ff9900"
          emissiveIntensity={3}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
