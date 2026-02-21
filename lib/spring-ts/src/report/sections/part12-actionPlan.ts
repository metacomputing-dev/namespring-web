/**
 * part12-actionPlan.ts
 *
 * PART 12: Action Plan
 * - Builds a deterministic 7-day/30-day execution plan from Saju + naming signals.
 * - Integrates name-saju engine outputs with null-safe fallbacks.
 */

import type {
  ElementCode,
  ReportChart,
  ReportHighlight,
  ReportInput,
  ReportParagraph,
  ReportSection,
  ReportTable,
} from '../types.js';

import {
  ELEMENT_CONTROLLED_BY,
  ELEMENT_GENERATED_BY,
  ELEMENT_GENERATES,
  ELEMENT_CONTROLS,
  ELEMENT_KOREAN_SHORT,
} from '../common/elementMaps.js';

import {
  caution,
  emphasis,
  encouraging,
  narrative,
  tip,
} from '../common/sentenceUtils.js';

import {
  buildSajuNameIntegrationSignals,
  type SajuNameIntegrationSignals,
} from '../common/sajuNameIntegration.js';

import {
  scoreNameAgainstSaju,
  type NamingScoreBreakdown,
} from '../common/namingScoreEngine.js';

const ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const ELEMENT_ALIAS: Readonly<Record<string, ElementCode>> = {
  MOK: 'WOOD',
  HWA: 'FIRE',
  TO: 'EARTH',
  GEUM: 'METAL',
  SU: 'WATER',
};

type StrengthBand = 'strong' | 'balanced' | 'weak';
type NamingFitLevel = 'good' | 'mid' | 'low' | 'unknown';
type IntegrationBalance = 'supportive' | 'neutral' | 'caution';

interface ElementRoutine {
  readonly morning: string;
  readonly daytime: string;
  readonly evening: string;
}

interface NamingFit {
  readonly score: number;
  readonly level: NamingFitLevel;
  readonly reason: string;
}

interface ActionSignals {
  readonly yong: ElementCode | null;
  readonly hee: ElementCode | null;
  readonly gi: ElementCode | null;
  readonly dayMaster: ElementCode | null;
  readonly strength: StrengthBand;
  readonly deficient: ElementCode[];
  readonly excessive: ElementCode[];
  readonly nameElements: ElementCode[];
  readonly suriElements: ElementCode[];
  readonly namingFit: NamingFit;
  readonly namingEngineScore: NamingScoreBreakdown | null;
  readonly integrationSignals: SajuNameIntegrationSignals | null;
  readonly integrationBalance: IntegrationBalance;
}

const ROUTINE_BY_ELEMENT: Readonly<Record<ElementCode, ElementRoutine>> = {
  WOOD: {
    morning: 'Open a window, stretch for 3 minutes, then pick one growth task.',
    daytime: 'Run one 30-minute build block before checking messages.',
    evening: 'Write one sentence about progress and one adjustment for tomorrow.',
  },
  FIRE: {
    morning: 'Take light movement for 5 minutes and set one communication goal.',
    daytime: 'Do one high-energy task first, then cool down with a short review.',
    evening: 'Lower stimulation for 10 minutes and reset emotional pace.',
  },
  EARTH: {
    morning: 'Start at a fixed time and tidy your desk for 5 minutes.',
    daytime: 'Use 25-minute focus + 5-minute break rhythm.',
    evening: 'List top 3 tasks for tomorrow in order.',
  },
  METAL: {
    morning: 'Remove five distractions before starting work.',
    daytime: 'Split work into start/in-progress/done and close one item fully.',
    evening: 'Choose completion over perfection and close the day cleanly.',
  },
  WATER: {
    morning: 'Take 2 minutes of quiet breathing and clear your head.',
    daytime: 'Use 20-minute focus + 5-minute reset cycles.',
    evening: 'Reduce screen time and transition to recovery early.',
  },
};

const DAY_THEMES: readonly string[] = [
  'Kickoff',
  'Rhythm lock',
  'Reinforcement',
  'Mid-check',
  'Execution',
  'Pace control',
  'Weekly review',
];

function safeName(input: ReportInput): string {
  return input.name?.trim() || 'friend';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

function normalizeElement(value: unknown): ElementCode | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();
  if ((ELEMENTS as readonly string[]).includes(upper)) {
    return upper as ElementCode;
  }

  return ELEMENT_ALIAS[upper] ?? null;
}

function normalizeElementArray(value: unknown): ElementCode[] {
  if (!Array.isArray(value)) return [];

  const out: ElementCode[] = [];
  for (const item of value) {
    const normalized = normalizeElement(item);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
}

function elementText(element: ElementCode | null): string {
  if (!element) return 'base';
  return ELEMENT_KOREAN_SHORT[element] ?? element;
}

function detectStrengthBand(input: ReportInput): StrengthBand {
  const strengthRaw = asRecord(input.saju?.strength);
  if (!strengthRaw) return 'balanced';

  const levelRaw = typeof strengthRaw.level === 'string' ? strengthRaw.level.toUpperCase() : '';
  if (levelRaw.includes('EXTREME_STRONG') || levelRaw === 'STRONG') return 'strong';
  if (levelRaw.includes('EXTREME_WEAK') || levelRaw === 'WEAK') return 'weak';
  if (levelRaw === 'BALANCED') return 'balanced';

  const isStrong = typeof strengthRaw.isStrong === 'boolean' ? strengthRaw.isStrong : null;
  const support = typeof strengthRaw.totalSupport === 'number' ? strengthRaw.totalSupport : null;
  const oppose = typeof strengthRaw.totalOppose === 'number' ? strengthRaw.totalOppose : null;

  if (support != null && oppose != null) {
    if (support > oppose + 0.3) return 'strong';
    if (oppose > support + 0.3) return 'weak';
  }

  if (isStrong === true) return 'strong';
  if (isStrong === false) return 'weak';
  return 'balanced';
}

function strengthLabel(strength: StrengthBand): string {
  if (strength === 'strong') return 'strong drive';
  if (strength === 'weak') return 'recovery-first';
  return 'balanced pace';
}

function extractNameElements(input: ReportInput): ElementCode[] {
  const fromCompatibility = normalizeElementArray(input.spring?.sajuCompatibility?.nameElements);
  if (fromCompatibility.length > 0) return fromCompatibility;

  const fromNaming = normalizeElementArray((input.naming?.name?.givenName ?? []).map(char => char.element));
  if (fromNaming.length > 0) return fromNaming;

  const fromSpringNaming = normalizeElementArray((input.spring?.namingReport?.name?.givenName ?? []).map(char => char.element));
  return fromSpringNaming;
}

function extractSuriElements(input: ReportInput): ElementCode[] {
  const namingRoot = asRecord(input.naming);
  const namingAnalysis = asRecord(namingRoot?.analysis);
  const fourFrame = asRecord(namingAnalysis?.fourFrame);
  const frames = Array.isArray(fourFrame?.frames) ? fourFrame.frames : [];
  const fromNaming = normalizeElementArray(frames.map(frame => asRecord(frame)?.element));
  if (fromNaming.length > 0) return fromNaming;

  const springRoot = asRecord(input.spring);
  const springNaming = asRecord(springRoot?.namingReport);
  const springAnalysis = asRecord(springNaming?.analysis);
  const springFourFrame = asRecord(springAnalysis?.fourFrame);
  const springFrames = Array.isArray(springFourFrame?.frames) ? springFourFrame.frames : [];
  return normalizeElementArray(springFrames.map(frame => asRecord(frame)?.element));
}

function evaluateNamingFit(
  nameElements: readonly ElementCode[],
  yong: ElementCode | null,
  hee: ElementCode | null,
  gi: ElementCode | null,
  dayMaster: ElementCode | null,
): NamingFit {
  if (nameElements.length === 0) {
    return {
      score: 50,
      level: 'unknown',
      reason: 'Name element data is missing, so baseline planning is used.',
    };
  }

  let points = 0;
  for (const element of nameElements) {
    if (yong && element === yong) {
      points += 2;
      continue;
    }
    if (hee && element === hee) {
      points += 1;
      continue;
    }
    if (gi && element === gi) {
      points -= 2;
      continue;
    }
    if (yong && ELEMENT_GENERATES[element] === yong) {
      points += 1;
      continue;
    }
    if (yong && ELEMENT_CONTROLS[element] === yong) {
      points -= 1;
      continue;
    }
    if (!yong && dayMaster && element === dayMaster) {
      points += 1;
    }
  }

  const score = clamp(Math.round(50 + (points * 12)), 0, 100);
  const level: NamingFitLevel =
    score >= 65 ? 'good' :
      score >= 45 ? 'mid' :
        'low';

  const reason =
    level === 'good'
      ? 'Name element flow is aligned with compensation direction.'
      : level === 'mid'
        ? 'Name element flow is neutral; routine reinforcement matters.'
        : 'Name element flow conflicts with compensation direction; pace control is important.';

  return { score, level, reason };
}

function safeScoreNameAgainstSaju(
  nameElements: readonly ElementCode[],
  suriElements: readonly ElementCode[],
  yong: ElementCode | null,
  hee: ElementCode | null,
  gi: ElementCode | null,
  deficient: readonly ElementCode[],
): NamingScoreBreakdown | null {
  if (nameElements.length === 0 && suriElements.length === 0) return null;

  try {
    return scoreNameAgainstSaju({
      nameElements: [...nameElements],
      suriElements: [...suriElements],
      yongshin: yong,
      heeshin: hee,
      gishin: gi,
      deficiency: [...deficient],
    });
  } catch {
    return null;
  }
}

function safeBuildIntegrationSignals(
  nameElements: readonly ElementCode[],
  suriElements: readonly ElementCode[],
  yong: ElementCode | null,
  hee: ElementCode | null,
  gi: ElementCode | null,
  deficient: readonly ElementCode[],
  excessive: readonly ElementCode[],
): SajuNameIntegrationSignals | null {
  if (nameElements.length === 0 && suriElements.length === 0) return null;

  try {
    return buildSajuNameIntegrationSignals({
      saju: {
        yongshinElement: yong,
        heeshinElement: hee,
        gishinElement: gi,
        deficientElements: deficient,
        excessiveElements: excessive,
      },
      naming: {
        resourceElements: nameElements,
        strokeElements: suriElements,
      },
      actionSuggestionCount: 4,
    });
  } catch {
    return null;
  }
}

function detectIntegrationBalance(
  namingEngineScore: NamingScoreBreakdown | null,
  integrationSignals: SajuNameIntegrationSignals | null,
): IntegrationBalance {
  const balanceScore = namingEngineScore?.categories.balance.score
    ?? namingEngineScore?.total
    ?? 50;
  const strengthCount = integrationSignals?.keySynergyStrengths.length ?? 0;
  const cautionCount = integrationSignals?.keyCautionPoints.length ?? 0;

  if (balanceScore >= 67 && strengthCount >= cautionCount) return 'supportive';
  if (balanceScore <= 42 || cautionCount >= strengthCount + 2) return 'caution';
  return 'neutral';
}

function mergeNamingFit(
  base: NamingFit,
  namingEngineScore: NamingScoreBreakdown | null,
  integrationBalance: IntegrationBalance,
): NamingFit {
  if (!namingEngineScore) return base;

  const engineScore = namingEngineScore.total;
  const balanceScore = namingEngineScore.categories.balance.score;
  const score = clamp(Math.round((base.score * 0.4) + (engineScore * 0.6)), 0, 100);

  let level: NamingFitLevel =
    score >= 65 ? 'good' :
      score >= 45 ? 'mid' :
        'low';

  if (integrationBalance === 'caution' && level === 'good' && score < 75) {
    level = 'mid';
  }
  if (integrationBalance === 'supportive' && level === 'mid' && score >= 60) {
    level = 'good';
  }

  return {
    score,
    level,
    reason: `${base.reason} Integration ${engineScore}/100 (balance ${balanceScore}/100).`,
  };
}

function deriveSignals(input: ReportInput): ActionSignals {
  const yong = normalizeElement(input.spring?.sajuCompatibility?.yongshinElement)
    ?? normalizeElement(input.saju?.yongshin?.element);
  const hee = normalizeElement(input.spring?.sajuCompatibility?.heeshinElement)
    ?? normalizeElement(input.saju?.yongshin?.heeshin);
  const gi = normalizeElement(input.spring?.sajuCompatibility?.gishinElement)
    ?? normalizeElement(input.saju?.yongshin?.gishin);
  const dayMaster = normalizeElement(input.saju?.dayMaster?.element);

  const deficient = normalizeElementArray(input.saju?.deficientElements);
  const excessive = normalizeElementArray(input.saju?.excessiveElements);
  const nameElements = extractNameElements(input);
  const suriElements = extractSuriElements(input);
  const strength = detectStrengthBand(input);

  const baseNamingFit = evaluateNamingFit(nameElements, yong, hee, gi, dayMaster);
  const namingEngineScore = safeScoreNameAgainstSaju(
    nameElements,
    suriElements,
    yong,
    hee,
    gi,
    deficient,
  );
  const integrationSignals = safeBuildIntegrationSignals(
    nameElements,
    suriElements,
    yong,
    hee,
    gi,
    deficient,
    excessive,
  );
  const integrationBalance = detectIntegrationBalance(namingEngineScore, integrationSignals);
  const namingFit = mergeNamingFit(baseNamingFit, namingEngineScore, integrationBalance);

  return {
    yong,
    hee,
    gi,
    dayMaster,
    strength,
    deficient,
    excessive,
    nameElements,
    suriElements,
    namingFit,
    namingEngineScore,
    integrationSignals,
    integrationBalance,
  };
}

function pickSupportElement(signal: ActionSignals): ElementCode {
  return signal.yong ?? signal.deficient[0] ?? signal.dayMaster ?? 'EARTH';
}

function pickSecondaryElement(signal: ActionSignals, support: ElementCode): ElementCode {
  return signal.hee ?? signal.deficient[1] ?? ELEMENT_GENERATED_BY[support];
}

function pickCautionElement(signal: ActionSignals, support: ElementCode): ElementCode {
  return signal.gi ?? signal.excessive[0] ?? ELEMENT_CONTROLLED_BY[support];
}

function namingLevelText(level: NamingFitLevel): string {
  if (level === 'good') return 'good';
  if (level === 'mid') return 'mid';
  if (level === 'low') return 'low';
  return 'unknown';
}

function integrationBalanceText(balance: IntegrationBalance): string {
  if (balance === 'supportive') return 'supportive';
  if (balance === 'caution') return 'caution';
  return 'neutral';
}

function namingTask(level: NamingFitLevel, day: number, support: ElementCode): string {
  const supportText = elementText(support);
  const mod = (day - 1) % 3;

  if (level === 'good') {
    return mod === 0
      ? 'Say your name cue and commit one key goal.'
      : mod === 1
        ? 'Write one line linking name energy to today.'
        : 'Start one task with your name cue and close it.';
  }

  if (level === 'mid') {
    return mod === 0
      ? 'Read your name slowly and choose one clear priority.'
      : mod === 1
        ? `Use one ${supportText} reinforcement sentence and plan one next step.`
        : 'Log one action where your name cue improved focus.';
  }

  if (level === 'low') {
    return mod === 0
      ? `Keep routine simple and do one ${supportText} support action first.`
      : mod === 1
        ? 'Skip self-critique and check one completed action only.'
        : 'Prioritize execution over score checking.';
  }

  return mod === 0
    ? 'Write one gratitude line and one task for tomorrow.'
    : mod === 1
      ? 'Complete one small task and mark it done.'
      : 'Run a simple 10-minute routine.';
}

function refineNamingTaskWithIntegration(
  baseTask: string,
  integrationBalance: IntegrationBalance,
  day: number,
): string {
  if (integrationBalance === 'caution') {
    return `${baseTask} / integration caution: run at 80% pace + one extra review.`;
  }
  if (integrationBalance === 'supportive' && day % 2 === 1) {
    return `${baseTask} / integration strength: keep momentum and close one extra step.`;
  }
  return baseTask;
}

function pickDailyIntegrationAction(signal: ActionSignals, day: number): string | null {
  const suggestions = signal.integrationSignals?.dailyActionSuggestions ?? [];
  if (suggestions.length === 0) return null;
  return suggestions[(day - 1) % suggestions.length] ?? null;
}

function daytimeFocus(
  strength: StrengthBand,
  support: ElementCode,
  day: number,
  integrationBalance: IntegrationBalance,
): string {
  const supportText = elementText(support);
  const focusBlock =
    strength === 'strong'
      ? 'Deep work 45m + review 10m'
      : strength === 'weak'
        ? 'Deep work 20m + break 5m + deep work 20m'
        : 'Deep work 30m + organize 10m';

  let text = day === 4
    ? `${focusBlock} / mid-week check: adjust only one small part.`
    : day === 7
      ? `${focusBlock} / weekly review 30m and set one next target.`
      : `${focusBlock} / add one ${supportText} support action.`;

  if (integrationBalance === 'caution') {
    text = `${text} Integration signal: pace control is priority.`;
  } else if (integrationBalance === 'supportive' && day === 3) {
    text = `${text} Integration signal: push one key task to done.`;
  }

  return text;
}

function buildMicroPlanTable(
  signal: ActionSignals,
  support: ElementCode,
  secondary: ElementCode,
  cautionElement: ElementCode,
): ReportTable {
  const rows: string[][] = [];

  for (let day = 1; day <= 7; day += 1) {
    const baseElement = day % 2 === 0 ? secondary : support;
    const routine = ROUTINE_BY_ELEMENT[baseElement];
    const cautionText = elementText(cautionElement);

    const checkText =
      day === 4
        ? 'Check: if completion drops, reduce load by 20% instead of resetting whole plan.'
        : day === 7
          ? 'Check: keep two wins and one lesson, then carry forward one routine.'
          : `Check: if ${cautionText} overload appears, pause 10 minutes then resume.`;

    const baseNamingTask = namingTask(signal.namingFit.level, day, support);
    const namingPlan = refineNamingTaskWithIntegration(
      baseNamingTask,
      signal.integrationBalance,
      day,
    );
    const integrationAction = pickDailyIntegrationAction(signal, day);
    const eveningPlan = integrationAction
      ? `${ROUTINE_BY_ELEMENT[support].evening} / ${namingPlan} / ${integrationAction}`
      : `${ROUTINE_BY_ELEMENT[support].evening} / ${namingPlan}`;

    rows.push([
      `Day ${day} (${DAY_THEMES[day - 1]})`,
      `${elementText(baseElement)} morning: ${routine.morning}`,
      daytimeFocus(signal.strength, support, day, signal.integrationBalance),
      eveningPlan,
      checkText,
    ]);
  }

  return {
    title: 'Next 7-day micro plan',
    headers: ['Day', 'Morning routine', 'Day focus', 'Evening routine', 'Check signal'],
    rows,
  };
}

function buildThirtyDayTable(
  signal: ActionSignals,
  support: ElementCode,
  cautionElement: ElementCode,
): ReportTable {
  const supportText = elementText(support);
  const cautionText = elementText(cautionElement);
  const namingEngineScore = signal.namingEngineScore?.total ?? signal.namingFit.score;
  const integrationSummary = signal.integrationSignals?.elementHarmonySummary ?? null;
  const firstIntegrationStrength = signal.integrationSignals?.keySynergyStrengths[0] ?? null;
  const firstIntegrationCaution = signal.integrationSignals?.keyCautionPoints[0] ?? null;
  const firstIntegrationAction = signal.integrationSignals?.dailyActionSuggestions[0] ?? null;

  const namingText = signal.nameElements.length > 0
    ? `${signal.nameElements.map(elementText).join(', ')} naming routine`
    : 'Name element data missing: use baseline reflection routine';

  const weekOneMethod = firstIntegrationStrength
    ? `${supportText} support routine fixed for 7 days / ${firstIntegrationStrength}`
    : `${supportText} support routine fixed for 7 days`;

  const namingMethod = integrationSummary
    ? `${namingText} / ${integrationSummary}`
    : `${namingText} / integration score ${namingEngineScore}/100`;

  const cautionMethod = firstIntegrationCaution
    ? `${cautionText} overload signal: reduce schedule 20% / ${firstIntegrationCaution}`
    : `${cautionText} overload signal: reduce schedule 20%`;

  const closingMethod = firstIntegrationAction
    ? `Keep one stable routine for 30 days / ${firstIntegrationAction}`
    : 'Keep one stable routine for 30 days';

  return {
    title: 'Next 30-day focus plan',
    headers: ['Range', 'Primary goal', 'Execution method', 'Completion bar'],
    rows: [
      [
        'Days 1-7',
        'Routine lock-in',
        weekOneMethod,
        'At least 5 days completed',
      ],
      [
        'Days 8-14',
        'Single-task focus',
        `One deep-focus block per day (${strengthLabel(signal.strength)})`,
        'Close one important task',
      ],
      [
        'Days 15-21',
        'Name-action alignment',
        namingMethod,
        'Write 5+ daily check notes',
      ],
      [
        'Days 22-28',
        'Overload prevention',
        cautionMethod,
        'No large plan reset',
      ],
      [
        'Days 29-30',
        'Review + next cycle setup',
        closingMethod,
        'Choose one routine to carry forward',
      ],
    ],
  };
}

function buildCautionChecklistTable(cautionElement: ElementCode): ReportTable {
  const cautionText = elementText(cautionElement);
  return {
    title: 'Overreaction prevention checklist',
    headers: ['Check item', 'Why it matters', 'Today rule'],
    rows: [
      [
        'Are you trying to replace the whole plan after one bad day?',
        'Hard pivots break execution continuity.',
        'Adjust only 20% once per week.',
      ],
      [
        'Did you set a target larger than your current energy?',
        'Overloaded starts collapse the next day.',
        'Reduce volume first, keep the same start time.',
      ],
      [
        'Are you comparing your pace to others right now?',
        'Comparison amplifies caution patterns and weakens focus.',
        'Compare only today vs your own yesterday.',
      ],
      [
        `Do you see ${cautionText} overload signs (rush, hard tone, impulsive decisions)?`,
        'Escalated emotional state increases error rate.',
        'Pause 10 minutes and restart with one small task.',
      ],
      [
        'Are you checking scores more than actions?',
        'Score follows repeated execution, not the other way around.',
        'Complete one action before any score check.',
      ],
    ],
  };
}

function buildPriorityChart(
  signal: ActionSignals,
  support: ElementCode,
  cautionElement: ElementCode,
): ReportChart {
  const namingEngineTotal = signal.namingEngineScore?.total ?? signal.namingFit.score;
  const namingBalanceScore = signal.namingEngineScore?.categories.balance.score ?? signal.namingFit.score;
  const integrationSupportBias =
    signal.integrationBalance === 'supportive'
      ? 5
      : signal.integrationBalance === 'caution'
        ? -3
        : 0;
  const integrationCautionBias =
    signal.integrationBalance === 'caution'
      ? 8
      : signal.integrationBalance === 'supportive'
        ? -4
        : 0;

  const strengthLoad = clamp(
    (
      signal.strength === 'strong'
        ? 82
        : signal.strength === 'weak'
          ? 66
          : 74
    ) + integrationSupportBias,
    0,
    100,
  );

  const cautionLoad = clamp(
    (
      (signal.excessive.length > 0 || signal.gi)
        ? 80
        : 68
    ) + integrationCautionBias + (namingBalanceScore < 45 ? 5 : 0),
    0,
    100,
  );

  const recoveryLoad = clamp(
    (
      signal.strength === 'weak'
        ? 84
        : 70
    ) + (signal.integrationBalance === 'caution'
      ? 6
      : signal.integrationBalance === 'supportive'
        ? -2
        : 0),
    0,
    100,
  );

  const routineLoad = clamp(
    (signal.deficient.length > 0 ? 78 : 72)
    + (namingEngineTotal < 45 ? 6 : namingEngineTotal >= 70 ? -2 : 2),
    0,
    100,
  );

  return {
    type: 'bar',
    title: '30-day priority chart (0-100)',
    data: {
      'Routine lock': routineLoad,
      'Deep focus': strengthLoad,
      'Naming usage': namingEngineTotal,
      'Overload prevention': cautionLoad,
      'Recovery/review': recoveryLoad,
    },
    meta: {
      supportElement: support,
      cautionElement,
      supportElementLabel: elementText(support),
      cautionElementLabel: elementText(cautionElement),
      namingLevel: signal.namingFit.level,
      integrationBalance: signal.integrationBalance,
      namingBalanceScore,
    },
  };
}

function buildHighlights(
  signal: ActionSignals,
  support: ElementCode,
  cautionElement: ElementCode,
): ReportHighlight[] {
  const integrationScore = signal.namingEngineScore?.total ?? signal.namingFit.score;
  const integrationSentiment: ReportHighlight['sentiment'] =
    signal.integrationBalance === 'supportive'
      ? 'good'
      : signal.integrationBalance === 'caution'
        ? 'caution'
        : 'neutral';

  return [
    {
      label: 'Saju core direction',
      value: `${elementText(support)} support / ${strengthLabel(signal.strength)}`,
      element: support,
      sentiment: 'good',
    },
    {
      label: 'Naming synergy',
      value: `${integrationScore}/100 (${namingLevelText(signal.namingFit.level)})`,
      sentiment:
        signal.namingFit.level === 'good'
          ? 'good'
          : signal.namingFit.level === 'low'
            ? 'caution'
            : 'neutral',
    },
    {
      label: 'Integration balance',
      value: `${integrationScore}/100 (${integrationBalanceText(signal.integrationBalance)})`,
      sentiment: integrationSentiment,
    },
    {
      label: '7-day start rule',
      value: 'Keep one morning routine + one deep-focus block + one evening check.',
      sentiment: 'neutral',
    },
    {
      label: '30-day goal',
      value: 'Do fewer things, but close one important task each week.',
      sentiment: 'good',
    },
    {
      label: 'Overload watch signal',
      value: `${elementText(cautionElement)} overload response (impulse/speed/emotion spike)`,
      element: cautionElement,
      sentiment: 'caution',
    },
  ];
}

export function generateActionPlanSection(input: ReportInput): ReportSection | null {
  try {
    const name = safeName(input);
    const signal = deriveSignals(input);

    const support = pickSupportElement(signal);
    const secondary = pickSecondaryElement(signal, support);
    const cautionElement = pickCautionElement(signal, support);

    const supportText = elementText(support);
    const secondaryText = elementText(secondary);
    const cautionText = elementText(cautionElement);

    const fallbackSaju = !signal.yong && !signal.dayMaster && signal.deficient.length === 0;
    const fallbackNaming = signal.nameElements.length === 0 && signal.suriElements.length === 0;

    const integrationSummary = signal.integrationSignals?.elementHarmonySummary;

    const paragraphs: ReportParagraph[] = [
      narrative(
        `${name}'s action plan ties saju and naming signals into one execution path: ` +
        `support=${supportText}, secondary=${secondaryText}, caution=${cautionText}.`,
        support,
      ),
      emphasis(
        'For the next 7 days, keep the plan narrow: one stable morning start, one deep-focus block, one evening check.',
        support,
      ),
      tip(
        'For the next 30 days, move by weekly phases: lock routine, close one key task, align naming behavior, then prevent overload.',
      ),
      tip(`Naming fit summary: ${signal.namingFit.reason}`),
      caution(
        `Important: do not replace the whole plan after one bad day. If ${cautionText} overload appears, pause 10 minutes and restart smaller.`,
        cautionElement,
      ),
      encouraging(
        'Consistency beats intensity. Repeated execution over 30 days is the primary success condition.',
      ),
    ];

    if (integrationSummary) {
      paragraphs.push(
        tip(`Integration summary: ${integrationSummary}`),
      );
    }

    if (fallbackSaju) {
      paragraphs.push(
        caution(
          'Core saju compensation data is limited. Baseline deterministic routines are used as a safe fallback.',
        ),
      );
    }

    if (fallbackNaming) {
      paragraphs.push(
        narrative(
          'Naming signal data is limited. The plan keeps name steps simple and action-first.',
        ),
      );
    }

    const microPlanTable = buildMicroPlanTable(signal, support, secondary, cautionElement);
    const thirtyDayTable = buildThirtyDayTable(signal, support, cautionElement);
    const cautionTable = buildCautionChecklistTable(cautionElement);
    const chart = buildPriorityChart(signal, support, cautionElement);
    const highlights = buildHighlights(signal, support, cautionElement);

    return {
      id: 'actionPlan',
      title: 'Action Plan',
      subtitle: 'Saju + naming integrated into deterministic 7-day and 30-day execution.',
      paragraphs,
      tables: [microPlanTable, thirtyDayTable, cautionTable],
      charts: [chart],
      highlights,
    };
  } catch {
    return null;
  }
}