import { CHEONGAN_INFO } from '../../domain/Cheongan.js';
import {
  CheonganRelationType,
  type CheonganRelationHit,
  type ResolvedRelation,
  type ScoredCheonganRelation,
} from '../../domain/Relations.js';
import { ANALYSIS_KEYS } from '../../domain/SajuAnalysis.js';
import { ohaengKr } from './OhaengHelpers.js';
import { tracedStep } from './TraceHelpers.js';

export function buildCheonganRelationsTraceStep(
  cheonganRelations: readonly CheonganRelationHit[],
) {
  return tracedStep(
    ANALYSIS_KEYS.CHEONGAN_RELATIONS,
    `천간 관계 ${cheonganRelations.length}건 감지 (합/충/극 등).`,
    [`hits=${cheonganRelations.length}`],
    cheonganRelations.length === 0
      ? ['4주 천간 중 합(5간격)·충(6간격) 조건을 충족하는 쌍이 없습니다.']
      : cheonganRelations.map(hit => {
        const members = [...hit.members];
        const s1 = CHEONGAN_INFO[members[0]!];
        const s2 = CHEONGAN_INFO[members[1]!];
        if (hit.type === CheonganRelationType.HAP) {
          return `${s1.hangul}(${s1.hanja})과 ${s2.hangul}(${s2.hanja})는 ` +
            `천간합(天干合) 관계 — 하도(河圖) 배합으로 서로 5간격, ` +
            `합화 시 ${ohaengKr(hit.resultOhaeng!)}으로 변화 가능`;
        } else {
          return `${s1.hangul}(${s1.hanja})과 ${s2.hangul}(${s2.hanja})는 ` +
            `천간충(天干沖) 관계 — 같은 음양이며 서로 6간격, ` +
            `오행이 상극(${ohaengKr(s1.ohaeng)}↔${ohaengKr(s2.ohaeng)})`;
        }
      }),
  );
}

export function buildResolvedJijiRelationsTraceStep(
  resolvedJijiRelations: readonly ResolvedRelation[],
  allowBanhap: boolean,
) {
  return tracedStep(
    ANALYSIS_KEYS.RESOLVED_JIJI,
    `지지 관계 ${resolvedJijiRelations.length}건 상호작용 해소 및 점수 산출. ` +
    `반합 ${allowBanhap ? '허용' : '제외'}.`,
    resolvedJijiRelations.length > 0
      ? resolvedJijiRelations.map(r =>
        `${r.hit.note}: ${r.outcome}(${r.score?.finalScore ?? '?'}점)`)
      : ['지지 관계 없음'],
    resolvedJijiRelations.length === 0
      ? ['4주 지지 간 합·충·형·파·해·원진 관계가 감지되지 않았습니다.']
      : resolvedJijiRelations.map(r => {
        const scoreDetail = r.score
          ? ` [기본${r.score.baseScore}점` +
            (r.score.adjacencyBonus > 0 ? ` + 인접보너스${r.score.adjacencyBonus}점` : '') +
            ` × 배율${r.score.outcomeMultiplier} = ${r.score.finalScore}점]`
          : '';
        return `${r.hit.note} → ${r.outcome}: ${r.reasoning}${scoreDetail}`;
      }),
  );
}

export function buildScoredCheonganRelationsTraceStep(
  scoredCheonganRelations: readonly ScoredCheonganRelation[],
) {
  return tracedStep(
    ANALYSIS_KEYS.SCORED_CHEONGAN,
    `천간 관계 ${scoredCheonganRelations.length}건 점수 산출 (합화 평가 반영).`,
    scoredCheonganRelations.length > 0
      ? scoredCheonganRelations.map(s => `${s.hit.note}: ${s.score.finalScore}점`)
      : ['천간 관계 없음'],
    scoredCheonganRelations.length === 0
      ? ['천간 관계가 없으므로 점수 산출 대상이 없습니다.']
      : scoredCheonganRelations.map(s => `${s.hit.note}: ${s.score.rationale} → ${s.score.finalScore}점`),
  );
}

