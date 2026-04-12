import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * [플레이어 스킬 입력 관리]
 * Q/E/R/F 4개 슬롯 감지 → 부모(World)에 슬롯 인덱스로 발동 신호 전달
 * 쿨다운/MP 체크는 useSkillHotbar가 처리하며, 여기서는 입력 엣지만 감지.
 */
export const usePlayerSkills = (ref, actions, onTrigger) => {
  // 각 슬롯(0~3)의 이전 프레임 상태
  const prevRef = useRef([false, false, false, false]);

  useFrame(() => {
    if (!ref.current) return;

    const pos = ref.current.position;
    const rot = ref.current.rotation.y;

    // skill1(Q), skill2(E), skill3(R), skill4(F) — actions 키 이름은 InputManager 기준
    const current = [
      !!actions?.skill1,
      !!actions?.skill2,
      !!actions?.skill3,
      !!actions?.skill4,
    ];

    for (let i = 0; i < 4; i++) {
      if (current[i] && !prevRef.current[i]) {
        // 엣지(false→true) 감지 시 발동
        onTrigger?.(i, pos, rot);
      }
    }

    prevRef.current = current;
  });
};
