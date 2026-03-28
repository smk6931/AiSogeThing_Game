import React, { forwardRef, useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useGLTF, useAnimations } from '@react-three/drei';
import PlayerChat from './logic/PlayerChat';
import { usePlayerMovement } from './logic/usePlayerMovement';
import { usePlayerSkills } from './logic/usePlayerSkills';

const PLAYER_MODEL = '/models/characters/Seoul_Normal_Knight_001_Warrior.glb';

/** 로컬 플레이어 컴포넌트 — GLB 3D 모델, 애니메이션 포함 */
const Player = forwardRef(({ input, actions: inputActions, onMove, onAction, chat, zoomLevel, nickname, scale = 0.625, ...props }, ref) => {
  usePlayerMovement(ref, input, onMove, zoomLevel);
  usePlayerSkills(ref, inputActions, onAction);

  const { scene, animations } = useGLTF(PLAYER_MODEL);
  const modelGroupRef = useRef();
  const { actions } = useAnimations(animations, modelGroupRef);

  const { modelScale, yOffset } = useMemo(() => {
    scene.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(scene);
    const nativeH = box.max.y - box.min.y;
    const targetH = scale * 3.2;
    const ms = nativeH > 0.001 ? targetH / nativeH : scale;
    const yOff = -box.min.y * ms;
    return { modelScale: ms, yOffset: yOff };
  }, [scene, scale]);

  // 이동 상태에 따라 Idle ↔ Run 전환
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
      <group ref={modelGroupRef} position={[0, yOffset, 0]} scale={modelScale}>
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
