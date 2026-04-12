import { useState, useRef, useCallback, useEffect } from 'react';
import { SKILL_CATALOG, DEFAULT_HOTBAR } from '@data/skillCatalog';

const STORAGE_KEY = 'skill_hotbar_slots_v2'; // v2: pyramid_punch 기본 슬롯 제거

/**
 * 스킬 퀵슬롯 상태 관리
 * - 4슬롯 배열 (localStorage 저장)
 * - 슬롯별 쿨다운 추적 (remainingMs)
 * - MP 소모 처리
 */
export const useSkillHotbar = ({ mp, maxMp, onMpChange }) => {
  const [slots, setSlots] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved) && saved.length === 4) return saved;
    } catch (_) {}
    return [...DEFAULT_HOTBAR];
  });

  // 쿨다운: { skillId -> endTimeMs }
  const cooldownEndsRef = useRef({});
  const [cooldownTick, setCooldownTick] = useState(0);
  const rafRef = useRef(null);

  // RAF 루프 — 쿨다운 갱신 (활성 쿨다운이 있을 때만 실행)
  const tickCooldowns = useCallback(() => {
    const now = Date.now();
    const anyActive = Object.values(cooldownEndsRef.current).some(end => end > now);
    if (anyActive) {
      setCooldownTick(t => t + 1);
      rafRef.current = requestAnimationFrame(tickCooldowns);
    } else {
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // localStorage 동기화
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  }, [slots]);

  /** 슬롯에 스킬 교체 */
  const setSlot = useCallback((slotIdx, skillId) => {
    if (slotIdx < 0 || slotIdx > 3) return;
    if (skillId && !SKILL_CATALOG[skillId]) return;
    setSlots(prev => {
      const next = [...prev];
      next[slotIdx] = skillId || null;
      return next;
    });
  }, []);

  /**
   * 스킬 발동 가능 여부 확인
   * @returns {boolean}
   */
  const canUse = useCallback((slotIdx) => {
    const skillId = slots[slotIdx];
    if (!skillId) return false;
    const skill = SKILL_CATALOG[skillId];
    if (!skill) return false;
    const now = Date.now();
    if ((cooldownEndsRef.current[skillId] || 0) > now) return false;
    if (mp !== undefined && mp < skill.mpCost) return false;
    return true;
  }, [slots, mp, cooldownTick]); // cooldownTick 의존: RAF 갱신마다 재평가

  /**
   * 스킬 발동 — 쿨다운 시작 + MP 차감
   * @returns {string|null} 발동된 skillId 또는 null (발동 불가)
   */
  const useSkill = useCallback((slotIdx) => {
    const skillId = slots[slotIdx];
    if (!skillId) return null;
    const skill = SKILL_CATALOG[skillId];
    if (!skill) return null;
    const now = Date.now();
    if ((cooldownEndsRef.current[skillId] || 0) > now) return null;
    if (mp !== undefined && mp < skill.mpCost) return null;

    // 쿨다운 등록
    cooldownEndsRef.current[skillId] = now + skill.cooldownMs;
    // RAF 시작 (없으면)
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(tickCooldowns);
    }

    // MP 차감
    onMpChange?.(prev => Math.max(0, prev - skill.mpCost));

    return skillId;
  }, [slots, mp, tickCooldowns, onMpChange]);

  /** 특정 스킬의 남은 쿨다운 ms (0이면 사용 가능) */
  const getCooldownRemaining = useCallback((skillId) => {
    const end = cooldownEndsRef.current[skillId] || 0;
    return Math.max(0, end - Date.now());
  }, [cooldownTick]); // cooldownTick 의존: RAF 갱신마다 재평가

  /** 슬롯 인덱스 기준 쿨다운 비율 0~1 (1=쿨 중, 0=사용 가능) */
  const getCooldownFraction = useCallback((slotIdx) => {
    const skillId = slots[slotIdx];
    if (!skillId) return 0;
    const skill = SKILL_CATALOG[skillId];
    if (!skill) return 0;
    const remaining = getCooldownRemaining(skillId);
    if (remaining <= 0) return 0;
    return remaining / skill.cooldownMs;
  }, [slots, getCooldownRemaining]);

  return {
    slots,
    setSlot,
    canUse,
    useSkill,
    getCooldownRemaining,
    getCooldownFraction,
  };
};
