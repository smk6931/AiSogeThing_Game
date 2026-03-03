import React, { useRef } from 'react';
import { Billboard, Text, useTexture } from '@react-three/drei';

const Monster = ({ id, position, hp, maxHp, state, textureUrl, scale = 1 }) => {
  if (hp <= 0 || state === 'dead') return null;

  // position: {x, y, z}
  // 유저 스케일에 맞춰 Y 높이를 조정 (0.55배일 때 발이 땅에 닿도록)
  const pos = [position.x, 1.2 * scale, position.z];
  const texture = useTexture(textureUrl || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png');

  const hpPercent = maxHp > 0 ? (hp / maxHp) : 0;
  const hpColor = hpPercent > 0.5 ? 'green' : (hpPercent > 0.2 ? 'orange' : 'red');

  return (
    <group position={pos}>
      {/* 1. 몬스터 본체 (스프라이트) */}
      <Billboard>
        {/* 거대 드래곤(80m)에서 현실적인 생명체 사이즈(약 2~3m)로 축소 */}
        <sprite scale={[5 * scale, 5 * scale, 1]}>
          <spriteMaterial map={texture} transparent={true} alphaTest={0.5} />
        </sprite>
      </Billboard>

      {/* 2. 상태 표시 (HP바 + ID) */}
      <Billboard position={[0, 4 * scale, 0]}>
        {/* HP Bar 배경 */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[4.0, 0.4]} />
          <meshBasicMaterial color="black" />
        </mesh>
        {/* HP Bar 게이지 */}
        <mesh position={[-(4.0 * (1 - hpPercent)) / 2, 0, 0.01]}>
          <planeGeometry args={[4.0 * hpPercent, 0.32]} />
          <meshBasicMaterial color={hpColor} />
        </mesh>

        {/* 몬스터 이름/ID */}
        <Text
          position={[0, 0.8, 0]}
          fontSize={0.8}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          {`Monster #${id}`}
        </Text>
      </Billboard>
    </group>
  );
};

export default Monster;
