import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Billboard, Text, useTexture, useGLTF, useAnimations } from '@react-three/drei';

const BASE_MODEL_URL = '/models/';

/** GLB 3D 몬스터 — SkeletonUtils.clone + 자동 정규화 + 애니메이션 */
const MonsterGLB = ({ modelPath, scale, state }) => {
  const { scene, animations } = useGLTF(BASE_MODEL_URL + modelPath);
  const cloned = useMemo(() => cloneSkeleton(scene), [scene]);
  const groupRef = useRef();
  const { actions } = useAnimations(animations, groupRef);

  const { modelScale, yOffset } = useMemo(() => {
    cloned.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(cloned);
    const nativeH = box.max.y - box.min.y;
    const isBoss = modelPath.toLowerCase().includes('boss');
    const targetH = isBoss ? scale * 8 : scale * 3.2;
    const ms = nativeH > 0.001 ? targetH / nativeH : scale;
    const yOff = -box.min.y * ms;
    return { modelScale: ms, yOffset: yOff };
  }, [cloned, modelPath, scale]);

  // 애니메이션 이름 매핑 (모델별 규칙)
  const idleAnim = useMemo(() => {
    const names = animations.map(a => a.name);
    return names.find(n => /stand|idle/i.test(n)) || names[0];
  }, [animations]);

  const hitAnim = useMemo(() => {
    const names = animations.map(a => a.name);
    return names.find(n => /hit|down|damage/i.test(n));
  }, [animations]);

  const dieAnim = useMemo(() => {
    const names = animations.map(a => a.name);
    return names.find(n => /die|dead/i.test(n));
  }, [animations]);

  useEffect(() => {
    if (!actions || !idleAnim) return;
    actions[idleAnim]?.reset().fadeIn(0.2).play();
  }, [actions, idleAnim]);

  useEffect(() => {
    if (!actions) return;
    if (state === 'hit' && hitAnim) {
      actions[hitAnim]?.reset().fadeIn(0.1).play();
      const t = setTimeout(() => {
        actions[idleAnim]?.reset().fadeIn(0.2).play();
        actions[hitAnim]?.fadeOut(0.2);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [state, actions, hitAnim, idleAnim]);

  return (
    <group ref={groupRef} position={[0, yOffset, 0]} scale={modelScale}>
      <primitive object={cloned} />
    </group>
  );
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
          <MonsterGLB modelPath={modelPath} scale={scale} state={state} />
          <HpBar hp={hp} maxHp={maxHp} name={modelPath.split('_').pop()?.replace('.glb', '') || `#${id}`} scale={scale} />
        </>
      ) : (
        <MonsterSprite id={id} hp={hp} maxHp={maxHp} textureUrl={textureUrl} scale={scale} />
      )}
    </group>
  );
};

export default Monster;
