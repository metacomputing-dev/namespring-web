// Sanity check: verify renderFragmentParagraphs normalizes particles
// after a tag-label change (e.g., 화 → 불 should propagate 와 → 과).
import { renderFragmentParagraphs } from '../../src/report/tiered/template-engine.ts';

const ctx: any = {
  seedKey: 'p11-a1-particle-test',
  periodLabel: 'life',
  feature: {
    ageYears: 30,
    agePhaseOrdinal: 2,
    agePhase: 'adult',
    birthSeason: 'summer',
    dayMasterPolarity: 'neutral',
    dayMasterStrength: 'STRONG',
    dayMasterElement: 'wood',
    yongshinElement: 'water',
  },
};

const cases: ReadonlyArray<{ readonly name: string; readonly fragment: any; readonly expectedSubstring: string }> = [
  {
    name: 'fire+water balance with batchim',
    fragment: {
      fragmentId: 'test-1',
      axis: { category: 'health', period: 'life', depth: 'expert' },
      gating: {},
      templateTokens: [
        { kind: 'text', value: '균형 흐름은 ' },
        { kind: 'tag', tagId: 'fire', label: '불' },
        { kind: 'text', value: '와 ' },
        { kind: 'tag', tagId: 'water', label: '물' },
        { kind: 'text', value: '의 균형이에요.' },
      ],
      tags: ['fire', 'water'],
    },
    expectedSubstring: '불과 물의 균형',
  },
  {
    name: 'earth(흙) followed by 가 should stay 이',
    fragment: {
      fragmentId: 'test-2',
      axis: { category: 'health', period: 'life', depth: 'expert' },
      gating: {},
      templateTokens: [
        { kind: 'tag', tagId: 'earth', label: '흙' },
        { kind: 'text', value: '가 든든해요.' },
      ],
      tags: ['earth'],
    },
    expectedSubstring: '흙이 든든해요',
  },
  {
    name: 'ohaengBalance(도) preceded text should pick 를 (no batchim)',
    fragment: {
      fragmentId: 'test-3',
      axis: { category: 'overall', period: 'life', depth: 'expert' },
      gating: {},
      templateTokens: [
        { kind: 'tag', tagId: 'ohaengBalance', label: '오행균형도' },
        { kind: 'text', value: '을 함께 보면 해야 할 일을 정리해요.' },
      ],
      tags: ['ohaengBalance'],
    },
    expectedSubstring: '오행균형도를 함께',
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const ps = renderFragmentParagraphs(c.fragment, ctx);
  const txt = ps.map((p) => p.plainText).join(' ');
  const stripped = txt.replace(/#/g, '');
  const ok = stripped.includes(c.expectedSubstring);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${c.name} :: "${txt}" (stripped: "${stripped}")`);
  if (ok) pass++; else fail++;
}
console.log(`\nResult: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
