import { buildLifeFortuneOverviewCard } from '../../src/report/cards/life-fortune-overview-card.js';

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

const highConflictConsensus = {
  eokbu: { element: 'METAL', score: 1, scores: {}, evidence: [] },
  johu: { element: 'FIRE', score: 1, scores: {}, evidence: [] },
  gyeokguk: { element: 'WOOD', score: 1, scores: {}, evidence: [] },
  tonggwan: { element: 'WOOD', score: 1, scores: {}, evidence: [] },
  byeongyak: { element: 'METAL', score: 1, scores: {}, evidence: [] },
  siksangFlow: { element: 'WOOD', score: 1, scores: {}, evidence: [] },
  final: {
    element: 'METAL',
    confidence: 0.41,
    topMargin: 0.41,
    conflictLevel: 'high',
    competingElements: ['FIRE', 'WOOD'],
    evidence: [],
  },
};

const lowConfidenceSaju = {
  pillars: {} as any,
  timeCorrection: {} as any,
  dayMaster: { stem: '계', element: 'WATER', polarity: '음' },
  strength: {
    level: 'WEAK',
    isStrong: false,
    totalSupport: 2.4,
    totalOppose: 5.6,
    deukryeong: 2.1,
    deukji: 0.3,
    deukse: 2.4,
    details: [],
  },
  yongshin: {
    element: 'METAL',
    heeshin: 'WATER',
    gishin: 'FIRE',
    gushin: 'EARTH',
    confidence: 41,
    agreement: 'ranking',
    recommendations: [],
    consensus: highConflictConsensus,
  },
  yongshinConsensus: highConflictConsensus,
  gyeokguk: { type: 'SIK_SIN', category: 'NORMAL', confidence: 0.52 },
  elementDistribution: { WOOD: 3, FIRE: 2, EARTH: 1, METAL: 0, WATER: 2 },
  deficientElements: ['EARTH', 'METAL'],
  excessiveElements: ['WOOD', 'FIRE', 'WATER'],
  cheonganRelations: [],
  jijiRelations: [],
  tenGodAnalysis: null,
  shinsalHits: [{ type: '형살', position: '기타', grade: 'B', weightedScore: 50 }],
  gongmang: null,
  axisStrength: { yongshin: 'deferred', strength: 'deferred', gyeokguk: 'candidate' },
} as any;

console.log('Life fortune yongshin confidence\n');

const card = buildLifeFortuneOverviewCard(lowConfidenceSaju);
const balancedKoreanStrengthCard = buildLifeFortuneOverviewCard({
  ...lowConfidenceSaju,
  strength: {
    ...lowConfidenceSaju.strength,
    level: '중화',
    isStrong: false,
    totalSupport: 4,
    totalOppose: 4,
  },
  yongshin: {
    ...lowConfidenceSaju.yongshin,
    confidence: 90,
  },
  yongshinConsensus: {
    ...highConflictConsensus,
    final: {
      ...highConflictConsensus.final,
      confidence: 0.9,
      conflictLevel: 'none',
      competingElements: [],
    },
  },
  axisStrength: { yongshin: 'definite', strength: 'definite', gyeokguk: 'candidate' },
  deficientElements: [],
  excessiveElements: [],
  shinsalHits: [],
} as any);
const balancedTendencyStrengthCard = buildLifeFortuneOverviewCard({
  ...lowConfidenceSaju,
  strength: {
    ...lowConfidenceSaju.strength,
    level: '중화(신약 경향)',
    isStrong: false,
    totalSupport: 3.8,
    totalOppose: 4.2,
  },
  yongshin: {
    ...lowConfidenceSaju.yongshin,
    confidence: 90,
  },
  yongshinConsensus: {
    ...highConflictConsensus,
    final: {
      ...highConflictConsensus.final,
      confidence: 0.9,
      conflictLevel: 'none',
      competingElements: [],
    },
  },
  axisStrength: { yongshin: 'definite', strength: 'practical', gyeokguk: 'candidate' },
  deficientElements: [],
  excessiveElements: [],
  shinsalHits: [],
} as any);
const letterGradeShinsalCard = buildLifeFortuneOverviewCard({
  ...lowConfidenceSaju,
  strength: {
    ...lowConfidenceSaju.strength,
    level: '중화',
    isStrong: false,
    totalSupport: 4,
    totalOppose: 4,
  },
  yongshin: {
    ...lowConfidenceSaju.yongshin,
    confidence: 90,
  },
  yongshinConsensus: {
    ...highConflictConsensus,
    final: {
      ...highConflictConsensus.final,
      confidence: 0.9,
      conflictLevel: 'none',
      competingElements: [],
    },
  },
  axisStrength: { yongshin: 'definite', strength: 'definite', gyeokguk: 'candidate' },
  deficientElements: [],
  excessiveElements: [],
  shinsalHits: [{ type: '천월덕', position: '월주', grade: 'A', weightedScore: 100 }],
} as any);

function cardAtConfidencePoints(confidence: number) {
  return buildLifeFortuneOverviewCard({
    ...lowConfidenceSaju,
    strength: {
      ...lowConfidenceSaju.strength,
      level: '중화',
      totalSupport: 4,
      totalOppose: 4,
    },
    yongshin: {
      ...lowConfidenceSaju.yongshin,
      confidence,
    },
    yongshinConsensus: {
      ...highConflictConsensus,
      final: {
        ...highConflictConsensus.final,
        confidence: 0.9,
        conflictLevel: 'none',
        competingElements: [],
      },
    },
    axisStrength: { yongshin: 'definite', strength: 'definite', gyeokguk: 'candidate' },
    deficientElements: [],
    excessiveElements: [],
    shinsalHits: [],
  } as any);
}

const confidenceBoundaryStars = new Map([
  [0, cardAtConfidencePoints(0).stars],
  [1, cardAtConfidencePoints(1).stars],
  [1.0001, cardAtConfidencePoints(1.0001).stars],
  [100, cardAtConfidencePoints(100).stars],
]);

check('percentage yongshin confidence is normalized before scoring',
  card.stars === 2,
  `stars=${card.stars}`);
check('summary hedges high-conflict yongshin guidance',
  card.summary.includes('보완 후보') && card.summary.includes('더 안전해요'),
  card.summary);
check('highlights avoid definite yongshin wording',
  card.highlights.includes('용신 후보는 쇠 기운이에요') &&
    !card.highlights.includes('용신은 쇠 기운이에요'),
  JSON.stringify(card.highlights));
check('evidence still carries the selected yongshin candidate',
  card.evidence?.some((row) =>
    row.axis === 'yongshin' &&
    row.supportingFeatures.some((feature) => feature.includes('\uC1E0')) &&
    row.strength === 'deferred') === true,
  JSON.stringify(card.evidence?.find((row) => row.axis === 'yongshin')));
check('Korean balanced strength level receives balanced scoring',
  balancedKoreanStrengthCard.stars === 5,
  `stars=${balancedKoreanStrengthCard.stars}`);
check('Korean balanced strength level receives balanced highlight wording',
  balancedKoreanStrengthCard.highlights.includes('에너지 균형이 잘 잡혀 있어요 (중화)'),
  JSON.stringify(balancedKoreanStrengthCard.highlights));
check('parenthetical Korean balanced tendency receives balanced scoring',
  balancedTendencyStrengthCard.stars === 5,
  `stars=${balancedTendencyStrengthCard.stars}`);
check('parenthetical Korean balanced tendency keeps display label',
  balancedTendencyStrengthCard.highlights.includes('에너지 균형이 잘 잡혀 있어요 (중화(신약 경향))'),
  JSON.stringify(balancedTendencyStrengthCard.highlights));
check('letter-grade shinsal remains neutral rather than zero-scored',
  letterGradeShinsalCard.stars === 5,
  `stars=${letterGradeShinsalCard.stars}`);
check('0 confidence points stay at the zero-confidence star boundary',
  confidenceBoundaryStars.get(0) === 4,
  `stars=${confidenceBoundaryStars.get(0)}`);
check('1 confidence point means 0.01 ratio rather than full confidence',
  confidenceBoundaryStars.get(1) === 4,
  `stars=${confidenceBoundaryStars.get(1)}`);
check('1.0001 confidence points remain continuous with 1 point',
  confidenceBoundaryStars.get(1.0001) === 4,
  `stars=${confidenceBoundaryStars.get(1.0001)}`);
check('100 confidence points map to the full-confidence star boundary',
  confidenceBoundaryStars.get(100) === 5,
  `stars=${confidenceBoundaryStars.get(100)}`);

console.log(`\nLife fortune yongshin confidence: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
