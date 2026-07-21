/**
 * name-evidence-run.ts -- 이름 근거 슬롯 파이프라인의 세션 오케스트레이터
 * (chunk-runner.ts 방식: 결정론 접착부만 자동화, 생성은 세션이 담당).
 *
 * 세션 루프:
 *   1) prepare  — 생년월일시+이름 입력 → 엔진 판정 → 필요한 슬롯 도출 →
 *                 저장소에 없는 슬롯만 번들 프롬프트 파일로 스테이징.
 *      npx tsx tools/generation/name-evidence-run.ts prepare --case choi-doyun \
 *          --birth 1986-04-19 --time 05:45 --gender male \
 *          --surname 최=崔 --given 도=都 --given 윤=尹
 *   2) 세션이 각 <bundleKey>.prompt.txt를 읽고 {"slots":[...]}를
 *      <bundleKey>.out.json으로 저장.
 *   3) ingest    — 게이트(정합성 + prose-lint 슬롯 룰) → 번들 단위 zero-reject →
 *                 슬롯 저장소(data/generation/name-evidence/slots/, 커밋 대상) 적재.
 *      … ingest --case choi-doyun --source=regen-ne-pilot1 [--dry] [--commit]
 *   4) assemble  — 저장소에서 판정에 맞는 슬롯을 골라 결정론 조립 → report.md.
 *      … assemble --case choi-doyun
 *
 * 케이스 산출물은 gitignored batches/ 아래: data/generation/batches/name-evidence/<case>/
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');            // lib/spring-ts
const REPO = path.resolve(ROOT, '../..');            // repo root
const DATA_DIR = path.join(REPO, 'namespring/public/data');
const CASES_DIR = path.join(ROOT, 'data/generation/batches/name-evidence');

// ── Node에서 브라우저 지향 sql.js 리포지토리 구동 ──
// seed-ts 리포지토리 런타임은 wasm을 번들 자산(file: URL)에서 SHA-256 검증과
// 함께 직접 읽으므로(repository-runtime.ts) wasm은 손대지 않는다. Node에
// 없는 것은 '/data/*.db' 상대 URL의 fetch뿐이라 그것만 fs로 서빙한다.
function installFetchPatch(): void {
  const originalFetch = globalThis.fetch;
  (globalThis as { fetch: unknown }).fetch = async (url: string | URL | Request, options?: unknown) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
    if (urlStr.startsWith('/data/')) {
      const filePath = path.join(DATA_DIR, urlStr.replace('/data/', ''));
      if (!fs.existsSync(filePath)) return new Response(null, { status: 404, statusText: `Not found: ${filePath}` });
      return new Response(fs.readFileSync(filePath), { status: 200 });
    }
    return (originalFetch as typeof fetch)(url as Parameters<typeof fetch>[0], options as Parameters<typeof fetch>[1]);
  };
}

function assertSajuDistBuilt(): void {
  const dist = path.resolve(ROOT, '../saju-ts/dist/index.js');
  if (!fs.existsSync(dist)) {
    console.error('saju-ts dist가 없습니다 — 사주 판정이 조용히 비활성화됩니다.');
    console.error('빌드: npm --prefix ../saju-ts run build   (lib/spring-ts에서)');
    process.exit(2);
  }
}

// ── 인자 파싱 ────────────────────────────────────────────────────────────────
function flag(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  if (hit) return hit.slice(name.length + 1);
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--') ? process.argv[idx + 1] : undefined;
}
function flagAll(name: string): string[] {
  const out: string[] = [];
  const argv = process.argv;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith(`${name}=`)) out.push(argv[i].slice(name.length + 1));
    else if (argv[i] === name && argv[i + 1] && !argv[i + 1].startsWith('--')) out.push(argv[i + 1]);
  }
  return out;
}

interface CharArg { hangul: string; hanja?: string }
function parseCharArg(raw: string): CharArg {
  const [hangul, hanja] = raw.split('=');
  if (!hangul) throw new Error(`글자 인자 해석 실패: ${raw} (형식: 한글 또는 한글=漢字)`);
  return hanja ? { hangul, hanja } : { hangul };
}

interface CaseFile {
  caseId: string;
  birth: Record<string, unknown>;
  judgments: unknown;
  analysisBlock: string;
  bindings: Record<string, Record<string, string>>;
  bundles: Array<{ bundleKey: string; slotIds: string[]; promptFile: string; outFile: string }>;
  requests: unknown[];
}

const caseDirOf = (caseId: string): string => path.join(CASES_DIR, caseId);
const caseFileOf = (caseId: string): string => path.join(caseDirOf(caseId), 'case.json');

function readCaseFile(caseId: string): CaseFile {
  const f = caseFileOf(caseId);
  if (!fs.existsSync(f)) { console.error(`case.json 없음: ${f} — prepare를 먼저 실행하세요.`); process.exit(2); }
  return JSON.parse(fs.readFileSync(f, 'utf-8')) as CaseFile;
}

// ── prepare ─────────────────────────────────────────────────────────────────
async function prepare(): Promise<void> {
  const caseId = flag('--case');
  const birthStr = flag('--birth');
  const gender = flag('--gender');
  const surnameArgs = flagAll('--surname').map(parseCharArg);
  const givenArgs = flagAll('--given').map(parseCharArg);
  if (!caseId || !birthStr || !gender || !surnameArgs.length || !givenArgs.length) {
    console.error('prepare --case <id> --birth YYYY-MM-DD [--time HH:MM] --gender male|female --surname 최=崔 --given 도=都 [--given 윤=尹]');
    process.exit(2);
  }
  if (!/^[a-z0-9-]+$/u.test(caseId)) { console.error(`--case는 ASCII 소문자/숫자/하이픈만: ${caseId}`); process.exit(2); }

  const m = birthStr.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!m) { console.error(`--birth 형식: YYYY-MM-DD (입력: ${birthStr})`); process.exit(2); }
  const timeStr = flag('--time');
  const t = timeStr?.match(/^(\d{1,2}):(\d{2})$/u) ?? null;
  if (timeStr && !t) { console.error(`--time 형식: HH:MM (입력: ${timeStr})`); process.exit(2); }
  const birth = {
    year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
    hour: t ? Number(t[1]) : null, minute: t ? Number(t[2]) : null,
    gender: gender as 'male' | 'female' | 'neutral',
  };

  assertSajuDistBuilt();
  installFetchPatch();
  // fetch 패치 이후에 로드해야 하므로 dynamic import (정적 import는 호이스팅됨).
  const { SpringEngine } = await import('../../src/spring-engine.js');
  const engine = new SpringEngine();

  const { deriveJudgments, slotRequestsFor, varBindingsFor, buildAnalysisBlock } = await import('./name-evidence-derive.js');
  const { bundleSlotRequests, renderNameEvidencePrompt } = await import('./name-evidence-prompt.js');
  const { loadAllSlots, partitionRequests } = await import('./name-evidence-store.js');

  try {
    const report = await engine.getSpringReport({
      birth,
      surname: surnameArgs,
      givenName: givenArgs,
      options: { precisionConfig: { surfacePhoneticEvidence: true } },
    });

    const judgments = deriveJudgments(report, { birth, targetDate: new Date() });
    const requests = slotRequestsFor(judgments);
    const bindings = varBindingsFor(judgments, requests);
    const analysisBlock = buildAnalysisBlock(judgments);

    const store = loadAllSlots();
    const { found, missing } = partitionRequests(requests, store);
    const bundles = bundleSlotRequests(missing);

    const dir = caseDirOf(caseId);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'analysis.txt'), `${analysisBlock}\n`, 'utf-8');

    const bundleEntries = bundles.map((b) => {
      const promptFile = path.join(dir, `${b.bundleKey}.prompt.txt`);
      fs.writeFileSync(promptFile, renderNameEvidencePrompt(b, analysisBlock), 'utf-8');
      return {
        bundleKey: b.bundleKey,
        slotIds: b.cases.map((c) => c.slotId),
        promptFile,
        outFile: path.join(dir, `${b.bundleKey}.out.json`),
      };
    });

    const caseFile: CaseFile = {
      caseId, birth, judgments,
      analysisBlock,
      bindings: Object.fromEntries(bindings),
      bundles: bundleEntries,
      requests,
    };
    fs.writeFileSync(caseFileOf(caseId), `${JSON.stringify(caseFile, null, 2)}\n`, 'utf-8');

    console.log(`\n[name-evidence] case=${caseId} · ${judgments.nameFull}`);
    console.log(`slots: ${requests.length} required · ${found.length} in store · ${missing.length} missing → ${bundles.length} prompt file(s)`);
    for (const b of bundleEntries) console.log(`  ${b.bundleKey}  (${b.slotIds.length}조각) → ${path.relative(REPO, b.promptFile)}`);
    for (const w of judgments.warnings) console.log(`  ⚠ ${w}`);
    if (bundles.length === 0) {
      console.log('\n모든 슬롯이 저장소에 있습니다. 바로 조립하세요:');
      console.log(`  npx tsx tools/generation/name-evidence-run.ts assemble --case ${caseId}`);
    } else {
      console.log('\nnext: 각 .prompt.txt를 읽고 {"slots":[...]}를 같은 이름의 .out.json으로 저장한 뒤:');
      console.log(`  npx tsx tools/generation/name-evidence-run.ts ingest --case ${caseId} --source=regen-ne-<tag>`);
    }
  } finally {
    engine.close();
  }
}

// ── ingest ──────────────────────────────────────────────────────────────────
async function ingest(): Promise<void> {
  const caseId = flag('--case');
  const source = flag('--source');
  const dry = process.argv.includes('--dry');
  const commit = process.argv.includes('--commit');
  if (!caseId || !source || !source.startsWith('regen-ne-')) {
    console.error('ingest --case <id> --source=regen-ne-<tag> [--dry] [--commit]');
    process.exit(2);
  }
  const caseFile = readCaseFile(caseId);

  const { validateNameEvidenceSlots } = await import('./name-evidence-gates.js');
  const { buildStoredSlot, saveSlot, STORE_DIR } = await import('./name-evidence-store.js');
  const { STEM_BY_TOKEN } = await import('./name-evidence-schema.js');
  type Case = import('./name-evidence-schema.js').NameEvidenceCase;
  const requests = caseFile.requests as Case[];
  const byId = new Map(requests.map((c) => [c.slotId, c]));

  let imported = 0;
  const failed: string[] = [];
  const missingOut: string[] = [];

  for (const b of caseFile.bundles) {
    if (!fs.existsSync(b.outFile)) { missingOut.push(b.bundleKey); continue; }
    let out: unknown;
    try { out = JSON.parse(fs.readFileSync(b.outFile, 'utf-8')); }
    catch { failed.push(b.bundleKey); console.log(`✗ ${b.bundleKey}: JSON 파싱 실패`); continue; }

    const bundleCases = b.slotIds.map((id) => byId.get(id)).filter((c): c is Case => !!c);
    const stemToken = b.bundleKey.match(/^ne\.imagery\.([a-z]+)$/u)?.[1];
    const result = validateNameEvidenceSlots(out, bundleCases, {
      stem: stemToken ? STEM_BY_TOKEN[stemToken] : undefined,
      bundleKey: b.bundleKey,
    });

    for (const v of result.violations) console.log(`  [${b.bundleKey}] ${v}`);
    for (const [id, list] of result.perSlot) for (const v of list) console.log(`  [${id}] ${v}`);
    for (const f of result.proseFindings) console.log(`  [${f.caseId}] ${f.sev} ${f.rule}: ${f.detail}${f.excerpt ? ` ↳ ${f.excerpt}` : ''}`);

    if (!result.ok) { failed.push(b.bundleKey); console.log(`✗ ${b.bundleKey}: 게이트 실패 (번들 단위 재생성 필요)`); continue; }

    if (!dry) {
      const slots = (out as { slots: Array<{ slotId: string; plain: string; expert: string; principle?: string }> }).slots;
      for (const s of slots) {
        const c = byId.get(s.slotId);
        if (!c) continue;
        saveSlot(buildStoredSlot(c, s, source));
        imported += 1;
      }
    }
    console.log(`✓ ${b.bundleKey}: ${b.slotIds.length}조각 ${dry ? '통과 [dry]' : '적재'}`);
  }

  console.log(`\n==== name-evidence ingest ${dry ? '(dry)' : ''} ====`);
  console.log(`imported: ${imported} · gate-failed: ${failed.length} · out.json 없음: ${missingOut.length}`);
  if (failed.length) console.log(`⚠ 재생성 필요: ${failed.join(', ')}`);
  if (missingOut.length) console.log(`⚠ 미생성: ${missingOut.join(', ')}`);

  if (!dry && imported > 0 && commit) {
    const rel = path.relative(REPO, STORE_DIR).replace(/\\/gu, '/');
    execFileSync('git', ['-C', REPO, 'add', rel], { encoding: 'utf-8' });
    const staged = execFileSync('git', ['-C', REPO, 'status', '--porcelain', '--', rel], { encoding: 'utf-8' }).trim();
    if (staged) {
      execFileSync('git', ['-C', REPO, 'commit', '-q', '-m', `content(name-evidence): import ${imported} slot(s) (${source})`], { encoding: 'utf-8' });
      console.log(`committed: ${imported} slot(s) under ${rel}`);
    } else console.log('nothing new to commit');
  }
  if (failed.length || missingOut.length) process.exitCode = 1;
}

// ── assemble ────────────────────────────────────────────────────────────────
async function assemble(): Promise<void> {
  const caseId = flag('--case');
  if (!caseId) { console.error('assemble --case <id>'); process.exit(2); }
  const caseFile = readCaseFile(caseId);

  const { assembleReport, renderReviewMarkdown } = await import('./name-evidence-assemble.js');
  const { loadAllSlots } = await import('./name-evidence-store.js');
  type Judgments = import('./name-evidence-derive.js').NameEvidenceJudgments;

  const judgments = caseFile.judgments as Judgments;
  const bindings = new Map(Object.entries(caseFile.bindings));
  const store = loadAllSlots();
  const report = assembleReport(judgments, store, bindings);
  const md = renderReviewMarkdown(judgments, report, caseFile.analysisBlock);

  const outFile = path.join(caseDirOf(caseId), 'report.md');
  fs.writeFileSync(outFile, `${md}\n`, 'utf-8');
  console.log(`report → ${path.relative(REPO, outFile)}`);
  console.log(`sections: ${report.sections.length} · used: ${report.usedSlotIds.length} · missing: ${report.missingSlotIds.length}`);
  if (report.missingSlotIds.length) {
    console.log(`⚠ 결측 슬롯 (prepare→생성→ingest 필요): ${report.missingSlotIds.join(', ')}`);
    process.exitCode = 1;
  }
}

// ── main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === 'prepare') return prepare();
  if (cmd === 'ingest') return ingest();
  if (cmd === 'assemble') return assemble();
  console.error('usage: name-evidence-run.ts prepare|ingest|assemble (각 명령의 인자는 파일 머리 주석 참고)');
  process.exit(2);
}
void main();
