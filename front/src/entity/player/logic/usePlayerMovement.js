import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTerrainHeight, getPartitionElevY } from '@entity/world/terrainHandler';
import { useGameConfig } from '@contexts/GameConfigContext';

export const usePlayerMovement = (ref, input, onMove, zoomLevel = 16) => {
  const { moveSpeed: configSpeed } = useGameConfig();
  const lastSendTime = useRef(0);
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3(0, 1, 0));

  useFrame((state) => {
    if (!ref.current) return;

    if (input.isMoving) {
      // 에디터에서 설정한 속도를 사용
      const moveSpeed = input.source === 'keyboard' ? configSpeed : configSpeed * 1.6;

      // 1. 카메라 정면 방향 계산 (XZ 평면 투영)
      state.camera.getWorldDirection(forward.current);
      forward.current.y = 0;
      forward.current.normalize();

      // 만약 카메라가 수직으로 내려다보고 있어 방향이 0이라면 기본값 설정
      if (forward.current.lengthSq() < 0.0001) {
        forward.current.set(0, 0, -1);
      }

      // 2. 카메라 오른쪽 방향 계산
      right.current.crossVectors(forward.current, up.current);

      // 3. 입력을 카메라 기준 방향으로 변환
      // input.y: -1(W), 1(S) | input.x: -1(A), 1(D)
      const moveX = (forward.current.x * -input.y) + (right.current.x * input.x);
      const moveZ = (forward.current.z * -input.y) + (right.current.z * input.x);

      // 4. 위치 이동
      ref.current.position.x += moveX * moveSpeed;
      ref.current.position.z += moveZ * moveSpeed;

      // 5. 이동 방향으로 캐릭터 회전
      if (Math.abs(moveX) > 0.01 || Math.abs(moveZ) > 0.01) {
        ref.current.rotation.y = Math.atan2(moveX, moveZ);
      }

      // 파티션 고도(showElevation ON) 우선, 없으면 heightmap 폴백
      const terrainHeight = getPartitionElevY(ref.current.position.x, ref.current.position.z)
        ?? getTerrainHeight(ref.current.position.x, ref.current.position.z);
      ref.current.position.y = terrainHeight;

      if (onMove) {
        onMove({
          x: ref.current.position.x,
          y: ref.current.position.y,
          z: ref.current.position.z,
          rotation: ref.current.rotation.y,
          isLocalSync: true
        });
      }

      // 서버 전송(네트워크 부하 방지)은 기존처럼 0.1초마다 수행
      const now = state.clock.elapsedTime;
      if (now - lastSendTime.current > 0.1) {
        if (onMove) {
          onMove({
            x: ref.current.position.x,
            y: ref.current.position.y,
            z: ref.current.position.z,
            rotation: ref.current.rotation.y,
            isServerSync: true
          });
        }
        lastSendTime.current = now;
      }
    } else {
      // 정지 상태일 때도 파티션 고도 유지
      const terrainHeight = getPartitionElevY(ref.current.position.x, ref.current.position.z)
        ?? getTerrainHeight(ref.current.position.x, ref.current.position.z);
      if (Math.abs(ref.current.position.y - terrainHeight) > 0.01) {
        ref.current.position.y = terrainHeight;
      }
    }
  });
};
