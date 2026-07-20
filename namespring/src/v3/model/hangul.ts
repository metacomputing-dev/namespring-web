// 한글 초성 도구. 'ㅅㅈ'처럼 초성만 눌러도 이름을 찾을 수 있게 한다.
// 음절 하나를 초성으로 접기만 하므로 엔진 자모 유틸을 번들에 끌어오지 않는다.

const CHOSEONG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const CHOSEONG_SET = new Set(CHOSEONG);

const SYLLABLE_FIRST = 0xac00;
const SYLLABLE_LAST = 0xd7a3;
/** 초성 하나가 차지하는 음절 수 = 중성 21 × 종성 28. */
const CHOSEONG_SPAN = 588;

/** 검색어와 대조 대상을 같은 모양으로 맞춘다. 공백은 버리고 영문은 소문자로. */
export function normalizeQuery(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

/** 한글 음절은 초성으로 접고, 이미 초성인 글자는 그대로 둔다. 나머지는 버린다. */
export function getHangulInitials(value: string): string {
  return Array.from(value)
    .map(char => {
      const code = char.charCodeAt(0);
      if (code >= SYLLABLE_FIRST && code <= SYLLABLE_LAST) {
        return CHOSEONG[Math.floor((code - SYLLABLE_FIRST) / CHOSEONG_SPAN)] ?? '';
      }
      return CHOSEONG_SET.has(char) ? char : '';
    })
    .join('');
}

/** 전부 초성으로만 이루어진 검색어인지. 이때만 초성 대조로 넘어간다. */
export function isChoseongQuery(query: string): boolean {
  if (!query) return false;
  return Array.from(query).every(char => CHOSEONG_SET.has(char));
}
