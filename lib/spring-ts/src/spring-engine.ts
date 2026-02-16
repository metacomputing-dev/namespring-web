// ---------------------------------------------------------------------------
// SpringEngine -- the main naming-recommendation engine.
//
// Public API:
//   init()              -- load database and precompute lucky number tables
//   getNamingReport()   -- pure name analysis (no saju)
//   getSajuReport()     -- saju analysis only
//   getSpringReport()   -- single integrated report (name + saju)
//   getNameCandidates() -- name recommendations with saju integration
//   getNameCandidateSummaries() -- lightweight recommendation list for UI
//   analyze()           -- legacy all-in-one entry point (backward compatible)
//   close()             -- release database resources
// ---------------------------------------------------------------------------

import { HanjaRepository, type HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import { FourframeRepository } from '../../seed-ts/src/database/fourframe-repository.js';
import { NameStatRepository, type NameStatEntry } from '../../seed-ts/src/database/name-stat-repository.js';
import { Polarity } from '../../seed-ts/src/model/polarity.js';
import { HangulCalculator } from './calculator/hangul-calculator.js';
import { HanjaCalculator } from './calculator/hanja-calculator.js';
import { FrameCalculator } from './calculator/frame-calculator.js';
import { evaluateName, type EvalContext, type EvaluationResult } from './core/evaluator.js';
import { type ElementKey, bucketFromFortune } from './core/scoring.js';
import { FourFrameOptimizer } from './calculator/search.js';
import { makeFallbackEntry, buildInterpretation, parseJamoFilter, type JamoFilter } from './core/name-utils.js';
import type { SajuOutputSummary } from './types.js';
import { SajuCalculator } from './saju-calculator.js';
import { springEvaluateName, SAJU_FRAME } from './spring-evaluator.js';
import { analyzeSaju, analyzeSajuSafe, buildSajuContext, collectElements } from './saju-adapter.js';
import type {
  SpringRequest, SpringResponse, SpringCandidate, SajuSummary,
  SajuReport, NamingReport, NamingReportFrame, SpringReport, SpringCandidateSummary,
  NameCharInput, CharDetail,
} from './types.js';
import engineConfig from '../config/engine.json';

// ---------------------------------------------------------------------------
// Config -- all tuneable numbers come from engine.json
// ---------------------------------------------------------------------------

const MAX_CANDIDATES            = engineConfig.maxCandidates;
const POOL_LIMIT_SINGLE_CHAR    = engineConfig.candidatePoolLimits.singleCharPerStroke;
const POOL_LIMIT_DOUBLE_CHAR    = engineConfig.candidatePoolLimits.doubleCharPerPosition;
const POOL_LIMIT_JAMO_FILTERED  = engineConfig.candidatePoolLimits.jamoFilteredPerPosition;
const STROKE_MIN                = engineConfig.strokeRange.min;
const STROKE_MAX                = engineConfig.strokeRange.max;
const DEFAULT_OFFSET            = engineConfig.pagination.defaultOffset;
const DEFAULT_LIMIT             = engineConfig.pagination.defaultLimit;
const FOURFRAME_LOAD_LIMIT      = engineConfig.fourframeLoadLimit;
const LUCKY_LEVEL_KEYWORDS      = engineConfig.luckyLevelKeywords;
const DEFAULT_TARGET_ELEMENT    = engineConfig.defaultTargetElement;
const ENGINE_VERSION            = engineConfig.version;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a HanjaEntry into the public CharDetail shape. */
function toCharDetail(entry: HanjaEntry): CharDetail {
  return {
    hangul:   entry.hangul,
    hanja:    entry.hanja,
    meaning:  entry.meaning,
    strokes:  entry.strokes,
    element:  entry.resource_element,
    polarity: Polarity.get(entry.strokes).english,
  };
}

/** Round a score to one decimal place. */
function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Convert a HanjaEntry into the minimal NameCharInput shape. */
function toNameCharInput(entry: HanjaEntry): NameCharInput {
  return { hangul: entry.hangul, hanja: entry.hanja };
}

// ---------------------------------------------------------------------------
// SpringEngine
// ---------------------------------------------------------------------------

export class SpringEngine {
  private hanjaRepo = new HanjaRepository();
  private fourFrameRepo = new FourframeRepository();
  private nameStatRepo = new NameStatRepository();
  private initialized = false;
  private luckyMap = new Map<number, string>();
  private validFourFrameNumbers = new Set<number>();
  private optimizer: FourFrameOptimizer | null = null;
  private readonly nameStatInfoCache = new Map<string, { exists: boolean; popularityRank: number | null }>();

  /** Expose the hanja repository so the UI can perform hanja lookups. */
  getHanjaRepository(): HanjaRepository { return this.hanjaRepo; }

  // -------------------------------------------------------------------------
  // init -- three-step bootstrap
  // -------------------------------------------------------------------------

  async init() {
    if (this.initialized) return;

    // Step 1: Open repositories in parallel
    await Promise.all([
      this.hanjaRepo.init(),
      this.fourFrameRepo.init(),
      this.nameStatRepo.init(),
    ]);

    // Step 2: Load four-frame fortune data and build the lucky-number set
    await this.buildLuckyNumberSet();

    // Step 3: Create the four-frame optimizer used for candidate generation
    this.optimizer = new FourFrameOptimizer(this.validFourFrameNumbers);

    this.initialized = true;
  }

  /** Scan all four-frame records and classify each by its lucky level. */
  private async buildLuckyNumberSet(): Promise<void> {
    const allRecords = await this.fourFrameRepo.findAll(FOURFRAME_LOAD_LIMIT);

    for (const record of allRecords) {
      const luckyLevel = record.lucky_level ?? '';
      this.luckyMap.set(record.number, luckyLevel);

      const isLucky = LUCKY_LEVEL_KEYWORDS.some(keyword => luckyLevel.includes(keyword));
      if (isLucky) {
        this.validFourFrameNumbers.add(record.number);
      }
    }
  }

  // -------------------------------------------------------------------------
  // getNamingReport -- pure name analysis (no saju)
  // -------------------------------------------------------------------------

  async getNamingReport(request: SpringRequest): Promise<NamingReport> {
    await this.init();

    const surnameEntries   = await this.resolveEntries(request.surname);
    const givenNameEntries = await this.resolveEntries(request.givenName!);

    const hangul = new HangulCalculator(surnameEntries, givenNameEntries);
    const hanja  = new HanjaCalculator(surnameEntries, givenNameEntries);
    const frame  = new FrameCalculator(surnameEntries, givenNameEntries);

    const evalCtx: EvalContext = {
      surnameLength: surnameEntries.length,
      givenLength:   givenNameEntries.length,
      luckyMap:      this.luckyMap,
      insights:      {},
    };

    const evalResult = evaluateName([hangul, hanja, frame], evalCtx);
    await frame.ensureEntriesLoaded();
    return this.buildNamingReport(surnameEntries, givenNameEntries, evalResult, hangul, hanja, frame);
  }

  // -------------------------------------------------------------------------
  // getSajuReport -- saju analysis only
  // -------------------------------------------------------------------------

  async getSajuReport(request: SpringRequest): Promise<SajuReport> {
    const { summary, sajuEnabled } = await analyzeSajuSafe(request.birth, request.options);
    return { ...summary, sajuEnabled };
  }

  // -------------------------------------------------------------------------
  // getSpringReport -- single integrated report for one explicit given name
  // -------------------------------------------------------------------------

  async getSpringReport(
    request: SpringRequest,
    sajuReportOverride?: SajuReport,
  ): Promise<SpringReport> {
    await this.init();

    if (!request.givenName?.length) {
      throw new Error('getSpringReport requires givenName input.');
    }

    const sajuReport = sajuReportOverride ?? await this.getSajuReport(request);
    const { dist: sajuDistribution, output: sajuOutput } = buildSajuContext(sajuReport);
    const nameStatInfo = await this.getNameStatInfo(request.givenName);

    const surnameEntries   = await this.resolveEntries(request.surname);
    const givenNameEntries = await this.resolveEntries(request.givenName);

    const hangul = new HangulCalculator(surnameEntries, givenNameEntries);
    const hanja  = new HanjaCalculator(surnameEntries, givenNameEntries);
    const frame  = new FrameCalculator(surnameEntries, givenNameEntries);
    const saju   = new SajuCalculator(surnameEntries, givenNameEntries, sajuDistribution, sajuOutput);

    const combinedCtx: EvalContext = {
      surnameLength: surnameEntries.length,
      givenLength:   givenNameEntries.length,
      luckyMap:      this.luckyMap,
      insights:      {},
    };
    const combined = springEvaluateName([hangul, hanja, frame, saju], combinedCtx);

    const nameOnlyCtx: EvalContext = {
      surnameLength: surnameEntries.length,
      givenLength:   givenNameEntries.length,
      luckyMap:      this.luckyMap,
      insights:      {},
    };
    const nameOnly = evaluateName([hangul, hanja, frame], nameOnlyCtx);
    await frame.ensureEntriesLoaded();

    return {
      finalScore: roundScore(combined.score),
      popularityRank: nameStatInfo.popularityRank,
      namingReport: this.buildNamingReport(surnameEntries, givenNameEntries, nameOnly, hangul, hanja, frame),
      sajuReport,
      sajuCompatibility: saju.getAnalysis().data,
      combinedDistribution: saju.getCombinedDistribution(),
      rank: 0,
    };
  }

  // -------------------------------------------------------------------------
  // getNameCandidates -- name recommendations with saju integration
  // -------------------------------------------------------------------------

  async getNameCandidates(request: SpringRequest): Promise<SpringReport[]> {
    await this.init();

    // 1. Saju analysis
    const sajuReport = await this.getSajuReport(request);
    const sajuSummary: SajuSummary = sajuReport;

    // 2. Determine mode and collect name inputs
    const jamoFilters = request.givenName?.map(
      char => char.hanja ? null : parseJamoFilter(char.hangul),
    );
    const hasJamoInput = jamoFilters?.some(filter => filter !== null) ?? false;
    const mode = this.resolveMode(request, hasJamoInput);

    const nameInputs = await this.collectNameInputs(
      request, mode, hasJamoInput, jamoFilters, sajuSummary,
    );

    // 3. Score each candidate
    const results: SpringReport[] = [];

    for (const givenNameInput of nameInputs) {
      const nameStatInfo = await this.getNameStatInfo(givenNameInput);
      if (!nameStatInfo.exists) continue;
      results.push(await this.getSpringReport(
        { ...request, givenName: givenNameInput, mode: 'evaluate' },
        sajuReport,
      ));
    }

    // Sort and assign ranks
    results.sort((a, b) => b.finalScore - a.finalScore);
    results.forEach((r, i) => { r.rank = i + 1; });
    return results;
  }

  // -------------------------------------------------------------------------
  // getNameCandidateSummaries -- lightweight candidates for list rendering
  // -------------------------------------------------------------------------

  async getNameCandidateSummaries(request: SpringRequest): Promise<SpringCandidateSummary[]> {
    await this.init();

    const sajuReport = await this.getSajuReport(request);
    const sajuSummary: SajuSummary = sajuReport;
    const { dist: sajuDistribution, output: sajuOutput } = buildSajuContext(sajuSummary);

    const jamoFilters = request.givenName?.map(
      char => char.hanja ? null : parseJamoFilter(char.hangul),
    );
    const hasJamoInput = jamoFilters?.some(filter => filter !== null) ?? false;
    const mode = this.resolveMode(request, hasJamoInput);

    const nameInputs = await this.collectNameInputs(
      request, mode, hasJamoInput, jamoFilters, sajuSummary,
    );

    const surnameEntries = await this.resolveEntries(request.surname);
    const results: SpringCandidateSummary[] = [];

    for (const givenNameInput of nameInputs) {
      const nameStatInfo = await this.getNameStatInfo(givenNameInput);
      if (!nameStatInfo.exists) continue;
      const givenNameEntries = await this.resolveEntries(givenNameInput);

      const hangul = new HangulCalculator(surnameEntries, givenNameEntries);
      const hanja  = new HanjaCalculator(surnameEntries, givenNameEntries);
      const frame  = new FrameCalculator(surnameEntries, givenNameEntries);
      const saju   = new SajuCalculator(surnameEntries, givenNameEntries, sajuDistribution, sajuOutput);

      const combinedCtx: EvalContext = {
        surnameLength: surnameEntries.length,
        givenLength:   givenNameEntries.length,
        luckyMap:      this.luckyMap,
        insights:      {},
      };
      const combined = springEvaluateName([hangul, hanja, frame, saju], combinedCtx);

      const allEntries = [...surnameEntries, ...givenNameEntries];
      results.push({
        finalScore: roundScore(combined.score),
        fullHangul: allEntries.map(entry => entry.hangul).join(''),
        fullHanja: allEntries.map(entry => entry.hanja).join(''),
        givenHangul: givenNameEntries.map(entry => entry.hangul).join(''),
        givenName: givenNameEntries.map(toNameCharInput),
        popularityRank: nameStatInfo.popularityRank,
        rank: 0,
      });
    }

    results.sort((a, b) => b.finalScore - a.finalScore);
    results.forEach((result, index) => { result.rank = index + 1; });
    return results;
  }

  // -------------------------------------------------------------------------
  // buildNamingReport -- assemble a NamingReport from calculator results
  // -------------------------------------------------------------------------

  private buildNamingReport(
    surnameEntries: HanjaEntry[],
    givenNameEntries: HanjaEntry[],
    evalResult: EvaluationResult,
    hangul: HangulCalculator,
    hanja: HanjaCalculator,
    frame: FrameCalculator,
  ): NamingReport {
    const categoryMap = evalResult.categoryMap;
    const frames = frame.frames;

    const allEntries  = [...surnameEntries, ...givenNameEntries];
    const fullHangul  = allEntries.map(e => e.hangul).join('');
    const fullHanja   = allEntries.map(e => e.hanja).join('');

    const hangulScore = roundScore(
      ((categoryMap.HANGUL_ELEMENT?.score ?? 0) + (categoryMap.HANGUL_POLARITY?.score ?? 0)) / 2,
    );
    const hanjaScore = roundScore(
      ((categoryMap.STROKE_POLARITY?.score ?? 0) + (categoryMap.FOURFRAME_ELEMENT?.score ?? 0)) / 2,
    );
    const fourFrameScore = roundScore(categoryMap.FOURFRAME_LUCK?.score ?? 0);

    const enrichedFrames: NamingReportFrame[] = frames.map(f => ({
      type: f.type,
      strokeSum: f.strokeSum,
      element: f.energy?.element.english ?? '',
      polarity: f.energy?.polarity.english ?? '',
      luckyLevel: bucketFromFortune(this.luckyMap.get(f.strokeSum) ?? ''),
      meaning: f.entry ?? null,
    }));

    const frameAnalysis = frame.getAnalysis();
    const luckScore = roundScore(categoryMap.FOURFRAME_LUCK?.score ?? 0);

    return {
      name: {
        surname:    surnameEntries.map(toCharDetail),
        givenName:  givenNameEntries.map(toCharDetail),
        fullHangul,
        fullHanja,
      },
      totalScore: roundScore(evalResult.score),
      scores: {
        hangul: hangulScore,
        hanja: hanjaScore,
        fourFrame: fourFrameScore,
      },
      analysis: {
        hangul: hangul.getAnalysis().data,
        hanja: hanja.getAnalysis().data,
        fourFrame: {
          frames: enrichedFrames,
          elementScore: frameAnalysis.data.elementScore,
          luckScore,
        },
      },
      interpretation: buildInterpretation(evalResult),
    };
  }

  // -------------------------------------------------------------------------
  // analyze -- the main public entry point (backward compatible)
  // -------------------------------------------------------------------------

  async analyze(request: SpringRequest): Promise<SpringResponse> {
    await this.init();

    // 1. Determine the operating mode
    const jamoFilters = request.givenName?.map(
      char => char.hanja ? null : parseJamoFilter(char.hangul),
    );
    const hasJamoInput = jamoFilters?.some(filter => filter !== null) ?? false;
    const mode = this.resolveMode(request, hasJamoInput);

    // 2. Run saju (four-pillar destiny) analysis on the birth data
    const sajuSummary = await analyzeSaju(request.birth, request.options);
    const { dist: sajuDistribution, output: sajuOutput } = buildSajuContext(sajuSummary);

    // 3. Build the list of name inputs to score
    const nameInputs = await this.collectNameInputs(
      request, mode, hasJamoInput, jamoFilters, sajuSummary,
    );

    // 4. Score every candidate and rank by total score (descending)
    const scoredCandidates = await this.scoreAllCandidates(
      request.surname, nameInputs, sajuDistribution, sajuOutput,
    );

    // 5. Paginate and return
    return this.buildResponse(request, mode, sajuSummary, scoredCandidates);
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- resolve which mode to use
  // -------------------------------------------------------------------------

  private resolveMode(
    request: SpringRequest,
    hasJamoInput: boolean,
  ): 'evaluate' | 'recommend' | 'all' {
    if (request.mode && request.mode !== 'auto') return request.mode;

    // Auto-detect: if every given-name character has an explicit hanja,
    // the user wants an evaluation; otherwise, generate recommendations.
    const allHaveHanja = request.givenName?.length
      && request.givenName.every(char => char.hanja);

    return allHaveHanja && !hasJamoInput ? 'evaluate' : 'recommend';
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- gather name inputs depending on mode
  // -------------------------------------------------------------------------

  private async collectNameInputs(
    request: SpringRequest,
    mode: 'evaluate' | 'recommend' | 'all',
    hasJamoInput: boolean,
    jamoFilters: (JamoFilter | null)[] | undefined,
    sajuSummary: SajuSummary,
  ): Promise<NameCharInput[][]> {
    const hasExplicitGivenName = request.givenName?.length && !hasJamoInput;

    // Evaluate mode with a fully specified name -- just score it directly
    if (mode === 'evaluate' && hasExplicitGivenName) {
      return [request.givenName!];
    }

    // Recommend or all mode -- generate candidates
    if (mode === 'recommend' || mode === 'all' || hasJamoInput) {
      const candidates = await this.generateCandidates(
        request,
        sajuSummary,
        hasJamoInput ? jamoFilters! : undefined,
      );

      // If the user also supplied an explicit name, prepend it
      if (hasExplicitGivenName) {
        candidates.unshift(request.givenName!);
      }

      return this.filterCandidatesByNameStat(candidates);
    }

    // Fallback: just the explicit name, or nothing
    return request.givenName?.length ? [request.givenName] : [];
  }

  private givenNameHangulKey(givenName: NameCharInput[]): string {
    return givenName.map((char) => String(char?.hangul ?? '')).join('').trim();
  }

  private latestPopularityRankFromEntry(entry: NameStatEntry): number | null {
    const source = entry?.yearly_rank || {};
    const totalBucket = source?.['전체'];

    if (totalBucket && typeof totalBucket === 'object' && !Array.isArray(totalBucket)) {
      const sorted = Object.entries(totalBucket)
        .map(([year, rank]) => ({ year: Number(year), rank: Number(rank) }))
        .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.rank))
        .sort((a, b) => a.year - b.year);
      const latestFromTotal = sorted.length ? sorted[sorted.length - 1].rank : null;
      return Number.isFinite(Number(latestFromTotal)) && Number(latestFromTotal) > 0
        ? Number(latestFromTotal)
        : null;
    }

    const valuesByYear = new Map<number, number[]>();
    for (const [bucketKey, bucket] of Object.entries(source)) {
      const flatYear = Number(bucketKey);
      const flatValue = Number(bucket);
      if (Number.isFinite(flatYear) && Number.isFinite(flatValue)) {
        const list = valuesByYear.get(flatYear) || [];
        list.push(flatValue);
        valuesByYear.set(flatYear, list);
        continue;
      }

      if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) continue;
      for (const [year, value] of Object.entries(bucket)) {
        const y = Number(year);
        const v = Number(value);
        if (!Number.isFinite(y) || !Number.isFinite(v)) continue;
        const list = valuesByYear.get(y) || [];
        list.push(v);
        valuesByYear.set(y, list);
      }
    }

    if (!valuesByYear.size) return null;
    const latestYear = Math.max(...valuesByYear.keys());
    const values = valuesByYear.get(latestYear) || [];
    if (!values.length) return null;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Number.isFinite(avg) && avg > 0 ? avg : null;
  }

  private async getNameStatInfo(givenName: NameCharInput[]): Promise<{ exists: boolean; popularityRank: number | null }> {
    const key = this.givenNameHangulKey(givenName);
    if (!key) return { exists: false, popularityRank: null };

    const cached = this.nameStatInfoCache.get(key);
    if (cached) return cached;

    try {
      const found = await this.nameStatRepo.findByName(key);
      const info = {
        exists: Boolean(found),
        popularityRank: found ? this.latestPopularityRankFromEntry(found) : null,
      };
      this.nameStatInfoCache.set(key, info);
      return info;
    } catch {
      const fallback = { exists: false, popularityRank: null };
      this.nameStatInfoCache.set(key, fallback);
      return fallback;
    }
  }

  private async existsInNameStat(givenName: NameCharInput[]): Promise<boolean> {
    return (await this.getNameStatInfo(givenName)).exists;
  }

  private async filterCandidatesByNameStat(nameInputs: NameCharInput[][]): Promise<NameCharInput[][]> {
    const filtered: NameCharInput[][] = [];
    for (const givenNameInput of nameInputs) {
      if (await this.existsInNameStat(givenNameInput)) {
        filtered.push(givenNameInput);
      }
    }
    return filtered;
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- score all candidates and sort
  // -------------------------------------------------------------------------

  private async scoreAllCandidates(
    surname: NameCharInput[],
    nameInputs: NameCharInput[][],
    sajuDistribution: Record<ElementKey, number>,
    sajuOutput: SajuOutputSummary | null,
  ): Promise<SpringCandidate[]> {
    const scored: SpringCandidate[] = [];

    for (const givenNameInput of nameInputs) {
      scored.push(
        await this.scoreCandidate(surname, givenNameInput, sajuDistribution, sajuOutput),
      );
    }

    scored.sort((a, b) => b.scores.total - a.scores.total);
    return scored;
  }

  // -------------------------------------------------------------------------
  // analyze() helper -- paginate and assemble the final response
  // -------------------------------------------------------------------------

  private buildResponse(
    request: SpringRequest,
    mode: 'evaluate' | 'recommend' | 'all',
    sajuSummary: SajuSummary,
    scoredCandidates: SpringCandidate[],
  ): SpringResponse {
    const offset = request.options?.offset ?? DEFAULT_OFFSET;
    const limit  = request.options?.limit  ?? DEFAULT_LIMIT;

    const page = scoredCandidates
      .slice(offset, offset + limit)
      .map((candidate, index) => ({ ...candidate, rank: offset + index + 1 }));

    return {
      request,
      mode,
      saju: sajuSummary,
      candidates: page,
      totalCount: scoredCandidates.length,
      meta: { version: ENGINE_VERSION, timestamp: new Date().toISOString() },
    };
  }

  // -------------------------------------------------------------------------
  // scoreCandidate -- evaluate one surname + given-name combination
  // -------------------------------------------------------------------------

  private async scoreCandidate(
    surname: NameCharInput[],
    givenName: NameCharInput[],
    sajuDistribution: Record<ElementKey, number>,
    sajuOutput: SajuOutputSummary | null,
  ): Promise<SpringCandidate> {
    const surnameEntries   = await this.resolveEntries(surname);
    const givenNameEntries = await this.resolveEntries(givenName);

    // Build one calculator per scoring category
    const hangul = new HangulCalculator(surnameEntries, givenNameEntries);
    const hanja  = new HanjaCalculator(surnameEntries, givenNameEntries);
    const frame  = new FrameCalculator(surnameEntries, givenNameEntries);
    const saju   = new SajuCalculator(surnameEntries, givenNameEntries, sajuDistribution, sajuOutput);

    // Evaluate all calculators together
    const evalContext: EvalContext = {
      surnameLength: surnameEntries.length,
      givenLength:   givenNameEntries.length,
      luckyMap:      this.luckyMap,
      insights:      {},
    };

    const evaluationResult = springEvaluateName([hangul, hanja, frame, saju], evalContext);
    const categoryMap      = evaluationResult.categoryMap;

    // Assemble the full name strings
    const allEntries  = [...surnameEntries, ...givenNameEntries];
    const fullHangul  = allEntries.map(entry => entry.hangul).join('');
    const fullHanja   = allEntries.map(entry => entry.hanja).join('');

    // Compute category sub-scores (average of related frames)
    const hangulScore = roundScore(
      ((categoryMap.HANGUL_ELEMENT?.score ?? 0) + (categoryMap.HANGUL_POLARITY?.score ?? 0)) / 2,
    );
    const hanjaScore = roundScore(
      ((categoryMap.STROKE_POLARITY?.score ?? 0) + (categoryMap.FOURFRAME_ELEMENT?.score ?? 0)) / 2,
    );

    return {
      name: {
        surname:    surnameEntries.map(toCharDetail),
        givenName:  givenNameEntries.map(toCharDetail),
        fullHangul,
        fullHanja,
      },
      scores: {
        total:     roundScore(evaluationResult.score),
        hangul:    hangulScore,
        hanja:     hanjaScore,
        fourFrame: roundScore(categoryMap.FOURFRAME_LUCK?.score ?? 0),
        saju:      roundScore(categoryMap[SAJU_FRAME]?.score ?? 0),
      },
      analysis: {
        hangul:    hangul.getAnalysis().data,
        hanja:     hanja.getAnalysis().data,
        fourFrame: frame.getAnalysis().data,
        saju:      saju.getAnalysis().data,
      },
      interpretation: buildInterpretation(evaluationResult),
      rank: 0,
    };
  }

  // -------------------------------------------------------------------------
  // generateCandidates -- produce an array of name-char combinations
  //
  // Two strategies depending on input:
  //   1. Stroke-based (no jamo filter, 1-2 char names):
  //      Uses the FourFrameOptimizer to find stroke combinations that
  //      produce lucky four-frame numbers, then picks hanja per stroke.
  //   2. Jamo-based (jamo filter present, or 3+ char names):
  //      Builds per-position pools and explores all combinations via DFS.
  // -------------------------------------------------------------------------

  private async generateCandidates(
    request: SpringRequest,
    sajuSummary: SajuSummary,
    jamoFilters?: (JamoFilter | null)[],
  ): Promise<NameCharInput[][]> {
    const surnameEntries = await this.resolveEntries(request.surname);
    const nameLength     = request.givenNameLength ?? jamoFilters?.length ?? 2;
    const hasJamoFilter  = jamoFilters?.some(filter => filter !== null) ?? false;

    // Determine which elements to favour / avoid based on saju analysis
    const targetElements = collectElements(
      sajuSummary.yongshin.element,
      sajuSummary.yongshin.heeshin,
      sajuSummary.deficientElements,
    );
    const avoidElements = collectElements(
      sajuSummary.yongshin.gishin,
      sajuSummary.yongshin.gushin,
      sajuSummary.excessiveElements,
    );
    if (targetElements.size === 0) targetElements.add(DEFAULT_TARGET_ELEMENT);

    // Build per-position character pools
    const pools = await this.buildPositionPools(
      request, nameLength, jamoFilters, hasJamoFilter,
      surnameEntries, targetElements, avoidElements,
    );

    // Choose the generation strategy
    const useStrokeStrategy = !hasJamoFilter && nameLength <= 2;

    return useStrokeStrategy
      ? this.generateViaStrokeOptimizer(surnameEntries, pools, nameLength)
      : this.generateViaDepthFirstSearch(pools, nameLength);
  }

  // -------------------------------------------------------------------------
  // Strategy 1: Stroke-based generation
  //
  // The optimizer pre-filters which stroke counts produce lucky four-frame
  // numbers. For each valid stroke combination, we pick the top characters
  // from the pool keyed by stroke count.
  // -------------------------------------------------------------------------

  private generateViaStrokeOptimizer(
    surnameEntries: HanjaEntry[],
    pools: Map<number, HanjaEntry[]>,
    nameLength: number,
  ): NameCharInput[][] {
    const surnameStrokes = surnameEntries.map(entry => entry.strokes);
    const validStrokeCombinations = this.optimizer!.getValidCombinations(surnameStrokes, nameLength);
    const results: NameCharInput[][] = [];

    for (const strokeKey of validStrokeCombinations) {
      if (results.length >= MAX_CANDIDATES) break;

      const strokeCounts = strokeKey.split(',').map(Number);

      if (nameLength === 1) {
        this.appendSingleCharCandidates(results, pools, strokeCounts[0]);
      } else {
        this.appendDoubleCharCandidates(results, pools, strokeCounts);
      }
    }

    return results;
  }

  /** For single-character given names: pick top characters at a stroke count. */
  private appendSingleCharCandidates(
    results: NameCharInput[][],
    pools: Map<number, HanjaEntry[]>,
    strokeCount: number,
  ): void {
    const candidates = (pools.get(strokeCount) ?? []).slice(0, POOL_LIMIT_SINGLE_CHAR);

    for (const candidate of candidates) {
      results.push([toNameCharInput(candidate)]);
      if (results.length >= MAX_CANDIDATES) break;
    }
  }

  /** For two-character given names: cross-join top characters from two stroke pools. */
  private appendDoubleCharCandidates(
    results: NameCharInput[][],
    pools: Map<number, HanjaEntry[]>,
    strokeCounts: number[],
  ): void {
    const firstPositionCandidates  = (pools.get(strokeCounts[0]) ?? []).slice(0, POOL_LIMIT_DOUBLE_CHAR);
    const secondPositionCandidates = (pools.get(strokeCounts[1]) ?? []).slice(0, POOL_LIMIT_DOUBLE_CHAR);

    for (const firstChar of firstPositionCandidates) {
      for (const secondChar of secondPositionCandidates) {
        if (firstChar.hanja === secondChar.hanja) continue; // skip identical hanja
        results.push([toNameCharInput(firstChar), toNameCharInput(secondChar)]);
        if (results.length >= MAX_CANDIDATES) return;
      }
      if (results.length >= MAX_CANDIDATES) return;
    }
  }

  // -------------------------------------------------------------------------
  // Strategy 2: Depth-first search generation
  //
  // Used when jamo filters are present or the given name has 3+ characters.
  // Pools are keyed by positional index (0, 1, 2, ...) rather than stroke.
  // -------------------------------------------------------------------------

  private generateViaDepthFirstSearch(
    pools: Map<number, HanjaEntry[]>,
    nameLength: number,
  ): NameCharInput[][] {
    const positionPools = Array.from(
      { length: nameLength },
      (_, position) => pools.get(position) ?? [],
    );
    const results: NameCharInput[][] = [];

    const explore = (depth: number, current: HanjaEntry[]): void => {
      if (results.length >= MAX_CANDIDATES) return;

      if (depth >= nameLength) {
        results.push(current.map(toNameCharInput));
        return;
      }

      for (const candidate of positionPools[depth]) {
        // Skip if the same hanja character already appears in the combination
        if (current.some(existing => existing.hanja === candidate.hanja)) continue;
        explore(depth + 1, [...current, candidate]);
      }
    };

    explore(0, []);
    return results;
  }

  // -------------------------------------------------------------------------
  // buildPositionPools -- prepare hanja options for each name position
  //
  // Two modes:
  //   Stroke mode (no jamo, <= 2 chars): pools keyed by stroke count
  //   Jamo mode (jamo filter or 3+ chars): pools keyed by position index
  // -------------------------------------------------------------------------

  private async buildPositionPools(
    request: SpringRequest,
    nameLength: number,
    jamoFilters: (JamoFilter | null)[] | undefined,
    hasJamoFilter: boolean,
    surnameEntries: HanjaEntry[],
    targetElements: Set<string>,
    avoidElements: Set<string>,
  ): Promise<Map<number, HanjaEntry[]>> {
    const useStrokeMode = !hasJamoFilter && nameLength <= 2;

    return useStrokeMode
      ? this.buildStrokeBasedPools(surnameEntries, nameLength, targetElements, avoidElements)
      : this.buildJamoBasedPools(request, nameLength, jamoFilters, targetElements, avoidElements);
  }

  // -------------------------------------------------------------------------
  // Pool builder: stroke-based
  //
  // 1. Ask the optimizer which stroke-count combinations are valid.
  // 2. Fetch all hanja in the needed stroke range.
  // 3. Group by stroke count, excluding surnames and avoided elements.
  // 4. Sort each group so target-element characters come first.
  // -------------------------------------------------------------------------

  private async buildStrokeBasedPools(
    surnameEntries: HanjaEntry[],
    nameLength: number,
    targetElements: Set<string>,
    avoidElements: Set<string>,
  ): Promise<Map<number, HanjaEntry[]>> {
    const surnameStrokes = surnameEntries.map(entry => entry.strokes);
    const validCombinations = this.optimizer!.getValidCombinations(surnameStrokes, nameLength);

    // Collect every stroke count that appears in a valid combination
    const neededStrokes = new Set<number>();
    for (const key of validCombinations) {
      for (const part of key.split(',')) {
        neededStrokes.add(Number(part));
      }
    }

    // Fetch hanja in bulk for the needed stroke range
    const allHanja = await this.hanjaRepo.findByStrokeRange(
      Math.min(...neededStrokes),
      Math.max(...neededStrokes),
    );

    // Group into pools, filtering out surnames and avoided elements
    const pools = new Map<number, HanjaEntry[]>();

    for (const hanjaEntry of allHanja) {
      if (hanjaEntry.is_surname) continue;
      if (!neededStrokes.has(hanjaEntry.strokes)) continue;
      if (avoidElements.has(hanjaEntry.resource_element)) continue;

      let bucket = pools.get(hanjaEntry.strokes);
      if (!bucket) {
        bucket = [];
        pools.set(hanjaEntry.strokes, bucket);
      }
      bucket.push(hanjaEntry);
    }

    // Sort each bucket: target-element characters first
    for (const [strokeCount, bucket] of pools) {
      pools.set(strokeCount, bucket.sort((a, b) =>
        (targetElements.has(b.resource_element) ? 1 : 0)
        - (targetElements.has(a.resource_element) ? 1 : 0),
      ));
    }

    return pools;
  }

  // -------------------------------------------------------------------------
  // Pool builder: jamo-based (or 3+ character names)
  //
  // Each position is resolved independently:
  //   - If the user pinned a specific hanja or hangul, use that directly.
  //   - Otherwise, filter the full hanja set by jamo onset/nucleus and
  //     sort by target-element affinity.
  // -------------------------------------------------------------------------

  private async buildJamoBasedPools(
    request: SpringRequest,
    nameLength: number,
    jamoFilters: (JamoFilter | null)[] | undefined,
    targetElements: Set<string>,
    avoidElements: Set<string>,
  ): Promise<Map<number, HanjaEntry[]>> {
    // Pre-load the full hanja pool (excluding surnames and avoided elements)
    const fullPool = (await this.hanjaRepo.findByStrokeRange(STROKE_MIN, STROKE_MAX))
      .filter(entry => !entry.is_surname && !avoidElements.has(entry.resource_element));

    const pools = new Map<number, HanjaEntry[]>();

    for (let position = 0; position < nameLength; position++) {
      const jamoFilter    = jamoFilters?.[position];
      const givenNameChar = request.givenName?.[position];

      // Case A: no jamo filter at this position and user supplied a character
      if (jamoFilter === null && givenNameChar) {
        pools.set(position, await this.resolveFixedCharPool(givenNameChar));
        continue;
      }

      // Case B: filter the full pool by jamo onset/nucleus, then take top N
      let filtered = fullPool;
      if (jamoFilter?.onset)   filtered = filtered.filter(entry => entry.onset === jamoFilter.onset);
      if (jamoFilter?.nucleus) filtered = filtered.filter(entry => entry.nucleus === jamoFilter.nucleus);

      filtered = [...filtered].sort((a, b) =>
        (targetElements.has(b.resource_element) ? 1 : 0)
        - (targetElements.has(a.resource_element) ? 1 : 0),
      );

      pools.set(position, filtered.slice(0, POOL_LIMIT_JAMO_FILTERED));
    }

    return pools;
  }

  /** Resolve a single user-specified character into a 1-element pool. */
  private async resolveFixedCharPool(givenNameChar: NameCharInput): Promise<HanjaEntry[]> {
    if (givenNameChar.hanja) {
      const entry = await this.hanjaRepo.findByHanja(givenNameChar.hanja);
      return entry ? [entry] : [makeFallbackEntry(givenNameChar.hangul)];
    }

    const entries = await this.hanjaRepo.findByHangul(givenNameChar.hangul);
    return entries.length
      ? entries.slice(0, POOL_LIMIT_SINGLE_CHAR)
      : [makeFallbackEntry(givenNameChar.hangul)];
  }

  // -------------------------------------------------------------------------
  // resolveEntries -- look up full HanjaEntry records for a name
  // -------------------------------------------------------------------------

  private async resolveEntries(chars: NameCharInput[]): Promise<HanjaEntry[]> {
    return Promise.all(chars.map(async (char) => {
      if (char.hanja) {
        const entry = await this.hanjaRepo.findByHanja(char.hanja);
        if (entry) return entry;
      }
      const byHangul = await this.hanjaRepo.findByHangul(char.hangul);
      return byHangul[0] ?? makeFallbackEntry(char.hangul);
    }));
  }

  // -------------------------------------------------------------------------
  // close -- release database resources
  // -------------------------------------------------------------------------

  close() {
    this.hanjaRepo.close();
    this.fourFrameRepo.close();
    this.nameStatRepo.close();
  }
}
