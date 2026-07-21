/**
 * name-evidence-derive.ts -- SpringReport → (판정 다이제스트, 필요한 슬롯 키,
 * 런타임 변수값, <analysis> 블록). 판정은 전부 엔진(SpringReport)의 것을
 * 직렬화만 한다 — 이 모듈은 순수(pure)이며 I/O·DB 접근이 없다.
 *
 * 방향 있는 상생상극은 report/common/elementMaps.getElementRelation을 쓴다
 * (채점용 core/scoring.ts는 무방향 — 서술에 쓰면 안 됨, HANDOFF §3).
 */
import type { SpringReport, BirthInfo } from '../../src/types.js';
import type { ElementCode } from '../../src/report/types.js';
import { getElementRelation, lookupStemInfo } from '../../src/report/common/elementMaps.js';
import { appendJosa } from '../../src/report/tiered/article-renderer.js';
import { buildFeatureVector } from '../../src/report/tiered/feature-selector.js';
import { packKeyFor } from '../../src/report/tiered/class-axes.js';
import {
  ALLOWED_VARS, FAMILY_ROLE, FRAME_LABEL_KO, FRAME_PHASE, GRADE_TOKEN, IMAGERY,
  IMAGERY_STATE, TEN_GOD_BY_RELATION, slotIdOf,
} from './name-evidence-schema.js';
import type {
  Boundary, ElementKo, ElementRelation, FrameOutlook, FrameType, GyeokgukFamily,
  LuckyGrade, NameEffect, NameEvidenceCase, NameEvidenceKey, PhoneticFlow,
  PhoneticRisk, SlotFamily, Stem, StrengthCoarse, YongshinRelation,
} from './name-evidence-schema.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Element normalization — engine surfaces mix 'WOOD' codes, 'Wood' english
//  names (seed-ts Element class) and Korean labels.
// ─────────────────────────────────────────────────────────────────────────────

const ELEMENT_KO_BY_CODE: Record<ElementCode, ElementKo> = {
  WOOD: '목', FIRE: '화', EARTH: '토', METAL: '금', WATER: '수',
};
const ELEMENT_CODES: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];

export function toElementKo(value: unknown): ElementKo | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if ((ELEMENT_CODES as readonly string[]).includes(upper)) return ELEMENT_KO_BY_CODE[upper as ElementCode];
  if (raw.includes('목') || raw.includes('木')) return '목';
  if (raw.includes('화') || raw.includes('火')) return '화';
  if (raw.includes('토') || raw.includes('土')) return '토';
  if (raw.includes('금') || raw.includes('金')) return '금';
  if (raw.includes('수') || raw.includes('水')) return '수';
  return null;
}

const CODE_BY_ELEMENT_KO: Record<ElementKo, ElementCode> = {
  목: 'WOOD', 화: 'FIRE', 토: 'EARTH', 금: 'METAL', 수: 'WATER',
};

/** 방향 있는 관계 (a→b): elementMaps.getElementRelation의 한국어 오행판. */
export function relationKo(a: ElementKo, b: ElementKo): ElementRelation {
  return getElementRelation(CODE_BY_ELEMENT_KO[a], CODE_BY_ELEMENT_KO[b]);
}

/** '화극금'·'토생금' 같은 방향 명시 관계어. */
export function relationWord(a: ElementKo, b: ElementKo): string {
  const rel = relationKo(a, b);
  switch (rel) {
    case 'same': return `${a}${b} 동일`;
    case 'generates': return `${a}생${b}`;
    case 'generated_by': return `${b}생${a}`;
    case 'controls': return `${a}극${b}`;
    case 'controlled_by': return `${b}극${a}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  판정 다이제스트
// ─────────────────────────────────────────────────────────────────────────────

export interface CharJudgment {
  readonly hangul: string;
  readonly hanja: string | null;
  readonly onset: string | null;              // 초성 자모 (발음오행의 근거)
  readonly soundElement: ElementKo | null;    // 발음오행
  readonly resourceElement: ElementKo | null; // 자원오행 (한자 있을 때)
  readonly strokes: number | null;
  readonly meaning: string | null;
}

export interface PairJudgment {
  readonly fromChar: string;
  readonly toChar: string;
  readonly fromHanja: string | null;
  readonly toHanja: string | null;
  readonly fromOnset: string | null;
  readonly toOnset: string | null;
  readonly from: ElementKo;
  readonly to: ElementKo;
  readonly boundary: Boundary;
  readonly relation: ElementRelation;
}

export interface FrameJudgment {
  readonly frame: FrameType;
  readonly grade: LuckyGrade;
  readonly title: string | null;
}

export interface PhoneticSignalJudgment {
  readonly code: string;
  readonly risk: PhoneticRisk;
}

export interface NameEvidenceJudgments {
  readonly stem: Stem;
  readonly stemElement: ElementKo;
  readonly gangyak: StrengthCoarse;
  readonly gyeokgukFamily: GyeokgukFamily;
  readonly gyeokgukType: string | null;
  readonly nameEffect: NameEffect;
  readonly yongshin: ElementKo;
  readonly heeshin: ElementKo | null;
  readonly gishin: ElementKo | null;
  readonly surname: readonly CharJudgment[];
  readonly given: readonly CharJudgment[];
  readonly pairs: readonly PairJudgment[];
  readonly frames: readonly FrameJudgment[];
  /** 복성·이름 3자 이상 → 사격 서술 전체 생략 (설계 §5). */
  readonly framesSupported: boolean;
  /** 외자 이름 → 이격(S6.lee)은 D-1 쟁점 그 자체라 생략. */
  readonly frameLeeContested: boolean;
  readonly phoneticSignals: readonly PhoneticSignalJudgment[];
  readonly nameFull: string;
  readonly warnings: readonly string[];
}

const GANGYAK_KO: Record<StrengthCoarse, string> = { weak: '신약', balanced: '중화', strong: '신강' };
const RISK_ORDER: Record<PhoneticRisk, number> = { high: 3, medium: 2, low: 1 };

interface DeriveInput {
  readonly birth: BirthInfo;
  /** 판정 시점(순수성 유지를 위해 주입). 보통 실행 시각. */
  readonly targetDate: Date;
}

export function deriveJudgments(report: SpringReport, input: DeriveInput): NameEvidenceJudgments {
  const warnings: string[] = [];
  const saju = report.sajuReport;
  if (!saju?.sajuEnabled) {
    throw new Error('sajuReport.sajuEnabled=false — saju-ts dist 미빌드이거나 생년월일이 불완전합니다.');
  }

  // 일간 — 어댑터는 한글 표기('임') 또는 코드('IM')를 내보낸다. 정규화 실패는 즉시 실패.
  const stemInfo = lookupStemInfo(String(saju.dayMaster?.stem ?? ''));
  if (!stemInfo) throw new Error(`일간 정규화 실패: dayMaster.stem=${JSON.stringify(saju.dayMaster?.stem)}`);
  const stem = stemInfo.hangul as Stem;
  const stemElement = ELEMENT_KO_BY_CODE[stemInfo.element];

  // 강약·격국 family·이름작용 — 런타임과 같은 축 도출(class-axes)을 재사용.
  const feature = buildFeatureVector(saju, input.birth, input.targetDate);
  const packKey = packKeyFor('overall', feature, report.sajuCompatibility);
  if (!packKey) {
    throw new Error(`클래스 축 미해석: gyeokguk=${JSON.stringify(saju.gyeokguk?.type)} (family 매핑 없음)`);
  }
  const [gangyak, gyeokgukFamily, nameEffect] = packKey.split('.') as [StrengthCoarse, GyeokgukFamily, NameEffect, string];

  const yongshin = toElementKo(saju.yongshin?.element);
  if (!yongshin) throw new Error(`용신 오행 미해석: ${JSON.stringify(saju.yongshin?.element)}`);
  const heeshin = toElementKo(saju.yongshin?.heeshin);
  const gishin = toElementKo(saju.yongshin?.gishin);

  // 글자별 판정 — analysis 블록은 성+이름 전체 순서.
  const naming = report.namingReport;
  const hangulBlocks = naming.analysis.hangul.blocks;
  const hanjaBlocks = naming.analysis.hanja.blocks;
  const surnameLen = naming.name.surname.length;
  const givenLen = naming.name.givenName.length;
  if (hangulBlocks.length !== surnameLen + givenLen) {
    throw new Error(`hangul.blocks(${hangulBlocks.length}) ≠ 성(${surnameLen})+이름(${givenLen})`);
  }

  const charAt = (i: number): CharJudgment => {
    const hb = hangulBlocks[i];
    const jb = hanjaBlocks[i];
    const soundElement = toElementKo(hb.element);
    if (!soundElement) warnings.push(`발음오행 미해석: ${hb.hangul}(${hb.element})`);
    return {
      hangul: hb.hangul,
      hanja: jb?.hanja ?? null,
      onset: hb.onset ?? null,
      soundElement,
      resourceElement: jb ? toElementKo(jb.resourceElement) : null,
      strokes: jb?.strokes ?? null,
      meaning: naming.name.givenName[i - surnameLen]?.meaning ?? naming.name.surname[i]?.meaning ?? null,
    };
  };
  const surname = Array.from({ length: surnameLen }, (_, i) => charAt(i));
  const given = Array.from({ length: givenLen }, (_, i) => charAt(surnameLen + i));

  // 인접쌍 (발음오행, 방향 있음): 성 끝 → 이름 첫 = surname_given, 이름 내부 = given_internal.
  const pairs: PairJudgment[] = [];
  const chain = [...surname.slice(-1), ...given];
  for (let i = 0; i + 1 < chain.length; i += 1) {
    const a = chain[i]; const b = chain[i + 1];
    if (!a.soundElement || !b.soundElement) { warnings.push(`인접쌍 생략: ${a.hangul}→${b.hangul} (오행 미해석)`); continue; }
    pairs.push({
      fromChar: a.hangul, toChar: b.hangul,
      fromHanja: a.hanja, toHanja: b.hanja,
      fromOnset: a.onset, toOnset: b.onset,
      from: a.soundElement, to: b.soundElement,
      boundary: i === 0 ? 'surname_given' : 'given_internal',
      relation: relationKo(a.soundElement, b.soundElement),
    });
  }

  // 사격 — 등급은 DB의 한국어 5등급 문자열. 단, 엔진이 흉 등급을 서비스 톤으로
  // 정화해 내보내므로(sanitizeServiceText: '흉운수'→'주의가 필요한 수리')
  // 정화형을 원 등급으로 역매핑한다. 마지막 폴백은 luckyLevel 숫자 버킷.
  const SANITIZED_GRADE: Record<string, LuckyGrade> = {
    '최주의가 필요한 수리': '최흉운수',
    '주의가 필요한 수리': '흉운수',
  };
  const LUCKY_FALLBACK: Record<number, LuckyGrade> = { 25: '최상운수', 20: '상운수', 15: '양운수', 5: '흉운수', 0: '최흉운수' };
  const frames: FrameJudgment[] = naming.analysis.fourFrame.frames.map((f) => {
    const raw = (f as { meaning?: { lucky_level?: string; title?: string } | null }).meaning;
    const rawLevel = raw?.lucky_level ?? '';
    let grade: LuckyGrade | undefined =
      rawLevel in GRADE_TOKEN ? (rawLevel as LuckyGrade) : SANITIZED_GRADE[rawLevel];
    if (!grade) {
      grade = LUCKY_FALLBACK[f.luckyLevel];
      if (!grade) throw new Error(`사격 등급 미해석: ${f.type} lucky_level=${JSON.stringify(rawLevel)} luckyLevel=${f.luckyLevel}`);
      warnings.push(`사격 등급 폴백 사용: ${f.type} → ${grade} (luckyLevel=${f.luckyLevel})`);
    }
    return { frame: f.type, grade, title: raw?.title ?? null };
  });
  const framesSupported = surnameLen === 1 && givenLen >= 1 && givenLen <= 2;
  const frameLeeContested = framesSupported && givenLen === 1;
  if (!framesSupported) warnings.push('복성/이름 3자 이상 — 사격 서술 전체 생략 (설계 §5)');
  if (frameLeeContested) warnings.push('외자 이름 — 이격(利格)은 D-1(사격 공식) 쟁점이라 서술 생략');

  // 발음 신호 — options.precisionConfig.surfacePhoneticEvidence=true 필요.
  const transitions = naming.phonetic?.transitions ?? [];
  if (!naming.phonetic) warnings.push('phonetic 없음 — surfacePhoneticEvidence 미설정? S7 슬롯 생략됨');
  const signalMap = new Map<string, PhoneticSignalJudgment>();
  for (const t of transitions) {
    for (const s of t.signals) {
      const cur = signalMap.get(s.code);
      if (!cur || RISK_ORDER[s.severity] > RISK_ORDER[cur.risk]) signalMap.set(s.code, { code: s.code, risk: s.severity });
    }
  }

  return {
    stem, stemElement, gangyak, gyeokgukFamily,
    gyeokgukType: saju.gyeokguk?.type ?? null,
    nameEffect, yongshin, heeshin, gishin,
    surname, given, pairs, frames, framesSupported, frameLeeContested,
    phoneticSignals: [...signalMap.values()],
    nameFull: naming.name.fullHangul,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  슬롯 요청 도출 (패밀리별 키 매핑 — 계획 §derive 표)
// ─────────────────────────────────────────────────────────────────────────────

const BOUNDARY_KO: Record<Boundary, string> = { surname_given: '성과 이름의 경계', given_internal: '이름 안쪽' };

const RELATION_DESC: Record<ElementRelation, string> = {
  same: '같은 기운이 이어짐',
  generates: '앞이 뒤를 길러 주는 흐름(상생)',
  generated_by: '뒤가 앞을 길러 주는 흐름(역방향 상생)',
  controls: '앞이 뒤를 누르는 부딪힘(상극)',
  controlled_by: '뒤가 앞을 누르는 부딪힘(역방향 상극)',
};

const YONGSHIN_REL_BY_RELATION: Record<ElementRelation, YongshinRelation> = {
  same: 'match', generates: 'generates', generated_by: 'drains',
  controls: 'controls', controlled_by: 'controlled',
};

const YONGSHIN_REL_DESC: Record<YongshinRelation, (res: ElementKo, yong: ElementKo) => string> = {
  match: (res) => `자원오행 ${res} = 용신과 일치. 필요한 기운을 바로 담는 글자.`,
  generates: (res, yong) => `자원오행 ${res}는 용신 ${yong}을 길러 주는 오행(${res}생${yong}). 필요한 기운의 원천이 되는 글자.`,
  drains: (res, yong) => `용신 ${yong}이 자원오행 ${res}를 생함(${yong}생${res}) — 필요한 기운의 힘을 덜어 가는 방향.`,
  controls: (res, yong) => `자원오행 ${res}가 용신 ${yong}을 누름(${res}극${yong}) — 필요한 기운과 부딪히는 방향.`,
  controlled: (res, yong) => `용신 ${yong}이 자원오행 ${res}를 누름(${yong}극${res}) — 글자 기운이 눌려 크게 살지 못하는 방향.`,
};

/** 11개 발음 전이 규칙의 일반화 판정문 (글자 무관 — 슬롯 재사용을 위해). */
const PHONETIC_RULE_FACT: Record<string, string> = {
  complex_batchim_boundary: '겹받침 뒤에 다음 소리가 이어져 실제 발음을 한 번 더 확인해야 하는 연결.',
  nasal_assimilation_boundary: '받침 뒤에 콧소리가 이어져 표기와 실제 발음이 달라져 들리는 연결.',
  batchim_consonant_cluster: '받침 뒤에 자음이 이어져 소리가 다소 끊겨 들릴 수 있는 연결.',
  tensing_boundary: '받침 뒤의 예사소리가 된소리로 바뀌어 세게 들릴 수 있는 연결.',
  rieul_nasalization_boundary: '받침 뒤에 ㄹ 소리가 이어져 실제 발음이 바뀌어 들리는 연결.',
  nieun_rieul_liquid_boundary: 'ㄴ과 ㄹ이 맞닿아 소리가 하나로 합쳐져 들리는 연결.',
  same_coda_onset_repeat: '앞 글자 받침과 뒤 글자 첫소리가 같은 소리로 반복되는 연결.',
  same_initial_repeat: '첫소리가 반복되는 연결.',
  same_onset_vowel_repeat: '첫소리와 모음 모양이 함께 반복되는 연결.',
  same_vowel_repeat: '모음이 반복되어 짧은 이름에서 단조롭게 들릴 수 있는 연결.',
  sonorant_cluster: '울림소리가 맞닿아 소리가 뭉쳐 들릴 수 있는 연결.',
};

const ADVERSE_GRADES: ReadonlySet<LuckyGrade> = new Set(['흉운수', '최흉운수']);

/** 종합 절 재진술용 집계 — 발음 배열 전체의 결. */
export function phoneticFlowOf(j: NameEvidenceJudgments): PhoneticFlow | null {
  if (!j.pairs.length) return null;
  const isClash = (r: ElementRelation): boolean => r === 'controls' || r === 'controlled_by';
  if (j.pairs.every((p) => !isClash(p.relation))) return 'harmonious';
  if (j.pairs.every((p) => isClash(p.relation))) return 'clashing';
  return 'mixed';
}

/** 종합 절 재진술용 집계 — 서술 대상 사격의 등급 구성. */
export function frameOutlookOf(j: NameEvidenceJudgments): FrameOutlook | null {
  if (!j.framesSupported) return null;
  const narrated = j.frames.filter((f) => !(j.frameLeeContested && f.frame === 'lee'));
  if (!narrated.length) return null;
  const heavy = narrated.filter((f) => ADVERSE_GRADES.has(f.grade)).length;
  if (heavy === 0) return 'all_bright';
  if (heavy === 1) return 'mostly_bright';
  if (heavy === 2) return 'mixed';
  return 'heavy';
}

function makeCase(family: SlotFamily, key: NameEvidenceKey, spec: Omit<NameEvidenceCase['spec'], 'allowedVars'>): NameEvidenceCase {
  return {
    slotId: slotIdOf(family, key),
    family,
    role: FAMILY_ROLE[family],
    key,
    spec: { ...spec, allowedVars: ALLOWED_VARS[family] },
  };
}

export function slotRequestsFor(j: NameEvidenceJudgments): NameEvidenceCase[] {
  const out = new Map<string, NameEvidenceCase>();
  const add = (c: NameEvidenceCase): void => { if (!out.has(c.slotId)) out.set(c.slotId, c); };
  const stemPhrase = `일간 ${j.stem}(${j.stemElement})`;
  const gangyakKo = GANGYAK_KO[j.gangyak];

  // S1 물상 도입: 일간 × 강약
  add(makeCase('S1', { stem: j.stem, gangyak: j.gangyak }, {
    fact: `${stemPhrase} · ${gangyakKo} 상태.`,
    imagery: IMAGERY[j.stem],
    imageryState: IMAGERY_STATE[j.gangyak],
    isAdverse: false,
  }));

  // S2 십성 원리: 일간 × (이름 글자의 발음∪자원오행 distinct)
  const targetElements = new Set<ElementKo>();
  for (const c of j.given) {
    if (c.soundElement) targetElements.add(c.soundElement);
    if (c.resourceElement) targetElements.add(c.resourceElement);
  }
  for (const elem of targetElements) {
    const rel = relationKo(j.stemElement, elem);
    const tg = TEN_GOD_BY_RELATION[rel];
    add(makeCase('S2', { stem: j.stem, targetElement: elem }, {
      fact: `${elem}는 ${stemPhrase}에게 ${tg.name} (${relationWord(j.stemElement, elem)}).`,
      imagery: IMAGERY[j.stem],
      tenGodMeaning: `${tg.name} = ${tg.life}`,
      isAdverse: false,
    }));
  }

  // S3 용신 처방: 일간 × 용신오행
  const yongRel = relationKo(j.stemElement, j.yongshin);
  const yongTg = TEN_GOD_BY_RELATION[yongRel];
  add(makeCase('S3', { stem: j.stem, targetElement: j.yongshin }, {
    fact: `용신 = ${j.yongshin}. ${stemPhrase}에게 ${j.yongshin}는 ${yongTg.name} (${relationWord(j.stemElement, j.yongshin)}). 채우면 좋은 기운.`,
    imagery: IMAGERY[j.stem],
    tenGodMeaning: `${yongTg.name} = ${yongTg.life}`,
    isAdverse: false,
  }));

  // S4 발음 인접쌍: from × to × 경계
  for (const p of j.pairs) {
    add(makeCase('S4', { fromElement: p.from, toElement: p.to, boundary: p.boundary }, {
      fact: `앞 글자 ${p.from} → 뒤 글자 ${p.to} (${BOUNDARY_KO[p.boundary]}). 관계 = ${relationWord(p.from, p.to)}: ${RELATION_DESC[p.relation]}. 방향이 있는 관계 — 반대로 쓰지 말 것.`,
      isAdverse: p.relation === 'controls' || p.relation === 'controlled_by',
    }));
  }

  // S5 자원오행 판정: 자원오행 × 용신관계 (한자 있는 이름 글자만)
  for (const c of j.given) {
    if (!c.resourceElement) continue;
    const rel = YONGSHIN_REL_BY_RELATION[relationKo(c.resourceElement, j.yongshin)];
    add(makeCase('S5', { resourceElement: c.resourceElement, yongshinRelation: rel }, {
      fact: `${YONGSHIN_REL_DESC[rel](c.resourceElement, j.yongshin)} (2~3문장 — 이 글자가 이름 안에서 맡는 몫과 생활에서의 의미까지)`,
      isAdverse: rel === 'controls' || rel === 'controlled',
    }));
  }

  // S6 사격 길흉: 격 × 등급 (구조 미지원이면 요청하지 않음; 외자는 이격 제외)
  if (j.framesSupported) {
    for (const f of j.frames) {
      if (j.frameLeeContested && f.frame === 'lee') continue;
      add(makeCase('S6', { frame: f.frame, grade: f.grade }, {
        fact: `${FRAME_LABEL_KO[f.frame]}이 ${f.grade} 등급의 수에 놓임. 평문에서는 '수(數)'라는 명사와 등급명을 쓰지 말고 "이름의 획수로 ~를 봐요. 획수로 풀어 보면 (가장) 좋은/무난한/무거운/가장 무거운 흐름에 놓여 있어 …" 문형으로 — 무게는 '풀이'가 아니라 '흐름'에 붙인다. (획수 숫자·산식은 서술 금지)`,
        framePhase: `${FRAME_LABEL_KO[f.frame]} = ${FRAME_PHASE[f.frame]}`,
        isAdverse: ADVERSE_GRADES.has(f.grade),
      }));
    }
  }

  // S7 발음 전이 규칙: 규칙 × risk
  for (const s of j.phoneticSignals) {
    const fact = PHONETIC_RULE_FACT[s.code];
    if (!fact) continue; // 미지의 신규 코드 — 조용히 만들지 않는다
    add(makeCase('S7', { phoneticRule: s.code, risk: s.risk }, {
      fact: `${fact} (위험도: ${s.risk})`,
      isAdverse: s.risk === 'high',
    }));
  }

  // S8 이름 작용 종합: 일간 × 강약 × nameEffect
  add(makeCase('S8', { stem: j.stem, gangyak: j.gangyak, nameEffect: j.nameEffect }, {
    fact: `${stemPhrase} · ${gangyakKo} 사주에서 이름의 작용 = ${j.nameEffect} (boost_strong=강한 보강 / boost_mild=약한 보강 / neutral=중립 / adverse=필요 기운을 채우지 못함). 2~3문장 — 작용의 정도와 함께, 그래서 생활에서 무엇을 하면 되는지까지.`,
    imagery: IMAGERY[j.stem],
    imageryState: IMAGERY_STATE[j.gangyak],
    isAdverse: j.nameEffect === 'adverse',
  }));

  // S11/S12 종합 절 재진술: 발음 배열의 결 × 1 / 사격 등급 구성 × 1
  const flow = phoneticFlowOf(j);
  if (flow) {
    add(makeCase('S11', { phoneticFlow: flow }, {
      fact: `발음 배열 종합 = ${flow} (harmonious=상생·동기만 / mixed=상생·상극 혼재 / clashing=상극 위주). 이름의 소리 흐름 전체를 2~3문장으로 재진술하는 조각 — 종합 절의 첫머리에 놓이므로 자립 서술로, 맺음 표현 없이, 소리 갈래가 전체 인상에 주는 무게까지.`,
      isAdverse: flow === 'clashing',
    }));
  }
  const outlook = frameOutlookOf(j);
  if (outlook) {
    const narrated = j.frames.filter((f) => !(j.frameLeeContested && f.frame === 'lee'));
    const heavy = narrated.filter((f) => ADVERSE_GRADES.has(f.grade)).length;
    add(makeCase('S12', { frameOutlook: outlook }, {
      fact: `사격 등급 구성 = ${outlook} (서술 대상 ${narrated.length}격 중 흉 등급 ${heavy}개). 획수 풀이 전체를 2~3문장으로 재진술하는 조각 — 격 이름·숫자 없이 구성만, 그래서 어떻게 참고하면 되는지까지.`,
      isAdverse: outlook === 'mixed' || outlook === 'heavy',
    }));
  }

  // S9 4절 종합: 일간 × 강약 × 격국family × nameEffect
  add(makeCase('S9', { stem: j.stem, gangyak: j.gangyak, gyeokgukFamily: j.gyeokgukFamily, nameEffect: j.nameEffect }, {
    fact: `종합 맺음: ${stemPhrase} · ${gangyakKo} · 격국 계열 ${j.gyeokgukFamily} · 이름 작용 ${j.nameEffect}. 케이스 전체(바탕의 성격 → 필요한 기운 → 이름의 몫 → 유의점 → 생활 조언)를 3~5문장으로 합성하고 물상으로 여운 있게 닫는, 유일하게 긴 조각 (plain 100~280자 / expert 120~340자).`,
    imagery: IMAGERY[j.stem],
    imageryState: IMAGERY_STATE[j.gangyak],
    isAdverse: j.nameEffect === 'adverse',
  }));

  return [...out.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
//  런타임 변수 바인딩 (조립 시 {{var}} 치환값)
// ─────────────────────────────────────────────────────────────────────────────

const ELEMENT_PLAIN: Record<ElementKo, string> = { 목: '나무', 화: '불', 토: '흙', 금: '쇠', 수: '물' };

/** '민(旼)' — 한자 미상이면 '민'. */
const charRefOf = (hangul: string, hanja: string | null): string => (hanja ? `${hangul}(${hanja})` : hangul);

/** 동일 판정 글자 묶음: 1개 '민(旼)' / 2개 '민(旼)과 아(雅)' / 3개+ '가(甲)·나(乙)·다(丙)'. */
function joinCharRefs(chars: readonly CharJudgment[]): string | null {
  const refs = chars.map((c) => charRefOf(c.hangul, c.hanja));
  if (refs.length === 0) return null;
  if (refs.length === 1) return refs[0];
  if (refs.length === 2) return `${appendJosa(refs[0], '과와')} ${refs[1]}`;
  return refs.join('·');
}

export function varBindingsFor(j: NameEvidenceJudgments, requests: readonly NameEvidenceCase[]): Map<string, Record<string, string>> {
  const bindings = new Map<string, Record<string, string>>();
  const common = {
    dayMasterName: ELEMENT_PLAIN[j.stemElement],
    yongshinName: ELEMENT_PLAIN[j.yongshin],
    nameFull: j.nameFull,
  };
  for (const c of requests) {
    const vars: Record<string, string> = { ...common };
    if (c.family === 'S2') {
      const target = c.key.targetElement;
      const ref = joinCharRefs(j.given.filter((g) => g.soundElement === target || g.resourceElement === target));
      if (ref) vars.charRef = ref;
    }
    if (c.family === 'S5') {
      const ref = joinCharRefs(j.given.filter((g) => g.resourceElement === c.key.resourceElement));
      if (ref) vars.charRef = ref;
    }
    if (c.family === 'S4') {
      const hit = j.pairs.find((p) =>
        p.from === c.key.fromElement && p.to === c.key.toElement && p.boundary === c.key.boundary);
      if (hit) {
        vars.fromChar = charRefOf(hit.fromChar, hit.fromHanja);
        vars.toChar = charRefOf(hit.toChar, hit.toHanja);
        if (hit.fromOnset) vars.fromOnset = hit.fromOnset;
        if (hit.toOnset) vars.toOnset = hit.toOnset;
      }
    }
    if (c.family === 'S6' && c.key.frame) vars.frameLabel = FRAME_LABEL_KO[c.key.frame];
    // 화이트리스트 밖 값은 잘라서 게이트/조립 불변식과 일치시킨다.
    const allowed = new Set(c.spec.allowedVars.length ? [...c.spec.allowedVars] : []);
    bindings.set(c.slotId, Object.fromEntries(Object.entries(vars).filter(([k]) => allowed.has(k))));
  }
  return bindings;
}

// ─────────────────────────────────────────────────────────────────────────────
//  <analysis> 블록 직렬화 (프롬프트·검수용)
// ─────────────────────────────────────────────────────────────────────────────

export function buildAnalysisBlock(j: NameEvidenceJudgments): string {
  const lines: string[] = [];
  const charLine = (c: CharJudgment): string => {
    const parts = [
      c.hanja ? `${c.hangul}(${c.hanja})` : c.hangul,
      `발음오행 ${c.soundElement ?? '판정불가'}`,
    ];
    if (c.resourceElement) parts.push(`자원오행 ${c.resourceElement}`);
    if (c.meaning) parts.push(`뜻 ${c.meaning}`);
    return parts.join(' · ');
  };

  lines.push('<analysis>');
  lines.push(`- 일간: ${j.stem}(${j.stemElement}) / ${GANGYAK_KO[j.gangyak]}`);
  lines.push(`- 용신: ${j.yongshin}${j.heeshin ? ` / 희신: ${j.heeshin}` : ''}${j.gishin ? ` / 기신: ${j.gishin}` : ''}`);
  lines.push(`- 격국: ${j.gyeokgukType ?? '(미상)'} (계열: ${j.gyeokgukFamily}) / 이름 작용: ${j.nameEffect}`);
  lines.push(`- 이름: ${j.nameFull}`);
  for (const c of [...j.surname, ...j.given]) lines.push(`  · ${charLine(c)}`);
  if (j.pairs.length) {
    lines.push('- 발음 배열(방향 있음, 첫소리 기준):');
    for (const p of j.pairs) {
      const from = `${p.fromChar}(${p.fromOnset ?? '?'}·${p.from})`;
      const to = `${p.toChar}(${p.toOnset ?? '?'}·${p.to})`;
      lines.push(`  · ${from}→${to} (${BOUNDARY_KO[p.boundary]}): ${relationWord(p.from, p.to)} — ${RELATION_DESC[p.relation]}`);
    }
  }
  if (j.framesSupported) {
    lines.push(`- 수리사격(현행 엔진 공식 기준 — D-1 미결): ${j.frames.map((f) => `${FRAME_LABEL_KO[f.frame]} ${f.grade}${f.title ? `(${f.title})` : ''}`).join(' / ')}`);
  } else {
    lines.push('- 수리사격: 미지원 구조(복성·외자·이름 3자 이상) — 서술 생략');
  }
  if (j.phoneticSignals.length) {
    lines.push(`- 발음 전이 신호: ${j.phoneticSignals.map((s) => `${s.code}(${s.risk})`).join(', ')}`);
  }
  lines.push('※ 발음오행 유파: ㅇ·ㅎ=土(훈민정음 운해본) 기준 판정. 슬롯 본문에서 유파를 단정하지 말 것.');
  lines.push('</analysis>');
  return lines.join('\n');
}
