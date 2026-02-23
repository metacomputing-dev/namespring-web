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

import type { SajuSummary } from '../../types.js';
import type { CautionsCard, FortuneWarning } from '../types.js';
import type { ElementCode } from '../types.js';
import { findShinsalEntry } from '../knowledge/shinsalEncyclopedia.js';
import {
  ELEMENT_ORGAN,
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
  PA: '완성 직전에 틀어지지 않도록 마무리 점검을 반드시 하고, 백업과 대안을 미리 준비하세요.',
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
        signal: `${entry.korean} 신호가 감지되었어요.`,
        response: entry.tips[0] ?? '무리하지 말고 하루 일정을 여유 있게 계획하세요.',
        reason: entry.meaning,
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
      const organ = ELEMENT_ORGAN[el];
      const emotion = ELEMENT_EMOTION[el];
      const foods = ELEMENT_FOOD[el];
      const foodList = foods ? foods.slice(0, 3).join(', ') : '';

      cautions.push({
        signal: `${elementKo(el)} 기운이 부족해요.`,
        response: foodList
          ? `${foodList} 같은 음식을 챙기고, 관련 장기(${organ?.detail ?? ''})에 신경 써 주세요.`
          : `관련 장기(${organ?.detail ?? ''})에 신경 쓰고 건강 검진을 받아보세요.`,
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
      signal: `공망(${name1}, ${name2})이 있어 힘이 비거나 공허감이 올 수 있어요.`,
      response: '큰 목표를 잘게 쪼개서 즉시 행동하고, 기대치보다 루틴 유지에 집중하세요.',
      reason: '공망은 특정 지지의 에너지가 비어 있는 구간이라 실행력이 떨어지기 쉬워요.',
    });
  }

  // ------------------------------------------------------------------
  //  Fallback: if no cautions found, add a gentle default
  // ------------------------------------------------------------------
  if (cautions.length === 0) {
    cautions.push({
      signal: '원국에서 특별히 강한 주의 신호는 보이지 않아요.',
      response: '기본 건강 관리와 대인관계 소통 습관을 꾸준히 유지하면 좋아요.',
      reason: '큰 흉살이나 충돌 관계가 없어 전반적으로 안정적인 구성이에요.',
    });
  }

  return {
    title: '유의점',
    cautions,
  };
}
