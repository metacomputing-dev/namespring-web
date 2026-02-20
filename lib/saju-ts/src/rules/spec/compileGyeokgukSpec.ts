import type { Rule, RuleSet, Expr } from '../dsl.js';
import { ELEMENT_ORDER } from '../../core/elementVector.js';
import { DEFAULT_GYEOKGUK_RULESET } from '../defaultRuleSets.js';
import type { GyeokgukMacro, GyeokgukRuleSpec, GyeokgukRuleSpecMode } from './gyeokgukSpec.js';
import type { TenGod } from '../../api/types.js';

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function andAll(parts: Array<Expr | null | undefined>): Expr {
  const xs = parts.filter((x) => x != null) as Expr[];
  if (xs.length === 0) return true;
  if (xs.length === 1) return xs[0]!;
  return { op: 'and', args: xs };
}

function compileMonthQualityGate(gate: any): Expr | null {
  if (!gate || typeof gate !== 'object') return null;

  const parts: Expr[] = [];
  if (gate.requireNotBroken === true) parts.push({ op: 'eq', args: [{ var: 'month.gyeok.quality.broken' }, false] });
  if (gate.requireNotMixed === true) parts.push({ op: 'eq', args: [{ var: 'month.gyeok.quality.mixed' }, false] });
  if (typeof gate.minMultiplier === 'number' && Number.isFinite(gate.minMultiplier))
    parts.push({ op: 'gte', args: [{ var: 'month.gyeok.quality.multiplier' }, gate.minMultiplier] });
  if (typeof gate.minIntegrity === 'number' && Number.isFinite(gate.minIntegrity))
    parts.push({ op: 'gte', args: [{ var: 'month.gyeok.quality.integrity' }, gate.minIntegrity] });
  if (typeof gate.minClarity === 'number' && Number.isFinite(gate.minClarity))
    parts.push({ op: 'gte', args: [{ var: 'month.gyeok.quality.clarity' }, gate.minClarity] });
  if (gate.requireQingZhuo === 'QING' || gate.requireQingZhuo === 'ZHUO')
    parts.push({ op: 'eq', args: [{ var: 'month.gyeok.quality.qingZhuo' }, gate.requireQingZhuo] });

  return parts.length ? andAll(parts) : null;
}

function monthQualityGuards(mq: any): Expr[] {
  if (!mq || typeof mq !== 'object') return [];
  const out: Expr[] = [];
  const num = (v: any): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const minMul = num((mq as any).minMultiplier);
  const minCl = num((mq as any).minClarity);
  const minIn = num((mq as any).minIntegrity);

  if (minMul != null) out.push({ op: 'gte', args: [{ var: 'month.gyeok.quality.multiplier' }, minMul] });
  if (minCl != null) out.push({ op: 'gte', args: [{ var: 'month.gyeok.quality.clarity' }, minCl] });
  if (minIn != null) out.push({ op: 'gte', args: [{ var: 'month.gyeok.quality.integrity' }, minIn] });

  if ((mq as any).requireQing === true) out.push({ op: 'eq', args: [{ var: 'month.gyeok.quality.qingZhuo' }, 'QING'] });
  if ((mq as any).excludeZhuo === true) out.push({ op: 'ne', args: [{ var: 'month.gyeok.quality.qingZhuo' }, 'ZHUO'] });
  if ((mq as any).excludeBroken === true) out.push({ op: 'ne', args: [{ var: 'month.gyeok.quality.broken' }, true] });
  if ((mq as any).excludeMixed === true) out.push({ op: 'ne', args: [{ var: 'month.gyeok.quality.mixed' }, true] });

  return out;
}

const ALL_TEN_GODS: TenGod[] = [
  'BI_GYEON',
  'GEOB_JAE',
  'SIK_SHIN',
  'SANG_GWAN',
  'PYEON_JAE',
  'JEONG_JAE',
  'PYEON_GWAN',
  'JEONG_GWAN',
  'PYEON_IN',
  'JEONG_IN',
];

function compileMacros(macros: GyeokgukMacro[]): Rule[] {
  const out: Rule[] = [];

  for (const m of macros ?? []) {
    switch (m.kind) {
      case 'monthMainTenGod': {
        const idPrefix = m.idPrefix ?? 'GYEOKGUK_MONTH_MAIN_TENGOD';
        const explainTpl = m.explainTemplate ?? '월지 본기 십성({tenGod}) → {tenGod}격(보정)';
        const tags = m.tags;
        const bonus = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 1;
        const tenGods = (m.tenGods && m.tenGods.length ? m.tenGods : ALL_TEN_GODS).filter(Boolean) as TenGod[];

        for (const tg of tenGods) {
          const whenTg: Expr = { op: 'eq', args: [{ var: 'month.mainTenGod' }, tg] };
          out.push({
            id: `${idPrefix}_${tg}`,
            when: andAll([m.when, whenTg]),
            score: { [`gyeokguk.${tg}`]: bonus },
            explain: renderTemplate(explainTpl, { tenGod: tg }),
            tags,
          });
        }
        break;
      }

      case 'monthGyeokTenGod': {
        const idPrefix = m.idPrefix ?? 'GYEOKGUK_MONTH_GYEOK_TENGOD';
        const explainTpl = m.explainTemplate ?? '월지 투간/회지 십성({tenGod}) → {tenGod}격(보정)';
        const tags = m.tags;
        const bonus = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 1;
        const useMul = m.useQualityMultiplier === true;
        const mulVar = typeof m.qualityMultiplierVar === 'string' ? m.qualityMultiplierVar : 'month.gyeok.quality.multiplier';
        const baseScore: Expr = useMul ? { op: 'mul', args: [bonus, { var: mulVar }] } : bonus;
        const tenGods = (m.tenGods && m.tenGods.length ? m.tenGods : ALL_TEN_GODS).filter(Boolean) as TenGod[];

        for (const tg of tenGods) {
          const whenTg: Expr = { op: 'eq', args: [{ var: 'month.gyeok.tenGod' }, tg] };
          out.push({
            id: `${idPrefix}_${tg}`,
            when: andAll([m.when, whenTg]),
            score: { [`gyeokguk.${tg}`]: baseScore },
            explain: renderTemplate(explainTpl, { tenGod: tg }),
            tags,
          });
        }
        break;
      }

      case 'customRules':
        out.push(...(m.rules ?? []));
        break;

      case 'oneElementDominance': {
        const idPrefix = m.idPrefix ?? 'GYEOKGUK_ONEELEMENT';
        const explainTpl = m.explainTemplate ?? '일행득기/专旺({element}) 신호 → 专旺格 후보({key}) 보정';
        const tags = m.tags;

        const minFactor = typeof m.minFactor === 'number' && Number.isFinite(m.minFactor) ? m.minFactor : 0.62;
        const bonus = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 0.85;
        const key = typeof m.key === 'string' && m.key.trim() ? m.key : 'gyeokguk.ZHUAN_WANG';

        const factorSel = m.factor === 'zhuanwang' || m.factor === 'raw' ? m.factor : 'raw';
        const rawVar = 'patterns.elements.oneElement.factor';
        const zwVar = 'patterns.elements.oneElement.zhuanwangFactor';
        const factorExpr: Expr =
          factorSel === 'zhuanwang'
            ? {
                op: 'if',
                args: [
                  { op: 'gt', args: [{ var: zwVar }, 0] },
                  { var: zwVar },
                  { var: rawVar },
                ],
              }
            : { var: rawVar };
        const elVar = 'patterns.elements.oneElement.element';

        const baseGuards: Expr[] = [];
        if ((m as any).requireIsOneElement === true) baseGuards.push({ op: 'eq', args: [{ var: 'patterns.elements.oneElement.isOneElement' }, true] });
        baseGuards.push(...monthQualityGuards((m as any).monthQuality));
        {
          const qGate = compileMonthQualityGate((m as any).qualityGate);
          if (qGate) baseGuards.push(qGate);
        }

        for (const e of ELEMENT_ORDER) {
          const when = andAll([
            m.when,
            { op: 'gte', args: [factorExpr, minFactor] },
            { op: 'eq', args: [{ var: elVar }, e] },
            ...(m as any).requireDayMasterMatch === true ? [{ op: 'eq', args: [{ var: 'dayMaster.element' }, e] } as Expr] : [],
            ...baseGuards,
          ]);

          out.push({
            id: `${idPrefix}_${e}`,
            when,
            score: { [key]: { op: 'mul', args: [factorExpr, bonus] } },
            explain: renderTemplate(explainTpl, { element: e, key }),
            tags,
          });
        }
        break;
      }

      case 'transformationsBest': {
        const idPrefix = m.idPrefix ?? 'GYEOKGUK_TRANSFORM';
        const explainTpl = m.explainTemplate ?? '합화(化气) best 신호 → 化气格 후보({key}) 보정';
        const tags = m.tags;

        const minFactor = typeof m.minFactor === 'number' && Number.isFinite(m.minFactor) ? m.minFactor : 0.6;
        const bonus = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 0.85;
        const key = typeof m.key === 'string' && m.key.trim() ? m.key : 'gyeokguk.HUA_QI';

        const factorSel = m.factor === 'huaqi' || m.factor === 'raw' || m.factor === 'effective' ? m.factor : 'effective';
        const factorVar =
          factorSel === 'huaqi'
            ? 'patterns.transformations.best.huaqiFactor'
            : factorSel === 'raw'
              ? 'patterns.transformations.best.factor'
              : 'patterns.transformations.best.effectiveFactor';

        const guards: Expr[] = [];
        if ((m as any).requireDayMasterInvolved === true) {
          guards.push({ op: 'eq', args: [{ var: 'patterns.transformations.best.huaqiDetails.flags.dayInvolved' }, true] });
        }
        guards.push(...monthQualityGuards((m as any).monthQuality));
        {
          const qGate = compileMonthQualityGate((m as any).qualityGate);
          if (qGate) guards.push(qGate);
        }

        out.push({
          id: `${idPrefix}_BEST`,
          when: andAll([m.when, { op: 'gte', args: [{ var: factorVar }, minFactor] }, ...guards]),
          score: { [key]: { op: 'mul', args: [{ var: factorVar }, bonus] } },
          explain: renderTemplate(explainTpl, { key }),
          tags,
        });
        break;
      }

      case 'followJonggyeok': {
        const idPrefix = m.idPrefix ?? 'GYEOKGUK_FOLLOW';
        const explainTpl = m.explainTemplate ?? '종격/从格(jonggyeok) 신호 → 从格 후보({key}) 보정';
        const tags = m.tags;

        const minFactor = typeof m.minFactor === 'number' && Number.isFinite(m.minFactor) ? m.minFactor : 0.6;
        const bonus = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 0.85;
        const key = typeof m.key === 'string' && m.key.trim() ? m.key : 'gyeokguk.CONG_GE';

        const factorSel = m.factor === 'potential' || m.factor === 'jonggyeok' ? m.factor : 'jonggyeok';
        const factorVar = factorSel === 'potential' ? 'patterns.follow.potential' : 'patterns.follow.jonggyeokFactor';

        const modeSel = m.mode === 'PRESSURE' || m.mode === 'SUPPORT' || m.mode === 'ANY' ? m.mode : 'ANY';
        const modeWhen: Expr | null =
          modeSel === 'PRESSURE' || modeSel === 'SUPPORT' ? { op: 'eq', args: [{ var: 'patterns.follow.mode' }, modeSel] } : null;

        const guards: Expr[] = [];
        // Optional: filter by followType
        if (Array.isArray((m as any).types) && (m as any).types.length) {
          guards.push({ op: 'in', args: [{ var: 'patterns.follow.followType' }, (m as any).types as any] });
        }
        if (Array.isArray((m as any).excludeTypes) && (m as any).excludeTypes.length) {
          guards.push({ op: 'not', args: [{ op: 'in', args: [{ var: 'patterns.follow.followType' }, (m as any).excludeTypes as any] }] });
        }

        // Optional: require subtype confidence
        if (typeof (m as any).minSubtypeConfidence === 'number' && Number.isFinite((m as any).minSubtypeConfidence)) {
          guards.push({ op: 'gte', args: [{ var: 'patterns.follow.followTenGodSplit.confidence' }, (m as any).minSubtypeConfidence] });
        }

        guards.push(...monthQualityGuards((m as any).monthQuality));
        {
          const qGate = compileMonthQualityGate((m as any).qualityGate);
          if (qGate) guards.push(qGate);
        }

        out.push({
          id: `${idPrefix}_${modeSel}_${factorSel}`,
          when: andAll([m.when, modeWhen, { op: 'gte', args: [{ var: factorVar }, minFactor] }, ...guards]),
          score: { [key]: { op: 'mul', args: [{ var: factorVar }, bonus] } },
          explain: renderTemplate(explainTpl, { key }),
          tags,
        });
        break;
      }

      case 'followJonggyeokTyped': {
        const idPrefix = m.idPrefix ?? 'GYEOKGUK_FOLLOW_TYPED';
        const explainTpl = m.explainTemplate ?? '종격/从格 type={type} 신호 → 从格 후보({key}) 보정';
        const tags = m.tags;

        const minFactor = typeof m.minFactor === 'number' && Number.isFinite(m.minFactor) ? m.minFactor : 0.6;
        const bonus = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 0.85;
        const keyPrefix = typeof m.keyPrefix === 'string' && m.keyPrefix.trim() ? m.keyPrefix : 'gyeokguk.';

        const factorSel = m.factor === 'potential' || m.factor === 'jonggyeok' ? m.factor : 'jonggyeok';
        const factorVar = factorSel === 'potential' ? 'patterns.follow.potential' : 'patterns.follow.jonggyeokFactor';

        const modeSel = m.mode === 'PRESSURE' || m.mode === 'SUPPORT' || m.mode === 'ANY' ? m.mode : 'ANY';
        const modeWhen: Expr | null =
          modeSel === 'PRESSURE' || modeSel === 'SUPPORT' ? { op: 'eq', args: [{ var: 'patterns.follow.mode' }, modeSel] } : null;

        const typesRaw = Array.isArray(m.types) ? m.types : [];
        const valid = (t: any) =>
          t === 'CONG_CAI' || t === 'CONG_GUAN' || t === 'CONG_SHA' || t === 'CONG_ER' || t === 'CONG_YIN' || t === 'CONG_BI';
        const types = typesRaw.length ? (typesRaw.filter(valid) as any[]) : (['CONG_CAI', 'CONG_GUAN', 'CONG_SHA', 'CONG_ER', 'CONG_YIN', 'CONG_BI'] as const);

        const guardsBase: Expr[] = [];
        if (typeof (m as any).minSubtypeConfidence === 'number' && Number.isFinite((m as any).minSubtypeConfidence)) {
          guardsBase.push({ op: 'gte', args: [{ var: 'patterns.follow.followTenGodSplit.confidence' }, (m as any).minSubtypeConfidence] });
        }
        guardsBase.push(...monthQualityGuards((m as any).monthQuality));
        {
          const qGate = compileMonthQualityGate((m as any).qualityGate);
          if (qGate) guardsBase.push(qGate);
        }

        for (const type of types) {
          const key = `${keyPrefix}${type}`;
          out.push({
            id: `${idPrefix}_${type}_${modeSel}_${factorSel}`,
            when: andAll([
              m.when,
              modeWhen,
              { op: 'eq', args: [{ var: 'patterns.follow.followType' }, type] },
              { op: 'gte', args: [{ var: factorVar }, minFactor] },
              ...guardsBase,
            ]),
            score: { [key]: { op: 'mul', args: [{ var: factorVar }, bonus] } },
            explain: renderTemplate(explainTpl, { key, type }),
            tags,
          });
        }
        break;
      }

      case 'suppressOtherFrames': {
        const idPrefix = (m as any).idPrefix ?? 'GYEOKGUK_SUPPRESS';
        const explainTpl = (m as any).explainTemplate ?? 'special-frame suppression: {winner} strong → suppress {key}';
        const tags = (m as any).tags;

        const winner = (m as any).winner as 'transformations' | 'oneElement' | 'follow';
        const minFactor = typeof (m as any).minFactor === 'number' && Number.isFinite((m as any).minFactor) ? (m as any).minFactor : 0.65;
        const penalty = typeof (m as any).penalty === 'number' && Number.isFinite((m as any).penalty) ? (m as any).penalty : 0.6;

        // Winner factor expression
        let factorExpr: Expr = 0;
        if (winner === 'follow') {
          const sel = ((m as any).factor && (m as any).factor.frame === 'follow' ? (m as any).factor.sel : null) as any;
          const s = sel === 'potential' || sel === 'jonggyeok' ? sel : 'jonggyeok';
          const v = s === 'potential' ? 'patterns.follow.potential' : 'patterns.follow.jonggyeokFactor';
          factorExpr = { var: v };
        } else if (winner === 'transformations') {
          const sel = ((m as any).factor && (m as any).factor.frame === 'transformations' ? (m as any).factor.sel : null) as any;
          const s = sel === 'huaqi' || sel === 'raw' || sel === 'effective' ? sel : 'effective';
          const v = s === 'huaqi' ? 'patterns.transformations.best.huaqiFactor' : s === 'raw' ? 'patterns.transformations.best.factor' : 'patterns.transformations.best.effectiveFactor';
          factorExpr = { var: v };
        } else if (winner === 'oneElement') {
          const sel = ((m as any).factor && (m as any).factor.frame === 'oneElement' ? (m as any).factor.sel : null) as any;
          const s = sel === 'zhuanwang' || sel === 'raw' ? sel : 'raw';
          const rawVar = 'patterns.elements.oneElement.factor';
          const zwVar = 'patterns.elements.oneElement.zhuanwangFactor';
          factorExpr =
            s === 'zhuanwang'
              ? {
                  op: 'if',
                  args: [
                    { op: 'gt', args: [{ var: zwVar }, 0] },
                    { var: zwVar },
                    { var: rawVar },
                  ],
                }
              : { var: rawVar };
        }

        const baseWhen = andAll([(m as any).when, { op: 'gte', args: [factorExpr, minFactor] }]);

        const km: any = (m as any).keyMap ?? {};
        const defaultKeys = (frame: 'transformations' | 'oneElement' | 'follow'): string[] => {
          if (frame === 'transformations') return ['gyeokguk.HUA_QI'];
          if (frame === 'oneElement') return ['gyeokguk.ZHUAN_WANG'];
          return ['gyeokguk.CONG_CAI', 'gyeokguk.CONG_GUAN', 'gyeokguk.CONG_SHA', 'gyeokguk.CONG_ER', 'gyeokguk.CONG_YIN', 'gyeokguk.CONG_BI', 'gyeokguk.CONG_GE'];
        };

        const targetsRaw: any[] = Array.isArray((m as any).targets) ? (m as any).targets : ['transformations', 'oneElement', 'follow'];
        const targets = targetsRaw.filter((x) => x === 'transformations' || x === 'oneElement' || x === 'follow') as Array<'transformations' | 'oneElement' | 'follow'>;

        for (const target of targets) {
          if (target === winner) continue;
          const keys: string[] = Array.isArray(km?.[target]) && km[target].length ? km[target] : defaultKeys(target);
          for (const key of keys) {
            out.push({
              id: `${idPrefix}_${winner}_${target}_${String(key).replace(/[^a-zA-Z0-9_]/g, '_')}`,
              when: baseWhen,
              score: { [key]: { op: 'mul', args: [factorExpr, -penalty] } },
              explain: renderTemplate(explainTpl, { winner, target, key }),
              tags,
            });
          }
        }

        break;
      }

      case 'penalizeKeyWhen': {
        const idPrefix = (m as any).idPrefix ?? 'GYEOKGUK_PENALIZE';
        const explainTpl = (m as any).explainTemplate ?? 'penalize {key} when condition holds';
        const tags = (m as any).tags;

        const key = typeof (m as any).key === 'string' && (m as any).key.trim() ? (m as any).key.trim() : '';
        const pRaw = typeof (m as any).penalty === 'number' && Number.isFinite((m as any).penalty) ? (m as any).penalty : 0;
        const penalty = Math.abs(pRaw);
        if (!key || penalty <= 0) break;

        const scaleVar = typeof (m as any).scaleVar === 'string' && (m as any).scaleVar.trim() ? (m as any).scaleVar : null;
        const scoreExpr: Expr = scaleVar ? { op: 'mul', args: [{ var: scaleVar }, -penalty] } : -penalty;

        out.push({
          id: `${idPrefix}_${String(key).replace(/[^a-zA-Z0-9_]/g, '_')}`,
          when: (m as any).when ?? true,
          score: { [key]: scoreExpr },
          explain: renderTemplate(explainTpl, { key }),
          tags,
        });

        break;
      }


      default: {
        const _exhaustive: never = m;
        throw new Error(`Unknown gyeokguk macro kind: ${(m as any).kind}`);
      }
    }
  }

  return out;
}

function applyMode(baseRules: Rule[], compiled: Rule[], mode: GyeokgukRuleSpecMode): Rule[] {
  switch (mode) {
    case 'prepend':
      return [...compiled, ...baseRules];
    case 'replace':
      return [...compiled];
    case 'append':
    default:
      return [...baseRules, ...compiled];
  }
}

export function compileGyeokgukRuleSpec(specInput: GyeokgukRuleSpec | GyeokgukRuleSpec[]): RuleSet {
  const specs = Array.isArray(specInput) ? specInput : [specInput];
  if (specs.length === 0) return DEFAULT_GYEOKGUK_RULESET;

  let rules: Rule[] = [];
  let meta: Pick<RuleSet, 'id' | 'version' | 'description'> = {
    id: specs[0]?.id ?? 'gyeokguk.spec',
    version: specs[0]?.version ?? '0.1',
    description: specs[0]?.description,
  };

  let first = true;
  for (const s of specs) {
    const compiled = compileMacros(s.macros ?? []);
    if (first) {
      const base = s.base ?? 'default';
      const baseRules = base === 'default' ? DEFAULT_GYEOKGUK_RULESET.rules : [];
      const mode = s.mode ?? 'append';
      rules = applyMode(baseRules, compiled, mode);
      meta = {
        id: s.id ?? meta.id,
        version: s.version ?? meta.version,
        description: s.description ?? meta.description,
      };
      first = false;
    } else {
      const mode = s.mode ?? 'append';
      rules = applyMode(rules, compiled, mode);
      if (s.description) meta.description = (meta.description ? `${meta.description}\n` : '') + s.description;
    }
  }

  return {
    id: meta.id,
    version: meta.version,
    description: meta.description,
    rules,
  };
}
