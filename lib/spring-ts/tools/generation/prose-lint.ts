/**
 * prose-lint.ts -- naturalness / awkwardness linter for generated report prose.
 *
 * Complements the hard gate (validate-generated.ts). The gate checks schema,
 * length, register, honesty, stamping and motif caps; it does NOT catch the
 * "reads awkward to a native speaker" layer surfaced by human proofreading
 * (2026-07-15, docs/qa/proofread-chunk1-matrix-0715.md): residual similes,
 * collocation errors, exposed jargon, loanword leftovers, and over-repeated
 * plain-word clusters that the de-metaphor rewrite introduced.
 *
 * Run (session):
 *   npx tsx tools/generation/prose-lint.ts [dir]
 *     dir defaults to data/generation/batches/chunk (the *.out.json chunk)
 *   flags: --warn-as-error  (exit 1 on WARN too)  --json  (machine output)
 *
 * Exit code 1 when any ERROR finding exists (0 otherwise) so it can gate CI.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { IMAGERY_FORBIDDEN_RE, IMAGERY_GROUP, STEM_BY_TOKEN } from './name-evidence-schema.js';
import type { ImageryGroup, Stem } from './name-evidence-schema.js';

export type Sev = 'ERROR' | 'WARN';
export interface Finding { sev: Sev; rule: string; detail: string; file: string; caseId: string; field: string; excerpt?: string; }

const cp = (s: string): number => [...s].length;
const PROSE_FIELDS = ['summary', 'hook', 'body', 'expert', 'livingTips', 'cautions'] as const;
// general tier = everything the lay reader sees as plain text (expert is the jargon-tolerant tier)
const GENERAL_FIELDS = new Set(['summary', 'hook', 'body', 'livingTips', 'cautions']);

export interface TextRule { rule: string; re: RegExp; sev: Sev; detail: string; only?: 'general' | 'expert' | 'slot' }

/** Per-article ERROR/WARN rules: a regex over one prose string.
 *  `only: 'slot'` rules apply ONLY to name-evidence slot fragments
 *  (lintSlotBundle) — the article loop skips them. */
export const TEXT_RULES: TextRule[] = [
  // -- clear errors (A-category) --
  { rule: 'simile', sev: 'ERROR', re: /[가-힣]하듯|[가-힣]듯이/u, detail: '직유(~하듯/~듯이) — item22 금지, 직서로' },
  { rule: 'spacing-received', sev: 'ERROR', re: /받아 들[이여]/u, detail: '"받아들이다" 붙여쓰기' },
  { rule: 'nonstandard-binji', sev: 'ERROR', re: /빈지/u, detail: '"빈지" → "비었는지"' },
  { rule: 'wordform-mankeum', sev: 'ERROR', re: /최소한만큼/u, detail: '"최소한만큼은" 어형 오류 → "최소한은"' },
  { rule: 'collocation-geuret', sev: 'ERROR', re: /그릇[이가][^.!?]{0,8}넓/u, detail: '그릇+넓다 연어 오류 → "커지다"' },
  { rule: 'collocation-dukkeop', sev: 'ERROR', re: /두껍게 이해/u, detail: '이해+두껍게 연어 오류 → "깊이 이해"' },
  { rule: 'collocation-jogeon-neom', sev: 'ERROR', re: /넘을 조건|조건을 넘|못 넘긴 조건/u, detail: '조건+넘다 연어 오류(조건은 충족·맞추다)' },
  { rule: 'logic-panjeong', sev: 'ERROR', re: /판정 기준만 맞[춰추]/u, detail: '"판정 기준만 맞춰 두다" — 못 푼 문제에 채점잣대? 의미 붕괴' },
  { rule: 'banned-loanword', sev: 'ERROR', re: /세션|마일스톤|스텝|커리큘럼|포트폴리오|루틴/u, detail: '외래어(item22 금지) — 쉬운 우리말로' },
  { rule: 'banned-metaphor', sev: 'ERROR', re: /완주|딴 데로 새/u, detail: '걷기/은유 잔재(item22 금지)' },
  { rule: 'jargon-jawon', sev: 'ERROR', re: /자원오행/u, only: 'general', detail: '전문어 노출(일반 tier) → "이름이 주는 기운"' },
  // -- softer (WARN) --
  { rule: 'nominalization-slip', sev: 'WARN', re: /미끄러짐/u, detail: '어색한 명사화 → "흔한 실수"' },
  { rule: 'loanword-soft', sev: 'WARN', re: /컨디션|챕터|페이스|(?<![가-힣])파트(?![가-힣])/u, detail: '외래어 → 몸 상태/단원/속도/부분' },
  { rule: 'jargon-jawon-expert', sev: 'WARN', re: /자원오행/u, only: 'expert', detail: '전문어(expert tier) — 풀어 쓰면 더 좋음' },
  { rule: 'simile-bare-deut', sev: 'WARN', re: /[가-힣]듯(?![이한])\b/u, detail: '~듯 직유 가능성 — 검토' },
  { rule: 'walk-metaphor', sev: 'WARN', re: /밟아 가|밟아 갈|안정된 걸음|중간 걸음/u, detail: '걷기 은유 잔재 검토' },
  // -- name-evidence slot-only rules (조립 규칙 §4.4, design §6) --
  { rule: 'slot-leading-conjunction', sev: 'ERROR', only: 'slot',
    re: /^(그래서|그러나|또한|이처럼|한편|따라서|결국|정리하면)/u,
    detail: '조각이 접속사로 시작 — 조립 시 문맥 붕괴' },
  { rule: 'slot-cross-reference', sev: 'ERROR', only: 'slot',
    // '앞의 쇠'처럼 이름 글자의 위치를 가리키는 표현은 정당하므로, 담화(조각·
    // 문단·설명)를 가리키는 참조만 잡는다.
    re: /앞서|위에서 (말|본)|방금 |이러한 점에서|앞의 (조각|문단|글|설명|내용)/u,
    detail: '다른 조각 참조 — 조각은 자립해야 함' },
  { rule: 'slot-summarizing', sev: 'ERROR', only: 'slot',
    re: /종합하면|정리하자면|결론적으로/u,
    detail: '맺음 문형 — 맺음은 S9 역할(closing)만, 그마저 이 표현 없이' },
  { rule: 'slot-stroke-arithmetic', sev: 'ERROR', only: 'slot',
    re: /\d+\s*획\s*[+＋]|획을 더하/u,
    detail: '획수 산식 서술 금지 — 격 이름·길흉·시기 의미만' },
  { rule: 'slot-school-claim', sev: 'ERROR', only: 'slot',
    re: /운해본|해례본/u,
    detail: '발음오행 유파 단정 금지(D-2) — 고지는 analysis/푸터에서만' },
  { rule: 'slot-double-hedge', sev: 'WARN', only: 'slot',
    re: /쯤 있는 셈|정도인 셈|쯤 되는 셈/u,
    detail: "'쯤'+'셈' 이중 얼버무림 — 하나만 남기거나 직설로" },
  { rule: 'slot-plural-deul', sev: 'WARN', only: 'slot',
    re: /소리들|자리들|시기들|글자들|기운들/u,
    detail: "복수 '-들' 남용 — 집합 단수로 (소리는/자리는/시기는)" },
];

/** 물상 혼입 검사 (§6.1): 이 번들의 일간이 아닌 그룹의 물상 어휘 → ERROR. */
export function imageryMismatchRule(stem: Stem): TextRule {
  const own = IMAGERY_GROUP[stem];
  const forbidden = (Object.entries(IMAGERY_FORBIDDEN_RE) as Array<[ImageryGroup, string]>)
    .filter(([group]) => group !== own)
    .map(([, re]) => re)
    .join('|');
  return {
    rule: 'slot-imagery-mismatch', sev: 'ERROR', only: 'slot',
    re: new RegExp(forbidden, 'u'),
    detail: `일간 ${stem}(${own}) 번들에 다른 물상 어휘 혼입 — 비유는 이 번들의 물상 하나로`,
  };
}

/** Per-bundle cluster rules: count occurrences of `re` across the whole bundle;
 *  flag when count > max. Catches the "de-metaphor created new over-used words"
 *  and template-formula problems the gate's exact/shingle checks miss. */
const CLUSTER_RULES: Array<{ rule: string; re: RegExp; max: number; detail: string }> = [
  { rule: 'cluster-datda', re: /닫(으|을|고|는|혀|힌|게|아)/gu, max: 20, detail: '"닫다(=끝맺다)" 은유 과다 → 마무리/끝맺다와 분산' },
  { rule: 'cluster-dewuda', re: /데[우워]/gu, max: 22, detail: '"데우다(=받쳐주다)" 은유 과다 → 받쳐 주다와 분산' },
  { rule: 'cluster-omgida', re: /옮[기겨]/gu, max: 18, detail: '"옮기다(=적다)" 은유 과다 → 적다/정리하다' },
  { rule: 'cluster-eonda', re: /얹/gu, max: 22, detail: '"얹다" 과다 → 더하다/배치하다/살아나다' },
  { rule: 'name-effect-formula', re: /이름이 [가-힣]{1,4} 주는/gu, max: 8, detail: '"이름이 ~ 주는 [명사]" 이름효과 공식 반복 → 문형 다양화' },
  { rule: 'balance-descriptor', re: /(치우치지|쏠리지|몰리지|기울지) ?(않|안 )/gu, max: 8, detail: '중화 설명 동어반복 → 편수 축소' },
  { rule: 'expert-ending-jari', re: /자리예요/gu, max: 6, detail: 'expert 종결 "자리예요" 편중 → 종결어 분산' },
  { rule: 'expert-ending-jogu', re: /구조예요/gu, max: 6, detail: 'expert 종결 "구조예요" 편중' },
  { rule: 'expert-ending-baechi', re: /배치예요/gu, max: 6, detail: 'expert 종결 "배치예요" 편중' },
  { rule: 'hedge-neukkyeojil', re: /느껴질 수 있어요|느껴질 수 있는/gu, max: 4, detail: '도입 상투 헤지 "~느껴질 수 있어요" 도배' },
];

/** Whole-bundle presence rules (flag if present at all). */
const PRESENCE_RULES: Array<{ rule: string; re: RegExp; sev: Sev; detail: string }> = [
  { rule: 'second-person', re: /당신/u, sev: 'WARN', detail: '2인칭 "당신" — 3인칭(분/사람)과 시점 혼용' },
  { rule: 'template-var', re: /\{\{[^}]*\}\}/u, sev: 'WARN', detail: '템플릿 변수 노출 — 렌더는 안전하나 어형 검토(형제편은 하드코딩)' },
];

function collectStrings(article: Record<string, unknown>): Array<{ field: string; text: string }> {
  const out: Array<{ field: string; text: string }> = [];
  for (const f of PROSE_FIELDS) {
    const v = article[f];
    if (v == null) continue;
    const arr = Array.isArray(v) ? v : [v];
    arr.forEach((s, i) => { if (typeof s === 'string') out.push({ field: Array.isArray(v) ? `${f}[${i}]` : f, text: s }); });
  }
  return out;
}

export function lintBundle(file: string, articles: Array<Record<string, unknown>>): Finding[] {
  const base = path.basename(file).replace('.out.json', '');
  const findings: Finding[] = [];
  let bundleText = '';
  for (const a of articles) {
    const caseId = String(a.caseId ?? '(no id)');
    for (const { field, text } of collectStrings(a)) {
      bundleText += text + '\n';
      const isGeneral = GENERAL_FIELDS.has(field.replace(/\[\d+\]$/, ''));
      for (const r of TEXT_RULES) {
        if (r.only === 'slot') continue; // slot rules never apply to articles
        if (r.only === 'general' && !isGeneral) continue;
        if (r.only === 'expert' && isGeneral) continue;
        const m = r.re.exec(text);
        if (m) findings.push({ sev: r.sev, rule: r.rule, detail: r.detail, file: base, caseId, field, excerpt: excerpt(text, m.index) });
      }
    }
  }
  for (const r of CLUSTER_RULES) {
    const n = (bundleText.match(r.re) ?? []).length;
    if (n > r.max) findings.push({ sev: 'WARN', rule: r.rule, detail: `${r.detail} (${n}회 > ${r.max})`, file: base, caseId: '(bundle)', field: 'all' });
  }
  for (const r of PRESENCE_RULES) {
    const n = (bundleText.match(new RegExp(r.re.source, 'gu')) ?? []).length;
    if (n > 0) findings.push({ sev: r.sev, rule: r.rule, detail: `${r.detail} (${n}회)`, file: base, caseId: '(bundle)', field: 'all' });
  }
  return findings;
}

function excerpt(text: string, at: number): string {
  const s = Math.max(0, at - 12), e = Math.min(text.length, at + 24);
  return (s > 0 ? '…' : '') + text.slice(s, e).replace(/\n/g, ' ') + (e < text.length ? '…' : '');
}

// ── name-evidence slot fragments ({"slots":[...]} out.json) ─────────────────

/** Slot text fields by tier: plain = general, expert/principle = expert. */
const SLOT_FIELDS: Array<{ field: 'plain' | 'expert' | 'principle'; general: boolean }> = [
  { field: 'plain', general: true },
  { field: 'expert', general: false },
  { field: 'principle', general: false },
];

/**
 * Lint name-evidence slot fragments. Applies (a) the tier-scoped general rules,
 * (b) the `only:'slot'` assembly rules to every field, and (c) — when `stem`
 * is given (imagery bundles, `ne.imagery.<stemToken>` filename) — the dynamic
 * imagery-mismatch rule. CLUSTER/PRESENCE article rules are skipped: bundles
 * are tiny and slots legitimately carry {{vars}}.
 */
export function lintSlotBundle(file: string, slots: Array<Record<string, unknown>>, stem?: Stem): Finding[] {
  const base = path.basename(file).replace('.out.json', '');
  const rules: TextRule[] = stem ? [...TEXT_RULES, imageryMismatchRule(stem)] : [...TEXT_RULES];
  const findings: Finding[] = [];
  for (const slot of slots) {
    const slotId = String(slot.slotId ?? '(no id)');
    for (const { field, general } of SLOT_FIELDS) {
      const text = slot[field];
      if (typeof text !== 'string' || !text) continue;
      for (const r of rules) {
        if (r.only === 'general' && !general) continue;
        if (r.only === 'expert' && general) continue;
        const m = r.re.exec(text);
        if (m) findings.push({ sev: r.sev, rule: r.rule, detail: r.detail, file: base, caseId: slotId, field, excerpt: excerpt(text, m.index) });
      }
      if (/당신/u.test(text)) {
        findings.push({ sev: 'ERROR', rule: 'slot-second-person', detail: '2인칭 "당신" 금지 — 3인칭 또는 무주어', file: base, caseId: slotId, field });
      }
    }
  }
  return findings;
}

/** `ne.imagery.<stemToken>[.…]` 파일명에서 일간을 복원 (물상 검사 활성화용). */
export function stemFromBundleFileName(file: string): Stem | undefined {
  const m = path.basename(file).match(/^ne\.imagery\.([a-z]+)\./u);
  return m ? STEM_BY_TOKEN[m[1]] : undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--')) ?? 'data/generation/batches/chunk';
  const warnAsError = args.includes('--warn-as-error');
  const asJson = args.includes('--json');

  const files = fs.existsSync(dir) && fs.statSync(dir).isDirectory()
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.out.json')).map((f) => path.join(dir, f))
    : [dir];
  if (!files.length) { console.error(`prose-lint: no *.out.json in ${dir}`); process.exit(2); }

  const all: Finding[] = [];
  let articleCount = 0;
  for (const file of files) {
    let j: { articles?: Array<Record<string, unknown>>; slots?: Array<Record<string, unknown>> };
    try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { console.error(`skip (bad json): ${file}`); continue; }
    if (Array.isArray(j.slots)) {
      articleCount += j.slots.length;
      all.push(...lintSlotBundle(file, j.slots, stemFromBundleFileName(file)));
      continue;
    }
    const arts = j.articles ?? [];
    articleCount += arts.length;
    all.push(...lintBundle(file, arts));
  }

  if (asJson) { console.log(JSON.stringify(all, null, 2)); process.exit(all.some((f) => f.sev === 'ERROR') ? 1 : 0); }

  const errors = all.filter((f) => f.sev === 'ERROR');
  const warns = all.filter((f) => f.sev === 'WARN');
  console.log(`\n=== prose-lint · ${files.length} bundles / ${articleCount} articles ===`);
  console.log(`ERROR: ${errors.length}  ·  WARN: ${warns.length}\n`);
  const order: Sev[] = ['ERROR', 'WARN'];
  for (const sev of order) {
    const group = all.filter((f) => f.sev === sev);
    if (!group.length) continue;
    console.log(`── ${sev} ──`);
    for (const f of group) {
      console.log(`[${f.rule}] ${f.file} · ${f.caseId.split('.').slice(1).join('.') || f.caseId} · ${f.field}`);
      console.log(`   ${f.detail}${f.excerpt ? `\n   ↳ ${f.excerpt}` : ''}`);
    }
    console.log('');
  }
  if (!all.length) console.log('클린 — 검출된 어색함 없음.');
  const fail = errors.length > 0 || (warnAsError && warns.length > 0);
  process.exit(fail ? 1 : 0);
}

// Entry-guard: run the CLI only when executed directly (`npx tsx
// tools/generation/prose-lint.ts`); importing this module for its rules
// (name-evidence gates) must not trigger a lint run.
const isMain = ((): boolean => {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try { return import.meta.url === pathToFileURL(path.resolve(argv1)).href; } catch { return false; }
})();
if (isMain) main();
