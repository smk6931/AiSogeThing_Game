// 몬스터 피격 시 머리 위에 뜨는 데미지 숫자 컴포넌트
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';

const DURATION = 1.3;
const FLOAT_SPEED = 3.5;

export const DamageNumber = ({ id, damage, position, onRemove }) => {
  const groupRef = useRef();
  const textRef = useRef();
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;

    if (groupRef.current) {
      groupRef.current.position.y += FLOAT_SPEED * delta;
    }
    if (textRef.current) {
      textRef.current.fillOpacity = Math.max(0, 1 - elapsed.current / DURATION);
    }
    if (elapsed.current >= DURATION) {
      onRemove?.(id);
    }
  });

  // 데미지 크기에 따라 색상/폰트 구분
  const isBig = damage >= 25;
  const color = isBig ? '#ff8800' : '#ffffff';
  const fontSize = isBig ? 1.5 : 1.0;

  return (
    <group ref={groupRef} position={[position.x, (position.y || 0) + 4, position.z]}>
      <Billboard>
        <Text
          ref={textRef}
          fontSize={fontSize}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.07}
          outlineColor="#000000"
        >
          {damage}
        </Text>
      </Billboard>
    </group>
  );
};
