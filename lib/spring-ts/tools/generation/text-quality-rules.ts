/**
 * text-quality-rules.ts -- Principled text-defect + diversity rules for
 * generated articles (PR1, docs/PLAN_PR1_GENERATED_TEXT_QUALITY.md §4).
 *
 * Two layers:
 *  1. validatePlainTextQuality(article)  -- one article, all tiers. Catches
 *     mechanical Korean defects (josa harmony, run-on sentences, formal
 *     fragments), leaked code identifiers / spec constants, and BURNED
 *     phrases (fine Korean, but stamped into 15k~20k files of the 2026-07
 *     corpus and therefore permanently retired).
 *  2. bundleDiversityViolations(articles) -- one BUNDLE (all cells one person
 *     sees in a category: periods × bands sharing 강약·격국·nameEffect·성별).
 *     Catches duplicate summaries/paragraphs/tips and n-gram stamping across
 *     sibling cells. Wired in ingest-bundles.ts.
 *
 * These complement validate-generated.ts (schema, register, jargon, pairing);
 * both hard-reject at ingest so a template-stamped corpus can never re-enter.
 */

export interface GeneratedTextLike {
  readonly articleId?: string;
  readonly summary?: string;
  readonly hook?: string;
  readonly body?: readonly string[];
  readonly expert?: readonly string[];
  readonly livingTips?: readonly string[];
  readonly cautions?: readonly string[];
}

export interface TextQualityViolation {
  readonly rule: string;
  readonly detail: string;
  readonly articleId?: string;
  /** Bundle rules: the sibling cells involved (first = the one to keep). */
  readonly caseIds?: readonly string[];
}

export interface BundleArticleLike {
  readonly caseId: string;
  readonly summary: string;
  readonly body?: readonly string[];
  readonly expert?: readonly string[];
  readonly livingTips?: readonly string[];
}

// ── Burned phrases ──────────────────────────────────────────────────────────
// Each entry was measured in ≥~5,000 of the 21,060 files of the 2026-07
// stamped corpus (see plan §1). They are banned OUTRIGHT in new generation:
// not because the Korean is bad, but because they are burned by repetition.
export const BURNED_PHRASES: readonly string[] = [
  '차분히 다질', '차분히 다져', '작게 다질',            // summary/body frame ×19,778
  '작은 기준',                                          // ×20,484
  '오늘의 첫걸음',                                      // ×19,224
  '손에 잡히는 장면',                                   // ×5,489
  '기운을 타고난 결이',                                 // body opener stamp ×17,737
  '한 번에 크게 밀기보다',                              // ×7,651
  '다시 돌아올 곳이 생겨요',
  '너무 많은 일을 한꺼번에',
  '한 가지 기준이 분명해지면',
  '기회가 비교적 잘 살아나는',
  '천천히 정리할 때 좋아요',
  '해당 영역',                                          // template filler ×5,158
  '믿을 만한 사람에게 물어보기',                        // tip ×15,139
];

// Expert-tier process/meta language: the writer explaining the pairing
// instead of giving grounds. '평문' is a product-internal term.
export const BURNED_EXPERT_PHRASES: readonly string[] = [
  '평문에서',
  '요약과 본문을 맞췄',
  '글로 풀었어요',
];

// Manifest spec constants that the stamped corpus pasted verbatim.
const SPEC_CONSTANT_FRAGMENTS: readonly string[] = [
  '전략이 맞음',
  '이름 밖 생활 보완 권장',
];

// Retired summary frames (the entire stamped corpus converges on these).
const GENERIC_SUMMARY_FRAMES: readonly RegExp[] = [
  /(차분히|작게) (다질 때 좋아요|다져요)\.?$/u,
  /작은 기준부터 (세울 때|익히는 편이) 좋아요\.?$/u,
  /천천히 정리할 때 좋아요\.?$/u,
];

// Domain nouns used by the stamped corpus to "personalize" one skeleton.
const DOMAIN_WORDS: readonly string[] = [
  '전체 흐름', '돈 관리', '몸과 마음', '공부 흐름', '관계와 마음', '가족 관계',
  '진로 감각', '기록과 준비', '표현과 창의력', '긴장과 회복', '이동과 변화',
];

// vowel+을 sequences that are legitimate words, NOT a broken josa:
// nouns (가을/마을/노을) and ㅅ-불규칙 verb relative forms (짓다→지을 —
// includes compounds like 매듭지을). Tradeoff: a genuine "공부을" error also
// ends in 부+을 and is forgiven; acceptable because regenerated text is
// LLM-written (조사 errors there are rare) while false rejections are costly.
const VOWEL_EUL_ALLOWED: readonly string[] = [
  '가을', '마을', '노을',
  '지을', '이을', '나을', '부을', '그을', '저을',
  '모을', // 모으다 관형형("마음을 모을 수"), not an object 을 after a vowel-final noun
];

// ── helpers ────────────────────────────────────────────────────────────────

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

/** Replace runtime slots / expert tags with opaque placeholders so rules
 * never fire on slot innards and stamped n-grams still collapse together. */
function maskSlots(value: string): string {
  return value.replace(/\{\{[^{}]*\}\}/gu, '□').replace(/#\{[^{}]*\}/gu, '△');
}

function hasBatchim(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

function isHangulSyllable(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0xac00 && code <= 0xd7a3;
}

/** Sentence split on real punctuation only (run-ons are caught separately). */
function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+/u).map((s) => s.trim()).filter(Boolean);
}

const HAEYO_ENDING = /[요죠][.!?…"'」)\]]*$/u;

/** Sentence-final endings of 해요체 (two-syllable, to avoid nouns like 필요). */
const RUNON_PATTERN =
  /(에요|예요|어요|아요|여요|해요|돼요|와요|워요|봐요|줘요|세요|네요|든요|까요|나요|져요|이죠|지요|죠) (그래서|그리고|하지만|그런데|그러니|그래도|따라서|그러면)/u;

// ── skeleton (for stamp detection across sibling cells) ────────────────────

export function summarySkeleton(summary: string): string {
  let out = maskSlots(normalizeSpaces(summary))
    .replace(/(여린|고른|단단한) (편|힘|결|기운)/gu, '<s> $2');
  for (const word of DOMAIN_WORDS) out = out.split(word).join('<d>');
  // The josa after a swapped domain word varies with its batchim — normalize
  // it too, so "가족 관계는…" and "공부 흐름은…" collapse to one skeleton.
  return out.replace(/<d>(은|는|이|가|을|를|과|와|도)/gu, '<d><j>');
}

// ── layer 1: one article, all tiers ────────────────────────────────────────

interface TierText {
  readonly tier: 'summary' | 'hook' | 'body' | 'expert' | 'tip' | 'caution';
  readonly text: string;
}

function tierTexts(a: GeneratedTextLike): TierText[] {
  const out: TierText[] = [];
  if (a.summary) out.push({ tier: 'summary', text: a.summary });
  if (a.hook) out.push({ tier: 'hook', text: a.hook });
  for (const p of a.body ?? []) out.push({ tier: 'body', text: p });
  for (const p of a.expert ?? []) out.push({ tier: 'expert', text: p });
  for (const t of a.livingTips ?? []) out.push({ tier: 'tip', text: t });
  for (const t of a.cautions ?? []) out.push({ tier: 'caution', text: t });
  return out;
}

export function validatePlainTextQuality(article: GeneratedTextLike): readonly TextQualityViolation[] {
  const violations: TextQualityViolation[] = [];
  const articleId = article.articleId;
  const push = (rule: string, detail: string): void => {
    violations.push({ rule, detail, articleId });
  };

  for (const { tier, text } of tierTexts(article)) {
    const masked = maskSlots(normalizeSpaces(text));

    // josa-after-paren: ")" + single-char josa must agree with the batchim of
    // the syllable before ")". e.g. "…겁재격)는" → 격 has batchim → 은.
    for (const m of masked.matchAll(/([가-힣])\)(은|는|이|가|을|를|과|와)(?=[\s.,!?…]|$)/gu)) {
      const closed = hasBatchim(m[1]);
      const josa = m[2];
      const wantsBatchim = josa === '은' || josa === '이' || josa === '을' || josa === '과';
      if (closed !== wantsBatchim) push('josa-after-paren', `…${m[1]})${josa}`);
    }

    // josa-vowel-harmony: 을 after a vowel-final syllable (→를) and 를 after a
    // batchim-final syllable (→을), as a standalone particle at a word end.
    for (const m of masked.matchAll(/([가-힣])(을|를)(?=[\s.,!?…]|$)/gu)) {
      const prev = m[1];
      if (!isHangulSyllable(prev)) continue;
      if (m[2] === '을' && !hasBatchim(prev)) {
        if (!VOWEL_EUL_ALLOWED.includes(`${prev}을`)) push('josa-vowel-harmony', `…${prev}을`);
      } else if (m[2] === '를' && hasBatchim(prev)) {
        push('josa-vowel-harmony', `…${prev}를`);
      }
    }

    // missing-period-runon: sentence ending glued to a conjunction by a space.
    const runon = masked.match(RUNON_PATTERN);
    if (runon) push('missing-period-runon', `[${tier}] …${runon[0]}…`);

    // code-identifier: latin identifiers outside slots/tags (allows 2-3 char
    // uppercase abbreviations like SNS/TV).
    for (const m of masked.matchAll(/[A-Za-z][A-Za-z0-9_]*/gu)) {
      const word = m[0];
      if (word.length >= 4 || /[a-z]/u.test(word)) push('code-identifier', `[${tier}] ${word}`);
    }

    // spec-constant-verbatim
    for (const frag of SPEC_CONSTANT_FRAGMENTS) {
      if (masked.includes(frag)) push('spec-constant-verbatim', `[${tier}] ${frag}`);
    }

    // formal-fragment: body/expert/caution sentences must end 해요체. Catches
    // "…나를 세우는 구조. 주체적으로 밀고 나가는 전략이 맞음." fragments.
    if (tier === 'body' || tier === 'expert' || tier === 'caution') {
      for (const sentence of splitSentences(masked)) {
        const bare = sentence.replace(/["'」)\]□△]+$/u, '').trim();
        if (!bare) continue;
        if (!HAEYO_ENDING.test(bare)) push('formal-fragment', `[${tier}] …${bare.slice(-24)}`);
      }
    }

    // burned-phrase (all tiers) + expert meta language.
    for (const phrase of BURNED_PHRASES) {
      if (masked.includes(phrase)) push('burned-phrase', `[${tier}] ${phrase}`);
    }
    if (tier === 'expert') {
      for (const phrase of BURNED_EXPERT_PHRASES) {
        if (masked.includes(phrase)) push('burned-expert-meta', phrase);
      }
    }
  }

  // generic-summary-frame
  const summary = normalizeSpaces(article.summary ?? '');
  if (summary && GENERIC_SUMMARY_FRAMES.some((p) => p.test(summary))) {
    push('generic-summary-frame', summary);
  }

  return violations;
}

// ── cross-bundle: adjacent bundles must not share paragraphs ────────────────
// Different agents given near-identical case specs converge on the same
// sentences (observed in wave 1: identical cautions/expert across 격국
// variants). One person never sees two bundles of a category, but a user
// comparing NAME CANDIDATES sees adjacent nameEffect bundles — exact
// paragraph reuse across bundles reads as copy-paste.

/** Normalized paragraph key (slots masked) for the cross-bundle index. */
export function paragraphKey(paragraph: string): string {
  return maskSlots(normalizeSpaces(paragraph));
}

/** period·band key from a caseId like `academic.today.adult.high.balanced…`. */
export function bandKeyOf(caseId: string): string {
  const p = caseId.split('.');
  return `${p[1] ?? ''}.${p[3] ?? ''}`;
}
/** bundle (person) key from a caseId — drop period(1) and band(3). */
export function bundleKeyFromCaseId(caseId: string): string {
  const p = caseId.split('.');
  return [p[0], p[2], p[4], p[5], p[6], p[7]].filter((x) => x !== undefined).join('.');
}
/** char-shingle set for fuzzy near-duplicate detection (exact-match misses 95%
 *  similar cards that differ only by a word — e.g. "것은"↔"건"). */
export function shingleSet(text: string, k = 5): Set<string> {
  const t = maskSlots(normalizeSpaces(text)).replace(/[\s.,!?…·—''""()\-]/gu, '');
  const s = new Set<string>();
  for (let i = 0; i + k <= t.length; i += 1) s.add(t.slice(i, i + k));
  return s;
}
function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}
const NEAR_DUP_THRESHOLD = 0.82;

export interface CrossBundleIndex {
  /** paragraphKey → first owning caseId (regen articles already on disk). */
  readonly paragraphs: ReadonlyMap<string, string>;
  /** normalized livingTip → the bundle keys using it (over-reuse across bundles). */
  readonly tips?: ReadonlyMap<string, ReadonlySet<string>>;
  /** normalized caution → the bundle keys using it. */
  readonly cautions?: ReadonlyMap<string, ReadonlySet<string>>;
  /** period·band → [{caseId, body shingles}] for fuzzy near-dup across 격국. */
  readonly bandBodies?: ReadonlyMap<string, ReadonlyArray<{ caseId: string; sh: ReadonlySet<string> }>>;
}

export function crossBundleDuplicateViolations(
  article: GeneratedTextLike & { readonly caseId?: string },
  index: CrossBundleIndex,
): readonly TextQualityViolation[] {
  const violations: TextQualityViolation[] = [];
  const self = article.caseId ?? article.articleId ?? '';
  // exact body/expert paragraph reuse across bundles
  for (const p of [...(article.body ?? []), ...(article.expert ?? [])]) {
    const key = paragraphKey(p);
    if (key.length < 20) continue;
    const owner = index.paragraphs.get(key);
    if (owner && owner !== self) {
      violations.push({ rule: 'cross-bundle-duplicate-paragraph', detail: `"${key.slice(0, 40)}…" already in ${owner}`, articleId: self, caseIds: [owner] });
    }
  }
  // over-reused tip: an identical tip already used by ≥2 OTHER bundles (this
  //  makes it the 3rd+). Some overlap is fine; global uniqueness is infeasible.
  const selfBundle = bundleKeyFromCaseId(self);
  for (const t of article.livingTips ?? []) {
    const key = normalizeSpaces(t);
    if (key.length < 6) continue;
    const others = [...(index.tips?.get(key) ?? [])].filter((b) => b !== selfBundle);
    if (others.length >= 2) violations.push({ rule: 'cross-bundle-overused-tip', detail: `"${key.slice(0, 28)}…" in ${others.length + 1}+ bundles`, articleId: self, caseIds: others.slice(0, 2) });
  }
  for (const c of article.cautions ?? []) {
    const key = normalizeSpaces(c);
    if (key.length < 8) continue;
    const others = [...(index.cautions?.get(key) ?? [])].filter((b) => b !== selfBundle);
    if (others.length >= 2) violations.push({ rule: 'cross-bundle-overused-caution', detail: `"${key.slice(0, 28)}…" in ${others.length + 1}+ bundles`, articleId: self, caseIds: others.slice(0, 2) });
  }
  // fuzzy near-duplicate body vs another 격국's same period·band card
  if (index.bandBodies && self && (article.body ?? []).length) {
    const sh = shingleSet((article.body ?? []).join(' '));
    for (const other of index.bandBodies.get(bandKeyOf(self)) ?? []) {
      if (other.caseId === self) continue;
      const sim = jaccard(sh, other.sh);
      if (sim >= NEAR_DUP_THRESHOLD) {
        violations.push({ rule: 'cross-bundle-near-duplicate', detail: `body ${Math.round(sim * 100)}% ~ ${other.caseId}`, articleId: self, caseIds: [other.caseId] });
        break;
      }
    }
  }
  return violations;
}

// ── layer 2: bundle (sibling cells one person sees together) ───────────────

const NGRAM_LEN = 12;
/** A normalized 12-gram shared by ≥ this many sibling cells = stamping. */
const NGRAM_MAX_CELLS = 3;

function ngramText(a: BundleArticleLike): string {
  return maskSlots([...(a.body ?? []), ...(a.expert ?? [])].join(' '))
    .replace(/[\s.,!?…·—''""()\-]/gu, '');
}

export function bundleDiversityViolations(
  articles: readonly BundleArticleLike[],
): readonly TextQualityViolation[] {
  const violations: TextQualityViolation[] = [];
  if (articles.length < 2) return violations;

  // 1) summary exact duplicates (0 tolerated) + skeleton repetition (≤2).
  const exact = new Map<string, string[]>();
  const skeletons = new Map<string, string[]>();
  for (const a of articles) {
    const s = normalizeSpaces(a.summary);
    if (!s) continue;
    exact.set(s, [...(exact.get(s) ?? []), a.caseId]);
    const sk = summarySkeleton(s);
    skeletons.set(sk, [...(skeletons.get(sk) ?? []), a.caseId]);
  }
  for (const [s, ids] of exact) {
    if (ids.length > 1) {
      violations.push({ rule: 'bundle-duplicate-summary', detail: `${ids.length}× "${s}"`, caseIds: ids });
    }
  }
  for (const [sk, ids] of skeletons) {
    if (ids.length > 2) {
      violations.push({ rule: 'bundle-summary-skeleton', detail: `${ids.length}× skeleton "${sk}"`, caseIds: ids });
    }
  }

  // 2) body/expert paragraph exact duplicates across the bundle (0 tolerated).
  const paragraphs = new Map<string, string[]>();
  for (const a of articles) {
    for (const p of [...(a.body ?? []), ...(a.expert ?? [])]) {
      const key = maskSlots(normalizeSpaces(p));
      if (key.length < 20) continue;
      paragraphs.set(key, [...(paragraphs.get(key) ?? []), a.caseId]);
    }
  }
  for (const [p, ids] of paragraphs) {
    if (ids.length > 1) {
      violations.push({
        rule: 'bundle-duplicate-paragraph',
        detail: `${ids.length}× "${p.slice(0, 40)}…"`,
        caseIds: ids,
      });
    }
  }

  // 3) n-gram stamping: a normalized 12-gram present in ≥4 sibling cells.
  const gramCells = new Map<string, Set<string>>();
  for (const a of articles) {
    const text = ngramText(a);
    const seen = new Set<string>();
    for (let i = 0; i + NGRAM_LEN <= text.length; i += 1) {
      const g = text.slice(i, i + NGRAM_LEN);
      if (seen.has(g)) continue;
      seen.add(g);
      const cells = gramCells.get(g) ?? new Set<string>();
      cells.add(a.caseId);
      gramCells.set(g, cells);
    }
  }
  const offenders = [...gramCells.entries()]
    .filter(([, cells]) => cells.size > NGRAM_MAX_CELLS)
    .sort((a, b) => b[1].size - a[1].size);
  // Adjacent grams of one stamped run all trip the rule — report a de-overlapped sample.
  const reported: string[] = [];
  for (const [gram, cells] of offenders) {
    if (reported.some((r) => r.includes(gram.slice(0, 6)) || gram.includes(r.slice(0, 6)))) continue;
    reported.push(gram);
    violations.push({ rule: 'bundle-ngram-stamp', detail: `"${gram}" in ${cells.size} cells`, caseIds: [...cells] });
    if (reported.length >= 5) break;
  }

  // 4) identical livingTip in ≥3 cells.
  const tipCells = new Map<string, Set<string>>();
  for (const a of articles) {
    for (const t of a.livingTips ?? []) {
      const key = normalizeSpaces(t);
      const cells = tipCells.get(key) ?? new Set<string>();
      cells.add(a.caseId);
      tipCells.set(key, cells);
    }
  }
  for (const [t, cells] of tipCells) {
    if (cells.size > 2) {
      violations.push({ rule: 'bundle-duplicate-tip', detail: `"${t}" in ${cells.size} cells`, caseIds: [...cells] });
    }
  }

  // 5) decorative-motif overuse: one non-core word dominating the whole bundle's
  //    plain text (a single scene domain crowding out the reading — measured
  //    "좋아하는"×79, "책상"×37 when a bundle was pinned to one material palette).
  const plain = maskSlots(articles.map((a) => [a.summary, ...(a.body ?? []), ...(a.livingTips ?? [])].join(' ')).join(' '));
  const wordCount = new Map<string, number>();
  for (const m of plain.matchAll(/[가-힣]{2,5}/gu)) {
    const w = m[0];
    if (MOTIF_STOPWORDS.has(w)) continue;
    wordCount.set(w, (wordCount.get(w) ?? 0) + 1);
  }
  for (const [w, n] of wordCount) {
    if (n > MOTIF_MAX_PER_BUNDLE) {
      violations.push({ rule: 'bundle-motif-overuse', detail: `"${w}" ${n}× (>${MOTIF_MAX_PER_BUNDLE})`, caseIds: articles.map((a) => a.caseId) });
    }
  }

  return violations;
}

const MOTIF_MAX_PER_BUNDLE = 30;
// study-core + function words that legitimately recur across 15 cards; only a
// non-core word exceeding the cap signals a decorative motif dominating.
const MOTIF_STOPWORDS: ReadonlySet<string> = new Set([
  '오늘', '이번', '올해', '하루', '한번', '공부', '과목', '문제', '자료', '시간', '범위', '대목',
  '정리', '복습', '진도', '계획', '마감', '강의', '시험', '기출', '제출', '노트', '필기', '방식',
  '기운', '이름', '자리', '구조', '배치', '정도', '생각', '으로', '에서', '있어', '없어', '정해',
  '조금', '바로', '다시', '오래', '편이', '때문', '만큼', '수록', '에는', '이라', '처럼', '같은',
  '하고', '해서', '되는', '같이', '한쪽', '한다', '한다면', '두면', '두고', '보면', '주는', '주면',
  '기복', '균형', '무난', '안정', '흐름', '리듬', '페이스', '한 편', '요일', '단원', '개념',
]);
