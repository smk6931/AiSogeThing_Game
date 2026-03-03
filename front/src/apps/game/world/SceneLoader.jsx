import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

/**
 * Three.js Editor (threejs.org/editor)에서 Export한 
 * Scene JSON 파일을 불러와서 현재 월드에 배치합니다.
 */
const SceneLoader = ({ url = '/scene.json' }) => {
  const { scene: mainScene } = useThree();
  const [loadedObject, setLoadedObject] = useState(null);

  useEffect(() => {
    const checkAndLoad = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status !== 404) {
            console.warn('[SceneLoader] 로드 실패 (HTTP 상태):', response.status, url);
          }
          return;
        }

        const json = await response.json();
        const loader = new THREE.ObjectLoader();
        const obj = loader.parse(json);

        // 에디터에서 익스포트 시 Scene 전체가 올 수 있으므로 내부 체크
        const target = obj.type === 'Scene' ? obj : obj;
        setLoadedObject(target);
        console.log('[SceneLoader] 에디터 씬 로드 완료:', url);

      } catch (err) {
        // 파싱 라이브러리나 네트워크 내부 에러 시에도 게임이 멈추지 않도록 함
        console.debug('[SceneLoader] 로드 스킵 (정상 진행 가능):', err.message);
      }
    };

    checkAndLoad();
  }, [url]);

  return loadedObject ? <primitive object={loadedObject} /> : null;
};

export default SceneLoader;
