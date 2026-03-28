import React, { useRef } from 'react';
import { Billboard, Text, useTexture, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

const BASE_MODEL_URL = '/models/';

/** GLB 3D 모델 몬스터 */
const MonsterGLB = ({ modelPath, scale }) => {
  const { scene } = useGLTF(BASE_MODEL_URL + modelPath);
  const cloned = React.useMemo(() => scene.clone(), [scene]);
  // scale * 0.5 → playerScale(0.625) 기준 약 0.31 → 네이티브 크기에 따라 조절 필요
  const s = scale * 0.5;
  return <primitive object={cloned} scale={[s, s, s]} />;
};

/** 스프라이트(이미지) 몬스터 — 기존 방식 */
const MonsterSprite = ({ id, hp, maxHp, textureUrl, scale }) => {
  const texture = useTexture(textureUrl || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png');
  const hpPercent = maxHp > 0 ? hp / maxHp : 0;
  const hpColor = hpPercent > 0.5 ? 'green' : hpPercent > 0.2 ? 'orange' : 'red';

  return (
    <>
      <Billboard>
        <sprite scale={[5 * scale, 5 * scale, 1]}>
          <spriteMaterial map={texture} transparent alphaTest={0.5} />
        </sprite>
      </Billboard>
      <Billboard position={[0, 4 * scale, 0]}>
        <mesh>
          <planeGeometry args={[4.0, 0.4]} />
          <meshBasicMaterial color="black" />
        </mesh>
        <mesh position={[-(4.0 * (1 - hpPercent)) / 2, 0, 0.01]}>
          <planeGeometry args={[4.0 * hpPercent, 0.32]} />
          <meshBasicMaterial color={hpColor} />
        </mesh>
        <Text position={[0, 0.8, 0]} fontSize={0.8} color="white" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="black">
          {`Monster #${id}`}
        </Text>
      </Billboard>
    </>
  );
};

/** HP바 — GLB 몬스터용 */
const HpBar = ({ hp, maxHp, name, scale }) => {
  const hpPercent = maxHp > 0 ? hp / maxHp : 0;
  const hpColor = hpPercent > 0.5 ? 'green' : hpPercent > 0.2 ? 'orange' : 'red';
  return (
    <Billboard position={[0, 6 * scale, 0]}>
      <mesh>
        <planeGeometry args={[4.0, 0.4]} />
        <meshBasicMaterial color="black" />
      </mesh>
      <mesh position={[-(4.0 * (1 - hpPercent)) / 2, 0, 0.01]}>
        <planeGeometry args={[4.0 * hpPercent, 0.32]} />
        <meshBasicMaterial color={hpColor} />
      </mesh>
      <Text position={[0, 0.8, 0]} fontSize={0.8} color="white" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="black">
        {name}
      </Text>
    </Billboard>
  );
};

/** 몬스터 컴포넌트 — modelPath 있으면 GLB, 없으면 스프라이트 */
const Monster = ({ id, position, hp, maxHp, state, textureUrl, modelPath, scale = 1 }) => {
  if (hp <= 0 || state === 'dead') return null;

  const pos = [position.x, 0, position.z];

  return (
    <group position={pos}>
      {modelPath ? (
        <>
          <MonsterGLB modelPath={modelPath} scale={scale} />
          <HpBar hp={hp} maxHp={maxHp} name={modelPath.split('_').pop()?.replace('.glb', '') || `#${id}`} scale={scale} />
        </>
      ) : (
        <MonsterSprite id={id} hp={hp} maxHp={maxHp} textureUrl={textureUrl} scale={scale} />
      )}
    </group>
  );
};

export default Monster;
