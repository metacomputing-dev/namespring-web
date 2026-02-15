import { HanjaRepository, type HanjaEntry } from '../database/hanja-repository.js';
import { FourframeRepository } from '../database/fourframe-repository.js';
import { Polarity } from '../model/polarity.js';
import { HangulCalculator } from './hangul.js';
import { HanjaCalculator } from './hanja.js';
import { FrameCalculator } from './frame.js';
import { SajuCalculator, type SajuOutputSummary } from './saju.js';
import { evaluateName, type EvalContext } from './evaluator.js';
import { type ElementKey, elementFromSajuCode, emptyDistribution } from './scoring.js';
import { FourFrameOptimizer } from './search.js';
import type {
  SeedRequest, SeedResponse, SeedCandidate, SajuSummary,
  PillarSummary, BirthInfo, NameCharInput, CharDetail,
} from '../model/types.js';
import { makeFallbackEntry, buildInterpretation, parseJamoFilter, type JamoFilter } from '../utils/index.js';

type SajuModule = {
  analyzeSaju: (input: any, config?: any, options?: any) => any;
  createBirthInput: (params: any) => any;
  configFromPreset?: (preset: string) => any;
};

let sajuModule: SajuModule | null = null;
const SAJU_MODULE_PATH = '../../../saju-ts/src/index.js';

async function loadSajuModule(): Promise<SajuModule | null> {
  if (sajuModule) return sajuModule;
  try {
    sajuModule = await (Function('p', 'return import(p)')(SAJU_MODULE_PATH)) as SajuModule;
    return sajuModule;
  } catch { return null; }
}

const MAX_CANDIDATES = 500;
const ELEMENT_CODES = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as const;

function safeArr(v: any): any[] { return Array.isArray(v) ? v : []; }
function strOrNull(v: any): string | null { return v != null ? String(v) : null; }
function numPick(obj: any, keys: readonly string[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const k of keys) o[k] = Number(obj?.[k]) || 0;
  return o;
}

const TC_KEYS = [
  'standardYear', 'standardMonth', 'standardDay', 'standardHour', 'standardMinute',
  'adjustedYear', 'adjustedMonth', 'adjustedDay', 'adjustedHour', 'adjustedMinute',
  'dstCorrectionMinutes', 'longitudeCorrectionMinutes', 'equationOfTimeMinutes',
] as const;

const CHEONGAN: Record<string, { h: string; j: string; el: string; pol: string }> = {
  GAP: { h: '갑', j: '甲', el: 'WOOD', pol: 'YANG' },
  EUL: { h: '을', j: '乙', el: 'WOOD', pol: 'YIN' },
  BYEONG: { h: '병', j: '丙', el: 'FIRE', pol: 'YANG' },
  JEONG: { h: '정', j: '丁', el: 'FIRE', pol: 'YIN' },
  MU: { h: '무', j: '戊', el: 'EARTH', pol: 'YANG' },
  GI: { h: '기', j: '己', el: 'EARTH', pol: 'YIN' },
  GYEONG: { h: '경', j: '庚', el: 'METAL', pol: 'YANG' },
  SIN: { h: '신', j: '辛', el: 'METAL', pol: 'YIN' },
  IM: { h: '임', j: '壬', el: 'WATER', pol: 'YANG' },
  GYE: { h: '계', j: '癸', el: 'WATER', pol: 'YIN' },
};

const JIJI: Record<string, { h: string; j: string }> = {
  JA: { h: '자', j: '子' }, CHUK: { h: '축', j: '丑' },
  IN: { h: '인', j: '寅' }, MYO: { h: '묘', j: '卯' },
  JIN: { h: '진', j: '辰' }, SA: { h: '사', j: '巳' },
  O: { h: '오', j: '午' }, MI: { h: '미', j: '未' },
  SIN: { h: '신', j: '申' }, YU: { h: '유', j: '酉' },
  SUL: { h: '술', j: '戌' }, HAE: { h: '해', j: '亥' },
};

const SIPSEONG_GROUP: Record<string, string> = {
  BI_GYEON: 'friend', GYEOB_JAE: 'friend',
  SIK_SIN: 'output', SANG_GWAN: 'output',
  PYEON_JAE: 'wealth', JEONG_JAE: 'wealth',
  PYEON_GWAN: 'authority', JEONG_GWAN: 'authority',
  PYEON_IN: 'resource', JEONG_IN: 'resource',
};

const PRESET_MAP: Record<string, string> = {
  korean: 'KOREAN_MAINSTREAM', chinese: 'TRADITIONAL_CHINESE', modern: 'MODERN_INTEGRATED',
};

function mapPillar(p: any): PillarSummary {
  const sc = String(p?.cheongan ?? ''), bc = String(p?.jiji ?? '');
  const si = CHEONGAN[sc], bi = JIJI[bc];
  return {
    stem: { code: sc, hangul: si?.h ?? sc, hanja: si?.j ?? '' },
    branch: { code: bc, hangul: bi?.h ?? bc, hanja: bi?.j ?? '' },
  };
}

function toStrArr(v: any): string[] {
  if (!v) return [];
  if (v instanceof Set) return [...v].map(String);
  if (Array.isArray(v)) return v.map(String);
  return [];
}

function serialize(v: unknown): unknown {
  if (v == null || typeof v !== 'object') return v;
  if (v instanceof Map) {
    const o: Record<string, unknown> = {};
    for (const [k, val] of v) o[String(k)] = serialize(val);
    return o;
  }
  if (v instanceof Set) return [...v].map(x => serialize(x));
  if (Array.isArray(v)) return v.map(x => serialize(x));
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(v as any)) o[k] = serialize((v as any)[k]);
  return o;
}

function emptySaju(): SajuSummary {
  const ep: PillarSummary = { stem: { code: '', hangul: '', hanja: '' }, branch: { code: '', hangul: '', hanja: '' } };
  return {
    pillars: { year: ep, month: ep, day: ep, hour: ep },
    timeCorrection: numPick(null, TC_KEYS) as any,
    dayMaster: { stem: '', element: '', polarity: '' },
    strength: { level: '', isStrong: false, totalSupport: 0, totalOppose: 0, deukryeong: 0, deukji: 0, deukse: 0, details: [] },
    yongshin: { element: 'WOOD', heeshin: null, gishin: null, gushin: null, confidence: 0, agreement: '', recommendations: [] },
    gyeokguk: { type: '', category: '', baseSipseong: null, confidence: 0, reasoning: '' },
    ohaengDistribution: {}, deficientElements: [], excessiveElements: [],
    cheonganRelations: [], jijiRelations: [],
    gongmang: null, tenGodAnalysis: null, shinsalHits: [],
  } as SajuSummary;
}

function toCharDetail(e: HanjaEntry): CharDetail {
  return {
    hangul: e.hangul, hanja: e.hanja, meaning: e.meaning,
    strokes: e.strokes, element: e.resource_element,
    polarity: Polarity.get(e.strokes).english
  };
}

function collectElements(...sources: (string | null | undefined | string[])[]): Set<string> {
  const out = new Set<string>();
  for (const src of sources) {
    for (const s of (Array.isArray(src) ? src : src ? [src] : [])) {
      const k = elementFromSajuCode(s);
      if (k) out.add(k);
    }
  }
  return out;
}

export class SeedEngine {
  private hanjaRepo = new HanjaRepository();
  private fourFrameRepo = new FourframeRepository();
  private initialized = false;
  private luckyMap = new Map<number, string>();
  private validFourFrameNumbers = new Set<number>();
  private optimizer: FourFrameOptimizer | null = null;

  async init() {
    if (this.initialized) return;
    await Promise.all([this.hanjaRepo.init(), this.fourFrameRepo.init()]);
    for (const e of await this.fourFrameRepo.findAll(81)) {
      const lv = e.lucky_level ?? '';
      this.luckyMap.set(e.number, lv);
      if (lv.includes('최상') || lv.includes('상') || lv.includes('양'))
        this.validFourFrameNumbers.add(e.number);
    }
    this.optimizer = new FourFrameOptimizer(this.validFourFrameNumbers);
    this.initialized = true;
  }

  async analyze(request: SeedRequest): Promise<SeedResponse> {
    await this.init();
    const jamoFilters = request.givenName?.map(c => c.hanja ? null : parseJamoFilter(c.hangul));
    const isJamoInput = jamoFilters?.some(f => f !== null) ?? false;
    const mode = request.mode && request.mode !== 'auto' ? request.mode : (request.givenName?.length && request.givenName.every(c => c.hanja) ? 'evaluate' : 'recommend');
    const sajuSummary = await this.analyzeSaju(request.birth, request.options);
    const { dist, output } = this.buildSajuContext(sajuSummary);

    let inputs: NameCharInput[][];
    if (mode === 'evaluate' && request.givenName?.length && !isJamoInput) {
      inputs = [request.givenName];
    } else if (mode === 'recommend' || mode === 'all' || isJamoInput) {
      inputs = await this.generateCandidates(request, sajuSummary, isJamoInput ? jamoFilters! : undefined);
      if (request.givenName?.length && !isJamoInput) inputs.unshift(request.givenName);
    } else {
      inputs = request.givenName?.length ? [request.givenName] : [];
    }

    const scored: SeedCandidate[] = [];
    for (const gn of inputs) scored.push(await this.scoreCandidate(request.surname, gn, dist, output));
    scored.sort((a, b) => b.scores.total - a.scores.total);

    const offset = request.options?.offset ?? 0;
    const limit = request.options?.limit ?? 20;
    return {
      request, mode, saju: sajuSummary,
      candidates: scored.slice(offset, offset + limit).map((c, i) => ({ ...c, rank: offset + i + 1 })),
      totalCount: scored.length,
      meta: { version: '2.0.0', timestamp: new Date().toISOString() }
    };
  }

  private async analyzeSaju(birth: BirthInfo, options?: SeedRequest['options']): Promise<SajuSummary> {
    const saju = await loadSajuModule();
    if (!saju) return emptySaju();
    try {
      const bi = saju.createBirthInput({
        birthYear: birth.year, birthMonth: birth.month,
        birthDay: birth.day, birthHour: birth.hour, birthMinute: birth.minute,
        gender: birth.gender === 'male' ? 'MALE' : 'FEMALE',
        timezone: birth.timezone ?? 'Asia/Seoul',
        latitude: birth.latitude ?? 37.5665, longitude: birth.longitude ?? 126.978,
        name: birth.name,
      });
      let config: any;
      if (options?.schoolPreset && saju.configFromPreset)
        config = saju.configFromPreset(PRESET_MAP[options.schoolPreset] ?? 'KOREAN_MAINSTREAM');
      if (options?.sajuConfig) config = { ...config, ...options.sajuConfig };
      const sajuOpts = options?.sajuOptions ? {
        daeunCount: options.sajuOptions.daeunCount,
        saeunStartYear: options.sajuOptions.saeunStartYear,
        saeunYearCount: options.sajuOptions.saeunYearCount,
      } : undefined;
      return this.extractSaju(saju.analyzeSaju(bi, config, sajuOpts));
    } catch { return emptySaju(); }
  }

  private extractSaju(a: any): SajuSummary {
    const base = serialize(a) as Record<string, unknown>,
      pil = a.pillars ?? a.coreResult?.pillars,
      cr = a.coreResult, sr = a.strengthResult,
      yr = a.yongshinResult, gr = a.gyeokgukResult, tga = a.tenGodAnalysis;

    const od: Record<string, number> = {};
    if (a.ohaengDistribution) {
      if (a.ohaengDistribution instanceof Map) {
        for (const [k, v] of a.ohaengDistribution) od[String(k)] = Number(v);
      } else Object.assign(od, a.ohaengDistribution);
    }
    const total = Object.values(od).reduce((s, v) => s + v, 0);
    const avg = total / 5;
    const deficient: string[] = [], excessive: string[] = [];
    if (total > 0) {
      for (const k of ELEMENT_CODES) {
        const c = od[k] ?? 0;
        if (c === 0 || c <= avg * 0.4) deficient.push(k);
        else if (c >= avg * 2.0) excessive.push(k);
      }
    }

    const dmCode = String(pil?.day?.cheongan ?? '');
    const dmi = CHEONGAN[dmCode];

    const sibiUnseong = a.sibiUnseong ? Object.fromEntries(
      (a.sibiUnseong instanceof Map ? [...a.sibiUnseong] : Object.entries(a.sibiUnseong)).map(([k, v]) => [String(k), String(v)])
    ) : null;

    const tenGodAnalysis = tga?.byPosition ? {
      dayMaster: String(tga.dayMaster ?? ''),
      byPosition: Object.fromEntries(Object.entries(tga.byPosition).map(([pos, info]) => {
        const i = info as any;
        return [pos, {
          cheonganSipseong: String(i.cheonganSipseong ?? ''),
          jijiPrincipalSipseong: String(i.jijiPrincipalSipseong ?? ''),
          hiddenStems: safeArr(i.hiddenStems).map((h: any) => {
            const sc = String(h.stem ?? '');
            return { stem: sc, element: CHEONGAN[sc]?.el ?? '', ratio: Number(h.ratio ?? (h.days ? h.days / 30 : 0)) || 0 };
          }),
          hiddenStemSipseong: safeArr(i.hiddenStemSipseong).map((h: any) => ({ stem: String(h.entry?.stem ?? h.stem ?? ''), sipseong: String(h.sipseong ?? '') })),
        }];
      })),
    } : null;

    const palaceAnalysis = a.palaceAnalysis ? Object.fromEntries(Object.entries(a.palaceAnalysis).map(([pos, pa]) => {
      const p = pa as any, pi = p.palaceInfo;
      return [pos, {
        position: pos, koreanName: String(pi?.koreanName ?? ''),
        domain: String(pi?.domain ?? ''), agePeriod: String(pi?.agePeriod ?? ''),
        bodyPart: String(pi?.bodyPart ?? ''),
        sipseong: strOrNull(p.sipseong),
        familyRelation: strOrNull(p.familyRelation),
      }];
    })) : null;

    const di = a.daeunInfo;
    const daeunInfo = di ? {
      isForward: !!di.isForward,
      firstDaeunStartAge: Number(di.firstDaeunStartAge) || 0,
      firstDaeunStartMonths: Number(di.firstDaeunStartMonths) || 0,
      boundaryMode: String(di.boundaryMode ?? ''),
      warnings: safeArr(di.warnings).map(String),
      pillars: safeArr(di.daeunPillars).map((p: any) => ({
        stem: String(p.pillar?.cheongan ?? ''), branch: String(p.pillar?.jiji ?? ''),
        startAge: Number(p.startAge) || 0, endAge: Number(p.endAge) || 0, order: Number(p.order) || 0,
      })),
    } : null;

    const gradeFromWeight = (w: number) => w >= 80 ? 'A' : w >= 50 ? 'B' : 'C';
    const wsh = safeArr(a.weightedShinsalHits);
    const shinsalHits = (wsh.length > 0 ? wsh : safeArr(a.shinsalHits)).map((item: any) => {
      const isWeighted = wsh.length > 0;
      const src = isWeighted ? item.hit : item;
      const bw = isWeighted ? Number(item.baseWeight) || 0 : 0;
      return {
        type: String(src?.type ?? ''), position: String(src?.position ?? ''),
        grade: String(src?.grade || '') || (isWeighted ? gradeFromWeight(bw) : 'C'),
        baseWeight: bw, positionMultiplier: isWeighted ? Number(item.positionMultiplier) || 0 : 0,
        weightedScore: isWeighted ? Number(item.weightedScore) || 0 : 0,
      };
    });

    const rjr = safeArr(a.resolvedJijiRelations);
    const jijiRelations = (rjr.length > 0 ? rjr : safeArr(a.jijiRelations)).map((item: any) => {
      const isResolved = rjr.length > 0;
      const src = isResolved ? item.hit : item;
      return {
        type: String(src?.type ?? (item.type ?? '')), branches: toStrArr(src?.members ?? item.members),
        note: String(src?.note ?? (item.note ?? '')),
        outcome: isResolved ? strOrNull(item.outcome) : null,
        reasoning: isResolved ? strOrNull(item.reasoning) : null,
      };
    });

    const gm = a.gongmangVoidBranches;

    const scoredCR = safeArr(a.scoredCheonganRelations);
    const crScoreMap = new Map<string, any>();
    for (const s of scoredCR) {
      const key = String(s.hit?.type ?? '') + ':' + toStrArr(s.hit?.members).sort().join(',');
      crScoreMap.set(key, s.score);
    }

    return {
      ...base,
      pillars: { year: mapPillar(pil?.year), month: mapPillar(pil?.month), day: mapPillar(pil?.day), hour: mapPillar(pil?.hour) },
      timeCorrection: numPick(cr, TC_KEYS) as any,
      dayMaster: {
        stem: dmCode,
        element: sr?.dayMasterElement ? String(sr.dayMasterElement) : (dmi?.el ?? ''),
        polarity: dmi?.pol ?? '',
      },
      strength: {
        level: String(sr?.level ?? ''), isStrong: !!sr?.isStrong,
        totalSupport: Number(sr?.score?.totalSupport) || 0, totalOppose: Number(sr?.score?.totalOppose) || 0,
        deukryeong: Number(sr?.score?.deukryeong) || 0, deukji: Number(sr?.score?.deukji) || 0, deukse: Number(sr?.score?.deukse) || 0,
        details: safeArr(sr?.details).map(String),
      },
      yongshin: {
        element: String(yr?.finalYongshin ?? ''),
        heeshin: strOrNull(yr?.finalHeesin),
        gishin: strOrNull(yr?.gisin),
        gushin: strOrNull(yr?.gusin),
        confidence: Number(yr?.finalConfidence) || 0,
        agreement: String(yr?.agreement ?? ''),
        recommendations: safeArr(yr?.recommendations).map(({ type: t, primaryElement: pe, secondaryElement: se, confidence: c, reasoning: rs }: any) => ({
          type: String(t ?? ''), primaryElement: String(pe ?? ''),
          secondaryElement: strOrNull(se),
          confidence: Number(c) || 0, reasoning: String(rs ?? ''),
        })),
      },
      gyeokguk: {
        type: String(gr?.type ?? ''), category: String(gr?.category ?? ''),
        baseSipseong: strOrNull(gr?.baseSipseong),
        confidence: Number(gr?.confidence) || 0, reasoning: String(gr?.reasoning ?? ''),
      },
      ohaengDistribution: od, deficientElements: deficient, excessiveElements: excessive,
      cheonganRelations: safeArr(a.cheonganRelations).map((r: any) => {
        const key = String(r.type ?? '') + ':' + toStrArr(r.members).sort().join(',');
        const sc = crScoreMap.get(key);
        return {
          type: String(r.type ?? ''), stems: toStrArr(r.members),
          resultElement: strOrNull(r.resultOhaeng), note: String(r.note ?? ''),
          score: sc ? {
            baseScore: Number(sc.baseScore) || 0, adjacencyBonus: Number(sc.adjacencyBonus) || 0,
            outcomeMultiplier: Number(sc.outcomeMultiplier) || 0, finalScore: Number(sc.finalScore) || 0,
            rationale: String(sc.rationale ?? ''),
          } : null,
        };
      }),
      hapHwaEvaluations: safeArr(a.hapHwaEvaluations).map((e: any) => ({
        stem1: String(e.stem1 ?? ''), stem2: String(e.stem2 ?? ''),
        position1: String(e.position1 ?? ''), position2: String(e.position2 ?? ''),
        resultElement: String(e.resultOhaeng ?? ''), state: String(e.state ?? ''),
        confidence: Number(e.confidence) || 0, reasoning: String(e.reasoning ?? ''),
        dayMasterInvolved: !!e.dayMasterInvolved,
      })),
      jijiRelations, sibiUnseong,
      gongmang: Array.isArray(gm) && gm.length >= 2 ? [String(gm[0]), String(gm[1])] as [string, string] : null,
      tenGodAnalysis, shinsalHits,
      shinsalComposites: safeArr(a.shinsalComposites).map((c: any) => ({
        patternName: String(c.patternName ?? ''), interactionType: String(c.interactionType ?? ''),
        interpretation: String(c.interpretation ?? ''), bonusScore: Number(c.bonusScore) || 0,
      })),
      palaceAnalysis, daeunInfo,
      saeunPillars: safeArr(a.saeunPillars).map((s: any) => ({
        year: Number(s.year) || 0, stem: String(s.pillar?.cheongan ?? ''), branch: String(s.pillar?.jiji ?? ''),
      })),
      trace: safeArr(a.trace).map((t: any) => ({
        key: String(t.key ?? ''), summary: String(t.summary ?? ''),
        evidence: safeArr(t.evidence).map(String),
        citations: safeArr(t.citations).map(String),
        reasoning: safeArr(t.reasoning).map(String),
        confidence: typeof t.confidence === 'number' ? t.confidence : null,
      })),
    } as SajuSummary;
  }

  private buildSajuContext(s: SajuSummary): { dist: Record<ElementKey, number>; output: SajuOutputSummary | null } {
    const dist = emptyDistribution();
    for (const [code, count] of Object.entries(s.ohaengDistribution)) {
      const key = elementFromSajuCode(code);
      if (key) dist[key] += count;
    }
    if (!s.dayMaster.element && !s.yongshin.element) return { dist, output: null };

    const dmKey = elementFromSajuCode(s.dayMaster.element);
    const y = s.yongshin;

    let tenGod: { groupCounts: Record<string, number> } | undefined;
    if (s.tenGodAnalysis?.byPosition) {
      const gc: Record<string, number> = { friend: 0, output: 0, wealth: 0, authority: 0, resource: 0 };
      for (const info of Object.values(s.tenGodAnalysis.byPosition)) {
        const g = SIPSEONG_GROUP[info.cheonganSipseong]; if (g) gc[g]++;
        const g2 = SIPSEONG_GROUP[info.jijiPrincipalSipseong]; if (g2) gc[g2]++;
      }
      tenGod = { groupCounts: gc };
    }

    return {
      dist,
      output: {
        dayMaster: dmKey ? { element: dmKey } : undefined,
        strength: { isStrong: s.strength.isStrong, totalSupport: s.strength.totalSupport, totalOppose: s.strength.totalOppose },
        yongshin: {
          finalYongshin: y.element, finalHeesin: y.heeshin, gisin: y.gishin, gusin: y.gushin,
          finalConfidence: y.confidence,
          recommendations: y.recommendations.map(({ type, primaryElement, secondaryElement, confidence, reasoning }) => ({
            type, primaryElement, secondaryElement, confidence, reasoning,
          })),
        },
        tenGod,
      }
    };
  }

  private async scoreCandidate(
    surname: NameCharInput[], givenName: NameCharInput[],
    sajuDist: Record<ElementKey, number>, sajuOutput: SajuOutputSummary | null
  ): Promise<SeedCandidate> {
    const se = await this.resolveEntries(surname);
    const ge = await this.resolveEntries(givenName);
    const hangul = new HangulCalculator(se, ge);
    const hanja = new HanjaCalculator(se, ge);
    const frame = new FrameCalculator(se, ge);
    const saju = new SajuCalculator(se, ge);
    const ctx: EvalContext = {
      surnameLength: se.length, givenLength: ge.length,
      luckyMap: this.luckyMap, sajuDistribution: sajuDist, sajuOutput, insights: {}
    };
    const ev = evaluateName([hangul, hanja, frame, saju], ctx);
    const cm = ev.categoryMap;
    const r = (v: number) => Math.round(v * 10) / 10;
    return {
      name: {
        surname: se.map(toCharDetail), givenName: ge.map(toCharDetail),
        fullHangul: [...se, ...ge].map(e => e.hangul).join(''), fullHanja: [...se, ...ge].map(e => e.hanja).join('')
      },
      scores: {
        total: r(ev.score),
        hangul: r(((cm.HANGUL_ELEMENT?.score ?? 0) + (cm.HANGUL_POLARITY?.score ?? 0)) / 2),
        hanja: r(((cm.STROKE_POLARITY?.score ?? 0) + (cm.FOURFRAME_ELEMENT?.score ?? 0)) / 2),
        fourFrame: r(cm.FOURFRAME_LUCK?.score ?? 0),
        saju: r(cm.SAJU_ELEMENT_BALANCE?.score ?? 0)
      },
      analysis: {
        hangul: hangul.getAnalysis().data, hanja: hanja.getAnalysis().data,
        fourFrame: frame.getAnalysis().data, saju: saju.getAnalysis().data
      },
      interpretation: buildInterpretation(ev), rank: 0
    };
  }

  private async generateCandidates(req: SeedRequest, saju: SajuSummary, jamoFilters?: (JamoFilter | null)[]): Promise<NameCharInput[][]> {
    const se = await this.resolveEntries(req.surname);
    const nameLen = req.givenNameLength ?? jamoFilters?.length ?? 2;
    const hasJamo = jamoFilters?.some(f => f !== null) ?? false;
    const targets = collectElements(saju.yongshin.element, saju.yongshin.heeshin, saju.deficientElements);
    const avoids = collectElements(saju.yongshin.gishin, saju.yongshin.gushin, saju.excessiveElements);
    if (targets.size === 0) targets.add('Wood');

    const inp = (c: HanjaEntry): NameCharInput => ({ hangul: c.hangul, hanja: c.hanja });

    // Step 1: build per-position pools
    const pools = await this.buildPositionPools(req, nameLen, jamoFilters, hasJamo, se, targets, avoids);

    // Step 2: generate combinations, then cut to MAX_CANDIDATES
    const out: NameCharInput[][] = [];
    if (!hasJamo && nameLen <= 2) {
      // optimizer-based: pools are keyed by stroke combo
      const validKeys = this.optimizer!.getValidCombinations(se.map(e => e.strokes), nameLen);
      for (const sk of validKeys) {
        if (out.length >= MAX_CANDIDATES) break;
        const sc = sk.split(',').map(Number);
        if (nameLen === 1) {
          for (const c of (pools.get(sc[0]) ?? []).slice(0, 8)) {
            out.push([inp(c)]);
            if (out.length >= MAX_CANDIDATES) break;
          }
        } else {
          const c1 = (pools.get(sc[0]) ?? []).slice(0, 6);
          const c2 = (pools.get(sc[1]) ?? []).slice(0, 6);
          for (const a of c1) {
            for (const b of c2) {
              if (a.hanja === b.hanja) continue;
              out.push([inp(a), inp(b)]);
              if (out.length >= MAX_CANDIDATES) break;
            }
            if (out.length >= MAX_CANDIDATES) break;
          }
        }
      }
    } else {
      // pool-based DFS (jamo input or 3+ chars)
      const posArr = Array.from({ length: nameLen }, (_, i) => pools.get(i) ?? []);
      const dfs = (depth: number, current: HanjaEntry[]) => {
        if (out.length >= MAX_CANDIDATES) return;
        if (depth >= nameLen) { out.push(current.map(inp)); return; }
        for (const c of posArr[depth]) {
          if (current.some(x => x.hanja === c.hanja)) continue;
          dfs(depth + 1, [...current, c]);
        }
      };
      dfs(0, []);
    }
    return out;
  }

  private async buildPositionPools(
    req: SeedRequest, nameLen: number, jamoFilters: (JamoFilter | null)[] | undefined,
    hasJamo: boolean, se: HanjaEntry[], targets: Set<string>, avoids: Set<string>,
  ): Promise<Map<number, HanjaEntry[]>> {
    const pools = new Map<number, HanjaEntry[]>();

    if (!hasJamo && nameLen <= 2) {
      // optimizer path: key = stroke count
      const validKeys = this.optimizer!.getValidCombinations(se.map(e => e.strokes), nameLen);
      const needed = new Set<number>();
      for (const key of validKeys) for (const s of key.split(',')) needed.add(Number(s));
      const allHanja = await this.hanjaRepo.findByStrokeRange(Math.min(...needed), Math.max(...needed));
      for (const e of allHanja) {
        if (e.is_surname || !needed.has(e.strokes) || avoids.has(e.resource_element)) continue;
        let list = pools.get(e.strokes);
        if (!list) { list = []; pools.set(e.strokes, list); }
        list.push(e);
      }
      // sort each stroke group: preferred elements first
      for (const [k, list] of pools) {
        pools.set(k, list.sort((a, b) => (targets.has(b.resource_element) ? 1 : 0) - (targets.has(a.resource_element) ? 1 : 0)));
      }
    } else {
      // pool-based path: key = position index
      const allPool = (await this.hanjaRepo.findByStrokeRange(1, 30))
        .filter(e => !e.is_surname && !avoids.has(e.resource_element));
      for (let pos = 0; pos < nameLen; pos++) {
        const f = jamoFilters?.[pos];
        if (f === null && req.givenName?.[pos]) {
          const gi = req.givenName[pos];
          if (gi.hanja) {
            const entry = await this.hanjaRepo.findByHanja(gi.hanja);
            pools.set(pos, entry ? [entry] : [makeFallbackEntry(gi.hangul)]);
          } else {
            const entries = await this.hanjaRepo.findByHangul(gi.hangul);
            pools.set(pos, entries.length ? entries.slice(0, 8) : [makeFallbackEntry(gi.hangul)]);
          }
        } else {
          let pool = allPool;
          if (f?.onset) pool = pool.filter(e => e.onset === f.onset);
          if (f?.nucleus) pool = pool.filter(e => e.nucleus === f.nucleus);
          pool = [...pool].sort((a, b) => (targets.has(b.resource_element) ? 1 : 0) - (targets.has(a.resource_element) ? 1 : 0));
          pools.set(pos, pool.slice(0, 10));
        }
      }
    }
    return pools;
  }

  private async resolveEntries(chars: NameCharInput[]): Promise<HanjaEntry[]> {
    return Promise.all(chars.map(async (c) => {
      if (c.hanja) {
        const e = await this.hanjaRepo.findByHanja(c.hanja);
        if (e) return e;
      }
      const bh = await this.hanjaRepo.findByHangul(c.hangul);
      return bh[0] ?? makeFallbackEntry(c.hangul);
    }));
  }

  close() {
    this.hanjaRepo.close();
    this.fourFrameRepo.close();
  }
}
