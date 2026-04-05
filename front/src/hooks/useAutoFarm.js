// 자동사냥 모드 — Z키 토글, 가장 가까운 몬스터 자동 타겟 선택
import { useRef, useEffect, useCallback } from 'react';

const AUTO_RETARGET_MS = 1500;  // 타겟 없을 때 재탐색 주기

export const useAutoFarm = ({ isAutoMode, monstersRef, playerRef, setTargetMonsterId }) => {
  const retargetRef = useRef(null);

  const findNearestMonster = useCallback(() => {
    if (!playerRef.current || !monstersRef.current) return null;
    const px = playerRef.current.position.x;
    const pz = playerRef.current.position.z;

    let nearest = null;
    let nearestDistSq = Infinity;

    for (const [id, m] of Object.entries(monstersRef.current)) {
      if (!m || m.state === 'dead' || m.hp <= 0) continue;
      const mx = m.position?.x ?? 0;
      const mz = m.position?.z ?? 0;
      const distSq = (px - mx) ** 2 + (pz - mz) ** 2;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = id;
      }
    }
    return nearest;
  }, [monstersRef, playerRef]);

  useEffect(() => {
    if (retargetRef.current) {
      clearInterval(retargetRef.current);
      retargetRef.current = null;
    }

    if (!isAutoMode) {
      setTargetMonsterId(null);
      return;
    }

    // 자동사냥 ON: 즉시 타겟 탐색 + 주기적 재탐색
    const retarget = () => {
      const nearest = findNearestMonster();
      setTargetMonsterId(nearest ? Number(nearest) : null);
    };

    retarget();
    retargetRef.current = setInterval(retarget, AUTO_RETARGET_MS);

    return () => {
      clearInterval(retargetRef.current);
      retargetRef.current = null;
    };
  }, [isAutoMode, findNearestMonster, setTargetMonsterId]);
};
