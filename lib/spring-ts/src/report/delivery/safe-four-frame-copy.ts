import type { NamingReportFrame } from '../../types.js';

export interface SafeFourFrameCopyV1 {
  readonly headline: string;
  readonly paragraphs: readonly string[];
}

const FRAME_LABELS: Readonly<Record<NamingReportFrame['type'], {
  readonly technical: string;
  readonly plain: string;
}>> = Object.freeze({
  won: {
    technical: '원격',
    plain: '이름 두 글자의 획수 합',
  },
  hyung: {
    technical: '형격',
    plain: '성씨와 이름 첫 글자의 획수 합',
  },
  lee: {
    technical: '이격',
    plain: '성씨와 이름 끝 글자의 획수 합',
  },
  jung: {
    technical: '정격',
    plain: '성명 전체의 획수 합',
  },
});

const ELEMENT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  wood: '목',
  fire: '화',
  earth: '토',
  metal: '금',
  water: '수',
});

function flowLabel(luckyLevel: number): string {
  if (luckyLevel >= 20) return '좋게 보는 조합';
  if (luckyLevel >= 15) return '무난하게 보는 조합';
  if (luckyLevel >= 10) return '좋고 아쉬운 점이 함께 있는 조합';
  return '주의해서 보는 조합';
}

function polarityLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'positive' || normalized === '양' || normalized === '陽') return '양';
  if (normalized === 'negative' || normalized === '음' || normalized === '陰') return '음';
  return '음양 확인 전';
}

/**
 * Public-safe four-frame copy built only from the deterministic calculation.
 * It deliberately does not reuse legacy authored predictions about disease,
 * marriage, age-specific events, or personality.
 */
export function buildSafeFourFrameCopyV1(
  frame: Pick<NamingReportFrame,
    'type' | 'strokeSum' | 'elementLabel' | 'element' | 'polarity' | 'luckyLevel'>,
): SafeFourFrameCopyV1 {
  const label = FRAME_LABELS[frame.type];
  const flow = flowLabel(frame.luckyLevel);
  const element = ELEMENT_LABELS[frame.element.trim().toLowerCase()]
    ?? frame.elementLabel?.trim()
    ?? frame.element.trim()
    ?? '오행 확인 전';
  return Object.freeze({
    headline: flow,
    paragraphs: Object.freeze([
      `${label.plain} · ${frame.strokeSum}획 · ${element} 기운 · ${polarityLabel(frame.polarity)}`,
    ]),
  });
}
