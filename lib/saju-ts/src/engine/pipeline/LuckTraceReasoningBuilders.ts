import { type CalculationConfig } from '../../config/CalculationConfig.js';
import { CHEONGAN_INFO, type Cheongan } from '../../domain/Cheongan.js';
import { type DaeunInfo } from '../../domain/DaeunInfo.js';
import { EUMYANG_INFO } from '../../domain/Eumyang.js';
import { Gender } from '../../domain/Gender.js';
import { JIJI_INFO, jijiOrdinal } from '../../domain/Jiji.js';
import { OhaengRelation, OhaengRelations, type Ohaeng } from '../../domain/Ohaeng.js';
import { PILLAR_POSITION_VALUES } from '../../domain/PillarPosition.js';
import { type PillarSet } from '../../domain/PillarSet.js';
import { type SaeunPillar } from '../../domain/SaeunInfo.js';
import { type YongshinResult, YongshinType, YONGSHIN_TYPE_INFO } from '../../domain/YongshinResult.js';
import { ohaengKr } from './OhaengHelpers.js';
import { pillarOf } from './PillarHelpers.js';

export function buildYongshinReasoning(
  yongshin: YongshinResult,
  yongshinPriority: CalculationConfig['yongshinPriority'],
): string[] {
  const recTypes = yongshin.recommendations.map(r => r.type);
  const tier1Types = [YongshinType.HAPWHA_YONGSHIN, YongshinType.ILHAENG_YONGSHIN, YongshinType.JEONWANG];
  const hasTier1 = recTypes.some(t => tier1Types.includes(t));
  const hasTonggwan = recTypes.includes(YongshinType.TONGGWAN);

  const yongshinReasoning: string[] = [
    '【용신 결정 3단계 우선순위 체계】',
  ];
  if (hasTier1) {
    const tier1Rec = yongshin.recommendations.find(r => tier1Types.includes(r.type))!;
    yongshinReasoning.push(
      `▶ 제1단계 (격국 본질): ${YONGSHIN_TYPE_INFO[tier1Rec.type].koreanName} 적용됨 — ` +
      `외격 기반 용신이 최우선. 억부법은 내격 전용이므로 적용 제외.`,
    );
  } else {
    yongshinReasoning.push('▷ 제1단계 (격국 본질): 해당 없음 — 화격·일행득기격·종격 아님');
  }
  if (hasTonggwan) {
    const tgRec = yongshin.recommendations.find(r => r.type === YongshinType.TONGGWAN)!;
    yongshinReasoning.push(`▶ 제2단계 (갈등 해소): 통관용신 적용됨 — ${tgRec.reasoning}`);
  } else {
    yongshinReasoning.push('▷ 제2단계 (갈등 해소): 원국 내 강한 상극 충돌 미감지 또는 threshold 미달');
  }
  if (!hasTier1) {
    yongshinReasoning.push(
      `▶ 제3단계 (기본): 억부+조후 기본 결정, 우선순위=${yongshinPriority}`,
    );
  }
  yongshinReasoning.push('');
  yongshinReasoning.push('【개별 방법론 상세】');
  for (const rec of yongshin.recommendations) {
    yongshinReasoning.push(
      `[${YONGSHIN_TYPE_INFO[rec.type].koreanName}] ${rec.reasoning} ` +
      `→ 용신: ${ohaengKr(rec.primaryElement)}` +
      (rec.secondaryElement ? `, 희신: ${ohaengKr(rec.secondaryElement)}` : '') +
      ` (신뢰도 ${Math.round(rec.confidence * 100)}%)`,
    );
  }
  yongshinReasoning.push('');
  yongshinReasoning.push(
    `억부-조후 일치도: ${yongshin.agreement} → 최종 신뢰도 ${Math.round(yongshin.finalConfidence * 100)}%`,
  );
  if (yongshin.gisin) {
    yongshinReasoning.push(`기신(忌神): ${ohaengKr(yongshin.gisin)} — 용신을 방해하는 오행`);
  }
  if (yongshin.gusin) {
    yongshinReasoning.push(`구신(仇神): ${ohaengKr(yongshin.gusin)} — 기신을 돕는 오행`);
  }
  yongshinReasoning.push(
    `[유파 설정] 용신 우선순위: ${yongshinPriority}` +
    ` — JOHU_FIRST(조후 우선), EOKBU_FIRST(억부 우선), EQUAL_WEIGHT(동일 가중)`,
  );

  return yongshinReasoning;
}

export function buildDaeunReasoning(
  gender: Gender,
  yearCheongan: Cheongan,
  daeun: DaeunInfo,
  yongshin: YongshinResult,
  dayMasterOhaeng: Ohaeng,
): string[] {
  const genderKr = gender === Gender.MALE ? '남' : '여';
  const yearStemYinYang = EUMYANG_INFO[CHEONGAN_INFO[yearCheongan].eumyang].hangul;

  const daeunReasoning: string[] = [
    `${genderKr}명 + 년간 ${CHEONGAN_INFO[yearCheongan].hangul}(${yearStemYinYang}) ` +
    `→ ${daeun.isForward ? '순행: 월주에서 다음 간지 순서로 진행' : '역행: 월주에서 이전 간지 순서로 진행'}`,
    `생일~다음(이전) 절기까지 일수 ÷ 3 → 대운 시작: ${daeun.firstDaeunStartAge}세` +
    (daeun.firstDaeunStartMonths > 0 ? ` ${daeun.firstDaeunStartMonths}개월` : ''),
  ];

  if (daeun.daeunPillars.length > 0) {
    daeunReasoning.push('');
    daeunReasoning.push('【대운 개별 기둥 분석】');
    const yongshinEl = yongshin.finalYongshin;
    const gisinEl = yongshin.gisin;
    for (const dp of daeun.daeunPillars.slice(0, 8)) {
      const stemOh = CHEONGAN_INFO[dp.pillar.cheongan].ohaeng;
      const branchOh = JIJI_INFO[dp.pillar.jiji].ohaeng;
      const stemRel = OhaengRelations.relation(dayMasterOhaeng, stemOh);
      const branchRel = OhaengRelations.relation(dayMasterOhaeng, branchOh);
      const yongshinMatch = stemOh === yongshinEl || branchOh === yongshinEl;
      const gisinMatch = gisinEl != null && (stemOh === gisinEl || branchOh === gisinEl);
      const quality = yongshinMatch && !gisinMatch
        ? '길(吉)'
        : gisinMatch && !yongshinMatch
          ? '흉(凶)'
          : yongshinMatch && gisinMatch
            ? '길흉혼재'
            : '평(平)';
      daeunReasoning.push(
        `${dp.startAge}세 ${CHEONGAN_INFO[dp.pillar.cheongan].hangul}${JIJI_INFO[dp.pillar.jiji].hangul}` +
        `(${CHEONGAN_INFO[dp.pillar.cheongan].hanja}${JIJI_INFO[dp.pillar.jiji].hanja}): ` +
        `천간 ${ohaengKr(stemOh)}(${stemRel}), 지지 ${ohaengKr(branchOh)}(${branchRel}) ` +
        `→ ${quality}` +
        (yongshinMatch ? ` [용신 ${ohaengKr(yongshinEl)} 부합]` : '') +
        (gisinMatch ? ` [기신 ${ohaengKr(gisinEl!)} 부합]` : ''),
      );
    }
  }

  return daeunReasoning;
}

export function buildSaeunReasoning(
  saeun: readonly SaeunPillar[],
  pillars: PillarSet,
  yongshin: YongshinResult,
): string[] {
  const saeunReasoning: string[] = [
    '세운은 60갑자 순환에 따른 해당 연도의 천간·지지 기운입니다. ' +
    '기준점: 1984년=갑자(甲子)년, 60년 주기로 반복.',
  ];

  if (saeun.length > 0) {
    const first = saeun[0]!;
    saeunReasoning.push(
      `${first.year}년: ${CHEONGAN_INFO[first.pillar.cheongan].hangul}${JIJI_INFO[first.pillar.jiji].hangul}` +
      `(${CHEONGAN_INFO[first.pillar.cheongan].hanja}${JIJI_INFO[first.pillar.jiji].hanja})년 ` +
      `→ ${ohaengKr(CHEONGAN_INFO[first.pillar.cheongan].ohaeng)}·${ohaengKr(JIJI_INFO[first.pillar.jiji].ohaeng)} 기운`,
    );
    saeunReasoning.push('');
    saeunReasoning.push('【세운-원국 상호작용 (최근 5년)】');
    const yongshinEl = yongshin.finalYongshin;
    const gisinEl = yongshin.gisin;
    for (const sp of saeun.slice(0, 5)) {
      const stemOh = CHEONGAN_INFO[sp.pillar.cheongan].ohaeng;
      const branchOh = JIJI_INFO[sp.pillar.jiji].ohaeng;
      const interactions: string[] = [];
      for (const pos of PILLAR_POSITION_VALUES) {
        const natalPillar = pillarOf(pillars, pos);
        const natalStemInfo = CHEONGAN_INFO[natalPillar.cheongan];
        const spStemInfo = CHEONGAN_INFO[sp.pillar.cheongan];
        if (spStemInfo.eumyang === natalStemInfo.eumyang &&
          OhaengRelations.relation(spStemInfo.ohaeng, natalStemInfo.ohaeng) === OhaengRelation.SANGGEUK) {
          interactions.push(
            `${pos}천간충(${spStemInfo.hangul}↔${natalStemInfo.hangul})`,
          );
        }
        const branchDiff = Math.abs(jijiOrdinal(sp.pillar.jiji) - jijiOrdinal(natalPillar.jiji));
        if (branchDiff === 6) {
          interactions.push(
            `${pos}지지충(${JIJI_INFO[sp.pillar.jiji].hangul}↔${JIJI_INFO[natalPillar.jiji].hangul})`,
          );
        }
      }
      const yongshinMatch = stemOh === yongshinEl || branchOh === yongshinEl;
      const gisinMatch = gisinEl != null && (stemOh === gisinEl || branchOh === gisinEl);
      const quality = yongshinMatch && !gisinMatch
        ? '길'
        : gisinMatch && !yongshinMatch
          ? '흉'
          : yongshinMatch && gisinMatch
            ? '혼재'
            : '평';
      const interactionStr = interactions.length > 0
        ? ` | ${interactions.join(', ')}`
        : '';
      saeunReasoning.push(
        `${sp.year}년 ${CHEONGAN_INFO[sp.pillar.cheongan].hangul}${JIJI_INFO[sp.pillar.jiji].hangul}: ` +
        `${quality}${interactionStr}`,
      );
    }
  }

  return saeunReasoning;
}

