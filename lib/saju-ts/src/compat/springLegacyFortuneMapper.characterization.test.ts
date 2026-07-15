import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { analyzeSaju, createBirthInput } from './springLegacy.js';
import { mapLegacyFortune } from './springLegacyFortuneMapper.js';

describe('spring legacy fortune mapping characterization', () => {
  it('preserves the exact daeun, saeun, and wolun compatibility payload', () => {
    const result = analyzeSaju(
      createBirthInput({
        birthYear: 1986,
        birthMonth: 4,
        birthDay: 19,
        birthHour: 5,
        birthMinute: 45,
        gender: 'MALE',
      }),
      undefined,
      {
        daeunCount: 1,
        saeunStartYear: 2031,
        saeunYearCount: 1,
        wolunStartYear: 1986,
        wolunMonthCount: 1,
      },
    );

    const fortunePayload = {
      daeunInfo: result.daeunInfo,
      saeunPillars: result.saeunPillars,
      wolunPillars: result.wolunPillars,
    };

    const encoded = JSON.stringify(fortunePayload);

    expect({
      byteLength: Buffer.byteLength(encoded, 'utf8'),
      sha256: createHash('sha256').update(encoded, 'utf8').digest('hex'),
    }).toEqual({
      byteLength: 3976,
      sha256: 'd4dd695c1755fd39d7231adb50c455b697d03d6f22eb79488ed9a1e9ae9cd698',
    });

    expect(fortunePayload).toMatchObject({
      daeunInfo: {
        isForward: true,
        boundaryTermId: 'LIXIA',
        boundaryMode: 'LIXIA',
        warnings: [],
        daeunPillars: [{ order: 0, pillar: { cheongan: 'GYE', jiji: 'SA' } }],
      },
      saeunPillars: [{ year: 2031, pillar: { cheongan: 'SIN', jiji: 'HAE' } }],
      wolunPillars: [{
        year: 1986,
        monthOrder: 0,
        startJie: 'LICHUN',
        pillar: { cheongan: 'GYEONG', jiji: 'IN' },
      }],
    });
  });

  it('preserves an unavailable fortune boundary without fabricating a term id', () => {
    const unreachable = () => {
      throw new Error('unexpected dependency call');
    };

    const result = mapLegacyFortune({
      fortune: { start: { boundary: null } },
      timeline: {},
      relationTimeline: {},
      dayStemIdx: 0,
      yearBranchIdx: 0,
      lifeStagePolicy: {},
      maxSolarYear: 2106,
      selection: {},
      dependencies: {
        stemCodeFromIdx: unreachable,
        branchCodeFromIdx: unreachable,
        annotateLuckPillar: unreachable,
        formatRelationsWithNatal: unreachable,
        formatRelationsWithDecade: unreachable,
        approxDaeunUtcMs: unreachable,
        roundTo: unreachable,
      },
    });

    expect(result.daeunInfo).toMatchObject({
      boundaryTermId: null,
      boundaryMode: '',
      boundaryUtcMs: null,
    });
  });

  it('rejects a non-string fortune boundary id instead of stringifying it', () => {
    const unreachable = () => {
      throw new Error('unexpected dependency call');
    };

    expect(() => mapLegacyFortune({
      fortune: { start: { boundary: { id: { malformed: true } } } } as any,
      timeline: {},
      relationTimeline: {},
      dayStemIdx: 0,
      yearBranchIdx: 0,
      lifeStagePolicy: {},
      maxSolarYear: 2106,
      selection: {},
      dependencies: {
        stemCodeFromIdx: unreachable,
        branchCodeFromIdx: unreachable,
        annotateLuckPillar: unreachable,
        formatRelationsWithNatal: unreachable,
        formatRelationsWithDecade: unreachable,
        approxDaeunUtcMs: unreachable,
        roundTo: unreachable,
      },
    })).toThrow(/boundary\.id must be a string or null/);
  });

});
