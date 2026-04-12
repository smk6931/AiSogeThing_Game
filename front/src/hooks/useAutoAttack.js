// 타겟 선택 시 일정 주기로 스킬을 자동 발사하는 훅
// activeSkillId — hotbar 슬롯 0의 스킬 (기본값 magic_orb)
import { useRef, useEffect } from 'react';
import { SKILL_CATALOG } from '@data/skillCatalog';

const DEFAULT_SKILL = 'magic_orb';
const DEFAULT_INTERVAL_MS = 1200;

export const useAutoAttack = ({
  targetMonsterId,
  monstersRef,
  playerRef,
  addProjectile,
  attackRange = 30,
  activeSkillId = DEFAULT_SKILL,
}) => {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!targetMonsterId) return;

    const skillId = activeSkillId || DEFAULT_SKILL;
    const skill = SKILL_CATALOG[skillId] ?? SKILL_CATALOG[DEFAULT_SKILL];
    const intervalMs = skill.cooldownMs ?? DEFAULT_INTERVAL_MS;

    intervalRef.current = setInterval(() => {
      const monster = monstersRef.current?.[targetMonsterId];
      if (!monster || monster.state === 'dead' || monster.hp <= 0) return;
      if (!playerRef.current) return;

      const px = playerRef.current.position.x;
      const pz = playerRef.current.position.z;
      const mx = monster.position.x;
      const mz = monster.position.z;
      const distSq = (px - mx) ** 2 + (pz - mz) ** 2;

      const range = skill.range ?? attackRange;
      if (distSq > range * range) return;

      // 타겟 방향으로 회전
      playerRef.current.rotation.y = Math.atan2(mx - px, mz - pz);
      const startPos = { x: px, y: playerRef.current.position.y + 1.5, z: pz };
      const playerRot = playerRef.current.rotation.y;

      if (skill.type === 'target') {
        // magic_orb 등 — 타겟 추적
        addProjectile({
          type: skillId,
          startPos,
          targetPos: { x: mx, y: 1.5, z: mz },
          targetMonsterId: String(targetMonsterId),
        });
      } else if (skill.type === 'spread') {
        // pyramid_punch — 양손 발사
        addProjectile({ type: skillId, startPos, playerRot, side: 'left' });
        addProjectile({ type: skillId, startPos, playerRot, side: 'right' });
      } else if (skill.type === 'linear') {
        // lightning_bolt — 타겟 방향으로 직선
        addProjectile({ type: skillId, startPos, playerRot });
      }
      // aoe_self(frost_nova)는 자동사냥에서 제외 (밸런스)
    }, intervalMs);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [targetMonsterId, monstersRef, playerRef, addProjectile, attackRange, activeSkillId]);
};
