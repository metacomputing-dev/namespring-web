/**
 * 띠(십이지 동물)와 색(60갑자 색)의 결정론적 파생 — 신규 엔진의 단일 소스.
 *
 * 동물은 태어난 해의 지지(년지)에서, 색은 그해 천간(년간)의 오행에서 나온다.
 * 오방색 배속: 갑을(목)=청, 병정(화)=적, 무기(토)=황(황금), 경신(금)=백, 임계(수)=흑.
 * 예) 경오년(庚午) = 경(금→백) + 오(말) = 흰 말(백마).
 *
 * 이 모듈은 UI를 모른다. 통합 보고서(delivery pillars)와 궁합(person echo)이
 * 같은 함수를 써서 표기가 어긋나지 않게 한다.
 */
import type { FiveElementIdV1 } from './delivery/types.js';

export interface ZodiacYearV1 {
  /** 동물 이름 (예: 말). */
  readonly animal: string;
  /** 동물 한자 (예: 馬). */
  readonly animalHanja: string;
  /** 색 형용 (예: 흰). 년간 오행을 모르면 빈 문자열. */
  readonly color: string;
  /** 색 한자 (예: 白). 년간 오행을 모르면 빈 문자열. */
  readonly colorHanja: string;
  /** 색이 유래한 오행 (년간 오행). 모르면 null. */
  readonly colorElement: FiveElementIdV1 | null;
  /** 색+동물 한글 (예: 흰 말). 색을 모르면 동물만 (예: 말). */
  readonly label: string;
  /** 색+동물 한자 (예: 白馬). 색을 모르면 동물 한자만 (예: 馬). */
  readonly labelHanja: string;
  /** 띠 표기 (예: 말띠). 색과 무관. */
  readonly zodiacLabel: string;
}

/** 지지 코드 → 십이지 동물. 申은 런타임 'SIN'과 보고서 별칭 'SIN_BRANCH'를 모두 받는다. */
const ANIMAL_BY_BRANCH: Record<string, { readonly animal: string; readonly hanja: string }> = {
  JA: { animal: '쥐', hanja: '鼠' },
  CHUK: { animal: '소', hanja: '牛' },
  IN: { animal: '호랑이', hanja: '虎' },
  MYO: { animal: '토끼', hanja: '兔' },
  JIN: { animal: '용', hanja: '龍' },
  SA: { animal: '뱀', hanja: '蛇' },
  O: { animal: '말', hanja: '馬' },
  MI: { animal: '양', hanja: '羊' },
  SIN: { animal: '원숭이', hanja: '猴' },
  YU: { animal: '닭', hanja: '鷄' },
  SUL: { animal: '개', hanja: '狗' },
  HAE: { animal: '돼지', hanja: '豬' },
};

/** 오행 → 오방색. 무기(토)는 대중적 표현인 '황금'을 쓴다. */
const COLOR_BY_ELEMENT: Record<FiveElementIdV1, { readonly color: string; readonly hanja: string }> = {
  wood: { color: '푸른', hanja: '靑' },
  fire: { color: '붉은', hanja: '赤' },
  earth: { color: '황금', hanja: '黃' },
  metal: { color: '흰', hanja: '白' },
  water: { color: '검은', hanja: '黑' },
};

/** 천간 코드 → 오행 (색 파생용). delivery pillars fact가 코드만 실어 줄 때 쓴다. */
const ELEMENT_BY_STEM: Record<string, FiveElementIdV1> = {
  GAP: 'wood', EUL: 'wood',
  BYEONG: 'fire', JEONG: 'fire',
  MU: 'earth', GI: 'earth',
  GYEONG: 'metal', SIN: 'metal',
  IM: 'water', GYE: 'water',
};

/**
 * 년간 오행과 년지 코드로 띠+색을 파생한다. 년지가 없으면 null.
 * 년간 오행이 없으면(드묾) 색 없이 동물·띠만 채운다.
 */
export function deriveZodiacYear(
  yearStemElement: FiveElementIdV1 | null,
  yearBranchCode: string | null,
): ZodiacYearV1 | null {
  if (!yearBranchCode) return null;
  const normalized = yearBranchCode.toUpperCase() === 'SIN_BRANCH' ? 'SIN' : yearBranchCode.toUpperCase();
  const animal = ANIMAL_BY_BRANCH[normalized];
  if (!animal) return null;
  const zodiacLabel = `${animal.animal}띠`;
  const color = yearStemElement ? COLOR_BY_ELEMENT[yearStemElement] : null;
  return {
    animal: animal.animal,
    animalHanja: animal.hanja,
    color: color?.color ?? '',
    colorHanja: color?.hanja ?? '',
    colorElement: yearStemElement,
    label: color ? `${color.color} ${animal.animal}` : animal.animal,
    labelHanja: color ? `${color.hanja}${animal.hanja}` : animal.hanja,
    zodiacLabel,
  };
}

/**
 * 천간·지지 코드로 띠+색을 파생한다 (년간 오행을 코드에서 얻는 편의 변형).
 * delivery pillars fact처럼 오행이 실리지 않고 코드만 오는 경우에 쓴다.
 */
export function deriveZodiacYearFromCodes(
  yearStemCode: string | null,
  yearBranchCode: string | null,
): ZodiacYearV1 | null {
  const element = yearStemCode ? ELEMENT_BY_STEM[yearStemCode.toUpperCase()] ?? null : null;
  return deriveZodiacYear(element, yearBranchCode);
}
