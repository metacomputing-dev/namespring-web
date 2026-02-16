/**
 * name-scorer.ts -- Wraps seed-ts calculators to extract scores and analysis data.
 *
 * Uses seed-ts calculators directly (HangulCalculator, HanjaCalculator,
 * FourFrameCalculator) with their existing public API.
 */

import { HangulCalculator } from '../../seed-ts/src/calculator/hangul-calculator.js';
import { HanjaCalculator } from '../../seed-ts/src/calculator/hanja-calculator.js';
import { FourFrameCalculator } from '../../seed-ts/src/calculator/frame-calculator.js';
import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import { bucketFromFortune } from './scoring.js';
import type {
  HangulAnalysisResult,
  HanjaAnalysisResult,
  FourFrameAnalysisResult,
  NamingReportFrame,
} from './types.js';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface NameScoreResult {
  hangulScore: number;
  hanjaScore: number;
  fourFrameScore: number;
  hangulAnalysis: HangulAnalysisResult;
  hanjaAnalysis: HanjaAnalysisResult;
  fourFrameAnalysis: FourFrameAnalysisResult;
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

export async function scoreName(
  surnameEntries: HanjaEntry[],
  givenNameEntries: HanjaEntry[],
  luckyMap: Map<number, string>,
): Promise<NameScoreResult> {
  // 1. Instantiate seed-ts calculators
  const hangul = new HangulCalculator(surnameEntries, givenNameEntries);
  const hanja = new HanjaCalculator(surnameEntries, givenNameEntries);
  const fourFrame = new FourFrameCalculator(surnameEntries, givenNameEntries);

  // 2. Run calculations
  hangul.calculate();
  hanja.calculate();
  fourFrame.calculate();

  // 3. Wait for async four-frame luck level data
  await Promise.all(
    fourFrame.frames.map(f => f.getLuckLevel(f.strokeSum)),
  );

  // 4. Extract scores
  const hangulScore = hangul.getScore();
  const hanjaScore = hanja.getScore();
  const fourFrameScore = fourFrame.getScore();

  // 5. Build analysis objects
  const hangulAnalysis = buildHangulAnalysis(hangul);
  const hanjaAnalysis = buildHanjaAnalysis(hanja);
  const fourFrameAnalysis = buildFourFrameAnalysis(fourFrame, luckyMap);

  return { hangulScore, hanjaScore, fourFrameScore, hangulAnalysis, hanjaAnalysis, fourFrameAnalysis };
}

// ---------------------------------------------------------------------------
// Analysis extraction helpers
// ---------------------------------------------------------------------------

function buildHangulAnalysis(calc: HangulCalculator): HangulAnalysisResult {
  const blocks = calc.hangulNameBlocks.map(block => ({
    hangul: block.entry.hangul,
    element: block.energy?.element.english ?? '',
    polarity: block.energy?.polarity.english ?? '',
  }));

  return {
    blocks,
    polarityScore: calc.polarityScore,
    elementScore: calc.elementScore,
    totalScore: calc.getScore(),
  };
}

function buildHanjaAnalysis(calc: HanjaCalculator): HanjaAnalysisResult {
  const blocks = calc.hanjaNameBlocks.map(block => ({
    hangul: block.entry.hangul,
    hanja: block.entry.hanja,
    element: block.energy?.element.english ?? '',
    polarity: block.energy?.polarity.english ?? '',
    strokes: block.entry.strokes,
  }));

  return {
    blocks,
    polarityScore: calc.polarityScore,
    elementScore: calc.elementScore,
    totalScore: calc.getScore(),
  };
}

function buildFourFrameAnalysis(
  calc: FourFrameCalculator,
  luckyMap: Map<number, string>,
): FourFrameAnalysisResult {
  const frames: NamingReportFrame[] = calc.frames.map(f => ({
    type: f.type,
    strokeSum: f.strokeSum,
    element: f.energy?.element.english ?? '',
    polarity: f.energy?.polarity.english ?? '',
    luckyLevel: bucketFromFortune(luckyMap.get(f.strokeSum) ?? ''),
    meaning: f.entry ?? null,
  }));

  return {
    frames,
    elementScore: calc.getScore(),
    luckScore: calc.luckScore,
  };
}
