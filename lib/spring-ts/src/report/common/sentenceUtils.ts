/**
 * sentenceUtils.ts — 문장 생성 유틸리티
 *
 * 보고서의 자연스러운 문장 다양성을 보장하는 핵심 유틸리티입니다.
 * 동일한 사주 데이터라도 매번 약간 다른 표현을 사용하여
 * 기계적이지 않은, 사람이 쓴 것 같은 보고서를 생성합니다.
 */

import type { ReportParagraph, ConditionalTemplate, ContextualSentencePool, ElementCode, ReportInput } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
//  1. 시드 기반 의사 난수 생성기
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 결정론적 의사 난수 생성기 (Mulberry32).
 * 동일한 시드를 사용하면 동일한 결과를 재현할 수 있습니다.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** 0~1 사이의 float를 반환 */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 배열에서 랜덤 선택 */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** 배열에서 가중치 기반 랜덤 선택 */
  pickWeighted<T extends { weight?: number }>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    const totalWeight = arr.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    let roll = this.next() * totalWeight;
    for (const item of arr) {
      roll -= (item.weight ?? 1);
      if (roll <= 0) return item;
    }
    return arr[arr.length - 1];
  }

  /** 배열을 셔플 (Fisher-Yates) */
  shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /** n개를 중복 없이 랜덤 선택 */
  sample<T>(arr: readonly T[], n: number): T[] {
    const shuffled = this.shuffle([...arr]);
    return shuffled.slice(0, Math.min(n, arr.length));
  }

  /** 정수 범위 [min, max] 내 랜덤 */
  intBetween(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. 문장 템플릿 엔진
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 문자열 내의 {{변수명}} 플레이스홀더를 치환합니다.
 *
 * @example
 * fillTemplate('{{이름}}님의 용신은 {{오행}}입니다.', { 이름: '홍길동', 오행: '목' })
 * // → '홍길동님의 용신은 목입니다.'
 */
export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = vars[key];
    return value != null ? String(value) : match;
  });
}

/**
 * 조건부 템플릿 풀에서 적절한 문장을 선택합니다.
 * 여러 조건이 맞으면 가중치 기반으로 선택합니다.
 */
export function selectFromPool(
  pool: ContextualSentencePool,
  input: ReportInput,
  rng: SeededRandom,
  vars?: Record<string, string | number>,
): string {
  const matchingGroups = pool.groups.filter(group => group.condition(input));

  let templates: string[];
  if (matchingGroups.length > 0) {
    const selectedGroup = rng.pickWeighted(matchingGroups);
    templates = selectedGroup.templates;
  } else {
    templates = pool.fallback;
  }

  if (templates.length === 0) return '';
  const selected = rng.pick(templates);
  return vars ? fillTemplate(selected, vars) : selected;
}

/**
 * 여러 문장 중 하나를 랜덤으로 선택하고 변수를 치환합니다.
 */
export function pickAndFill(
  rng: SeededRandom,
  templates: readonly string[],
  vars?: Record<string, string | number>,
): string {
  if (templates.length === 0) return '';
  const selected = rng.pick(templates);
  return vars ? fillTemplate(selected, vars) : selected;
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. 한국어 조사 처리
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 한글 문자의 종성(받침) 유무를 확인합니다.
 */
function hasFinalConsonant(char: string): boolean {
  const code = char.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return false;
  return (code - 0xAC00) % 28 !== 0;
}

/**
 * 앞 글자의 받침에 따라 적절한 조사를 선택합니다.
 *
 * @example
 * particle('목', '이', '가') → '이'  (받침 있음)
 * particle('화', '이', '가') → '가'  (받침 없음)
 */
export function particle(word: string, withFinal: string, withoutFinal: string): string {
  if (!word || word.length === 0) return withoutFinal;
  const lastChar = word[word.length - 1];
  return hasFinalConsonant(lastChar) ? withFinal : withoutFinal;
}

/**
 * 단어에 적절한 조사를 자동으로 붙입니다.
 *
 * @example
 * withParticle('목', '은/는') → '목은'
 * withParticle('화', '은/는') → '화는'
 * withParticle('수', '이/가') → '수가'
 */
export function withParticle(word: string, particlePair: string): string {
  const [withF, withoutF] = particlePair.split('/');
  if (!withF || !withoutF) return word + particlePair;
  return word + particle(word, withF, withoutF);
}

// 편의 함수들
export function eunNeun(word: string): string { return withParticle(word, '은/는'); }
export function iGa(word: string): string { return withParticle(word, '이/가'); }
export function eulReul(word: string): string { return withParticle(word, '을/를'); }
export function gwaWa(word: string): string { return withParticle(word, '과/와'); }
export function euroRo(word: string): string {
  if (!word || word.length === 0) return word + '로';
  const lastChar = word[word.length - 1];
  const code = lastChar.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return word + '로';
  const jongseong = (code - 0xAC00) % 28;
  // ㄹ 받침이거나 받침 없으면 '로', 나머지는 '으로'
  if (jongseong === 0 || jongseong === 8) return word + '로';
  return word + '으로';
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. 보고서 단락 생성 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/** 서술형 단락 생성 */
export function narrative(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'narrative', text, element, tone: 'neutral' };
}

/** 긍정적 톤의 단락 */
export function positive(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'narrative', text, element, tone: 'positive' };
}

/** 격려 톤의 단락 */
export function encouraging(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'narrative', text, element, tone: 'encouraging' };
}

/** 주의 톤의 단락 */
export function caution(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'warning', text, element, tone: 'negative' };
}

/** 팁/조언 단락 */
export function tip(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'tip', text, element, tone: 'neutral' };
}

/** 강조 단락 */
export function emphasis(text: string, element?: ElementCode): ReportParagraph {
  return { type: 'emphasis', text, element, tone: 'neutral' };
}

// ─────────────────────────────────────────────────────────────────────────────
//  5. 문장 접합 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

/** 여러 문장을 자연스럽게 이어 하나의 단락으로 만듭니다 */
export function joinSentences(...sentences: (string | null | undefined)[]): string {
  return sentences.filter(s => s != null && s.trim().length > 0).join(' ');
}

/** 여러 항목을 나열형으로 연결합니다 (A, B, C 그리고 D) */
export function listJoin(items: string[], conjunction: string = '그리고'): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
  const last = items[items.length - 1];
  const rest = items.slice(0, -1);
  return `${rest.join(', ')} ${conjunction} ${last}`;
}

/** 백분율 포맷팅 */
export function pct(value: number, digits: number = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** 점수를 "N점" 형식으로 포맷팅 */
export function scoreText(value: number): string {
  return `${Math.round(value)}점`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  6. 시드 생성 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

/** 보고서 입력에서 결정론적 시드를 생성합니다 */
export function seedFromInput(input: ReportInput): number {
  const parts = [
    input.birthInfo?.year ?? 0,
    input.birthInfo?.month ?? 0,
    input.birthInfo?.day ?? 0,
    input.birthInfo?.hour ?? 0,
    input.name?.length ?? 0,
  ];
  let hash = 0;
  for (const part of parts) {
    hash = ((hash << 5) - hash + part) | 0;
  }
  return Math.abs(hash) || 42;
}

/** RNG 인스턴스를 생성합니다 */
export function createRng(input: ReportInput): SeededRandom {
  const seed = input.options?.variationSeed ?? seedFromInput(input);
  return new SeededRandom(seed);
}
