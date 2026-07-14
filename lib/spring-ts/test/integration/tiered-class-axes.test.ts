/**
 * test/integration/tiered-class-axes.test.ts
 *
 * Contract for κ (class-axes.ts): coarsen a person's FeatureVector +
 * SajuCompatibility into the generated classId, matching the manifest format,
 * and return null (→ base fallback) when a class axis is unresolvable.
 *
 * Run: npm run test:tiered-class-axes
 */
import { computeClassId, nameEffectFrom } from '../../src/report/tiered/class-axes.js';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, ev?: string): void {
  if (cond) { pass += 1; console.log(`  PASS ${label}`); }
  else { fail += 1; console.log(`  FAIL ${label}${ev ? ` (${ev})` : ''}`); }
}

function feat(over: Record<string, unknown>): any {
  return { dayMasterStrength: 'BALANCED', gyeokguk: 'jeongjaegyeok', gender: 'neutral', ...over };
}

console.log('κ class-axes\n');

// strength coarsening + family + non-sensitive gender 'x'
check('강약 STRONG→strong, 재격→jaeseong, 비민감분야 gender=x',
  computeClassId('wealth', 'thisYear', 'adult', 'high',
    feat({ dayMasterStrength: 'STRONG', gyeokguk: 'jeongjaegyeok' }), { yongshinMatchCount: 2, gishinMatchCount: 0 } as any)
  === 'wealth.thisYear.adult.high.strong.jaeseong.boost_strong.x',
  computeClassId('wealth', 'thisYear', 'adult', 'high', feat({ dayMasterStrength: 'STRONG', gyeokguk: 'jeongjaegyeok' }), { yongshinMatchCount: 2, gishinMatchCount: 0 } as any) ?? 'null');

check('EXTREME_WEAK→weak, 정인격→inseong, boost_mild(y=1)',
  computeClassId('health', 'today', 'adult', 'low',
    feat({ dayMasterStrength: 'EXTREME_WEAK', gyeokguk: 'jeongingyeok' }), { yongshinMatchCount: 1, gishinMatchCount: 0 } as any)
  === 'health.today.adult.low.weak.inseong.boost_mild.x');

check('종격→special, neutral(y=0,g=0)',
  computeClassId('overall', 'life', 'adult', 'any',
    feat({ dayMasterStrength: 'BALANCED', gyeokguk: 'jonggyeok' }), { yongshinMatchCount: 0, gishinMatchCount: 0 } as any)
  === 'overall.life.adult.any.balanced.special.neutral.x');

// gender-sensitive category carries male/female
check('romance + male → gender=male',
  computeClassId('romance', 'thisYear', 'adult', 'mid',
    feat({ dayMasterStrength: 'STRONG', gyeokguk: 'jeonggwangyeok', gender: 'male' }), { yongshinMatchCount: 2, gishinMatchCount: 0 } as any)
  === 'romance.thisYear.adult.mid.strong.gwanseong.boost_strong.male');

// adverse: name feeds 기신 more than 용신 (harmful name)
check('adverse: gishin>yongshin → nameEffect adverse',
  computeClassId('family', 'thisYear', 'adult', 'high',
    feat({ dayMasterStrength: 'WEAK', gyeokguk: 'bigyeongyeok', gender: 'female' }), { yongshinMatchCount: 0, gishinMatchCount: 2 } as any)
  === 'family.thisYear.adult.high.weak.bigeop.adverse.female');

// 감사 B4: 건록/양인/월겁 → bigeop family (기존 코퍼스를 폴백 없이 그대로 탄다)
check('건록격→bigeop (감사 B4 — κ 폴백 방지 가드)',
  computeClassId('wealth', 'thisYear', 'adult', 'high',
    feat({ dayMasterStrength: 'STRONG', gyeokguk: 'geonrokgyeok' }), { yongshinMatchCount: 2, gishinMatchCount: 0 } as any)
  === 'wealth.thisYear.adult.high.strong.bigeop.boost_strong.x');
check('월겁격→bigeop (감사 B4)',
  computeClassId('overall', 'life', 'adult', 'any',
    feat({ dayMasterStrength: 'BALANCED', gyeokguk: 'wolgeobgyeok' }), { yongshinMatchCount: 0, gishinMatchCount: 0 } as any)
  === 'overall.life.adult.any.balanced.bigeop.neutral.x');

// fallbacks → null
check('격국 미해석 → null(폴백)',
  computeClassId('wealth', 'thisYear', 'adult', 'high', feat({ gyeokguk: null }), null) === null);
check('성별민감 분야 + neutral 성별 → null(폴백)',
  computeClassId('romance', 'thisYear', 'adult', 'high', feat({ gyeokguk: 'jeongjaegyeok', gender: 'neutral' }), null) === null);

// nameEffectFrom direct
check('nameEffect: compat 없음 → neutral', nameEffectFrom(null) === 'neutral');
check('nameEffect: y=3 → boost_strong', nameEffectFrom({ yongshinMatchCount: 3, gishinMatchCount: 0 } as any) === 'boost_strong');
check('nameEffect: g=1,y=0 → adverse', nameEffectFrom({ yongshinMatchCount: 0, gishinMatchCount: 1 } as any) === 'adverse');

console.log(`\nκ class-axes: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
