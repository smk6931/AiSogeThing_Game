import React from 'react';
import { Sky, ContactShadows, Environment } from '@react-three/drei';
import { useGameConfig } from '../../gameEdit/GameConfigContext';

/**
 * 게임의 전체적인 분위기를 담당하는 환경 설정 컴포넌트
 * 안개(Fog), 하늘(Sky/Environment), 라이팅(Lighting)을 통합 관리합니다.
 */
const EnvironmentEffects = () => {
  const { hdriUrl } = useGameConfig();

  return (
    <>
      {/* 1. 360도 스카이박스/Environment (내장 프리셋 사용으로 오류 방지) */}
      <Environment preset="sunset" background blur={0} />


      {/* 2. 배경색 및 안개 설정 (HDRI 사용 시 충돌하므로 제거) */}
      {/* <color attach="background" args={['#b3d1ff']} /> */}
      {/* <fog attach="fog" args={['#b3d1ff', 50, 1500]} /> */}


      {/* 3. 하늘 대기 보조 (직접 넣은 HDRI 이미지가 하늘을 덮으므로 기본 Sky는 꺼줍니다) */}
      {/* 
      <Sky
        distance={450000}
        sunPosition={[10, 20, 10]} 
        inclination={0.2}
        azimuth={0.25}
        mieCoefficient={0.005} 
        mieDirectionalG={0.8}
        rayleigh={1.2} 
      /> 
      */}

      {/* 4. 조명 설정 (너무 밝지 않게 조절하여 지도 가시성 확보) */}
      {/* <ambientLight intensity={0.4} color="#ffffff" /> */}
      <directionalLight
        position={[20, 50, 20]}
        intensity={1.1}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />


      {/* 5. 캐릭터 발치 그림자 (낮에는 그림자가 더 또렷함) */}
      <ContactShadows
        opacity={0.65}
        scale={15}
        blur={1.5}
        far={10}
        color="#000000"
      />
    </>
  );
};

export default EnvironmentEffects;
