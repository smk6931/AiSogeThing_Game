// 자동사냥 모드 — Z키 토글, 가장 가까운 몬스터 자동 타겟 선택
import { useRef, useEffect, useCallback } from 'react';

const AUTO_RETARGET_MS = 1500;  // 타겟 없을 때 재탐색 주기

export const useAutoFarm = ({ isAutoMode, monstersRef, playerRef, setTargetMonsterId, range = 60 }) => {
  const retargetRef = useRef(null);
  const currentTargetRef = useRef(null);

  const findNearestMonster = useCallback(() => {
    if (!playerRef.current || !monstersRef.current) return null;
    const px = playerRef.current.position.x;
    const pz = playerRef.current.position.z;
    const rangeSq = range * range;

    // 현재 타겟이 여전히 살아있고 범위 내에 있으면 재탐색 생략
    const curId = currentTargetRef.current;
    if (curId !== null) {
      const cur = monstersRef.current[curId];
      if (cur && cur.state !== 'dead' && cur.hp > 0) {
        const mx = cur.position?.x ?? 0;
        const mz = cur.position?.z ?? 0;
        if ((px - mx) ** 2 + (pz - mz) ** 2 <= rangeSq) return String(curId);
      }
    }

    let nearest = null;
    let nearestDistSq = Infinity;

    for (const [id, m] of Object.entries(monstersRef.current)) {
      if (!m || m.state === 'dead' || m.hp <= 0) continue;
      const mx = m.position?.x ?? 0;
      const mz = m.position?.z ?? 0;
      const distSq = (px - mx) ** 2 + (pz - mz) ** 2;
      if (distSq <= rangeSq && distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = id;
      }
    }
    return nearest;
  }, [monstersRef, playerRef, range]);

  useEffect(() => {
    if (retargetRef.current) {
      clearInterval(retargetRef.current);
      retargetRef.current = null;
    }

    if (!isAutoMode) {
      currentTargetRef.current = null;
      setTargetMonsterId(null);
      return;
    }

    // 자동사냥 ON: 즉시 타겟 탐색 + 주기적 재탐색
    const retarget = () => {
      const nearest = findNearestMonster();
      const nextId = nearest ? Number(nearest) : null;
      currentTargetRef.current = nextId;
      setTargetMonsterId(nextId);
    };

    retarget();
    retargetRef.current = setInterval(retarget, AUTO_RETARGET_MS);

    return () => {
      clearInterval(retargetRef.current);
      retargetRef.current = null;
    };
  }, [isAutoMode, findNearestMonster, setTargetMonsterId]);
};
