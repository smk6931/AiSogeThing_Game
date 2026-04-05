// 타겟 선택 시 일정 주기로 마법 구체를 자동 발사하는 훅
import { useRef, useEffect } from 'react';

const ATTACK_INTERVAL_MS = 1200;

export const useAutoAttack = ({ targetMonsterId, monstersRef, playerRef, addProjectile, attackRange = 30 }) => {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!targetMonsterId) return;

    intervalRef.current = setInterval(() => {
      const monster = monstersRef.current?.[targetMonsterId];
      if (!monster || monster.state === 'dead' || monster.hp <= 0) return;
      if (!playerRef.current) return;

      const px = playerRef.current.position.x;
      const pz = playerRef.current.position.z;
      const mx = monster.position.x;
      const mz = monster.position.z;
      const distSq = (px - mx) ** 2 + (pz - mz) ** 2;
      if (distSq > attackRange * attackRange) return;

      playerRef.current.rotation.y = Math.atan2(mx - px, mz - pz);

      addProjectile({
        type: 'magic_orb',
        startPos: { x: px, y: playerRef.current.position.y + 1.5, z: pz },
        targetPos: { x: mx, y: 1.5, z: mz },
        targetMonsterId: String(targetMonsterId),
      });
    }, ATTACK_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [targetMonsterId, monstersRef, playerRef, addProjectile, attackRange]);
};
