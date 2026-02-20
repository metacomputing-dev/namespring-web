import type { RuleSet } from './dsl.js';

/**
 * Default “conditions” ruleset for shinsal detections.
 *
 * This ruleset does NOT decide whether a shinsal exists; it only computes
 * penalty parts (cond.penalty.*) based on chart relations around the detection target.
 *
 * Evaluation model
 * - This ruleset is evaluated **per detection** with an injected `det` object.
 * - It may add numeric contributions to `cond.penalty.<KEY>`.
 * - The engine will combine these parts into a single penalty in [0,1],
 *   then compute qualityWeight = 1 - penalty.
 *
 * Weights are supplied by the engine under:
 *   policy.shinsal.conditions.weights.{CHUNG|HAE|PA|WONJIN|HYEONG|GONGMANG}
 *
 * The engine injects:
 * - det.targetBranches: BranchIdx[] context for the detection target.
 *   - BRANCH target: [targetBranch]
 *   - STEM target: branches of matched pillars (seat branches)
 *   - NONE target: targetBranches if emitted
 */
export const DEFAULT_SHINSAL_CONDITIONS_RULESET: RuleSet = {
  id: 'shinsal.conditions.base',
  version: '0.1',
  description: 'Generic shinsal attenuation rules (충/해/파/원진/형/공망). Override via config.extensions.rulesets.shinsalConditions.',
  rules: [
    {
      id: 'COND_CHUNG',
      when: {
        op: 'overlap',
        args: [{ var: 'det.targetBranches' }, { var: 'chart.relations.chungBranches' }],
      },
      score: { 'cond.penalty.CHUNG': { var: 'policy.shinsal.conditions.weights.CHUNG' } },
      explain: '타깃 지지가 정충(沖)에 걸리면 신살 효력이 약화될 수 있음(가중치로 반영).',
      tags: ['COND', 'CHUNG'],
    },
    {
      id: 'COND_HAE',
      when: {
        op: 'overlap',
        args: [{ var: 'det.targetBranches' }, { var: 'chart.relations.haeBranches' }],
      },
      score: { 'cond.penalty.HAE': { var: 'policy.shinsal.conditions.weights.HAE' } },
      explain: '타깃 지지가 지해(害)에 걸리면 약화(가중치).',
      tags: ['COND', 'HAE'],
    },
    {
      id: 'COND_PA',
      when: {
        op: 'overlap',
        args: [{ var: 'det.targetBranches' }, { var: 'chart.relations.paBranches' }],
      },
      score: { 'cond.penalty.PA': { var: 'policy.shinsal.conditions.weights.PA' } },
      explain: '타깃 지지가 파(破)에 걸리면 약화(가중치).',
      tags: ['COND', 'PA'],
    },
    {
      id: 'COND_WONJIN',
      when: {
        op: 'overlap',
        args: [{ var: 'det.targetBranches' }, { var: 'chart.relations.wonjinBranches' }],
      },
      score: { 'cond.penalty.WONJIN': { var: 'policy.shinsal.conditions.weights.WONJIN' } },
      explain: '타깃 지지가 원진(怨嗔)에 걸리면 약화(가중치).',
      tags: ['COND', 'WONJIN'],
    },
    {
      id: 'COND_HYEONG',
      when: {
        op: 'overlap',
        args: [{ var: 'det.targetBranches' }, { var: 'chart.relations.hyeongBranches' }],
      },
      score: { 'cond.penalty.HYEONG': { var: 'policy.shinsal.conditions.weights.HYEONG' } },
      explain: '타깃 지지가 형(刑/自刑/三刑)에 걸리면 약화(가중치).',
      tags: ['COND', 'HYEONG'],
    },
    {
      id: 'COND_GONGMANG',
      when: {
        op: 'overlap',
        args: [{ var: 'det.targetBranches' }, { var: 'shinsal.gongmang.day' }],
      },
      score: { 'cond.penalty.GONGMANG': { var: 'policy.shinsal.conditions.weights.GONGMANG' } },
      explain: '타깃 지지가 일주旬空(공망)에 해당하면 약화(가중치).',
      tags: ['COND', 'GONGMANG'],
    },
  ],
};
