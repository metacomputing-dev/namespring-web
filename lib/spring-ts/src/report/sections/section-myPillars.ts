/**
 * section-myPillars.ts -- Premium report birth chart (four pillars) section
 *
 * Generates the "나의 사주 원국" (My Four Pillars) section that displays the
 * birth chart as a structured table. Includes time correction notes, pillar
 * table (stems + branches), and a hidden-stems subsection when ten-god
 * analysis data is available.
 */

import type {
  SajuSummary,
  BirthInfo,
  PremiumReportSection,
  ReportTable,
  ReportSubsection,
  ReportHighlight,
} from '../types.js';
import {
  SeededRandom,
  pickAndFill,
  narrative,
  tip,
  joinSentences,
} from '../common/sentenceUtils.js';
import {
  lookupStemInfo,
  lookupBranchInfo,
  elementCodeToKorean,
} from '../common/elementMaps.js';

import type { ElementCode } from '../types.js';

// ---------------------------------------------------------------------------
//  Template pools
// ---------------------------------------------------------------------------

const INTRO_TEMPLATES = [
  '사주 원국은 태어난 연, 월, 일, 시를 기반으로 구성된 네 개의 기둥(사주)입니다. 각 기둥은 천간(위)과 지지(아래)로 이루어져 있으며, 이 여덟 글자가 개인의 타고난 에너지 구조를 보여줍니다.',
  '사주 원국은 생년, 생월, 생일, 생시에 대응하는 네 기둥으로 구성됩니다. 위쪽의 천간과 아래쪽의 지지, 총 8글자가 한 사람의 고유한 명리적 에너지 지도를 형성합니다.',
  '태어난 해, 달, 날, 시각을 각각 하나의 기둥으로 세운 것이 사주 원국이에요. 천간(하늘의 기운)과 지지(땅의 기운)가 짝을 이루어, 총 8글자로 삶의 에너지 구조를 나타냅니다.',
  '사주(四柱)란 태어난 시점의 연, 월, 일, 시를 네 개의 기둥으로 표현한 것입니다. 각 기둥의 천간과 지지가 만들어내는 8글자의 조합이 바로 당신만의 에너지 원국이에요.',
] as const;

const TIME_CORRECTION_TEMPLATES = [
  '출생 시각은 태양시 기준으로 보정되었습니다. 경도 보정 {{longitudeMin}}분, 균시차 보정 {{eotMin}}분이 적용되어 실제 사주 계산에는 {{adjustedHour}}시 {{adjustedMinute}}분이 사용되었어요.',
  '정확한 사주 계산을 위해 태양시 보정이 적용되었습니다. 경도 보정({{longitudeMin}}분)과 균시차({{eotMin}}분)를 반영한 결과, 보정 시각은 {{adjustedHour}}시 {{adjustedMinute}}분입니다.',
  '사주 정밀도를 높이기 위해 출생 시각에 태양시 보정을 적용했어요. 경도 차이로 {{longitudeMin}}분, 균시차로 {{eotMin}}분이 조정되어, 최종 보정 시각은 {{adjustedHour}}시 {{adjustedMinute}}분이에요.',
] as const;

const DST_NOTE_TEMPLATES = [
  '또한 서머타임(일광절약시간) {{dstMin}}분이 추가로 보정되었습니다.',
  '서머타임 보정 {{dstMin}}분도 함께 반영되었어요.',
] as const;

// Pillar position labels (in display order: hour, day, month, year)
const PILLAR_KEYS = ['hour', 'day', 'month', 'year'] as const;
const PILLAR_HEADERS = ['시주(時柱)', '일주(日柱)', '월주(月柱)', '연주(年柱)'];
const PILLAR_POSITION_KOREAN: Record<string, string> = {
  year: '연주',
  month: '월주',
  day: '일주',
  hour: '시주',
};

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

/** Format a stem or branch as "한글(한자)" */
function formatCodeHangulHanja(hangul: string, hanja: string): string {
  return `${hangul}(${hanja})`;
}

/** Total time correction in minutes (absolute value) */
function totalCorrectionMinutes(tc: SajuSummary['timeCorrection']): number {
  return Math.abs(tc.longitudeCorrectionMinutes)
       + Math.abs(tc.equationOfTimeMinutes)
       + Math.abs(tc.dstCorrectionMinutes);
}

// ---------------------------------------------------------------------------
//  Section generator
// ---------------------------------------------------------------------------

export function generateMyPillars(
  saju: SajuSummary,
  _birth: BirthInfo,
  rng: SeededRandom,
): PremiumReportSection | null {
  const { pillars, timeCorrection, tenGodAnalysis } = saju;

  // Guard: we need all four pillars
  if (!pillars.year || !pillars.month || !pillars.day || !pillars.hour) return null;

  const paragraphs = [];

  // ------ 1. Intro paragraph ------
  paragraphs.push(narrative(pickAndFill(rng, INTRO_TEMPLATES)));

  // ------ 2. Time correction note ------
  const hasMeaningfulCorrection = totalCorrectionMinutes(timeCorrection) >= 1;
  if (hasMeaningfulCorrection) {
    const correctionText = pickAndFill(rng, TIME_CORRECTION_TEMPLATES, {
      longitudeMin: formatMinutes(timeCorrection.longitudeCorrectionMinutes),
      eotMin: formatMinutes(timeCorrection.equationOfTimeMinutes),
      adjustedHour: String(timeCorrection.adjustedHour),
      adjustedMinute: String(timeCorrection.adjustedMinute).padStart(2, '0'),
    });

    let fullCorrectionText = correctionText;
    if (Math.abs(timeCorrection.dstCorrectionMinutes) >= 1) {
      const dstNote = pickAndFill(rng, DST_NOTE_TEMPLATES, {
        dstMin: formatMinutes(timeCorrection.dstCorrectionMinutes),
      });
      fullCorrectionText = joinSentences(correctionText, dstNote);
    }

    paragraphs.push(tip(fullCorrectionText));
  }

  // ------ 3. Four-pillars table ------
  const stemRow: string[] = [];
  const branchRow: string[] = [];

  for (const key of PILLAR_KEYS) {
    const pillar = pillars[key];
    stemRow.push(formatCodeHangulHanja(pillar.stem.hangul, pillar.stem.hanja));
    branchRow.push(formatCodeHangulHanja(pillar.branch.hangul, pillar.branch.hanja));
  }

  const pillarTable: ReportTable = {
    title: '사주 원국 (四柱 原局)',
    headers: PILLAR_HEADERS,
    rows: [stemRow, branchRow],
  };

  // ------ 4. Hidden stems subsection ------
  const subsections: ReportSubsection[] = [];

  if (tenGodAnalysis?.byPosition) {
    const hiddenStemRows: string[][] = [];
    let hasAnyHidden = false;

    for (const key of PILLAR_KEYS) {
      const posData = tenGodAnalysis.byPosition[key];
      if (posData?.hiddenStems && posData.hiddenStems.length > 0) {
        hasAnyHidden = true;
        const hiddenLabels = posData.hiddenStems.map(hs => {
          const info = lookupStemInfo(hs.stem);
          const stemLabel = info
            ? formatCodeHangulHanja(info.hangul, info.hanja)
            : hs.stem;
          const elLabel = elementCodeToKorean(hs.element);
          const pctLabel = `${Math.round(hs.ratio * 100)}%`;
          return `${stemLabel} ${elLabel} ${pctLabel}`;
        });
        hiddenStemRows.push([PILLAR_POSITION_KOREAN[key] ?? key, hiddenLabels.join(', ')]);
      } else {
        hiddenStemRows.push([PILLAR_POSITION_KOREAN[key] ?? key, '-']);
      }
    }

    if (hasAnyHidden) {
      const hiddenTable: ReportTable = {
        title: '지지 속 지장간 (숨은 천간)',
        headers: ['기둥', '지장간 구성'],
        rows: hiddenStemRows,
      };

      subsections.push({
        title: '지장간 (숨은 천간)',
        paragraphs: [
          narrative('각 지지(地支) 안에는 숨어 있는 천간이 있으며, 이를 지장간이라 합니다. 지장간은 겉으로 드러나지 않지만 사주 해석에 중요한 영향을 미치는 숨은 에너지예요.'),
        ],
        tables: [hiddenTable],
      });
    }
  }

  // ------ 5. Highlights ------
  const highlights: ReportHighlight[] = [];

  if (hasMeaningfulCorrection) {
    const totalMin = totalCorrectionMinutes(timeCorrection);
    highlights.push({
      label: '시각 보정',
      value: `총 ${formatMinutes(totalMin)} 보정 적용`,
      sentiment: 'neutral',
    });
  }

  // Add day pillar highlight
  const dayStem = lookupStemInfo(pillars.day.stem.code) ?? lookupStemInfo(pillars.day.stem.hangul);
  const dayBranch = lookupBranchInfo(pillars.day.branch.code) ?? lookupBranchInfo(pillars.day.branch.hangul);
  if (dayStem && dayBranch) {
    highlights.push({
      label: '일주 (Day Pillar)',
      value: `${dayStem.hangul}${dayBranch.hangul} (${dayStem.hanja}${dayBranch.hanja})`,
      element: dayStem.element as ElementCode,
      sentiment: 'neutral',
    });
  }

  return {
    id: 'myPillars',
    title: '나의 사주 원국',
    subtitle: '태어난 시점의 천간과 지지로 구성된 에너지 지도',
    paragraphs,
    tables: [pillarTable],
    highlights: highlights.length > 0 ? highlights : undefined,
    subsections: subsections.length > 0 ? subsections : undefined,
  };
}

// ---------------------------------------------------------------------------
//  Utility
// ---------------------------------------------------------------------------

/** Format a number of minutes as a string, handling sign and rounding */
function formatMinutes(minutes: number): string {
  const rounded = Math.round(Math.abs(minutes) * 10) / 10;
  if (rounded === 0) return '0분';
  const sign = minutes < 0 ? '-' : '+';
  // Avoid "+0.0" edge case
  return `${sign}${rounded}분`;
}
