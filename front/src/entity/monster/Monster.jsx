import React, { useRef, useMemo, useEffect } from 'react';
import { Billboard, Text, useTexture, useGLTF, useAnimations } from '@react-three/drei';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE_MODEL_URL = '/models/';

/**
 * 모델 파일별 스케일·Y오프셋 설정
 * - scale: Three.js primitive에 직접 적용할 배율
 * - yOffset: 발바닥을 y=0에 맞추기 위한 수직 오프셋(게임 단위)
 */
const MODEL_CONFIG = {
  'monsters/Gangnam_Boss_Fire_001_Dragon.glb': { scale: 0.008, yOffset: 0 },
  'monsters/Seoul_Normal_Water_001_Slime.glb': { scale: 0.6, yOffset: 0.014 },
};
const DEFAULT_CONFIG = { scale: 0.6, yOffset: 0 };

/** GLB 3D 몬스터 — SkeletonUtils.clone + 설정값 스케일 */
const MonsterGLB = ({ modelPath, scale: playerScale, state }) => {
  const { scene, animations } = useGLTF(BASE_MODEL_URL + modelPath);
  const cloned = useMemo(() => cloneSkeleton(scene), [scene]);
  const groupRef = useRef();
  const { actions } = useAnimations(animations, groupRef);

  const cfg = MODEL_CONFIG[modelPath] || DEFAULT_CONFIG;
  // playerScale(0.625)을 기준 배율로 곱해 캐릭터 크기와 상대적 비율 유지
  const finalScale = cfg.scale * (playerScale / 0.625);

  // 애니메이션 이름 자동 탐지
  const idleAnim = useMemo(() => {
    const names = animations.map(a => a.name);
    return names.find(n => /stand|idle/i.test(n)) || names[0];
  }, [animations]);

  const hitAnim = useMemo(() => {
    const names = animations.map(a => a.name);
    return names.find(n => /hit|down|damage/i.test(n));
  }, [animations]);

  useEffect(() => {
    if (!actions || !idleAnim) return;
    actions[idleAnim]?.reset().fadeIn(0.2).play();
  }, [actions, idleAnim]);

  useEffect(() => {
    if (!actions || state !== 'hit' || !hitAnim) return;
    actions[hitAnim]?.reset().fadeIn(0.1).play();
    const t = setTimeout(() => {
      actions[idleAnim]?.reset().fadeIn(0.2).play();
      actions[hitAnim]?.fadeOut(0.2);
    }, 600);
    return () => clearTimeout(t);
  }, [state, actions, hitAnim, idleAnim]);

  return (
    <group ref={groupRef} position={[0, cfg.yOffset * finalScale, 0]} scale={finalScale}>
      <primitive object={cloned} />
    </group>
  );
};

/** 스프라이트(이미지) 몬스터 — 기존 방식 */
const MonsterSprite = ({ id, hp, maxHp, textureUrl, scale }) => {
  const texture = useTexture(textureUrl || '/golden_punch.png');
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

/** 몬스터 컴포넌트 */
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
