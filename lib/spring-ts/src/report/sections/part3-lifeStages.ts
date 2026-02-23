// @ts-nocheck
﻿import type {
  ReportInput,
  ReportSection,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportHighlight,
} from '../types.js';

import {
  LIFE_STAGES,
  LIFE_STAGE_BY_CODE,
  type LifeStageInfo,
} from '../common/elementMaps.js';

import {
  createRng,
  pickAndFill,
  narrative,
  positive,
  emphasis,
  encouraging,
  joinSentences,
} from '../common/sentenceUtils.js';

import { getLifeStageEncyclopediaEntry } from '../knowledge/lifeStageEncyclopedia.js';

type PillarKey = 'year' | 'month' | 'day' | 'hour';
type KeyStageKind = 'peak' | 'low';
type EnergyPattern = 'rising' | 'falling' | 'peakMiddle' | 'valleyMiddle' | 'uniform' | 'mixed';

interface PillarLifeStage {
  readonly position: PillarKey;
  readonly info: LifeStageInfo;
}

const PILLAR_KEYS: readonly PillarKey[] = ['year', 'month', 'day', 'hour'];

const PILLAR_KOREAN: Record<PillarKey, string> = {
  year: '연주(초년)',
  month: '월주(청년)',
  day: '일주(중년)',
  hour: '시주(말년)',
};

const PILLAR_SHORT: Record<PillarKey, string> = {
  year: '연주',
  month: '월주',
  day: '일주',
  hour: '시주',
};

const PILLAR_LIFE_PHASE: Record<PillarKey, string> = {
  year: '유년기와 뿌리',
  month: '청년기와 성장',
  day: '중년기와 현실',
  hour: '말년기와 완성',
};

const STAGE_CODE_NORMALIZE: Record<string, LifeStageInfo['code']> = {
  JANG_SAENG: 'JANGSEONG',
  MOK_YOK: 'MOKYOK',
  GWAN_DAE: 'GWANDAE',
  GEON_ROK: 'GEONROK',
  JE_WANG: 'JEWANG',
  SWOE: 'SWOE',
  BYEONG: 'BYEONG',
  SA: 'SA',
  MYO: 'MYO',
  JEOL: 'JEOL',
  TAE: 'TAE',
  YANG: 'YANG',
};

const STAGE_METAPHOR: Record<LifeStageInfo['code'], string> = {
  JANGSEONG: '새 출발',
  MOKYOK: '정화와 준비',
  GWANDAE: '성장과 역할 확대',
  GEONROK: '기반 완성',
  JEWANG: '절정과 추진',
  SWOE: '속도 조절',
  BYEONG: '회복과 재정비',
  SA: '전환 준비',
  MYO: '내면 정리',
  JEOL: '비움과 리셋',
  TAE: '가능성의 씨앗',
  YANG: '조용한 축적',
};

const INTRO_TEMPLATES: readonly string[] = [
  '12운성은 인생 에너지의 흐름을 보여주는 지도예요. {{name}}님의 네 기둥을 차근차근 살펴볼게요.',
  '같은 사주라도 기둥마다 흐름이 달라요. {{name}}님의 12운성 에너지 리듬을 쉽게 풀어드릴게요.',
  '지금부터 연주, 월주, 일주, 시주의 12운성을 연결해서 {{name}}님의 인생 패턴을 읽어볼게요.',
];

const PILLAR_INTRO_TEMPLATES: readonly string[] = [
  '{{pillar}}는 {{lifePhase}}를 뜻해요. 이 자리의 {{stageName}}({{hanja}}) 에너지는 {{energy}}/12예요.',
  '{{pillar}}를 보면 {{stageName}}({{hanja}})이 자리해 있어요. 지금 흐름은 {{metaphor}}에 가깝고 에너지는 {{energy}}/12예요.',
  '{{lifePhase}}를 나타내는 {{pillar}}는 {{stageName}}({{hanja}}) 단계예요. 현재 에너지 점수는 {{energy}}/12예요.',
];

const PATTERN_LABELS: Record<EnergyPattern, string> = {
  rising: '상승형',
  falling: '하강형',
  peakMiddle: '중반 피크형',
  valleyMiddle: '중반 저점형',
  uniform: '균일형',
  mixed: '혼합형',
};

const PATTERN_NARRATIVE: Record<EnergyPattern, readonly string[]> = {
  rising: [
    '{{name}}님의 에너지는 뒤로 갈수록 올라가는 상승형이에요. 초반보다 후반이 더 강해지는 흐름이에요.',
    '지금 패턴은 상승형이에요. 시간이 갈수록 자신감과 추진력이 붙는 구조예요.',
  ],
  falling: [
    '{{name}}님의 에너지는 앞쪽이 강하고 뒤로 갈수록 차분해지는 하강형이에요. 초반 기회를 잘 잡는 게 중요해요.',
    '하강형 패턴이 보여요. 시작의 힘이 큰 만큼 초반 선택을 정교하게 가져가면 좋아요.',
  ],
  peakMiddle: [
    '{{name}}님의 흐름은 중반 피크형이에요. 청년기~중년기에 힘이 크게 모이는 구조예요.',
    '중반 피크형 패턴이라 핵심 시기에 집중하면 성과가 크게 나는 타입이에요.',
  ],
  valleyMiddle: [
    '{{name}}님의 패턴은 중반 저점형이에요. 중간 구간에서 재정비를 잘하면 후반 반등이 쉬워져요.',
    '중반 저점형 흐름이에요. 중간 구간은 쉬어가는 타이밍으로 보고 체력을 아끼는 전략이 좋아요.',
  ],
  uniform: [
    '{{name}}님은 네 기둥 에너지가 비교적 고르게 분포한 균일형이에요. 꾸준함이 큰 장점이에요.',
    '균일형 패턴이라 급격한 기복이 적고 안정적으로 실력을 쌓기 좋아요.',
  ],
  mixed: [
    '{{name}}님의 에너지는 구간별 차이가 있는 혼합형이에요. 시기별 전략을 다르게 쓰면 강점이 커져요.',
    '혼합형 패턴이라 유연성이 핵심이에요. 상황에 맞춰 속도를 조절하면 좋아요.',
  ],
};

const HIGH_ENERGY_TEMPLATES: readonly string[] = [
  '전체 평균 에너지가 {{avg}}/12로 높은 편이에요. 추진력이 좋은 만큼 방향을 분명히 잡으면 성과가 빨라요.',
  '{{name}}님은 기본 에너지가 높은 타입이에요. 해야 할 일을 좁혀서 집중하면 강점이 크게 살아나요.',
];

const MID_ENERGY_TEMPLATES: readonly string[] = [
  '평균 에너지 {{avg}}/12로 균형이 좋은 편이에요. 무리하지 않고 꾸준히 가는 전략이 잘 맞아요.',
  '{{name}}님은 안정적인 중간 에너지대예요. 리듬을 지키면서 한 단계씩 올라가면 좋아요.',
];

const LOW_ENERGY_TEMPLATES: readonly string[] = [
  '평균 에너지가 {{avg}}/12로 차분한 편이에요. 속도보다 회복과 루틴을 먼저 챙기면 오히려 오래 갑니다.',
  '{{name}}님은 내실형 흐름이 강해요. 작게 시작해도 꾸준히 이어가면 결과가 분명히 쌓여요.',
];

const CLOSING_TEMPLATES: readonly string[] = [
  '12운성은 좋고 나쁨보다 “지금 어떤 운영이 맞는가”를 알려줘요. 오늘 흐름을 기준으로 리듬을 잡아보세요.',
  '에너지는 계속 순환해요. 강한 구간은 밀고, 약한 구간은 정비하면 전체 운의 질이 좋아집니다.',
  '핵심은 타이밍이에요. {{name}}님의 리듬을 이해한 지금부터 선택이 훨씬 쉬워질 거예요.',
];

function safeName(input: ReportInput): string {
  return input.name?.trim() || '고객';
}

function resolveLifeStageInfo(code: string): LifeStageInfo | null {
  const direct = LIFE_STAGE_BY_CODE[code];
  if (direct) return direct;

  const normalized = STAGE_CODE_NORMALIZE[code];
  if (normalized) {
    const normalizedInfo = LIFE_STAGE_BY_CODE[normalized];
    if (normalizedInfo) return normalizedInfo;
  }

  const byKorean = LIFE_STAGES.find(stage => stage.korean === code);
  return byKorean ?? null;
}

function extractLifeStages(input: ReportInput): PillarLifeStage[] {
  const saju = input.saju as Record<string, unknown>;
  const lifeStages = saju.lifeStages as Record<string, string> | undefined;
  if (!lifeStages) return [];

  const result: PillarLifeStage[] = [];
  for (const key of PILLAR_KEYS) {
    const code = lifeStages[key];
    if (!code) continue;

    const info = resolveLifeStageInfo(code);
    if (!info) continue;

    result.push({ position: key, info });
  }

  return result;
}

function classifyPattern(energies: readonly number[]): EnergyPattern {
  if (energies.length < 2) return 'uniform';

  const range = Math.max(...energies) - Math.min(...energies);
  if (range <= 2) return 'uniform';

  let risingCount = 0;
  let fallingCount = 0;
  for (let i = 1; i < energies.length; i++) {
    if (energies[i] > energies[i - 1]) risingCount += 1;
    else if (energies[i] < energies[i - 1]) fallingCount += 1;
  }

  if (risingCount >= energies.length - 1) return 'rising';
  if (fallingCount >= energies.length - 1) return 'falling';

  if (energies.length === 4) {
    const middle = (energies[1] + energies[2]) / 2;
    const sides = (energies[0] + energies[3]) / 2;
    if (middle > sides + 2) return 'peakMiddle';
    if (sides > middle + 2) return 'valleyMiddle';
  }

  return 'mixed';
}

function pickEntryText(
  rng: ReturnType<typeof createRng>,
  texts: readonly string[],
  fallback: string,
): string {
  const cleaned = texts.map(text => text.trim()).filter(Boolean);
  if (cleaned.length === 0) return fallback;
  return rng.pick(cleaned);
}

function buildKeyStageParagraph(
  rng: ReturnType<typeof createRng>,
  stage: PillarLifeStage,
  kind: KeyStageKind,
): ReportParagraph {
  const entry = getLifeStageEncyclopediaEntry(stage.info.code);
  const pillar = PILLAR_SHORT[stage.position];
  const role = kind === 'peak' ? '가장 강한' : '가장 약한';

  const base = `${pillar} ${entry.koreanName}은 차트에서 에너지가 ${role} 구간이에요.`;
  const theme = `성장 주제: ${entry.growthTheme}`;
  const focus = kind === 'peak'
    ? `강점: ${pickEntryText(rng, entry.strengths, stage.info.shortDesc)}`
    : `주의: ${pickEntryText(rng, entry.cautions, stage.info.shortDesc)}`;
  const tip = `실전 팁: ${pickEntryText(rng, entry.practicalAdvice, '작게 시작해 꾸준히 이어가 보세요.')}`;

  const text = joinSentences(base, theme, focus, tip);
  return kind === 'peak' ? positive(text) : encouraging(text);
}

export function generateLifeStagesSection(input: ReportInput): ReportSection | null {
  const stages = extractLifeStages(input);
  if (stages.length === 0) return null;

  const rng = createRng(input);
  for (let i = 0; i < 20; i++) rng.next();

  const name = safeName(input);
  const paragraphs: ReportParagraph[] = [];

  paragraphs.push(narrative(pickAndFill(rng, INTRO_TEMPLATES, { name })));

  for (const stage of stages) {
    const entry = getLifeStageEncyclopediaEntry(stage.info.code);
    const metaphor = STAGE_METAPHOR[stage.info.code] ?? stage.info.meaning;

    const pillarText = pickAndFill(rng, PILLAR_INTRO_TEMPLATES, {
      pillar: PILLAR_KOREAN[stage.position],
      lifePhase: PILLAR_LIFE_PHASE[stage.position],
      stageName: stage.info.korean,
      hanja: stage.info.hanja,
      metaphor,
      energy: String(stage.info.energy),
    });

    const coachingText = pickEntryText(rng, entry.practicalAdvice, stage.info.shortDesc);
    paragraphs.push(narrative(joinSentences(pillarText, `코칭: ${coachingText}`)));
  }

  if (stages.length === 4) {
    const arc = stages
      .map(stage => `${PILLAR_SHORT[stage.position]} ${STAGE_METAPHOR[stage.info.code] ?? stage.info.meaning}`)
      .join(' → ');
    paragraphs.push(emphasis(`${name}님의 4주 흐름은 ${arc} 순서로 이어집니다.`));
  }

  const energies = stages.map(stage => stage.info.energy);
  const avgEnergy = energies.reduce((sum, energy) => sum + energy, 0) / energies.length;
  const pattern = classifyPattern(energies);

  paragraphs.push(emphasis(pickAndFill(rng, PATTERN_NARRATIVE[pattern], { name })));

  const peakStage = stages.reduce((max, stage) => (
    stage.info.energy > max.info.energy ? stage : max
  ), stages[0]);
  const lowStage = stages.reduce((min, stage) => (
    stage.info.energy < min.info.energy ? stage : min
  ), stages[0]);

  paragraphs.push(buildKeyStageParagraph(rng, peakStage, 'peak'));
  if (peakStage.position !== lowStage.position || peakStage.info.code !== lowStage.info.code) {
    paragraphs.push(buildKeyStageParagraph(rng, lowStage, 'low'));
  } else {
    paragraphs.push(narrative('네 기둥의 에너지 편차가 작아 특정 약점 구간이 크지 않아요. 균형 운영이 강점입니다.'));
  }

  if (avgEnergy >= 8) {
    paragraphs.push(positive(pickAndFill(rng, HIGH_ENERGY_TEMPLATES, {
      name,
      avg: avgEnergy.toFixed(1),
    })));
  } else if (avgEnergy <= 4) {
    paragraphs.push(encouraging(pickAndFill(rng, LOW_ENERGY_TEMPLATES, {
      name,
      avg: avgEnergy.toFixed(1),
    })));
  } else {
    paragraphs.push(narrative(pickAndFill(rng, MID_ENERGY_TEMPLATES, {
      name,
      avg: avgEnergy.toFixed(1),
    })));
  }

  paragraphs.push(encouraging(pickAndFill(rng, CLOSING_TEMPLATES, { name })));

  const table: ReportTable = {
    title: '4주 12운성 에너지 요약',
    headers: ['기둥', '12운성', '한자', '에너지', '핵심 의미', '한 줄 해설'],
    rows: stages.map(stage => {
      const entry = getLifeStageEncyclopediaEntry(stage.info.code);
      return [
        PILLAR_SHORT[stage.position],
        stage.info.korean,
        stage.info.hanja,
        `${stage.info.energy}/12`,
        STAGE_METAPHOR[stage.info.code] ?? stage.info.meaning,
        entry.growthTheme,
      ];
    }),
  };

  const chartData: Record<string, number> = {};
  for (const stage of stages) {
    chartData[PILLAR_SHORT[stage.position]] = stage.info.energy;
  }

  const lineChart: ReportChart = {
    type: 'line',
    title: '4주 에너지 흐름',
    data: chartData,
    meta: {
      maxScale: 12,
      minScale: 0,
      pattern: PATTERN_LABELS[pattern],
      average: Math.round(avgEnergy * 10) / 10,
    },
  };

  const highlights: ReportHighlight[] = [
    {
      label: '최고 에너지',
      value: `${PILLAR_SHORT[peakStage.position]} ${peakStage.info.korean}(${peakStage.info.energy}/12)`,
      sentiment: 'good',
    },
    {
      label: '최저 에너지',
      value: `${PILLAR_SHORT[lowStage.position]} ${lowStage.info.korean}(${lowStage.info.energy}/12)`,
      sentiment: 'neutral',
    },
    {
      label: '평균 에너지',
      value: `${avgEnergy.toFixed(1)}/12`,
      sentiment: avgEnergy >= 7 ? 'good' : avgEnergy >= 4 ? 'neutral' : 'caution',
    },
    {
      label: '에너지 패턴',
      value: PATTERN_LABELS[pattern],
      sentiment: 'neutral',
    },
  ];

  return {
    id: 'lifeStages',
    title: '12운성 에너지 분석',
    subtitle: '인생 단계별 에너지 흐름을 읽어드립니다',
    paragraphs,
    tables: [table],
    charts: [lineChart],
    highlights,
  };
}
