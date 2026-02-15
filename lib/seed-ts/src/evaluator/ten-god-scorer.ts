import type { ElementKey } from './element-cycle.js';
import {
  generates,
  generatedBy,
  controls,
  controlledBy,
  weightedElementAverage,
  clamp,
} from './element-cycle.js';
import type { SajuOutputSummary } from './strength-scorer.js';
import {
  SAJU_TEN_GOD_OVERREPRESENTED_MULT,
  SAJU_TEN_GOD_SCORE_MULTIPLIER,
} from './scoring-constants.js';

type TenGodGroup = 'friend' | 'output' | 'wealth' | 'authority' | 'resource';
const TEN_GOD_GROUPS: TenGodGroup[] = ['friend', 'output', 'wealth', 'authority', 'resource'];

export function groupElement(dayMasterElement: ElementKey, group: TenGodGroup): ElementKey {
  switch (group) {
    case 'friend': return dayMasterElement;
    case 'resource': return generatedBy(dayMasterElement);
    case 'output': return generates(dayMasterElement);
    case 'wealth': return controls(dayMasterElement);
    case 'authority': return controlledBy(dayMasterElement);
  }
}

export function computeTenGodScore(
  rootElementDistribution: Record<ElementKey, number>,
  sajuOutput: SajuOutputSummary | null,
): number {
  const tenGod = sajuOutput?.tenGod;
  const dayMasterElement = sajuOutput?.dayMaster?.element;
  if (!tenGod || !dayMasterElement) return 50;

  const counts = tenGod.groupCounts;
  const total = TEN_GOD_GROUPS.reduce((acc, group) => acc + (counts[group] ?? 0), 0);
  if (total <= 0) return 50;

  const avg = total / TEN_GOD_GROUPS.length;
  const elementWeight: Record<ElementKey, number> = {
    Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0,
  };

  for (const group of TEN_GOD_GROUPS) {
    const count = counts[group] ?? 0;
    const normalizedDelta = (avg - count) / Math.max(avg, 1);
    const targetElement = groupElement(dayMasterElement, group);
    if (normalizedDelta >= 0) {
      elementWeight[targetElement] += normalizedDelta;
    } else {
      elementWeight[targetElement] += normalizedDelta * SAJU_TEN_GOD_OVERREPRESENTED_MULT;
    }
  }

  const affinity = weightedElementAverage(
    rootElementDistribution,
    (element) => clamp(elementWeight[element], -1, 1),
  );
  return clamp(50 + affinity * SAJU_TEN_GOD_SCORE_MULTIPLIER, 0, 100);
}
