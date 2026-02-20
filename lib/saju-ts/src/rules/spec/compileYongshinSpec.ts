import type { Rule, RuleSet, Expr } from '../dsl.js';
import { ELEMENT_ORDER } from '../../core/elementVector.js';
import { DEFAULT_YONGSHIN_RULESET } from '../defaultRuleSets.js';
import type { YongshinMacro, YongshinRuleSpec, YongshinRuleSpecMode } from './yongshinSpec.js';

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function andAll(parts: Expr[]): Expr {
  const xs = parts.filter((x) => x != null) as Expr[];
  if (xs.length === 0) return true;
  if (xs.length === 1) return xs[0]!;
  return { op: 'and', args: xs };
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

const BRIDGE_BY_PAIR: Record<
  'waterFire' | 'fireMetal' | 'metalWood' | 'woodEarth' | 'earthWater',
  'WOOD' | 'EARTH' | 'WATER' | 'FIRE' | 'METAL'
> = {
  // 水火 -> 木, 火金 -> 土, 金木 -> 水, 木土 -> 火, 土水 -> 金
  waterFire: 'WOOD',
  fireMetal: 'EARTH',
  metalWood: 'WATER',
  woodEarth: 'FIRE',
  earthWater: 'METAL',
};

function compileMacros(macros: YongshinMacro[]): Rule[] {
  const out: Rule[] = [];

  for (const m of macros ?? []) {
    switch (m.kind) {
      case 'roleBoost': {
        const idPrefix = m.idPrefix ?? 'YONGSHIN_ROLEBOOST';
        const explainTpl = m.explainTemplate ?? 'Role boost: {role} 요소({element}) 보정';
        const tags = m.tags;

        for (const e of ELEMENT_ORDER) {
          const whenRole: Expr = { op: 'eq', args: [{ var: `dayMasterRoleByElement.${e}` }, m.role] };
          const when = andAll([m.when ?? null, whenRole].filter(Boolean) as Expr[]);

          out.push({
            id: `${idPrefix}_${m.role}_${e}`,
            when,
            score: { [`yongshin.${e}`]: m.bonus },
            explain: renderTemplate(explainTpl, { role: m.role, element: e }),
            tags,
          });
        }
        break;
      }

      case 'monthTenGodRoleBias': {
        const idPrefix = (m as any).idPrefix ?? 'YONGSHIN_MONTH_ROLEBIAS';
        const explainTpl = (m as any).explainTemplate ?? 'Month({basis}) tenGod bias: {role} 요소({element}) 보정';
        const tags = (m as any).tags;

        const basis = (m as any).basis === 'gyeok' ? 'gyeok' : 'main';
        const monthVar = basis === 'gyeok' ? 'month.gyeok.tenGod' : 'month.mainTenGod';

        const ROLE_TENGODS: Record<string, string[]> = {
          OFFICER: ['JEONG_GWAN', 'PYEON_GWAN'],
          WEALTH: ['JEONG_JAE', 'PYEON_JAE'],
          OUTPUT: ['SIK_SHIN', 'SANG_GWAN'],
          RESOURCE: ['JEONG_IN', 'PYEON_IN'],
          COMPANION: ['BI_GYEON', 'GEOB_JAE'],
        };

        const bonuses: any = (m as any).bonuses ?? {};

        for (const [role, tenGods] of Object.entries(ROLE_TENGODS)) {
          const bonus = bonuses?.[role];
          if (typeof bonus !== 'number' || !Number.isFinite(bonus) || bonus === 0) continue;

          for (const e of ELEMENT_ORDER) {
            const whenRole: Expr = { op: 'eq', args: [{ var: `dayMasterRoleByElement.${e}` }, role] };
            const whenMonth: Expr = { op: 'in', args: [{ var: monthVar }, tenGods as any] };
            const when = andAll([(m as any).when ?? null, whenRole, whenMonth].filter(Boolean) as Expr[]);

            out.push({
              id: `${idPrefix}_${basis}_${role}_${e}`,
              when,
              score: { [`yongshin.${e}`]: bonus },
              explain: renderTemplate(explainTpl, { basis, role, element: e }),
              tags,
            });
          }
        }

        break;
      }


      case 'oneElementDominance': {
        const idPrefix = m.idPrefix ?? 'YONGSHIN_ONEELEMENT';
        const explainTpl = m.explainTemplate ?? '일행득기/专旺({element}) 신호 → dominant element 보정';
        const tags = m.tags;

        const minFactor = typeof m.minFactor === 'number' && Number.isFinite(m.minFactor) ? m.minFactor : 0.45;
        const bonus = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 1.0;

        const factorSel = m.factor === 'zhuanwang' || m.factor === 'raw' ? m.factor : 'raw';
        const rawVar = 'patterns.elements.oneElement.factor';
        const zwVar = 'patterns.elements.oneElement.zhuanwangFactor';
        const factorExpr: Expr =
          factorSel === 'zhuanwang'
            ? {
                op: 'if',
                args: [{ op: 'gt', args: [{ var: zwVar }, 0] }, { var: zwVar }, { var: rawVar }],
              }
            : { var: rawVar };
        const elVar = 'patterns.elements.oneElement.element';

        const dmMatch = (e: string): Expr | null => (m.requireDayMasterMatch ? { op: 'eq', args: [{ var: 'dayMaster.element' }, e] } : null);
        const strictOne = m.requireIsOneElement ? ({ op: 'eq', args: [{ var: 'patterns.elements.oneElement.isOneElement' }, true] } as Expr) : null;
        const qGuards = monthQualityGuards((m as any).monthQuality);

        for (const e of ELEMENT_ORDER) {
          const when = andAll(
            [
              m.when ?? null,
              { op: 'gte', args: [factorExpr, minFactor] },
              { op: 'eq', args: [{ var: elVar }, e] },
              dmMatch(e),
              strictOne,
              ...qGuards,
            ].filter(Boolean) as Expr[],
          );

          out.push({
            id: `${idPrefix}_${e}`,
            when,
            score: { [`yongshin.${e}`]: { op: 'mul', args: [factorExpr, bonus] } },
            explain: renderTemplate(explainTpl, { element: e }),
            tags,
          });
        }

        break;
      }

      case 'transformationsBest': {
        const idPrefix = m.idPrefix ?? 'YONGSHIN_TRANSFORM';
        const explainTpl = m.explainTemplate ?? '합화(化气) best(→{element}) 신호 → 변환 오행 보정';
        const tags = m.tags;

        const minFactor = typeof m.minFactor === 'number' && Number.isFinite(m.minFactor) ? m.minFactor : 0.4;
        const bonus = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 1.2;

        const factorSel = m.factor === 'effective' || m.factor === 'huaqi' || m.factor === 'raw' ? m.factor : 'raw';
        const factorVar =
          factorSel === 'huaqi'
            ? 'patterns.transformations.best.huaqiFactor'
            : factorSel === 'effective'
              ? 'patterns.transformations.best.effectiveFactor'
              : 'patterns.transformations.best.factor';
        const elVar = 'patterns.transformations.best.resultElement';

        const dayInvCond = (m as any).requireDayMasterInvolved
          ? ({ op: 'eq', args: [{ var: 'patterns.transformations.best.huaqiDetails.flags.dayInvolved' }, true] } as Expr)
          : null;
        const qGuards = monthQualityGuards((m as any).monthQuality);

        for (const e of ELEMENT_ORDER) {
          const when = andAll(
            [
              m.when ?? null,
              { op: 'gte', args: [{ var: factorVar }, minFactor] },
              { op: 'eq', args: [{ var: elVar }, e] },
              dayInvCond,
              ...qGuards,
            ].filter(Boolean) as Expr[],
          );

          out.push({
            id: `${idPrefix}_${e}`,
            when,
            score: { [`yongshin.${e}`]: { op: 'mul', args: [{ var: factorVar }, bonus] } },
            explain: renderTemplate(explainTpl, { element: e, pair: 'best' }),
            tags,
          });
        }

        break;
      }

      case 'elementByVar': {
        const idPrefix = (m as any).idPrefix ?? 'YONGSHIN_ELEMBYVAR';
        const explainTpl = (m as any).explainTemplate ?? 'var element({elementVar}) + factor({factorVar}) → {element} 보정';
        const tags = (m as any).tags;

        const elementVar = String((m as any).elementVar ?? '').trim();
        const factorVar = String((m as any).factorVar ?? '').trim();
        if (!elementVar || !factorVar) break;

        const minFactor = typeof (m as any).minFactor === 'number' && Number.isFinite((m as any).minFactor) ? (m as any).minFactor : 0;
        const bonus = typeof (m as any).bonus === 'number' && Number.isFinite((m as any).bonus) ? (m as any).bonus : 1.0;

        const safe = (s: string) => s.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 60);
        const baseId = `${idPrefix}_${safe(elementVar)}_${safe(factorVar)}`;

        for (const e of ELEMENT_ORDER) {
          const when = andAll([
            (m as any).when ?? null,
            { op: 'gte', args: [{ var: factorVar }, minFactor] },
            { op: 'eq', args: [{ var: elementVar }, e] },
          ].filter(Boolean) as Expr[]);

          out.push({
            id: `${baseId}_${e}`,
            when,
            score: { [`yongshin.${e}`]: { op: 'mul', args: [{ var: factorVar }, bonus] } },
            explain: renderTemplate(explainTpl, { element: e, elementVar, factorVar }),
            tags,
          });
        }

        break;
      }


      case 'elementBoost': {
        const idPrefix = m.idPrefix ?? 'YONGSHIN_ELEMENTBOOST';
        const explainTpl = m.explainTemplate ?? 'Element boost: {element} 보정';
        const tags = m.tags;

        for (const e of m.elements ?? []) {
          if (!ELEMENT_ORDER.includes(e)) continue;
          out.push({
            id: `${idPrefix}_${e}`,
            when: m.when ?? true,
            score: { [`yongshin.${e}`]: m.bonus },
            explain: renderTemplate(explainTpl, { element: e }),
            tags,
          });
        }
        break;
      }

      case 'tongguanBridge': {
        const idPrefix = m.idPrefix ?? 'YONGSHIN_TONGGUAN';
        const explainTpl = m.explainTemplate ?? '통관({pair}) 구조 → 브리지 오행({bridge}) 보정';
        const tags = m.tags;

        const intensityField = m.intensityField === 'weightedIntensity' ? 'weightedIntensity' : 'intensity';
        const minIntensityConst = typeof m.minIntensity === 'number' && Number.isFinite(m.minIntensity) ? m.minIntensity : 0.35;
        const bonusConst = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 0.8;

        const minIntensityExpr: Expr =
          typeof m.minIntensityVar === 'string' && m.minIntensityVar.trim() ? { var: m.minIntensityVar.trim() } : minIntensityConst;
        const bonusExpr: Expr = typeof m.bonusVar === 'string' && m.bonusVar.trim() ? { var: m.bonusVar.trim() } : bonusConst;

        const pairs: Array<'waterFire' | 'fireMetal' | 'metalWood' | 'woodEarth' | 'earthWater'> =
          (m.pairs && m.pairs.length ? m.pairs : ['waterFire', 'fireMetal', 'metalWood', 'woodEarth', 'earthWater']) as any;

        for (const p of pairs) {
          const bridge = BRIDGE_BY_PAIR[p];
          const intensityVar = `tongguan.pairs.${p}.${intensityField}`;
          const when = andAll([m.when ?? null, { op: 'gte', args: [{ var: intensityVar }, minIntensityExpr] }].filter(Boolean) as Expr[]);

          out.push({
            id: `${idPrefix}_${p}_${bridge}`,
            when,
            score: { [`yongshin.${bridge}`]: { op: 'mul', args: [{ var: intensityVar }, bonusExpr] } },
            explain: renderTemplate(explainTpl, { pair: p, bridge }),
            tags,
          });
        }

        break;
      }

      case 'followWeakPressure': {
        const idPrefix = m.idPrefix ?? 'YONGSHIN_FOLLOW_WEAK';
        const explainTpl = m.explainTemplate ?? '종격/순세(약) 후보 → pressure-role 오행({element}) 추종 보정';
        const tags = m.tags;

        const weakThreshold = typeof m.weakThreshold === 'number' && Number.isFinite(m.weakThreshold) ? m.weakThreshold : -0.78;
        const minDominanceRatio = typeof m.minDominanceRatio === 'number' && Number.isFinite(m.minDominanceRatio) ? m.minDominanceRatio : 2.2;
        const bonus = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 2.0;
        const roles = (m.roles && m.roles.length ? m.roles : (['OUTPUT', 'WEALTH', 'OFFICER'] as const)).slice();

        const ratioExpr: Expr = {
          op: 'div',
          args: [{ var: 'strength.pressure' }, { op: 'max', args: [{ var: 'strength.support' }, 1e-6] }],
        };

        const followCond: Expr = andAll(
          [
            { op: 'lt', args: [{ var: 'strength.index' }, weakThreshold] },
            { op: 'gt', args: [ratioExpr, minDominanceRatio] },
            m.when ?? null,
          ].filter(Boolean) as Expr[],
        );

        for (const e of ELEMENT_ORDER) {
          const roleVar = `dayMasterRoleByElement.${e}`;
          const when = andAll([followCond, { op: 'in', args: [{ var: roleVar }, roles as any] }]);

          // Smooth: boost proportional to existing dominance
          const scoreExpr: Expr = { op: 'mul', args: [{ var: `elements.normalized.${e}` }, bonus] };

          out.push({
            id: `${idPrefix}_${e}`,
            when,
            score: { [`yongshin.${e}`]: scoreExpr },
            explain: renderTemplate(explainTpl, { element: e }),
            tags,
          });
        }

        break;
      }

      case 'followJonggyeok': {
        const idPrefix = m.idPrefix ?? 'YONGSHIN_FOLLOW_JONGGYEOK';
        const explainTpl = m.explainTemplate ?? '종격(从格) 패턴({mode}) → {role} 역할 오행({element}) 추종 보정';
        const tags = m.tags;

        const minFactor = typeof m.minFactor === 'number' && Number.isFinite(m.minFactor) ? m.minFactor : 0.55;
        const bonus = typeof m.bonus === 'number' && Number.isFinite(m.bonus) ? m.bonus : 1.8;

        const factorSel = m.factor === 'raw' || m.factor === 'potential' || m.factor === 'jonggyeok' ? m.factor : 'jonggyeok';
        const modeSel = m.mode === 'PRESSURE' || m.mode === 'SUPPORT' || m.mode === 'ANY' ? m.mode : 'ANY';
        const targetSel = m.target === 'element' || m.target === 'role' ? m.target : 'role';
        const scaleSel = m.scaleBy === 'none' || m.scaleBy === 'share' ? m.scaleBy : 'share';

        const enabledCond: Expr = { op: 'eq', args: [{ var: 'patterns.follow.enabled' }, true] };

        const modeVar = 'patterns.follow.mode';
        const domRoleVar = 'patterns.follow.dominantRole';
        const domElVar = 'patterns.follow.dominantElement';

        const rawVar = 'patterns.follow.potentialRaw';
        const potVar = 'patterns.follow.potential';
        const jongVar = 'patterns.follow.jonggyeokFactor';

        const factorExpr: Expr =
          factorSel === 'raw'
            ? { var: rawVar }
            : factorSel === 'potential'
              ? { var: potVar }
              : {
                  op: 'if',
                  args: [{ op: 'gt', args: [{ var: jongVar }, 0] }, { var: jongVar }, { var: potVar }],
                };

        const modeCond: Expr =
          modeSel === 'PRESSURE'
            ? { op: 'eq', args: [{ var: modeVar }, 'PRESSURE'] }
            : modeSel === 'SUPPORT'
              ? { op: 'eq', args: [{ var: modeVar }, 'SUPPORT'] }
              : { op: 'ne', args: [{ var: modeVar }, 'NONE'] };

        const typeVar = 'patterns.follow.followType';
        const types = Array.isArray((m as any).types) ? ((m as any).types as any[]) : [];
        const exTypes = Array.isArray((m as any).excludeTypes) ? ((m as any).excludeTypes as any[]) : [];
        const typeCond: Expr | null = types.length ? ({ op: 'in', args: [{ var: typeVar }, types as any] } as Expr) : null;
        const exTypeCond: Expr | null = exTypes.length
          ? ({ op: 'not', args: [{ op: 'in', args: [{ var: typeVar }, exTypes as any] }] } as Expr)
          : null;

        const minSubtype = typeof (m as any).minSubtypeConfidence === 'number' && Number.isFinite((m as any).minSubtypeConfidence) ? (m as any).minSubtypeConfidence : null;
        const subtypeCond: Expr | null =
          minSubtype != null
            ? ({ op: 'gte', args: [{ var: 'patterns.follow.followTenGodSplit.confidence' }, minSubtype] } as Expr)
            : null;

        const qGuards = monthQualityGuards((m as any).monthQuality);

        const baseWhen = andAll(
          [
            m.when ?? null,
            enabledCond,
            modeCond,
            { op: 'gte', args: [factorExpr, minFactor] },
            typeCond,
            exTypeCond,
            subtypeCond,
            ...qGuards,
          ].filter(Boolean) as Expr[],
        );

        const scaleOf = (e: string): Expr => (scaleSel === 'share' ? { var: `elements.normalized.${e}` } : 1);

        if (targetSel === 'element') {
          for (const e of ELEMENT_ORDER) {
            const when = andAll([baseWhen, { op: 'eq', args: [{ var: domElVar }, e] }]);

            const scoreExpr: Expr = { op: 'mul', args: [factorExpr, bonus, scaleOf(e)] };

            out.push({
              id: `${idPrefix}_ELEMENT_${e}`,
              when,
              score: { [`yongshin.${e}`]: scoreExpr },
              explain: renderTemplate(explainTpl, { mode: modeSel, role: 'dominantElement', element: e }),
              tags,
            });
          }
          break;
        }

        // targetSel === 'role'
        const ROLES: Array<'COMPANION' | 'RESOURCE' | 'OUTPUT' | 'WEALTH' | 'OFFICER'> = ['COMPANION', 'RESOURCE', 'OUTPUT', 'WEALTH', 'OFFICER'];

        for (const r of ROLES) {
          for (const e of ELEMENT_ORDER) {
            const when = andAll([
              baseWhen,
              { op: 'eq', args: [{ var: domRoleVar }, r] },
              { op: 'eq', args: [{ var: `dayMasterRoleByElement.${e}` }, r] },
            ]);

            const scoreExpr: Expr = { op: 'mul', args: [factorExpr, bonus, scaleOf(e)] };

            out.push({
              id: `${idPrefix}_${r}_${e}`,
              when,
              score: { [`yongshin.${e}`]: scoreExpr },
              explain: renderTemplate(explainTpl, { mode: modeSel, role: r, element: e }),
              tags,
            });
          }
        }

        // SUPPORT refinement: also boost the “other” support role by a fraction.
        const includeOther = (m as any).includeOtherSupportRole !== false;
        const otherScale = typeof (m as any).otherSupportScale === 'number' && Number.isFinite((m as any).otherSupportScale) ? (m as any).otherSupportScale : 0.5;

        const supportOnly = { op: 'eq', args: [{ var: modeVar }, 'SUPPORT'] };

        if (includeOther && (modeSel === 'SUPPORT' || modeSel === 'ANY')) {
          // If dominantRole is COMPANION, also boost RESOURCE; if dominantRole is RESOURCE, also boost COMPANION.
          const pairs: Array<{ dominant: 'COMPANION' | 'RESOURCE'; other: 'COMPANION' | 'RESOURCE' }> = [
            { dominant: 'COMPANION', other: 'RESOURCE' },
            { dominant: 'RESOURCE', other: 'COMPANION' },
          ];

          for (const p of pairs) {
            for (const e of ELEMENT_ORDER) {
              const when = andAll([
                baseWhen,
                supportOnly,
                { op: 'eq', args: [{ var: domRoleVar }, p.dominant] },
                { op: 'eq', args: [{ var: `dayMasterRoleByElement.${e}` }, p.other] },
              ]);

              const scoreExpr: Expr = { op: 'mul', args: [factorExpr, bonus, scaleOf(e), otherScale] };

              out.push({
                id: `${idPrefix}_OTHER_${p.dominant}_TO_${p.other}_${e}`,
                when,
                score: { [`yongshin.${e}`]: scoreExpr },
                explain: renderTemplate(explainTpl, { mode: modeSel, role: `${p.other}(via ${p.dominant})`, element: e }),
                tags,
              });
            }
          }
        }

        break;
      }

      case 'customRules':
        out.push(...(m.rules ?? []));
        break;

      default: {
        const _exhaustive: never = m;
        throw new Error(`Unknown yongshin macro kind: ${(m as any).kind}`);
      }
    }
  }

  return out;
}

function applyMode(baseRules: Rule[], compiled: Rule[], mode: YongshinRuleSpecMode): Rule[] {
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

export function compileYongshinRuleSpec(specInput: YongshinRuleSpec | YongshinRuleSpec[]): RuleSet {
  const specs = Array.isArray(specInput) ? specInput : [specInput];
  if (specs.length === 0) return DEFAULT_YONGSHIN_RULESET;

  let rules: Rule[] = [];
  let meta: Pick<RuleSet, 'id' | 'version' | 'description'> = {
    id: specs[0]?.id ?? 'yongshin.spec',
    version: specs[0]?.version ?? '0.1',
    description: specs[0]?.description,
  };

  let first = true;
  for (const s of specs) {
    const compiled = compileMacros(s.macros ?? []);
    if (first) {
      const base = s.base ?? 'default';
      const baseRules = base === 'default' ? DEFAULT_YONGSHIN_RULESET.rules : [];
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
