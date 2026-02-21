/**
 * section-fortuneCycles.ts -- Daeun (major luck cycles) and Saeun (yearly luck)
 *
 * Generates the '대운과 세운 흐름' section of the premium saju report.
 * This is one of the most important analytical sections: it maps each 10-year
 * daeun period and each yearly saeun pillar against the user's yongshin to
 * produce a match-grade assessment, timeline chart, and actionable highlights.
 *
 * Returns null when daeunInfo is absent or contains no pillars.
 */

import type {
  SajuSummary,
  BirthInfo,
  PremiumReportSection,
  ElementCode,
  ReportHighlight,
  ReportParagraph,
  ReportTable,
  ReportChart,
  ReportSubsection,
  YongshinMatchGrade,
} from '../types.js';
import {
  SeededRandom,
  pickAndFill,
  narrative,
  positive,
  encouraging,
  caution,
  tip,
  emphasis,
  joinSentences,
} from '../common/sentenceUtils.js';
import {
  ELEMENT_KOREAN,
  ELEMENT_KOREAN_SHORT,
  lookupStemInfo,
  lookupBranchInfo,
  elementCodeToKorean,
  getYongshinMatchGrade,
  YONGSHIN_GRADE_STARS,
  YONGSHIN_GRADE_DESC,
} from '../common/elementMaps.js';

// ---------------------------------------------------------------------------
//  Element code normalisation (same pattern as other section files)
// ---------------------------------------------------------------------------

const ALL_ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

const FIRST_CHAR_TO_ELEMENT: Readonly<Record<string, ElementCode>> = {
  '목': 'WOOD', '화': 'FIRE', '토': 'EARTH', '금': 'METAL', '수': 'WATER',
};

function normalizeElement(code: string): ElementCode | null {
  const upper = code.toUpperCase();
  if ((ALL_ELEMENTS as readonly string[]).includes(upper)) return upper as ElementCode;
  return FIRST_CHAR_TO_ELEMENT[code.charAt(0)] ?? null;
}

// ---------------------------------------------------------------------------
//  Interfaces for daeun / saeun data (extracted from SajuSummary via [key])
// ---------------------------------------------------------------------------

interface DaeunPillar {
  stem: string;
  branch: string;
  startAge: number;
  endAge: number;
  order: number;
}

interface DaeunInfo {
  isForward: boolean;
  firstDaeunStartAge: number;
  firstDaeunStartMonths: number;
  boundaryMode: string;
  warnings: string[];
  pillars: DaeunPillar[];
}

interface SaeunPillar {
  year: number;
  stem: string;
  branch: string;
}

// ---------------------------------------------------------------------------
//  Template banks
// ---------------------------------------------------------------------------

const OVERVIEW_TEMPLATES = [
  '대운(大運)은 10년 단위로 바뀌는 큰 흐름의 운이에요. 이 사주는 {{direction}} 대운으로, 만 {{startAge}}세(약 {{startMonths}}개월)부터 첫 대운이 시작됩니다.',
  '10년마다 한 번씩 전환되는 대운(大運)은 인생의 큰 물줄기와 같아요. {{direction}} 대운 구조이며, 만 {{startAge}}세({{startMonths}}개월 경)부터 본격적인 대운 흐름이 시작돼요.',
  '사주의 큰 운세 흐름인 대운(大運)을 살펴볼게요. {{direction}} 방향으로 흐르며, 첫 대운 진입 시기는 만 {{startAge}}세(약 {{startMonths}}개월)입니다.',
] as const;

const DIRECTION_LABELS: Record<string, string> = {
  true: '순행(順行)',
  false: '역행(逆行)',
};

const CURRENT_DAEUN_TEMPLATES = [
  '현재 {{currentAge}}세로, {{stemHangul}}{{branchHangul}} 대운({{startAge}}~{{endAge}}세)이 진행 중이에요. 이 대운의 주 오행은 {{elementKorean}}이며, 용신 부합도는 {{grade}}({{gradeDesc}})입니다.',
  '지금은 만 {{currentAge}}세에 해당하며, {{stemHangul}}{{branchHangul}} 대운({{startAge}}~{{endAge}}세) 시기를 지나고 있어요. {{elementKorean}} 기운의 대운으로, 용신 부합도는 {{grade}}({{gradeDesc}})예요.',
  '현재 나이 만 {{currentAge}}세 기준으로, {{stemHangul}}{{branchHangul}} 대운({{startAge}}~{{endAge}}세)에 해당합니다. 대운 오행은 {{elementKorean}}, 용신 부합도는 {{grade}}({{gradeDesc}})이에요.',
] as const;

const GOOD_DAEUN_TEMPLATES = [
  '용신과 잘 맞는 대운 시기이므로, 적극적으로 기회를 잡아 나가면 좋겠어요.',
  '용신 기운이 잘 유입되는 시기예요. 자신감을 갖고 도전하면 좋은 결실을 맺을 수 있어요.',
  '에너지 흐름이 순조로운 대운이에요. 이 시기에 중요한 결정을 내려도 좋아요.',
] as const;

const NEUTRAL_DAEUN_TEMPLATES = [
  '보통 수준의 기운이 흐르는 시기예요. 무리하지 않고 꾸준히 준비하면 좋은 결과를 기대할 수 있어요.',
  '특별히 좋거나 나쁘지 않은 평탄한 흐름이에요. 내면을 다지고 실력을 쌓아가는 시기로 활용하면 좋겠어요.',
] as const;

const CAUTION_DAEUN_TEMPLATES = [
  '주의가 필요한 기운이 흐르는 대운이에요. 큰 결정은 신중하게, 건강관리에 더 신경 써주세요.',
  '용신과 맞지 않는 기운이 강한 시기예요. 무리한 투자나 변화보다는 안정을 추구하는 것이 좋아요.',
] as const;

const SAEUN_OVERVIEW_TEMPLATES = [
  '세운(歲運)은 매년 바뀌는 한 해의 운세예요. 아래에서 각 연도별 오행과 용신 부합도를 확인해 보세요.',
  '해마다 달라지는 세운(歲運)은 그 해의 전반적인 기운을 보여줍니다. 연도별 흐름을 살펴볼게요.',
  '세운(歲運)은 1년 단위로 흐르는 운세의 흐름이에요. 각 연도의 오행이 용신과 얼마나 부합하는지 확인해 보세요.',
] as const;

const CURRENT_YEAR_TEMPLATES = [
  '올해({{year}}년)는 {{stemHangul}}{{branchHangul}}년으로, {{elementKorean}} 기운이 흐르고 있어요. 용신 부합도는 {{grade}}({{gradeDesc}})입니다.',
  '{{year}}년 세운은 {{stemHangul}}{{branchHangul}}이며 {{elementKorean}} 오행에 해당해요. 용신 부합도 {{grade}}({{gradeDesc}})의 한 해예요.',
] as const;

// ---------------------------------------------------------------------------
//  Helper: resolve stem element from raw stem code/hangul
// ---------------------------------------------------------------------------

function resolveStemElement(stemRaw: string): ElementCode | null {
  const info = lookupStemInfo(stemRaw);
  if (info) return info.element;
  // Fallback: try normalizing directly (rare but possible)
  return normalizeElement(stemRaw);
}

// ---------------------------------------------------------------------------
//  Helper: compute yongshin match grade from saju yongshin data
// ---------------------------------------------------------------------------

function computeGrade(
  targetElement: ElementCode,
  saju: SajuSummary,
): YongshinMatchGrade {
  const { yongshin } = saju;
  return getYongshinMatchGrade(
    targetElement,
    normalizeElement(yongshin.element) ?? null,
    yongshin.heeshin ? normalizeElement(yongshin.heeshin) : null,
    null, // hansin not available at top level
    yongshin.gushin ? normalizeElement(yongshin.gushin) : null,
    yongshin.gishin ? normalizeElement(yongshin.gishin) : null,
  );
}

// ---------------------------------------------------------------------------
//  Main generator
// ---------------------------------------------------------------------------

export function generateFortuneCyclesSection(
  saju: SajuSummary,
  birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  // 1. Guard: must have daeun data with at least one pillar
  const daeunInfo = saju.daeunInfo as DaeunInfo | null | undefined;
  if (!daeunInfo || !daeunInfo.pillars || daeunInfo.pillars.length === 0) {
    return null;
  }

  const CURRENT_YEAR = 2026;
  const saeunPillarsRaw = (saju.saeunPillars ?? []) as SaeunPillar[];
  const saeunPillars = saeunPillarsRaw.filter(sp => {
    // Only show years within +/- 10 of current year
    if (sp.year < CURRENT_YEAR - 10 || sp.year > CURRENT_YEAR + 10) return false;
    // Exclude years before the person was born
    if (birth.year != null && sp.year - birth.year < 0) return false;
    return true;
  });

  // ---- Top-level paragraphs ----
  const paragraphs: ReportParagraph[] = [];

  const directionLabel = DIRECTION_LABELS[String(daeunInfo.isForward)] ?? '순행(順行)';
  paragraphs.push(
    narrative(
      pickAndFill(rng, OVERVIEW_TEMPLATES, {
        direction: directionLabel,
        startAge: Math.round(daeunInfo.firstDaeunStartAge * 10) / 10,
        startMonths: Math.round(daeunInfo.firstDaeunStartMonths),
      }),
    ),
  );

  // ---- Daeun subsection ----
  const daeunParagraphs: ReportParagraph[] = [];
  const daeunTableRows: string[][] = [];
  const timelineData: Record<string, number | string> = {};

  for (const pillar of daeunInfo.pillars) {
    const stemInfo = lookupStemInfo(pillar.stem);
    const branchInfo = lookupBranchInfo(pillar.branch);

    const stemHangul = stemInfo?.hangul ?? pillar.stem;
    const branchHangul = branchInfo?.hangul ?? pillar.branch;
    const daeunElement = stemInfo?.element ?? resolveStemElement(pillar.stem);

    let gradeValue: YongshinMatchGrade = 3;
    let elementLabel = '?';

    if (daeunElement) {
      gradeValue = computeGrade(daeunElement, saju);
      elementLabel = ELEMENT_KOREAN_SHORT[daeunElement] ?? elementCodeToKorean(pillar.stem);
    }

    const stars = YONGSHIN_GRADE_STARS[gradeValue];
    const roundedStartAge = Math.round(pillar.startAge);
    const roundedEndAge = Math.round(pillar.endAge);
    const ageRange = `${roundedStartAge}~${roundedEndAge}세`;

    daeunTableRows.push([
      String(pillar.order),
      `${stemHangul}${branchHangul}`,
      ageRange,
      elementLabel,
      stars,
    ]);

    // Timeline data: label is the age range, value is grade
    timelineData[`${stemHangul}${branchHangul}(${ageRange})`] = gradeValue;
  }

  const daeunTable: ReportTable = {
    title: '대운 일람표',
    headers: ['순서', '대운', '나이', '오행', '용신 부합도'],
    rows: daeunTableRows,
  };

  const daeunChart: ReportChart = {
    type: 'timeline',
    title: '대운 용신 부합도 흐름',
    data: timelineData,
  };

  // Find current daeun
  const currentAge = birth.year != null ? CURRENT_YEAR - birth.year : null;
  const currentDaeun = currentAge != null
    ? daeunInfo.pillars.find(p => currentAge >= p.startAge && currentAge <= p.endAge)
    : null;

  if (currentDaeun && currentAge != null) {
    const cStemInfo = lookupStemInfo(currentDaeun.stem);
    const cBranchInfo = lookupBranchInfo(currentDaeun.branch);
    const cStemHangul = cStemInfo?.hangul ?? currentDaeun.stem;
    const cBranchHangul = cBranchInfo?.hangul ?? currentDaeun.branch;
    const cElement = cStemInfo?.element ?? resolveStemElement(currentDaeun.stem);
    const cGrade: YongshinMatchGrade = cElement ? computeGrade(cElement, saju) : 3;
    const cElementLabel = cElement
      ? (ELEMENT_KOREAN[cElement] ?? elementCodeToKorean(currentDaeun.stem))
      : '?';

    daeunParagraphs.push(
      emphasis(
        pickAndFill(rng, CURRENT_DAEUN_TEMPLATES, {
          currentAge,
          stemHangul: cStemHangul,
          branchHangul: cBranchHangul,
          startAge: Math.round(currentDaeun.startAge),
          endAge: Math.round(currentDaeun.endAge),
          elementKorean: cElementLabel,
          grade: YONGSHIN_GRADE_STARS[cGrade],
          gradeDesc: YONGSHIN_GRADE_DESC[cGrade],
        }),
      ),
    );

    // Add contextual advice based on the grade
    if (cGrade >= 4) {
      daeunParagraphs.push(encouraging(pickAndFill(rng, GOOD_DAEUN_TEMPLATES)));
    } else if (cGrade === 3) {
      daeunParagraphs.push(narrative(pickAndFill(rng, NEUTRAL_DAEUN_TEMPLATES)));
    } else {
      daeunParagraphs.push(caution(pickAndFill(rng, CAUTION_DAEUN_TEMPLATES)));
    }
  }

  const daeunSubsection: ReportSubsection = {
    title: '대운 (10년 주기 운세)',
    paragraphs: daeunParagraphs,
    tables: [daeunTable],
    charts: [daeunChart],
  };

  // ---- Saeun subsection (if available) ----
  const subsections: ReportSubsection[] = [daeunSubsection];

  if (saeunPillars.length > 0) {
    const saeunParagraphs: ReportParagraph[] = [];
    saeunParagraphs.push(
      narrative(pickAndFill(rng, SAEUN_OVERVIEW_TEMPLATES)),
    );

    const saeunTableRows: string[][] = [];
    let currentYearGrade: YongshinMatchGrade | null = null;

    for (const sp of saeunPillars) {
      const sStemInfo = lookupStemInfo(sp.stem);
      const sBranchInfo = lookupBranchInfo(sp.branch);
      const sStemHangul = sStemInfo?.hangul ?? sp.stem;
      const sBranchHangul = sBranchInfo?.hangul ?? sp.branch;
      const sElement = sStemInfo?.element ?? resolveStemElement(sp.stem);

      let sGrade: YongshinMatchGrade = 3;
      let sElementLabel = '?';

      if (sElement) {
        sGrade = computeGrade(sElement, saju);
        sElementLabel = ELEMENT_KOREAN_SHORT[sElement] ?? elementCodeToKorean(sp.stem);
      }

      const yearLabel = sp.year === CURRENT_YEAR ? `${sp.year} (올해)` : String(sp.year);

      saeunTableRows.push([
        yearLabel,
        `${sStemHangul}${sBranchHangul}`,
        sElementLabel,
        YONGSHIN_GRADE_STARS[sGrade],
      ]);

      if (sp.year === CURRENT_YEAR) {
        currentYearGrade = sGrade;

        saeunParagraphs.push(
          emphasis(
            pickAndFill(rng, CURRENT_YEAR_TEMPLATES, {
              year: CURRENT_YEAR,
              stemHangul: sStemHangul,
              branchHangul: sBranchHangul,
              elementKorean: sElement ? ELEMENT_KOREAN[sElement] : '?',
              grade: YONGSHIN_GRADE_STARS[sGrade],
              gradeDesc: YONGSHIN_GRADE_DESC[sGrade],
            }),
          ),
        );
      }
    }

    // Highlight upcoming years (next 2-3 years after current)
    const upcomingYears = saeunPillars.filter(
      sp => sp.year > CURRENT_YEAR && sp.year <= CURRENT_YEAR + 3,
    );
    if (upcomingYears.length > 0) {
      const upcomingSummary = upcomingYears.map(sp => {
        const info = lookupStemInfo(sp.stem);
        const el = info?.element ?? resolveStemElement(sp.stem);
        const grade = el ? computeGrade(el, saju) : 3;
        return `${sp.year}년 ${YONGSHIN_GRADE_STARS[grade]}`;
      }).join(', ');
      saeunParagraphs.push(
        tip(`향후 몇 년간의 용신 부합도 전망: ${upcomingSummary}`),
      );
    }

    const saeunTable: ReportTable = {
      title: '세운 일람표',
      headers: ['서기', '세운', '오행', '용신 부합도'],
      rows: saeunTableRows,
    };

    const saeunSubsection: ReportSubsection = {
      title: '세운 (연간 운세)',
      paragraphs: saeunParagraphs,
      tables: [saeunTable],
    };

    subsections.push(saeunSubsection);
  }

  // ---- Highlights ----
  const highlights: ReportHighlight[] = [
    {
      label: '대운 방향',
      value: directionLabel,
      sentiment: 'neutral',
    },
  ];

  if (currentDaeun && currentAge != null) {
    const cStemInfo = lookupStemInfo(currentDaeun.stem);
    const cBranchInfo = lookupBranchInfo(currentDaeun.branch);
    const cElement = cStemInfo?.element ?? resolveStemElement(currentDaeun.stem);
    const cGrade: YongshinMatchGrade = cElement ? computeGrade(cElement, saju) : 3;

    highlights.push({
      label: '현재 대운',
      value: `${cStemInfo?.hangul ?? currentDaeun.stem}${cBranchInfo?.hangul ?? currentDaeun.branch} (${YONGSHIN_GRADE_STARS[cGrade]})`,
      element: cElement ?? undefined,
      sentiment: cGrade >= 4 ? 'good' : cGrade <= 2 ? 'caution' : 'neutral',
    });
  }

  // Current year saeun highlight
  if (saeunPillars.length > 0) {
    const currentSaeun = saeunPillars.find(sp => sp.year === CURRENT_YEAR);
    if (currentSaeun) {
      const csStemInfo = lookupStemInfo(currentSaeun.stem);
      const csBranchInfo = lookupBranchInfo(currentSaeun.branch);
      const csElement = csStemInfo?.element ?? resolveStemElement(currentSaeun.stem);
      const csGrade: YongshinMatchGrade = csElement ? computeGrade(csElement, saju) : 3;

      highlights.push({
        label: `${CURRENT_YEAR}년 세운`,
        value: `${csStemInfo?.hangul ?? currentSaeun.stem}${csBranchInfo?.hangul ?? currentSaeun.branch} (${YONGSHIN_GRADE_STARS[csGrade]})`,
        element: csElement ?? undefined,
        sentiment: csGrade >= 4 ? 'good' : csGrade <= 2 ? 'caution' : 'neutral',
      });
    }
  }

  // ---- Assemble section ----
  return {
    id: 'fortuneCycles',
    title: '대운과 세운 흐름',
    subtitle: '10년 대운과 연간 세운의 용신 부합도 분석',
    paragraphs,
    subsections,
    highlights,
  };
}
