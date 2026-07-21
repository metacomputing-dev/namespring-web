/**
 * name-evidence-assemble.ts -- 결정론 조립기 (설계 §5 조립 계약, 단독 이름 적응).
 *
 * 절 순서(단독 이름): 1절 이름 진단(S4→S7→S6) / 2절 필요한 기운(S1→S2→S3) /
 * 3절 이름의 적합성(S5→S8) / 4절 종합(S9).
 * 계약: slotId당 리포트 내 1회(첫 배치 우선) · 결측 슬롯은 줄 생략+warning
 * (폴백 문장을 지어내지 않는다) · 복성/3자 사격 전체 생략 · 외자 이격 생략 ·
 * tier는 섞지 않는다(plain/expert 각각 완성).
 */
import { appendJosa, isJosaPair } from '../../src/report/tiered/article-renderer.js';
import { ELEMENT_TOKEN, FRAME_LABEL_KO, GRADE_TOKEN, STEM_TOKEN } from './name-evidence-schema.js';
import type { ElementKo, FrameType, LuckyGrade, StoredNameEvidenceSlot } from './name-evidence-schema.js';
import type { NameEvidenceJudgments } from './name-evidence-derive.js';
import { frameOutlookOf, phoneticFlowOf, slotRequestsFor } from './name-evidence-derive.js';

const VAR_RE = /\{\{([A-Za-z]+)(?::([가-힣]+))?\}\}/gu;

/** 범용 {{name}} / {{name:조사쌍}} 치환. 미지 변수는 그대로 두고 warning은
 *  게이트가 이미 막았으므로 여기서는 조용히 통과시킨다.
 *  예외: 한자 미상 이름(순한글 입력)에서 병기 괄호 "({{charHanja}})"가 남으면
 *  괄호째 지운다 — 한자 부재는 정상 상태이지 결측 버그가 아니다. */
export function fillVars(text: string, vars: Readonly<Record<string, string>>): string {
  const filled = text.replace(VAR_RE, (whole, name: string, josa?: string) => {
    const value = vars[name];
    if (value === undefined) return whole;
    if (josa === undefined) return value;
    if (!isJosaPair(josa)) return value;
    return appendJosa(value, josa);
  });
  return filled.replace(/\(\{\{charHanja\}\}\)/gu, '').replace(/\{\{charHanja\}\}/gu, '');
}

export interface AssembledSection {
  readonly title: string;
  readonly plain: readonly string[];   // 문단 배열
  readonly expert: readonly string[];
}

export interface AssembledReport {
  readonly sections: readonly AssembledSection[];
  readonly usedSlotIds: readonly string[];
  readonly missingSlotIds: readonly string[];
  readonly warnings: readonly string[];
  readonly provisionalSlotIds: readonly string[]; // D-1 격리 표시(S6)
}

const FRAME_ORDER: readonly FrameType[] = ['won', 'hyung', 'lee', 'jung'];

export function assembleReport(
  j: NameEvidenceJudgments,
  store: ReadonlyMap<string, StoredNameEvidenceSlot>,
  bindings: ReadonlyMap<string, Record<string, string>>,
): AssembledReport {
  const requests = slotRequestsFor(j);
  const bySlotId = new Map(requests.map((c) => [c.slotId, c]));
  const used = new Set<string>();
  const missing: string[] = [];
  const warnings: string[] = [...j.warnings];
  const provisional: string[] = [];

  /** slotId 목록 → (중복 억제 + 결측 생략 + 변수 치환)된 조각들. */
  const pick = (slotIds: readonly string[]): Array<{ plain: string; expert: string }> => {
    const out: Array<{ plain: string; expert: string }> = [];
    for (const id of slotIds) {
      if (used.has(id)) continue;                 // 중복 억제 (첫 배치 우선)
      const slot = store.get(id);
      if (!slot) { missing.push(id); continue; }  // 결측 → 줄 생략
      used.add(id);
      if (slot.keyProvenance === 'engine-current-formula-b') provisional.push(id);
      const vars = bindings.get(id) ?? {};
      const expertText = slot.principle ? `${fillVars(slot.principle, vars)} ${fillVars(slot.expert, vars)}` : fillVars(slot.expert, vars);
      out.push({ plain: fillVars(slot.plain, vars), expert: expertText });
    }
    return out;
  };

  const paragraph = (pieces: Array<{ plain: string; expert: string }>, tier: 'plain' | 'expert'): string =>
    pieces.map((p) => p[tier]).join(' ');

  const sectionOf = (title: string, groups: ReadonlyArray<readonly string[]>): AssembledSection => {
    const pickedGroups = groups.map((g) => pick(g)).filter((g) => g.length > 0);
    return {
      title,
      plain: pickedGroups.map((g) => paragraph(g, 'plain')),
      expert: pickedGroups.map((g) => paragraph(g, 'expert')),
    };
  };

  const ids = {
    s4: j.pairs.map((p) => `S4.${tok(p.from)}.${tok(p.to)}.${p.boundary}`),
    s7: j.phoneticSignals.map((s) => `S7.${s.code}.${s.risk}`),
    s6: j.framesSupported
      ? FRAME_ORDER
        .filter((f) => !(j.frameLeeContested && f === 'lee'))
        .flatMap((f) => {
          const frame = j.frames.find((x) => x.frame === f);
          return frame ? [`S6.${f}.${gradeTok(frame.grade)}`] : [];
        })
      : [],
    s1: [`S1.${stemTok(j)}.${j.gangyak}`],
    s2: [...new Set([
      ...j.given.flatMap((c) => (c.soundElement ? [`S2.${stemTok(j)}.${tok(c.soundElement)}`] : [])),
      ...j.given.flatMap((c) => (c.resourceElement ? [`S2.${stemTok(j)}.${tok(c.resourceElement)}`] : [])),
    ])],
    s3: [`S3.${stemTok(j)}.${tok(j.yongshin)}`],
    s5: [...new Set(j.given.flatMap((c) => {
      const req = requests.find((r) => r.family === 'S5' && r.key.resourceElement === c.resourceElement);
      return req ? [req.slotId] : [];
    }))],
    s8: [`S8.${stemTok(j)}.${j.gangyak}.${j.nameEffect}`],
    // 종합 절 = [소리·획수 재진술(S11+S12)] + [물상 맺음(S9)] — 앞 절 전체를 아우른다.
    s11: ((): string[] => { const f = phoneticFlowOf(j); return f ? [`S11.${f}`] : []; })(),
    s12: ((): string[] => { const o = frameOutlookOf(j); return o ? [`S12.${o}`] : []; })(),
    s9: [`S9.${stemTok(j)}.${j.gangyak}.${j.gyeokgukFamily}.${j.nameEffect}`],
  };
  // 요청 도출과 조립이 어긋나지 않게 검증: 조립이 참조하는 id는 모두 요청 집합의 부분집합.
  for (const id of Object.values(ids).flat()) {
    if (!bySlotId.has(id)) warnings.push(`조립 참조 id가 요청 집합에 없음(버그 의심): ${id}`);
  }

  // 한자 뜻 문단 — 판정 데이터(옥편 뜻)의 결정론 직렬화 (레퍼런스 §3 ⑤).
  // 서술 창작이 아니라 사실 나열이므로 슬롯 없이 코드가 만든다.
  const meaningChars = j.given.filter((c) => c.hanja && c.meaning);
  const meaningParagraph = meaningChars.length
    ? `한자의 뜻도 이름의 결을 이뤄요. ${meaningChars
      .map((c) => `${appendJosa(`${c.hangul}(${c.hanja})`, '은는')} '${c.meaning}'`)
      .join(', ')}의 뜻을 담고 있어요.`
    : null;

  const withMeaning = (s: AssembledSection): AssembledSection => (meaningParagraph
    ? { ...s, plain: [meaningParagraph, ...s.plain], expert: [meaningParagraph, ...s.expert] }
    : s);

  const sections = [
    sectionOf(`지금 이름 진단 — ${j.nameFull}`, [[...ids.s4, ...ids.s7], ids.s6]),
    sectionOf('이 사주에 필요한 기운', [[...ids.s1, ...ids.s2, ...ids.s3]]),
    withMeaning(sectionOf('이름이 주는 기운', [ids.s5, ids.s8])),
    sectionOf('종합', [[...ids.s11, ...ids.s12], ids.s9]),
  ].filter((s) => s.plain.length > 0);

  return {
    sections,
    usedSlotIds: [...used],
    missingSlotIds: missing,
    warnings,
    provisionalSlotIds: provisional,
  };
}

// 토큰 헬퍼 (schema의 맵을 함수형으로 감싼 지역 단축)
const tok = (e: ElementKo): string => ELEMENT_TOKEN[e];
const gradeTok = (g: LuckyGrade): string => GRADE_TOKEN[g];
const stemTok = (j: NameEvidenceJudgments): string => STEM_TOKEN[j.stem];

// ─────────────────────────────────────────────────────────────────────────────
//  검수용 마크다운
// ─────────────────────────────────────────────────────────────────────────────

export function renderReviewMarkdown(j: NameEvidenceJudgments, r: AssembledReport, analysisBlock: string): string {
  const lines: string[] = [];
  lines.push(`# 이름 근거 리포트 (조립 검수용) — ${j.nameFull}`);
  lines.push('');
  for (const s of r.sections) {
    lines.push(`## ${s.title}`);
    lines.push('');
    lines.push('**[평문]**');
    for (const p of s.plain) { lines.push(''); lines.push(p); }
    lines.push('');
    lines.push('**[전문가]**');
    for (const p of s.expert) { lines.push(''); lines.push(p); }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('### 조립 메타');
  lines.push(`- 사용 슬롯 ${r.usedSlotIds.length}개: ${r.usedSlotIds.join(', ')}`);
  if (r.missingSlotIds.length) lines.push(`- ⚠ 결측(줄 생략) ${r.missingSlotIds.length}개: ${r.missingSlotIds.join(', ')}`);
  if (r.provisionalSlotIds.length) lines.push(`- ⚠ D-1 미결 격리(현행 사격 공식 기준): ${r.provisionalSlotIds.join(', ')}`);
  for (const w of r.warnings) lines.push(`- ⚠ ${w}`);
  if (j.framesSupported) lines.push(`- 사격 등급: ${j.frames.map((f) => `${FRAME_LABEL_KO[f.frame]}=${f.grade}`).join(' / ')}`);
  lines.push('- 발음오행 유파: ㅇ·ㅎ=土(훈민정음 운해본) 기준 판정 결과입니다.');
  lines.push('');
  lines.push('### 판정 원본');
  lines.push('```');
  lines.push(analysisBlock);
  lines.push('```');
  return lines.join('\n');
}
