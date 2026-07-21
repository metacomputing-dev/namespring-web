import type { HanjaEntry } from '../../seed-ts/src/database/hanja-repository.js';
import { averageScores } from './candidate-selection.js';
import { isRecognizedHanjaGlyph } from './hanja-annotations.js';

/**
 * Literal modern safety exclusions for unattended public recommendations.
 * This is neither a traditional "불용문자" list nor a claim about fate.
 */
const UNSAFE_AUTOMATIC_RECOMMENDATION_HANJA = new Set([
  '匕', '刀', '刃', '亡', '不', '倒', '滓', '竄', '湮', '蕪',
]);

const UNSAFE_MEANING_PATTERNS = [
  /장물/, /뇌물/, /도둑/, /훔/, /죄/, /형벌/, /죽을/, /죽음/, /사망/,
  /망할/, /흉할|흉악|흉년|흉한/, /악할/, /해칠/, /다칠/, /재앙/, /고통/, /슬플/,
  /감출/, /숨길/, /가난/, /비수/, /무기/, /전쟁/, /풀벨/, /^칼(?:$|\s)/,
  /갈고리/, /아닐/, /넘어질/, /거꾸로/, /앙금/, /달아날/, /잠길/,
  /막힐/, /거칠어질/,
] as const;

const WEAK_MEANING_PATTERNS = [
  /나이/, /마칠/, /구기/, /비수/, /숟가락/, /어조사/, /어금니/,
  /무기/, /굽을/, /갈고리/, /풀벨/, /흩어질/, /칼/, /작은배/,
  /없을/, /말 물/, /나눌/, /쪼갤/, /창/, /전쟁/, /빌릴/, /갚을/,
  /돈/, /닻/, /배멈출/, /대모/, /노리개/, /패옥/, /그 해/,
  /해당할/, /큰홀/, /옥잔/, /이슬기운/, /오른쪽/, /두 이/,
  /또 우/, /뚫을/, /송곳/, /왕비/, /임금/, /나방/, /돼지/,
  /열두째지지/, /적을/, /조금/, /강이름/, /물소리/, /당길/,
  /잡을/, /쇠부어/, /콩팥/, /아귀/, /사향노루/, /먹을/, /새참/,
  /홍수/, /도금/, /손 수/, /귀 이/, /소 우/, /옥홀/, /소금/,
  /자반/, /자라/, /큰거북/, /어찌/, /종족이름/,
  // These descriptors previously received false positive scores because a
  // trailing reading or an internal verb ending matched a short positive word.
  /뉘우칠/, /비결/, /예언/, /아홉째천간/, /짊어질/, /늘어질/,
  /부탁할/, /맡길/, /금빛투색/,
] as const;

/**
 * Legal glyphs with an unusually literal modern gloss remain valid for an
 * explicitly selected name, but are deferred in unattended recommendations.
 */
const DEFERRED_AUTOMATIC_RECOMMENDATION_HANJA = new Set([
  '了', '乂', '手', '耳', '牛', '腎', '鱇', '鑽', '麝', '餐', '鹽', '鼇', '奚',
]);

const POSITIVE_MEANING_PATTERNS = [
  /어질/, /착할/, /바를/, /높일/, /빛/, /밝/, /클/, /큰/, /넓/,
  /지혜/, /슬기/, /총명/, /준걸/, /빼어/, /뛰어/, /아름/, /맑/,
  /깨끗/, /평안/, /편안/, /복/, /덕/, /길/, /귀/, /보배/, /옥/,
  /금/, /별/, /해/, /달/, /하늘/, /강/, /산/, /샘/, /꽃/, /향/,
  /숲/, /영원/, /오랠/, /단단/, /굳/, /이룰/, /성할/, /펼/,
  /도울/, /믿/, /사랑/, /기쁠/, /즐거/, /윤택/, /풍성/, /예절/,
  /공경/, /참/, /진실/, /정성/, /건강/, /솜씨/, /힘/, /다스릴/,
] as const;

function normalizeMeaning(value: unknown): string {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function isTrailingReadingToken(token: string, reading: string): boolean {
  const koreanParts = token.match(/[가-힣]+/gu);
  return koreanParts !== null
    && koreanParts.some((part) => part === reading)
    && koreanParts.every((part) => Array.from(part).length === 1);
}

/**
 * Repository glosses conventionally end each comma-separated clause with the
 * Korean reading ("어질 인", "리(이)"). The reading is pronunciation data,
 * not semantic evidence, so remove it before classifying the descriptor.
 */
export function candidateMeaningDescriptors(entry: Pick<HanjaEntry, 'hangul' | 'meaning'>):
readonly string[] {
  const normalized = normalizeMeaning(entry.meaning);
  if (!normalized) return [];
  const descriptive = normalized.includes(':')
    ? normalized.split(':').slice(1).join(':').trim()
    : normalized;
  return descriptive
    .split(/[,，;；/]+/u)
    .map((clause) => {
      const tokens = clause.trim().split(/\s+/u).filter(Boolean);
      if (tokens.length > 0
        && isTrailingReadingToken(tokens[tokens.length - 1]!, entry.hangul)) {
        tokens.pop();
      }
      return tokens.join(' ').trim();
    })
    .filter((clause) => clause.length > 0);
}

function hasPositiveDescriptor(entry: HanjaEntry): boolean {
  return candidateMeaningDescriptors(entry).some((descriptor) =>
    POSITIVE_MEANING_PATTERNS.some((pattern) => descriptor.search(pattern) === 0));
}

export function hasUnsafeHanjaMeaning(entry: HanjaEntry): boolean {
  if (UNSAFE_AUTOMATIC_RECOMMENDATION_HANJA.has(entry.hanja)) return true;
  const descriptors = candidateMeaningDescriptors(entry);
  return descriptors.some((descriptor) =>
    UNSAFE_MEANING_PATTERNS.some((pattern) => pattern.test(descriptor)));
}

export function hasOpaqueHanjaMeaning(entry: HanjaEntry): boolean {
  return candidateMeaningDescriptors(entry).length === 0;
}

export function hasWeakRecommendationHanjaMeaning(entry: HanjaEntry): boolean {
  if (DEFERRED_AUTOMATIC_RECOMMENDATION_HANJA.has(entry.hanja)) return true;
  const descriptors = candidateMeaningDescriptors(entry);
  if (descriptors.length === 0) return true;
  if (descriptors.some((descriptor) =>
    WEAK_MEANING_PATTERNS.some((pattern) => pattern.test(descriptor)))) return true;
  return !hasPositiveDescriptor(entry);
}

export function computeRecommendationMeaningConfidence(
  entries: readonly HanjaEntry[],
): number | null {
  const hanjaEntries = entries.filter((entry) => isRecognizedHanjaGlyph(entry.hanja));
  if (!hanjaEntries.length) return null;
  return averageScores(hanjaEntries.map((entry) => {
    if (hasUnsafeHanjaMeaning(entry) || hasOpaqueHanjaMeaning(entry)) return 0;
    if (hasWeakRecommendationHanjaMeaning(entry)) return 35;
    return hasPositiveDescriptor(entry) ? 100 : 65;
  }));
}
