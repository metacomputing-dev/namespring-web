/**
 * spring-engine.ts -- Main naming-recommendation engine.
 *
 * Public API:
 *   init()              -- load databases and precompute lucky number tables
 *   getNamingReport()   -- pure name analysis (no saju)
 *   getSajuReport()     -- saju analysis only
 *   getNameCandidates() -- name recommendations with saju integration
 *   getHanjaRepository() -- expose hanja repository for external lookups
 *   close()             -- release database resources
 *
 * Orchestrates seed-ts calculators, saju-ts adapter, and spring-ts scoring
 * components into a single cohesive pipeline.
 */

import { HanjaRepository, type HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import { FourframeRepository } from '../../seed-ts/src/database/fourframe-repository.js';
import { Polarity } from '../../seed-ts/src/model/polarity.js';
import { type ElementKey, distributionFromArrangement, bucketFromFortune } from './scoring.js';
import { scoreName } from './name-scorer.js';
import { analyzeSaju, analyzeSajuSafe, buildSajuContext, collectElements } from './saju-adapter.js';
import { computeSajuNameScore } from './saju-scorer.js';
import { evaluateCandidate } from './evaluator.js';
import {
  FourFrameOptimizer,
  generateCandidates,
} from './candidate-generator.js';
import { makeFallbackEntry, buildInterpretation, parseJamoFilter, type JamoFilter } from './utils.js';
import type {
  SpringRequest, SpringOptions, SajuSummary, SajuReport,
  NamingReport, NamingReportFrame, SpringReport,
  NameCharInput, CharDetail, SajuCompatibility,
  BirthInfo,
} from './types.js';
import { elementFromSajuCode } from './saju-adapter.js';
import engineConfig from '../config/engine.json';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MAX_CANDIDATES            = engineConfig.maxCandidates;
const FOURFRAME_LOAD_LIMIT      = engineConfig.fourframeLoadLimit;
const LUCKY_LEVEL_KEYWORDS: string[] = engineConfig.luckyLevelKeywords;
const DEFAULT_TARGET_ELEMENT    = engineConfig.defaultTargetElement;
const ENGINE_VERSION            = engineConfig.version;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function toNameCharInput(entry: HanjaEntry): NameCharInput {
  return { hangul: entry.hangul, hanja: entry.hanja };
}

// ---------------------------------------------------------------------------
// SpringEngine
// ---------------------------------------------------------------------------

export class SpringEngine {
  private hanjaRepo = new HanjaRepository();
  private fourFrameRepo = new FourframeRepository();
  private initialized = false;
  private luckyMap = new Map<number, string>();
  private validFourFrameNumbers = new Set<number>();
  private optimizer: FourFrameOptimizer | null = null;

  getHanjaRepository(): HanjaRepository { return this.hanjaRepo; }

  // -------------------------------------------------------------------------
  // init
  // -------------------------------------------------------------------------

  async init(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([this.hanjaRepo.init(), this.fourFrameRepo.init()]);
    await this.buildLuckyNumberSet();
    this.optimizer = new FourFrameOptimizer(this.validFourFrameNumbers);

    this.initialized = true;
  }

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

    const nameResult = await scoreName(surnameEntries, givenNameEntries, this.luckyMap);

    const allEntries = [...surnameEntries, ...givenNameEntries];
    const fullHangul = allEntries.map(e => e.hangul).join('');
    const fullHanja  = allEntries.map(e => e.hanja).join('');

    const hangulScore    = roundScore(nameResult.hangulScore);
    const hanjaScore     = roundScore(nameResult.hanjaScore);
    const fourFrameScore = roundScore(nameResult.fourFrameScore);
    const totalScore     = roundScore((hangulScore + hanjaScore + fourFrameScore) / 3);

    return {
      name: {
        surname:    surnameEntries.map(toCharDetail),
        givenName:  givenNameEntries.map(toCharDetail),
        fullHangul,
        fullHanja,
      },
      totalScore,
      scores: {
        hangul:    hangulScore,
        hanja:     hanjaScore,
        fourFrame: fourFrameScore,
      },
      analysis: {
        hangul:    nameResult.hangulAnalysis,
        hanja:     nameResult.hanjaAnalysis,
        fourFrame: nameResult.fourFrameAnalysis,
      },
      interpretation: buildInterpretation({
        total: totalScore,
        hangul: hangulScore,
        hanja: hanjaScore,
        fourFrame: fourFrameScore,
      }),
    };
  }

  // -------------------------------------------------------------------------
  // getSajuReport -- saju analysis only
  // -------------------------------------------------------------------------

  async getSajuReport(request: SpringRequest): Promise<SajuReport> {
    const { summary, sajuEnabled } = await analyzeSajuSafe(request.birth, request.options);
    return { ...summary, sajuEnabled };
  }

  // -------------------------------------------------------------------------
  // getNameCandidates -- name recommendations with saju integration
  // -------------------------------------------------------------------------

  async getNameCandidates(request: SpringRequest): Promise<SpringReport[]> {
    await this.init();

    // 1. Saju analysis
    const sajuReport = await this.getSajuReport(request);
    const sajuSummary: SajuSummary = sajuReport;
    const { dist: sajuDistribution, output: sajuOutput } = buildSajuContext(sajuSummary);

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
      const surnameEntries   = await this.resolveEntries(request.surname);
      const givenNameEntries = await this.resolveEntries(givenNameInput);

      // Name scoring (hangul + hanja + fourFrame)
      const nameResult = await scoreName(surnameEntries, givenNameEntries, this.luckyMap);

      // Saju-name compatibility scoring
      const rootDist = distributionFromArrangement(
        [...surnameEntries, ...givenNameEntries].map(e => e.resource_element as ElementKey),
      );
      const sajuResult = computeSajuNameScore(sajuDistribution, rootDist, sajuOutput);

      // Adaptive weighted evaluation
      const evalResult = evaluateCandidate({
        hangul:    nameResult.hangulScore,
        hanja:     nameResult.hanjaScore,
        fourFrame: nameResult.fourFrameScore,
        saju:      sajuResult.score,
        sajuConfidence: sajuOutput?.yongshin?.finalConfidence ?? 0,
      });

      // Build NamingReport
      const allEntries = [...surnameEntries, ...givenNameEntries];
      const fullHangul = allEntries.map(e => e.hangul).join('');
      const fullHanja  = allEntries.map(e => e.hanja).join('');

      const namingReport: NamingReport = {
        name: {
          surname:    surnameEntries.map(toCharDetail),
          givenName:  givenNameEntries.map(toCharDetail),
          fullHangul,
          fullHanja,
        },
        totalScore: roundScore(
          (nameResult.hangulScore + nameResult.hanjaScore + nameResult.fourFrameScore) / 3,
        ),
        scores: {
          hangul:    roundScore(nameResult.hangulScore),
          hanja:     roundScore(nameResult.hanjaScore),
          fourFrame: roundScore(nameResult.fourFrameScore),
        },
        analysis: {
          hangul:    nameResult.hangulAnalysis,
          hanja:     nameResult.hanjaAnalysis,
          fourFrame: nameResult.fourFrameAnalysis,
        },
        interpretation: buildInterpretation({
          total: evalResult.finalScore,
          hangul: nameResult.hangulScore,
          hanja: nameResult.hanjaScore,
          fourFrame: nameResult.fourFrameScore,
          saju: sajuResult.score,
        }),
      };

      // Build SajuCompatibility
      const yongshinData = sajuOutput?.yongshin;
      const sajuCompatibility: SajuCompatibility = {
        yongshinElement:       elementFromSajuCode(yongshinData?.finalYongshin) ?? '',
        heeshinElement:        elementFromSajuCode(yongshinData?.finalHeesin) ?? null,
        gishinElement:         elementFromSajuCode(yongshinData?.gisin) ?? null,
        nameElements:          givenNameEntries.map(e => e.resource_element),
        yongshinMatchCount:    sajuResult.breakdown.elementMatches.yongshin,
        gishinMatchCount:      sajuResult.breakdown.elementMatches.gisin,
        dayMasterSupportScore: sajuResult.breakdown.strength,
        affinityScore:         sajuResult.score,
      };

      results.push({
        finalScore: evalResult.finalScore,
        namingReport,
        sajuReport,
        sajuCompatibility,
        rank: 0,
      });
    }

    // Sort and assign ranks
    results.sort((a, b) => b.finalScore - a.finalScore);
    results.forEach((r, i) => { r.rank = i + 1; });
    return results;
  }

  // -------------------------------------------------------------------------
  // resolveMode
  // -------------------------------------------------------------------------

  private resolveMode(
    request: SpringRequest,
    hasJamoInput: boolean,
  ): 'evaluate' | 'recommend' | 'all' {
    if (request.mode && request.mode !== 'auto') return request.mode;

    const allHaveHanja = request.givenName?.length
      && request.givenName.every(char => char.hanja);

    return allHaveHanja && !hasJamoInput ? 'evaluate' : 'recommend';
  }

  // -------------------------------------------------------------------------
  // collectNameInputs
  // -------------------------------------------------------------------------

  private async collectNameInputs(
    request: SpringRequest,
    mode: 'evaluate' | 'recommend' | 'all',
    hasJamoInput: boolean,
    jamoFilters: (JamoFilter | null)[] | undefined,
    sajuSummary: SajuSummary,
  ): Promise<NameCharInput[][]> {
    const hasExplicitGivenName = request.givenName?.length && !hasJamoInput;

    if (mode === 'evaluate' && hasExplicitGivenName) {
      return [request.givenName!];
    }

    if (mode === 'recommend' || mode === 'all' || hasJamoInput) {
      const candidates = await this.generateCandidateNames(
        request, sajuSummary, hasJamoInput ? jamoFilters! : undefined,
      );

      if (hasExplicitGivenName) {
        candidates.unshift(request.givenName!);
      }

      return candidates;
    }

    return request.givenName?.length ? [request.givenName] : [];
  }

  // -------------------------------------------------------------------------
  // generateCandidateNames
  // -------------------------------------------------------------------------

  private async generateCandidateNames(
    request: SpringRequest,
    sajuSummary: SajuSummary,
    jamoFilters?: (JamoFilter | null)[],
  ): Promise<NameCharInput[][]> {
    const surnameEntries = await this.resolveEntries(request.surname);
    const nameLength     = request.givenNameLength ?? jamoFilters?.length ?? 2;

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

    return generateCandidates({
      hanjaRepo: this.hanjaRepo,
      optimizer: this.optimizer!,
      surnameEntries,
      nameLength,
      targetElements,
      avoidElements,
      givenName: request.givenName,
      jamoFilters,
    });
  }

  // -------------------------------------------------------------------------
  // resolveEntries
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
  // close
  // -------------------------------------------------------------------------

  close(): void {
    this.hanjaRepo.close();
    this.fourFrameRepo.close();
  }
}
