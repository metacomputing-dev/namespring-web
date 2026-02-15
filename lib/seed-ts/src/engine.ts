import { HanjaRepository, type HanjaEntry } from './database/hanja-repository.js';
import { FourframeRepository } from './database/fourframe-repository.js';
import { NameStatRepository } from './database/name-stat-repository.js';
import { Polarity } from './model/polarity.js';
import { HangulCalculator } from './calculator/hangul.js';
import { HanjaCalculator } from './calculator/hanja.js';
import { FrameCalculator } from './calculator/frame.js';
import { SajuCalculator } from './calculator/saju.js';
import { evaluateName } from './calculator/root.js';
import type { EvaluationResult, EvalContext } from './calculator/base.js';
import type { SajuOutputSummary } from './calculator/saju-scorer.js';
import type { ElementKey } from './calculator/element-cycle.js';
import { elementFromSajuCode, emptyDistribution } from './calculator/element-cycle.js';
import { FourFrameOptimizer } from './calculator/search.js';
import type {
  SeedRequest, SeedResponse, SeedCandidate, SajuSummary, PillarSummary,
  BirthInfo, NameCharInput, CharDetail,
} from './types.js';

// ── saju-ts optional integration ──
type SajuModule = { analyzeSaju: (input: any, config?: any) => any; createBirthInput: (params: any) => any };
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
const MAX_CANDIDATES = 500;
const FRAME_LABELS: Record<string, string> = {
  SAGYEOK_SURI: '사격수리(81수리)', SAJU_JAWON_BALANCE: '사주 자원 균형',
  HOEKSU_EUMYANG: '획수 음양', BALEUM_OHAENG: '발음 오행',
  BALEUM_EUMYANG: '발음 음양', SAGYEOK_OHAENG: '사격 오행',
};
const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'] as const;
const JUNGSEONG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'] as const;
const OHAENG_CODES = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'] as const;
const EMPTY_PILLAR: PillarSummary = { stem: { code: '', hangul: '', hanja: '' }, branch: { code: '', hangul: '', hanja: '' } };

// ══════════════════════════════════════════════════════════════
// SeedEngine
// ══════════════════════════════════════════════════════════════

export class SeedEngine {
  private hanjaRepo = new HanjaRepository();
  private fourFrameRepo = new FourframeRepository();
  private nameStatRepo = new NameStatRepository();
  private initialized = false;
  private luckyMap = new Map<number, string>();
  private validFourFrameNumbers = new Set<number>();
  private optimizer: FourFrameOptimizer | null = null;

  async init(): Promise<void> {
    if (this.initialized) return;
    await Promise.all([this.hanjaRepo.init(), this.fourFrameRepo.init(), this.nameStatRepo.init()]);
    for (const entry of await this.fourFrameRepo.findAll(81)) {
      this.luckyMap.set(entry.number, entry.lucky_level ?? '');
      const lv = entry.lucky_level ?? '';
      if (lv.includes('최상') || lv.includes('상') || lv.includes('양'))
        this.validFourFrameNumbers.add(entry.number);
    }
    this.optimizer = new FourFrameOptimizer(this.validFourFrameNumbers);
    this.initialized = true;
  }

  // ── Main API ──

  async analyze(request: SeedRequest): Promise<SeedResponse> {
    await this.init();
    const mode = this.resolveMode(request);
    const sajuSummary = await this.analyzeSaju(request.birth);
    const sajuDist = this.buildSajuDistribution(sajuSummary);
    const sajuOutput = this.buildSajuOutput(sajuSummary);

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
    for (const gn of inputs) scored.push(await this.scoreCandidate(request.surname, gn, sajuDist, sajuOutput));
    scored.sort((a, b) => b.scores.total - a.scores.total);

    const offset = request.options?.offset ?? 0;
    const limit = request.options?.limit ?? 20;
    return {
      request, mode, saju: sajuSummary,
      candidates: scored.slice(offset, offset + limit).map((c, i) => ({ ...c, rank: offset + i + 1 })),
      totalCount: scored.length,
      meta: { version: '2.0.0', timestamp: new Date().toISOString() },
    };
  }

  private resolveMode(req: SeedRequest): 'evaluate' | 'recommend' | 'all' {
    if (req.mode && req.mode !== 'auto') return req.mode;
    return req.givenName?.length && req.givenName.every(c => c.hanja) ? 'evaluate' : 'recommend';
  }

  // ── Saju Analysis ──

  private async analyzeSaju(birth: BirthInfo): Promise<SajuSummary> {
    const saju = await loadSajuModule();
    if (saju) {
      try {
        const bi = saju.createBirthInput({
          birthYear: birth.year, birthMonth: birth.month, birthDay: birth.day,
          birthHour: birth.hour, birthMinute: birth.minute,
          gender: birth.gender === 'male' ? 'MALE' : 'FEMALE',
          timezone: birth.timezone ?? 'Asia/Seoul',
          latitude: birth.latitude ?? 37.5665, longitude: birth.longitude ?? 126.978,
        });
        return this.extractSajuSummary(saju.analyzeSaju(bi));
      } catch { /* fall through */ }
    }
    return {
      pillars: { year: EMPTY_PILLAR, month: EMPTY_PILLAR, day: EMPTY_PILLAR, hour: EMPTY_PILLAR },
      dayMaster: { stem: '', element: '', polarity: '' },
      strength: { level: '', isStrong: false, score: 0 },
      yongshin: { element: 'WOOD', heeshin: null, gishin: null, gushin: null, confidence: 0, reasoning: '' },
      gyeokguk: { type: '', category: '', confidence: 0 },
      ohaengDistribution: {}, deficientElements: [], excessiveElements: [],
    };
  }

  private extractSajuSummary(a: any): SajuSummary {
    const pil = a.pillars ?? a.coreResult?.pillars;
    const mp = (p: any): PillarSummary => ({
      stem: { code: p?.cheongan ?? '', hangul: p?.cheongan ?? '', hanja: '' },
      branch: { code: p?.jiji ?? '', hangul: p?.jiji ?? '', hanja: '' },
    });
    const od: Record<string, number> = {};
    if (a.ohaengDistribution) {
      if (a.ohaengDistribution instanceof Map) {
        for (const [k, v] of a.ohaengDistribution) od[String(k)] = Number(v);
      } else Object.assign(od, a.ohaengDistribution);
    }
    const total = Object.values(od).reduce((s, v) => s + v, 0);
    const avg = total / 5;
    const deficient: string[] = [], excessive: string[] = [];
    if (total > 0) for (const k of OHAENG_CODES) {
      const c = od[k] ?? 0;
      if (c === 0 || c <= avg * 0.4) deficient.push(k);
      else if (c >= avg * 2.0) excessive.push(k);
    }
    const sr = a.strengthResult, yr = a.yongshinResult, gr = a.gyeokgukResult;
    return {
      pillars: { year: mp(pil?.year), month: mp(pil?.month), day: mp(pil?.day), hour: mp(pil?.hour) },
      dayMaster: { stem: pil?.day?.cheongan ?? '', element: sr?.dayMasterElement ?? '', polarity: '' },
      strength: { level: sr?.level ?? '', isStrong: sr?.isStrong ?? false, score: sr?.score?.totalSupport ?? 0 },
      yongshin: {
        element: yr?.finalYongshin ?? '', heeshin: yr?.finalHeesin ?? null,
        gishin: yr?.gisin ?? null, gushin: yr?.gusin ?? null,
        confidence: yr?.finalConfidence ?? 0, reasoning: yr?.recommendations?.[0]?.reasoning ?? '',
      },
      gyeokguk: { type: gr?.type ?? '', category: gr?.category ?? '', confidence: gr?.confidence ?? 0 },
      ohaengDistribution: od, deficientElements: deficient, excessiveElements: excessive,
    };
  }

  // ── Build evaluator inputs ──

  private buildSajuDistribution(s: SajuSummary): Record<ElementKey, number> {
    const dist = emptyDistribution();
    for (const [code, count] of Object.entries(s.ohaengDistribution)) {
      const key = elementFromSajuCode(code);
      if (key) dist[key] += count;
    }
    return dist;
  }

  private buildSajuOutput(s: SajuSummary): SajuOutputSummary | null {
    if (!s.dayMaster.element && !s.yongshin.element) return null;
    const dmKey = elementFromSajuCode(s.dayMaster.element);
    const y = s.yongshin;
    return {
      dayMaster: dmKey ? { element: dmKey } : undefined,
      strength: { isStrong: s.strength.isStrong, totalSupport: s.strength.score, totalOppose: 0 },
      yongshin: {
        finalYongshin: y.element, finalHeesin: y.heeshin, gisin: y.gishin, gusin: y.gushin,
        finalConfidence: y.confidence,
        recommendations: y.reasoning
          ? [{ type: 'EOKBU', primaryElement: y.element, secondaryElement: y.heeshin, confidence: y.confidence, reasoning: y.reasoning }]
          : [],
      },
      tenGod: undefined,
    };
  }

  // ── Score a single candidate ──

  private async scoreCandidate(
    surname: NameCharInput[], givenName: NameCharInput[],
    sajuDist: Record<ElementKey, number>, sajuOutput: SajuOutputSummary | null,
  ): Promise<SeedCandidate> {
    const se = await this.resolveEntries(surname);
    const ge = await this.resolveEntries(givenName);

    // Create calculators ONCE -- they serve as both DAG nodes AND analysis providers
    const hangul = new HangulCalculator(se, ge);
    const hanja = new HanjaCalculator(se, ge);
    const frame = new FrameCalculator(se, ge);
    const saju = new SajuCalculator(se, ge);

    const ctx: EvalContext = {
      surnameLength: se.length, givenLength: ge.length,
      luckyMap: this.luckyMap, sajuDistribution: sajuDist,
      sajuOutput, insights: {},
    };

    const ev = evaluateName([hangul, hanja, frame, saju], ctx);
    const cm = ev.categoryMap;

    // Get analysis from the SAME calculator instances (no duplication)
    const all = [...se, ...ge];
    const r = (v: number) => Math.round(v * 10) / 10;

    return {
      name: {
        surname: se.map(toCharDetail), givenName: ge.map(toCharDetail),
        fullHangul: all.map(e => e.hangul).join(''), fullHanja: all.map(e => e.hanja).join(''),
      },
      scores: {
        total: r(ev.score),
        hangul: r(((cm.BALEUM_OHAENG?.score ?? 0) + (cm.BALEUM_EUMYANG?.score ?? 0)) / 2),
        hanja: r(((cm.HOEKSU_EUMYANG?.score ?? 0) + (cm.SAGYEOK_OHAENG?.score ?? 0)) / 2),
        fourFrame: r(cm.SAGYEOK_SURI?.score ?? 0),
        saju: r(cm.SAJU_JAWON_BALANCE?.score ?? 0),
      },
      analysis: {
        hangul: hangul.getAnalysis().data,
        hanja: hanja.getAnalysis().data,
        fourFrame: frame.getAnalysis().data,
        saju: saju.getAnalysis().data,
      },
      interpretation: buildInterpretation(ev), rank: 0,
    };
  }

  // ── Name Generation (recommend/all mode) ──

  private async generateCandidates(req: SeedRequest, saju: SajuSummary): Promise<NameCharInput[][]> {
    const se = await this.resolveEntries(req.surname);
    const nameLen = req.givenNameLength ?? 2;
    const validKeys = this.optimizer!.getValidCombinations(se.map(e => e.strokes), nameLen);
    const targets = collectElements(saju.yongshin.element, saju.yongshin.heeshin, saju.deficientElements);
    const avoids = collectElements(saju.yongshin.gishin, saju.yongshin.gushin, saju.excessiveElements);
    if (targets.size === 0) targets.add('Wood');

    // Collect stroke counts needed, then bulk-load hanja
    const needed = new Set<number>();
    for (const key of validKeys) for (const s of key.split(',')) needed.add(Number(s));
    const allHanja = await this.hanjaRepo.findByStrokeRange(Math.min(...needed), Math.max(...needed));

    // Index by strokes: preferred (target elements) then acceptable
    const pref = new Map<number, HanjaEntry[]>(), acc = new Map<number, HanjaEntry[]>();
    for (const e of allHanja) {
      if (e.is_surname || !needed.has(e.strokes) || avoids.has(e.resource_element)) continue;
      const bucket = targets.has(e.resource_element) ? pref : acc;
      (bucket.get(e.strokes) ?? (bucket.set(e.strokes, []), bucket.get(e.strokes)!)).push(e);
    }
    const chars = (s: number) => [...(pref.get(s) ?? []), ...(acc.get(s) ?? [])];

    const out: NameCharInput[][] = [];
    for (const sk of validKeys) {
      if (out.length >= MAX_CANDIDATES) break;
      const sc = sk.split(',').map(Number);
      if (nameLen === 1) {
        for (const c of chars(sc[0]).slice(0, 8)) {
          out.push([{ hangul: c.hangul, hanja: c.hanja }]);
          if (out.length >= MAX_CANDIDATES) break;
        }
      } else {
        const c1 = chars(sc[0]).slice(0, 6), c2 = chars(sc[1]).slice(0, 6);
        for (const a of c1) {
          for (const b of c2) {
            if (a.hanja === b.hanja) continue;
            out.push([{ hangul: a.hangul, hanja: a.hanja }, { hangul: b.hangul, hanja: b.hanja }]);
            if (out.length >= MAX_CANDIDATES) break;
          }
          if (out.length >= MAX_CANDIDATES) break;
        }
      }
    }
    return out;
  }

  // ── Entry resolution ──

  private async resolveEntries(chars: NameCharInput[]): Promise<HanjaEntry[]> {
    return Promise.all(chars.map(async (c) => {
      if (c.hanja) { const e = await this.hanjaRepo.findByHanja(c.hanja); if (e) return e; }
      const bh = await this.hanjaRepo.findByHangul(c.hangul);
      return bh[0] ?? makeFallbackEntry(c.hangul);
    }));
  }

  close(): void {
    this.hanjaRepo.close();
    this.fourFrameRepo.close();
    this.nameStatRepo.close();
  }
}

// ── Pure helpers ──

function toCharDetail(e: HanjaEntry): CharDetail {
  return {
    hangul: e.hangul, hanja: e.hanja, meaning: e.meaning,
    strokes: e.strokes, element: e.resource_element, polarity: Polarity.get(e.strokes).english,
  };
}

function makeFallbackEntry(hangul: string): HanjaEntry {
  const code = hangul.charCodeAt(0) - 0xAC00;
  const ok = code >= 0 && code <= 11171;
  return {
    id: 0, hangul, hanja: hangul,
    onset: CHOSEONG[ok ? Math.floor(code / 588) : 0] ?? 'ㅇ',
    nucleus: JUNGSEONG[ok ? Math.floor((code % 588) / 28) : 0] ?? 'ㅏ',
    strokes: 1, stroke_element: 'Wood', resource_element: 'Earth',
    meaning: '', radical: '', is_surname: false,
  };
}

function collectElements(...sources: (string | null | undefined | string[])[]): Set<string> {
  const out = new Set<string>();
  for (const src of sources) {
    if (Array.isArray(src)) { for (const s of src) { const k = elementFromSajuCode(s); if (k) out.add(k); } }
    else if (src) { const k = elementFromSajuCode(src); if (k) out.add(k); }
  }
  return out;
}

function buildInterpretation(ev: EvaluationResult): string {
  const { score, isPassed, categories } = ev;
  const overall = isPassed
    ? (score >= 80 ? '종합적으로 매우 우수한 이름입니다.' : score >= 65 ? '종합적으로 좋은 이름입니다.' : '합격 기준을 충족하는 이름입니다.')
    : (score >= 55 ? '보통 수준의 이름입니다.' : '개선 여지가 있는 이름입니다.');
  const warns = categories
    .filter(c => c.frame !== 'SEONGMYEONGHAK' && !c.isPassed && c.score < 50)
    .map(c => `${FRAME_LABELS[c.frame] ?? c.frame} 부분을 점검해 보세요.`);
  return [overall, ...warns].join(' ');
}
