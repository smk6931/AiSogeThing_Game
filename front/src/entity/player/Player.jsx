import React, { forwardRef, useRef, useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import PlayerChat from './logic/PlayerChat';
import { usePlayerMovement } from './logic/usePlayerMovement';
import { usePlayerSkills } from './logic/usePlayerSkills';

const PLAYER_MODEL = '/models/characters/Seoul_Normal_Knight_001_Warrior.glb';

// Warrior GLB: Z-up 모델, Z축 기준 높이 183cm → Three.js에서 Y축으로 변환됨
// scale=0.625 기준 목표 높이 2m → 필요 배율: 2.0 / 1.83 ≈ 1.09
const WARRIOR_SCALE_FACTOR = 1.09;

/** 로컬 플레이어 컴포넌트 — GLB 3D 모델, Idle/Run 애니메이션 */
const Player = forwardRef(({ input, actions: inputActions, onMove, onAction, chat, zoomLevel, nickname, scale = 0.625, ...props }, ref) => {
  usePlayerMovement(ref, input, onMove, zoomLevel);
  usePlayerSkills(ref, inputActions, onAction);

  const { scene, animations } = useGLTF(PLAYER_MODEL);
  const modelGroupRef = useRef();
  const { actions } = useAnimations(animations, modelGroupRef);

  const finalScale = scale * WARRIOR_SCALE_FACTOR;

  useEffect(() => {
    if (!actions) return;
    if (input?.isMoving) {
      actions['Run']?.reset().fadeIn(0.15).play();
      actions['Idle']?.fadeOut(0.15);
    } else {
      actions['Idle']?.reset().fadeIn(0.15).play();
      actions['Run']?.fadeOut(0.15);
    }
  }, [input?.isMoving, actions]);

  return (
    <group ref={ref} {...props}>
      <group ref={modelGroupRef} scale={finalScale} rotation={[0, Math.PI, 0]}>
        <primitive object={scene} />
      </group>

      {/* 그림자 원 */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial color="black" opacity={0.25} transparent />
      </mesh>

      <PlayerChat chat={chat} />
    </group>
  );
});

export default Player;
