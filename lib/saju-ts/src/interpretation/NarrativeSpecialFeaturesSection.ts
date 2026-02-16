import type { CalculationConfig } from '../config/CalculationConfig.js';
import { HapHwaStrictness, ShinsalReferenceBranch } from '../config/CalculationConfig.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import type { WeightedShinsalHit } from '../domain/Relations.js';
import { ShinsalGrade, SHINSAL_TYPE_INFO } from '../domain/Shinsal.js';
import type { ShinsalHit } from '../domain/Shinsal.js';
import { sentenceCite } from './NarrativeSentenceCite.js';
import { positionKorean } from './NarrativeFormatting.js';
import { RelationSignificanceInterpreter } from './RelationSignificanceInterpreter.js';
import { shinsalDetectionPrinciple } from './shinsalDetectionPrinciple.js';
import { combinationVariantNote } from './SchoolVariantHelpers.js';

export function buildSpecialFeatures(a: SajuAnalysis, config: CalculationConfig): string {
  const lines: string[] = [];
  lines.push('■ 특수 요소');
  lines.push('');

  if (a.weightedShinsalHits.length > 0) {
    lines.push(`  ${sentenceCite('shinsal.detection')} ${sentenceCite('shinsal.grading')} ${sentenceCite('shinsal.weight')}`);
    const grouped = new Map<ShinsalGrade, WeightedShinsalHit[]>();
    for (const w of a.weightedShinsalHits) {
      const grade = SHINSAL_TYPE_INFO[w.hit.type].grade;
      if (!grouped.has(grade)) grouped.set(grade, []);
      grouped.get(grade)!.push(w);
    }
    const GRADE_LABELS: Record<ShinsalGrade, string> = {
      [ShinsalGrade.A]: '핵심 신살',
      [ShinsalGrade.B]: '주요 신살',
      [ShinsalGrade.C]: '참고 신살',
    };
    for (const grade of [ShinsalGrade.A, ShinsalGrade.B, ShinsalGrade.C]) {
      const weighted = grouped.get(grade);
      if (!weighted) continue;
      lines.push(`  [${GRADE_LABELS[grade]}]`);
      for (const w of weighted) {
        const t = SHINSAL_TYPE_INFO[w.hit.type];
        lines.push(`    ${t.koreanName}(${t.hanja}) -- ${positionKorean(w.hit.position)} [${w.weightedScore}점] ${t.description}`);
        const principle = shinsalDetectionPrinciple(w.hit, a.pillars);
        if (principle) lines.push(`      \u21B3 원리: ${principle}`);
      }
    }
    lines.push('');
  } else if (a.shinsalHits.length > 0) {
    const grouped = new Map<ShinsalGrade, ShinsalHit[]>();
    for (const hit of a.shinsalHits) {
      const grade = SHINSAL_TYPE_INFO[hit.type].grade;
      if (!grouped.has(grade)) grouped.set(grade, []);
      grouped.get(grade)!.push(hit);
    }
    for (const grade of [ShinsalGrade.A, ShinsalGrade.B, ShinsalGrade.C]) {
      const hits = grouped.get(grade);
      if (!hits) continue;
      const gradeLabel = grade === ShinsalGrade.A ? '핵심 신살' : grade === ShinsalGrade.B ? '주요 신살' : '참고 신살';
      lines.push(`  [${gradeLabel}]`);
      for (const hit of hits) {
        const t = SHINSAL_TYPE_INFO[hit.type];
        lines.push(`    ${t.koreanName}(${t.hanja}) -- ${positionKorean(hit.position)}: ${t.description}`);
        const principle = shinsalDetectionPrinciple(hit, a.pillars);
        if (principle) lines.push(`      \u21B3 원리: ${principle}`);
      }
    }
    lines.push('');
  }

  if (a.shinsalComposites.length > 0) {
    lines.push(`  [신살 조합 해석] ${sentenceCite('shinsal.composite')}`);
    for (const composite of a.shinsalComposites) {
      lines.push(`    \u25B8 ${composite.patternName} [${composite.interactionType}] — ${composite.interpretation}`);
    }
    lines.push('');
  }

  if (a.scoredCheonganRelations.length > 0) {
    lines.push(`  [천간 관계] ${sentenceCite('relation.cheongan.hap')} ${sentenceCite('relation.cheongan.chung')}`);
    for (const scored of a.scoredCheonganRelations) {
      lines.push(`    ${scored.hit.note} [${scored.score.finalScore}점] — ${scored.score.rationale}`);
    }
    lines.push('');
  } else if (a.cheonganRelations.length > 0) {
    lines.push('  [천간 관계]');
    for (const rel of a.cheonganRelations) {
      lines.push(`    ${rel.note}`);
    }
    lines.push('');
  }

  if (a.hapHwaEvaluations.length > 0) {
    lines.push(`  [천간 합화 평가] ${sentenceCite('relation.hapwha')}`);
    for (const ev of a.hapHwaEvaluations) {
      lines.push(`    ${ev.reasoning}`);
    }
    lines.push('');
  }

  if (a.resolvedJijiRelations.length > 0) {
    lines.push(`  [지지 관계] ${sentenceCite('relation.jiji.samhap')} ${sentenceCite('relation.jiji.chung')} ${sentenceCite('relation.jiji.hyeong')} ${sentenceCite('relation.interaction.outcome')}`);
    for (const resolved of a.resolvedJijiRelations) {
      const scoreStr = resolved.score ? `[${resolved.score.finalScore}점/${resolved.outcome}]` : `[${resolved.outcome}]`;
      lines.push(`    ${resolved.hit.note} ${scoreStr} — ${resolved.reasoning}`);
      const significance = RelationSignificanceInterpreter.interpret(
        resolved.hit.type,
        resolved.hit.members,
        a.pillars,
      );
      if (significance) {
        const icon = significance.isPositive ? '\u25CB' : '\u25CF';
        lines.push(`      ${icon} 의미: ${significance.meaning}`);
        lines.push(`        영향 영역: ${significance.affectedDomains.join(', ')} | 시기: ${significance.ageWindow}`);
      }
    }
    lines.push('');
  } else if (a.jijiRelations.length > 0) {
    lines.push('  [지지 관계]');
    for (const rel of a.jijiRelations) {
      lines.push(`    ${rel.note}`);
    }
    lines.push('');
  }

  if (lines.join('\n').trim() === '■ 특수 요소') {
    lines.push('  특이 요소가 발견되지 않았습니다.');
  }

  lines.push('  [분석 방법론]');
  const strictnessNote = config.hapHwaStrictness === HapHwaStrictness.STRICT_FIVE_CONDITIONS
    ? '엄격 5조건 (합화는 매우 드묾)'
    : config.hapHwaStrictness === HapHwaStrictness.MODERATE
      ? '중간 (인접+월령 시 합화 인정)'
      : '관대 (합만으로도 합화 인정)';
  lines.push(`    합화 판정: ${strictnessNote}`);
  lines.push(`    반합: ${config.allowBanhap ? '인정' : '불인정'}`);
  lines.push(`    일간 합거: ${config.dayMasterNeverHapGeo ? '불가 (일간은 합거되지 않음)' : '가능 (일부 유파)'}`);
  const shinsalRefNote = config.shinsalReferenceBranch === ShinsalReferenceBranch.DAY_ONLY
    ? '일지만 기준'
    : config.shinsalReferenceBranch === ShinsalReferenceBranch.YEAR_ONLY
      ? '년지만 기준'
      : '일지+년지 모두';
  lines.push(`    신살 참조: ${shinsalRefNote}`);
  const cvn = combinationVariantNote(config);
  if (cvn) lines.push(cvn);

  return lines.join('\n').trimEnd();
}
