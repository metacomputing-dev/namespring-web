import type { Graph, NodeSpec } from './types.js';
import type { PillarIdx } from '../core/cycle.js';
import type { EngineWeights, FourPillars, TenGod } from '../api/types.js';
import {
  calcDayPillar,
  calcHourPillar,
  calcMonthPillarFromOrder,
  calcYearPillarFromLiChunUtc,
  effectiveDayDate,
  liChunUtcMsFromBoundaries,
  monthOrderByPolicy,
} from '../calendar/pillars.js';
import type { JieBoundariesAround, SolarTermsAround } from '../calendar/solarTerms.js';
import { getSolarTermsAround, isJieTermId } from '../calendar/solarTerms.js';
import type { LocalDateTime } from '../calendar/iso.js';
import type { TrueSolarTimeCorrection } from '../calendar/trueSolarTime.js';
import { applyMinuteOffsetToLocalDateTime, computeTrueSolarTimeCorrection } from '../calendar/trueSolarTime.js';
import type { DetectedRelation } from '../core/branchRelations.js';
import { detectBranchRelations } from '../core/branchRelations.js';
import type { ElementDistribution } from '../core/elementDistribution.js';
import { elementDistributionFromPillars } from '../core/elementDistribution.js';
import type { HiddenStem } from '../core/hiddenStems.js';
import { hiddenStemsOfBranch } from '../core/hiddenStems.js';
import type { LifeStage, LifeStagePolicy } from '../core/lifeStage.js';
import { lifeStageOf } from '../core/lifeStage.js';
import type { StemRelation } from '../core/stemRelations.js';
import { detectStemRelations } from '../core/stemRelations.js';
import { tenGodOf } from '../core/tenGod.js';

import type { PillarsScoringResult } from '../core/scoring.js';
import { scorePillars } from '../core/scoring.js';

import type { FortuneTimeline } from '../fortune/types.js';
import { readFortunePolicy } from '../fortune/policy.js';
import { computeFortuneTimeline } from '../fortune/compute.js';

import type { RuleFacts, StrengthFacts } from '../rules/facts.js';
import { buildRuleFacts } from '../rules/facts.js';
import type { YongshinResult } from '../rules/yongshin.js';
import { computeYongshin } from '../rules/yongshin.js';
import type { GyeokgukResult } from '../rules/gyeokguk.js';
import { computeGyeokguk } from '../rules/gyeokguk.js';
import type { ShinsalResult } from '../rules/shinsal.js';
import { computeShinsal } from '../rules/shinsal.js';

function n<T>(spec: NodeSpec<T>): NodeSpec<T> {
  return spec;
}

function fp<T>(year: T, month: T, day: T, hour: T): FourPillars<T> {
  return { year, month, day, hour };
}

function readLifeStagePolicy(strategies: Record<string, unknown> | undefined): LifeStagePolicy {
  const raw: any = (strategies as any)?.lifeStages ?? (strategies as any)?.lifeStage ?? {};

  const earthRuleRaw = raw.earthRule ?? 'FOLLOW_FIRE';
  const earthRule = earthRuleRaw === 'FOLLOW_WATER' || earthRuleRaw === 'INDEPENDENT' || earthRuleRaw === 'FOLLOW_FIRE'
    ? earthRuleRaw
    : 'FOLLOW_FIRE';

  const yinReversalEnabled = raw.yinReversalEnabled ?? true;

  return { earthRule, yinReversalEnabled } as LifeStagePolicy;
}

export type LifeStageDetail = ReturnType<typeof lifeStageOf>;

export function buildGraph(): Graph {
  const nodes: NodeSpec<any>[] = [];

  // --- Inputs (normalized)
  nodes.push(
    n({
      id: 'time.localDateTime',
      deps: [],
      explain: 'ISO instant에서 추출한 로컬 날짜/시각(오프셋 포함).',
      compute: (ctx) => ctx.parsed.localDateTime,
    }),
  );

  nodes.push(
    n<number>({
      id: 'time.utcMs',
      deps: [],
      explain: 'ISO instant를 UTC 기준 epoch milliseconds로 변환한 값.',
      compute: (ctx) => ctx.parsed.utcMs,
    }),
  );

  // --- Policies
  nodes.push(
    n({
      id: 'policy.calendar',
      deps: [],
      explain: 'config.calendar 정책',
      compute: (ctx) => ctx.config.calendar,
    }),
  );

  // --- True solar time (optional)
  nodes.push(
    n<TrueSolarTimeCorrection>({
      id: 'time.trueSolarCorrection',
      deps: ['time.utcMs', 'time.localDateTime', 'policy.calendar'],
      formula: 'Δ(min) = 4*(lon-stdMeridian) + EoT',
      explain: '진태양시 보정(경도 보정 + 균시차). location.lon이 없으면 적용하지 않는다.',
      compute: (ctx, get) => {
        const utcMs = get<number>('time.utcMs');
        const ldt = get<LocalDateTime>('time.localDateTime');
        const cal = get<any>('policy.calendar');
        return computeTrueSolarTimeCorrection({
          utcMs,
          offsetMinutes: ldt.offsetMinutes,
          location: ctx.request.location,
          policy: cal.trueSolarTime,
        });
      },
    }),
  );

  nodes.push(
    n<LocalDateTime>({
      id: 'time.solarLocalDateTime',
      deps: ['time.localDateTime', 'time.trueSolarCorrection'],
      explain: '진태양시 보정이 적용된 “태양시” 로컬 dateTime(표시/경계 판정용).',
      compute: (_ctx, get) => {
        const ldt = get<LocalDateTime>('time.localDateTime');
        const c = get<TrueSolarTimeCorrection>('time.trueSolarCorrection');
        const delta = c.totalCorrectionMinutes ?? 0;
        if (!c.applied || !Number.isFinite(delta) || delta === 0) return ldt;
        return applyMinuteOffsetToLocalDateTime(ldt, delta);
      },
    }),
  );

  nodes.push(
    n<LocalDateTime>({
      id: 'time.localDateTimeForDay',
      deps: ['time.localDateTime', 'time.solarLocalDateTime', 'policy.calendar'],
      explain: '일주/일경계 계산에 사용할 로컬 dateTime(trueSolarTime.applyTo 정책 반영).',
      compute: (_ctx, get) => {
        const civil = get<LocalDateTime>('time.localDateTime');
        const solar = get<LocalDateTime>('time.solarLocalDateTime');
        const cal = get<any>('policy.calendar');
        const t = cal.trueSolarTime;
        const applyTo = t?.applyTo ?? 'hourOnly';
        return t?.enabled && applyTo === 'dayAndHour' ? solar : civil;
      },
    }),
  );

  nodes.push(
    n<LocalDateTime>({
      id: 'time.localDateTimeForHour',
      deps: ['time.localDateTime', 'time.solarLocalDateTime', 'policy.calendar'],
      explain: '시주/시지 경계 판정에 사용할 로컬 dateTime(trueSolarTime.enabled 반영).',
      compute: (_ctx, get) => {
        const civil = get<LocalDateTime>('time.localDateTime');
        const solar = get<LocalDateTime>('time.solarLocalDateTime');
        const cal = get<any>('policy.calendar');
        const t = cal.trueSolarTime;
        const applyTo = t?.applyTo ?? 'hourOnly';
        const useSolar = !!t?.enabled && (applyTo === 'hourOnly' || applyTo === 'dayAndHour');
        return useSolar ? solar : civil;
      },
    }),
  );

  nodes.push(
    n<JieBoundariesAround | null>({
      id: 'calendar.jieBoundariesAround',
      deps: ['calendar.solarTermsAround'],
      explain: '월/연 경계 계산용 12절(節) 시각(UTC). 24절기 결과에서 “절(節)”만 필터링한 목록(baseYear±1 포함).',
      compute: (_ctx, get) => {
        const st = get<SolarTermsAround | null>('calendar.solarTermsAround');
        if (!st) return null;
        return {
          baseYear: st.baseYear,
          method: st.method,
          terms: st.terms.filter((t) => isJieTermId(t.id)),
        } as JieBoundariesAround;
      },
    }),
  );

  nodes.push(
    n<SolarTermsAround | null>({
      id: 'calendar.solarTermsAround',
      deps: ['time.localDateTime', 'policy.calendar'],
      explain: '24절기(정기) 시각(UTC) — baseYear±1을 포함한 정렬된 목록. (절입/진단/확장 기능에서 재사용)',
      compute: (_ctx, get) => {
        const ldt = get<any>('time.localDateTime');
        const cal = get<any>('policy.calendar');

        // Only compute if some policy actually needs solar terms.
        const needs = cal.monthBoundary === 'jieqi' || cal.yearBoundary === 'liChun' || !!cal?.solarTerms?.alwaysCompute;
        if (!needs) return null;

        const method = cal.solarTerms?.method === 'approx' ? 'approx' : 'meeus';
        return getSolarTermsAround(ldt.date.y, method);
      },
    }),
  );

  nodes.push(
    n<EngineWeights>({
      id: 'policy.weights',
      deps: [],
      explain: 'config.weights(가중치/스코어링 정책).',
      compute: (ctx) => ctx.config.weights ?? {},
    }),
  );

  nodes.push(
    n<LifeStagePolicy>({
      id: 'policy.lifeStages',
      deps: [],
      explain: 'config.strategies.lifeStages(십이운성 규칙) — earthRule + yinReversalEnabled.',
      compute: (ctx) => readLifeStagePolicy(ctx.config.strategies),
    }),
  );

  nodes.push(
    n({
      id: 'policy.fortune',
      deps: [],
      explain: 'config.strategies.fortune(대운/세운 정책).',
      compute: (ctx) => readFortunePolicy(ctx.config),
    }),
  );

  nodes.push(
    n({
      id: 'policy.rules',
      deps: [],
      explain: 'config.strategies/extensions (DSL rule engine inputs).',
      compute: (ctx) => ({ strategies: ctx.config.strategies ?? {}, extensions: ctx.config.extensions ?? {} }),
    }),
  );

  // --- Pillars
  nodes.push(
    n<PillarIdx>({
      id: 'pillars.day',
      deps: ['time.localDateTimeForDay', 'policy.calendar'],
      formula: 'ganzhiIdx = (JDN + 49) mod 60',
      explain: '정책(dayBoundary)을 적용한 기준 일자로 JDN을 계산하고 60갑자를 얻는다.',
      compute: (_ctx, get) => {
        const ldt = get<any>('time.localDateTimeForDay');
        const cal = get<any>('policy.calendar');
        const baseDate = effectiveDayDate(ldt, cal.dayBoundary);
        return calcDayPillar(baseDate);
      },
    }),
  );

  nodes.push(
    n<PillarIdx>({
      id: 'pillars.hour',
      deps: ['time.localDateTimeForHour', 'policy.calendar', 'pillars.day'],
      formula: 'hourStemIdx = ((dayStemIdx mod 5)*2 + hourBranchIdx) mod 10',
      explain: '시지(2시간 단위)와 일간으로 시간(時干)을 결정한다.',
      compute: (_ctx, get) => {
        const ldt = get<any>('time.localDateTimeForHour');
        const cal = get<any>('policy.calendar');
        const day = get<PillarIdx>('pillars.day');
        return calcHourPillar(day.stem, ldt.time, cal.hourBoundary);
      },
    }),
  );

  nodes.push(
    n<PillarIdx>({
      id: 'pillars.year',
      deps: ['time.localDateTime', 'time.utcMs', 'policy.calendar', 'calendar.jieBoundariesAround'],
      formula: 'stem = (year-4) mod 10, branch = (year-4) mod 12',
      explain: '연 경계(yearBoundary)를 적용해 연주를 결정한다(입춘 경계는 실제 절기 시각을 사용).',
      compute: (_ctx, get) => {
        const ldt = get<any>('time.localDateTime');
        const utcMs = get<number>('time.utcMs');
        const cal = get<any>('policy.calendar');
        const boundaries = get<JieBoundariesAround | null>('calendar.jieBoundariesAround');
        const liChunUtcMs = cal.yearBoundary === 'liChun' && boundaries ? liChunUtcMsFromBoundaries(boundaries) : null;
        const method = cal.solarTerms?.method === 'approx' ? 'approx' : 'meeus';
        return calcYearPillarFromLiChunUtc(ldt.date.y, utcMs, liChunUtcMs, cal.yearBoundary, ldt.offsetMinutes, method);
      },
    }),
  );

  nodes.push(
    n<PillarIdx>({
      id: 'pillars.month',
      deps: ['time.localDateTime', 'time.utcMs', 'policy.calendar', 'calendar.jieBoundariesAround', 'pillars.year'],
      formula: 'base = ((yearStem mod 5)*2 + 2) mod 10, monthStem = (base + m) mod 10',
      explain: '월 경계(monthBoundary)를 적용해 월주를 결정한다(절기 경계는 실제 절기 시각을 사용).',
      compute: (_ctx, get) => {
        const ldt = get<any>('time.localDateTime');
        const utcMs = get<number>('time.utcMs');
        const cal = get<any>('policy.calendar');
        const boundaries = get<JieBoundariesAround | null>('calendar.jieBoundariesAround');
        const year = get<PillarIdx>('pillars.year');
        const order = monthOrderByPolicy(utcMs, ldt, cal.monthBoundary, boundaries);
        return calcMonthPillarFromOrder(year.stem, order);
      },
    }),
  );

  // --- Derived: Ten Gods (Heavenly stems)
  nodes.push(
    n<{ yearStem: TenGod; monthStem: TenGod; hourStem: TenGod }>({
      id: 'tenGods.stems',
      deps: ['pillars.year', 'pillars.month', 'pillars.day', 'pillars.hour'],
      explain: '일간 기준 연/월/시의 천간 십성을 계산한다.',
      compute: (_ctx, get) => {
        const y = get<PillarIdx>('pillars.year');
        const m = get<PillarIdx>('pillars.month');
        const d = get<PillarIdx>('pillars.day');
        const h = get<PillarIdx>('pillars.hour');
        return {
          yearStem: tenGodOf(d.stem, y.stem),
          monthStem: tenGodOf(d.stem, m.stem),
          hourStem: tenGodOf(d.stem, h.stem),
        };
      },
    }),
  );

  // --- Hidden stems (지장간)
  nodes.push(
    n<FourPillars<HiddenStem[]>>({
      id: 'hiddenStems.branches',
      deps: ['pillars.year', 'pillars.month', 'pillars.day', 'pillars.hour', 'policy.weights'],
      explain: '네 지지의 지장간 목록(천간 인덱스 + 역할 + 가중치)을 생성한다.',
      compute: (_ctx, get) => {
        const y = get<PillarIdx>('pillars.year');
        const m = get<PillarIdx>('pillars.month');
        const d = get<PillarIdx>('pillars.day');
        const h = get<PillarIdx>('pillars.hour');
        const w = get<EngineWeights>('policy.weights');
        const policy = w.hiddenStems ?? { scheme: 'standard' };

        return fp(
          hiddenStemsOfBranch(y.branch, policy),
          hiddenStemsOfBranch(m.branch, policy),
          hiddenStemsOfBranch(d.branch, policy),
          hiddenStemsOfBranch(h.branch, policy),
        );
      },
    }),
  );

  nodes.push(
    n<FourPillars<Array<HiddenStem & { tenGod: TenGod }>>>({
      id: 'tenGods.hiddenStems',
      deps: ['hiddenStems.branches', 'pillars.day'],
      explain: '일간 기준 각 지장간의 십성을 계산한다.',
      compute: (_ctx, get) => {
        const hs = get<FourPillars<HiddenStem[]>>('hiddenStems.branches');
        const day = get<PillarIdx>('pillars.day');

        const mapList = (xs: HiddenStem[]) => xs.map((x) => ({ ...x, tenGod: tenGodOf(day.stem, x.stem) }));

        return fp(mapList(hs.year), mapList(hs.month), mapList(hs.day), mapList(hs.hour));
      },
    }),
  );

  // --- Element distribution (오행 분포)
  nodes.push(
    n<ElementDistribution>({
      id: 'elements.distribution',
      deps: ['pillars.year', 'pillars.month', 'pillars.day', 'pillars.hour', 'policy.weights'],
      explain: '천간(표면) + 지장간(지지 내부) 기반 오행 가중치 분포를 계산한다.',
      compute: (_ctx, get) => {
        const y = get<PillarIdx>('pillars.year');
        const m = get<PillarIdx>('pillars.month');
        const d = get<PillarIdx>('pillars.day');
        const h = get<PillarIdx>('pillars.hour');
        const w = get<EngineWeights>('policy.weights');

        const ed = w.elementDistribution ?? {};

        return elementDistributionFromPillars([y, m, d, h], {
          heavenStemWeight: ed.heavenStemWeight,
          branchTotalWeight: ed.branchTotalWeight,
          hiddenStemWeights: w.hiddenStems,
        });
      },
    }),
  );

  // --- Branch relations
  nodes.push(
    n<DetectedRelation[]>({
      id: 'relations.branches',
      deps: ['pillars.year', 'pillars.month', 'pillars.day', 'pillars.hour'],
      explain: '네 지지 간의 합/충/해/파/원진/삼합/방합을 탐지한다.',
      compute: (_ctx, get) => {
        const y = get<PillarIdx>('pillars.year');
        const m = get<PillarIdx>('pillars.month');
        const d = get<PillarIdx>('pillars.day');
        const h = get<PillarIdx>('pillars.hour');
        return detectBranchRelations([y.branch, m.branch, d.branch, h.branch]);
      },
    }),
  );

  // --- Heavenly stem relations (천간 합/충)
  nodes.push(
    n<StemRelation[]>({
      id: 'relations.stems',
      deps: ['pillars.year', 'pillars.month', 'pillars.day', 'pillars.hour'],
      explain: '네 천간 간의 합(合)과 충(冲)을 탐지한다.',
      compute: (_ctx, get) => {
        const y = get<PillarIdx>('pillars.year');
        const m = get<PillarIdx>('pillars.month');
        const d = get<PillarIdx>('pillars.day');
        const h = get<PillarIdx>('pillars.hour');
        return detectStemRelations([y.stem, m.stem, d.stem, h.stem]);
      },
    }),
  );

  
  // --- Fortune timeline (대운/세운)
  nodes.push(
    n<FortuneTimeline>({
      id: 'fortune.timeline',
      deps: [
        'time.utcMs',
        'time.localDateTime',
        'policy.calendar',
        'calendar.jieBoundariesAround',
        'pillars.year',
        'pillars.month',
        'policy.fortune',
      ],
      explain: '대운/세운 타임라인(순/역, 기산, 대운 10년주, 세운 연주)을 생성한다.',
      compute: (ctx, get) => {
        const utcMs = get<number>('time.utcMs');
        const ldt = get<any>('time.localDateTime');
        const cal = get<any>('policy.calendar');
        const boundaries = get<JieBoundariesAround | null>('calendar.jieBoundariesAround');
        const y = get<PillarIdx>('pillars.year');
        const m = get<PillarIdx>('pillars.month');
        const policy = get<any>('policy.fortune');

        const method = boundaries?.method === 'approx' ? 'approx' : 'meeus';

        return computeFortuneTimeline({
          request: ctx.request,
          parsedUtcMs: utcMs,
          birthLocalDateTime: ldt,
          localYear: ldt.date.y,
          calendar: cal,
          solarTermMethod: method,
          jieBoundariesAround: boundaries,
          natalYearPillar: y,
          natalMonthPillar: m,
          policy,
        });
      },
    }),
  );

  // --- Pillars scoring (ten-gods + elements) for rule engine
  nodes.push(
    n<PillarsScoringResult>({
      id: 'scores.pillars',
      deps: ['pillars.year', 'pillars.month', 'pillars.day', 'pillars.hour', 'policy.weights'],
      explain: '일간 기준 십성/오행/음양 스코어(수학적 베이스)를 계산한다.',
      compute: (_ctx, get) => {
        const y = get<PillarIdx>('pillars.year');
        const m = get<PillarIdx>('pillars.month');
        const d = get<PillarIdx>('pillars.day');
        const h = get<PillarIdx>('pillars.hour');
        const w = get<EngineWeights>('policy.weights');

        return scorePillars(
          { year: y, month: m, day: d, hour: h },
          {
            stemWeight: 1,
            branchWeight: 1,
            hiddenStemWeights: w.hiddenStems ?? { scheme: 'standard' },
            includeBranchYinYang: false,
          },
        );
      },
    }),
  );

  // --- Rule facts (for DSL-based scoring/constraints)
  nodes.push(
    n<RuleFacts>({
      id: 'rules.facts',
      deps: ['pillars.year', 'pillars.month', 'pillars.day', 'pillars.hour', 'elements.distribution', 'scores.pillars', 'policy.rules'],
      explain: 'DSL 룰 엔진에 투입할 fact-base(정규화된 수치/특징)를 구성한다.',
      compute: (ctx, get) => {
        const y = get<PillarIdx>('pillars.year');
        const m = get<PillarIdx>('pillars.month');
        const d = get<PillarIdx>('pillars.day');
        const h = get<PillarIdx>('pillars.hour');
        const ed = get<ElementDistribution>('elements.distribution');
        const scoring = get<PillarsScoringResult>('scores.pillars');

        return buildRuleFacts({ config: ctx.config, pillars: { year: y, month: m, day: d, hour: h }, elementDistribution: ed, scoring });
      },
    }),
  );

  nodes.push(
    n<StrengthFacts>({
      id: 'strength.index',
      deps: ['rules.facts'],
      explain: '신강/신약(연속 스코어) — support vs pressure 기반 [-1, +1].',
      compute: (_ctx, get) => get<RuleFacts>('rules.facts').strength,
    }),
  );

  nodes.push(
    n<YongshinResult>({
      id: 'rules.yongshin',
      deps: ['rules.facts'],
      explain: '용신/희신 후보를 수학적 스코어 + DSL 보정으로 랭킹한다.',
      compute: (ctx, get) => computeYongshin(ctx.config, get<RuleFacts>('rules.facts')),
    }),
  );

  nodes.push(
    n<GyeokgukResult>({
      id: 'rules.gyeokguk',
      deps: ['rules.facts'],
      explain: '격국을 DSL 스코어링으로 판정한다(기초: 월지 본기 십성 기반).',
      compute: (ctx, get) => computeGyeokguk(ctx.config, get<RuleFacts>('rules.facts')),
    }),
  );

  nodes.push(
    n<ShinsalResult>({
      id: 'rules.shinsal',
      deps: ['rules.facts'],
      explain: '신살을 DSL/패턴 매칭으로 판정한다(데모: 도화/역마).',
      compute: (ctx, get) => computeShinsal(ctx.config, get<RuleFacts>('rules.facts')),
    }),
  );

// --- Twelve life stages (십이운성)
  nodes.push(
    n<FourPillars<LifeStageDetail>>({
      id: 'lifeStages.detail',
      deps: ['pillars.year', 'pillars.month', 'pillars.day', 'pillars.hour', 'policy.lifeStages'],
      explain: '일간 기준 각 지지의 십이운성(장생~양)을 계산한다(상세: index/startBranch 포함).',
      compute: (_ctx, get) => {
        const y = get<PillarIdx>('pillars.year');
        const m = get<PillarIdx>('pillars.month');
        const d = get<PillarIdx>('pillars.day');
        const h = get<PillarIdx>('pillars.hour');
        const policy = get<LifeStagePolicy>('policy.lifeStages');

        return fp(
          lifeStageOf(d.stem, y.branch, policy),
          lifeStageOf(d.stem, m.branch, policy),
          lifeStageOf(d.stem, d.branch, policy),
          lifeStageOf(d.stem, h.branch, policy),
        );
      },
    }),
  );

  nodes.push(
    n<FourPillars<LifeStage>>({
      id: 'lifeStages.pillars',
      deps: ['lifeStages.detail'],
      explain: '십이운성 상세 결과에서 stage만 추출한다.',
      compute: (_ctx, get) => {
        const d = get<FourPillars<LifeStageDetail>>('lifeStages.detail');
        return fp(d.year.stage, d.month.stage, d.day.stage, d.hour.stage);
      },
    }),
  );

  const g: Graph = new Map();
  for (const spec of nodes) g.set(spec.id, spec);
  return g;
}
