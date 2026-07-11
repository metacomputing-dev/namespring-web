import type { AnalysisBundle, EngineConfig, FourPillars, SajuRequest, SummaryReport, TenGod } from './types.js';
import { normalizeConfig } from './config.js';
import { sha256Hex } from '../utils/hash.js';
import { stableStringify } from '../utils/json.js';
import { deepFreeze } from '../utils/deepMerge.js';
import { buildGraph } from '../graph/graphFactory.js';
import { evaluate } from '../graph/evaluator.js';
import { normalizeRequest } from '../calendar/normalizeRequest.js';
import { toBranchView, toHiddenStemTenGodView, toHiddenStemView, toPillarView, toStemView } from './views.js';
import { packAnalysisBundleZip } from '../artifacts/analysisZip.js';
import { ENGINE_NAME, ENGINE_VERSION } from '../meta/version.js';
import type { FortuneTimeline } from '../fortune/types.js';
import type { DecadeYearRelationEntry, FortuneRelationEntry, FortuneRelationsTimeline } from '../fortune/relations.js';
import type { StrengthFacts } from '../rules/facts.js';
import type { YongshinResult } from '../rules/yongshin.js';
import type { GyeokgukResult } from '../rules/gyeokguk.js';
import type { ShinsalResult } from '../rules/shinsal.js';
import type { Element, PillarIdx } from '../core/cycle.js';
import { branchYinYang, stemYinYang } from '../core/cycle.js';
import { ALL_ELEMENTS, SEASONAL_STATE_KO, monthCommandElement, seasonalStatesForMonth } from '../core/seasonalStates.js';
import type { DetectedRelation } from '../core/branchRelations.js';
import type { HiddenStem } from '../core/hiddenStems.js';
import type { ElementDistribution } from '../core/elementDistribution.js';
import type { StemRelation } from '../core/stemRelations.js';

export interface Engine {
  config: EngineConfig;
  analyze(request: SajuRequest): AnalysisBundle;
}

function readAnalysisZipStrategy(config: EngineConfig): {
  explicit: boolean;
  enabled: boolean;
  key?: string;
  prettyJson?: boolean;
  include?: any[];
  level?: number;
  narration?: { language?: 'ko' | 'en'; maxShinsal?: number };
} {
  const raw: any = (config.strategies as any)?.artifacts?.analysisZip ?? (config.strategies as any)?.artifacts?.zip;
  if (!raw || typeof raw !== 'object') return { explicit: false, enabled: false };

  const narr: any = raw.narration;
  const narration = narr && typeof narr === 'object'
    ? {
        language: (narr.language === 'en' ? ('en' as const) : narr.language === 'ko' ? ('ko' as const) : undefined),
        maxShinsal: (typeof narr.maxShinsal === 'number' ? (narr.maxShinsal as number) : undefined),
      }
    : undefined;

  return {
    explicit: true,
    enabled: raw.enabled === true,
    key: typeof raw.key === 'string' ? raw.key : undefined,
    prettyJson: typeof raw.prettyJson === 'boolean' ? raw.prettyJson : undefined,
    include: Array.isArray(raw.include) ? raw.include : undefined,
    level: typeof raw.level === 'number' ? raw.level : undefined,
    narration,
  };
}

type HiddenStemTenGod = HiddenStem & { tenGod: TenGod };

function toFortuneRelationEntryView(entry: FortuneRelationEntry) {
  return {
    luckKind: entry.luckKind,
    index: entry.index,
    solarYear: entry.solarYear,
    monthOrder: entry.monthOrder,
    localDate: entry.localDate,
    pillar: toPillarView(entry.pillar),
    stemRelations: entry.stemRelations.map((relation) => ({
      type: relation.type,
      members: relation.members.map(toStemView),
      resultElement: relation.resultElement,
      natalPositions: relation.natalPositions,
      luckPosition: relation.luckPosition,
    })),
    branchRelations: entry.branchRelations.map((relation) => ({
      type: relation.type,
      members: relation.members.map(toBranchView),
      natalPositions: relation.natalPositions,
      luckPosition: relation.luckPosition,
    })),
  };
}
function toFortuneDecadeYearRelationEntryView(entry: DecadeYearRelationEntry) {
  return {
    luckKind: entry.luckKind,
    solarYear: entry.solarYear,
    decadeIndex: entry.decadeIndex,
    decadePillar: toPillarView(entry.decadePillar),
    yearPillar: toPillarView(entry.yearPillar),
    stemRelations: entry.stemRelations.map((relation) => ({
      type: relation.type,
      members: relation.members.map(toStemView),
      resultElement: relation.resultElement,
      luckPositions: relation.luckPositions,
    })),
    branchRelations: entry.branchRelations.map((relation) => ({
      type: relation.type,
      members: relation.members.map(toBranchView),
      luckPositions: relation.luckPositions,
    })),
  };
}

export function createEngine(config: Partial<EngineConfig> = {}): Engine {
  // The engine and its compiled-policy caches rely on configuration identity
  // being stable for the full engine lifetime. Own and freeze the effective
  // snapshot before exposing it or using it as a cache key.
  const normalizedConfig = deepFreeze(normalizeConfig(config));
  const configDigest = `sha256:${sha256Hex(stableStringify(normalizedConfig))}`;


  // Build the calculation graph once per engine instance (pure DAG).
  // This avoids rebuilding NodeSpecs on every analyze() call.
  const graph = buildGraph();
  return {
    config: normalizedConfig,

    analyze(request: SajuRequest): AnalysisBundle {
      const { request: normalizedRequest, parsed } = normalizeRequest(request);

      const ctx = {
        request: normalizedRequest,
        parsed,
        config: normalizedConfig,
      };


      const wanted: string[] = [];
      if (normalizedConfig.toggles.pillars) {
        wanted.push('pillars.year', 'pillars.month', 'pillars.day', 'pillars.hour');
      }
      if (normalizedConfig.toggles.tenGods) {
        wanted.push('tenGods.stems');
      }
      if (normalizedConfig.toggles.hiddenStems) {
        wanted.push('hiddenStems.branches');
        if (normalizedConfig.toggles.tenGods) wanted.push('tenGods.hiddenStems');
      }
      if (normalizedConfig.toggles.elementDistribution) {
        wanted.push('elements.distribution');
        // PR-5 (감사 B448) 옵션 틀: 합충 보정 분포 — 기본 off.
        if ((normalizedConfig.strategies as any)?.elements?.interactionAdjusted === true) {
          wanted.push('elements.distributionAdjusted');
        }
      }
      if (normalizedConfig.toggles.lifeStages) {
        wanted.push('lifeStages.pillars');
      }
      if (normalizedConfig.toggles.stemRelations) {
        wanted.push('relations.stems');
      }
      if (normalizedConfig.toggles.relations) {
        wanted.push('relations.branches');
      }

      if (normalizedConfig.toggles.fortune) {
        wanted.push('fortune.timeline', 'fortune.relations');
      }

      if (normalizedConfig.toggles.rules) {
        wanted.push('strength.index', 'rules.yongshin', 'rules.gyeokguk', 'rules.shinsal');
      }

      const { results, trace } = evaluate(graph, ctx, wanted);

      const summary: SummaryReport = {};

      if (normalizedConfig.toggles.pillars) {
        const year = results.get('pillars.year') as PillarIdx;
        const month = results.get('pillars.month') as PillarIdx;
        const day = results.get('pillars.day') as PillarIdx;
        const hour = results.get('pillars.hour') as PillarIdx;

        summary.pillars = {
          year: toPillarView(year),
          month: toPillarView(month),
          day: toPillarView(day),
          hour: toPillarView(hour),
        };

        // PR-10-1 (감사 B434 선행): 왕상휴수사 — 월지 당령 기준 오행별 계절 상태.
        // 순수 조견(월지만의 함수)이라 그래프 노드 없이 직접 산출한다. additive 표면 —
        // springLegacy 재방출은 별도 결정(스냅샷 파급)이므로 여기서는 saju-ts summary까지만.
        const states = seasonalStatesForMonth(month.branch);
        const statesKo = {} as Record<Element, string>;
        for (const el of ALL_ELEMENTS) statesKo[el] = SEASONAL_STATE_KO[states[el]];
        summary.seasonalStates = {
          command: monthCommandElement(month.branch),
          states,
          statesKo,
        };

        // PR-12-4 (감사 C6): 음양 균형 — 8글자 체(體) 기준 개수 (만세력 기본 표기 축).
        // core YinYangScore(가중 집계)와 별개로, 표기용은 단순 개수가 표준이다.
        const yyStems = { yang: 0, yin: 0 };
        const yyBranches = { yang: 0, yin: 0 };
        for (const p of [year, month, day, hour]) {
          yyStems[stemYinYang(p.stem) === 'YANG' ? 'yang' : 'yin'] += 1;
          yyBranches[branchYinYang(p.branch) === 'YANG' ? 'yang' : 'yin'] += 1;
        }
        const yangTotal = yyStems.yang + yyBranches.yang;
        const yinTotal = yyStems.yin + yyBranches.yin;
        summary.yinYangBalance = {
          yang: yangTotal,
          yin: yinTotal,
          stems: yyStems,
          branches: yyBranches,
          dominant: yangTotal > yinTotal ? 'YANG' : yinTotal > yangTotal ? 'YIN' : 'EVEN',
        };
      }

      if (normalizedConfig.toggles.tenGods) {
        summary.tenGods = results.get('tenGods.stems') as SummaryReport['tenGods'];
      }

      if (normalizedConfig.toggles.hiddenStems) {
        const hs = results.get('hiddenStems.branches') as FourPillars<HiddenStem[]>;
        summary.hiddenStems = {
          year: hs.year.map(toHiddenStemView),
          month: hs.month.map(toHiddenStemView),
          day: hs.day.map(toHiddenStemView),
          hour: hs.hour.map(toHiddenStemView),
        };

        if (normalizedConfig.toggles.tenGods) {
          const tg = results.get('tenGods.hiddenStems') as FourPillars<HiddenStemTenGod[]>;
          summary.tenGodsHiddenStems = {
            year: tg.year.map(toHiddenStemTenGodView),
            month: tg.month.map(toHiddenStemTenGodView),
            day: tg.day.map(toHiddenStemTenGodView),
            hour: tg.hour.map(toHiddenStemTenGodView),
          };
        }
      }

      if (normalizedConfig.toggles.elementDistribution) {
        summary.elementDistribution = results.get('elements.distribution') as ElementDistribution;
        // PR-5 (감사 B448) 옵션 틀: 옵트인 시에만 additive 노출 — 기본 분포·소비자 불변.
        if ((normalizedConfig.strategies as any)?.elements?.interactionAdjusted === true) {
          (summary as any).elementDistributionAdjusted = results.get('elements.distributionAdjusted');
        }
      }

      if (normalizedConfig.toggles.lifeStages) {
        summary.lifeStages = results.get('lifeStages.pillars') as SummaryReport['lifeStages'];
      }

      if (normalizedConfig.toggles.stemRelations) {
        const rels = results.get('relations.stems') as StemRelation[];
        summary.stemRelations = rels.map((r) => ({
          type: r.type,
          members: r.members.map(toStemView),
          resultElement: r.resultElement,
        }));
      }

      if (normalizedConfig.toggles.relations) {
        const relations = results.get('relations.branches') as DetectedRelation[];
        summary.relations = relations.map((r) => ({
          type: r.type,
          members: r.members.map(toBranchView),
        }));
      }

      if (normalizedConfig.toggles.fortune) {
        const ft = results.get('fortune.timeline') as FortuneTimeline;

        const fortuneRelations = results.get('fortune.relations') as FortuneRelationsTimeline;

        summary.fortune = {
          start: {
            direction: ft.start.direction,
            boundary: ft.start.boundary ? { id: ft.start.boundary.id, utcMs: ft.start.boundary.utcMs } : null,
            deltaMs: ft.start.deltaMs,
            startAgeYears: ft.start.startAgeYears,
            startAgeDisplay: ft.start.startAgeDisplay,
            ageDisplay: ft.start.ageDisplay,
            ageDisplayLabel: ft.start.ageDisplayLabel,
            startAgeParts: ft.start.startAgeParts,
            startUtcMsApprox: ft.start.startUtcMsApprox,
            formula: ft.start.formula,
          },
          decades: ft.decades.map((d) => ({
            index: d.index,
            startAgeYears: d.startAgeYears,
            endAgeYears: d.endAgeYears,
            displayStartAge: d.displayStartAge,
            displayEndAge: d.displayEndAge,
            pillar: toPillarView(d.pillar),
            startUtcMs: d.startUtcMs,
            endUtcMs: d.endUtcMs,
          })),
          years: ft.years.slice(0, 30).map((y) => ({
            solarYear: y.solarYear,
            pillar: toPillarView(y.pillar),
            startUtcMs: y.startUtcMs,
            endUtcMs: y.endUtcMs,
            approxStartAgeYears: y.approxStartAgeYears,
            approxEndAgeYears: y.approxEndAgeYears,
          })),
          months: ft.months?.slice(0, 24).map((m) => ({
            solarYear: m.solarYear,
            monthOrder: m.monthOrder,
            startJie: m.startJie,
            pillar: toPillarView(m.pillar),
            startUtcMs: m.startUtcMs,
            endUtcMs: m.endUtcMs,
            approxStartAgeYears: m.approxStartAgeYears,
            approxEndAgeYears: m.approxEndAgeYears,
          })),
          days: ft.days?.slice(0, 60).map((d) => ({
            localDate: d.localDate,
            pillar: toPillarView(d.pillar),
            startUtcMs: d.startUtcMs,
            endUtcMs: d.endUtcMs,
            approxStartAgeYears: d.approxStartAgeYears,
            approxEndAgeYears: d.approxEndAgeYears,
          })),
          relations: {
            decades: fortuneRelations.decades.map(toFortuneRelationEntryView),
            years: fortuneRelations.years.slice(0, 30).map(toFortuneRelationEntryView),
            months: fortuneRelations.months?.slice(0, 24).map(toFortuneRelationEntryView),
            days: fortuneRelations.days?.slice(0, 60).map(toFortuneRelationEntryView),
            decadeYears: fortuneRelations.decadeYears.slice(0, 30).map(toFortuneDecadeYearRelationEntryView),
          },
        };
      }

      if (normalizedConfig.toggles.rules) {
        const strength = results.get('strength.index') as StrengthFacts;
        summary.strength = strength;

        const ys = results.get('rules.yongshin') as YongshinResult;
        summary.yongshin = {
          best: ys.best,
          ranking: ys.ranking,
          strengthIndex: ys.base.strengthIndex,
          consensus: ys.consensus,
          // [감사 A2·B6] 실제 지배 방법 — 레거시 추천 1위 type 유도용.
          primaryMethod: ys.primaryMethod,
          methodBreakdown: {
            balance: { deficiency: ys.base.deficiency, role: ys.base.role },
            climate: ys.base.climate,
            medicine: ys.base.medicine,
            tongguan: ys.base.tongguan,
            follow: ys.base.follow,
            johooTemplate: ys.base.johooTemplate,
            transformations: ys.base.transformations,
            oneElement: ys.base.oneElement,
            methodSelector: ys.base.methodSelector,
            effectiveWeights: ys.base.effectiveWeights,
            climateUrgency: ys.base.climateUrgency,
          },
        };

        const gg = results.get('rules.gyeokguk') as GyeokgukResult;
        summary.gyeokguk = {
          best: gg.best,
          ranking: gg.ranking,
          scores: gg.scores,
          basis: {
            monthMainTenGod: gg.basis.monthMainTenGod,
            monthGyeokTenGod: gg.basis.monthGyeokTenGod,
            monthGyeokMethod: gg.basis.monthGyeokMethod,
            monthGyeokSelectionRule: gg.basis.monthGyeokSelectionRule,
            monthGyeokQuality: gg.basis.monthGyeokQuality as Record<string, unknown> | undefined,
            competition: gg.basis.competition as Record<string, unknown> | undefined,
            seongpaeScoreAdjustment: gg.basis.seongpaeScoreAdjustment as Record<string, unknown> | undefined,
          },
          jonggyeokCandidates: gg.jonggyeokCandidates,
        };

        const ss = results.get('rules.shinsal') as ShinsalResult;

        // Legacy: branch-target only (kept stable)
        summary.shinsal = ss.detections
          .filter((d) => d.active !== false && d.targetKind === 'BRANCH' && typeof d.targetBranch === 'number')
          .map((d) => ({
            name: d.name,
            basedOn: d.basedOn,
            targetBranch: toBranchView(d.targetBranch!),
          }));

        // Extended: branch/stem/composite (forward-compatible)
        summary.shinsalHits = ss.detections.filter((d) => d.active !== false).map((d) => ({
          name: d.name,
          basedOn: d.basedOn,
          targetKind: d.targetKind,
          targetBranch: d.targetBranch != null ? toBranchView(d.targetBranch) : undefined,
          targetStem: d.targetStem != null ? toStemView(d.targetStem) : undefined,
          targetBranches: d.targetBranches ? d.targetBranches.map(toBranchView) : undefined,
          targetStems: d.targetStems ? d.targetStems.map(toStemView) : undefined,
          details: d.details,
          matchedPillars: d.matchedPillars,
          quality: d.quality,
          qualityWeight: d.qualityWeight,
          invalidated: d.invalidated,
          conditionPenalty: d.conditionPenalty,
          qualityReasons: d.qualityReasons,
        }));

        // Scores: keep only shinsal.* keys for quick ranking view
        summary.shinsalScores = Object.entries(ss.scores)
          .filter(([k]) => k.startsWith('shinsal.'))
          .map(([key, score]) => ({ key, score }))
          .sort((a, b) => b.score - a.score);

        // Quality-adjusted scores (derived from detections, not the DSL score map)
        summary.shinsalScoresAdjusted = Object.entries(ss.scoresAdjusted)
          .filter(([k]) => k.startsWith('shinsal.'))
          .map(([key, score]) => ({ key, score }))
          .sort((a, b) => b.score - a.score);
      }

      const bundle: AnalysisBundle = {
        apiVersion: '1',
        engine: {
          name: ENGINE_NAME,
          version: ENGINE_VERSION,
        },
        config: {
          schemaVersion: normalizedConfig.schemaVersion,
          digest: configDigest,
        },
        input: {
          normalizedRequest,
        },
        summary,
        report: {
          facts: Object.fromEntries(results.entries()),
          trace,
          diagnostics: {
            warnings: [],
            notes: [],
          },
        },
        artifacts: {},
      };

      // Optional: pack a stable artifacts zip for large/auxiliary structured data.
      // Controlled by `strategies.artifacts.analysisZip`.
      const zipStrategy = readAnalysisZipStrategy(normalizedConfig);
      if (zipStrategy.enabled) {
        const key = zipStrategy.key ?? 'analysis.zip';
        const opts = {
          prettyJson: zipStrategy.prettyJson,
          include: zipStrategy.include,
          level: zipStrategy.level,
          narration: zipStrategy.narration,
        };
        bundle.artifacts[key] = packAnalysisBundleZip(bundle, opts as any);
      }

      return bundle;
    },
  };
}
