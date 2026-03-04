import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/**
 * [플레이어 스킬 입력 관리]
 * 입력만 감지해서 부모(World)에게 "쏴줘!"라고 신호만 보냅니다.
 * 모든 발사 로직은 world의 useProjectiles에서 처리하도록 통합했습니다.
 */
export const usePlayerSkills = (ref, actions, onTrigger) => {
  const prevSkillRef = useRef(false);

  useFrame(() => {
    if (!ref.current) return;

    // R키 또는 조이스틱 버튼 클릭 감지
    if (actions?.skill1 && !prevSkillRef.current) {
      // 부모에게 현재 위치와 회전값을 넘겨주며 발사 요청
      onTrigger(ref.current.position, ref.current.rotation.y);
    }
    prevSkillRef.current = actions?.skill1;
  });
};
