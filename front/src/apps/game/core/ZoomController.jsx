import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * [가이드] 줌 컨트롤러 수정
 * PerspectiveCamera에서 단순히 .zoom 속성을 크게 키우면 
 * 렌즈가 사물을 왜곡시켜서 화면이 깨져 보이기 쉽습니다.
 */
const ZoomController = ({ zoomLevel }) => {
  const { camera } = useThree();

  useEffect(() => {
    const MAP_PIXELS_PER_METER_AT_ZOOM16 = 0.5283;
    let targetZoom = Math.pow(2, zoomLevel - 16) * MAP_PIXELS_PER_METER_AT_ZOOM16;

    // 렌즈 왜곡을 방지하기 위해 너무 과도한 줌 배율은 제한합니다.
    camera.zoom = targetZoom * 1.25;
    camera.updateProjectionMatrix();
  }, [camera, zoomLevel]);

  return null;
};

export default ZoomController;
