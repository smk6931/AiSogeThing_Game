import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text, useGLTF, useAnimations } from '@react-three/drei';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE_MODEL_URL = '/models/';

/**
 * 모델 파일별 스케일·Y오프셋 설정 (TODO: monster_template DB 컬럼으로 이전 예정)
 */
const MODEL_CONFIG = {
  // ── 기존 7종 (수동 튜닝값 유지) ──────────────────────────────────────
  'monsters/Gangnam_Boss_Fire_001_Dragon.glb':            { scale: 0.15,   yOffset: 0,   hpBarHeight: 6 },
  'monsters/Seoul_Normal_Water_001_Slime.glb':            { scale: 0.6,    yOffset: 0.014, hpBarHeight: 4 },
  'monsters/Noryangjin_Normal_Forest_003_Goblin.glb':     { scale: 0.6,    yOffset: 0,   hpBarHeight: 4 },
  'monsters/Noryangjin_Elite_Stone_004_Orc.glb':          { scale: 0.9,    yOffset: 0,   hpBarHeight: 5 },
  'monsters/Noryangjin_Normal_Dark_005_Zombie.glb':       { scale: 0.6,    yOffset: 0,   hpBarHeight: 4 },
  'monsters/Noryangjin_Elite_Magic_006_Witch.glb':        { scale: 0.75,   yOffset: 0,   hpBarHeight: 5 },
  'monsters/Noryangjin_Boss_Earth_007_Ogre.glb':          { scale: 1.2,    yOffset: 0,   hpBarHeight: 8 },
  // ── 신규 13종 (bounding box 자동 계산 — 목표: normal 2m / elite 2.4m / boss 3m) ──
  'monsters/Mapo_Normal_Water_008_Fairy.glb':             { scale: 0.7656, yOffset: 0.3, hpBarHeight: 4 },  // Birb (anim 9)
  'monsters/Yongsan_Elite_Fire_009_Phoenix.glb':          { scale: 0.8744, yOffset: 0.3, hpBarHeight: 5 },  // Hywirl (anim 8)
  'monsters/Seongdong_Normal_Stone_010_Skeleton.glb':     { scale: 0.645,  yOffset: 0,   hpBarHeight: 4 },  // Ghost Skull (anim 8)
  'monsters/Jongno_Boss_Magic_011_Lich.glb':              { scale: 1.1532, yOffset: 0,   hpBarHeight: 7 },  // Wizard (anim 9)
  'monsters/Dobong_Normal_Forest_012_Bandit.glb':         { scale: 0.6643, yOffset: 0,   hpBarHeight: 4 },  // Ninja (anim 9)
  'monsters/Nowon_Elite_Dark_013_Vampire.glb':            { scale: 0.5019, yOffset: 0,   hpBarHeight: 5 },  // Bat (anim 5)
  'monsters/Gangbuk_Normal_Earth_014_Golem.glb':          { scale: 0.7787, yOffset: 0,   hpBarHeight: 4 },  // Goleling Evolved (anim 8)
  'monsters/Seocho_Elite_Water_015_Serpent.glb':          { scale: 0.7905, yOffset: 0,   hpBarHeight: 5 },  // Snake (anim 4)
  'monsters/Songpa_Normal_Fire_016_Salamander.glb':       { scale: 0.742,  yOffset: 0,   hpBarHeight: 4 },  // Frog (anim 14)
  'monsters/Guro_Elite_Earth_017_Troll.glb':              { scale: 0.985,  yOffset: 0,   hpBarHeight: 5 },  // Yeti (anim 9)
  'monsters/Gwangjin_Normal_Magic_018_Wisp.glb':          { scale: 0.645,  yOffset: 0.3, hpBarHeight: 4 },  // Ghost (anim 8)
  'monsters/Seodaemun_Boss_Stone_019_Stone_Giant.glb':    { scale: 0.7654, yOffset: 0,   hpBarHeight: 7 },  // Giant (anim 7)
  'monsters/Dongjak_Elite_Forest_020_Werewolf.glb':       { scale: 0.8952, yOffset: 0,   hpBarHeight: 5 },  // Wolf (anim 24)
};
const DEFAULT_CONFIG_HP_BAR = 4;
const DEFAULT_CONFIG = { scale: 0.6, yOffset: 0, hpBarHeight: 4 };

/** GLB 3D 몬스터 — state 변화 시에만 리렌더 */
const MonsterGLB = React.memo(({ modelPath, scale: playerScale, state }) => {
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

  // T-포즈 모델(애니메이션 없음)에 procedural idle — 미세 상하 흔들기
  const isStaticPose = !idleAnim;
  useFrame(({ clock }) => {
    if (!isStaticPose || !groupRef.current) return;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 1.2) * 0.04 * finalScale;
  });

  return (
    <group ref={groupRef} position={[0, cfg.yOffset * finalScale, 0]} scale={finalScale}>
      <primitive object={cloned} />
    </group>
  );
});

/** HP바 — geometry는 고정 크기, scale.x로 너비 조절 (geometry 재생성 없음) */
const HpBar = ({ hp, maxHp, name, hpBarHeight, tier, isTargeted, onInfoClick }) => {
  const hpPercent = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
  const hpColor = hpPercent > 0.5 ? 'green' : hpPercent > 0.2 ? 'orange' : 'red';
  const nameColor = isTargeted ? '#ffdd00' : tier === 'boss' ? '#ff4444' : tier === 'elite' ? '#ff9900' : 'white';
  return (
    <Billboard position={[0, hpBarHeight, 0]}>
      <mesh>
        <planeGeometry args={[4.0, 0.4]} />
        <meshBasicMaterial color="black" />
      </mesh>
      {/* scale.x로 너비 변경 — geometry 재생성 없음 */}
      <mesh
        position={[-(4.0 * (1 - hpPercent)) / 2, 0, 0.01]}
        scale={[hpPercent, 1, 1]}
      >
        <planeGeometry args={[4.0, 0.32]} />
        <meshBasicMaterial color={hpColor} />
      </mesh>
      <Text position={[0, 0.8, 0]} fontSize={0.8} color={nameColor} anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="black">
        {name}
      </Text>
      <group position={[2.6, 0.8, 0.02]} onClick={(event) => {
        event.stopPropagation();
        onInfoClick?.();
      }}>
        <mesh>
          <planeGeometry args={[0.52, 0.52]} />
          <meshBasicMaterial color="#08111b" transparent opacity={0.9} />
        </mesh>
        <Text
          position={[0, 0, 0.02]}
          fontSize={0.42}
          color="#67e8d6"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.016}
          outlineColor="black"
        >
          i
        </Text>
      </group>
    </Billboard>
  );
};

/** 타겟 선택 링 — 바닥에 표시 */
const TargetRing = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
    <ringGeometry args={[1.2, 1.6, 32]} />
    <meshBasicMaterial color="#ffdd00" transparent opacity={0.7} depthWrite={false} />
  </mesh>
);

/** 몬스터 컴포넌트 — GLB 전용 (modelPath 없으면 렌더링 안 함) */
const Monster = ({ id, position, hp, maxHp, state, modelPath, tier = 'normal', scale = 1, isTargeted = false, onInfoClick }) => {
  if (hp <= 0 || state === 'dead' || !modelPath) return null;
  const pos = [position.x, 0, position.z];
  const name = modelPath.split('_').pop()?.replace('.glb', '') || `#${id}`;
  const cfg = MODEL_CONFIG[modelPath] || DEFAULT_CONFIG;
  const hpBarHeight = cfg.hpBarHeight ?? DEFAULT_CONFIG_HP_BAR;

  return (
    <group position={pos}>
      {isTargeted && <TargetRing />}
      <MonsterGLB modelPath={modelPath} scale={scale} state={state} />
      <HpBar
        hp={hp}
        maxHp={maxHp}
        name={name}
        hpBarHeight={hpBarHeight}
        tier={tier}
        isTargeted={isTargeted}
        onInfoClick={onInfoClick}
      />
    </group>
  );
};

/** 알려진 몬스터 모델 사전 로드 — 처음 화면에 나타날 때 GLB fetch 버벅임 방지 */
export const preloadMonsterModels = (modelPaths) => {
  modelPaths.forEach((p) => {
    if (p) useGLTF.preload(BASE_MODEL_URL + p);
  });
};

export default Monster;
