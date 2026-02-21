import { getStemEncyclopediaEntry, STEM_ENCYCLOPEDIA } from '../src/report/knowledge/stemEncyclopedia.ts';
import { getBranchEncyclopediaEntry, BRANCH_ENCYCLOPEDIA } from '../src/report/knowledge/branchEncyclopedia.ts';
import { getTenGodEncyclopediaEntry, TEN_GOD_ENCYCLOPEDIA } from '../src/report/knowledge/tenGodEncyclopedia.ts';
import { getLifeStageEncyclopediaEntry, LIFE_STAGE_ENCYCLOPEDIA } from '../src/report/knowledge/lifeStageEncyclopedia.ts';
import { findGyeokgukEntry } from '../src/report/knowledge/gyeokgukEncyclopedia.ts';
import { findShinsalEntry, SHINSAL_ENCYCLOPEDIA } from '../src/report/knowledge/shinsalEncyclopedia.ts';

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    fail(message);
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function runCheck(name: string, check: () => void): boolean {
  try {
    check();
    console.log(`PASS: ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(`      ${toErrorMessage(error)}`);
    return false;
  }
}

function main(): void {
  let failed = 0;

  if (
    !runCheck('getStemEncyclopediaEntry returns GAP encyclopedia entry', () => {
      const entry = getStemEncyclopediaEntry('GAP');
      assert(entry === STEM_ENCYCLOPEDIA.GAP, 'lookup should return STEM_ENCYCLOPEDIA.GAP');
      assert(entry.element === 'WOOD', `expected element WOOD, got ${entry.element}`);
      assert(entry.yinYang === 'YANG', `expected yinYang YANG, got ${entry.yinYang}`);
      assert(entry.coreKeywords.length > 0, 'expected non-empty coreKeywords');
    })
  ) {
    failed++;
  }

  if (
    !runCheck('getBranchEncyclopediaEntry returns JA encyclopedia entry', () => {
      const entry = getBranchEncyclopediaEntry('JA');
      assert(entry === BRANCH_ENCYCLOPEDIA.JA, 'lookup should return BRANCH_ENCYCLOPEDIA.JA');
      assert(entry.code === 'JA', `expected code JA, got ${entry.code}`);
      assert(entry.time === '23:00-01:00', `expected time 23:00-01:00, got ${entry.time}`);
      assert(entry.strengths.length > 0, 'expected non-empty strengths');
    })
  ) {
    failed++;
  }

  if (
    !runCheck('getTenGodEncyclopediaEntry returns BI_GYEON encyclopedia entry', () => {
      const entry = getTenGodEncyclopediaEntry('BI_GYEON');
      assert(entry === TEN_GOD_ENCYCLOPEDIA.BI_GYEON, 'lookup should return TEN_GOD_ENCYCLOPEDIA.BI_GYEON');
      assert(entry.coreRole.length > 0, 'expected non-empty coreRole');
      assert(entry.strengths.length > 0, 'expected non-empty strengths');
      assert(entry.cautions.length > 0, 'expected non-empty cautions');
    })
  ) {
    failed++;
  }

  if (
    !runCheck('getLifeStageEncyclopediaEntry returns JANGSEONG encyclopedia entry', () => {
      const entry = getLifeStageEncyclopediaEntry('JANGSEONG');
      assert(entry === LIFE_STAGE_ENCYCLOPEDIA.JANGSEONG, 'lookup should return LIFE_STAGE_ENCYCLOPEDIA.JANGSEONG');
      assert(entry.stageOrder === 1, `expected stageOrder 1, got ${entry.stageOrder}`);
      assert(entry.practicalAdvice.length > 0, 'expected non-empty practicalAdvice');
    })
  ) {
    failed++;
  }

  if (
    !runCheck('findGyeokgukEntry resolves aliases and rejects invalid values', () => {
      const base = findGyeokgukEntry('bi_gyeon');
      assert(base !== null, 'expected bi_gyeon alias lookup to return an entry');

      const normalized = findGyeokgukEntry(' BI-GYEON ');
      assert(normalized === base, 'expected normalized BI-GYEON lookup to match bi_gyeon result');

      const fuzzy = findGyeokgukEntry('prefix bigyeon suffix');
      assert(fuzzy === base, 'expected fuzzy bigyeon lookup to match bi_gyeon result');

      assert(findGyeokgukEntry('unknown-gyeokguk') === null, 'expected unknown lookup to return null');
      assert(findGyeokgukEntry('x') === null, 'expected one-character lookup to return null');
      assert(findGyeokgukEntry(undefined) === null, 'expected undefined lookup to return null');
    })
  ) {
    failed++;
  }

  if (
    !runCheck('findShinsalEntry resolves aliases and rejects invalid values', () => {
      const base = findShinsalEntry('yeokma');
      assert(base !== null, 'expected yeokma alias lookup to return an entry');
      assert(base === SHINSAL_ENCYCLOPEDIA.YEOKMA, 'expected yeokma lookup to return SHINSAL_ENCYCLOPEDIA.YEOKMA');

      const normalized = findShinsalEntry('YeOk_Ma');
      assert(normalized === base, 'expected normalized YeOk_Ma lookup to match yeokma result');

      const fuzzy = findShinsalEntry('prefix yeokmasal suffix');
      assert(fuzzy === base, 'expected fuzzy yeokmasal lookup to match yeokma result');

      assert(findShinsalEntry('not-a-real-shinsal') === null, 'expected unknown lookup to return null');
      assert(findShinsalEntry('x') === null, 'expected one-character lookup to return null');
      assert(findShinsalEntry(null) === null, 'expected null lookup to return null');
    })
  ) {
    failed++;
  }

  if (failed > 0) {
    console.error(`FAIL: ${failed} check(s) failed.`);
    process.exit(1);
  }

  console.log('PASS: verify-encyclopedia-lookups');
}

main();
