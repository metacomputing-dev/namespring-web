import { HanjaRepository, type HanjaEntry } from './database/hanja-repository.js';
import { FourframeRepository } from './database/fourframe-repository.js';
import { NameStatRepository } from './database/name-stat-repository.js';
import { FourFrameCalculator } from './calculator/frame-calculator.js';
import { HangulCalculator } from './calculator/hangul-calculator.js';
import { HanjaCalculator } from './calculator/hanja-calculator.js';
import { Element } from './model/element.js';
import { Polarity } from './model/polarity.js';
import { NameEvaluator, type EvaluationResult } from './evaluator/name-evaluator.js';
import { FourFrameOptimizer, toStrokeKey, calculateFourFrameNumbersFromStrokes } from './search/four-frame-optimizer.js';
import { MinHeap, pushTopK } from './search/heap.js';
import type { ElementKey } from './evaluator/element-cycle.js';
import { ELEMENT_KEYS, elementToKey, elementFromSajuCode, emptyDistribution } from './evaluator/element-cycle.js';
import type { SajuOutputSummary } from './evaluator/strength-scorer.js';
import type {
  SeedRequest, SeedResponse, SeedCandidate, SajuSummary, PillarSummary,
  BirthInfo, NameCharInput, ScoreWeights, CharDetail,
} from './types.js';

// ── saju-ts optional integration ──

type SajuModule = {
  analyzeSaju: (input: any, config?: any) => any;
  createBirthInput: (params: any) => any;
};

let sajuModule: SajuModule | null = null;
const SAJU_MODULE_PATH = '../../saju-ts/src/index.js';

async function loadSajuModule(): Promise<SajuModule | null> {
  if (sajuModule) return sajuModule;
  try {
    sajuModule = await (Function('p', 'return import(p)')(SAJU_MODULE_PATH)) as SajuModule;
    return sajuModule;
  } catch { return null; }
}

// ── Constants ──

const ALL_ELEMENTS = [Element.Wood, Element.Fire, Element.Earth, Element.Metal, Element.Water];
const MAX_STROKES = 30;
const MAX_CANDIDATES = 200;

function adjustTo81(value: number): number {
  if (value <= 81) return value;
  return ((value - 1) % 81) + 1;
}

function ohaengToElement(ohaeng: string): Element {
  const map: Record<string, Element> = {
    'WOOD': Element.Wood, 'FIRE': Element.Fire, 'EARTH': Element.Earth,
    'METAL': Element.Metal, 'WATER': Element.Water,
    'Wood': Element.Wood, 'Fire': Element.Fire, 'Earth': Element.Earth,
    'Metal': Element.Metal, 'Water': Element.Water,
  };
  return map[ohaeng] ?? Element.Earth;
}

// ══════════════════════════════════════════════════════════════
// SeedEngine
// ══════════════════════════════════════════════════════════════

export class SeedEngine {
  private hanjaRepo: HanjaRepository;
  private fourFrameRepo: FourframeRepository;
  private nameStatRepo: NameStatRepository;
  private initialized = false;

  /** Pre-loaded 81수리: number → lucky_level string (fortune text) */
  private luckyMap: Map<number, string> = new Map();
  /** Valid 81수리 numbers (fortune bucket >= 15 i.e. 양운수 이상) */
  private validFourFrameNumbers: Set<number> = new Set();
  /** NameEvaluator instance (created after init) */
  private evaluator: NameEvaluator | null = null;
  /** FourFrameOptimizer instance */
  private optimizer: FourFrameOptimizer | null = null;

  constructor() {
    this.hanjaRepo = new HanjaRepository();
    this.fourFrameRepo = new FourframeRepository();
    this.nameStatRepo = new NameStatRepository();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await Promise.all([
      this.hanjaRepo.init(),
      this.fourFrameRepo.init(),
      this.nameStatRepo.init(),
    ]);
    await this.buildLuckyMap();
    this.evaluator = new NameEvaluator(this.luckyMap);
    this.optimizer = new FourFrameOptimizer(this.validFourFrameNumbers);
    this.initialized = true;
  }

  private async buildLuckyMap(): Promise<void> {
    const allEntries = await this.fourFrameRepo.findAll(81);
    for (const entry of allEntries) {
      this.luckyMap.set(entry.number, entry.lucky_level ?? '');
      // Determine if this is a valid (favorable) number using fortune bucket
      const level = entry.lucky_level ?? '';
      if (level.includes('최상') || level.includes('상') || level.includes('양')) {
        this.validFourFrameNumbers.add(entry.number);
      }
    }
  }

  // ── Main API ──

  async analyze(request: SeedRequest): Promise<SeedResponse> {
    await this.init();

    const mode = this.resolveMode(request);
    const sajuSummary = await this.analyzeSaju(request.birth);
    const sajuDistribution = this.buildSajuDistribution(sajuSummary);
    const sajuOutput = this.buildSajuOutput(sajuSummary);

    let candidateInputs: NameCharInput[][];

    if (mode === 'evaluate' && request.givenName && request.givenName.length > 0) {
      candidateInputs = [request.givenName];
    } else if (mode === 'recommend' || mode === 'all') {
      candidateInputs = await this.generateCandidates(request, sajuSummary);
      if (request.givenName && request.givenName.length > 0) {
        candidateInputs.unshift(request.givenName);
      }
    } else {
      candidateInputs = request.givenName?.length ? [request.givenName] : [];
    }

    // Score all candidates using evaluator pipeline
    const scored: SeedCandidate[] = [];
    for (const givenName of candidateInputs) {
      const candidate = await this.scoreCandidate(
        request.surname, givenName, sajuDistribution, sajuOutput,
      );
      scored.push(candidate);
    }

    // Sort by total score
    scored.sort((a, b) => b.scores.total - a.scores.total);

    const offset = request.options?.offset ?? 0;
    const limit = request.options?.limit ?? 20;
    const paginated = scored.slice(offset, offset + limit);
    const ranked = paginated.map((c, i) => ({ ...c, rank: offset + i + 1 }));

    return {
      request,
      mode,
      saju: sajuSummary,
      candidates: ranked,
      totalCount: scored.length,
      meta: { version: '2.0.0', timestamp: new Date().toISOString() },
    };
  }

  // ── Mode resolution ──

  private resolveMode(request: SeedRequest): 'evaluate' | 'recommend' | 'all' {
    if (request.mode && request.mode !== 'auto') return request.mode;
    if (request.givenName && request.givenName.length > 0) {
      return request.givenName.every(c => c.hanja) ? 'evaluate' : 'recommend';
    }
    return 'recommend';
  }

  // ── Saju Analysis ──

  private async analyzeSaju(birth: BirthInfo): Promise<SajuSummary> {
    const saju = await loadSajuModule();
    if (saju) {
      try {
        const birthInput = saju.createBirthInput({
          birthYear: birth.year, birthMonth: birth.month,
          birthDay: birth.day, birthHour: birth.hour, birthMinute: birth.minute,
          gender: birth.gender === 'male' ? 'MALE' : 'FEMALE',
          timezone: birth.timezone ?? 'Asia/Seoul',
          latitude: birth.latitude ?? 37.5665, longitude: birth.longitude ?? 126.978,
        });
        const analysis = saju.analyzeSaju(birthInput);
        return this.extractSajuSummary(analysis);
      } catch { /* fall through */ }
    }
    return this.placeholderSajuSummary();
  }

  private extractSajuSummary(analysis: any): SajuSummary {
    const pillars = analysis.pillars ?? analysis.coreResult?.pillars;
    const makePillar = (p: any): PillarSummary => ({
      stem: { code: p?.cheongan ?? '', hangul: p?.cheongan ?? '', hanja: '' },
      branch: { code: p?.jiji ?? '', hangul: p?.jiji ?? '', hanja: '' },
    });
    const yongshinResult = analysis.yongshinResult;
    const strengthResult = analysis.strengthResult;
    const gyeokgukResult = analysis.gyeokgukResult;
    const ohaengDist: Record<string, number> = {};
    if (analysis.ohaengDistribution) {
      if (analysis.ohaengDistribution instanceof Map) {
        for (const [k, v] of analysis.ohaengDistribution) ohaengDist[String(k)] = Number(v);
      } else {
        Object.assign(ohaengDist, analysis.ohaengDistribution);
      }
    }
    const { deficient, excessive } = this.analyzeOhaengBalance(ohaengDist);

    return {
      pillars: {
        year: makePillar(pillars?.year), month: makePillar(pillars?.month),
        day: makePillar(pillars?.day), hour: makePillar(pillars?.hour),
      },
      dayMaster: {
        stem: pillars?.day?.cheongan ?? '',
        element: strengthResult?.dayMasterElement ?? '',
        polarity: '',
      },
      strength: {
        level: strengthResult?.level ?? '',
        isStrong: strengthResult?.isStrong ?? false,
        score: strengthResult?.score?.totalSupport ?? 0,
      },
      yongshin: {
        element: yongshinResult?.finalYongshin ?? '',
        heeshin: yongshinResult?.finalHeesin ?? null,
        gishin: yongshinResult?.gisin ?? null,
        gushin: yongshinResult?.gusin ?? null,
        confidence: yongshinResult?.finalConfidence ?? 0,
        reasoning: yongshinResult?.recommendations?.[0]?.reasoning ?? '',
      },
      gyeokguk: {
        type: gyeokgukResult?.type ?? '',
        category: gyeokgukResult?.category ?? '',
        confidence: gyeokgukResult?.confidence ?? 0,
      },
      ohaengDistribution: ohaengDist,
      deficientElements: deficient,
      excessiveElements: excessive,
    };
  }

  private analyzeOhaengBalance(dist: Record<string, number>): { deficient: string[]; excessive: string[] } {
    const total = Object.values(dist).reduce((s, v) => s + v, 0);
    if (total === 0) return { deficient: [], excessive: [] };
    const avg = total / 5;
    const deficient: string[] = [];
    const excessive: string[] = [];
    for (const key of ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER']) {
      const count = dist[key] ?? 0;
      if (count === 0 || count <= avg * 0.4) deficient.push(key);
      else if (count >= avg * 2.0) excessive.push(key);
    }
    return { deficient, excessive };
  }

  private placeholderSajuSummary(): SajuSummary {
    const emptyPillar: PillarSummary = {
      stem: { code: '', hangul: '', hanja: '' },
      branch: { code: '', hangul: '', hanja: '' },
    };
    return {
      pillars: { year: emptyPillar, month: emptyPillar, day: emptyPillar, hour: emptyPillar },
      dayMaster: { stem: '', element: '', polarity: '' },
      strength: { level: '', isStrong: false, score: 0 },
      yongshin: { element: 'WOOD', heeshin: null, gishin: null, gushin: null, confidence: 0, reasoning: '' },
      gyeokguk: { type: '', category: '', confidence: 0 },
      ohaengDistribution: {},
      deficientElements: [],
      excessiveElements: [],
    };
  }

  // ── Build evaluator inputs from SajuSummary ──

  private buildSajuDistribution(summary: SajuSummary): Record<ElementKey, number> {
    const dist = emptyDistribution();
    for (const [code, count] of Object.entries(summary.ohaengDistribution)) {
      const key = elementFromSajuCode(code);
      if (key) dist[key] = (dist[key] ?? 0) + count;
    }
    return dist;
  }

  private buildSajuOutput(summary: SajuSummary): SajuOutputSummary | null {
    if (!summary.dayMaster.element && !summary.yongshin.element) return null;
    const dmKey = elementFromSajuCode(summary.dayMaster.element);
    return {
      dayMaster: dmKey ? { element: dmKey } : undefined,
      strength: {
        isStrong: summary.strength.isStrong,
        totalSupport: summary.strength.score,
        totalOppose: 0,
      },
      yongshin: {
        finalYongshin: summary.yongshin.element,
        finalHeesin: summary.yongshin.heeshin,
        gisin: summary.yongshin.gishin,
        gusin: summary.yongshin.gushin,
        finalConfidence: summary.yongshin.confidence,
        recommendations: summary.yongshin.reasoning ? [{
          type: 'EOKBU',
          primaryElement: summary.yongshin.element,
          secondaryElement: summary.yongshin.heeshin,
          confidence: summary.yongshin.confidence,
          reasoning: summary.yongshin.reasoning,
        }] : [],
      },
      tenGod: undefined,
    };
  }

  // ── Score a single candidate using evaluator pipeline ──

  private async scoreCandidate(
    surname: NameCharInput[],
    givenName: NameCharInput[],
    sajuDist: Record<ElementKey, number>,
    sajuOutput: SajuOutputSummary | null,
  ): Promise<SeedCandidate> {
    const surnameEntries = await this.resolveEntries(surname);
    const givenNameEntries = await this.resolveEntries(givenName);

    // Run evaluator pipeline (matching namespring-web)
    const evalResult = this.evaluator!.evaluate(
      surnameEntries, givenNameEntries, sajuDist, sajuOutput,
    );

    // Extract individual frame scores for backward-compat scores object
    const sagyeokScore = evalResult.categoryMap.SAGYEOK_SURI?.score ?? 0;
    const sajuBalance = evalResult.categoryMap.SAJU_JAWON_BALANCE?.score ?? 0;
    const hoeksuEumyang = evalResult.categoryMap.HOEKSU_EUMYANG?.score ?? 0;
    const baleumOhaeng = evalResult.categoryMap.BALEUM_OHAENG?.score ?? 0;
    const baleumEumyang = evalResult.categoryMap.BALEUM_EUMYANG?.score ?? 0;
    const sagyeokOhaeng = evalResult.categoryMap.SAGYEOK_OHAENG?.score ?? 0;

    // Map to the 4-category scores for backward compat
    const hangulScore = (baleumOhaeng + baleumEumyang) / 2;
    const hanjaScore = (hoeksuEumyang + sagyeokOhaeng) / 2;
    const fourFrameScore = sagyeokScore;
    const sajuScore = sajuBalance;
    const totalScore = evalResult.score;

    const surnameDetails = this.toCharDetails(surnameEntries);
    const givenNameDetails = this.toCharDetails(givenNameEntries);

    // Build analysis details from calculators
    const hangulCalc = new HangulCalculator(surnameEntries, givenNameEntries);
    const hanjaCalc = new HanjaCalculator(surnameEntries, givenNameEntries);
    const fourFrameCalc = new FourFrameCalculator(surnameEntries, givenNameEntries);
    hangulCalc.calculate();
    hanjaCalc.calculate();
    fourFrameCalc.calculate();

    return {
      name: {
        surname: surnameDetails,
        givenName: givenNameDetails,
        fullHangul: [...surnameEntries, ...givenNameEntries].map(e => e.hangul).join(''),
        fullHanja: [...surnameEntries, ...givenNameEntries].map(e => e.hanja).join(''),
      },
      scores: {
        total: Math.round(totalScore * 10) / 10,
        hangul: Math.round(hangulScore * 10) / 10,
        hanja: Math.round(hanjaScore * 10) / 10,
        fourFrame: Math.round(fourFrameScore * 10) / 10,
        saju: Math.round(sajuScore * 10) / 10,
      },
      analysis: {
        hangul: hangulCalc.getAnalysis().data,
        hanja: hanjaCalc.getAnalysis().data,
        fourFrame: fourFrameCalc.getAnalysis().data,
        saju: {
          yongshinElement: elementFromSajuCode(sajuOutput?.yongshin?.finalYongshin ?? '') ?? '',
          heeshinElement: elementFromSajuCode(sajuOutput?.yongshin?.finalHeesin ?? null) ?? null,
          gishinElement: elementFromSajuCode(sajuOutput?.yongshin?.gisin ?? null) ?? null,
          nameElements: givenNameEntries.map(e => e.resource_element),
          yongshinMatchCount: 0,
          yongshinGeneratingCount: 0,
          gishinMatchCount: 0,
          gishinOvercomingCount: 0,
          deficiencyFillCount: 0,
          excessiveAvoidCount: 0,
          dayMasterSupportScore: 0,
          affinityScore: sajuBalance,
        },
      },
      interpretation: this.buildInterpretation(evalResult),
      rank: 0,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // Name Generation (recommend/all mode)
  // ══════════════════════════════════════════════════════════════

  private async generateCandidates(
    request: SeedRequest,
    sajuSummary: SajuSummary,
  ): Promise<NameCharInput[][]> {
    const surnameEntries = await this.resolveEntries(request.surname);
    const surnameStrokes = surnameEntries.map(e => e.strokes);
    const targetLength = request.givenNameLength ?? 2;

    // Use FourFrameOptimizer (matching namespring-web)
    const validStrokeKeys = this.optimizer!.getValidCombinations(surnameStrokes, targetLength);

    // Determine target/avoid elements from saju
    const targetElements = this.determineTargetElements(sajuSummary);
    const avoidElements = this.determineAvoidElements(sajuSummary);

    // Pre-load hanja by element and strokes
    const hanjaByElementAndStrokes = new Map<string, Map<number, HanjaEntry[]>>();
    for (const el of ALL_ELEMENTS) {
      const entries = await this.hanjaRepo.findByResourceElement(el.english);
      const byStrokes = new Map<number, HanjaEntry[]>();
      for (const entry of entries) {
        if (entry.is_surname) continue;
        const existing = byStrokes.get(entry.strokes) ?? [];
        existing.push(entry);
        byStrokes.set(entry.strokes, existing);
      }
      hanjaByElementAndStrokes.set(el.english, byStrokes);
    }

    const candidates: NameCharInput[][] = [];

    for (const strokeKey of validStrokeKeys) {
      if (candidates.length >= MAX_CANDIDATES) break;
      const strokeCounts = strokeKey.split(',').map(Number);

      if (targetLength === 1) {
        const chars = this.findCharsForSlot(strokeCounts[0], targetElements, avoidElements, hanjaByElementAndStrokes);
        for (const c of chars.slice(0, 5)) {
          candidates.push([{ hangul: c.hangul, hanja: c.hanja }]);
          if (candidates.length >= MAX_CANDIDATES) break;
        }
      } else {
        const chars1 = this.findCharsForSlot(strokeCounts[0], targetElements, avoidElements, hanjaByElementAndStrokes);
        const chars2 = this.findCharsForSlot(strokeCounts[1], targetElements, avoidElements, hanjaByElementAndStrokes);
        for (const c1 of chars1.slice(0, 4)) {
          for (const c2 of chars2.slice(0, 4)) {
            if (c1.hanja === c2.hanja) continue;
            candidates.push([
              { hangul: c1.hangul, hanja: c1.hanja },
              { hangul: c2.hangul, hanja: c2.hanja },
            ]);
            if (candidates.length >= MAX_CANDIDATES) break;
          }
          if (candidates.length >= MAX_CANDIDATES) break;
        }
      }
    }

    return candidates;
  }

  private determineTargetElements(summary: SajuSummary): Element[] {
    const targets: Element[] = [];
    const yong = elementFromSajuCode(summary.yongshin.element);
    if (yong) targets.push(Element.get(yong));
    const hee = elementFromSajuCode(summary.yongshin.heeshin);
    if (hee && !targets.some(t => t.english === hee)) targets.push(Element.get(hee));
    for (const d of summary.deficientElements) {
      const key = elementFromSajuCode(d);
      if (key && !targets.some(t => t.english === key)) targets.push(Element.get(key));
    }
    if (targets.length === 0) targets.push(Element.Wood);
    return targets;
  }

  private determineAvoidElements(summary: SajuSummary): Element[] {
    const avoid: Element[] = [];
    const gis = elementFromSajuCode(summary.yongshin.gishin);
    if (gis) avoid.push(Element.get(gis));
    const gus = elementFromSajuCode(summary.yongshin.gushin);
    if (gus && !avoid.some(a => a.english === gus)) avoid.push(Element.get(gus));
    for (const e of summary.excessiveElements) {
      const key = elementFromSajuCode(e);
      if (key && !avoid.some(a => a.english === key)) avoid.push(Element.get(key));
    }
    return avoid;
  }

  private findCharsForSlot(
    strokes: number,
    targetElements: Element[],
    avoidElements: Element[],
    hanjaByElementAndStrokes: Map<string, Map<number, HanjaEntry[]>>,
  ): HanjaEntry[] {
    const preferred: HanjaEntry[] = [];
    const acceptable: HanjaEntry[] = [];
    for (const el of ALL_ELEMENTS) {
      const chars = hanjaByElementAndStrokes.get(el.english)?.get(strokes) ?? [];
      const isTarget = targetElements.some(t => t.isSameAs(el));
      const isAvoid = avoidElements.some(a => a.isSameAs(el));
      if (isAvoid) continue;
      if (isTarget) preferred.push(...chars);
      else acceptable.push(...chars);
    }
    return [...preferred, ...acceptable];
  }

  // ── Entry resolution ──

  private async resolveEntries(chars: NameCharInput[]): Promise<HanjaEntry[]> {
    const entries: HanjaEntry[] = [];
    for (const char of chars) {
      if (char.hanja) {
        const entry = await this.hanjaRepo.findByHanja(char.hanja);
        if (entry) { entries.push(entry); continue; }
      }
      const byHangul = await this.hanjaRepo.findByHangul(char.hangul);
      if (byHangul.length > 0) entries.push(byHangul[0]);
      else entries.push(this.makeFallbackEntry(char.hangul));
    }
    return entries;
  }

  private makeFallbackEntry(hangul: string): HanjaEntry {
    const code = hangul.charCodeAt(0) - 0xAC00;
    const onset = code >= 0 && code <= 11171 ? Math.floor(code / 588) : 0;
    const nucleus = code >= 0 && code <= 11171 ? Math.floor((code % 588) / 28) : 0;
    const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    const JUNGSEONG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
    return {
      id: 0, hangul, hanja: hangul,
      onset: CHOSEONG[onset] ?? 'ㅇ', nucleus: JUNGSEONG[nucleus] ?? 'ㅏ',
      strokes: 1, stroke_element: 'Wood', resource_element: 'Earth',
      meaning: '', radical: '', is_surname: false,
    };
  }

  private toCharDetails(entries: HanjaEntry[]): CharDetail[] {
    return entries.map(e => ({
      hangul: e.hangul, hanja: e.hanja, meaning: e.meaning,
      strokes: e.strokes, element: e.resource_element,
      polarity: Polarity.get(e.strokes).english,
    }));
  }

  // ── Interpretation builder ──

  private buildInterpretation(evalResult: EvaluationResult): string {
    const parts: string[] = [];
    const score = evalResult.score;

    if (evalResult.isPassed) {
      if (score >= 80) parts.push('종합적으로 매우 우수한 이름입니다.');
      else if (score >= 65) parts.push('종합적으로 좋은 이름입니다.');
      else parts.push('합격 기준을 충족하는 이름입니다.');
    } else {
      if (score >= 55) parts.push('보통 수준의 이름입니다.');
      else parts.push('개선 여지가 있는 이름입니다.');
    }

    // Per-frame feedback
    for (const cat of evalResult.categories) {
      if (cat.frame === 'SEONGMYEONGHAK') continue;
      if (!cat.isPassed && cat.score < 50) {
        const label = this.frameLabel(cat.frame);
        parts.push(`${label} 부분을 점검해 보세요.`);
      }
    }

    return parts.join(' ');
  }

  private frameLabel(frame: string): string {
    const labels: Record<string, string> = {
      'SAGYEOK_SURI': '사격수리(81수리)',
      'SAJU_JAWON_BALANCE': '사주 자원 균형',
      'HOEKSU_EUMYANG': '획수 음양',
      'BALEUM_OHAENG': '발음 오행',
      'BALEUM_EUMYANG': '발음 음양',
      'SAGYEOK_OHAENG': '사격 오행',
    };
    return labels[frame] ?? frame;
  }

  close(): void {
    this.hanjaRepo.close();
    this.fourFrameRepo.close();
    this.nameStatRepo.close();
  }
}
