import { HanjaRepository, type HanjaEntry } from './database/hanja-repository.js';
import { FourframeRepository } from './database/fourframe-repository.js';
import { NameStatRepository } from './database/name-stat-repository.js';
import { FourFrameCalculator } from './calculator/frame-calculator.js';
import { HangulCalculator } from './calculator/hangul-calculator.js';
import { HanjaCalculator } from './calculator/hanja-calculator.js';
import { SajuCalculator } from './calculator/saju-calculator.js';
import { Energy } from './model/energy.js';
import { Element } from './model/element.js';
import { Polarity } from './model/polarity.js';
import type {
  SeedRequest,
  SeedResponse,
  SeedCandidate,
  SajuSummary,
  PillarSummary,
  BirthInfo,
  NameCharInput,
  ScoreWeights,
  CharDetail,
} from './types.js';

// saju-ts integration (optional — gracefully degrades if unavailable)
type SajuModule = {
  analyzeSaju: (input: any, config?: any) => any;
  createBirthInput: (params: any) => any;
};

let sajuModule: SajuModule | null = null;

// Use a variable to prevent TypeScript from statically resolving the import
const SAJU_MODULE_PATH = '../../saju-ts/src/index.js';

async function loadSajuModule(): Promise<SajuModule | null> {
  if (sajuModule) return sajuModule;
  try {
    sajuModule = await (Function('p', 'return import(p)')(SAJU_MODULE_PATH)) as SajuModule;
    return sajuModule;
  } catch {
    return null;
  }
}

const DEFAULT_WEIGHTS: Required<ScoreWeights> = {
  hangul: 25,
  hanja: 25,
  fourFrame: 25,
  saju: 25,
};

/**
 * SeedEngine — main orchestrator for naming analysis.
 *
 * Pipeline:
 *   SeedRequest
 *     → init() — DB/WASM load (idempotent)
 *     → resolveMode()
 *     → analyzeSaju(birth) → SajuSummary
 *     → generateCandidates() or use provided givenName
 *     → scoreCandidate() for each
 *     → weighted average, sort, paginate
 *     → SeedResponse
 */
export class SeedEngine {
  private hanjaRepo: HanjaRepository;
  private fourFrameRepo: FourframeRepository;
  private nameStatRepo: NameStatRepository;
  private initialized = false;

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
    this.initialized = true;
  }

  async analyze(request: SeedRequest): Promise<SeedResponse> {
    await this.init();

    const mode = this.resolveMode(request);
    const sajuSummary = await this.analyzeSaju(request.birth);
    const weights = { ...DEFAULT_WEIGHTS, ...request.options?.weights };

    let candidateInputs: NameCharInput[][];

    if (mode === 'evaluate' && request.givenName && request.givenName.length > 0) {
      candidateInputs = [request.givenName];
    } else if (mode === 'recommend' || mode === 'all') {
      candidateInputs = await this.generateCandidates(request, sajuSummary);
      if (request.givenName && request.givenName.length > 0) {
        candidateInputs.unshift(request.givenName);
      }
    } else {
      candidateInputs = request.givenName && request.givenName.length > 0
        ? [request.givenName]
        : [];
    }

    const candidates: SeedCandidate[] = [];
    for (const givenName of candidateInputs) {
      const candidate = await this.scoreCandidate(
        request.surname, givenName, sajuSummary, weights,
      );
      candidates.push(candidate);
    }

    // Sort by total score descending
    candidates.sort((a, b) => b.scores.total - a.scores.total);

    // Apply pagination
    const offset = request.options?.offset ?? 0;
    const limit = request.options?.limit ?? 20;
    const paginated = candidates.slice(offset, offset + limit);

    // Assign ranks
    const ranked = paginated.map((c, i) => ({ ...c, rank: offset + i + 1 }));

    return {
      request,
      mode,
      saju: sajuSummary,
      candidates: ranked,
      totalCount: candidates.length,
      meta: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    };
  }

  private resolveMode(request: SeedRequest): 'evaluate' | 'recommend' | 'all' {
    if (request.mode && request.mode !== 'auto') return request.mode;

    // Auto-resolve: if givenName is fully provided, evaluate; otherwise recommend
    if (request.givenName && request.givenName.length > 0) {
      const allHaveHanja = request.givenName.every(c => c.hanja);
      return allHaveHanja ? 'evaluate' : 'recommend';
    }
    return 'recommend';
  }

  private async analyzeSaju(birth: BirthInfo): Promise<SajuSummary> {
    const saju = await loadSajuModule();

    if (saju) {
      try {
        const birthInput = saju.createBirthInput({
          birthYear: birth.year,
          birthMonth: birth.month,
          birthDay: birth.day,
          birthHour: birth.hour,
          birthMinute: birth.minute,
          gender: birth.gender === 'male' ? 'MALE' : 'FEMALE',
          timezone: birth.timezone ?? 'Asia/Seoul',
          latitude: birth.latitude ?? 37.5665,
          longitude: birth.longitude ?? 126.978,
        });

        const analysis = saju.analyzeSaju(birthInput);
        return this.extractSajuSummary(analysis);
      } catch {
        // Fall through to placeholder
      }
    }

    return this.placeholderSajuSummary();
  }

  private extractSajuSummary(analysis: any): SajuSummary {
    const pillars = analysis.pillars ?? analysis.coreResult?.pillars;
    const makePillar = (p: any): PillarSummary => ({
      stem: {
        code: p?.cheongan ?? '',
        hangul: p?.cheongan ?? '',
        hanja: '',
      },
      branch: {
        code: p?.jiji ?? '',
        hangul: p?.jiji ?? '',
        hanja: '',
      },
    });

    const yongshinResult = analysis.yongshinResult;
    const strengthResult = analysis.strengthResult;
    const gyeokgukResult = analysis.gyeokgukResult;

    const ohaengDist: Record<string, number> = {};
    if (analysis.ohaengDistribution) {
      if (analysis.ohaengDistribution instanceof Map) {
        for (const [k, v] of analysis.ohaengDistribution) {
          ohaengDist[String(k)] = Number(v);
        }
      } else {
        Object.assign(ohaengDist, analysis.ohaengDistribution);
      }
    }

    const dayMasterStem = pillars?.day?.cheongan ?? '';

    return {
      pillars: {
        year: makePillar(pillars?.year),
        month: makePillar(pillars?.month),
        day: makePillar(pillars?.day),
        hour: makePillar(pillars?.hour),
      },
      dayMaster: {
        stem: dayMasterStem,
        element: '',
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
        confidence: yongshinResult?.finalConfidence ?? 0,
        reasoning: yongshinResult?.recommendations?.[0]?.reasoning ?? '',
      },
      gyeokguk: {
        type: gyeokgukResult?.type ?? '',
        category: gyeokgukResult?.category ?? '',
        confidence: gyeokgukResult?.confidence ?? 0,
      },
      ohaengDistribution: ohaengDist,
    };
  }

  private placeholderSajuSummary(): SajuSummary {
    const emptyPillar: PillarSummary = {
      stem: { code: '', hangul: '', hanja: '' },
      branch: { code: '', hangul: '', hanja: '' },
    };
    return {
      pillars: {
        year: emptyPillar,
        month: emptyPillar,
        day: emptyPillar,
        hour: emptyPillar,
      },
      dayMaster: { stem: '', element: '', polarity: '' },
      strength: { level: '', isStrong: false, score: 0 },
      yongshin: { element: 'WOOD', heeshin: null, confidence: 0, reasoning: '' },
      gyeokguk: { type: '', category: '', confidence: 0 },
      ohaengDistribution: {},
    };
  }

  private async generateCandidates(
    request: SeedRequest,
    sajuSummary: SajuSummary,
  ): Promise<NameCharInput[][]> {
    const yongshinElement = this.ohaengToElementName(sajuSummary.yongshin.element);
    const targetLength = request.givenNameLength ?? 2;
    const candidates: NameCharInput[][] = [];

    // Find hanja characters that match the yongshin element
    const matchingEntries = await this.hanjaRepo.findByResourceElement(yongshinElement);

    // Generate simple combinations (to be refined)
    const limit = Math.min(matchingEntries.length, 50);
    for (let i = 0; i < limit && candidates.length < 100; i++) {
      if (targetLength === 1) {
        candidates.push([{
          hangul: matchingEntries[i].hangul,
          hanja: matchingEntries[i].hanja,
        }]);
      } else {
        for (let j = 0; j < limit && candidates.length < 100; j++) {
          if (i === j) continue;
          candidates.push([
            { hangul: matchingEntries[i].hangul, hanja: matchingEntries[i].hanja },
            { hangul: matchingEntries[j].hangul, hanja: matchingEntries[j].hanja },
          ]);
        }
      }
    }

    return candidates;
  }

  private async scoreCandidate(
    surname: NameCharInput[],
    givenName: NameCharInput[],
    sajuSummary: SajuSummary,
    weights: Required<ScoreWeights>,
  ): Promise<SeedCandidate> {
    // Resolve surname entries from DB
    const surnameEntries = await this.resolveEntries(surname);
    const givenNameEntries = await this.resolveEntries(givenName);

    // Run calculators
    const hangulCalc = new HangulCalculator(surnameEntries, givenNameEntries);
    const hanjaCalc = new HanjaCalculator(surnameEntries, givenNameEntries);
    const fourFrameCalc = new FourFrameCalculator(surnameEntries, givenNameEntries);

    hangulCalc.calculate();
    hanjaCalc.calculate();
    fourFrameCalc.calculate();
    await fourFrameCalc.loadAllLuckLevels(this.fourFrameRepo);

    // Saju calculator
    const yongshinElement = Element.get(this.ohaengToElementName(sajuSummary.yongshin.element));
    const heeshinElement = sajuSummary.yongshin.heeshin
      ? Element.get(this.ohaengToElementName(sajuSummary.yongshin.heeshin))
      : null;

    const allEnergies: Energy[] = [];
    for (const block of hangulCalc.getNameBlocks()) {
      if (block.energy) allEnergies.push(block.energy);
    }

    const sajuCalc = new SajuCalculator(yongshinElement, heeshinElement, allEnergies);
    sajuCalc.calculate();

    // Weighted average
    const hangulScore = hangulCalc.getScore();
    const hanjaScore = hanjaCalc.getScore();
    const fourFrameScore = fourFrameCalc.getScore();
    const sajuScore = sajuCalc.getScore();

    const totalWeight = weights.hangul + weights.hanja + weights.fourFrame + weights.saju;
    const totalScore = totalWeight > 0
      ? (hangulScore * weights.hangul + hanjaScore * weights.hanja +
         fourFrameScore * weights.fourFrame + sajuScore * weights.saju) / totalWeight
      : 0;

    const surnameDetails = this.toCharDetails(surnameEntries);
    const givenNameDetails = this.toCharDetails(givenNameEntries);

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
        saju: sajuCalc.getAnalysis().data,
      },
      interpretation: this.buildInterpretation(totalScore),
      rank: 0, // set by caller after sorting
    };
  }

  private async resolveEntries(chars: NameCharInput[]): Promise<HanjaEntry[]> {
    const entries: HanjaEntry[] = [];
    for (const char of chars) {
      if (char.hanja) {
        const entry = await this.hanjaRepo.findByHanja(char.hanja);
        if (entry) {
          entries.push(entry);
          continue;
        }
      }
      // Fallback: find by hangul, pick the first
      const byHangul = await this.hanjaRepo.findByHangul(char.hangul);
      if (byHangul.length > 0) {
        entries.push(byHangul[0]);
      } else {
        entries.push(this.makeFallbackEntry(char.hangul));
      }
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
      id: 0,
      hangul,
      hanja: hangul,
      onset: CHOSEONG[onset] ?? 'ㅇ',
      nucleus: JUNGSEONG[nucleus] ?? 'ㅏ',
      strokes: 1,
      stroke_element: 'Wood',
      resource_element: 'Earth',
      meaning: '',
      radical: '',
      is_surname: false,
    };
  }

  private toCharDetails(entries: HanjaEntry[]): CharDetail[] {
    return entries.map(e => ({
      hangul: e.hangul,
      hanja: e.hanja,
      meaning: e.meaning,
      strokes: e.strokes,
      element: e.resource_element,
      polarity: Polarity.get(e.strokes).english,
    }));
  }

  private ohaengToElementName(ohaeng: string): string {
    const map: Record<string, string> = {
      'WOOD': 'Wood', 'FIRE': 'Fire', 'EARTH': 'Earth',
      'METAL': 'Metal', 'WATER': 'Water',
      'Wood': 'Wood', 'Fire': 'Fire', 'Earth': 'Earth',
      'Metal': 'Metal', 'Water': 'Water',
    };
    return map[ohaeng] ?? 'Earth';
  }

  private buildInterpretation(totalScore: number): string {
    if (totalScore >= 90) return '매우 우수한 이름입니다. 음양오행의 조화가 뛰어납니다.';
    if (totalScore >= 75) return '좋은 이름입니다. 전반적인 에너지 균형이 양호합니다.';
    if (totalScore >= 60) return '보통 수준의 이름입니다. 일부 개선 여지가 있습니다.';
    if (totalScore >= 40) return '다소 아쉬운 이름입니다. 음양오행 조화를 점검해 보세요.';
    return '개선이 필요한 이름입니다. 다른 조합을 고려해 보세요.';
  }

  close(): void {
    this.hanjaRepo.close();
    this.fourFrameRepo.close();
    this.nameStatRepo.close();
  }
}
