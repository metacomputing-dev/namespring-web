import type { Rule } from '../dsl.js';
import type { ShinsalBasedOn } from '../shinsal.js';
import type { PillarName, ScoreMode } from '../shinsalRuleCompiler.js';

export type ShinsalRuleSpecBase = 'default' | 'none';
export type ShinsalRuleSpecMode = 'append' | 'prepend' | 'replace';

export type ShinsalCatalogName = 'dayStem' | 'yearStem' | 'monthBranchStem' | 'monthBranchBranch' | 'dayPillar';

export type ShinsalMacro =
  | {
      kind: 'relationSal';
      defs: Array<{ name: string; id?: string; explain?: string; scoreKey?: string; tags?: string[] }>;
    }
  | {
      /** Shorthand: like relationSal, but provide only names and an optional template. */
      kind: 'relationSalKeys';
      names: string[];
      /** Default: 'shinsal.{name}' */
      scoreKeyPrefix?: string;
      /** Template vars: {name}. */
      explainTemplate?: string;
      tags?: string[];
    }
  | {
      kind: 'branchPresence';
      defs: Array<{
        id: string;
        name: string;
        basedOn: ShinsalBasedOn;
        targetVar: string;
        explain?: string;
        score?: number;
        category?: string;
        tags?: string[];
      }>;
    }
  | {
      kind: 'twelveSal';
      /** Which anchors to generate rules for. Default: ['YEAR_BRANCH','DAY_BRANCH'] */
      anchors?: Array<'YEAR_BRANCH' | 'DAY_BRANCH'>;
      /** Which keys to include. Default: all 12 keys in facts.shinsal.twelveSal.* */
      keys?: string[];
      /** How to name emitted detections. Default: 'key' (same key for YEAR/DAY). */
      nameMode?: 'key' | 'anchored';
      /** Optional score override per generated rule. */
      score?: number;
      /** Optional category label attached to each rule. */
      category?: string;
      /** Optional tags attached to each rule. */
      tags?: string[];
    }
  | {
      /** Convenience macro for 旬空(공망) pillar checks. */
      kind: 'gongmangPillars';
      /** Shinsal name. Default: 'GONGMANG' */
      name?: string;
      /** Var path of gongmang list. Default: 'shinsal.gongmang.day' */
      listVar?: string;
      /** Which pillars to generate rules for. Default: all four. */
      pillars?: PillarName[];
      /** Score per pillar match. Default: 1 */
      score?: number;
      category?: string;
      tags?: string[];
      /** Template vars: {pillar}. */
      explainTemplate?: string;
    }
  | {
      kind: 'pillarBranchInList';
      args: {
        name: string;
        listVar: string;
        pillars: Array<{
          pillar: PillarName;
          id: string;
          explain?: string;
          basedOn?: ShinsalBasedOn;
          score?: number;
          category?: string;
          tags?: string[];
        }>;
        category?: string;
      };
    }
  | {
      kind: 'catalogDayStem';
      which?: 'dayStem' | 'yearStem';
      defs: Array<{
        key: string;
        name?: string;
        id?: string;
        scoreMode?: ScoreMode;
        score?: number;
        explain?: string;
        category?: string;
        tags?: string[];
      }>;
    }
  | {
      kind: 'catalogMonthBranchStem';
      defs: Array<{
        key: string;
        name?: string;
        id?: string;
        scoreMode?: ScoreMode;
        score?: number;
        emitPresentList?: boolean;
        explain?: string;
        category?: string;
        tags?: string[];
      }>;
    }
  | {
      kind: 'catalogMonthBranchBranch';
      defs: Array<{
        key: string;
        name?: string;
        id?: string;
        scoreMode?: ScoreMode;
        score?: number;
        emitPresentList?: boolean;
        explain?: string;
        category?: string;
        tags?: string[];
      }>;
    }
  | {
      kind: 'catalogDayPillar';
      defs: Array<{
        key: string;
        name?: string;
        id?: string;
        score?: number;
        explain?: string;
        category?: string;
        tags?: string[];
      }>;
    }
  | {
      /**
       * Compact catalog macro: supply only keys + shared settings.
       *
       * Useful when you want to define a school pack without copying verbose per-rule objects.
       */
      kind: 'catalogKeys';
      catalog: ShinsalCatalogName;
      keys: string[];
      scoreMode?: ScoreMode;
      score?: number;
      /** Only used for monthBranch* catalogs. */
      emitPresentList?: boolean;
      category?: string;
      tags?: string[];
      /** Optional rename map: key -> emitted name. */
      names?: Record<string, string>;
      /** Optional: rule id prefix. id = `${idPrefix}_${key}` */
      idPrefix?: string;
      /** Template vars: {key}, {name}. */
      explainTemplate?: string;
    }
  | { kind: 'customRules'; rules: Rule[] };

export interface ShinsalRuleSpec {
  /** Optional identifier for the resulting ruleset. */
  id?: string;
  version?: string;
  description?: string;

  /** Base ruleset to start from. Default: 'default'. */
  base?: ShinsalRuleSpecBase;

  /** How to combine compiled macros with base. Default: 'append'. */
  mode?: ShinsalRuleSpecMode;

  /** Macro blocks (compiled into JSON-DSL rules). */
  macros: ShinsalMacro[];
}
