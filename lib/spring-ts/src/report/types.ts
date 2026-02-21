/**
 * types.ts -- Premium Saju Report type definitions
 *
 * Saju-only report types for the premium report system.
 * No naming-related sections or types are included here.
 */

import type { SajuSummary, BirthInfo } from '../types.js';

// Re-export for convenience
export type { SajuSummary, BirthInfo };

// ---------------------------------------------------------------------------
//  1. Core saju code types
// ---------------------------------------------------------------------------

/** Five-element code */
export type ElementCode = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER';

/** Yin-Yang code */
export type YinYangCode = 'YANG' | 'YIN';

/** Heavenly stem code (10 stems) */
export type StemCode =
  | 'GAP' | 'EUL' | 'BYEONG' | 'JEONG' | 'MU'
  | 'GI' | 'GYEONG' | 'SIN' | 'IM' | 'GYE';

/** Earthly branch code (12 branches) */
export type BranchCode =
  | 'JA' | 'CHUK' | 'IN' | 'MYO' | 'JIN' | 'SA'
  | 'O' | 'MI' | 'SIN_BRANCH' | 'YU' | 'SUL' | 'HAE';

/** Ten-god code (10 gods) */
export type TenGodCode =
  | 'BI_GYEON' | 'GEOB_JAE' | 'SIK_SHIN' | 'SANG_GWAN'
  | 'PYEON_JAE' | 'JEONG_JAE' | 'PYEON_GWAN' | 'JEONG_GWAN'
  | 'PYEON_IN' | 'JEONG_IN';

/** Twelve life-stage code */
export type LifeStageCode =
  | 'JANGSEONG' | 'MOKYOK' | 'GWANDAE' | 'GEONROK' | 'JEWANG'
  | 'SWOE' | 'BYEONG' | 'SA' | 'MYO' | 'JEOL' | 'TAE' | 'YANG';

/** Day-master strength classification */
export type StrengthLevel = 'EXTREME_STRONG' | 'STRONG' | 'BALANCED' | 'WEAK' | 'EXTREME_WEAK';

/** Yongshin match grade (5 = best, 1 = worst) */
export type YongshinMatchGrade = 5 | 4 | 3 | 2 | 1;

// ---------------------------------------------------------------------------
//  2. Premium report section IDs
// ---------------------------------------------------------------------------

/** All section IDs available in the premium saju report */
export type PremiumSectionId =
  | 'overallSummary'
  | 'myPillars'
  | 'dayMaster'
  | 'elementBalance'
  | 'gyeokgukYongshin'
  | 'tenGodPersonality'
  | 'lifeStages'
  | 'interactions'
  | 'shinsal'
  | 'fortuneCycles'
  | 'lifeGuide';

// ---------------------------------------------------------------------------
//  3. Report building blocks
// ---------------------------------------------------------------------------

/** A single paragraph within a report section */
export interface ReportParagraph {
  readonly type: 'narrative' | 'tip' | 'warning' | 'quote' | 'emphasis';
  readonly text: string;
  readonly element?: ElementCode;
  readonly tone?: 'positive' | 'negative' | 'neutral' | 'encouraging';
}

/** A data table within a report section */
export interface ReportTable {
  readonly title?: string;
  readonly headers: string[];
  readonly rows: string[][];
}

/** Chart / visualization data within a report section */
export interface ReportChart {
  readonly type: 'radar' | 'bar' | 'gauge' | 'timeline' | 'donut' | 'line';
  readonly title?: string;
  readonly data: Record<string, number | string>;
  readonly meta?: Record<string, unknown>;
}

/** A highlight badge (key stat / keyword) */
export interface ReportHighlight {
  readonly label: string;
  readonly value: string;
  readonly element?: ElementCode;
  readonly sentiment?: 'good' | 'caution' | 'neutral';
}

/** A subsection nested inside a top-level section */
export interface ReportSubsection {
  readonly title: string;
  readonly paragraphs: ReportParagraph[];
  readonly tables?: ReportTable[];
  readonly charts?: ReportChart[];
  readonly highlights?: ReportHighlight[];
}

/** A top-level section of the premium saju report */
export interface PremiumReportSection {
  readonly id: PremiumSectionId;
  readonly title: string;
  readonly subtitle?: string;
  readonly paragraphs: ReportParagraph[];
  readonly tables?: ReportTable[];
  readonly charts?: ReportChart[];
  readonly highlights?: ReportHighlight[];
  readonly subsections?: ReportSubsection[];
}

// ---------------------------------------------------------------------------
//  4. Top-level report envelope
// ---------------------------------------------------------------------------

/** The complete premium saju report */
export interface PremiumSajuReport {
  readonly meta: {
    readonly version: string;
    readonly generatedAt: string;
  };
  readonly sections: PremiumReportSection[];
}
