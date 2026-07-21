/**
 * name-evidence-gates.ts -- 슬롯 하드 게이트 (설계 §6.2 정합성 게이트).
 *
 * prose-lint(자연스러움·조립 규칙·물상 혼입)와 짝을 이루는 정량 게이트:
 * 스키마·slotId 집합 일치·분량·문장 수·해요체·tier 용어 분리·변수 화이트리스트·
 * 태그 수·정직성. 번들 단위 zero-reject (chunk-runner 규칙)는 CLI가 담당.
 */
import { GYEOKGUK_LIFE, PRINCIPLE_FAMILIES } from './name-evidence-schema.js';
import type { GeneratedSlot, NameEvidenceCase, Stem } from './name-evidence-schema.js';
import { lintSlotBundle } from './prose-lint.js';
import type { Finding } from './prose-lint.js';
import { isJosaPair } from '../../src/report/tiered/article-renderer.js';

/** 평문 tier 금지 용어 — validate-generated.ts JARGON 계승 + 성명학 확장.
 *  (기존 관례대로 모듈 간 복제: bundle-prompt/validate-generated도 각자 보유) */
const SAJU_JARGON: readonly string[] = [
  '오행', '용신', '희신', '기신', '구신', '격국', '십성', '십신', '정재', '편재', '재성',
  '편관', '정관', '식신', '상관', '식상', '겁재', '비견', '비겁', '인성', '정인', '편인',
  '관성', '신살', '상생', '상극', '조후', '대운', '득령', '득지', '득세', '원형이정',
  '자원오행', '발음오행', '수리사격', '신강', '신약', '중화', '일간',
];

const SLOT_RE = /\{\{([^{}]*)\}\}/gu;
const TAG_RE = /#\{([^{}]*)\}/gu;

function cp(s: string): number { return [...s].length; }
function sentences(s: string): string[] {
  return s.split(/(?<=[.!?…])\s+|(?<=요)\s+|(?<=죠)\s+/u).map((x) => x.trim()).filter(Boolean);
}
function haeyoche(s: string): boolean { return /(요|죠)[.!?…]?$/u.test(s.trim()); }
const FORMAL = /(습니다|합니다|입니다|십시오|이다|한다|된다)[.!?…]?$/u;

/** 변수·태그를 그럴듯한 실값으로 치환해 분량을 근사한다. */
function approxRender(t: string): string {
  return t
    .replace(/\{\{nameFull(?::[가-힣]+)?\}\}/gu, '최도윤')
    .replace(/\{\{frameLabel(?::[가-힣]+)?\}\}/gu, '형격')
    .replace(/\{\{heavyFrameRef(?::[가-힣]+)?\}\}/gu, '원격')
    .replace(/\{\{heavyFramePhase(?::[가-힣]+)?\}\}/gu, '성장기')
    .replace(/\{\{clashPairRef(?::[가-힣]+)?\}\}/gu, '민(旼)과 아(雅)')
    .replace(/\{\{trackRef(?::[가-힣]+)?\}\}/gu, '첫소리에 실린')
    .replace(/\{\{[A-Za-z]+:[가-힣]+\}\}/gu, '나무가')
    .replace(/\{\{[A-Za-z]+\}\}/gu, '나무')
    .replace(/#\{[A-Za-z_][A-Za-z0-9_]*\}/gu, '#용신');
}

/** "채워 준다" 계열 — isAdverse 슬롯에서 금지 (§6.2 정직성). */
const ADVERSE_FORBIDDEN = /채워 ?주|채워 ?줍|힘을 더해|힘을 보태|잘 맞아|잘 맞는|딱 맞|보강해 ?주|살려 ?주|받쳐 ?준다는 좋은/u;
/** 신약 물상 슬롯의 발산 방향 주장 — WARN (§6.2 강약 방향). */
const WEAK_OUTWARD = /내보내|발산|힘을 쏟아도 좋|마음껏 쓰|밖으로 펼치/u;

export interface SlotGateResult {
  readonly ok: boolean;
  /** 번들 수준 위반 (slotId 집합 불일치 등). */
  readonly violations: readonly string[];
  /** 슬롯별 위반. */
  readonly perSlot: ReadonlyMap<string, readonly string[]>;
  /** prose-lint 계열 findings (ERROR는 리젝). */
  readonly proseFindings: readonly Finding[];
}

export function validateNameEvidenceSlots(
  out: unknown,
  requested: readonly NameEvidenceCase[],
  opts: { readonly stem?: Stem; readonly bundleKey?: string } = {},
): SlotGateResult {
  const violations: string[] = [];
  const perSlot = new Map<string, string[]>();
  const requestedById = new Map(requested.map((c) => [c.slotId, c]));

  const slots = (out as { slots?: unknown })?.slots;
  if (!Array.isArray(slots) || slots.length === 0) {
    return { ok: false, violations: ['출력에 slots 배열이 없음'], perSlot, proseFindings: [] };
  }

  // slotId 집합 일치
  const gotIds = new Set<string>();
  for (const s of slots as Array<Record<string, unknown>>) {
    const id = String(s.slotId ?? '');
    if (gotIds.has(id)) violations.push(`slotId 중복: ${id}`);
    gotIds.add(id);
    if (!requestedById.has(id)) violations.push(`요청하지 않은 slotId: ${id}`);
  }
  for (const c of requested) if (!gotIds.has(c.slotId)) violations.push(`누락된 slotId: ${c.slotId}`);

  for (const raw of slots as Array<Record<string, unknown>>) {
    const id = String(raw.slotId ?? '');
    const c = requestedById.get(id);
    if (!c) continue;
    const v: string[] = [];
    const slot = raw as unknown as GeneratedSlot;

    // 분량 밴드 — 패밀리별. 기본은 짧은 조각(1~2문장), 글자 작용(S5)·이름 작용
    // 종합(S8)은 중간, 4절 종합(S9)은 케이스 전체를 합성하는 유일한 장문 조각.
    const FAMILY_BANDS: Partial<Record<string, { plain: [number, number]; expert: [number, number]; sentences: [number, number] }>> = {
      // S2 상한은 trackRef 의무화(+8자 내외)로 110→125 확대 (2026-07-21).
      S2: { plain: [40, 125], expert: [50, 160], sentences: [1, 2] },
      S5: { plain: [60, 160], expert: [80, 200], sentences: [2, 3] },
      S8: { plain: [80, 180], expert: [100, 220], sentences: [2, 3] },
      // S9 상한은 2026-07-21 검수(구체 영역 명시 + 실용 조언 의무화)로 280→320/340→400 확대.
      S9: { plain: [100, 320], expert: [120, 400], sentences: [3, 6] },
      S11: { plain: [60, 180], expert: [80, 220], sentences: [2, 3] },
      S12: { plain: [60, 180], expert: [80, 220], sentences: [2, 3] },
      S13: { plain: [60, 180], expert: [80, 220], sentences: [2, 3] },
    };
    const band = FAMILY_BANDS[c.family] ?? { plain: [40, 110] as [number, number], expert: [50, 160] as [number, number], sentences: [1, 2] as [number, number] };
    const bands = [['plain', ...band.plain], ['expert', ...band.expert]] as ReadonlyArray<readonly [('plain' | 'expert'), number, number]>;
    const [minSent, maxSent] = band.sentences;
    for (const [field, min, max] of bands) {
      const text = slot[field];
      if (typeof text !== 'string' || !text.trim()) { v.push(`${field} 없음`); continue; }
      const rendered = approxRender(text).trim();
      const n = cp(rendered);
      if (n < min || n > max) v.push(`${field} ${n}자 (${min}~${max})`);
      const ss = sentences(rendered);
      if (ss.length < minSent || ss.length > maxSent) v.push(`${field} ${ss.length}문장 (${minSent}~${maxSent})`);
      for (const sentence of ss) {
        if (FORMAL.test(sentence)) { v.push(`${field} 해요체 아님: "${sentence.slice(0, 20)}…"`); break; }
      }
      if (!haeyoche(rendered)) v.push(`${field} 해요체 종결 아님`);
    }

    // principle: S2/S3/S4만, ≤50자
    if (slot.principle !== undefined) {
      if (!PRINCIPLE_FAMILIES.has(c.family)) v.push(`principle은 S2/S3/S4 전용 (${c.family})`);
      else if (typeof slot.principle !== 'string' || cp(approxRender(slot.principle)) > 50) v.push('principle >50자');
    }

    // tier 분리: plain에 사주 용어 금지
    if (typeof slot.plain === 'string') {
      for (const j of SAJU_JARGON) {
        if (slot.plain.includes(j)) { v.push(`plain에 용어 노출: ${j}`); break; }
      }
      if (TAG_RE.test(slot.plain)) v.push('plain에 #{태그} — expert 전용');
      TAG_RE.lastIndex = 0;
    }

    // 변수 화이트리스트 + 조사쌍
    const allowed = new Set(c.spec.allowedVars);
    for (const field of ['plain', 'expert', 'principle'] as const) {
      const text = slot[field];
      if (typeof text !== 'string') continue;
      for (const m of text.matchAll(SLOT_RE)) {
        const [name, josa, ...rest] = m[1].split(':');
        if (rest.length || !allowed.has(name)) v.push(`${field} 허용 밖 변수 {{${m[1]}}}`);
        else if (josa !== undefined && !isJosaPair(josa)) v.push(`${field} 잘못된 조사쌍 {{${m[1]}}}`);
      }
      // 한자 하드코딩 금지 — 글자는 {{charRef}}/{{fromChar}}/{{toChar}} 변수로만.
      // (직접 쓴 한자는 그 이름 전용이 되어 슬롯 재사용을 깨고, 병기 규칙도 우회한다.)
      if (/[一-鿿]/u.test(text)) v.push(`${field} 한자 하드코딩 — 글자 변수 사용 (병기는 바인더가 처리)`);
    }

    // 태그: expert 0~2개
    if (typeof slot.expert === 'string') {
      const tags = [...slot.expert.matchAll(TAG_RE)];
      if (tags.length > 2) v.push(`expert 태그 ${tags.length}개 (0~2)`);
    }

    // 강약 무관 슬롯(키에 gangyak 없음)은 신강/신약/중화를 전제할 수 없다 —
    // 같은 슬롯이 반대 강약의 사주에도 재사용되기 때문.
    if (!c.key.gangyak) {
      for (const field of ['plain', 'expert', 'principle'] as const) {
        const text = slot[field];
        if (typeof text === 'string' && /신강|신약|극신|중화/u.test(text)) {
          v.push(`${field} 강약 전제 금지 — 이 슬롯은 강약 무관 키라 반대 강약 사주에도 재사용됨`);
        }
      }
    }

    // 재진술 지시 변수 (2026-07-21 검수: "한 자리가 무겁다"의 지시 대상 의무화).
    // 지목할 대상이 있는 변형은 변수를 반드시 쓰고, 없는 변형은 쓰면 안 된다 —
    // 없는 변형에서 쓰면 바인딩이 비어 {{var}}가 화면에 그대로 노출된다.
    if (c.family === 'S12' && typeof slot.plain === 'string') {
      const usesVar = slot.plain.includes('{{heavyFrameRef');
      if (c.key.frameOutlook === 'all_bright') {
        if (usesVar || slot.plain.includes('{{heavyFramePhase')) v.push('plain all_bright에 heavyFrame 변수 — 지목할 무거운 격이 없음');
      } else if (!usesVar) {
        v.push('plain에 {{heavyFrameRef}} 없음 — 어느 격이 무거운지 지목 의무');
      }
    }
    if (c.family === 'S11' && typeof slot.plain === 'string') {
      const usesVar = slot.plain.includes('{{clashPairRef');
      if (c.key.phoneticFlow === 'harmonious') {
        if (usesVar) v.push('plain harmonious에 clashPairRef 변수 — 지목할 부딪힘이 없음');
      } else if (!usesVar) {
        v.push('plain에 {{clashPairRef}} 없음 — 부딪히는 자리 지목 의무');
      }
    }

    // S2 트랙 표지 — 발음∪자원 합집합 서술이라 출처({{trackRef}}) 명시 의무.
    // 없으면 "서(書)의 쇠 기운 … 서(書)의 나무 기운"처럼 모순으로 읽힌다 (2026-07-21 검수).
    if (c.family === 'S2' && typeof slot.plain === 'string') {
      if (slot.plain.includes('{{charRef') && !slot.plain.includes('{{trackRef')) {
        v.push('plain에 {{trackRef}} 없음 — 기운의 출처(첫소리/글자) 표지 의무');
      }
    }

    // S9 조언 실용 모드 — 평문에 격국 계열의 실물 명사가 최소 1개 (2026-07-21 검수).
    if (c.family === 'S9' && c.key.gyeokgukFamily && typeof slot.plain === 'string') {
      const lex = GYEOKGUK_LIFE[c.key.gyeokgukFamily]?.lexicon;
      if (lex && !new RegExp(lex, 'u').test(slot.plain)) {
        v.push(`plain에 실물 조언 명사 없음 — ${c.key.gyeokgukFamily} 계열(${GYEOKGUK_LIFE[c.key.gyeokgukFamily].domains})의 행동 사전 어휘 필요`);
      }
    }

    // 정직성 + 강약 방향
    if (c.spec.isAdverse) {
      for (const field of ['plain', 'expert'] as const) {
        const text = slot[field];
        if (typeof text === 'string' && ADVERSE_FORBIDDEN.test(text)) v.push(`${field} 정직성 위반(불리 판정에 보강 표현)`);
      }
    }
    if (c.key.gangyak === 'weak' && c.key.stem) {
      for (const field of ['plain', 'expert'] as const) {
        const text = slot[field];
        if (typeof text === 'string' && WEAK_OUTWARD.test(text)) v.push(`WARN: ${field} 신약인데 발산 방향 표현`);
      }
    }

    if (v.length) perSlot.set(id, v);
  }

  // prose-lint 계열 (조립 규칙·물상 혼입·직유·외래어…)
  const proseFindings = lintSlotBundle(
    `${opts.bundleKey ?? 'bundle'}.out.json`,
    slots as Array<Record<string, unknown>>,
    opts.stem,
  );

  const hardPerSlot = [...perSlot.values()].some((list) => list.some((x) => !x.startsWith('WARN:')));
  const hardProse = proseFindings.some((f) => f.sev === 'ERROR');
  const ok = violations.length === 0 && !hardPerSlot && !hardProse;
  return { ok, violations, perSlot, proseFindings };
}
