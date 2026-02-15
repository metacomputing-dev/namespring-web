import { HanjaRepository, type HanjaEntry } from '../database/hanja-repository.js';
import { FourframeRepository } from '../database/fourframe-repository.js';
import { NameStatRepository } from '../database/name-stat-repository.js';
import { Polarity } from '../model/polarity.js';
import { HangulCalculator } from './hangul.js';
import { HanjaCalculator } from './hanja.js';
import { FrameCalculator } from './frame.js';
import { SajuCalculator } from './saju.js';
import { evaluateName, type EvalContext } from './evaluator.js';
import type { SajuOutputSummary } from './saju.js';
import { type ElementKey, elementFromSajuCode, emptyDistribution } from './scoring.js';
import { FourFrameOptimizer } from './search.js';
import type {
  SeedRequest, SeedResponse, SeedCandidate, SajuSummary,
  PillarSummary, BirthInfo, NameCharInput, CharDetail,
} from '../model/types.js';
import { makeFallbackEntry, buildInterpretation } from '../utils/index.js';

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
const OHAENG_CODES = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as const;

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
    timeCorrection: { adjustedYear: 0, adjustedMonth: 0, adjustedDay: 0, adjustedHour: 0, adjustedMinute: 0, dstCorrectionMinutes: 0, longitudeCorrectionMinutes: 0, equationOfTimeMinutes: 0 },
    dayMaster: { stem: '', element: '', polarity: '' },
    strength: { level: '', isStrong: false, totalSupport: 0, totalOppose: 0, deukryeong: 0, deukji: 0, deukse: 0, details: [] },
    yongshin: { element: 'WOOD', heeshin: null, gishin: null, gushin: null, confidence: 0, agreement: '', recommendations: [] },
    gyeokguk: { type: '', category: '', baseSipseong: null, confidence: 0, reasoning: '' },
    ohaengDistribution: {}, deficientElements: [], excessiveElements: [],
    cheonganRelations: [], hapHwaEvaluations: [], jijiRelations: [],
    sibiUnseong: null, gongmang: null, tenGodAnalysis: null,
    shinsalHits: [], shinsalComposites: [],
    palaceAnalysis: null, daeunInfo: null, saeunPillars: [], trace: [],
    raw: {},
  };
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
  private nameStatRepo = new NameStatRepository();
  private initialized = false;
  private luckyMap = new Map<number, string>();
  private validFourFrameNumbers = new Set<number>();
  private optimizer: FourFrameOptimizer | null = null;

  async init() {
    if (this.initialized) return;
    await Promise.all([this.hanjaRepo.init(), this.fourFrameRepo.init(), this.nameStatRepo.init()]);
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
    const mode = this.resolveMode(request);
    const sajuSummary = await this.analyzeSaju(request.birth, request.options);
    const { dist, output } = this.buildSajuContext(sajuSummary);

    let inputs: NameCharInput[][];
    if (mode === 'evaluate' && request.givenName?.length) {
      inputs = [request.givenName];
    } else if (mode === 'recommend' || mode === 'all') {
      inputs = await this.generateCandidates(request, sajuSummary);
      if (request.givenName?.length) inputs.unshift(request.givenName);
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

  private resolveMode(req: SeedRequest): 'evaluate' | 'recommend' | 'all' {
    if (req.mode && req.mode !== 'auto') return req.mode;
    return req.givenName?.length && req.givenName.every(c => c.hanja) ? 'evaluate' : 'recommend';
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
    const pil = a.pillars ?? a.coreResult?.pillars;
    const cr = a.coreResult;
    const sr = a.strengthResult;
    const yr = a.yongshinResult;
    const gr = a.gyeokgukResult;
    const tga = a.tenGodAnalysis;

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
      for (const k of OHAENG_CODES) {
        const c = od[k] ?? 0;
        if (c === 0 || c <= avg * 0.4) deficient.push(k);
        else if (c >= avg * 2.0) excessive.push(k);
      }
    }

    const dmCode = String(pil?.day?.cheongan ?? '');
    const dmi = CHEONGAN[dmCode];

    let sibiUnseong: Record<string, string> | null = null;
    if (a.sibiUnseong) {
      sibiUnseong = {};
      if (a.sibiUnseong instanceof Map) {
        for (const [k, v] of a.sibiUnseong) sibiUnseong[String(k)] = String(v);
      } else {
        for (const [k, v] of Object.entries(a.sibiUnseong)) sibiUnseong[k] = String(v);
      }
    }

    let tenGodAnalysis = null;
    if (tga?.byPosition) {
      const bp: Record<string, any> = {};
      for (const [pos, info] of Object.entries(tga.byPosition)) {
        const i = info as any;
        bp[pos] = {
          cheonganSipseong: String(i.cheonganSipseong ?? ''),
          jijiPrincipalSipseong: String(i.jijiPrincipalSipseong ?? ''),
          hiddenStems: Array.isArray(i.hiddenStems)
            ? i.hiddenStems.map((h: any) => ({ stem: String(h.stem ?? ''), element: String(h.element ?? ''), ratio: Number(h.ratio) || 0 }))
            : [],
          hiddenStemSipseong: Array.isArray(i.hiddenStemSipseong)
            ? i.hiddenStemSipseong.map((h: any) => ({ stem: String(h.stem ?? ''), sipseong: String(h.sipseong ?? '') }))
            : [],
        };
      }
      tenGodAnalysis = { dayMaster: String(tga.dayMaster ?? ''), byPosition: bp };
    }

    let palaceAnalysis: Record<string, any> | null = null;
    if (a.palaceAnalysis) {
      palaceAnalysis = {};
      for (const [pos, pa] of Object.entries(a.palaceAnalysis)) {
        const p = pa as any;
        const pi = p.palaceInfo;
        palaceAnalysis[pos] = {
          position: pos, koreanName: String(pi?.koreanName ?? ''),
          domain: String(pi?.domain ?? ''), agePeriod: String(pi?.agePeriod ?? ''),
          bodyPart: String(pi?.bodyPart ?? ''),
          sipseong: p.sipseong != null ? String(p.sipseong) : null,
          familyRelation: p.familyRelation != null ? String(p.familyRelation) : null,
        };
      }
    }

    let daeunInfo = null;
    if (a.daeunInfo) {
      const di = a.daeunInfo;
      daeunInfo = {
        isForward: !!di.isForward,
        firstDaeunStartAge: Number(di.firstDaeunStartAge) || 0,
        firstDaeunStartMonths: Number(di.firstDaeunStartMonths) || 0,
        boundaryMode: String(di.boundaryMode ?? ''),
        warnings: Array.isArray(di.warnings) ? di.warnings.map(String) : [],
        pillars: (Array.isArray(di.daeunPillars) ? di.daeunPillars : []).map((p: any) => ({
          stem: String(p.pillar?.cheongan ?? ''), branch: String(p.pillar?.jiji ?? ''),
          startAge: Number(p.startAge) || 0, endAge: Number(p.endAge) || 0, order: Number(p.order) || 0,
        })),
      };
    }

    const wsh = Array.isArray(a.weightedShinsalHits) ? a.weightedShinsalHits : [];
    const shinsalHits = wsh.length > 0
      ? wsh.map((w: any) => ({
          type: String(w.hit?.type ?? ''), position: String(w.hit?.position ?? ''), grade: String(w.hit?.grade ?? ''),
          baseWeight: Number(w.baseWeight) || 0, positionMultiplier: Number(w.positionMultiplier) || 0, weightedScore: Number(w.weightedScore) || 0,
        }))
      : (Array.isArray(a.shinsalHits) ? a.shinsalHits : []).map((h: any) => ({
          type: String(h.type ?? ''), position: String(h.position ?? ''), grade: String(h.grade ?? ''),
          baseWeight: 0, positionMultiplier: 0, weightedScore: 0,
        }));

    const rjr = Array.isArray(a.resolvedJijiRelations) ? a.resolvedJijiRelations : [];
    const jijiRelations = rjr.length > 0
      ? rjr.map((r: any) => ({
          type: String(r.hit?.type ?? ''), branches: toStrArr(r.hit?.members), note: String(r.hit?.note ?? ''),
          outcome: r.outcome != null ? String(r.outcome) : null, reasoning: r.reasoning != null ? String(r.reasoning) : null,
        }))
      : (Array.isArray(a.jijiRelations) ? a.jijiRelations : []).map((r: any) => ({
          type: String(r.type ?? ''), branches: toStrArr(r.members), note: String(r.note ?? ''),
          outcome: null, reasoning: null,
        }));

    const gm = a.gongmangVoidBranches;

    return {
      pillars: { year: mapPillar(pil?.year), month: mapPillar(pil?.month), day: mapPillar(pil?.day), hour: mapPillar(pil?.hour) },
      timeCorrection: {
        adjustedYear: Number(cr?.adjustedYear) || 0, adjustedMonth: Number(cr?.adjustedMonth) || 0,
        adjustedDay: Number(cr?.adjustedDay) || 0, adjustedHour: Number(cr?.adjustedHour) || 0, adjustedMinute: Number(cr?.adjustedMinute) || 0,
        dstCorrectionMinutes: Number(cr?.dstCorrectionMinutes) || 0,
        longitudeCorrectionMinutes: Number(cr?.longitudeCorrectionMinutes) || 0,
        equationOfTimeMinutes: Number(cr?.equationOfTimeMinutes) || 0,
      },
      dayMaster: {
        stem: dmCode,
        element: sr?.dayMasterElement ? String(sr.dayMasterElement) : (dmi?.el ?? ''),
        polarity: dmi?.pol ?? '',
      },
      strength: {
        level: String(sr?.level ?? ''), isStrong: !!sr?.isStrong,
        totalSupport: Number(sr?.score?.totalSupport) || 0, totalOppose: Number(sr?.score?.totalOppose) || 0,
        deukryeong: Number(sr?.score?.deukryeong) || 0, deukji: Number(sr?.score?.deukji) || 0, deukse: Number(sr?.score?.deukse) || 0,
        details: Array.isArray(sr?.details) ? sr.details.map(String) : [],
      },
      yongshin: {
        element: String(yr?.finalYongshin ?? ''),
        heeshin: yr?.finalHeesin != null ? String(yr.finalHeesin) : null,
        gishin: yr?.gisin != null ? String(yr.gisin) : null,
        gushin: yr?.gusin != null ? String(yr.gusin) : null,
        confidence: Number(yr?.finalConfidence) || 0,
        agreement: String(yr?.agreement ?? ''),
        recommendations: Array.isArray(yr?.recommendations) ? yr.recommendations.map((r: any) => ({
          type: String(r.type ?? ''), primaryElement: String(r.primaryElement ?? ''),
          secondaryElement: r.secondaryElement != null ? String(r.secondaryElement) : null,
          confidence: Number(r.confidence) || 0, reasoning: String(r.reasoning ?? ''),
        })) : [],
      },
      gyeokguk: {
        type: String(gr?.type ?? ''), category: String(gr?.category ?? ''),
        baseSipseong: gr?.baseSipseong != null ? String(gr.baseSipseong) : null,
        confidence: Number(gr?.confidence) || 0, reasoning: String(gr?.reasoning ?? ''),
      },
      ohaengDistribution: od, deficientElements: deficient, excessiveElements: excessive,
      cheonganRelations: (Array.isArray(a.cheonganRelations) ? a.cheonganRelations : []).map((r: any) => ({
        type: String(r.type ?? ''), stems: toStrArr(r.members),
        resultElement: r.resultOhaeng != null ? String(r.resultOhaeng) : null, note: String(r.note ?? ''),
      })),
      hapHwaEvaluations: (Array.isArray(a.hapHwaEvaluations) ? a.hapHwaEvaluations : []).map((e: any) => ({
        stem1: String(e.stem1 ?? ''), stem2: String(e.stem2 ?? ''),
        position1: String(e.position1 ?? ''), position2: String(e.position2 ?? ''),
        resultElement: String(e.resultOhaeng ?? ''), state: String(e.state ?? ''),
        confidence: Number(e.confidence) || 0, reasoning: String(e.reasoning ?? ''),
        dayMasterInvolved: !!e.dayMasterInvolved,
      })),
      jijiRelations, sibiUnseong,
      gongmang: Array.isArray(gm) && gm.length >= 2 ? [String(gm[0]), String(gm[1])] as [string, string] : null,
      tenGodAnalysis, shinsalHits,
      shinsalComposites: (Array.isArray(a.shinsalComposites) ? a.shinsalComposites : []).map((c: any) => ({
        patternName: String(c.patternName ?? ''), interactionType: String(c.interactionType ?? ''),
        interpretation: String(c.interpretation ?? ''), bonusScore: Number(c.bonusScore) || 0,
      })),
      palaceAnalysis, daeunInfo,
      saeunPillars: (Array.isArray(a.saeunPillars) ? a.saeunPillars : []).map((s: any) => ({
        year: Number(s.year) || 0, stem: String(s.pillar?.cheongan ?? ''), branch: String(s.pillar?.jiji ?? ''),
      })),
      trace: (Array.isArray(a.trace) ? a.trace : []).map((t: any) => ({
        key: String(t.key ?? ''), summary: String(t.summary ?? ''),
        evidence: Array.isArray(t.evidence) ? t.evidence.map(String) : [],
        citations: Array.isArray(t.citations) ? t.citations.map(String) : [],
        reasoning: Array.isArray(t.reasoning) ? t.reasoning.map(String) : [],
        confidence: typeof t.confidence === 'number' ? t.confidence : null,
      })),
      raw: serialize(a) as Record<string, unknown>,
    };
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
        const g1 = SIPSEONG_GROUP[info.cheonganSipseong];
        if (g1) gc[g1]++;
        const g2 = SIPSEONG_GROUP[info.jijiPrincipalSipseong];
        if (g2) gc[g2]++;
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
          recommendations: y.recommendations.map(r => ({
            type: r.type, primaryElement: r.primaryElement,
            secondaryElement: r.secondaryElement,
            confidence: r.confidence, reasoning: r.reasoning,
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
    const all = [...se, ...ge];
    const r = (v: number) => Math.round(v * 10) / 10;
    return {
      name: {
        surname: se.map(toCharDetail), givenName: ge.map(toCharDetail),
        fullHangul: all.map(e => e.hangul).join(''), fullHanja: all.map(e => e.hanja).join('')
      },
      scores: {
        total: r(ev.score),
        hangul: r(((cm.BALEUM_OHAENG?.score ?? 0) + (cm.BALEUM_EUMYANG?.score ?? 0)) / 2),
        hanja: r(((cm.HOEKSU_EUMYANG?.score ?? 0) + (cm.SAGYEOK_OHAENG?.score ?? 0)) / 2),
        fourFrame: r(cm.SAGYEOK_SURI?.score ?? 0),
        saju: r(cm.SAJU_JAWON_BALANCE?.score ?? 0)
      },
      analysis: {
        hangul: hangul.getAnalysis().data, hanja: hanja.getAnalysis().data,
        fourFrame: frame.getAnalysis().data, saju: saju.getAnalysis().data
      },
      interpretation: buildInterpretation(ev), rank: 0
    };
  }

  private async generateCandidates(req: SeedRequest, saju: SajuSummary): Promise<NameCharInput[][]> {
    const se = await this.resolveEntries(req.surname);
    const nameLen = req.givenNameLength ?? 2;
    const validKeys = this.optimizer!.getValidCombinations(se.map(e => e.strokes), nameLen);
    const targets = collectElements(saju.yongshin.element, saju.yongshin.heeshin, saju.deficientElements);
    const avoids = collectElements(saju.yongshin.gishin, saju.yongshin.gushin, saju.excessiveElements);
    if (targets.size === 0) targets.add('Wood');

    const needed = new Set<number>();
    for (const key of validKeys) for (const s of key.split(',')) needed.add(Number(s));
    const allHanja = await this.hanjaRepo.findByStrokeRange(Math.min(...needed), Math.max(...needed));

    const pref = new Map<number, HanjaEntry[]>();
    const acc = new Map<number, HanjaEntry[]>();
    for (const e of allHanja) {
      if (e.is_surname || !needed.has(e.strokes) || avoids.has(e.resource_element)) continue;
      const map = targets.has(e.resource_element) ? pref : acc;
      let list = map.get(e.strokes);
      if (!list) { list = []; map.set(e.strokes, list); }
      list.push(e);
    }

    const chars = (s: number) => [...(pref.get(s) ?? []), ...(acc.get(s) ?? [])];
    const out: NameCharInput[][] = [];
    const inp = (c: HanjaEntry): NameCharInput => ({ hangul: c.hangul, hanja: c.hanja });

    for (const sk of validKeys) {
      if (out.length >= MAX_CANDIDATES) break;
      const sc = sk.split(',').map(Number);
      if (nameLen === 1) {
        for (const c of chars(sc[0]).slice(0, 8)) {
          out.push([inp(c)]);
          if (out.length >= MAX_CANDIDATES) break;
        }
      } else {
        const c1 = chars(sc[0]).slice(0, 6), c2 = chars(sc[1]).slice(0, 6);
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
    return out;
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
    this.nameStatRepo.close();
  }
}
