/**
 * test/integration/tiered-fragment-selector.test.ts
 *
 * Guards selector semantics that make authored branch coverage useful:
 * when a specific fragment and a wildcard both match, the specific branch
 * should win before deterministic variant selection is applied.
 */
import { selectFragment } from '../../src/report/tiered/fragment-selector.js';
import type { FragmentRegistry, NarrativeFragment } from '../../src/report/tiered/fragment-registry.js';

const sourceTier = {
  tier: 'T1_HYPOTHESIS',
  sourceType: 'training_derived',
  sourceUrl: null,
  accessedAt: '2026-05-02',
  quoteShort: null,
  humanInterpretation: 'Selector test fixture.',
  copyrightNote: 'No source prose copied; original test fixture.',
  authorityTruthEligible: false,
};

function fragment(fragmentId: string, gating: NarrativeFragment['gating']): NarrativeFragment {
  return {
    schemaVersion: 'spring-ts.narrative-fragment.v1',
    fragmentId,
    axis: { category: 'overall', period: 'life', depth: 'brief' },
    gating,
    templateTokens: [{ kind: 'text', value: fragmentId }],
    tags: [],
    aiGenerated: true,
    sourceTier,
  };
}

function registry(fragments: readonly NarrativeFragment[]): FragmentRegistry {
  return {
    get() { return fragments; },
    totalFragmentCount: fragments.length,
    contentSource: 'authored',
  };
}

const feature = {
  gender: 'male',
  agePhase: 'early_40s',
  ageBand: '40-54',
  currentSeason: 'spring',
  birthSeason: 'spring',
  dayMasterPolarity: 'YANG',
  dayMasterStrength: 'WEAK',
  yongshinAlignment: 'neutral',
  dayMasterElement: 'WATER',
  yongshinElement: 'METAL',
  gyeokguk: 'bigyeongyeok',
} as any;

let pass = 0;
let fail = 0;

function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

console.log('Tiered fragment selector\n');

const specificityRegistry = registry([
  fragment('overall.life.brief.wildcard.001', {}),
  fragment('overall.life.brief.wildcard.002', {}),
  fragment('overall.life.brief.agephase.001', { agePhase: ['early_40s'] }),
]);

const selectedIds = Array.from({ length: 20 }, (_, i) =>
  selectFragment(specificityRegistry, 'overall', 'life', 'brief', feature, { seedKey: `seed-${i}` })?.fragmentId);

check('specific matching fragment wins over wildcard variants',
  selectedIds.every((id) => id === 'overall.life.brief.agephase.001'),
  selectedIds.join(','));

const fallbackRegistry = registry([
  fragment('overall.life.brief.gender_relaxed.001', {
    gender: ['female'],
    agePhase: ['early_40s'],
    dayMasterStrength: ['WEAK'],
  }),
]);
const fallback = selectFragment(fallbackRegistry, 'overall', 'life', 'brief', feature, { seedKey: 'fallback' });

check('fallback chain can still relax a mismatched leftmost dimension',
  fallback?.fragmentId === 'overall.life.brief.gender_relaxed.001',
  fallback?.fragmentId);

console.log(`\nTiered fragment selector: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
