/**
 * cautions-card.ts -- 유의점 카드 빌더
 *
 * 사주 원국에서 주의해야 할 신호들을 수집하여 친근한 한국어로 안내합니다.
 *
 * 경고 수집 소스:
 *   1. shinsalHits  -- 흉살(inauspicious) 신살 경고
 *   2. jijiRelations -- 충/형/해/파 관계 경고
 *   3. deficientElements -- 결핍 오행 경고
 *   4. gongmang -- 공망(빈 지지) 경고
 *
 * 모든 텍스트는 ~해요/~에요 체를 사용합니다.
 */

import type { SajuSummary, SajuAxisStrengthMap, CounterexampleRow } from '../../types.js';
import type { CautionsCard, FortuneWarning } from '../types.js';
import type { ElementCode } from '../types.js';
import { findShinsalEntry } from '../knowledge/shinsalEncyclopedia.js';
import {
  ELEMENT_EMOTION,
  ELEMENT_FOOD,
  lookupBranchInfo,
} from '../common/elementMaps.js';

// ---------------------------------------------------------------------------
//  Element code helpers (No raw Chinese characters in output)
// ---------------------------------------------------------------------------

const ELEMENT_KO: Record<ElementCode, string> = {
  WOOD: '나무', FIRE: '불', EARTH: '흙', METAL: '쇠', WATER: '물',
};

const STEM_TO_ELEMENT: Record<string, ElementCode> = {
  GAP: 'WOOD', EUL: 'WOOD',
  BYEONG: 'FIRE', JEONG: 'FIRE',
  MU: 'EARTH', GI: 'EARTH',
  GYEONG: 'METAL', SIN: 'METAL',
  IM: 'WATER', GYE: 'WATER',
};

function toElementCode(value: unknown): ElementCode | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (upper in ELEMENT_KO) return upper as ElementCode;

  const ALIAS: Record<string, ElementCode> = {
    '목': 'WOOD', '木': 'WOOD',
    '화': 'FIRE', '火': 'FIRE',
    '토': 'EARTH', '土': 'EARTH',
    '금': 'METAL', '金': 'METAL',
    '수': 'WATER', '水': 'WATER',
  };
  return ALIAS[value.trim()] ?? STEM_TO_ELEMENT[upper] ?? null;
}

function elementKo(code: ElementCode): string {
  return ELEMENT_KO[code] ?? code;
}

function normalizeCautionReason(value: string): string {
  return value
    .replace(/신살입니다\./g, '흐름이에요.')
    .replace(/길신입니다\./g, '도움이 되는 신호예요.')
    .replace(/커질 수 있습니다\./g, '커질 수 있어요.')
    .replace(/올 수 있습니다\./g, '올 수 있어요.');
}

function plainShinsalSignal(label: string): string {
  const signalMap: Record<string, string> = {
    지살: '이동이나 변화가 많아져 생활 리듬이 흔들릴 수 있어요.',
    월살: '월간 흐름에서 컨디션과 일정 변동이 커질 수 있어요.',
    망신살: '말이나 행동이 예상보다 크게 드러날 수 있어요.',
    육해살: '관계 피로가 쌓이거나 작은 오해가 커질 수 있어요.',
    겁살: '경쟁심이나 급한 선택으로 손해를 보기 쉬워요.',
    재살: '급한 이동이나 급한 결정에서 실수가 나기 쉬워요.',
    천살: '예상 밖 변수와 피로 누적에 주의가 필요해요.',
    백호: '기세가 강해지는 만큼 속도 조절이 필요해요.',
    형살: '의견 충돌이나 마찰이 커질 수 있어요.',
    충살: '갑작스러운 변화나 충돌에 유연하게 대응해야 해요.',
    해살: '겉으로 잘 보이지 않는 문제를 초기에 점검하면 좋아요.',
    파살: '계획이 흔들릴 수 있어 마무리 점검이 중요해요.',
    원진살: '가까운 관계에서 미묘한 거리감이 생길 수 있어요.',
  };
  return signalMap[label] ?? '생활 리듬과 대인관계를 한 번 더 살피면 좋아요.';
}

// ---------------------------------------------------------------------------
//  Relation type classification
// ---------------------------------------------------------------------------

type NegativeRelationType = 'CHUNG' | 'HYEONG' | 'HAE' | 'PA';

function classifyNegativeRelation(typeRaw: string): NegativeRelationType | null {
  const t = typeRaw.toUpperCase().replace(/[\s_\-()]/g, '');
  if (t.includes('CHUNG') || t.includes('충')) return 'CHUNG';
  if (t.includes('HYEONG') || t.includes('형')) return 'HYEONG';
  if (t.includes('HAE') || t.includes('해살') || (t.includes('해') && !t.includes('해당'))) return 'HAE';
  if (t.includes('PA') || t.includes('파')) return 'PA';
  return null;
}

const RELATION_SIGNAL: Record<NegativeRelationType, string> = {
  CHUNG: '충돌과 급변의 신호가 있어요',
  HYEONG: '갈등과 마찰의 신호가 있어요',
  HAE: '은밀한 손해와 뒤탈의 신호가 있어요',
  PA: '기존 계획이 흔들리는 신호가 있어요',
};

const RELATION_RESPONSE: Record<NegativeRelationType, string> = {
  CHUNG: '큰 변화가 올 때 저항보다 유연한 대응을 우선하고, 중요한 결정은 충분히 검토한 뒤 진행하세요.',
  HYEONG: '의견 충돌이 생기면 한 박자 쉬고 말하고, 역할과 경계를 미리 합의해 두면 마찰이 줄어요.',
  HAE: '계약서와 문서를 꼼꼼히 확인하고, 작은 불편도 방치하지 말고 초기에 해결하세요.',
  PA: '완성 직전에 흔들리지 않도록 마무리 점검을 충분히 하고, 백업과 대안을 미리 준비하세요.',
};

const RELATION_REASON: Record<NegativeRelationType, string> = {
  CHUNG: '원국 지지 사이에 충 관계가 있어서, 갑작스러운 환경 변화에 대비하는 것이 좋아요.',
  HYEONG: '원국 지지 사이에 형 관계가 있어서, 대인관계에서 직설적인 표현을 조심하면 좋아요.',
  HAE: '원국 지지 사이에 해 관계가 있어서, 겉으로 드러나지 않는 문제에 주의하는 것이 좋아요.',
  PA: '원국 지지 사이에 파 관계가 있어서, 기존 계획을 유연하게 수정할 준비가 필요해요.',
};

// ---------------------------------------------------------------------------
//  Branch hangul helper
// ---------------------------------------------------------------------------

function branchHangul(code: string): string {
  return lookupBranchInfo(code)?.hangul ?? code;
}

// ---------------------------------------------------------------------------
//  Main builder
// ---------------------------------------------------------------------------

export function buildCautionsCard(saju: SajuSummary): CautionsCard {
  const cautions: FortuneWarning[] = [];

  // ------------------------------------------------------------------
  //  Source 1: shinsalHits -- inauspicious shinsal warnings
  // ------------------------------------------------------------------
  const shinsalHits = saju.shinsalHits;
  if (Array.isArray(shinsalHits)) {
    // Deduplicate by shinsal type
    const seen = new Set<string>();
    for (const hit of shinsalHits) {
      if (!hit || typeof hit.type !== 'string') continue;
      const typeKey = hit.type.toUpperCase().replace(/[\s_\-]/g, '');
      if (seen.has(typeKey)) continue;
      seen.add(typeKey);

      const entry = findShinsalEntry(hit.type);
      if (!entry) continue;
      // Only warn on inauspicious shinsal (skip auspicious and neutral)
      if (entry.type !== 'inauspicious') continue;

      cautions.push({
        signal: plainShinsalSignal(entry.korean),
        response: entry.tips[0] ?? '무리하지 말고 하루 일정을 여유 있게 계획하세요.',
        reason: normalizeCautionReason(entry.meaning),
      });
    }
  }

  // ------------------------------------------------------------------
  //  Source 2: jijiRelations -- negative branch relations
  // ------------------------------------------------------------------
  const jijiRelations = saju.jijiRelations;
  if (Array.isArray(jijiRelations)) {
    const seenRels = new Set<string>();
    for (const rel of jijiRelations) {
      if (!rel || typeof rel.type !== 'string') continue;
      const negType = classifyNegativeRelation(rel.type);
      if (!negType) continue;

      // Deduplicate by relation type + branch set
      const branches = Array.isArray(rel.branches)
        ? [...rel.branches].sort().join(',')
        : '';
      const relKey = `${negType}:${branches}`;
      if (seenRels.has(relKey)) continue;
      seenRels.add(relKey);

      const branchDesc = Array.isArray(rel.branches)
        ? rel.branches.map((b: string) => branchHangul(b)).join('-')
        : '';

      cautions.push({
        signal: branchDesc
          ? `${branchDesc} 사이에 ${RELATION_SIGNAL[negType]}.`
          : `${RELATION_SIGNAL[negType]}.`,
        response: RELATION_RESPONSE[negType],
        reason: RELATION_REASON[negType],
      });
    }
  }

  // ------------------------------------------------------------------
  //  Source 3: deficientElements -- missing element warnings
  // ------------------------------------------------------------------
  const deficientElements = saju.deficientElements;
  if (Array.isArray(deficientElements) && deficientElements.length > 0) {
    for (const raw of deficientElements) {
      const el = toElementCode(raw);
      if (!el) continue;
      const emotion = ELEMENT_EMOTION[el];
      const foods = ELEMENT_FOOD[el];
      const foodList = foods ? foods.slice(0, 3).join(', ') : '';

      cautions.push({
        signal: `${elementKo(el)} 기운이 부족해요.`,
        response: foodList
          ? `${foodList} 같은 음식을 챙기고, 수면과 휴식 리듬도 함께 지켜 주세요.`
          : '수면, 식사, 휴식 리듬을 차분히 챙겨 주세요.',
        reason: `오행 중 ${elementKo(el)} 기운이 약하면 ${emotion?.negative ?? '에너지 저하'}에 주의가 필요해요.`,
      });
    }
  }

  // ------------------------------------------------------------------
  //  Source 4: gongmang -- void branch warnings
  // ------------------------------------------------------------------
  const gongmang = saju.gongmang;
  if (Array.isArray(gongmang) && gongmang.length === 2) {
    const [b1, b2] = gongmang;
    const name1 = branchHangul(b1 as string);
    const name2 = branchHangul(b2 as string);
    cautions.push({
      signal: `${name1}, ${name2}와 관련된 흐름에서 목표가 흐릿하게 느껴질 수 있어요.`,
      response: '큰 목표를 잘게 쪼개서 즉시 행동하고, 기대치보다 루틴 유지에 집중하세요.',
      reason: '일부 흐름은 결과가 늦게 나타날 수 있어 작은 실행 단위를 유지하는 것이 좋아요.',
    });
  }

  // ------------------------------------------------------------------
  //  Fallback: if no cautions found, add a gentle default
  // ------------------------------------------------------------------
  if (cautions.length === 0) {
    cautions.push({
      signal: '원국에서 특별히 강한 주의 신호는 보이지 않아요.',
      response: '기본 건강 관리와 대인관계 소통 습관을 꾸준히 유지하면 좋아요.',
      reason: '큰 주의 신호나 충돌 관계가 없어 전반적으로 안정적인 구성이에요.',
    });
  }

  // ── PR-J-6 — narrative foundations (axisStrength + counterexamples) ──
  const sajuAxis = (saju as unknown as { axisStrength?: SajuAxisStrengthMap }).axisStrength;
  const counterexamples: CounterexampleRow[] = [];

  // Counterexample 1 — strong yongshin support flips most cautions to lighter.
  if (sajuAxis?.yongshin === 'definite') {
    counterexamples.push({
      condition: '용신 신뢰도가 매우 높고 운에서 용신·희신이 강하게 들어오는 시기',
      revisedClaim: '경고 수위는 한 단계 낮추되 기본 관리 루틴은 그대로 유지하세요. 용신이 굳건한 시기엔 흉살의 영향이 약해져요.',
      appliesWhen: 'definite',
    });
  }

  // Counterexample 2 — low-confidence yongshin escalates most cautions.
  if (sajuAxis?.yongshin === 'candidate' || sajuAxis?.yongshin === 'deferred') {
    counterexamples.push({
      condition: '용신 신뢰도가 낮은 차트 (학파 간 추천이 갈리는 경우)',
      revisedClaim: '경고를 한 가지 학파의 시각으로만 받아들이기보다, 조후·통관 등 다른 보조 기준으로 한 번 더 살펴보세요.',
      appliesWhen: sajuAxis.yongshin,
    });
  }

  // Counterexample 3 — gongmang adds time-based qualification.
  if (saju.gongmang) {
    counterexamples.push({
      condition: '공망이 있는 위치(年/月/日/時 중 하나)와 관련된 경고',
      revisedClaim: '공망 위치의 경고는 발현 시점이 늦어지거나 약해지는 경향이 있어요. 운에서 그 위치가 충돌(冲) 받는 해에 비로소 강해질 수 있어요.',
    });
  }

  return {
    title: '유의점',
    cautions,
    axisStrength: sajuAxis,
    counterexamples: counterexamples.length > 0 ? counterexamples : undefined,
  };
}
