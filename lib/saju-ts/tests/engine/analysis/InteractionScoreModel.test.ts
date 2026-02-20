import { describe, it, expect } from 'vitest';
import { Cheongan } from '../../../src/domain/Cheongan.js';
import { Jiji } from '../../../src/domain/Jiji.js';
import { Ohaeng } from '../../../src/domain/Ohaeng.js';
import { Pillar } from '../../../src/domain/Pillar.js';
import { PillarSet } from '../../../src/domain/PillarSet.js';
import { PillarPosition } from '../../../src/domain/PillarPosition.js';
import {
  CheonganRelationHit,
  CheonganRelationType,
  HapHwaEvaluation,
  HapState,
  InteractionOutcome,
  JijiRelationHit,
  JijiRelationType,
  ResolvedRelation,
} from '../../../src/domain/Relations.js';
import { JijiRelationScorer, CheonganRelationScorer } from '../../../src/engine/analysis/InteractionScoreModel.js';
import { RelationInteractionResolver } from '../../../src/engine/analysis/RelationInteractionResolver.js';

/**
 * Ported from InteractionScoreModelTest.kt.
 *
 * CC-8 관계 상호작용 점수 모델 테스트.
 * 지지/천간 관계의 점수 산출 정확성, 인접 보너스, 배율, 천간 합화 점수를 검증합니다.
 */

// ── Helper factories ────────────────────────────────────────────

function pillars(year: Jiji, month: Jiji, day: Jiji, hour: Jiji): PillarSet {
  return new PillarSet(
    new Pillar(Cheongan.GAP, year),
    new Pillar(Cheongan.EUL, month),
    new Pillar(Cheongan.BYEONG, day),
    new Pillar(Cheongan.JEONG, hour),
  );
}

function hit(type: JijiRelationType, members: Jiji[], note: string = ''): JijiRelationHit {
  return { type, members: new Set(members), note };
}

function resolved(
  h: JijiRelationHit,
  outcome: InteractionOutcome = InteractionOutcome.ACTIVE,
): ResolvedRelation {
  return { hit: h, outcome, interactsWith: [], reasoning: '테스트', score: null };
}

function branchPositions(ps: PillarSet): Map<Jiji, number[]> {
  return RelationInteractionResolver.buildBranchPositionMap(ps);
}

describe('InteractionScoreModel', () => {

  // ══════════════════════════════════════════════════════════════════
  //  1. 지지 기본점수 테이블 완전성 (9개 타입)
  // ══════════════════════════════════════════════════════════════════

  describe('1. 지지 기본점수 테이블 완전성', () => {
    const allJijiTypes: JijiRelationType[] = [
      JijiRelationType.BANGHAP,
      JijiRelationType.SAMHAP,
      JijiRelationType.CHUNG,
      JijiRelationType.YUKHAP,
      JijiRelationType.HYEONG,
      JijiRelationType.BANHAP,
      JijiRelationType.HAE,
      JijiRelationType.PA,
      JijiRelationType.WONJIN,
    ];

    it('all 9 JijiRelationType have positive base scores', () => {
      for (const type of allJijiTypes) {
        const score = JijiRelationScorer.baseScoreFor(type, '');
        expect(score).toBeGreaterThan(0);
      }
    });

    it('base score ordering matches traditional theory', () => {
      const banghap = JijiRelationScorer.baseScoreFor(JijiRelationType.BANGHAP, '');
      const samhap = JijiRelationScorer.baseScoreFor(JijiRelationType.SAMHAP, '');
      const chung = JijiRelationScorer.baseScoreFor(JijiRelationType.CHUNG, '');
      const yukhap = JijiRelationScorer.baseScoreFor(JijiRelationType.YUKHAP, '');
      const hyeong = JijiRelationScorer.baseScoreFor(JijiRelationType.HYEONG, '');
      const hae = JijiRelationScorer.baseScoreFor(JijiRelationType.HAE, '');
      const pa = JijiRelationScorer.baseScoreFor(JijiRelationType.PA, '');
      const wonjin = JijiRelationScorer.baseScoreFor(JijiRelationType.WONJIN, '');

      expect(banghap).toBeGreaterThanOrEqual(samhap);
      expect(samhap).toBeGreaterThan(chung);
      expect(chung).toBeGreaterThan(yukhap);
      expect(yukhap).toBeGreaterThan(hyeong);
      expect(hyeong).toBeGreaterThan(hae);
      expect(hae).toBeGreaterThanOrEqual(pa);
      expect(pa).toBeGreaterThan(wonjin);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  2. 반합 서브타입별 점수 차이
  // ══════════════════════════════════════════════════════════════════

  describe('2. 반합 서브타입별 점수', () => {
    it('banhap saengwang scores highest among banhap subtypes', () => {
      const saengwang = JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, '인오 생왕반합(화)');
      const wanggo = JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, '오술 왕고반합(화)');
      const saenggo = JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, '인술 생고반합(화)');

      expect(saengwang).toBeGreaterThan(wanggo);
      expect(wanggo).toBeGreaterThan(saenggo);
    });

    it('banhap saengwang is 45, wanggo is 40, saenggo is 35', () => {
      expect(JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, '사유 생왕반합(금)')).toBe(45);
      expect(JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, '유축 왕고반합(금)')).toBe(40);
      expect(JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, '사축 생고반합(금)')).toBe(35);
    });

    it('banhap without subtype note uses default 40', () => {
      expect(JijiRelationScorer.baseScoreFor(JijiRelationType.BANHAP, '해미반합(목)')).toBe(40);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  3. 인접 보너스 적용 검증
  // ══════════════════════════════════════════════════════════════════

  describe('3. 인접 보너스', () => {
    it('adjacent members get +10 bonus', () => {
      // 년주(자) - 월주(축) -> 인접
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
      const r = resolved(hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합(육합)'));
      const score = JijiRelationScorer.score(r, branchPositions(ps));

      expect(score.adjacencyBonus).toBe(10);
      expect(score.finalScore).toBe(70); // 60 + 10 = 70
    });

    it('non-adjacent members get 0 bonus', () => {
      // 년주(자) - 시주(오) -> 비인접
      const ps = pillars(Jiji.JA, Jiji.IN, Jiji.MYO, Jiji.O);
      const r = resolved(hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충'));
      const score = JijiRelationScorer.score(r, branchPositions(ps));

      expect(score.adjacencyBonus).toBe(0);
      expect(score.finalScore).toBe(70); // 70 + 0 = 70
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  4. 상호작용 결과 배율 검증
  // ══════════════════════════════════════════════════════════════════

  describe('4. 상호작용 결과 배율', () => {
    it('ACTIVE outcome multiplier is 1.0', () => {
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
      const r = resolved(hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합'), InteractionOutcome.ACTIVE);
      const score = JijiRelationScorer.score(r, branchPositions(ps));

      expect(score.outcomeMultiplier).toBe(1.0);
    });

    it('WEAKENED outcome halves the score', () => {
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
      const r = resolved(hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합'), InteractionOutcome.WEAKENED);
      const score = JijiRelationScorer.score(r, branchPositions(ps));

      expect(score.outcomeMultiplier).toBe(0.5);
      // (60 + 10) * 0.5 = 35
      expect(score.finalScore).toBe(35);
    });

    it('BROKEN outcome gives 0 score', () => {
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.IN, Jiji.MYO);
      const r = resolved(hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합'), InteractionOutcome.BROKEN);
      const score = JijiRelationScorer.score(r, branchPositions(ps));

      expect(score.outcomeMultiplier).toBe(0.0);
      expect(score.finalScore).toBe(0);
    });

    it('STRENGTHENED outcome multiplies by 1.3', () => {
      const ps = pillars(Jiji.IN, Jiji.SIN, Jiji.JIN, Jiji.MYO);
      const r = resolved(hit(JijiRelationType.HYEONG, [Jiji.IN, Jiji.SIN], '인신형'), InteractionOutcome.STRENGTHENED);
      const score = JijiRelationScorer.score(r, branchPositions(ps));

      expect(score.outcomeMultiplier).toBe(1.3);
      // 55 + 10(인접) = 65, * 1.3 = 84.5 -> trunc -> 84
      expect(score.finalScore).toBe(84);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  5. 최대/최소 점수 제한
  // ══════════════════════════════════════════════════════════════════

  describe('5. 최대/최소 점수 제한', () => {
    it('score capped at 100 for banghap with adjacency', () => {
      // 방합(100) + 인접(10) = 110 -> capped to 100
      const ps = pillars(Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.SA);
      const r = resolved(
        hit(JijiRelationType.BANGHAP, [Jiji.IN, Jiji.MYO, Jiji.JIN], '인묘진 방합(목)'),
        InteractionOutcome.ACTIVE,
      );
      const score = JijiRelationScorer.score(r, branchPositions(ps));

      expect(score.finalScore).toBe(100);
    });

    it('BROKEN score is always 0', () => {
      const ps = pillars(Jiji.IN, Jiji.MYO, Jiji.JIN, Jiji.SA);
      const r = resolved(
        hit(JijiRelationType.BANGHAP, [Jiji.IN, Jiji.MYO, Jiji.JIN], '인묘진 방합(목)'),
        InteractionOutcome.BROKEN,
      );
      const score = JijiRelationScorer.score(r, branchPositions(ps));

      expect(score.finalScore).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  6. 천간 관계 점수
  // ══════════════════════════════════════════════════════════════════

  describe('6. 천간 관계 점수', () => {
    it('cheongan hap with HAPWHA scores 90', () => {
      const hapHit: CheonganRelationHit = {
        type: CheonganRelationType.HAP,
        members: new Set([Cheongan.GAP, Cheongan.GI]),
        resultOhaeng: Ohaeng.EARTH,
        note: '갑기합화토',
      };
      const eval_: HapHwaEvaluation = {
        stem1: Cheongan.GAP, stem2: Cheongan.GI,
        position1: PillarPosition.YEAR, position2: PillarPosition.MONTH,
        resultOhaeng: Ohaeng.EARTH, state: HapState.HAPWHA,
        confidence: 0.85, conditionsMet: ['인접', '월령'],
        conditionsFailed: [], reasoning: '합화 성립',
        dayMasterInvolved: false,
      };
      const ps = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.GI, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.JEONG, Jiji.MYO),
      );
      const result = CheonganRelationScorer.score(hapHit, [eval_], ps);

      expect(result.score.baseScore).toBe(90);
      expect(result.hapHwaEvaluation).not.toBeNull();
      expect(result.hapHwaEvaluation?.state).toBe(HapState.HAPWHA);
    });

    it('cheongan hap with HAPGEO scores 70', () => {
      const hapHit: CheonganRelationHit = {
        type: CheonganRelationType.HAP,
        members: new Set([Cheongan.GAP, Cheongan.GI]),
        resultOhaeng: Ohaeng.EARTH,
        note: '갑기합화토',
      };
      const eval_: HapHwaEvaluation = {
        stem1: Cheongan.GAP, stem2: Cheongan.GI,
        position1: PillarPosition.YEAR, position2: PillarPosition.MONTH,
        resultOhaeng: Ohaeng.EARTH, state: HapState.HAPGEO,
        confidence: 0.50, conditionsMet: ['인접'],
        conditionsFailed: ['월령'], reasoning: '합거 성립',
        dayMasterInvolved: false,
      };
      const ps = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.GI, Jiji.CHUK),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.JEONG, Jiji.MYO),
      );
      const result = CheonganRelationScorer.score(hapHit, [eval_], ps);

      expect(result.score.baseScore).toBe(70);
    });

    it('cheongan hap with NOT_ESTABLISHED scores 30', () => {
      const hapHit: CheonganRelationHit = {
        type: CheonganRelationType.HAP,
        members: new Set([Cheongan.GAP, Cheongan.GI]),
        resultOhaeng: Ohaeng.EARTH,
        note: '갑기합화토',
      };
      const eval_: HapHwaEvaluation = {
        stem1: Cheongan.GAP, stem2: Cheongan.GI,
        position1: PillarPosition.YEAR, position2: PillarPosition.HOUR,
        resultOhaeng: Ohaeng.EARTH, state: HapState.NOT_ESTABLISHED,
        confidence: 1.0, conditionsMet: [],
        conditionsFailed: ['인접'], reasoning: '불성립',
        dayMasterInvolved: false,
      };
      const ps = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.BYEONG, Jiji.CHUK),
        new Pillar(Cheongan.JEONG, Jiji.IN),
        new Pillar(Cheongan.GI, Jiji.MYO),
      );
      const result = CheonganRelationScorer.score(hapHit, [eval_], ps);

      expect(result.score.baseScore).toBe(30);
      // 비인접이므로 adjBonus = 0
      expect(result.score.adjacencyBonus).toBe(0);
      expect(result.score.finalScore).toBe(30);
    });

    it('cheongan hap without matching eval uses default 50', () => {
      const hapHit: CheonganRelationHit = {
        type: CheonganRelationType.HAP,
        members: new Set([Cheongan.GAP, Cheongan.GI]),
        resultOhaeng: Ohaeng.EARTH,
        note: '갑기합화토',
      };
      const ps = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.GI, Jiji.CHUK),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.JEONG, Jiji.MYO),
      );
      // no evaluations provided
      const result = CheonganRelationScorer.score(hapHit, [], ps);

      expect(result.score.baseScore).toBe(50);
    });

    it('cheongan chung scores 65', () => {
      const chungHit: CheonganRelationHit = {
        type: CheonganRelationType.CHUNG,
        members: new Set([Cheongan.GAP, Cheongan.GYEONG]),
        resultOhaeng: null,
        note: '갑경충',
      };
      const ps = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.GYEONG, Jiji.CHUK),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.JEONG, Jiji.MYO),
      );
      const result = CheonganRelationScorer.score(chungHit, [], ps);

      expect(result.score.baseScore).toBe(65);
      // 인접(년-월)이므로 +10
      expect(result.score.adjacencyBonus).toBe(10);
      expect(result.score.finalScore).toBe(75);
    });

    it('cheongan chung non-adjacent scores 65 without bonus', () => {
      const chungHit: CheonganRelationHit = {
        type: CheonganRelationType.CHUNG,
        members: new Set([Cheongan.GAP, Cheongan.GYEONG]),
        resultOhaeng: null,
        note: '갑경충',
      };
      // GAP in year, GYEONG in hour -> non-adjacent
      const ps = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.BYEONG, Jiji.CHUK),
        new Pillar(Cheongan.JEONG, Jiji.IN),
        new Pillar(Cheongan.GYEONG, Jiji.MYO),
      );
      const result = CheonganRelationScorer.score(chungHit, [], ps);

      expect(result.score.baseScore).toBe(65);
      expect(result.score.adjacencyBonus).toBe(0);
      expect(result.score.finalScore).toBe(65);
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  7. Rationale 검증
  // ══════════════════════════════════════════════════════════════════

  describe('7. Rationale 검증', () => {
    it('jiji score rationale contains base score and final score keywords', () => {
      const ps = pillars(Jiji.JA, Jiji.O, Jiji.IN, Jiji.MYO);
      const r = resolved(hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충'));
      const score = JijiRelationScorer.score(r, branchPositions(ps));

      expect(score.rationale).toContain('기본점수');
      expect(score.rationale).toContain('최종');
      expect(score.rationale).toContain('점');
    });

    it('cheongan score rationale contains hap state when available', () => {
      const hapHit: CheonganRelationHit = {
        type: CheonganRelationType.HAP,
        members: new Set([Cheongan.GAP, Cheongan.GI]),
        resultOhaeng: Ohaeng.EARTH,
        note: '갑기합화토',
      };
      const eval_: HapHwaEvaluation = {
        stem1: Cheongan.GAP, stem2: Cheongan.GI,
        position1: PillarPosition.YEAR, position2: PillarPosition.MONTH,
        resultOhaeng: Ohaeng.EARTH, state: HapState.HAPWHA,
        confidence: 0.85, conditionsMet: ['인접', '월령'],
        conditionsFailed: [], reasoning: '합화 성립',
        dayMasterInvolved: false,
      };
      const ps = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JIN),
        new Pillar(Cheongan.GI, Jiji.SUL),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.JEONG, Jiji.MYO),
      );
      const result = CheonganRelationScorer.score(hapHit, [eval_], ps);

      expect(result.score.rationale).toContain('합화');
    });
  });

  // ══════════════════════════════════════════════════════════════════
  //  8. scoreAll 배치 처리
  // ══════════════════════════════════════════════════════════════════

  describe('8. scoreAll 배치 처리', () => {
    it('scoreAll processes all resolved relations', () => {
      const ps = pillars(Jiji.JA, Jiji.CHUK, Jiji.O, Jiji.MI);
      const hits = [
        hit(JijiRelationType.YUKHAP, [Jiji.JA, Jiji.CHUK], '자축합'),
        hit(JijiRelationType.CHUNG, [Jiji.JA, Jiji.O], '자오충'),
      ];
      const resolvedAll = RelationInteractionResolver.resolve(hits, ps);
      const scored = JijiRelationScorer.scoreAll(resolvedAll, branchPositions(ps));

      expect(scored.length).toBe(2);
      for (const r of scored) {
        expect(r.score).not.toBeNull();
      }
    });

    it('cheongan scoreAll processes all hits', () => {
      const ps = new PillarSet(
        new Pillar(Cheongan.GAP, Jiji.JA),
        new Pillar(Cheongan.GI, Jiji.CHUK),
        new Pillar(Cheongan.BYEONG, Jiji.IN),
        new Pillar(Cheongan.IM, Jiji.MYO),
      );
      const hits: CheonganRelationHit[] = [
        { type: CheonganRelationType.HAP, members: new Set([Cheongan.GAP, Cheongan.GI]), resultOhaeng: Ohaeng.EARTH, note: '갑기합화토' },
        { type: CheonganRelationType.CHUNG, members: new Set([Cheongan.BYEONG, Cheongan.IM]), resultOhaeng: null, note: '병임충' },
      ];
      const scored = CheonganRelationScorer.scoreAll(hits, [], ps);

      expect(scored.length).toBe(2);
      expect(scored[0]!.score.finalScore).toBeGreaterThan(0);
      expect(scored[1]!.score.finalScore).toBeGreaterThan(0);
    });
  });
});
