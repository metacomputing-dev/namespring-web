// @ts-nocheck
/**
 * buildPremiumReport.ts -- Premium Saju Report orchestrator
 *
 * Calls all 11 section generators in presentation order and assembles
 * them into a single PremiumSajuReport envelope. Sections that return
 * null (e.g. when prerequisite data is missing) are silently excluded.
 *
 * A deterministic SeededRandom is created from the birth info so that
 * re-generating the same report for the same person produces identical
 * phrasing (template picks, food/hobby samples, etc.).
 */

import type { SajuSummary, BirthInfo, PremiumSajuReport } from './types.js';
import { SeededRandom } from './common/sentenceUtils.js';
import { generateOverallSummary } from './sections/section-overallSummary.js';
import { generateMyPillars } from './sections/section-myPillars.js';
import { generateDayMaster } from './sections/section-dayMaster.js';
import { generateElementBalanceSection } from './sections/section-elementBalance.js';
import { generateGyeokgukYongshinSection } from './sections/section-gyeokgukYongshin.js';
import { generateTenGodPersonalitySection } from './sections/section-tenGodPersonality.js';
import { generateLifeStages } from './sections/section-lifeStages.js';
import { generateInteractions } from './sections/section-interactions.js';
import { generateShinsal } from './sections/section-shinsal.js';
import { generateFortuneCyclesSection } from './sections/section-fortuneCycles.js';
import { generateLifeGuideSection } from './sections/section-lifeGuide.js';

// ---------------------------------------------------------------------------
//  Report builder
// ---------------------------------------------------------------------------

export function buildPremiumSajuReport(
  saju: SajuSummary,
  birth: BirthInfo,
  seed?: number,
): PremiumSajuReport {
  // Create deterministic RNG from birth info (or explicit seed)
  const rng = new SeededRandom(seed ?? computeSeed(birth));

  // All section generators in canonical presentation order.
  // Each returns PremiumReportSection | null; nulls are filtered out.
  const generators = [
    generateOverallSummary,
    generateMyPillars,
    generateDayMaster,
    generateElementBalanceSection,
    generateGyeokgukYongshinSection,
    generateTenGodPersonalitySection,
    generateLifeStages,
    generateInteractions,
    generateShinsal,
    generateFortuneCyclesSection,
    generateLifeGuideSection,
  ];

  const sections = generators
    .map(gen => gen(saju, birth, rng))
    .filter((s): s is NonNullable<typeof s> => s != null);

  return {
    meta: {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
    },
    sections,
  };
}

// ---------------------------------------------------------------------------
//  Seed computation
// ---------------------------------------------------------------------------

/**
 * Derives a deterministic 32-bit seed from birth information using a
 * simple multiplicative hash (djb2 variant). This ensures the same
 * birth inputs always produce the same PRNG sequence.
 */
function computeSeed(birth: BirthInfo): number {
  let hash = 0;
  const parts = [
    birth.year ?? 0,
    birth.month ?? 0,
    birth.day ?? 0,
    birth.hour ?? 0,
    birth.minute ?? 0,
  ];
  for (const part of parts) {
    hash = ((hash << 5) - hash + part) | 0;
  }
  // Ensure a non-zero positive seed; fallback to 42 for all-zero inputs
  return Math.abs(hash) || 42;
}
