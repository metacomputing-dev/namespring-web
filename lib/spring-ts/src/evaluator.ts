/**
 * evaluator.ts -- Adaptive weighted score synthesis.
 *
 * Simplified version of the feature branch's spring-evaluator.ts.
 * Instead of a signal/frame-based pipeline, this takes direct score
 * inputs and produces a final weighted score with pass/fail determination.
 *
 * Adaptive weighting logic:
 *   - Base weights: hangul=0.20, hanja=0.20, fourFrame=0.25, saju=0.35
 *   - When saju confidence is high (>0.55), saju weight increases
 *   - When saju confidence is low, falls back to name-only weights
 *   - Pass/fail: final score >= threshold AND no individual score below floor
 */

import { clamp } from './scoring.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_WEIGHTS = {
  hangul:    0.20,
  hanja:     0.20,
  fourFrame: 0.25,
  saju:      0.35,
};

/** When saju is absent, redistribute its weight to the other three. */
const NO_SAJU_WEIGHTS = {
  hangul:    0.30,
  hanja:     0.30,
  fourFrame: 0.40,
  saju:      0.00,
};

/** Saju confidence threshold for applying confidence-based weight boost. */
const CONFIDENCE_THRESHOLD = 0.55;

/** Maximum additional weight the saju score can gain from high confidence. */
const MAX_SAJU_BOOST = 0.10;

/** Minimum individual score to pass (any score below this → fail). */
const MIN_INDIVIDUAL_SCORE = 30;

/** Minimum final score to pass. */
const MIN_FINAL_SCORE = 62;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoreInputs {
  hangul: number;         // 0-100
  hanja: number;          // 0-100
  fourFrame: number;      // 0-100
  saju: number;           // 0-100
  sajuConfidence: number; // 0-1
}

export interface EvaluationResult {
  finalScore: number;
  isPassed: boolean;
  weights: { hangul: number; hanja: number; fourFrame: number; saju: number };
}

// ---------------------------------------------------------------------------
// Main evaluation function
// ---------------------------------------------------------------------------

export function evaluateCandidate(inputs: ScoreInputs): EvaluationResult {
  const hasSaju = inputs.sajuConfidence > 0 && inputs.saju > 0;

  // Resolve adaptive weights
  const weights = hasSaju
    ? resolveAdaptiveWeights(inputs.sajuConfidence)
    : { ...NO_SAJU_WEIGHTS };

  // Compute weighted score
  const finalScore = clamp(
    weights.hangul    * inputs.hangul
    + weights.hanja   * inputs.hanja
    + weights.fourFrame * inputs.fourFrame
    + weights.saju    * inputs.saju,
    0, 100,
  );

  // Pass/fail determination
  const individualsPassed = hasSaju
    ? inputs.hangul >= MIN_INDIVIDUAL_SCORE
      && inputs.hanja >= MIN_INDIVIDUAL_SCORE
      && inputs.fourFrame >= MIN_INDIVIDUAL_SCORE
      && inputs.saju >= MIN_INDIVIDUAL_SCORE
    : inputs.hangul >= MIN_INDIVIDUAL_SCORE
      && inputs.hanja >= MIN_INDIVIDUAL_SCORE
      && inputs.fourFrame >= MIN_INDIVIDUAL_SCORE;

  const isPassed = finalScore >= MIN_FINAL_SCORE && individualsPassed;

  return {
    finalScore: Math.round(finalScore * 10) / 10,
    isPassed,
    weights,
  };
}

// ---------------------------------------------------------------------------
// Adaptive weight resolution
// ---------------------------------------------------------------------------

function resolveAdaptiveWeights(
  sajuConfidence: number,
): { hangul: number; hanja: number; fourFrame: number; saju: number } {
  if (sajuConfidence <= CONFIDENCE_THRESHOLD) {
    return { ...BASE_WEIGHTS };
  }

  // Scale boost linearly from 0 at threshold to MAX_SAJU_BOOST at confidence=1
  const boostFraction = (sajuConfidence - CONFIDENCE_THRESHOLD) / (1 - CONFIDENCE_THRESHOLD);
  const sajuBoost = boostFraction * MAX_SAJU_BOOST;

  // Distribute the boost reduction proportionally across the other three
  const otherReduction = sajuBoost / 3;

  return {
    hangul:    clamp(BASE_WEIGHTS.hangul    - otherReduction, 0.10, 0.30),
    hanja:     clamp(BASE_WEIGHTS.hanja     - otherReduction, 0.10, 0.30),
    fourFrame: clamp(BASE_WEIGHTS.fourFrame  - otherReduction, 0.15, 0.35),
    saju:      clamp(BASE_WEIGHTS.saju      + sajuBoost,      0.25, 0.45),
  };
}
