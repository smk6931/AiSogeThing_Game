import React, { useRef, useMemo, useEffect } from 'react';
import { Billboard, Text, useGLTF, useAnimations } from '@react-three/drei';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE_MODEL_URL = '/models/';

/**
 * 모델 파일별 스케일·Y오프셋 설정 (TODO: monster_template DB 컬럼으로 이전 예정)
 */
const MODEL_CONFIG = {
  'monsters/Gangnam_Boss_Fire_001_Dragon.glb':      { scale: 2.0,  yOffset: 0, hpBarHeight: 12 },
  'monsters/Seoul_Normal_Water_001_Slime.glb':      { scale: 0.6,  yOffset: 0.014, hpBarHeight: 4 },
  'monsters/Noryangjin_Normal_Forest_003_Goblin.glb': { scale: 0.6,  yOffset: 0, hpBarHeight: 4 },
  'monsters/Noryangjin_Elite_Stone_004_Orc.glb':    { scale: 0.9,  yOffset: 0, hpBarHeight: 5 },
  'monsters/Noryangjin_Normal_Dark_005_Zombie.glb': { scale: 0.6,  yOffset: 0, hpBarHeight: 4 },
  'monsters/Noryangjin_Elite_Magic_006_Witch.glb':  { scale: 0.75, yOffset: 0, hpBarHeight: 5 },
  'monsters/Noryangjin_Boss_Earth_007_Ogre.glb':    { scale: 1.2,  yOffset: 0, hpBarHeight: 8 },
};
const DEFAULT_CONFIG_HP_BAR = 4;
const DEFAULT_CONFIG = { scale: 0.6, yOffset: 0, hpBarHeight: 4 };

/** GLB 3D 몬스터 */
const MonsterGLB = ({ modelPath, scale: playerScale, state }) => {
  const { scene, animations } = useGLTF(BASE_MODEL_URL + modelPath);
  const cloned = useMemo(() => cloneSkeleton(scene), [scene]);
  const groupRef = useRef();
  const { actions } = useAnimations(animations, groupRef);

  const cfg = MODEL_CONFIG[modelPath] || DEFAULT_CONFIG;
  const finalScale = cfg.scale * (playerScale / 0.625);

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

/** HP바 */
const HpBar = ({ hp, maxHp, name, hpBarHeight, tier }) => {
  const hpPercent = maxHp > 0 ? hp / maxHp : 0;
  const hpColor = hpPercent > 0.5 ? 'green' : hpPercent > 0.2 ? 'orange' : 'red';
  const nameColor = tier === 'boss' ? '#ff4444' : tier === 'elite' ? '#ff9900' : 'white';
  return (
    <Billboard position={[0, hpBarHeight, 0]}>
      <mesh>
        <planeGeometry args={[4.0, 0.4]} />
        <meshBasicMaterial color="black" />
      </mesh>
      <mesh position={[-(4.0 * (1 - hpPercent)) / 2, 0, 0.01]}>
        <planeGeometry args={[4.0 * hpPercent, 0.32]} />
        <meshBasicMaterial color={hpColor} />
      </mesh>
      <Text position={[0, 0.8, 0]} fontSize={0.8} color={nameColor} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="black">
        {name}
      </Text>
    </Billboard>
  );
};

/** 몬스터 컴포넌트 — GLB 전용 (modelPath 없으면 렌더링 안 함) */
const Monster = ({ id, position, hp, maxHp, state, modelPath, tier = 'normal', scale = 1 }) => {
  if (hp <= 0 || state === 'dead' || !modelPath) return null;
  const pos = [position.x, 0, position.z];
  const name = modelPath.split('_').pop()?.replace('.glb', '') || `#${id}`;
  const cfg = MODEL_CONFIG[modelPath] || DEFAULT_CONFIG;
  const hpBarHeight = cfg.hpBarHeight ?? DEFAULT_CONFIG_HP_BAR;

  return (
    <group position={pos}>
      <MonsterGLB modelPath={modelPath} scale={scale} state={state} />
      <HpBar hp={hp} maxHp={maxHp} name={name} hpBarHeight={hpBarHeight} tier={tier} />
    </group>
  );
};

export default Monster;
