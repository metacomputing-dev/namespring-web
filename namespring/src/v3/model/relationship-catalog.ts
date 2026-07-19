/**
 * 관계 프리셋 카탈로그: 궁합에서 "두 사람의 관계"를 검색해 고를 수 있게 하는
 * 목록. 각 프리셋은 엔진의 관계 카테고리(CompatRelationshipV1)로 매핑되고,
 * 상세 라벨은 표시용으로만 쓴다. 직접 입력한 관계도 같은 구조로 담는다.
 */
import type {
  CompatRelationshipToneV1,
  CompatRelationshipV1,
} from '@spring/report/compatibility/index';

export interface RelationshipPreset {
  /** 표시용 상세 라벨 (예: '엄마와 딸'). */
  label: string;
  category: CompatRelationshipV1;
  /** 관계의 결: 대등(peer)·위계(hierarchy)·돌봄(care). 카피 분기에 쓴다. */
  tone: CompatRelationshipToneV1;
  /** 검색에 걸리는 낱말들. label 자체는 항상 검색 대상이다. */
  keywords: readonly string[];
}

export const RELATIONSHIP_PRESETS: readonly RelationshipPreset[] = [
  /* ---- 연인·부부 ---- */
  { label: '부부', category: 'romance', tone: 'peer', keywords: ['남편', '아내', '와이프', '신랑', '결혼', '배우자'] },
  { label: '연인', category: 'romance', tone: 'peer', keywords: ['애인', '남자친구', '여자친구', '남친', '여친', '커플'] },
  { label: '썸 타는 사이', category: 'romance', tone: 'peer', keywords: ['썸', '호감', '짝사랑'] },
  { label: '결혼을 앞둔 사이', category: 'romance', tone: 'peer', keywords: ['약혼', '예비부부', '예비 신랑', '예비 신부', '상견례'] },
  { label: '오래된 연인', category: 'romance', tone: 'peer', keywords: ['장수 커플', '10년', '오래 만난'] },
  { label: '재혼 부부', category: 'romance', tone: 'peer', keywords: ['재혼', '새출발'] },

  /* ---- 가족 ---- */
  { label: '엄마와 딸', category: 'family', tone: 'care', keywords: ['모녀', '어머니', '엄마', '딸'] },
  { label: '엄마와 아들', category: 'family', tone: 'care', keywords: ['모자', '어머니', '엄마', '아들'] },
  { label: '아빠와 딸', category: 'family', tone: 'care', keywords: ['부녀', '아버지', '아빠', '딸'] },
  { label: '아빠와 아들', category: 'family', tone: 'care', keywords: ['부자', '아버지', '아빠', '아들'] },
  { label: '형제', category: 'family', tone: 'peer', keywords: ['형', '동생', '형제간'] },
  { label: '자매', category: 'family', tone: 'peer', keywords: ['언니', '동생', '자매간'] },
  { label: '남매', category: 'family', tone: 'peer', keywords: ['오빠', '누나', '동생'] },
  { label: '조부모와 손주', category: 'family', tone: 'care', keywords: ['할머니', '할아버지', '손자', '손녀', '조손'] },
  { label: '이모·고모와 조카', category: 'family', tone: 'care', keywords: ['이모', '고모', '조카'] },
  { label: '삼촌·외삼촌과 조카', category: 'family', tone: 'care', keywords: ['삼촌', '외삼촌', '조카'] },
  { label: '시부모와 며느리', category: 'family', tone: 'care', keywords: ['시어머니', '시아버지', '며느리', '고부'] },
  { label: '장인·장모와 사위', category: 'family', tone: 'care', keywords: ['장인', '장모', '사위'] },
  { label: '사촌', category: 'family', tone: 'peer', keywords: ['사촌간', '친척'] },

  /* ---- 친구 ---- */
  { label: '친구', category: 'friendship', tone: 'peer', keywords: ['벗', '우정'] },
  { label: '절친', category: 'friendship', tone: 'peer', keywords: ['베프', '단짝', '가장 친한'] },
  { label: '소꿉친구', category: 'friendship', tone: 'peer', keywords: ['어릴 적', '동네 친구', '불알친구'] },
  { label: '학교 동창', category: 'friendship', tone: 'peer', keywords: ['동창', '동기', '반 친구', '급우'] },
  { label: '룸메이트', category: 'friendship', tone: 'peer', keywords: ['룸메', '하우스메이트', '동거'] },
  { label: '아이들 친구', category: 'friendship', tone: 'peer', keywords: ['우리 아이', '아이 친구', '놀이 친구', '유치원', '어린이'] },

  /* ---- 동료·파트너 ---- */
  { label: '직장 동료', category: 'partnership', tone: 'peer', keywords: ['회사', '동료', '팀원'] },
  { label: '상사와 부하', category: 'partnership', tone: 'hierarchy', keywords: ['상사', '부하', '팀장', '사수', '부사수'] },
  { label: '사업 파트너', category: 'partnership', tone: 'peer', keywords: ['동업', '공동창업', '비즈니스'] },
  { label: '스승과 제자', category: 'partnership', tone: 'hierarchy', keywords: ['선생님', '제자', '사제', '멘토', '멘티'] },
  { label: '선후배', category: 'partnership', tone: 'hierarchy', keywords: ['선배', '후배'] },
] as const;

/**
 * 검색: 라벨·키워드에 부분 일치. 공백 제거 후 비교하고,
 * 빈 질의면 전체 목록을 돌려준다.
 */
export function searchRelationshipPresets(query: string): RelationshipPreset[] {
  const q = query.trim().replace(/\s+/gu, '');
  if (!q) return [...RELATIONSHIP_PRESETS];
  return RELATIONSHIP_PRESETS.filter(preset => {
    if (preset.label.replace(/\s+/gu, '').includes(q)) return true;
    return preset.keywords.some(keyword => keyword.replace(/\s+/gu, '').includes(q) || q.includes(keyword));
  });
}

/** 직접 입력한 관계 텍스트에서 카테고리를 추정한다. 못 찾으면 unspecified. */
export function guessRelationshipCategory(text: string): CompatRelationshipV1 {
  const matches = searchRelationshipPresets(text);
  return matches.length > 0 ? matches[0].category : 'unspecified';
}
