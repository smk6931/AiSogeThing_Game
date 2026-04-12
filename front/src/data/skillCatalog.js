/**
 * 스킬 카탈로그 — 단일 진실 소스
 * 백엔드 back/player/services/service.py의 SKILL_CATALOG와 동기화 유지
 */
export const SKILL_CATALOG = {
  magic_orb: {
    icon: '🔮',
    nameKo: '마법 구체',
    mpCost: 10,
    cooldownMs: 1200,
    type: 'target',
    damage: 10,
    mult: 1.0,
    range: 30,
    desc: '타겟 추적 마법 구체',
    levelReq: 1,
  },
  pyramid_punch: {
    icon: '👊',
    nameKo: '피라미드 펀치',
    mpCost: 5,
    cooldownMs: 800,
    type: 'spread',
    damage: 8,
    mult: 0.8,
    range: 20,
    desc: '분열하는 펀치 파동',
    levelReq: 1,
  },
  lightning_bolt: {
    icon: '⚡',
    nameKo: '번개 화살',
    mpCost: 15,
    cooldownMs: 2000,
    type: 'linear',
    damage: 20,
    mult: 1.2,
    range: 50,
    desc: '직선 고속 관통 번개 (2개 관통)',
    levelReq: 3,
  },
  frost_nova: {
    icon: '❄️',
    nameKo: '프로스트 노바',
    mpCost: 25,
    cooldownMs: 5000,
    type: 'aoe_self',
    damage: 15,
    mult: 0.9,
    range: 8,
    desc: '주변 8m AoE 빙결 폭발',
    levelReq: 5,
  },
};

/** 기본 퀵슬롯 배치 (피라미드 펀치는 패널에서 드래그로 배치 가능) */
export const DEFAULT_HOTBAR = ['magic_orb', 'lightning_bolt', 'frost_nova', null];

/** 퀵슬롯 키 바인딩 */
export const HOTBAR_KEYS = ['Q', 'E', 'R', 'F'];
