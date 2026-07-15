import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { analyzeSaju, createBirthInput } from './springLegacy.js';

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
      byteLength: 3951,
      sha256: '14e7bb4128b3a682aee051d43419f1b4aaa0fe41e9169db2a4d5f04cf37867cb',
    });

    expect(fortunePayload).toMatchObject({
      daeunInfo: {
        isForward: true,
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

});
