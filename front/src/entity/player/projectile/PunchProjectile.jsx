import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

// [도 -> 라디안 변환기]
const circulate = (deg) => deg * (Math.PI / 180);

export const PunchProjectile = ({
  id, startPos, playerRot, remove, update, add,
  generation = 0, side, velocity, baseAng, onUpdatePosition, scale // [수정] scale 추가
}) => {
  const spriteRef = useRef();
  const tick = useRef(0);
  const pos = useRef({ ...startPos });
  const vel = useRef(velocity);
  const isSplit = useRef(false);
  const texture = useTexture('/golden_punch.png');// 임시 이미지
  // const texture = useTexture('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'); // 임시 이미지

  const MAX_GEN = 3; // 최대 16발 (2→4→8→16), 64발 지수폭발 방지
  const speed = 2.5;

  useEffect(() => { if (velocity) vel.current = velocity; }, [velocity]);

  useFrame((state, delta) => {
    if (!spriteRef.current) return;
    tick.current += delta;

    // 0. 초기 속도 세팅 (side에 따라 왼쪽/오른쪽 자동 결정)
    if (!vel.current) {
      const sideDeg = side === 'left' ? 90 : -90;
      const ang = playerRot + circulate(sideDeg);
      vel.current = { x: Math.sin(ang) * speed, z: Math.cos(ang) * speed };
    }

    // 1. 이동
    pos.current.x += (vel.current?.x || 0) * delta;
    pos.current.z += (vel.current?.z || 0) * delta;

    if (spriteRef.current) {
      spriteRef.current.position.set(pos.current.x, 1.5, pos.current.z);
    }

    // [Fix] 충돌 판정을 위해 상위 컴포넌트에 위치 업데이트
    if (onUpdatePosition) {
      onUpdatePosition(pos.current);
    } else {
      update?.(id, { position: pos.current });
    }

    // 2. 방향 회전 (2D Sprite라 항상 카메라 봄, 필요시 회전 로직 추가)
    // const moveAng = Math.atan2(vel.current.x, vel.current.z);
    // spriteRef.current.rotation.z = -moveAng; 

    // ==========================================================
    // [★ 프랙탈 분열 로직 (1 -> 2 -> 4 -> 8 -> 16)] 
    // ==========================================================
    if (tick.current > 1.0 && !isSplit.current && generation < MAX_GEN) {
      isSplit.current = true;
      remove?.(id); // 현재 세대는 자식을 낳고 사라짐

      // 기준 각도 계승 (처음 분열할 때의 각도를 가문의 비기로 물려줌)
      const pivot = baseAng !== undefined ? baseAng : Math.atan2(vel.current.x, vel.current.z);

      const rad45 = circulate(45);

      // [자식 A: 기준선 대비 위로 45도]
      add?.({
        startPos: { ...pos.current },
        velocity: {
          x: Math.sin(pivot + rad45) * speed,
          z: Math.cos(pivot + rad45) * speed
        },
        generation: generation + 1,
        baseAng: pivot,
        side
      });

      // [자식 B: 기준선 대비 아래로 45도]
      add?.({
        startPos: { ...pos.current },
        velocity: {
          x: Math.sin(pivot - rad45) * speed,
          z: Math.cos(pivot - rad45) * speed
        },
        generation: generation + 1,
        baseAng: pivot,
        side
      });
    }

    // 모든 펀치는 1초 뒤에 사라집니다 (마지막 16발 포함)
    // 분열 안 한 마지막 세대도 시간 지나면 삭제
    if (tick.current > 1.0 && (generation >= MAX_GEN || isSplit.current)) remove?.(id);
  });

  return (
    <sprite ref={spriteRef} scale={[scale, scale, 1]}>
      <spriteMaterial map={texture} transparent={true} />
    </sprite>
  );
};
