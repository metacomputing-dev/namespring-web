import { HanjaRepository, type HanjaEntry } from '../../name-ts/src/database/hanja-repository.js';
import { FourframeRepository } from '../../name-ts/src/database/fourframe-repository.js';
import { Polarity } from '../../name-ts/src/model/polarity.js';
import { HangulCalculator } from '../../name-ts/src/calculator/hangul.js';
import { HanjaCalculator } from '../../name-ts/src/calculator/hanja.js';
import { FrameCalculator } from '../../name-ts/src/calculator/frame.js';
import { type EvalContext } from '../../name-ts/src/calculator/evaluator.js';
import { type ElementKey } from '../../name-ts/src/calculator/scoring.js';
import { FourFrameOptimizer } from '../../name-ts/src/calculator/search.js';
import { makeFallbackEntry, buildInterpretation, parseJamoFilter, type JamoFilter } from '../../name-ts/src/utils/index.js';
import type { SajuOutputSummary } from './types.js';
import { SajuCalculator } from './saju-calculator.js';
import { springEvaluateName, SAJU_FRAME } from './spring-evaluator.js';
import { analyzeSaju, buildSajuContext, collectElements } from './saju-adapter.js';
import type {
  SpringRequest, SpringResponse, SpringCandidate, SajuSummary,
  NameCharInput, CharDetail,
} from './types.js';

const MAX_CANDIDATES = 500;

function toCharDetail(e: HanjaEntry): CharDetail {
  return {
    hangul: e.hangul, hanja: e.hanja, meaning: e.meaning,
    strokes: e.strokes, element: e.resource_element,
    polarity: Polarity.get(e.strokes).english
  };
}

export class SpringEngine {
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

  async analyze(request: SpringRequest): Promise<SpringResponse> {
    await this.init();
    const jamoFilters = request.givenName?.map(c => c.hanja ? null : parseJamoFilter(c.hangul));
    const isJamoInput = jamoFilters?.some(f => f !== null) ?? false;
    const mode = request.mode && request.mode !== 'auto' ? request.mode : (request.givenName?.length && request.givenName.every(c => c.hanja) ? 'evaluate' : 'recommend');
    const sajuSummary = await analyzeSaju(request.birth, request.options);
    const { dist, output } = buildSajuContext(sajuSummary);

    let inputs: NameCharInput[][];
    if (mode === 'evaluate' && request.givenName?.length && !isJamoInput) {
      inputs = [request.givenName];
    } else if (mode === 'recommend' || mode === 'all' || isJamoInput) {
      inputs = await this.generateCandidates(request, sajuSummary, isJamoInput ? jamoFilters! : undefined);
      if (request.givenName?.length && !isJamoInput) inputs.unshift(request.givenName);
    } else {
      inputs = request.givenName?.length ? [request.givenName] : [];
    }

    const scored: SpringCandidate[] = [];
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

  private async scoreCandidate(
    surname: NameCharInput[], givenName: NameCharInput[],
    sajuDist: Record<ElementKey, number>, sajuOutput: SajuOutputSummary | null
  ): Promise<SpringCandidate> {
    const se = await this.resolveEntries(surname);
    const ge = await this.resolveEntries(givenName);
    const hangul = new HangulCalculator(se, ge);
    const hanja = new HanjaCalculator(se, ge);
    const frame = new FrameCalculator(se, ge);
    const saju = new SajuCalculator(se, ge, sajuDist, sajuOutput);
    const ctx: EvalContext = {
      surnameLength: se.length, givenLength: ge.length,
      luckyMap: this.luckyMap, insights: {}
    };
    const ev = springEvaluateName([hangul, hanja, frame, saju], ctx);
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
        saju: r(cm[SAJU_FRAME]?.score ?? 0)
      },
      analysis: {
        hangul: hangul.getAnalysis().data, hanja: hanja.getAnalysis().data,
        fourFrame: frame.getAnalysis().data, saju: saju.getAnalysis().data
      },
      interpretation: buildInterpretation(ev), rank: 0
    };
  }

  private async generateCandidates(req: SpringRequest, saju: SajuSummary, jamoFilters?: (JamoFilter | null)[]): Promise<NameCharInput[][]> {
    const se = await this.resolveEntries(req.surname);
    const nameLen = req.givenNameLength ?? jamoFilters?.length ?? 2;
    const hasJamo = jamoFilters?.some(f => f !== null) ?? false;
    const targets = collectElements(saju.yongshin.element, saju.yongshin.heeshin, saju.deficientElements);
    const avoids = collectElements(saju.yongshin.gishin, saju.yongshin.gushin, saju.excessiveElements);
    if (targets.size === 0) targets.add('Wood');

    const inp = (c: HanjaEntry): NameCharInput => ({ hangul: c.hangul, hanja: c.hanja });

    const pools = await this.buildPositionPools(req, nameLen, jamoFilters, hasJamo, se, targets, avoids);

    const out: NameCharInput[][] = [];
    if (!hasJamo && nameLen <= 2) {
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
    req: SpringRequest, nameLen: number, jamoFilters: (JamoFilter | null)[] | undefined,
    hasJamo: boolean, se: HanjaEntry[], targets: Set<string>, avoids: Set<string>,
  ): Promise<Map<number, HanjaEntry[]>> {
    const pools = new Map<number, HanjaEntry[]>();

    if (!hasJamo && nameLen <= 2) {
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
      for (const [k, list] of pools) {
        pools.set(k, list.sort((a, b) => (targets.has(b.resource_element) ? 1 : 0) - (targets.has(a.resource_element) ? 1 : 0)));
      }
    } else {
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
