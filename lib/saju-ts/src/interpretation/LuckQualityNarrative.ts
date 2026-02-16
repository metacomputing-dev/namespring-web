import { LuckQuality } from '../domain/LuckInteraction.js';

export const LUCK_QUALITY_ADJECTIVE: Readonly<Record<LuckQuality, string>> = {
  [LuckQuality.VERY_FAVORABLE]: '매우 좋은',
  [LuckQuality.FAVORABLE]: '좋은',
  [LuckQuality.NEUTRAL]: '평범한',
  [LuckQuality.UNFAVORABLE]: '주의가 필요한',
  [LuckQuality.VERY_UNFAVORABLE]: '매우 주의가 필요한',
};

export const LUCK_QUALITY_ICON: Readonly<Record<LuckQuality, string>> = {
  [LuckQuality.VERY_FAVORABLE]: '◎',
  [LuckQuality.FAVORABLE]: '○',
  [LuckQuality.NEUTRAL]: '△',
  [LuckQuality.UNFAVORABLE]: '●',
  [LuckQuality.VERY_UNFAVORABLE]: '✕',
};

export const LUCK_QUALITY_MONTH_HIGHLIGHT: Readonly<Record<LuckQuality, string>> = {
  [LuckQuality.VERY_FAVORABLE]: '매우 좋은 달 — 적극적 행동이 좋은 결과를 가져옵니다.',
  [LuckQuality.FAVORABLE]: '좋은 달 — 계획한 일을 실행하기에 적합합니다.',
  [LuckQuality.NEUTRAL]: '평범한 달 — 큰 변화 없이 안정적으로 지냅니다.',
  [LuckQuality.UNFAVORABLE]: '주의가 필요한 달 — 중요한 결정은 미루는 것이 좋습니다.',
  [LuckQuality.VERY_UNFAVORABLE]: '특히 주의 — 건강과 재물에 신중히 대처하세요.',
};

export function isFavorableLuckQuality(quality: LuckQuality): boolean {
  return quality === LuckQuality.VERY_FAVORABLE || quality === LuckQuality.FAVORABLE;
}

export function isUnfavorableLuckQuality(quality: LuckQuality): boolean {
  return quality === LuckQuality.UNFAVORABLE || quality === LuckQuality.VERY_UNFAVORABLE;
}
