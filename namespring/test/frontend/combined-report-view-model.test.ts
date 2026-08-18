import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCombinedViewModel,
  deriveFramesTrack,
  deriveHarmonyTrack,
  deriveSoundTrack,
  strengthMeterPosition,
} from '../../src/report/combined/view-model.js';
import { normalizeElement, relationBetween, relationToTarget } from '../../src/report/combined/element-relations.js';

function frame(type: string, strokeSum: number, luckyLevel: string | null) {
  return {
    type,
    strokeSum,
    element: 'Wood',
    polarity: 'Positive',
    luckyLevel: 1,
    meaning: luckyLevel
      ? { title: `${type} title`, summary: `${type} summary`, lucky_level: luckyLevel }
      : null,
  };
}

const springReportFixture = {
  finalScore: 84.2,
  popularityRank: 120,
  maleRatio: 0.35,
  nameGender: 'female',
  namingReport: {
    name: {
      surname: [{ hangul: '천', hanja: '千', meaning: '일천 천', strokes: 3, element: 'Water', polarity: 'Negative' }],
      givenName: [
        { hangul: '민', hanja: '旼', meaning: '화할 민', strokes: 8, element: 'Fire', polarity: 'Negative' },
        { hangul: '아', hanja: '娥', meaning: '예쁠 아', strokes: 10, element: 'Wood', polarity: 'Positive' },
      ],
      fullHangul: '천민아',
      fullHanja: '千旼娥',
    },
    analysis: {
      hangul: {
        blocks: [
          { hangul: '천', onset: 'ㅊ', nucleus: 'ㅓ', element: 'Metal', polarity: 'Negative' },
          { hangul: '민', onset: 'ㅁ', nucleus: 'ㅣ', element: 'Water', polarity: 'Negative' },
          { hangul: '아', onset: 'ㅇ', nucleus: 'ㅏ', element: 'Wood', polarity: 'Positive' },
        ],
        polarityScore: 80,
        elementScore: 66,
      },
      hanja: {
        blocks: [
          { hanja: '千', hangul: '천', strokes: 3, resourceElement: 'Water', strokeElement: 'Fire', polarity: 'Positive' },
          { hanja: '旼', hangul: '민', strokes: 8, resourceElement: 'Fire', strokeElement: 'Metal', polarity: 'Negative' },
          { hanja: '娥', hangul: '아', strokes: 10, resourceElement: 'Wood', strokeElement: 'Water', polarity: 'Negative' },
        ],
        polarityScore: 70,
        elementScore: 60,
      },
      fourFrame: {
        frames: [
          frame('won', 18, '상운수'),
          frame('hyung', 11, '최상운수'),
          frame('lee', 13, '양운수'),
          frame('jung', 21, '상운수'),
        ],
        elementScore: 70,
        luckScore: 90,
      },
    },
  },
  sajuReport: {
    sajuEnabled: true,
    pillars: {
      year: { stem: { code: 'Xin', hangul: '신', hanja: '辛' }, branch: { code: 'Wei', hangul: '미', hanja: '未' } },
      month: { stem: { code: 'Geng', hangul: '경', hanja: '庚' }, branch: { code: 'Yin', hangul: '인', hanja: '寅' } },
      day: { stem: { code: 'Ji', hangul: '기', hanja: '己' }, branch: { code: 'Chou', hangul: '축', hanja: '丑' } },
      hour: { stem: { code: 'Bing', hangul: '병', hanja: '丙' }, branch: { code: 'Yin', hangul: '인', hanja: '寅' } },
    },
    dayMaster: { stem: '기', element: 'Earth', polarity: 'Negative' },
    strength: {
      level: '신강',
      isStrong: true,
      totalSupport: 6,
      totalOppose: 2,
      deukryeong: 1,
      deukji: 0.6,
      deukse: 4,
      details: ['월지 본기 인성'],
    },
    yongshin: { element: 'Fire', heeshin: 'Wood', gishin: 'Water', gushin: null, confidence: 72, agreement: 'high', recommendations: [] },
    gyeokguk: { type: '정인격', category: '내격', baseTenGod: null, confidence: 0.8, reasoning: '월지 본기 십성이 정인.' },
    elementDistribution: { wood: 2, fire: 1, earth: 3, metal: 1, water: 1 },
    inputUncertainty: undefined,
  },
  sajuCompatibility: {
    yongshinElement: 'Fire',
    heeshinElement: 'Wood',
    gishinElement: 'Water',
    nameElements: ['Water', 'Fire', 'Wood'],
    yongshinMatchCount: 1,
    gishinMatchCount: 0,
    dayMasterSupportScore: 70,
    affinityScore: 76,
  },
};

const fortuneReportFixture = {
  nameCompatibility: {
    overallStars: 4,
    overallScore: 84,
    summary: '이름이 사주 흐름과 잘 맞습니다.',
    details: ['이름의 화(火) 기운이 용신을 채워 줍니다.', '전체 균형이 안정적입니다.'],
  },
  overviewSummary: {
    dayMasterDescription: '기토 일간입니다.',
    strengthDescription: '신강한 구조입니다.',
    yongshinDescription: '화 기운이 필요합니다.',
    elementBalance: '토가 많고 화가 적습니다.',
    overallSummary: '전반적으로 안정적인 흐름입니다.',
    plainText: '쉽게 말해 균형이 좋은 사주입니다.',
    expertText: '억부 관점에서 화 용신이 유효합니다.',
  },
  strengthsWeaknesses: {
    strengths: [{ text: '꾸준함이 강점입니다.', reason: '인성 발달' }],
    weaknesses: [],
  },
  cautions: { cautions: [{ signal: '과로 신호', response: '휴식 확보', reason: '토 과다' }] },
  tieredMatrix: {
    nameSajuReading: { source: 'spring-ts.tiered.nameSajuReading', sentence: '이 이름은 필요한 기운을 보태 줍니다.', reinforces: true, yongshinMatchCount: 1 },
    glossary: {},
  },
  meta: { version: '1.0', generatedAt: '2026-08-18T00:00:00Z', engineVersion: 'spring-1.0', uncertainties: [] },
};

const entryUserInfoFixture = {
  lastName: [{ hangul: '천', hanja: '千' }],
  firstName: [{ hangul: '민', hanja: '旼' }, { hangul: '아', hanja: '娥' }],
};

test('element normalization accepts English, Korean, and hanja forms', () => {
  assert.equal(normalizeElement('Wood'), 'wood');
  assert.equal(normalizeElement('화'), 'fire');
  assert.equal(normalizeElement('金'), 'metal');
  assert.equal(normalizeElement(''), null);
});

test('relationBetween labels the generating and overcoming cycles', () => {
  assert.deepEqual(relationBetween('Metal', 'Water'), { type: 'generates', label: '금생수', favorable: true });
  assert.equal(relationBetween('Water', 'Fire')?.type, 'overcomes');
  assert.equal(relationBetween('목', '목')?.type, 'same');
  assert.equal(relationBetween('Fire', 'Wood')?.type, 'generatedBy');
});

test('relationToTarget classifies name element service toward yongshin', () => {
  assert.equal(relationToTarget('Fire', 'Fire')?.type, 'match');
  assert.equal(relationToTarget('Wood', 'Fire')?.type, 'generates');
  assert.equal(relationToTarget('Water', 'Fire')?.type, 'controls');
});

test('sound track: all-favorable chain is good, all-adverse is bad', () => {
  const good = deriveSoundTrack({ blocks: [{ element: 'Metal' }, { element: 'Water' }, { element: 'Wood' }] });
  assert.equal(good.state, 'good');
  const bad = deriveSoundTrack({ blocks: [{ element: 'Water' }, { element: 'Fire' }] });
  assert.equal(bad.state, 'bad');
  const single = deriveSoundTrack({ blocks: [{ element: 'Water' }] });
  assert.equal(single.state, 'mixed');
});

test('frames track uses DB lucky_level text, unknown levels stay neutral', () => {
  const good = deriveFramesTrack({ frames: [frame('won', 3, '상운수'), frame('hyung', 5, '최상운수')] });
  assert.equal(good.state, 'good');
  const mixed = deriveFramesTrack({ frames: [frame('won', 3, '상운수'), frame('hyung', 5, '흉운수')] });
  assert.equal(mixed.state, 'mixed');
  const unknown = deriveFramesTrack({ frames: [frame('won', 3, null)] });
  assert.equal(unknown.state, 'mixed');
});

test('harmony track follows yongshin and gishin match counts', () => {
  assert.equal(deriveHarmonyTrack({ yongshinMatchCount: 1, gishinMatchCount: 0 }).state, 'good');
  assert.equal(deriveHarmonyTrack({ yongshinMatchCount: 1, gishinMatchCount: 1 }).state, 'bad');
  assert.equal(deriveHarmonyTrack({ yongshinMatchCount: 0, gishinMatchCount: 0 }).state, 'mixed');
});

test('strength meter position clamps to support ratio', () => {
  assert.equal(strengthMeterPosition({ totalSupport: 6, totalOppose: 2 }), 0.75);
  assert.equal(strengthMeterPosition({ totalSupport: 0, totalOppose: 0, isStrong: false }), 0.3);
});

test('full view model derives hero, sections, and basis from engine data only', () => {
  const vm = buildCombinedViewModel({
    springReport: springReportFixture,
    fortuneReport: fortuneReportFixture,
    entryUserInfo: entryUserInfoFixture,
  });

  assert.equal(vm.hero.fullHangul, '천민아');
  assert.equal(vm.hero.fullHanja, '千旼娥');
  assert.equal(vm.hero.score, 84);
  assert.equal(vm.hero.verdictSentence, '이 이름은 필요한 기운을 보태 줍니다.');
  assert.deepEqual(vm.hero.tracks.map((t: { state: string }) => t.state), ['good', 'good', 'good']);
  assert.equal(vm.hero.chars[0].element, 'metal');

  assert.equal(vm.flow?.edges.length, 2);
  assert.equal(vm.flow?.edges[0]?.label, '금생수');

  assert.equal(vm.frames?.frames.length, 4);
  assert.equal(vm.frames?.frames[0].label, '원격');
  assert.equal(vm.frames?.frames[0].grade, 'favorable');

  assert.equal(vm.saju?.dayMaster?.element, 'earth');
  assert.equal(vm.saju?.strength?.meterPosition, 0.75);
  assert.equal(vm.saju?.yongshin?.elementKo, '화');
  assert.equal(vm.saju?.texts.plain, '쉽게 말해 균형이 좋은 사주입니다.');

  assert.equal(vm.harmony?.yongshinKo, '화');
  assert.equal(vm.harmony?.chars[1]?.relation?.type, 'match');
  assert.equal(vm.harmony?.details.length, 1);

  assert.equal(vm.final.cta, 'share');
  assert.equal(vm.final.recap.length, 3);
  assert.ok(vm.final.recap[0].sentence);
  assert.equal(vm.final.guide.strengths.length, 1);

  assert.equal(vm.stats?.popularityRank, 120);

  assert.ok(vm.basis.rows.some((row: { term: string }) => row.term === '용신'));
  assert.equal(vm.basis.engineVersion, 'spring-1.0');
});

test('view model collapses absent sections to null instead of inventing data', () => {
  const vm = buildCombinedViewModel({
    springReport: {
      namingReport: { name: { surname: [], givenName: [], fullHangul: '', fullHanja: '' }, analysis: {} },
      sajuReport: { sajuEnabled: false },
      sajuCompatibility: null,
      popularityRank: null,
      maleRatio: null,
      nameGender: 'unknown',
    },
    fortuneReport: { nameCompatibility: null, overviewSummary: {}, meta: {} },
    entryUserInfo: entryUserInfoFixture,
  });

  assert.equal(vm.flow, null);
  assert.equal(vm.frames, null);
  assert.equal(vm.saju, null);
  assert.equal(vm.harmony, null);
  assert.equal(vm.stats, null);
  assert.equal(vm.hero.score, null);
  assert.equal(vm.final.cta, 'recommend');
});
