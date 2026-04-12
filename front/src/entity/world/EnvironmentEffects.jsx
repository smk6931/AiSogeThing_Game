import React from 'react';
import { ContactShadows, Environment } from '@react-three/drei';

/**
 * 게임 환경 설정 — 조명·그림자만 담당
 * Environment background 제거: 탑다운 카메라에서 맵 타일에 가려져 낭비
 * directionalLight castShadow 제거: 2048×2048 그림자맵 매 프레임 연산 제거
 * ContactShadows만 유지: 캐릭터 발치 소프트 그림자 (별도 렌더 타겟, Canvas shadows 불필요)
 */
const EnvironmentEffects = () => {
  return (
    <>
      {/* 주변광 — 전역 밝기 보정 */}
      <ambientLight intensity={1.2} color="#ffffff" />

      {/* 방향광 — 그림자 없이 조명만 */}
      <directionalLight
        position={[20, 50, 20]}
        intensity={1.1}
        color="#ffffff"
      />

      {/* 캐릭터 발치 소프트 그림자 (ContactShadows는 자체 렌더 타겟 사용) */}
      <ContactShadows
        opacity={0.5}
        scale={10}
        blur={2}
        far={6}
        color="#000000"
      />

      {/* 씬 조명 정보만 제공 (background=false → 하늘 렌더링 없음) */}
      <Environment preset="sunset" background={false} />
    </>
  );
};

export default EnvironmentEffects;
