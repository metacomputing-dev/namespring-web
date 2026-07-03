/**
 * test/integration/article-quality-gate.test.ts
 *
 * The article corpus must satisfy docs/ARTICLE_STYLE_CONTRACT.md exactly:
 * zero gate violations, full coverage of every planned
 * (category × period × audience × band) cell. This is the replacement for
 * the retired fragment density/coverage suites — the objective function is
 * final-rendered-text quality, never fragment counts.
 *
 * Run: npm run test:article-gate
 */
import { runArticleQualityGate } from '../../tools/article-quality-gate.js';

const result = runArticleQualityGate();

console.log(`bundles: ${result.bundleCount}, articles: ${result.articleCount}`);

const byRule = new Map<string, number>();
for (const violation of result.violations) {
  byRule.set(violation.rule, (byRule.get(violation.rule) ?? 0) + 1);
}
for (const [rule, count] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  violation ${rule}: ${count}`);
}
for (const violation of result.violations.slice(0, 40)) {
  console.log(`  FAIL [${violation.rule}] ${violation.articleId} — ${violation.detail}`);
}

const EXPECTED_MIN_ARTICLES = 330;
let pass = 0;
let fail = 0;
function check(label: string, cond: boolean): void {
  if (cond) { pass += 1; console.log(`  PASS ${label}`); }
  else { fail += 1; console.log(`  FAIL ${label}`); }
}

check('gate violations == 0', result.violations.length === 0);
check(`article count >= ${EXPECTED_MIN_ARTICLES}`, result.articleCount >= EXPECTED_MIN_ARTICLES);

console.log('---');
console.log(`pass=${pass} fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
