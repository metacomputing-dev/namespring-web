import { describe, expect, it } from 'vitest';

import { normalizeConfig } from '../api/config.js';
import { pillar } from '../core/cycle.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import { DEFAULT_SCORE_POLICY } from '../core/scoring.js';
import { buildRuleFacts } from './facts.js';
import { scorePillarsForRuleFacts } from './ruleFactsScoring.js';
import { computeGyeokguk } from './gyeokguk.js';

/**
 * 감사 B4 — 건록격/양인격/월겁격 분기.
 * 월지 격 십성이 비견/겁재일 때 십신격 대신 주류 격명(자평진전 계열)으로 분기한다.
 * selectionRule='monthly_main'으로 월지 본기를 고정해 격 십성을 결정적으로 만든다.
 */
function analyze(
  pillarSpec: { year: [number, number]; month: [number, number]; day: [number, number]; hour: [number, number] },
  extraStrategies: Record<string, unknown> = {},
) {
  const config = normalizeConfig({
    strategies: { gyeokguk: { selectionRule: 'monthly_main', ...extraStrategies } },
  });
  const pillars = {
    year: pillar(...pillarSpec.year),
    month: pillar(...pillarSpec.month),
    day: pillar(...pillarSpec.day),
    hour: pillar(...pillarSpec.hour),
  };
  const elementDistribution = elementDistributionFromPillars(
    [pillars.year, pillars.month, pillars.day, pillars.hour],
    { hiddenStemWeights: (config.weights as any)?.hiddenStems },
  );
  const scoring = scorePillarsForRuleFacts(pillars, DEFAULT_SCORE_POLICY);
  const facts = buildRuleFacts({ config, pillars, elementDistribution, scoring });
  const result = computeGyeokguk(config, facts);
  return { facts, result };
}

describe('건록/양인/월겁 분기 (감사 B4)', () => {
  it('갑 일간 + 인월(본기 甲=비견) → 건록격', () => {
    const { facts, result } = analyze({ year: [2, 0], month: [2, 2], day: [0, 6], hour: [5, 5] });
    expect(facts.month.gyeok.tenGod).toBe('BI_GYEON');
    expect(facts.month.gyeok.bigyeopSubtype).toBe('GEONROK');
    expect(result.best).toBe('gyeokguk.GEONROK');
  });

  it('갑 일간 + 묘월(본기 乙=겁재, 양간 제왕지) → 양인격', () => {
    const { facts, result } = analyze({ year: [6, 0], month: [3, 3], day: [0, 8], hour: [4, 4] });
    expect(facts.month.gyeok.tenGod).toBe('GEOB_JAE');
    expect(facts.month.gyeok.bigyeopSubtype).toBe('YANGIN');
    expect(result.best).toBe('gyeokguk.YANGIN');
  });

  it('을 일간 + 인월(본기 甲=겁재, 음간) → 월겁격', () => {
    const { facts, result } = analyze({ year: [8, 0], month: [4, 2], day: [1, 1], hour: [6, 4] });
    expect(facts.month.gyeok.tenGod).toBe('GEOB_JAE');
    expect(facts.month.gyeok.bigyeopSubtype).toBe('WOLGEOB');
    expect(result.best).toBe('gyeokguk.WOLGEOB');
  });

  it('무 일간 + 오월(본기 丁=정인)은 이 분기에 들어오지 않는다 — 정인격 유지', () => {
    // '병무오월 양인' 전통(십성 무관 제왕지 승격)은 이설이 커서 미채택 — facts.ts 주석 참조.
    const { facts, result } = analyze({ year: [0, 0], month: [6, 6], day: [4, 10], hour: [9, 11] });
    expect(facts.month.gyeok.tenGod).toBe('JEONG_IN');
    expect(facts.month.gyeok.bigyeopSubtype).toBeNull();
    expect(result.best).toBe('gyeokguk.JEONG_IN');
  });

  it("bigyeopGyeok='legacy' 옵트아웃 시 비견격/겁재격 명칭 유지", () => {
    const { facts, result } = analyze(
      { year: [2, 0], month: [2, 2], day: [0, 6], hour: [5, 5] },
      { bigyeopGyeok: 'legacy' },
    );
    expect(facts.month.gyeok.tenGod).toBe('BI_GYEON');
    expect(facts.month.gyeok.bigyeopSubtype).toBeNull();
    expect(result.best).toBe('gyeokguk.BI_GYEON');
  });
});
