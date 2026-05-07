// Probe candidate gating profiles for new hook fragments
// Maps each candidate to the fixtures it would match.
//
// NOTE: per-fixture `birthSeason` values below are calendar quarters
// (months 3-5 = spring, etc.) and do NOT match the engine's
// `toSeason()` in src/report/tiered/feature-selector.ts (months 2-4
// = spring, 5-7 = summer, 8-10 = autumn, 11-1 = winter; lichun-aligned).
// Two of the original fragments authored from this projection were
// dormant; both were corrected to use the engine's mapping. See
// audit-2026-05-07.md §Methodology #9 for the post-mortem.

const fixtures = [
  ['02-choi-seongsoo', 'male', '40-54', 'spring', 9],
  ['04-kim-seoyun', 'female', '10-19', 'summer', 1],
  ['05-park-minji', 'female', '30-39', 'autumn', 15],
  ['06-lee-hajun', 'neutral', '20-29', 'winter', 13],
  ['08-kim-jiwon', 'female', '30-39', 'autumn', 10],
  ['09-kim-seongsu', 'male', '55-69', 'summer', 16],
  ['10-choi-yaza', 'male', '30-39', 'summer', 16],
  ['11-park-jeolgi', 'female', '30-39', 'summer', 11],
  ['12-jeong', 'male', '40-54', 'spring', 15],
  ['13-oh', 'female', '40-54', 'autumn', 17],
  ['14-choi-palace', 'male', '40-54', 'spring', 9],
  ['15-choi-consensus', 'male', '40-54', 'spring', 13],
  ['16-choi-senior', 'male', '70+', 'spring', 9],
  ['17-kim-senior', 'female', '70+', 'summer', 13],
  ['18-lee-child', 'male', '0-9', 'summer', 3],
  ['19-gyeokguk-jb', 'male', '40-54', 'spring', 7],
  ['20-gyeokguk-cw', 'female', '40-54', 'winter', 11],
  ['21-multi-axis', 'male', '40-54', 'spring', 13],
  ['22-low-conf', 'female', '30-39', 'winter', 12],
  ['23-jonggyeok-jw', 'male', '70+', 'summer', 15],
  ['24-jonggyeok-jj', 'male', '40-54', 'summer', 14],
  ['25-jonggyeok-jg', 'male', '70+', 'autumn', 10],
  ['26-jonggyeok-js', 'male', '40-54', 'winter', 13],
  ['27-jonggyeok-jh', 'male', '0-9', 'summer', 3],
  ['28-jonggyeok-jg', 'male', '70+', 'summer', 16],
  ['29-pure-hangul', 'female', '30-39', 'spring', 15],
  ['30-jeolgi-lidong', 'male', '0-9', 'autumn', 3],
  ['31-newborn', 'male', '0-9', 'spring', 3],
  ['32-nona', 'male', '70+', 'winter', 15],
  ['33-consensus-aware', 'female', '30-39', 'autumn', 16],
  ['34-multi-conf', 'male', '40-54', 'summer', 9],
  ['35-palace-naeum', 'female', '30-39', 'spring', 9],
];

// Selected 12 candidates after probe-list review
const candidates = [
  { name: '01.wealth.today  male.70plus.winter', g: { gender: ['male'], ageBand: ['70+'], birthSeason: ['winter'] } },
  { name: '02.wealth.thisWeek  female.young', g: { gender: ['female'], ageBand: ['10-19'] } },
  { name: '03.health.life  male.young', g: { gender: ['male'], ageBand: ['0-9'] } },
  { name: '04.health_stress.today  female.70plus.summer', g: { gender: ['female'], ageBand: ['70+'], birthSeason: ['summer'] } },
  { name: '05.health_stress.thisYear  female.thirties.winter', g: { gender: ['female'], ageBand: ['30-39'], birthSeason: ['winter'] } },
  { name: '06.health_stress.life  male.midlife.winter', g: { gender: ['male'], ageBand: ['40-54'], birthSeason: ['winter'] } },
  { name: '07.romance.today  male.70plus.autumn', g: { gender: ['male'], ageBand: ['70+'], birthSeason: ['autumn'] } },
  { name: '08.romance.thisWeek  female.thirties.winter', g: { gender: ['female'], ageBand: ['30-39'], birthSeason: ['winter'] } },
  { name: '09.academic.thisMonth  male.70plus.autumn', g: { gender: ['male'], ageBand: ['70+'], birthSeason: ['autumn'] } },
  { name: '10.academic.life  female.70plus.summer', g: { gender: ['female'], ageBand: ['70+'], birthSeason: ['summer'] } },
  { name: '11.study_document.thisMonth  male.midlife.winter', g: { gender: ['male'], ageBand: ['40-54'], birthSeason: ['winter'] } },
  { name: '12.expression_children.life  male.young', g: { gender: ['male'], ageBand: ['0-9'] } },
];

// Cumulative simulation
const counts = new Map(fixtures.map((f) => [f[0], f[4]]));
for (const c of candidates) {
  const matched = fixtures.filter(([n, g, ab, bs]) => {
    if (c.g.gender && !c.g.gender.includes(g)) return false;
    if (c.g.ageBand && !c.g.ageBand.includes(ab)) return false;
    if (c.g.birthSeason && !c.g.birthSeason.includes(bs)) return false;
    return true;
  });
  if (matched.length === 0) {
    console.log(c.name, 'NO HITS — would be dormant!');
    continue;
  }
  const fixIds = matched.map((m) => m[0]).join(', ');
  console.log(c.name, '->', matched.length, 'hits:', fixIds);
  for (const m of matched) {
    counts.set(m[0], counts.get(m[0]) + 1);
  }
}

console.log('--- Final per-fixture distinct hooks (after +12) ---');
const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
for (const [n, c] of sorted) console.log(c.toString().padStart(2), n);
const max = Math.max(...counts.values());
const median = ((arr) => {
  const s = arr.slice().sort((a, b) => a - b);
  return s.length % 2 === 1 ? s[(s.length - 1) >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
})([...counts.values()]);
console.log('max:', max, 'median:', median);
