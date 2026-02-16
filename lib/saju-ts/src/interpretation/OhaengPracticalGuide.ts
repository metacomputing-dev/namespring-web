import { Ohaeng } from '../domain/Ohaeng.js';
import rawOhaengPracticalGuides from './data/ohaengPracticalGuides.json';

export interface PracticalGuide {
  readonly element: Ohaeng;
  readonly colors: readonly string[];
  readonly direction: string;
  readonly season: string;
  readonly numbers: readonly number[];
  readonly taste: string;
  readonly organ: string;
  readonly careers: readonly string[];
  readonly dailyTips: readonly string[];
}

interface OhaengPracticalGuideData {
  readonly entries: readonly (readonly [string, PracticalGuide])[];
}

const OHAENG_PRACTICAL_GUIDES = rawOhaengPracticalGuides as unknown as OhaengPracticalGuideData;
const OHAENG_SET: ReadonlySet<Ohaeng> = new Set(Object.values(Ohaeng));

function toOhaeng(raw: string): Ohaeng {
  if (OHAENG_SET.has(raw as Ohaeng)) return raw as Ohaeng;
  throw new Error(`Invalid Ohaeng in ohaengPracticalGuides.json: ${raw}`);
}

const TABLE: ReadonlyMap<Ohaeng, PracticalGuide> = new Map(
  OHAENG_PRACTICAL_GUIDES.entries.map(([element, guide]) => {
    const parsedElement = toOhaeng(element);
    return [parsedElement, { ...guide, element: parsedElement }] as const;
  }),
);

function requireGuide(ohaeng: Ohaeng): PracticalGuide {
  const guide = TABLE.get(ohaeng);
  if (!guide) {
    throw new Error(`Missing OhaengPracticalGuide entry: ${ohaeng}`);
  }
  return guide;
}

export const OhaengPracticalGuide = {
  guide(ohaeng: Ohaeng): PracticalGuide {
    return requireGuide(ohaeng);
  },

  avoidanceNote(gisin: Ohaeng): string {
    const g = requireGuide(gisin);
    return `${g.colors[0]} 계열 색상, ${g.direction}쪽 방향, ${g.taste} 음식의 과다 섭취를 줄이세요.`;
  },
} as const;
