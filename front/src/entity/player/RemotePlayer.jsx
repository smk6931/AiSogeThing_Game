import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// 모든 RemotePlayer 인스턴스가 공유하는 geometry (한 번만 생성)
const CYLINDER_GEO = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
const BOX_GEO = new THREE.BoxGeometry(0.2, 0.2, 0.2);

// 각도 보간 함수 (Shortest path lerp for angles)
const lerpAngle = (start, end, t) => {
  let diff = (end - start) % (Math.PI * 2);
  if (diff < -Math.PI) diff += Math.PI * 2;
  if (diff > Math.PI) diff -= Math.PI * 2;
  return start + diff * t;
};

const RemotePlayer = ({ position, rotation, animation, nickname, chat, scale = 1 }) => {
  const meshRef = useRef();
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (chat && chat.timestamp) {
      setShowChat(true);
      const timer = setTimeout(() => setShowChat(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [chat]);

  // 부드러운 움직임 보간 (Interpolation)
  useFrame((state, delta) => {
    if (meshRef.current) {
      // 현재 위치에서 목표 위치로 부드럽게 이동 (Lerp)
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, position.x || 0, 10 * delta);
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, position.z || 0, 10 * delta);
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, position.y || 1, 10 * delta);

      // 회전도 직접 구현한 lerpAngle로 보간
      if (rotation !== undefined) {
        meshRef.current.rotation.y = lerpAngle(meshRef.current.rotation.y, rotation, 10 * delta);
      }
    }
  });

  return (
    <group ref={meshRef} scale={scale}>
      {/* 캐릭터 몸체 (플레이어와 동일한 원통형) */}
      <mesh castShadow position={[0, 0.5, 0]} geometry={CYLINDER_GEO}>
        <meshStandardMaterial color="#6bff6b" />
      </mesh>

      {/* 머리/장식 (방향 확인용) */}
      <mesh position={[0, 0.3, 0.4]} geometry={BOX_GEO}>
        <meshStandardMaterial color="white" />
      </mesh>

      {/* 닉네임 표시 */}
      {/* 닉네임 표시 */}
      <Html position={[0, 2.5, 0]} center>
        <div style={{
          background: 'rgba(0, 0, 0, 0.6)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          whiteSpace: 'nowrap'
        }}>
          {nickname}
        </div>
      </Html>

      {/* 말풍선 */}
      {showChat && (
        <Html position={[0, 3.8, 0]} center>
          <div style={{
            background: 'white',
            color: 'black',
            padding: '6px 10px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            border: '2px solid #333',
            position: 'relative',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
            animation: 'popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            {chat.message}
            <div style={{
              position: 'absolute',
              bottom: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid white'
            }}></div>
          </div>
          <style>{`
            @keyframes popIn {
              from { transform: scale(0); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </Html>
      )}
    </group>
  );
};

export default RemotePlayer;
