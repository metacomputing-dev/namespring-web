/**
 * test/integration/release-checklist.test.ts
 *
 * Verifies Phase 9.1 rule release checklist gate.
 *
 * Run: npm run test:release-checklist
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(SPRING_TS_ROOT, '../..');
const PR_TEMPLATE_PATH = path.resolve(REPO_ROOT, '.github/pull_request_template.md');

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

function writeFixture(dir: string, name: string, content: string): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content.trimStart(), 'utf-8');
  return filePath;
}

function runGate(body: string, changedFiles: readonly string[]): { code: number; json: any; stderr: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spring-ts-release-checklist-'));
  const bodyPath = writeFixture(dir, 'body.md', body);
  const filesPath = writeFixture(dir, 'changed-files.txt', `${changedFiles.join('\n')}\n`);
  try {
    const stdout = execFileSync(
      process.execPath,
      ['tools/check_release_checklist.mjs', '--body', bodyPath, '--changed-files', filesPath, '--json'],
      {
        cwd: SPRING_TS_ROOT,
        encoding: 'utf-8',
      },
    );
    return { code: 0, json: JSON.parse(stdout), stderr: '' };
  } catch (error: any) {
    const stdout = error?.stdout?.toString?.() ?? '{}';
    return {
      code: Number(error?.status ?? 1),
      json: JSON.parse(stdout),
      stderr: error?.stderr?.toString?.() ?? '',
    };
  }
}

const uncheckedBody = `
## Summary

Rule change.

## Rule release checklist (required for rule-affecting spring-ts PRs)

- [ ] Rule change impact reviewed (default-preserving).
- [ ] Source-tier impact reviewed (no low-tier or unsourced authority truth).
- [ ] User-facing wording reviewed (no overclaiming).
`;

const checkedBody = `
## Summary

Rule change.

## Rule release checklist (required for rule-affecting spring-ts PRs)

- [x] Rule change impact reviewed (default-preserving).
- [x] Source-tier impact reviewed (no low-tier or unsourced authority truth).
- [x] User-facing wording reviewed (no overclaiming).
`;

const notRuleAffectingBody = `
## Summary

Docs only.

> Not rule-affecting - docs/build/tooling only.
`;

console.log('Phase 9.1 release checklist gate\n');

const nonRuleDocs = runGate('', ['lib/spring-ts/docs/RULE_RELEASE_CHECKLIST.md']);
check('non-rule docs pass without checklist',
  nonRuleDocs.code === 0 &&
    nonRuleDocs.json.status === 'PASS' &&
    nonRuleDocs.json.ruleAffecting === false,
  JSON.stringify(nonRuleDocs.json));

const docsWithNote = runGate(notRuleAffectingBody, ['lib/spring-ts/docs/RULE_RELEASE_CHECKLIST.md']);
check('docs-only changes may declare not rule-affecting',
  docsWithNote.code === 0 &&
    docsWithNote.json.status === 'PASS' &&
    docsWithNote.json.ruleAffecting === false,
  JSON.stringify(docsWithNote.json));

const namespringChange = runGate('', ['namespring/src/App.jsx']);
check('top-level namespring changes are ignored by spring-ts release gate',
  namespringChange.code === 0 &&
    namespringChange.json.status === 'PASS' &&
    namespringChange.json.ruleAffecting === false,
  JSON.stringify(namespringChange.json));

const missingChecklist = runGate('', ['lib/spring-ts/src/spring-engine.ts']);
check('rule source change fails without PR checklist',
  missingChecklist.code !== 0 &&
    missingChecklist.json.status === 'FAIL' &&
    missingChecklist.json.ruleAffecting === true &&
    missingChecklist.json.missingChecks.length === 3,
  JSON.stringify(missingChecklist.json));

const uncheckedChecklist = runGate(uncheckedBody, ['lib/spring-ts/config/presets/naming_safe.json']);
check('unchecked checklist items fail for rule-affecting changes',
  uncheckedChecklist.code !== 0 &&
    uncheckedChecklist.json.status === 'FAIL' &&
    uncheckedChecklist.json.missingChecks.includes('rule-change-impact') &&
    uncheckedChecklist.json.missingChecks.includes('source-tier-impact') &&
    uncheckedChecklist.json.missingChecks.includes('user-facing-wording'),
  JSON.stringify(uncheckedChecklist.json));

const checkedChecklist = runGate(checkedBody, [
  'lib/spring-ts/metrics/rule-ab-tests.json',
  'lib/spring-ts/test/integration/rule-ab-tests.test.ts',
]);
check('checked checklist passes for rule metrics and integration tests',
  checkedChecklist.code === 0 &&
    checkedChecklist.json.status === 'PASS' &&
    checkedChecklist.json.ruleAffecting === true &&
    checkedChecklist.json.ruleAffectingFiles.length === 2,
  JSON.stringify(checkedChecklist.json));

const backslashPath = runGate(checkedBody, ['lib\\spring-ts\\src\\spring-engine.ts']);
check('backslash paths still trigger rule-affecting detection',
  backslashPath.code === 0 &&
    backslashPath.json.status === 'PASS' &&
    backslashPath.json.ruleAffectingFiles.includes('lib/spring-ts/src/spring-engine.ts'),
  JSON.stringify(backslashPath.json));

const contradictoryBody = runGate(`${checkedBody}\n> Not rule-affecting - docs only.\n`, [
  'lib/spring-ts/src/spring-engine.ts',
]);
check('rule-affecting PR cannot claim not rule-affecting',
  contradictoryBody.code !== 0 &&
    contradictoryBody.json.status === 'FAIL' &&
    contradictoryBody.json.missingChecks.includes('not-rule-affecting-claim'),
  JSON.stringify(contradictoryBody.json));

const templateChange = runGate(checkedBody, ['.github/pull_request_template.md']);
check('PR template changes are guarded as release-process changes',
  templateChange.code === 0 &&
    templateChange.json.status === 'PASS' &&
    templateChange.json.ruleAffectingFiles.includes('.github/pull_request_template.md'),
  JSON.stringify(templateChange.json));

const template = fs.readFileSync(PR_TEMPLATE_PATH, 'utf-8');
check('PR template contains stable release checklist labels',
  [
    'Rule change impact reviewed',
    'Source-tier impact reviewed',
    'User-facing wording reviewed',
  ].every((label) => template.includes(label)));

console.log(`\nRelease checklist gate: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
