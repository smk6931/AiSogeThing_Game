// 자동사냥 스킬 순환 — isAutoMode 중 쿨다운이 풀린 슬롯을 자동 발사
// 슬롯 0~2를 매 프레임 검사하여 aoe_self를 제외한 스킬을 즉시 발사
import { useFrame } from '@react-three/fiber';
import { SKILL_CATALOG } from '@data/skillCatalog';

/**
 * @param {object} options
 * @param {boolean}   options.isAutoMode
 * @param {object}    options.skillHotbar          — useSkillHotbar 반환값
 * @param {React.Ref} options.playerRef
 * @param {React.Ref} options.selectedTargetIdRef  — stale closure 방지용 ref
 * @param {React.Ref} options.monstersRef
 * @param {Function}  options.addProjectile
 */
export const useSkillRotation = ({
  isAutoMode,
  skillHotbar,
  playerRef,
  selectedTargetIdRef,
  monstersRef,
  addProjectile,
}) => {
  useFrame(() => {
    if (!isAutoMode || !playerRef.current || !skillHotbar) return;

    const targetId = selectedTargetIdRef.current;
    if (!targetId) return;

    const { slots, canUse, useSkill } = skillHotbar;
    const player = playerRef.current;
    const monster = monstersRef.current?.[targetId];
    if (!monster || monster.state === 'dead' || monster.hp <= 0) return;

    const px = player.position.x;
    const pz = player.position.z;
    const mx = monster.position.x;
    const mz = monster.position.z;
    const distSq = (px - mx) ** 2 + (pz - mz) ** 2;

    for (let i = 0; i <= 2; i++) {
      const skillId = slots[i];
      if (!skillId) continue;
      const skill = SKILL_CATALOG[skillId];
      if (!skill || skill.type === 'aoe_self') continue;

      const range = skill.range ?? 30;
      if (distSq > range * range) continue;
      if (!canUse(i)) continue;

      const fired = useSkill(i);
      if (!fired) continue;

      // 타겟 방향으로 회전 후 발사
      player.rotation.y = Math.atan2(mx - px, mz - pz);
      const startPos = { x: px, y: player.position.y + 1.5, z: pz };
      const playerRot = player.rotation.y;

      if (skill.type === 'target') {
        addProjectile({
          type: skillId,
          startPos,
          targetPos: { x: mx, y: 1.5, z: mz },
          targetMonsterId: String(targetId),
        });
      } else if (skill.type === 'spread') {
        addProjectile({ type: skillId, startPos, playerRot, side: 'left' });
        addProjectile({ type: skillId, startPos, playerRot, side: 'right' });
      } else if (skill.type === 'linear') {
        addProjectile({ type: skillId, startPos, playerRot });
      }
    }
  });
};
