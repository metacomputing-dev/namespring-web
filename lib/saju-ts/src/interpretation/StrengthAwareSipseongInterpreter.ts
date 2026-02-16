import { Sipseong, SIPSEONG_INFO } from '../domain/Sipseong.js';
import { StrengthLevel } from '../domain/StrengthResult.js';
import { createEnumValueParser } from '../domain/EnumValueParser.js';
import rawStrengthAwareReadings from './data/strengthAwareReadings.json';

export enum Favorability {
  FAVORABLE = 'FAVORABLE',
  UNFAVORABLE = 'UNFAVORABLE',
  NEUTRAL = 'NEUTRAL',
}

export const FAVORABILITY_INFO: Record<Favorability, { koreanLabel: string }> = {
  [Favorability.FAVORABLE]: { koreanLabel: '유리' },
  [Favorability.UNFAVORABLE]: { koreanLabel: '불리' },
  [Favorability.NEUTRAL]: { koreanLabel: '중립' },
};

export interface StrengthAwareReading {
  readonly sipseong: Sipseong;
  readonly isStrong: boolean;
  readonly favorability: Favorability;
  readonly commentary: string;
  readonly advice: string;
}

interface StrengthAwareReadingsData {
  readonly rows: readonly (readonly [string, boolean, string, string, string])[];
}

const STRENGTH_AWARE_READINGS = rawStrengthAwareReadings as unknown as StrengthAwareReadingsData;
const toSipseong = createEnumValueParser(
  'Sipseong',
  'StrengthAwareSipseongInterpreter',
  Sipseong,
);
const toFavorability = createEnumValueParser(
  'Favorability',
  'StrengthAwareSipseongInterpreter',
  Favorability,
);
const STRONG_LEVELS: ReadonlySet<StrengthLevel> = new Set([StrengthLevel.VERY_STRONG, StrengthLevel.STRONG]);
const WEAK_LEVELS: ReadonlySet<StrengthLevel> = new Set([StrengthLevel.VERY_WEAK, StrengthLevel.WEAK]);

function readingKey(sipseong: Sipseong, isStrong: boolean): string {
  return `${sipseong}:${isStrong}`;
}

function defaultReading(sipseong: Sipseong, isStrong: boolean): StrengthAwareReading {
  const label = isStrong ? '신강' : '신약';
  return {
    sipseong,
    isStrong,
    favorability: Favorability.NEUTRAL,
    commentary: `${label} 상태에서 ${SIPSEONG_INFO[sipseong].koreanName}가 중립적 영향으로 작용합니다.`,
    advice: '전체 오행의 균형을 종합적으로 고려해 해석해야 합니다.',
  };
}

function neutralReading(sipseong: Sipseong): StrengthAwareReading {
  return {
    sipseong,
    isStrong: false,
    favorability: Favorability.NEUTRAL,
    commentary:
      `${SIPSEONG_INFO[sipseong].koreanName}의 기운이 과하지도 부족하지도 않아 ` +
      '일간 강약이 중화에 가까운 상태입니다. 운의 흐름에 따라 발현이 달라집니다.',
    advice: '현재 균형을 유지하면서 외부 변화에 유연하게 대응하세요.',
  };
}

const TABLE: ReadonlyMap<string, StrengthAwareReading> = new Map(
  STRENGTH_AWARE_READINGS.rows.map(([sipseong, isStrong, favorability, commentary, advice]) => [
    readingKey(toSipseong(sipseong), isStrong),
    {
      sipseong: toSipseong(sipseong),
      isStrong,
      favorability: toFavorability(favorability),
      commentary,
      advice,
    },
  ]),
);

export const StrengthAwareSipseongInterpreter = {
  interpret(sipseong: Sipseong, strengthLevel: StrengthLevel): StrengthAwareReading {
    const isStrong = STRONG_LEVELS.has(strengthLevel);
    const isWeak = WEAK_LEVELS.has(strengthLevel);
    if (!isStrong && !isWeak) return neutralReading(sipseong);
    return TABLE.get(readingKey(sipseong, isStrong)) ?? defaultReading(sipseong, isStrong);
  },
} as const;
