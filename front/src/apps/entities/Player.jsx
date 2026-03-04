import React, { forwardRef } from 'react';
import { Html } from '@react-three/drei';
import PlayerChat from './player/PlayerChat';
import { usePlayerMovement } from './player/usePlayerMovement';
import { usePlayerSkills } from './player/usePlayerSkills';

/**
 * 로컬 플레이어 컴포넌트
 * GLTF 없이도 풍부한 형태감을 주는 로우폴리 판타지 캐릭터 구조
 */
const Player = forwardRef(({ input, actions, onMove, onAction, chat, zoomLevel, nickname, ...props }, ref) => {
  usePlayerMovement(ref, input, onMove, zoomLevel);
  usePlayerSkills(ref, actions, onAction);

  return (
    <group ref={ref} {...props}>

      {/* ===== 닉네임 표시 ===== */}
      <Html position={[0, 4.2, 0]} center>
        <div style={{
          background: 'rgba(8, 8, 18, 0.85)',
          border: '1px solid rgba(180, 140, 60, 0.6)',
          color: '#c8a84b',
          padding: '3px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontFamily: "'Cinzel', sans-serif",
          fontWeight: '600',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          letterSpacing: '0.8px',
          textShadow: '0 0 6px rgba(200, 168, 75, 0.6)',
          backdropFilter: 'blur(4px)',
          boxShadow: '0 0 10px rgba(200, 168, 75, 0.15)',
        }}>
          {nickname || 'Hero'}
        </div>
      </Html>

      {/* ===== 신체 그룹 (발바닥 피벗 기준) ===== */}
      <group position={[0, 0, 0]}>

        {/* 다리 (Left) */}
        <mesh position={[-0.22, 0.55, 0]} castShadow>
          <boxGeometry args={[0.22, 1.1, 0.22]} />
          <meshStandardMaterial color="#1a2a4a" roughness={0.7} metalness={0.1} />
        </mesh>
        {/* 다리 (Right) */}
        <mesh position={[0.22, 0.55, 0]} castShadow>
          <boxGeometry args={[0.22, 1.1, 0.22]} />
          <meshStandardMaterial color="#1a2a4a" roughness={0.7} metalness={0.1} />
        </mesh>

        {/* 허리 벨트 라인 */}
        <mesh position={[0, 1.15, 0]} castShadow>
          <boxGeometry args={[0.68, 0.15, 0.35]} />
          <meshStandardMaterial color="#c8a84b" roughness={0.5} metalness={0.4} />
        </mesh>

        {/* 몸통 (갑옷 느낌) */}
        <mesh position={[0, 1.7, 0]} castShadow>
          <boxGeometry args={[0.7, 1.0, 0.38]} />
          <meshStandardMaterial color="#2c3e6a" roughness={0.6} metalness={0.25} />
        </mesh>

        {/* 가슴 갑옷 장식 */}
        <mesh position={[0, 1.75, 0.2]} castShadow>
          <boxGeometry args={[0.45, 0.6, 0.08]} />
          <meshStandardMaterial color="#3a4e8a" roughness={0.5} metalness={0.5} />
        </mesh>

        {/* 어깨 패드 (Left) */}
        <mesh position={[-0.48, 2.1, 0]} castShadow>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial color="#c8a84b" roughness={0.4} metalness={0.55} />
        </mesh>
        {/* 어깨 패드 (Right) */}
        <mesh position={[0.48, 2.1, 0]} castShadow>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshStandardMaterial color="#c8a84b" roughness={0.4} metalness={0.55} />
        </mesh>

        {/* 팔 (Left) */}
        <mesh position={[-0.5, 1.6, 0]} castShadow>
          <boxGeometry args={[0.2, 0.8, 0.2]} />
          <meshStandardMaterial color="#2c3e6a" roughness={0.65} metalness={0.2} />
        </mesh>
        {/* 팔 (Right) */}
        <mesh position={[0.5, 1.6, 0]} castShadow>
          <boxGeometry args={[0.2, 0.8, 0.2]} />
          <meshStandardMaterial color="#2c3e6a" roughness={0.65} metalness={0.2} />
        </mesh>

        {/* 목 */}
        <mesh position={[0, 2.3, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.15, 0.25, 8]} />
          <meshStandardMaterial color="#e8c9a0" roughness={0.9} />
        </mesh>

        {/* 머리 */}
        <mesh position={[0, 2.7, 0]} castShadow>
          <boxGeometry args={[0.55, 0.58, 0.52]} />
          <meshStandardMaterial color="#e8c9a0" roughness={0.85} />
        </mesh>

        {/* 투구 */}
        <mesh position={[0, 3.02, 0]} castShadow>
          <boxGeometry args={[0.6, 0.3, 0.56]} />
          <meshStandardMaterial color="#c8a84b" roughness={0.4} metalness={0.6} />
        </mesh>

        {/* 투구 챙 */}
        <mesh position={[0, 2.88, 0.32]} castShadow>
          <boxGeometry args={[0.5, 0.06, 0.18]} />
          <meshStandardMaterial color="#b89030" roughness={0.4} metalness={0.7} />
        </mesh>

        {/* 눈 (방향 표시용 - 정면) */}
        <mesh position={[-0.14, 2.72, 0.27]} castShadow>
          <boxGeometry args={[0.1, 0.08, 0.04]} />
          <meshStandardMaterial color="#60b4ff" emissive="#1060cc" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0.14, 2.72, 0.27]} castShadow>
          <boxGeometry args={[0.1, 0.08, 0.04]} />
          <meshStandardMaterial color="#60b4ff" emissive="#1060cc" emissiveIntensity={0.8} />
        </mesh>

        {/* 검 (우측 손) */}
        <group position={[0.72, 1.55, 0.1]} rotation={[0, 0, -0.15]}>
          {/* 검 손잡이 */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
            <meshStandardMaterial color="#4a3000" roughness={0.6} metalness={0.2} />
          </mesh>
          {/* 가드 */}
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.35, 0.06, 0.1]} />
            <meshStandardMaterial color="#c8a84b" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* 검날 */}
          <mesh position={[0, 0.85, 0]}>
            <boxGeometry args={[0.06, 1.2, 0.04]} />
            <meshStandardMaterial color="#d4e8f0" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>

      </group>

      {/* 그림자 원 */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.7, 32]} />
        <meshBasicMaterial color="black" opacity={0.25} transparent />
      </mesh>

      {/* 채팅 UI */}
      <PlayerChat chat={chat} />
    </group>
  );
});

export default Player;
