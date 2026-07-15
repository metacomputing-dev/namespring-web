import { describe, expect, it } from 'vitest';
import {
  CHEONGAN_RELATION_NOTES,
  JIJI_RELATION_NOTES,
  JIJI_RELATION_OUTCOMES,
  analyzeSaju,
  createBirthInput,
} from './springLegacy.js';
import { RELATION_ORDER } from '../core/branchRelations.js';

describe('관계 타입 ↔ 라벨 테이블 전수 일치 (감사 A3)', () => {
  it('엔진이 방출 가능한 모든 지지 관계 타입에 note/outcome 라벨이 있다', () => {
    for (const type of RELATION_ORDER) {
      expect(JIJI_RELATION_NOTES[type], `JIJI_RELATION_NOTES.${type}`).toBeTruthy();
      expect(JIJI_RELATION_OUTCOMES[type], `JIJI_RELATION_OUTCOMES.${type}`).toBeTruthy();
    }
  });

  it('천간 관계 타입(HAP/CHUNG)에 note 라벨이 있다', () => {
    for (const type of ['HAP', 'CHUNG'] as const) {
      expect(CHEONGAN_RELATION_NOTES[type], `CHEONGAN_RELATION_NOTES.${type}`).toBeTruthy();
    }
  });
});

describe('shinsal strategy options', () => {
  it('yinYanginSplit is opt-in and emits EUM_IN for yin-stem Yangin cases', () => {
    const input = createBirthInput({
      birthYear: 1980,
      birthMonth: 1,
      birthDay: 5,
      birthHour: 12,
      birthMinute: 0,
      gender: 'MALE',
    });
    const base: any = analyzeSaju(input);
    const split: any = analyzeSaju(input, { strategies: { shinsal: { yinYanginSplit: true } } });

    const baseTypes = (base.shinsalHits ?? []).map((hit: any) => hit.type);
    const splitTypes = (split.shinsalHits ?? []).map((hit: any) => hit.type);

    expect(baseTypes).toContain('YANG_IN');
    expect(baseTypes).not.toContain('EUM_IN');
    expect(splitTypes).toContain('EUM_IN');
    expect(splitTypes).not.toContain('YANG_IN');
    expect(splitTypes).toContain('BI_IN_SAL');
  });
});
describe('normalizeLegacyOutput 정직성 (감사 A1/A2/A9/A15d)', () => {
  // 1986-04-19 05:45 남 (핸드북 프리뷰 표준 케이스)
  const output: any = analyzeSaju(createBirthInput({
    birthYear: 1986, birthMonth: 4, birthDay: 19,
    birthHour: 5, birthMinute: 45, gender: 'MALE',
  }));

  it('육합이 나오면 note/outcome이 비어 있지 않다 (전 관계 공통)', () => {
    for (const rel of output.jijiRelations) {
      expect(rel.note, `note for ${rel.type}`).toBeTruthy();
      expect(rel.outcome, `outcome for ${rel.type}`).toBeTruthy();
    }
  });

  it('용신 추천 1위 type이 실제 지배 방법(primaryMethod)에서 유도된다 — 辰월 중립 기후는 EOKBU', () => {
    // 1986-04-19는 辰월(조후 기여 ±0.02 수준) — 조후 기본화(감사 B6) 후에도 억부 지배.
    expect(output.yongshinResult.recommendations[0]?.type).toBe('EOKBU');
  });

  it('surfaces method breakdown in top yongshin recommendation reasoning', () => {
    const top = output.yongshinResult.recommendations[0];
    const breakdown = output.yongshinResult.methodBreakdown;
    expect(breakdown?.effectiveWeights).toEqual(expect.any(Object));
    expect(breakdown?.balance?.deficiency).toEqual(expect.any(Object));
    expect(breakdown?.balance?.role).toEqual(expect.any(Object));
    expect(Object.values(breakdown.balance.deficiency).some((value) => typeof value === 'number')).toBe(true);
    expect(String(top?.reasoning ?? '')).toContain('\uC5B5\uBD80:');
  });

  it('surfaces gyeokguk basis and score map', () => {
    const gyeokguk = output.gyeokgukResult;
    expect(gyeokguk?.basis?.monthGyeokTenGod).toEqual(expect.any(String));
    expect(gyeokguk?.basis?.monthGyeokMethod).toEqual(expect.any(String));
    expect(gyeokguk?.basis?.monthGyeokQuality?.details).toEqual(expect.any(Object));
    expect(Object.keys(gyeokguk?.scores ?? {}).some((key) => key.startsWith('gyeokguk.'))).toBe(true);
  });

  it('keeps heuristic cheongan scores opt-in and labels their provenance', () => {
    expect(output.scoredCheonganRelations).toEqual([]);
    const scored: any = analyzeSaju(createBirthInput({
      birthYear: 1986, birthMonth: 4, birthDay: 19,
      birthHour: 5, birthMinute: 45, gender: 'MALE',
    }), { strategies: { stemRelations: { heuristicScores: { enabled: true } } } });
    expect(scored.scoredCheonganRelations).toHaveLength(scored.cheonganRelations.length);
    if (scored.scoredCheonganRelations.length > 0) {
      const first = scored.scoredCheonganRelations[0];
      expect(first.hit?.type).toEqual(expect.any(String));
      expect(first.hit?.members).toEqual(expect.any(Array));
      expect(first.score?.finalScore).toEqual(expect.any(Number));
      expect(first.score?.rationale).toContain('type=');
      expect(first.score).toMatchObject({
        model: 'legacy_heuristic_v1',
        unit: '0_100',
        status: 'provisional',
        evidenceOnly: true,
        authorityTruthEligible: false,
        provisional: true,
      });
      expect(first.score.pairCount).toBe(first.score.positionGaps.length);
      expect(first.score.positionGap).toBe(first.score.positionGaps[0] ?? null);
    }
  });

  it('does not describe suitability ranking as raw elemental strength', () => {
    const reasons = output.yongshinResult.recommendations
      .map((candidate: any) => String(candidate.reasoning ?? ''))
      .join('\n');
    expect(reasons).not.toContain('기운이 가장 강해 용신');
    expect(reasons).not.toContain('기운을 보조하는 희신 후보');
  });

  it('applies shinsal position multipliers only under explicit opt-in', () => {
    expect(output.weightedShinsalHits.length).toBeGreaterThan(0);
    expect(output.weightedShinsalHits.every((item: any) => item.positionMultiplier === 1)).toBe(true);
    const weighted: any = analyzeSaju(createBirthInput({
      birthYear: 1986, birthMonth: 4, birthDay: 19,
      birthHour: 5, birthMinute: 45, gender: 'MALE',
    }), { strategies: { shinsal: { positionWeighting: { enabled: true } } } });
    const attenuatedHit = weighted.weightedShinsalHits.find((item: any) => item.positionMultiplier < 1);
    expect(attenuatedHit?.hit?.seatPillars?.some((seat: string) => seat !== 'day')).toBe(true);
    for (const item of weighted.weightedShinsalHits) {
      expect(item.weightedScore).toBe(Math.round(item.baseWeight * item.positionMultiplier));
      if ((item.hit?.seatPillars ?? []).length === 0) expect(item.positionMultiplier).toBe(1);
    }
  });

  it('keeps duplicate shinsal winner trace atomic and changes only count', () => {
    const duplicates = output.weightedShinsalHits.filter((item: any) => item.count > 1);
    expect(duplicates.length).toBeGreaterThan(0);
    for (const item of duplicates) {
      expect(item.weightedScore).toBe(Math.round(item.baseWeight * item.positionMultiplier));
      const expectedGrade = item.baseWeight >= 85 ? 'A' : item.baseWeight >= 50 ? 'B' : 'C';
      expect(item.hit.grade).toBe(expectedGrade);
      if (item.hit.conditionPenalty == null) {
        expect(item.hit.qualityReasons).toBeUndefined();
      } else {
        expect(item.hit.conditionPenalty).toBeGreaterThan(0);
        expect(item.hit.qualityReasons?.length).toBeGreaterThan(0);
      }
    }
  });

  it('surfaces shinsal attenuation trace from condition scoring', () => {
    const tracedHit = output.weightedShinsalHits.find((item: any) =>
      Array.isArray(item.hit?.qualityReasons) &&
      item.hit.qualityReasons.length > 0 &&
      typeof item.hit?.conditionPenalty === 'number',
    );
    expect(tracedHit).toBeTruthy();
    if (!tracedHit) throw new Error('expected at least one shinsal hit with attenuation trace');
    expect(tracedHit.hit.qualityReasons).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(tracedHit.hit.conditionPenalty).toBeGreaterThan(0);
    expect(tracedHit.hit.conditionPenalty).toBeLessThanOrEqual(1);
  });

  it('attenuates gongmang when a void branch is resolved by clash or punishment', () => {
    const input = createBirthInput({
      birthYear: 2000, birthMonth: 1, birthDay: 1,
      birthHour: 0, birthMinute: 30, gender: 'MALE',
    });
    const base: any = analyzeSaju(input);
    const baseGongmang = base.weightedShinsalHits.find((item: any) => item.hit?.type === 'GONGMANG');
    expect(baseGongmang?.baseWeight).toBe(100);
    expect(baseGongmang?.hit?.qualityReasons).toBeUndefined();
    const hegong: any = analyzeSaju(input, {
      strategies: { shinsal: { gongmangResolution: { enabled: true } } },
    });
    const gongmang = hegong.weightedShinsalHits.find((item: any) => item.hit?.type === 'GONGMANG');
    expect(gongmang).toBeTruthy();
    if (!gongmang) throw new Error('expected gongmang hit');
    expect(gongmang.hit.grade).toBe('B');
    expect(gongmang.hit.qualityReasons).toEqual(expect.arrayContaining(['CHUNG', 'HYEONG']));
    expect(gongmang.hit.qualityReasons ?? []).not.toContain('GONGMANG');
    expect(gongmang.hit.conditionPenalty).toBe(0.5);
    expect(gongmang.baseWeight).toBe(50);
  });

  it('attenuates gongmang when a void branch is resolved by a branch combination', () => {
    const input = createBirthInput({
      birthYear: 1960, birthMonth: 1, birthDay: 20,
      birthHour: 6, birthMinute: 0, gender: 'MALE',
    });
    const base: any = analyzeSaju(input);
    const baseGongmang = base.weightedShinsalHits.find((item: any) => item.hit?.type === 'GONGMANG');
    expect(baseGongmang?.baseWeight).toBe(100);
    expect(baseGongmang?.hit?.qualityReasons).toBeUndefined();
    const hegong: any = analyzeSaju(input, {
      strategies: { shinsal: { gongmangResolution: { enabled: true } } },
    });
    const gongmang = hegong.weightedShinsalHits.find((item: any) => item.hit?.type === 'GONGMANG');
    expect(gongmang).toBeTruthy();
    if (!gongmang) throw new Error('expected gongmang hit');
    expect(gongmang.hit.grade).toBe('B');
    expect(gongmang.hit.qualityReasons).toEqual(expect.arrayContaining(['HAP']));
    expect(gongmang.hit.qualityReasons ?? []).not.toEqual(expect.arrayContaining(['PA', 'WONJIN', 'GONGMANG']));
    expect(gongmang.hit.conditionPenalty).toBe(0.5);
    expect(gongmang.baseWeight).toBe(50);
  });

  it('does not surface unsupported shinsal composite pipe', () => {
    expect(Object.prototype.hasOwnProperty.call(output, 'shinsalComposites')).toBe(false);
  });

  it('한겨울(子월) 출생도 1위 type이 유도된 방법 코드다 (EOKBU 또는 JOHU)', () => {
    // 조후 기본 개입(climate 0.25 + 조후위급) 하에서 극단월은 JOHU가 나올 수 있다.
    // 어느 쪽이 지배하든 하드코딩 'RANKING'/'JOHU' 시절과 달리 유도 값이어야 한다.
    const winter: any = analyzeSaju(createBirthInput({
      birthYear: 1990, birthMonth: 1, birthDay: 5,
      birthHour: 12, birthMinute: 0, gender: 'MALE',
    }));
    expect(['EOKBU', 'JOHU']).toContain(winter.yongshinResult.recommendations[0]?.type);
    expect(winter.yongshinResult.recommendations[1]?.type).toBe('RANKING');
  });

  it('득령은 0|1, 득지는 0~1, 득세는 0~7 범위의 실제 판정값이다', () => {
    const s = output.strengthResult.score;
    expect([0, 1]).toContain(s.deukryeong);
    expect(s.deukji).toBeGreaterThanOrEqual(0);
    expect(s.deukji).toBeLessThanOrEqual(1);
    expect(Number.isInteger(s.deukse)).toBe(true);
    expect(s.deukse).toBeGreaterThanOrEqual(0);
    expect(s.deukse).toBeLessThanOrEqual(7);
    // 가짜 매핑 시절의 흔적: deukse가 앞 둘의 단순합이면 안 된다 (정의상 다른 축).
    // (실값에서도 우연히 같을 수는 있으나 스케일이 다르다 — 회귀 감지용 완화 검사)
    expect(s.deukse).not.toBe(output.strengthResult.score.totalSupport);
  });

  it('1986년(비서머타임) 출생의 dstCorrectionMinutes는 0이다', () => {
    expect(output.coreResult.dstCorrectionMinutes).toBe(0);
  });

  it('1988년 7월(서머타임) 출생의 dstCorrectionMinutes는 60이다', () => {
    const dst: any = analyzeSaju(createBirthInput({
      birthYear: 1988, birthMonth: 7, birthDay: 15,
      birthHour: 12, birthMinute: 0, gender: 'FEMALE',
    }));
    expect(dst.coreResult.dstCorrectionMinutes).toBe(60);
  });

  it('1957년 여름(1955~60 서머타임, ICU 표시명 부재 구간)도 60분으로 판정한다', () => {
    const dst: any = analyzeSaju(createBirthInput({
      birthYear: 1957, birthMonth: 7, birthDay: 15,
      birthHour: 12, birthMinute: 0, gender: 'MALE',
    }));
    expect(dst.coreResult.dstCorrectionMinutes).toBe(60);
  });

  it('1954년 1월(표준 자오선 변경 직전)은 서머타임으로 오판하지 않는다', () => {
    const noDst: any = analyzeSaju(createBirthInput({
      birthYear: 1954, birthMonth: 1, birthDay: 15,
      birthHour: 12, birthMinute: 0, gender: 'MALE',
    }));
    expect(noDst.coreResult.dstCorrectionMinutes).toBe(0);
  });

  it('implements JOJA_SPLIT as midnight day pillar plus next-day zi-hour stem basis', () => {
    const lateZi = createBirthInput({
      birthYear: 2000, birthMonth: 1, birthDay: 1,
      birthHour: 23, birthMinute: 30, gender: 'MALE',
    });
    const midnight: any = analyzeSaju(lateZi, {
      dayCutMode: 'MIDNIGHT_00', trueSolarTimeEnabled: false, longitudeCorrectionEnabled: false,
    });
    const yaza: any = analyzeSaju(lateZi, {
      dayCutMode: 'YAZA_23_TO_01_NEXTDAY', trueSolarTimeEnabled: false, longitudeCorrectionEnabled: false,
    });
    const joja: any = analyzeSaju(lateZi, {
      dayCutMode: 'JOJA_SPLIT', trueSolarTimeEnabled: false, longitudeCorrectionEnabled: false,
    });
    expect(joja.pillars.day).toEqual(midnight.pillars.day);
    expect(joja.pillars.day).not.toEqual(yaza.pillars.day);
    expect(joja.pillars.hour.jiji).toBe(midnight.pillars.hour.jiji);
    expect(joja.pillars.hour.cheongan).toBe(yaza.pillars.hour.cheongan);
    expect(joja.pillars.hour.cheongan).not.toBe(midnight.pillars.hour.cheongan);
  });

  it('daeunInfo.boundaryMode는 일경계 정책이 아니라 절기 id다', () => {
    expect(output.daeunInfo.boundaryMode).not.toBe('midnight');
    expect(output.daeunInfo.boundaryMode).not.toBe('ziSplit23');
    expect(output.daeunInfo.boundaryMode).toMatch(/^[A-Z_]+$/);
    expect(output.daeunInfo.deltaDays).toBeGreaterThan(0);
    expect(String(output.daeunInfo.formula)).toContain('startAgeYears');
  });
});

describe('structural month-frame public candidates', () => {
  it('does not duplicate a Geonrok frame under the legacy companion name', () => {
    const output: any = analyzeSaju(createBirthInput({
      birthYear: 2005,
      birthMonth: 12,
      birthDay: 25,
      birthHour: 6,
      birthMinute: 0,
      gender: 'MALE',
    }));

    const candidates = output.gyeokgukResult.candidates as Array<{ type: string }>;
    const types = candidates.map((candidate) => candidate.type);

    expect(output.gyeokgukResult.type).toBe('GEONROK');
    expect(types).toContain('GEONROK');
    expect(types).not.toContain('BI_GYEON');
  });
});
