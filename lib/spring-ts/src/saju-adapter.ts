/**
 * saju-adapter.ts
 *
 * Translates raw saju-ts output into the SajuSummary format used by the rest
 * of the Spring engine. Adapted from the feature branch to use local scoring
 * imports instead of name-ts.
 */
import { type ElementKey, emptyDistribution } from './scoring.js';
import type { SajuOutputSummary, SpringRequest, SajuSummary, PillarSummary, BirthInfo } from './types.js';

import cheonganJijiConfig from '../config/cheongan-jiji.json';
import engineConfig from '../config/engine.json';
import sajuScoringConfig from '../config/saju-scoring.json';

const ELEMENT_CODE_TO_KEY: Record<string, ElementKey> = cheonganJijiConfig.elementCodeToKey as Record<string, ElementKey>;
const ELEMENT_CODES: readonly string[] = cheonganJijiConfig.elementCodes;
const CHEONGAN: Record<string, { hangul: string; hanja: string; element: string; polarity: string }> = cheonganJijiConfig.cheongan;
const JIJI: Record<string, { hangul: string; hanja: string }> = cheonganJijiConfig.jiji;
const TEN_GOD_GROUP: Record<string, string> = sajuScoringConfig.tenGodGroups;
const PRESET_MAP: Record<string, string> = engineConfig.presetMapping;
const SAJU_MODULE_PATH: string = engineConfig.sajuModulePath;
const DEFAULT_LATITUDE: number = engineConfig.defaultCoordinates.latitude;
const DEFAULT_LONGITUDE: number = engineConfig.defaultCoordinates.longitude;
const DEFAULT_TIMEZONE: string = engineConfig.defaultTimezone;

const TC_KEYS = [
  'standardYear', 'standardMonth', 'standardDay', 'standardHour', 'standardMinute',
  'adjustedYear', 'adjustedMonth', 'adjustedDay', 'adjustedHour', 'adjustedMinute',
  'dstCorrectionMinutes', 'longitudeCorrectionMinutes', 'equationOfTimeMinutes',
] as const;

// ---------------------------------------------------------------------------
// Public: element code conversion
// ---------------------------------------------------------------------------

export function elementFromSajuCode(value: string | null | undefined): ElementKey | null {
  return value != null ? (ELEMENT_CODE_TO_KEY[value.toUpperCase()] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Saju module loading (lazy, singleton)
// ---------------------------------------------------------------------------

type SajuModule = {
  analyzeSaju: (input: any, config?: any, options?: any) => any;
  createBirthInput: (params: any) => any;
  configFromPreset?: (preset: string) => any;
};

let sajuModule: SajuModule | null = null;

async function loadSajuModule(): Promise<SajuModule | null> {
  if (sajuModule) return sajuModule;

  const candidates = [
    SAJU_MODULE_PATH,
    SAJU_MODULE_PATH.replace('/src/', '/dist/'),
  ];

  for (const modulePath of candidates) {
    try {
      sajuModule = await (Function('p', 'return import(p)')(modulePath)) as SajuModule;
      return sajuModule;
    } catch {
      // try next candidate
    }
  }

  console.warn(
    '[spring-ts] saju-ts 모듈 로드 실패. 사주 분석이 비활성화됩니다.',
    `시도한 경로: ${candidates.join(', ')}`,
  );
  return null;
}

// ---------------------------------------------------------------------------
// Small utility helpers
// ---------------------------------------------------------------------------

function ensureArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function toNullableString(value: any): string | null {
  return value != null ? String(value) : null;
}

function extractNumericFields(source: any, keys: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of keys) result[key] = Number(source?.[key]) || 0;
  return result;
}

function deepSerialize(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (value instanceof Map) {
    const plain: Record<string, unknown> = {};
    for (const [key, val] of value) plain[String(key)] = deepSerialize(val);
    return plain;
  }
  if (value instanceof Set) return [...value].map(item => deepSerialize(item));
  if (Array.isArray(value)) return value.map(item => deepSerialize(item));

  const plain: Record<string, unknown> = {};
  for (const key of Object.keys(value as any)) plain[key] = deepSerialize((value as any)[key]);
  return plain;
}

function toStringArray(value: any): string[] {
  if (!value) return [];
  if (value instanceof Set) return [...value].map(String);
  if (Array.isArray(value)) return value.map(String);
  return [];
}

// ---------------------------------------------------------------------------
// Public: empty SajuSummary (fallback when analysis fails)
// ---------------------------------------------------------------------------

export function emptySaju(): SajuSummary {
  const emptyPillar: PillarSummary = {
    stem:   { code: '', hangul: '', hanja: '' },
    branch: { code: '', hangul: '', hanja: '' },
  };
  return {
    pillars: { year: emptyPillar, month: emptyPillar, day: emptyPillar, hour: emptyPillar },
    timeCorrection: extractNumericFields(null, TC_KEYS) as any,
    dayMaster: { stem: '', element: '', polarity: '' },
    strength: {
      level: '', isStrong: false,
      totalSupport: 0, totalOppose: 0,
      deukryeong: 0, deukji: 0, deukse: 0,
      details: [],
    },
    yongshin: {
      element: 'WOOD', heeshin: null, gishin: null, gushin: null,
      confidence: 0, agreement: '', recommendations: [],
    },
    gyeokguk: { type: '', category: '', baseTenGod: null, confidence: 0, reasoning: '' },
    elementDistribution: {},
    deficientElements: [],
    excessiveElements: [],
    cheonganRelations: [],
    jijiRelations: [],
    gongmang: null,
    tenGodAnalysis: null,
    shinsalHits: [],
  } as SajuSummary;
}

// ---------------------------------------------------------------------------
// Public: collect element keys from mixed sources
// ---------------------------------------------------------------------------

export function collectElements(...sources: (string | null | undefined | string[])[]): Set<string> {
  const result = new Set<string>();
  for (const source of sources) {
    for (const item of (Array.isArray(source) ? source : source ? [source] : [])) {
      const elementKey = elementFromSajuCode(item);
      if (elementKey) result.add(elementKey);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public: run the saju analysis
// ---------------------------------------------------------------------------

export async function analyzeSaju(birth: BirthInfo, options?: SpringRequest['options']): Promise<SajuSummary> {
  const saju = await loadSajuModule();
  if (!saju) return emptySaju();

  try {
    const birthInput = saju.createBirthInput({
      birthYear: birth.year, birthMonth: birth.month,
      birthDay: birth.day, birthHour: birth.hour, birthMinute: birth.minute,
      gender: birth.gender === 'male' ? 'MALE' : 'FEMALE',
      timezone:  birth.timezone  ?? DEFAULT_TIMEZONE,
      latitude:  birth.latitude  ?? DEFAULT_LATITUDE,
      longitude: birth.longitude ?? DEFAULT_LONGITUDE,
      name: birth.name,
    });

    let config: any;
    if (options?.schoolPreset && saju.configFromPreset)
      config = saju.configFromPreset(PRESET_MAP[options.schoolPreset] ?? 'KOREAN_MAINSTREAM');
    if (options?.sajuConfig) config = { ...config, ...options.sajuConfig };

    const sajuOpts = options?.sajuOptions ? {
      daeunCount:     options.sajuOptions.daeunCount,
      saeunStartYear: options.sajuOptions.saeunStartYear,
      saeunYearCount: options.sajuOptions.saeunYearCount,
    } : undefined;

    return extractSaju(saju.analyzeSaju(birthInput, config, sajuOpts));
  } catch { return emptySaju(); }
}

// ---------------------------------------------------------------------------
// extractSaju -- composed from focused extraction helpers
// ---------------------------------------------------------------------------

export function extractSaju(rawSajuOutput: any): SajuSummary {
  const serializedOutput = deepSerialize(rawSajuOutput) as Record<string, unknown>;
  const rawPillars       = rawSajuOutput.pillars ?? rawSajuOutput.coreResult?.pillars;
  const coreResult       = rawSajuOutput.coreResult;

  return {
    ...serializedOutput,

    pillars:              extractPillars(rawPillars),
    timeCorrection:       extractNumericFields(coreResult, TC_KEYS) as any,
    dayMaster:            extractDayMaster(rawPillars, rawSajuOutput.strengthResult),
    strength:             extractStrength(rawSajuOutput.strengthResult),
    yongshin:             extractYongshin(rawSajuOutput.yongshinResult),
    gyeokguk:             extractGyeokguk(rawSajuOutput.gyeokgukResult),
    elementDistribution:   extractElementDistribution(rawSajuOutput).distribution,
    deficientElements:    extractElementDistribution(rawSajuOutput).deficientElements,
    excessiveElements:    extractElementDistribution(rawSajuOutput).excessiveElements,
    cheonganRelations:    extractCheonganRelations(rawSajuOutput),
    hapHwaEvaluations:    extractHapHwaEvaluations(rawSajuOutput),
    jijiRelations:        extractJijiRelations(rawSajuOutput),
    sibiUnseong:          extractSibiUnseong(rawSajuOutput),
    gongmang:             extractGongmang(rawSajuOutput),
    tenGodAnalysis:       extractTenGodAnalysis(rawSajuOutput.tenGodAnalysis),
    shinsalHits:          extractShinsalHits(rawSajuOutput),
    shinsalComposites:    extractShinsalComposites(rawSajuOutput),
    palaceAnalysis:       extractPalaceAnalysis(rawSajuOutput),
    daeunInfo:            extractDaeunInfo(rawSajuOutput),
    saeunPillars:         extractSaeunPillars(rawSajuOutput),
    trace:                extractTrace(rawSajuOutput),
  } as SajuSummary;
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

function formatPillar(pillarData: any): PillarSummary {
  const stemCode   = String(pillarData?.cheongan ?? '');
  const branchCode = String(pillarData?.jiji ?? '');
  const stemInfo   = CHEONGAN[stemCode];
  const branchInfo = JIJI[branchCode];
  return {
    stem:   { code: stemCode,   hangul: stemInfo?.hangul   ?? stemCode,   hanja: stemInfo?.hanja   ?? '' },
    branch: { code: branchCode, hangul: branchInfo?.hangul ?? branchCode, hanja: branchInfo?.hanja ?? '' },
  };
}

function extractPillars(rawPillars: any): Record<'year' | 'month' | 'day' | 'hour', PillarSummary> {
  return {
    year:  formatPillar(rawPillars?.year),
    month: formatPillar(rawPillars?.month),
    day:   formatPillar(rawPillars?.day),
    hour:  formatPillar(rawPillars?.hour),
  };
}

function extractDayMaster(rawPillars: any, strengthResult: any) {
  const dayMasterCode = String(rawPillars?.day?.cheongan ?? '');
  const dayMasterInfo = CHEONGAN[dayMasterCode];
  return {
    stem:     dayMasterCode,
    element:  strengthResult?.dayMasterElement ? String(strengthResult.dayMasterElement) : (dayMasterInfo?.element ?? ''),
    polarity: dayMasterInfo?.polarity ?? '',
  };
}

function extractStrength(strengthResult: any) {
  return {
    level:        String(strengthResult?.level ?? ''),
    isStrong:     !!strengthResult?.isStrong,
    totalSupport: Number(strengthResult?.score?.totalSupport) || 0,
    totalOppose:  Number(strengthResult?.score?.totalOppose)  || 0,
    deukryeong:   Number(strengthResult?.score?.deukryeong)   || 0,
    deukji:       Number(strengthResult?.score?.deukji)       || 0,
    deukse:       Number(strengthResult?.score?.deukse)       || 0,
    details:      ensureArray(strengthResult?.details).map(String),
  };
}

function extractElementDistribution(rawSajuOutput: any): {
  distribution: Record<string, number>;
  deficientElements: string[];
  excessiveElements: string[];
} {
  const distribution: Record<string, number> = {};

  if (rawSajuOutput.ohaengDistribution) {
    if (rawSajuOutput.ohaengDistribution instanceof Map) {
      for (const [key, value] of rawSajuOutput.ohaengDistribution)
        distribution[String(key)] = Number(value);
    } else {
      Object.assign(distribution, rawSajuOutput.ohaengDistribution);
    }
  }

  const total   = Object.values(distribution).reduce((sum, value) => sum + value, 0);
  const average = total / 5;

  const deficientElements: string[] = [];
  const excessiveElements: string[] = [];

  if (total > 0) {
    for (const elementCode of ELEMENT_CODES) {
      const count = distribution[elementCode] ?? 0;
      if (count === 0 || count <= average * 0.4) deficientElements.push(elementCode);
      else if (count >= average * 2.0)           excessiveElements.push(elementCode);
    }
  }

  return { distribution, deficientElements, excessiveElements };
}

function extractYongshin(yongshinResult: any) {
  return {
    element:    String(yongshinResult?.finalYongshin ?? ''),
    heeshin:    toNullableString(yongshinResult?.finalHeesin),
    gishin:     toNullableString(yongshinResult?.gisin),
    gushin:     toNullableString(yongshinResult?.gusin),
    confidence: Number(yongshinResult?.finalConfidence) || 0,
    agreement:  String(yongshinResult?.agreement ?? ''),
    recommendations: ensureArray(yongshinResult?.recommendations).map(
      ({ type, primaryElement, secondaryElement, confidence, reasoning }: any) => ({
        type:             String(type ?? ''),
        primaryElement:   String(primaryElement ?? ''),
        secondaryElement: toNullableString(secondaryElement),
        confidence:       Number(confidence) || 0,
        reasoning:        String(reasoning ?? ''),
      }),
    ),
  };
}

function extractGyeokguk(gyeokgukResult: any) {
  return {
    type:          String(gyeokgukResult?.type ?? ''),
    category:      String(gyeokgukResult?.category ?? ''),
    baseTenGod:  toNullableString(gyeokgukResult?.baseSipseong),
    confidence:    Number(gyeokgukResult?.confidence) || 0,
    reasoning:     String(gyeokgukResult?.reasoning ?? ''),
  };
}

function extractTenGodAnalysis(tenGodResult: any) {
  if (!tenGodResult?.byPosition) return null;

  return {
    dayMaster: String(tenGodResult.dayMaster ?? ''),
    byPosition: Object.fromEntries(
      Object.entries(tenGodResult.byPosition).map(([position, positionInfo]) => {
        const info = positionInfo as any;
        return [position, {
          cheonganTenGod:      String(info.cheonganSipseong ?? ''),
          jijiPrincipalTenGod: String(info.jijiPrincipalSipseong ?? ''),
          hiddenStems: ensureArray(info.hiddenStems).map((hidden: any) => {
            const stemCode = String(hidden.stem ?? '');
            return {
              stem:    stemCode,
              element: CHEONGAN[stemCode]?.element ?? '',
              ratio:   Number(hidden.ratio ?? (hidden.days ? hidden.days / 30 : 0)) || 0,
            };
          }),
          hiddenStemTenGod: ensureArray(info.hiddenStemSipseong).map((hidden: any) => ({
            stem:   String(hidden.entry?.stem ?? hidden.stem ?? ''),
            tenGod: String(hidden.sipseong ?? ''),
          })),
        }];
      }),
    ),
  };
}

function extractShinsalHits(rawSajuOutput: any) {
  const gradeFromWeight = (weight: number) => weight >= 80 ? 'A' : weight >= 50 ? 'B' : 'C';

  const weightedHits = ensureArray(rawSajuOutput.weightedShinsalHits);
  const sourceHits   = weightedHits.length > 0 ? weightedHits : ensureArray(rawSajuOutput.shinsalHits);
  const isWeighted   = weightedHits.length > 0;

  return sourceHits.map((item: any) => {
    const hitData    = isWeighted ? item.hit : item;
    const baseWeight = isWeighted ? Number(item.baseWeight) || 0 : 0;
    return {
      type:               String(hitData?.type     ?? ''),
      position:           String(hitData?.position ?? ''),
      grade:              String(hitData?.grade || '') || (isWeighted ? gradeFromWeight(baseWeight) : 'C'),
      baseWeight,
      positionMultiplier: isWeighted ? Number(item.positionMultiplier) || 0 : 0,
      weightedScore:      isWeighted ? Number(item.weightedScore)      || 0 : 0,
    };
  });
}

function extractShinsalComposites(rawSajuOutput: any) {
  return ensureArray(rawSajuOutput.shinsalComposites).map((composite: any) => ({
    patternName:     String(composite.patternName     ?? ''),
    interactionType: String(composite.interactionType ?? ''),
    interpretation:  String(composite.interpretation  ?? ''),
    bonusScore:      Number(composite.bonusScore)     || 0,
  }));
}

function extractJijiRelations(rawSajuOutput: any) {
  const resolvedRelations = ensureArray(rawSajuOutput.resolvedJijiRelations);
  const sourceRelations   = resolvedRelations.length > 0 ? resolvedRelations : ensureArray(rawSajuOutput.jijiRelations);
  const isResolved        = resolvedRelations.length > 0;

  return sourceRelations.map((item: any) => {
    const hitData = isResolved ? item.hit : item;
    return {
      type:      String(hitData?.type ?? (item.type ?? '')),
      branches:  toStringArray(hitData?.members ?? item.members),
      note:      String(hitData?.note ?? (item.note ?? '')),
      outcome:   isResolved ? toNullableString(item.outcome)   : null,
      reasoning: isResolved ? toNullableString(item.reasoning) : null,
    };
  });
}

function extractCheonganRelations(rawSajuOutput: any) {
  const scoredRelations = ensureArray(rawSajuOutput.scoredCheonganRelations);
  const scoreByKey = new Map<string, any>();
  for (const scored of scoredRelations) {
    const lookupKey = String(scored.hit?.type ?? '') + ':' + toStringArray(scored.hit?.members).sort().join(',');
    scoreByKey.set(lookupKey, scored.score);
  }

  return ensureArray(rawSajuOutput.cheonganRelations).map((relation: any) => {
    const lookupKey    = String(relation.type ?? '') + ':' + toStringArray(relation.members).sort().join(',');
    const scoreData    = scoreByKey.get(lookupKey);
    return {
      type:          String(relation.type ?? ''),
      stems:         toStringArray(relation.members),
      resultElement: toNullableString(relation.resultOhaeng),
      note:          String(relation.note ?? ''),
      score: scoreData ? {
        baseScore:          Number(scoreData.baseScore)          || 0,
        adjacencyBonus:     Number(scoreData.adjacencyBonus)     || 0,
        outcomeMultiplier:  Number(scoreData.outcomeMultiplier)  || 0,
        finalScore:         Number(scoreData.finalScore)         || 0,
        rationale:          String(scoreData.rationale ?? ''),
      } : null,
    };
  });
}

function extractHapHwaEvaluations(rawSajuOutput: any) {
  return ensureArray(rawSajuOutput.hapHwaEvaluations).map((evaluation: any) => ({
    stem1:             String(evaluation.stem1     ?? ''),
    stem2:             String(evaluation.stem2     ?? ''),
    position1:         String(evaluation.position1 ?? ''),
    position2:         String(evaluation.position2 ?? ''),
    resultElement:     String(evaluation.resultOhaeng ?? ''),
    state:             String(evaluation.state     ?? ''),
    confidence:        Number(evaluation.confidence) || 0,
    reasoning:         String(evaluation.reasoning ?? ''),
    dayMasterInvolved: !!evaluation.dayMasterInvolved,
  }));
}

function extractSibiUnseong(rawSajuOutput: any) {
  if (!rawSajuOutput.sibiUnseong) return null;
  return Object.fromEntries(
    (rawSajuOutput.sibiUnseong instanceof Map
      ? [...rawSajuOutput.sibiUnseong]
      : Object.entries(rawSajuOutput.sibiUnseong)
    ).map(([key, value]: [any, any]) => [String(key), String(value)]),
  );
}

function extractGongmang(rawSajuOutput: any): [string, string] | null {
  const branches = rawSajuOutput.gongmangVoidBranches;
  return Array.isArray(branches) && branches.length >= 2
    ? [String(branches[0]), String(branches[1])]
    : null;
}

function extractPalaceAnalysis(rawSajuOutput: any) {
  if (!rawSajuOutput.palaceAnalysis) return null;
  return Object.fromEntries(
    Object.entries(rawSajuOutput.palaceAnalysis).map(([position, palaceData]) => {
      const palace      = palaceData as any;
      const palaceInfo  = palace.palaceInfo;
      return [position, {
        position,
        koreanName:     String(palaceInfo?.koreanName ?? ''),
        domain:         String(palaceInfo?.domain     ?? ''),
        agePeriod:      String(palaceInfo?.agePeriod  ?? ''),
        bodyPart:       String(palaceInfo?.bodyPart   ?? ''),
        tenGod:         toNullableString(palace.sipseong),
        familyRelation: toNullableString(palace.familyRelation),
      }];
    }),
  );
}

function extractDaeunInfo(rawSajuOutput: any) {
  const daeunInfoRaw = rawSajuOutput.daeunInfo;
  if (!daeunInfoRaw) return null;

  return {
    isForward:              !!daeunInfoRaw.isForward,
    firstDaeunStartAge:     Number(daeunInfoRaw.firstDaeunStartAge)    || 0,
    firstDaeunStartMonths:  Number(daeunInfoRaw.firstDaeunStartMonths) || 0,
    boundaryMode:           String(daeunInfoRaw.boundaryMode ?? ''),
    warnings:               ensureArray(daeunInfoRaw.warnings).map(String),
    pillars: ensureArray(daeunInfoRaw.daeunPillars).map((pillarData: any) => ({
      stem:     String(pillarData.pillar?.cheongan ?? ''),
      branch:   String(pillarData.pillar?.jiji     ?? ''),
      startAge: Number(pillarData.startAge)        || 0,
      endAge:   Number(pillarData.endAge)          || 0,
      order:    Number(pillarData.order)           || 0,
    })),
  };
}

function extractSaeunPillars(rawSajuOutput: any) {
  return ensureArray(rawSajuOutput.saeunPillars).map((saeun: any) => ({
    year:   Number(saeun.year) || 0,
    stem:   String(saeun.pillar?.cheongan ?? ''),
    branch: String(saeun.pillar?.jiji     ?? ''),
  }));
}

function extractTrace(rawSajuOutput: any) {
  return ensureArray(rawSajuOutput.trace).map((traceEntry: any) => ({
    key:        String(traceEntry.key     ?? ''),
    summary:    String(traceEntry.summary ?? ''),
    evidence:   ensureArray(traceEntry.evidence).map(String),
    citations:  ensureArray(traceEntry.citations).map(String),
    reasoning:  ensureArray(traceEntry.reasoning).map(String),
    confidence: typeof traceEntry.confidence === 'number' ? traceEntry.confidence : null,
  }));
}

// ---------------------------------------------------------------------------
// Public: safe saju analysis with sajuEnabled flag
// ---------------------------------------------------------------------------

export async function analyzeSajuSafe(
  birth: BirthInfo, options?: SpringRequest['options'],
): Promise<{ summary: SajuSummary; sajuEnabled: boolean }> {
  try {
    const summary = await analyzeSaju(birth, options);
    const isRealAnalysis = !!summary.dayMaster?.element;
    return { summary, sajuEnabled: isRealAnalysis };
  } catch {
    return { summary: emptySaju(), sajuEnabled: false };
  }
}

// ---------------------------------------------------------------------------
// Public: build a condensed saju context for the name-scoring pipeline
// ---------------------------------------------------------------------------

export function buildSajuContext(sajuSummary: SajuSummary): { dist: Record<ElementKey, number>; output: SajuOutputSummary | null } {
  const dist = emptyDistribution();
  for (const [code, count] of Object.entries(sajuSummary.elementDistribution)) {
    const key = elementFromSajuCode(code);
    if (key) dist[key] += count;
  }

  if (!sajuSummary.dayMaster.element && !sajuSummary.yongshin.element) return { dist, output: null };

  const dayMasterKey = elementFromSajuCode(sajuSummary.dayMaster.element);
  const yongshinData = sajuSummary.yongshin;

  let tenGod: { groupCounts: Record<string, number> } | undefined;
  if (sajuSummary.tenGodAnalysis?.byPosition) {
    const groupCounts: Record<string, number> = { friend: 0, output: 0, wealth: 0, authority: 0, resource: 0 };
    for (const positionInfo of Object.values(sajuSummary.tenGodAnalysis.byPosition)) {
      const stemGroup   = TEN_GOD_GROUP[positionInfo.cheonganTenGod];
      const branchGroup = TEN_GOD_GROUP[positionInfo.jijiPrincipalTenGod];
      if (stemGroup)   groupCounts[stemGroup]++;
      if (branchGroup) groupCounts[branchGroup]++;
    }
    tenGod = { groupCounts };
  }

  return {
    dist,
    output: {
      dayMaster: dayMasterKey ? { element: dayMasterKey } : undefined,
      strength: {
        isStrong:     sajuSummary.strength.isStrong,
        totalSupport: sajuSummary.strength.totalSupport,
        totalOppose:  sajuSummary.strength.totalOppose,
      },
      yongshin: {
        finalYongshin:   yongshinData.element,
        finalHeesin:     yongshinData.heeshin,
        gisin:           yongshinData.gishin,
        gusin:           yongshinData.gushin,
        finalConfidence: yongshinData.confidence,
        recommendations: yongshinData.recommendations.map(
          ({ type, primaryElement, secondaryElement, confidence, reasoning }) => ({
            type, primaryElement, secondaryElement, confidence, reasoning,
          }),
        ),
      },
      tenGod,
      gyeokguk: sajuSummary.gyeokguk?.type ? {
        category:   String(sajuSummary.gyeokguk.category   ?? ''),
        type:       String(sajuSummary.gyeokguk.type        ?? ''),
        confidence: Number(sajuSummary.gyeokguk.confidence) || 0,
      } : undefined,
      deficientElements: sajuSummary.deficientElements?.length ? sajuSummary.deficientElements : undefined,
      excessiveElements: sajuSummary.excessiveElements?.length ? sajuSummary.excessiveElements : undefined,
    },
  };
}
