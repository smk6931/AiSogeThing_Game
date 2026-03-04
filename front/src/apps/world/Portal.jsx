
import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

const Portal = ({ position, targetMapId, targetName, onClick }) => {
  const portalRef = useRef();
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
  }, [hovered]);

  useFrame(({ clock }) => {
    if (portalRef.current) {
      portalRef.current.rotation.z += 0.02;
      // Floating effect
      const yOffset = Math.sin(clock.getElapsedTime() * 2) * 0.2;
      portalRef.current.position.y = 1.5 + yOffset;
    }
  });

  return (
    <group
      position={[position[0], position[1], position[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onClick && onClick();
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Portal Ring */}
      <mesh ref={portalRef} rotation={[0, 0, 0]}>
        <torusGeometry args={[1.5, 0.1, 8, 32]} />
        <meshStandardMaterial color="#00ffff" emissive="#00ffff" emissiveIntensity={2} toneMapped={false} />
      </mesh>

      {/* Inner Glow */}
      <mesh position={[0, 1.5, 0]}>
        <circleGeometry args={[1.3, 32]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.2} side={2} />
      </mesh>

      {/* Label */}
      <Text
        position={[0, 3.5, 0]}
        fontSize={0.6}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000000"
      >
        {targetName || targetMapId}
      </Text>

      {/* Floor Marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[1.5, 1.7, 32]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

export default Portal;
