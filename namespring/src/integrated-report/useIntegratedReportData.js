import { useCallback, useMemo } from 'react';
import { buildRenderMetricsFromSajuReport } from '../naming-result-render-metrics';
import { buildSajuNameIntegrationSignals } from '@spring/report';
import {
  ELEMENT_KEYS, ELEMENT_LABEL, ELEMENT_GENERATES, ELEMENT_CONTROLS,
  ELEMENT_CODE_TO_SHORT, ELEMENT_HANJA,
  STEM_YANG_CODES, STEM_YIN_CODES, BRANCH_YANG_CODES, BRANCH_YIN_CODES,
  FRAME_TYPE_LABEL, FRAME_PERIOD_LABEL, GYEOKGUK_LABEL,
  normalizeElement, normalizeElementCode, elShort, elFull,
  scoreVerdict, formatScore, luckyLevelLabel,
} from './constants';

// ─────────────────────────────────────────────────────────────────────────────
//  통합 인사이트 계산
// ─────────────────────────────────────────────────────────────────────────────

function buildIntegrationInsights(springReport) {
  const sajuReport = springReport.sajuReport || {};
  const sajuCompat = springReport.sajuCompatibility || {};

  const yongshinEl = normalizeElementCode(sajuCompat.yongshinElement || sajuReport.yongshin?.element);
  const heeshinEl = normalizeElementCode(sajuCompat.heeshinElement || sajuReport.yongshin?.heeshin);
  const gishinEl = normalizeElementCode(sajuCompat.gishinElement || sajuReport.yongshin?.gishin);

  const nameElements = (sajuCompat.nameElements || []).map(normalizeElementCode).filter(Boolean);

  const deficientElements = Array.isArray(sajuReport.deficientElements)
    ? sajuReport.deficientElements : [];
  const excessiveElements = Array.isArray(sajuReport.excessiveElements)
    ? sajuReport.excessiveElements : [];

  try {
    return buildSajuNameIntegrationSignals({
      saju: {
        yongshinElement: yongshinEl,
        heeshinElement: heeshinEl,
        gishinElement: gishinEl,
        deficientElements,
        excessiveElements,
      },
      naming: { resourceElements: nameElements },
    });
  } catch {
    return {
      elementHarmonySummary: '이름과 사주의 관계를 분석 중입니다.',
      keySynergyStrengths: ['데이터 확인 후 시너지 포인트를 제공합니다.'],
      keyCautionPoints: ['데이터 확인 후 주의 포인트를 제공합니다.'],
      dailyActionSuggestions: ['오늘 일정은 핵심 3가지만 남기고 나머지는 비워보세요.'],
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  용신↔이름 관계 서술
// ─────────────────────────────────────────────────────────────────────────────

function describeYongshinNameRelation(yongshinEl, nameElements) {
  if (!yongshinEl || !nameElements.length) return null;

  const directMatch = nameElements.filter(e => e === yongshinEl).length;
  const generates = nameElements.filter(e => ELEMENT_GENERATES[e] === yongshinEl).length;
  const controls = nameElements.filter(e => ELEMENT_CONTROLS[e] === yongshinEl).length;

  const parts = [];
  if (directMatch > 0) {
    parts.push(`이름에 용신 ${elShort(yongshinEl)} 기운이 ${directMatch}회 직접 담겨 있어, 사주가 가장 필요로 하는 에너지를 곧바로 채워줍니다.`);
  }
  if (generates > 0) {
    parts.push(`이름 오행 중 ${generates}개가 용신 ${elShort(yongshinEl)}을(를) 생(生)하는 흐름이라, 필요한 기운을 부드럽게 키워주는 역할을 합니다.`);
  }
  if (controls > 0) {
    parts.push(`이름 오행 중 ${controls}개가 용신 ${elShort(yongshinEl)}을(를) 극(克)하는 흐름이 있어, 이 부분은 의식적으로 조율하면 좋습니다.`);
  }
  if (parts.length === 0) {
    parts.push(`이름 오행이 용신 ${elShort(yongshinEl)}과 직접적인 관계는 약하지만, 전체 균형 면에서 안정적인 구성입니다.`);
  }
  return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
//  대안 이름 추출
// ─────────────────────────────────────────────────────────────────────────────

function filterBetterCandidates(candidates, currentScore, currentHangul, maxCount = 5) {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];

  return candidates
    .filter(c => {
      const hangul = String(c.fullHangul ?? '').trim();
      const score = Number(c.finalScore ?? 0);
      return hangul && hangul !== currentHangul && score > currentScore;
    })
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
    .slice(0, maxCount);
}

// ─────────────────────────────────────────────────────────────────────────────
//  신규 계산 함수: 항목별 소점수
// ─────────────────────────────────────────────────────────────────────────────

export function computeSubScores(namingReport, sajuCompat) {
  const scores = namingReport?.scores || {};
  const items = [];

  const hangulScore = Number(scores.hangul);
  if (Number.isFinite(hangulScore)) items.push({ label: '발음', value: Math.round(hangulScore) });

  const hanjaScore = Number(scores.hanja);
  if (Number.isFinite(hanjaScore)) items.push({ label: '자원오행', value: Math.round(hanjaScore) });

  const fourFrameScore = Number(scores.fourFrame);
  if (Number.isFinite(fourFrameScore)) items.push({ label: '수리', value: Math.round(fourFrameScore) });

  const affinityScore = Number(sajuCompat?.affinityScore);
  if (Number.isFinite(affinityScore)) items.push({ label: '사주궁합', value: Math.round(affinityScore) });

  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
//  신규 계산 함수: 자원오행 상세
// ─────────────────────────────────────────────────────────────────────────────

function describeRelation(elCode, yongshinEl, heeshinEl, gishinEl) {
  if (!elCode || !yongshinEl) return { relation: 'neutral', verdict: '중립', tone: 'default' };

  if (elCode === yongshinEl) return { relation: 'direct', verdict: '용신 직접 부합', tone: 'good' };
  if (ELEMENT_GENERATES[elCode] === yongshinEl) return { relation: 'generates', verdict: '용신 상생', tone: 'good' };
  if (heeshinEl && elCode === heeshinEl) return { relation: 'heeshin', verdict: '희신 부합', tone: 'good' };
  if (gishinEl && elCode === gishinEl) return { relation: 'gishin', verdict: '기신 주의', tone: 'caution' };
  if (ELEMENT_CONTROLS[elCode] === yongshinEl) return { relation: 'controls', verdict: '용신 상극', tone: 'caution' };

  return { relation: 'neutral', verdict: '중립', tone: 'default' };
}

function buildRelationNarrative(elCode, yongshinEl, relation) {
  const elLabel = elFull(elCode);
  const yongLabel = elFull(yongshinEl);
  if (relation === 'direct') return `자원오행 ${elLabel}은(는) 용신 ${yongLabel}과(와) 동일해 사주에 꼭 필요한 기운을 직접 담고 있어요.`;
  if (relation === 'generates') return `자원오행 ${elLabel}은(는) 용신 ${yongLabel}을(를) 생(生)하는 관계라 필요한 기운을 부드럽게 키워줘요.`;
  if (relation === 'heeshin') return `자원오행 ${elLabel}은(는) 희신과 일치해 사주를 보조적으로 돕는 역할이에요.`;
  if (relation === 'gishin') return `자원오행 ${elLabel}은(는) 기신과 일치해 주의가 필요해요.`;
  if (relation === 'controls') return `자원오행 ${elLabel}은(는) 용신 ${yongLabel}을(를) 극(克)하는 관계라 주의가 필요해요.`;
  return `자원오행 ${elLabel}은(는) 용신과 직접적 관계는 약하지만 전체 균형에 기여해요.`;
}

export function computeResourceElementDetails(hanjaBlocks, yongshinEl, heeshinEl, gishinEl) {
  if (!Array.isArray(hanjaBlocks) || hanjaBlocks.length === 0 || !yongshinEl) return null;

  return hanjaBlocks.map(block => {
    const resourceEl = normalizeElementCode(block.resourceElement);
    const strokeEl = normalizeElementCode(block.strokeElement);
    const { relation, verdict, tone } = describeRelation(resourceEl, yongshinEl, heeshinEl, gishinEl);
    const narrative = buildRelationNarrative(resourceEl, yongshinEl, relation);
    const elMatch = resourceEl && strokeEl ? (resourceEl === strokeEl) : null;

    return {
      hanja: block.hanja || '',
      hangul: block.hangul || '',
      strokes: block.strokes || 0,
      polarity: block.polarity || '',
      resourceEl,
      strokeEl,
      relation,
      verdict,
      tone,
      narrative,
      elMatch,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  신규 계산 함수: 사격수리 운세
// ─────────────────────────────────────────────────────────────────────────────

export function computeFourFrameAnalysis(frames, yongshinEl) {
  if (!Array.isArray(frames) || frames.length === 0) return null;

  const analyzed = frames.map(frame => {
    const frameEl = normalizeElementCode(frame.element);
    const { relation, verdict, tone } = describeRelation(frameEl, yongshinEl, null, null);
    const label = FRAME_TYPE_LABEL[frame.type] || frame.type;
    const period = FRAME_PERIOD_LABEL[frame.type] || '';
    const lucky = luckyLevelLabel(frame.luckyLevel);

    return {
      type: frame.type,
      label,
      period,
      strokeSum: frame.strokeSum || 0,
      element: frameEl,
      polarity: frame.polarity || '',
      luckyLevel: frame.luckyLevel ?? 0,
      luckyLabel: lucky,
      yongshinRelation: verdict,
      yongshinTone: tone,
      meaning: frame.meaning || null,
    };
  });

  // 흐름 서술문
  const narrativeParts = [];
  const goodFrames = analyzed.filter(f => f.luckyLevel >= 20);
  const badFrames = analyzed.filter(f => f.luckyLevel < 15);

  if (goodFrames.length === analyzed.length) {
    narrativeParts.push('모든 시기의 수리가 길하여, 인생 전반에 걸쳐 안정적인 운세 흐름을 가지고 있어요.');
  } else if (badFrames.length === analyzed.length) {
    narrativeParts.push('수리적으로 보완이 필요한 흐름이지만, 이름의 다른 요소와 생활 보완으로 충분히 균형을 맞출 수 있어요.');
  } else {
    if (goodFrames.length > 0) {
      const goodPeriods = goodFrames.map(f => f.label).join('·');
      narrativeParts.push(`${goodPeriods}의 수리가 길해 해당 시기에 좋은 흐름을 받아요.`);
    }
    if (badFrames.length > 0) {
      const badPeriods = badFrames.map(f => f.label).join('·');
      narrativeParts.push(`${badPeriods}은 수리적으로 보완이 필요하나 의식적인 노력으로 극복할 수 있어요.`);
    }
  }

  const yongMatches = analyzed.filter(f => f.yongshinTone === 'good');
  if (yongMatches.length > 0 && yongshinEl) {
    narrativeParts.push(`수리오행 중 ${yongMatches.length}개가 용신 ${elShort(yongshinEl)}과(와) 좋은 관계에요.`);
  }

  return { frames: analyzed, flowNarrative: narrativeParts.join(' ') };
}

// ─────────────────────────────────────────────────────────────────────────────
//  신규 계산 함수: 음양 조화
// ─────────────────────────────────────────────────────────────────────────────

export function computeYinYangHarmony(hanjaBlocks, sajuPillars) {
  if (!Array.isArray(hanjaBlocks) || hanjaBlocks.length === 0) return null;

  // 이름 음양 패턴
  const namePattern = hanjaBlocks.map(block => {
    const p = String(block.polarity ?? '').trim().toLowerCase();
    if (p === 'yang' || p === '양' || p === 'positive') return '양';
    if (p === 'yin' || p === '음' || p === 'negative') return '음';
    return Number(block.strokes) % 2 === 1 ? '양' : '음';
  });

  const nameYang = namePattern.filter(p => p === '양').length;
  const nameYin = namePattern.filter(p => p === '음').length;

  // 사주 음양 수치
  let sajuYang = 0;
  let sajuYin = 0;
  const pillarKeys = ['year', 'month', 'day', 'hour'];

  if (sajuPillars) {
    for (const key of pillarKeys) {
      const pillar = sajuPillars[key];
      if (!pillar) continue;
      const stemCode = String(pillar?.stem?.code ?? '').trim().toUpperCase();
      if (STEM_YANG_CODES.has(stemCode)) sajuYang += 1;
      else if (STEM_YIN_CODES.has(stemCode)) sajuYin += 1;

      const branchCode = String(pillar?.branch?.code ?? '').trim().toUpperCase();
      if (BRANCH_YANG_CODES.has(branchCode)) sajuYang += 1;
      else if (BRANCH_YIN_CODES.has(branchCode)) sajuYin += 1;
    }
  }

  const totalYang = nameYang + sajuYang;
  const totalYin = nameYin + sajuYin;

  // 이름 교차 패턴 판정
  let isAlternating = true;
  for (let i = 1; i < namePattern.length; i++) {
    if (namePattern[i] === namePattern[i - 1]) { isAlternating = false; break; }
  }
  const patternVerdict = isAlternating ? '교차 배열 (길)' : (
    namePattern.every(p => p === namePattern[0]) ? '동일 배열 (보통)' : '혼합 배열 (보통)'
  );

  // 종합 판정
  let balanceLabel;
  const diff = Math.abs(totalYang - totalYin);
  if (diff <= 2) balanceLabel = '양음 균형';
  else if (totalYang > totalYin) balanceLabel = '양 우세';
  else balanceLabel = '음 우세';

  // 서술문
  let narrative;
  if (sajuYang > sajuYin + 2 && nameYin >= nameYang) {
    narrative = `사주가 양 우세인데, 이름의 음 기운이 이를 보완해 전체 균형을 맞춰줘요.`;
  } else if (sajuYin > sajuYang + 2 && nameYang >= nameYin) {
    narrative = `사주가 음 우세인데, 이름의 양 기운이 이를 보완해 전체 균형을 맞춰줘요.`;
  } else if (diff <= 2) {
    narrative = `이름과 사주를 합산하면 음양이 고르게 분포되어 안정적인 균형을 이루고 있어요.`;
  } else if (totalYang > totalYin) {
    narrative = `전체적으로 양 기운이 다소 우세해요. 차분하고 안정적인 환경이 보완에 도움이 돼요.`;
  } else {
    narrative = `전체적으로 음 기운이 다소 우세해요. 적극적인 활동이 균형을 맞추는 데 도움이 돼요.`;
  }

  return {
    namePattern,
    nameYang,
    nameYin,
    sajuYang,
    sajuYin,
    totalYang,
    totalYin,
    isAlternating,
    patternVerdict,
    balanceLabel,
    narrative,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  신규 계산 함수: 사주 체질과 이름
// ─────────────────────────────────────────────────────────────────────────────

export function computeSajuStructureInsight(strength, gyeokguk, yongshin, nameElements, dayMasterElement) {
  if (!strength) return null;

  const totalSupport = Number(strength.totalSupport ?? 0);
  const totalOppose = Number(strength.totalOppose ?? 0);
  const total = totalSupport + totalOppose;
  const strengthPct = total > 0 ? Math.round((totalSupport / total) * 100) : 50;

  const level = strength.level || (strength.isStrong ? '신강' : '신약');
  const isStrong = level === '신강' || strength.isStrong === true;

  const gyeokgukType = gyeokguk?.type || '';
  const gyeokgukLabel = GYEOKGUK_LABEL[gyeokgukType] || gyeokgukType || '미확인';

  // 이름 역할 판정
  const yongshinEl = normalizeElementCode(yongshin?.element);
  const dmEl = normalizeElementCode(dayMasterElement);

  let roleNeeded;
  if (isStrong) {
    roleNeeded = '설기(泄氣) · 극제(克制)';
  } else {
    roleNeeded = '생조(生助) · 부조(扶助)';
  }

  // 이름 오행의 역할 부합 여부
  let roleFit = false;
  let roleNarrative = '';

  if (yongshinEl && Array.isArray(nameElements) && nameElements.length > 0) {
    const matchCount = nameElements.filter(e => {
      const el = normalizeElementCode(e);
      if (!el) return false;
      if (el === yongshinEl) return true;
      if (ELEMENT_GENERATES[el] === yongshinEl) return true;
      return false;
    }).length;

    roleFit = matchCount > 0;

    if (roleFit && dmEl) {
      const dmLabel = elFull(normalizeElementCode(dmEl));
      const yongLabel = elFull(yongshinEl);
      if (isStrong) {
        roleNarrative = `사주가 신강이므로 기운을 분산시키는 오행이 중요해요. 이름에 용신 ${elShort(yongshinEl)} 계열 기운이 포함되어 사주 체질과 잘 맞습니다.`;
      } else {
        roleNarrative = `사주가 신약이므로 일간에 힘을 보태는 오행이 중요해요. 이름에 용신 ${elShort(yongshinEl)} 계열 기운이 포함되어 일간 ${dmLabel}을(를) 돕는 흐름이 사주 체질과 잘 맞습니다.`;
      }
    } else {
      if (isStrong) {
        roleNarrative = `사주가 신강이므로 기운을 분산시키는 오행이 이상적이에요. 이름 오행이 용신과 직접 부합하지는 않지만, 전체 균형에서 무난한 구성이에요.`;
      } else {
        roleNarrative = `사주가 신약이므로 일간을 돕는 오행이 이상적이에요. 이름 오행이 용신과 직접 부합하지는 않지만, 전체 균형에서 무난한 구성이에요.`;
      }
    }
  } else {
    roleNarrative = `사주 체질은 ${level}이며, ${roleNeeded} 역할의 오행이 이름에 담기면 이상적이에요.`;
  }

  return {
    strengthPct,
    level,
    isStrong,
    gyeokgukType,
    gyeokgukLabel,
    roleNeeded,
    roleFit,
    roleNarrative,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  신규 계산 함수: 발음오행 흐름
// ─────────────────────────────────────────────────────────────────────────────

export function computePronunciationFlow(hangulBlocks) {
  if (!Array.isArray(hangulBlocks) || hangulBlocks.length === 0) return null;

  const elements = hangulBlocks.map(block => ({
    hangul: block.hangul || '',
    onset: block.onset || '',
    element: normalizeElementCode(block.element),
  })).filter(e => e.element);

  if (elements.length < 2) return null;

  const pairRelations = [];
  for (let i = 0; i < elements.length - 1; i++) {
    const from = elements[i].element;
    const to = elements[i + 1].element;

    let relation;
    if (from === to) relation = '비화';
    else if (ELEMENT_GENERATES[from] === to) relation = '상생';
    else if (ELEMENT_GENERATES[to] === from) relation = '역생';
    else if (ELEMENT_CONTROLS[from] === to) relation = '상극';
    else if (ELEMENT_CONTROLS[to] === from) relation = '역극';
    else relation = '간접';

    pairRelations.push({ from, to, relation });
  }

  const goodCount = pairRelations.filter(p => p.relation === '상생' || p.relation === '비화').length;
  const badCount = pairRelations.filter(p => p.relation === '상극' || p.relation === '역극').length;

  let summary;
  if (goodCount === pairRelations.length) {
    const uniqueEls = new Set(elements.map(e => e.element));
    if (uniqueEls.size === 1) {
      summary = '초성이 동일 오행으로 안정적이나, 다양성이 부족해요.';
    } else {
      summary = '초성 오행이 상생 흐름으로 이어져 발음의 기운이 조화롭게 흘러요.';
    }
  } else if (badCount === 0) {
    summary = '초성 오행 사이에 충돌이 없어 전체적으로 무난한 발음 흐름이에요.';
  } else if (badCount > goodCount) {
    summary = '초성 오행에 상극이 포함되어, 발음 기운의 흐름에 보완이 필요해요.';
  } else {
    summary = '초성 오행에 상생과 상극이 혼재해, 역동적인 발음 흐름을 가져요.';
  }

  return { elements, pairRelations, summary };
}

// ─────────────────────────────────────────────────────────────────────────────
//  메인 커스텀 훅
// ─────────────────────────────────────────────────────────────────────────────

export default function useIntegratedReportData(springReport, candidates) {
  const namingReport = springReport?.namingReport || {};
  const sajuReport = springReport?.sajuReport || {};
  const sajuCompatRaw = springReport?.sajuCompatibility;
  const finalScore = Number(springReport?.finalScore || 0);

  const fullHangul = namingReport?.name?.fullHangul || '-';
  const fullHanja = namingReport?.name?.fullHanja || '-';

  // ── sajuCompat 안정화 ─────────────────────────────────────────
  const sajuCompat = useMemo(() => sajuCompatRaw || {}, [sajuCompatRaw]);

  // ── 통합 인사이트 ──────────────────────────────────────────────
  const insights = useMemo(() => {
    if (!springReport) return null;
    return buildIntegrationInsights(springReport);
  }, [springReport]);

  // ── 용신 / 희신 / 기신 / 이름오행 ────────────────────────────
  const yongshinEl = normalizeElementCode(sajuCompat.yongshinElement || sajuReport.yongshin?.element);
  const heeshinEl = normalizeElementCode(sajuCompat.heeshinElement || sajuReport.yongshin?.heeshin);
  const gishinEl = normalizeElementCode(sajuCompat.gishinElement || sajuReport.yongshin?.gishin);
  const nameElements = useMemo(
    () => (sajuCompat.nameElements || []).map(normalizeElementCode).filter(Boolean),
    [sajuCompat],
  );

  const yongshinNameRelation = useMemo(
    () => describeYongshinNameRelation(yongshinEl, nameElements),
    [yongshinEl, nameElements],
  );

  // ── 일간 정보 ─────────────────────────────────────────────────
  const dayMasterStem = sajuReport.dayMaster?.stem || sajuReport.pillars?.day?.stem?.hangul || '-';
  const dayMasterElement = normalizeElement(sajuReport.dayMaster?.element);
  const strengthLevel = sajuReport.strength?.level || (sajuReport.strength?.isStrong ? '신강' : '신약');

  // ── 통합 오행 분포 (가중치 적용: 점수판정·통합밸런스 표시용) ──
  const combinedDistributionRows = useMemo(() => {
    const source = springReport?.combinedDistribution || {};
    return ELEMENT_KEYS.map(key => ({
      key,
      label: ELEMENT_LABEL[key],
      value: Number(source[key] ?? 0),
    }));
  }, [springReport]);

  const combinedDistMax = useMemo(() => {
    const vals = combinedDistributionRows.map(r => r.value).filter(Number.isFinite);
    const max = vals.length ? Math.max(...vals) : 0;
    return max > 0 ? max : 1;
  }, [combinedDistributionRows]);

  // ── 이름카드 메트릭스 ─────────────────────────────────────────
  const nameCardRenderMetrics = useMemo(
    () => buildRenderMetricsFromSajuReport(sajuReport, {
      displayHangul: fullHangul === '-' ? '' : fullHangul,
      displayHanja: fullHanja === '-' ? '' : fullHanja,
      score: finalScore,
    }),
    [sajuReport, fullHangul, fullHanja, finalScore],
  );

  // ── 대안 이름 ─────────────────────────────────────────────────
  const betterCandidates = useMemo(
    () => filterBetterCandidates(candidates, finalScore, fullHangul),
    [candidates, finalScore, fullHangul],
  );

  // ── 핵심 한줄 판정문 ──────────────────────────────────────────
  const verdictLine = useMemo(() => {
    if (!yongshinEl) return scoreVerdict(finalScore);
    const yongMatch = sajuCompat.yongshinMatchCount ?? 0;
    if (yongMatch > 0) {
      return `이 이름은 사주의 용신(${elShort(yongshinEl)}) 기운을 직접 품고 있어 핵심 균형을 든든하게 받쳐줍니다.`;
    }
    const nameGenerates = nameElements.filter(e => ELEMENT_GENERATES[e] === yongshinEl).length;
    if (nameGenerates > 0) {
      return `이 이름은 용신(${elShort(yongshinEl)})을 생(生)하는 기운을 담고 있어, 필요한 에너지를 부드럽게 채워줍니다.`;
    }
    return `이 이름은 사주와 전체적으로 무난한 균형을 이루며, 몇 가지 생활 보완으로 더 좋아질 수 있어요.`;
  }, [yongshinEl, nameElements, sajuCompat, finalScore]);

  // ── 항목별 소점수 ─────────────────────────────────────────────
  const subScores = useMemo(
    () => computeSubScores(namingReport, sajuCompat),
    [namingReport, sajuCompat],
  );

  // ── 자원오행 상세 ─────────────────────────────────────────────
  const resourceElementDetails = useMemo(
    () => computeResourceElementDetails(
      namingReport?.analysis?.hanja?.blocks,
      yongshinEl, heeshinEl, gishinEl,
    ),
    [namingReport, yongshinEl, heeshinEl, gishinEl],
  );

  // ── 사격수리 분석 ─────────────────────────────────────────────
  const fourFrameAnalysis = useMemo(
    () => computeFourFrameAnalysis(namingReport?.analysis?.fourFrame?.frames, yongshinEl),
    [namingReport, yongshinEl],
  );

  // ── 음양 조화 ─────────────────────────────────────────────────
  const yinYangHarmony = useMemo(
    () => computeYinYangHarmony(
      namingReport?.analysis?.hanja?.blocks,
      sajuReport?.pillars,
    ),
    [namingReport, sajuReport],
  );

  // ── 사주 체질과 이름 ──────────────────────────────────────────
  const sajuStructureInsight = useMemo(
    () => computeSajuStructureInsight(
      sajuReport?.strength,
      sajuReport?.gyeokguk,
      sajuReport?.yongshin,
      nameElements,
      sajuReport?.dayMaster?.element,
    ),
    [sajuReport, nameElements],
  );

  // ── 발음오행 흐름 ─────────────────────────────────────────────
  const pronunciationFlow = useMemo(
    () => computePronunciationFlow(namingReport?.analysis?.hangul?.blocks),
    [namingReport],
  );

  // ── 결핍/과다 오행 ────────────────────────────────────────────
  const deficientElements = useMemo(
    () => (Array.isArray(sajuReport.deficientElements) ? sajuReport.deficientElements : []).map(normalizeElementCode).filter(Boolean),
    [sajuReport],
  );
  const excessiveElements = useMemo(
    () => (Array.isArray(sajuReport.excessiveElements) ? sajuReport.excessiveElements : []).map(normalizeElementCode).filter(Boolean),
    [sajuReport],
  );

  // ── 이름 인기도/성별 ────────────────────────────────────────
  const popularityRank = springReport?.popularityRank ?? null;
  const maleRatio = springReport?.maleRatio ?? null;
  const nameGender = springReport?.nameGender ?? null;

  // ── 신강/신약 세부 근거 ────────────────────────────────────
  const strengthDetails = useMemo(() => {
    const s = sajuReport?.strength;
    if (!s) return null;
    return {
      deukryeong: s.deukryeong ?? null,
      deukji: s.deukji ?? null,
      deukse: s.deukse ?? null,
      details: Array.isArray(s.details) ? s.details : [],
    };
  }, [sajuReport]);

  // ── 격국 판정 근거 ─────────────────────────────────────────
  const gyeokgukDetail = useMemo(() => {
    const g = sajuReport?.gyeokguk;
    if (!g) return null;
    return {
      reasoning: g.reasoning || '',
      confidence: g.confidence ?? null,
    };
  }, [sajuReport]);

  // ── 용신 실천 추천 ─────────────────────────────────────────
  const yongshinRecommendations = useMemo(
    () => Array.isArray(sajuReport?.yongshin?.recommendations) ? sajuReport.yongshin.recommendations : [],
    [sajuReport],
  );

  // ── 인쇄 콜백 ─────────────────────────────────────────────────
  const prepareBeforePrint = useCallback(() => ({}), []);
  const restoreAfterPrint = useCallback(() => {}, []);

  return {
    namingReport,
    sajuReport,
    sajuCompat,
    finalScore,
    fullHangul,
    fullHanja,
    insights,
    yongshinEl,
    heeshinEl,
    gishinEl,
    nameElements,
    yongshinNameRelation,
    dayMasterStem,
    dayMasterElement,
    strengthLevel,
    combinedDistributionRows,
    combinedDistMax,
    nameCardRenderMetrics,
    betterCandidates,
    verdictLine,
    subScores,
    resourceElementDetails,
    fourFrameAnalysis,
    yinYangHarmony,
    sajuStructureInsight,
    pronunciationFlow,
    deficientElements,
    excessiveElements,
    popularityRank,
    maleRatio,
    nameGender,
    strengthDetails,
    gyeokgukDetail,
    yongshinRecommendations,
    prepareBeforePrint,
    restoreAfterPrint,
  };
}
