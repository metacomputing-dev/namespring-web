#!/usr/bin/env node
/**
 * tools/check_post_processor_grammar.mjs
 *
 * Phase 15 Agent A1 -- post-processor grammar CI gate.
 *
 * Detects ungrammatical Korean particle output emitted by the
 * `template-engine.ts:reduceOverusedGyeol` post-processor's alternative
 * substitution branch.
 *
 * Root cause (per artifacts/phase14-agent-a5/audit-2026-05-06-phase14.md
 * §A and §C1): when a single text token contains 3+ `결` chars,
 * `reduceOverusedGyeol`'s budget overflow path picks an alternative stem
 * from `['리듬', '자리', '호흡', '걸음']` and concatenates it with the
 * original `결X` particle suffix. Korean phonetics break for several
 * combinations:
 *
 *   - `결로` -> `리듬로`  (wrong; ㅁ-final stem requires `으로`)
 *   - `결로` -> `호흡로`  (wrong; ㅂ-final stem requires `으로`)
 *   - `결로` -> `걸음로`  (wrong; ㅁ-final stem requires `으로`)
 *   - `결을` -> `자리을`  (wrong; vowel-final stem requires `를`)
 *
 * The other alt+particle combinations are phonetically valid (e.g.
 * `결로` -> `자리로` is correct because `자리` ends in vowel ㅣ; `결을`
 * -> `리듬을` / `호흡을` / `걸음을` are correct because the stems
 * end in consonants). Those are NOT flagged.
 *
 * Surface scanned: the post-processed `plainText` strings inside the
 * committed sample artifacts at
 * `artifacts/sample-outputs-2026-05-05-phase3/`. The companion gate
 * `ci:samples-stale` (P13-A3) keeps these samples fresh against the
 * fragment data, so a scan-only design here is sufficient and avoids
 * a redundant generator spawn.
 *
 * Trail format on every violation enables data-fix triage to the
 * source `data/narrative/.../*.fragments.json` template token:
 *   `<file>` `payload.tieredMatrix.periods.<period>.<overall|byCategory.<cat>>.<tier>.paragraphs.<idx>.plainText`
 *
 * Output:
 *   - default: human-readable summary on stdout, exit 1 if violations
 *     exceed `--max-violations` (default 0).
 *   - `--json`: structured JSON report on stdout.
 *
 * Flags:
 *   --json                       structured JSON report
 *   --max-violations=N           threshold above which the gate fails
 *                                (default: 0 -- any violation fails)
 *   --max-samples=N              cap printed/JSON samples (default: 50)
 *   --root=<path>                override spring-ts root (defaults to
 *                                the directory two levels above this
 *                                script)
 *   --samples-dir=<path>         override samples directory
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SAMPLES_REL = 'artifacts/sample-outputs-2026-05-05-phase3';

/**
 * Curated rule set, derived from the four `reduceOverusedGyeol`
 * alternative stems × Korean particle phonetics. Each entry encodes the
 * ungrammatical surface and the expected grammatical replacement.
 *
 * The rules are intentionally narrow: only the alt+particle pairs that
 * Korean phonetics rejects are listed. Adding a phonetically valid
 * pair (e.g. `자리로`, `리듬을`) here would produce false positives.
 *
 * Phase 19 (P19-A2) extension — compound `연결X` post-processor leak class.
 * Documented in `artifacts/phase18-agent-a5/audit-2026-05-07-phase18.md` §A:
 * the `GYEOL_SUBS` table in `src/report/tiered/template-engine.ts` rewrites
 * `결X` particle suffixes globally, so any `[가-힣]결X` compound (esp. the
 * common noun `연결` "connection") gets mangled — `연결을` → `연흐름을`,
 * `연결로` → `연리듬로`, etc.
 *
 * P19-A2 adds two pattern families to the gate:
 *
 *   1. **Source-side** `연결[을이로의에과도만]`: any `연결+조사` form
 *      surviving in the rendered output. The `(?<![가-힣])` lookbehind
 *      excludes hangul-prefixed compounds where `연결` is itself a
 *      sub-morpheme (e.g. an unrelated 4+ char compound), keeping the
 *      detector focused on the bare-noun form that triggers the leak.
 *      Verb forms like `연결되어`, `연결하여` are not on the particle list
 *      and remain unflagged by design.
 *
 *   2. **Sink-side** `연흐름|연리듬|연자리|연호흡|연걸음`: the post-
 *      processor's mutated output when the source `연결X` particle
 *      gets rewritten. P18-A5 caught these via measure-only tooling;
 *      P19-A2 promotes them to the production ratchet so any future
 *      regression at either the source data or engine layer fails the
 *      gate. The `(?<![가-힣])` lookbehind keeps us from flagging
 *      hypothetical `[가-힣]연흐름` compounds that happen to contain
 *      these substrings as a tail.
 *
 * The compound patterns coexist with — and are independent of — the
 * 4 single-token rules above. Both families are scanned via the same
 * `walkPlainText` traversal (post-processed user-visible surface);
 * the sink-side rules catch any GYEOL_SUBS leak even if a future src-
 * side patch (e.g. P19-A3 lookbehind) covers the engine layer, and
 * the source-side rules catch any 연결+조사 that the engine fix
 * declines to mutate yet still emits unchanged.
 */
const GRAMMAR_RULES = [
  {
    id: 'alt_ro_after_consonant_final_stem',
    pattern: /리듬로/g,
    expected: '리듬으로',
    description: 'ㅁ-final stem requires 으로, not 로',
  },
  {
    id: 'alt_ro_after_consonant_final_stem',
    pattern: /호흡로/g,
    expected: '호흡으로',
    description: 'ㅂ-final stem requires 으로, not 로',
  },
  {
    id: 'alt_ro_after_consonant_final_stem',
    pattern: /걸음로/g,
    expected: '걸음으로',
    description: 'ㅁ-final stem requires 으로, not 로',
  },
  {
    id: 'alt_eul_after_vowel_final_stem',
    pattern: /자리을/g,
    expected: '자리를',
    description: 'vowel-final stem requires 를, not 을',
  },
  // P19-A2: compound `연결X` source-side patterns. Each particle form
  // collides with `GYEOL_SUBS` at character level when `결` is the
  // second hangul of the noun `연결`. Verb forms (연결되어/연결하여)
  // are excluded — this list covers only postpositional particles.
  {
    id: 'compound_yeongyeol_particle_source',
    pattern: /(?<![가-힣])연결을/g,
    expected: '연결고리를 (or other 연결 rephrase)',
    description: 'compound 연결 + 을 collides with GYEOL_SUBS — reword source data',
  },
  {
    id: 'compound_yeongyeol_particle_source',
    pattern: /(?<![가-힣])연결이/g,
    expected: '연결고리가 (or other 연결 rephrase)',
    description: 'compound 연결 + 이 collides with GYEOL_SUBS — reword source data',
  },
  {
    id: 'compound_yeongyeol_particle_source',
    pattern: /(?<![가-힣])연결로/g,
    expected: '연결고리로 (or other 연결 rephrase)',
    description: 'compound 연결 + 로 collides with GYEOL_SUBS — reword source data',
  },
  {
    id: 'compound_yeongyeol_particle_source',
    pattern: /(?<![가-힣])연결의/g,
    expected: '연결고리의 (or other 연결 rephrase)',
    description: 'compound 연결 + 의 collides with GYEOL_SUBS — reword source data',
  },
  {
    id: 'compound_yeongyeol_particle_source',
    pattern: /(?<![가-힣])연결에/g,
    expected: '연결고리에 (or other 연결 rephrase)',
    description: 'compound 연결 + 에 collides with GYEOL_SUBS — reword source data',
  },
  {
    id: 'compound_yeongyeol_particle_source',
    pattern: /(?<![가-힣])연결과/g,
    expected: '연결고리와 (or other 연결 rephrase)',
    description: 'compound 연결 + 과 collides with GYEOL_SUBS — reword source data',
  },
  {
    id: 'compound_yeongyeol_particle_source',
    pattern: /(?<![가-힣])연결도/g,
    expected: '연결고리도 (or other 연결 rephrase)',
    description: 'compound 연결 + 도 collides with GYEOL_SUBS — reword source data',
  },
  {
    id: 'compound_yeongyeol_particle_source',
    pattern: /(?<![가-힣])연결만/g,
    expected: '연결고리만 (or other 연결 rephrase)',
    description: 'compound 연결 + 만 collides with GYEOL_SUBS — reword source data',
  },
  // P19-A2: compound post-processor leak sink-side patterns. These are
  // the GYEOL_SUBS-mutated forms — broken Korean. P18-A5 caught them
  // via measure-only tooling; promoted here to the production ratchet.
  {
    id: 'compound_yeongyeol_post_processor_leak',
    pattern: /(?<![가-힣])연흐름/g,
    expected: '연결고리 (rephrase source 연결)',
    description: 'GYEOL_SUBS leak: 연결+조사 mutated to 연흐름 — broken Korean',
  },
  {
    id: 'compound_yeongyeol_post_processor_leak',
    pattern: /(?<![가-힣])연리듬/g,
    expected: '연결고리 (rephrase source 연결)',
    description: 'GYEOL_SUBS leak: 연결+조사 mutated to 연리듬 — broken Korean',
  },
  {
    id: 'compound_yeongyeol_post_processor_leak',
    pattern: /(?<![가-힣])연자리/g,
    expected: '연결고리 (rephrase source 연결)',
    description: 'GYEOL_SUBS leak: 연결+조사 mutated to 연자리 — broken Korean',
  },
  {
    id: 'compound_yeongyeol_post_processor_leak',
    pattern: /(?<![가-힣])연호흡/g,
    expected: '연결고리 (rephrase source 연결)',
    description: 'GYEOL_SUBS leak: 연결+조사 mutated to 연호흡 — broken Korean',
  },
  {
    id: 'compound_yeongyeol_post_processor_leak',
    pattern: /(?<![가-힣])연걸음/g,
    expected: '연결고리 (rephrase source 연결)',
    description: 'GYEOL_SUBS leak: 연결+조사 mutated to 연걸음 — broken Korean',
  },
];

function parseArgs(argv) {
  const args = {
    json: false,
    maxViolations: 0,
    maxSamples: 50,
    root: DEFAULT_ROOT,
    samplesDir: null,
  };
  for (const arg of argv) {
    if (arg === '--json') {
      args.json = true;
    } else if (arg.startsWith('--max-violations=')) {
      const value = Number(arg.slice('--max-violations='.length));
      if (Number.isInteger(value) && value >= 0) args.maxViolations = value;
    } else if (arg.startsWith('--max-samples=')) {
      const value = Number(arg.slice('--max-samples='.length));
      if (Number.isInteger(value) && value >= 0) args.maxSamples = value;
    } else if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
    } else if (arg.startsWith('--samples-dir=')) {
      args.samplesDir = path.resolve(arg.slice('--samples-dir='.length));
    }
  }
  return args;
}

function listSampleFiles(samplesDir) {
  if (!fs.existsSync(samplesDir)) return [];
  return fs
    .readdirSync(samplesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('-tiered.json'))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Walk the parsed JSON tree yielding only `plainText` string leaves.
 *
 * Scanning `plainText` exclusively is intentional:
 *   1. `plainText` is the post-processed user-visible surface. Any
 *      grammar defect that survives to here is a real production bug.
 *   2. Sibling `templateTokens[].value` strings are the pre-processor
 *      input and would double-count the same defect.
 *   3. `headline` / `hook` strings are not affected by the
 *      `reduceOverusedGyeol` alternative-pick branch (brief tier
 *      reverses `흐름X -> 결X` via `compressBriefHeadlineIfApplicable`,
 *      not via the alt branch).
 */
function* walkPlainText(node, trail = []) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      yield* walkPlainText(node[i], [...trail, String(i)]);
    }
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'plainText' && typeof value === 'string') {
      yield { trail: [...trail, key], text: value };
      continue;
    }
    yield* walkPlainText(value, [...trail, key]);
  }
}

function buildReport({ root, samplesDir, maxSamples }) {
  const resolvedSamplesDir = samplesDir ?? path.join(root, DEFAULT_SAMPLES_REL);
  const inputErrors = [];
  if (!fs.existsSync(resolvedSamplesDir)) {
    inputErrors.push({
      code: 'samples_dir_missing',
      message: `samples directory does not exist: ${resolvedSamplesDir}`,
    });
  }
  if (inputErrors.length > 0) {
    return {
      status: 'ERROR',
      policy: 'spring-ts.post-processor-grammar.v1',
      inputErrors,
      filesScanned: 0,
      totalViolations: 0,
      ruleCounts: {},
      samples: [],
    };
  }

  const files = listSampleFiles(resolvedSamplesDir);
  const violations = [];
  const ruleCounts = {};
  for (const rule of GRAMMAR_RULES) {
    ruleCounts[rule.pattern.source] = 0;
  }
  let filesScanned = 0;

  for (const file of files) {
    const fullPath = path.join(resolvedSamplesDir, file);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    } catch {
      continue;
    }
    filesScanned += 1;
    for (const item of walkPlainText(data)) {
      for (const rule of GRAMMAR_RULES) {
        // Reset stateful regex between calls.
        rule.pattern.lastIndex = 0;
        let match;
        while ((match = rule.pattern.exec(item.text)) !== null) {
          ruleCounts[rule.pattern.source] += 1;
          violations.push({
            ruleId: rule.id,
            file,
            trail: item.trail.join('.'),
            match: match[0],
            expected: rule.expected,
            description: rule.description,
            text: item.text,
          });
          if (rule.pattern.lastIndex === match.index) {
            // Defensive guard against zero-width matches; not expected
            // for these literal patterns but keeps the loop bounded.
            rule.pattern.lastIndex += 1;
          }
        }
      }
    }
  }

  return {
    policy: 'spring-ts.post-processor-grammar.v1',
    samplesDir: path.relative(root, resolvedSamplesDir).replaceAll(path.sep, '/'),
    filesScanned,
    totalViolations: violations.length,
    ruleCounts,
    samples: violations.slice(0, maxSamples),
  };
}

function renderHuman(report, maxViolations) {
  const lines = [];
  if (report.status === 'ERROR') {
    lines.push(`Post-processor grammar gate: input error`);
    for (const err of report.inputErrors) {
      lines.push(`  ${err.code}: ${err.message}`);
    }
    return lines.join('\n');
  }
  lines.push(
    `Post-processor grammar: filesScanned=${report.filesScanned}, ` +
      `violations=${report.totalViolations} (max=${maxViolations})`,
  );
  for (const [pattern, count] of Object.entries(report.ruleCounts)) {
    lines.push(`  ${pattern}: ${count}`);
  }
  if (report.samples.length > 0) {
    lines.push('');
    lines.push('Samples (up to maxSamples):');
    for (const sample of report.samples) {
      lines.push(`- [${sample.ruleId}] ${sample.file}`);
      lines.push(`    trail=${sample.trail}`);
      lines.push(`    match="${sample.match}" expected="${sample.expected}" (${sample.description})`);
      lines.push(`    text="${sample.text}"`);
    }
  }
  return lines.join('\n');
}

const args = parseArgs(process.argv.slice(2));
const report = buildReport({
  root: args.root,
  samplesDir: args.samplesDir,
  maxSamples: args.maxSamples,
});

if (args.json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(renderHuman(report, args.maxViolations));
}

if (report.status === 'ERROR') {
  process.exit(1);
}

const failed = report.totalViolations > args.maxViolations;
if (failed) {
  console.error(
    `Post-processor grammar: ${report.totalViolations} violation(s) exceed ` +
      `--max-violations=${args.maxViolations}`,
  );
  process.exit(1);
}

export { buildReport, renderHuman, GRAMMAR_RULES };
