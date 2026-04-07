import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CameraRig = ({ target, zoomLevel, orbitRef, cameraMode, debugConfig }) => {
  const lastTargetPos = useRef(null);
  const modeRef = useRef(cameraMode);

  useFrame((state) => {
    if (!target?.current?.position || !orbitRef?.current) return;

    const targetPos = new THREE.Vector3().copy(target.current.position);

    if (modeRef.current !== cameraMode) {
      modeRef.current = cameraMode;
      lastTargetPos.current = null;
    }

    if (!lastTargetPos.current) {
      lastTargetPos.current = targetPos.clone();

      if (state.camera.isPerspectiveCamera && state.camera.fov !== debugConfig.cameraFov) {
        state.camera.fov = debugConfig.cameraFov;
        state.camera.updateProjectionMatrix();
      }

      let cx;
      let cz;
      let baseHeight;

      if (cameraMode === 'isometric') {
        const isoDistMult = debugConfig.camIsoDistMult || 50;
        const dist = state.camera.isOrthographicCamera ? 10000 : isoDistMult * Math.pow(2, 16.5 - zoomLevel);
        const pitch = ((debugConfig.camIsoPitch || 25) * Math.PI) / 180;
        cx = targetPos.x;
        cz = targetPos.z + dist * Math.sin(pitch);
        baseHeight = dist * Math.cos(pitch);
      } else {
        const playDistMult = debugConfig.playCamDistMult || 20;
        const playPitch = ((debugConfig.playCamPitch || 60) * Math.PI) / 180;
        const dist = state.camera.isOrthographicCamera ? 10000 : playDistMult * Math.pow(2, 16.5 - zoomLevel);
        const radius = dist * Math.cos(playPitch);
        cx = targetPos.x;
        cz = targetPos.z + radius;
        baseHeight = dist * Math.sin(playPitch);
      }

      state.camera.position.set(cx, targetPos.y + baseHeight, cz);
      orbitRef.current.target.copy(targetPos);
      orbitRef.current.update();
      return;
    }

    const currentOffset = new THREE.Vector3().subVectors(state.camera.position, lastTargetPos.current);
    state.camera.position.copy(targetPos).add(currentOffset);
    orbitRef.current.target.copy(targetPos);

    if (state.camera.isPerspectiveCamera && state.camera.fov !== debugConfig.cameraFov) {
      state.camera.fov = debugConfig.cameraFov;
      state.camera.updateProjectionMatrix();
    }

    if (cameraMode === 'isometric') {
      orbitRef.current.setAzimuthalAngle((debugConfig.camIsoAzimuth || 0) * (Math.PI / 180));
      orbitRef.current.setPolarAngle(((debugConfig.camIsoPitch || 15) * Math.PI) / 180);
    }

    orbitRef.current.update();
    lastTargetPos.current.copy(targetPos);
  });

  return null;
};

export default CameraRig;
