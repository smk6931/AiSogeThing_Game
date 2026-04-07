import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MONSTER_CULL_RADIUS = 100;

const CullRadiusIndicator = ({ playerRef }) => {
  const meshRef = useRef();

  useFrame(() => {
    if (!meshRef.current || !playerRef.current) return;
    meshRef.current.position.x = playerRef.current.position.x;
    meshRef.current.position.z = playerRef.current.position.z;
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
      <ringGeometry args={[MONSTER_CULL_RADIUS - 8, MONSTER_CULL_RADIUS, 128]} />
      <meshBasicMaterial color="#ff4444" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
};

export default CullRadiusIndicator;
