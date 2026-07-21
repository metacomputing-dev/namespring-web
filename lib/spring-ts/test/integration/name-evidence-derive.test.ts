/**
 * name-evidence 파이프라인 유닛 테스트 (DB·엔진 불필요 — 픽스처 SpringReport).
 *
 * npx tsx test/integration/name-evidence-derive.test.ts
 *
 * 검증: 슬롯 키 도출(최도윤 기준 정확 일치) · 방향 관계 매핑 · 사격 등급/구조
 * 생략 플래그 · 변수 치환(조사 결합) · 게이트 리젝 · 조립 계약(중복 억제·결측
 * 생략) · prose-lint 슬롯 룰(접속사 시작·물상 혼입).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpringReport } from '../../src/types.js';
import {
  buildAnalysisBlock, deriveJudgments, relationKo, slotRequestsFor, varBindingsFor,
} from '../../tools/generation/name-evidence-derive.js';
import { assembleReport, fillVars } from '../../tools/generation/name-evidence-assemble.js';
import { validateNameEvidenceSlots } from '../../tools/generation/name-evidence-gates.js';
import { buildStoredSlot } from '../../tools/generation/name-evidence-store.js';
import { imageryMismatchRule, lintSlotBundle } from '../../tools/generation/prose-lint.js';
import type { NameEvidenceCase, StoredNameEvidenceSlot } from '../../tools/generation/name-evidence-schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, '../fixtures/name-evidence/choi-doyun-spring-report.json');

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, extra?: unknown): void {
  if (ok) { pass += 1; return; }
  fail += 1;
  console.log(`  FAIL  ${label}${extra !== undefined ? `\n        ${JSON.stringify(extra)}` : ''}`);
}
function checkEqual(label: string, actual: unknown, expected: unknown): void {
  check(label, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

const loadFixture = (): SpringReport =>
  JSON.parse(fs.readFileSync(FIXTURE, 'utf-8')) as unknown as SpringReport;

const BIRTH = { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const };
const TARGET_DATE = new Date(2026, 6, 21);

// ── 1. 판정 다이제스트 ───────────────────────────────────────────────────────
const report = loadFixture();
const j = deriveJudgments(report, { birth: BIRTH, targetDate: TARGET_DATE });

checkEqual('stem', j.stem, '임');
checkEqual('stemElement', j.stemElement, '수');
checkEqual('gangyak', j.gangyak, 'weak');
checkEqual('gyeokgukFamily', j.gyeokgukFamily, 'jaeseong');
checkEqual('nameEffect', j.nameEffect, 'adverse');
checkEqual('yongshin', j.yongshin, '금');
checkEqual('gishin', j.gishin, '화');
checkEqual('framesSupported', j.framesSupported, true);
checkEqual('frameLeeContested', j.frameLeeContested, false);
checkEqual('pairs', j.pairs.map((p) => `${p.from}${p.to}:${p.boundary}:${p.relation}`), [
  '금화:surname_given:controlled_by',
  '화토:given_internal:generates',
]);

// ── 2. 방향 관계 (elementMaps 방향판이 서술 방향과 일치하는가) ───────────────
checkEqual('relation 화→금', relationKo('화', '금'), 'controls');
checkEqual('relation 금→화', relationKo('금', '화'), 'controlled_by');
checkEqual('relation 토→금', relationKo('토', '금'), 'generates');
checkEqual('relation 금→토', relationKo('금', '토'), 'generated_by');
checkEqual('relation 수→수', relationKo('수', '수'), 'same');

// ── 3. 슬롯 키 집합 — 최도윤 기준 정확 일치 ─────────────────────────────────
const requests = slotRequestsFor(j);
const ids = requests.map((c) => c.slotId).sort();
checkEqual('slot ids (최도윤)', ids, [
  'S1.im.weak',
  'S2.im.hwa', 'S2.im.to',
  'S3.im.geum',
  'S4.geum.hwa.surname_given', 'S4.hwa.to.given_internal',
  'S5.hwa.controls', 'S5.to.generates',
  'S6.hyung.choesang', 'S6.jung.hyung', 'S6.lee.yang', 'S6.won.sang',
  'S7.tensing_boundary.medium',
  'S8.im.weak.adverse',
  'S9.im.weak.jaeseong.adverse',
].sort());

const byId = new Map(requests.map((c) => [c.slotId, c]));
check('S4 상극 isAdverse', byId.get('S4.geum.hwa.surname_given')?.spec.isAdverse === true);
check('S4 상생 not adverse', byId.get('S4.hwa.to.given_internal')?.spec.isAdverse === false);
check('S5.hwa.controls isAdverse', byId.get('S5.hwa.controls')?.spec.isAdverse === true);
check('S6 흉운수 isAdverse', byId.get('S6.jung.hyung')?.spec.isAdverse === true);
check('S8 adverse isAdverse', byId.get('S8.im.weak.adverse')?.spec.isAdverse === true);
check('S2 tenGodMeaning 재성', byId.get('S2.im.hwa')?.spec.tenGodMeaning?.includes('재성') === true);
check('S3 tenGodMeaning 인성', byId.get('S3.im.geum')?.spec.tenGodMeaning?.includes('인성') === true);

// ── 4. 구조 변형 — 외자 / 복성 / 이름 3자 ───────────────────────────────────
{
  const one = loadFixture() as unknown as { namingReport: { name: { givenName: unknown[] }; analysis: { hangul: { blocks: unknown[] }; hanja: { blocks: unknown[] } } } };
  one.namingReport.name.givenName = one.namingReport.name.givenName.slice(0, 1);
  one.namingReport.analysis.hangul.blocks = one.namingReport.analysis.hangul.blocks.slice(0, 2);
  one.namingReport.analysis.hanja.blocks = one.namingReport.analysis.hanja.blocks.slice(0, 2);
  const jj = deriveJudgments(one as unknown as SpringReport, { birth: BIRTH, targetDate: TARGET_DATE });
  checkEqual('외자 framesSupported', jj.framesSupported, true);
  checkEqual('외자 frameLeeContested', jj.frameLeeContested, true);
  const oneIds = slotRequestsFor(jj).map((c) => c.slotId);
  check('외자: S6.lee 미요청', !oneIds.some((id) => id.startsWith('S6.lee.')));
  check('외자: 다른 S6는 요청', oneIds.some((id) => id.startsWith('S6.won.')));
}
{
  const compound = loadFixture() as unknown as { namingReport: { name: { surname: unknown[]; givenName: unknown[] } } };
  const sur = compound.namingReport.name.surname;
  sur.push({ ...(sur[0] as Record<string, unknown>), hangul: '강', hanja: '姜' });
  const withExtra = compound as unknown as { namingReport: { analysis: { hangul: { blocks: Array<Record<string, unknown>> }; hanja: { blocks: Array<Record<string, unknown>> } } } };
  withExtra.namingReport.analysis.hangul.blocks.unshift({ hangul: '강', onset: 'ㄱ', nucleus: 'ㅏ', element: 'Wood', polarity: 'Positive' });
  withExtra.namingReport.analysis.hanja.blocks.unshift({ hanja: '姜', hangul: '강', strokes: 9, resourceElement: 'Wood', strokeElement: 'Water', polarity: 'Positive' });
  const jj = deriveJudgments(compound as unknown as SpringReport, { birth: BIRTH, targetDate: TARGET_DATE });
  checkEqual('복성 framesSupported', jj.framesSupported, false);
  check('복성: S6 미요청', !slotRequestsFor(jj).some((c) => c.family === 'S6'));
}

{
  // 엔진 정화형 등급('주의가 필요한 수리' 계열) 역매핑 — 폴백 경고 없이 인식
  const sanitized = loadFixture() as unknown as { namingReport: { analysis: { fourFrame: { frames: Array<{ type: string; meaning: { lucky_level: string } }> } } } };
  const frames = sanitized.namingReport.analysis.fourFrame.frames;
  frames.find((f) => f.type === 'jung')!.meaning.lucky_level = '주의가 필요한 수리';
  frames.find((f) => f.type === 'won')!.meaning.lucky_level = '최주의가 필요한 수리';
  const jj = deriveJudgments(sanitized as unknown as SpringReport, { birth: BIRTH, targetDate: TARGET_DATE });
  checkEqual('정화형 흉운수 역매핑', jj.frames.find((f) => f.frame === 'jung')?.grade, '흉운수');
  checkEqual('정화형 최흉운수 역매핑', jj.frames.find((f) => f.frame === 'won')?.grade, '최흉운수');
  check('정화형 역매핑은 폴백 경고 없음', !jj.warnings.some((w) => w.includes('폴백')));
}

// ── 5. 변수 바인딩 + 조사 치환 ───────────────────────────────────────────────
const bindings = varBindingsFor(j, requests);
checkEqual('S2.im.hwa 바인딩(charRef 병기)', bindings.get('S2.im.hwa'), { charRef: '도(都)' });
checkEqual('S3 바인딩(용신만)', bindings.get('S3.im.geum'), { yongshinName: '쇠' });
checkEqual('S6 바인딩(frameLabel)', bindings.get('S6.hyung.choesang'), { frameLabel: '형격' });
checkEqual('S4 바인딩(글자+첫소리)', bindings.get('S4.geum.hwa.surname_given'), {
  fromChar: '최(崔)', toChar: '도(都)', fromOnset: 'ㅊ', toOnset: 'ㄷ',
});
{
  // 동일 판정 글자 묶음: 윤의 자원오행도 화로 바꾸면 S5.hwa.controls가 두 글자를 묶는다
  const twin = loadFixture() as unknown as { namingReport: { analysis: { hanja: { blocks: Array<{ hanja: string; resourceElement: string }> } } } };
  twin.namingReport.analysis.hanja.blocks.find((b) => b.hanja === '尹')!.resourceElement = 'Fire';
  const jj = deriveJudgments(twin as unknown as SpringReport, { birth: BIRTH, targetDate: TARGET_DATE });
  const reqs = slotRequestsFor(jj);
  const bb = varBindingsFor(jj, reqs);
  checkEqual('S5 묶음 바인딩(두 글자)', bb.get('S5.hwa.controls'), { charRef: '도(都)와 윤(尹)' });
}
checkEqual('fillVars 받침O 이가', fillVars('{{yongshinName:이가}} 힘이 돼요.', { yongshinName: '물' }), '물이 힘이 돼요.');
checkEqual('fillVars 받침X 이가', fillVars('{{charHangul:이가}} 중심이에요.', { charHangul: '도' }), '도가 중심이에요.');
checkEqual('fillVars 으로로 ㄹ', fillVars('{{yongshinName:으로로}} 흘러요.', { yongshinName: '물' }), '물로 흘러요.');
checkEqual('fillVars 미지 변수 보존', fillVars('{{unknownVar}} 유지', {}), '{{unknownVar}} 유지');
checkEqual('fillVars 한자 미상 병기 괄호 제거', fillVars('{{charHangul}}({{charHanja}})의 기운', { charHangul: '도' }), '도의 기운');

// ── 6. analysis 블록 — 유파 고지 + 획수 산식 부재 ───────────────────────────
const analysis = buildAnalysisBlock(j);
check('analysis 유파 고지', analysis.includes('운해본'));
check('analysis 방향 관계 명시', analysis.includes('화극금') || analysis.includes('금'));
check('analysis에 획수 산식 없음', !/\d+\s*획\s*[+＋]/u.test(analysis));

// ── 7. 게이트 — 정상/위반 슬롯 ──────────────────────────────────────────────
const s2Case = byId.get('S2.im.hwa') as NameEvidenceCase;
const okSlot = {
  slotId: 'S2.im.hwa',
  plain: '{{charRef}}의 불 기운은 큰 강물이 눌러 힘을 쏟는 자리예요. 마른 강에는 무거운 짐이 돼요.',
  expert: '화는 임수 일간이 극하는 재성이에요. #{jaeseong} 신약 원국에서는 재성 과다가 설기로 작동해요.',
  principle: '불은 큰 강물이 누르며 힘을 쏟는 자리예요.',
};
{
  const r = validateNameEvidenceSlots({ slots: [okSlot] }, [s2Case], { stem: '임', bundleKey: 'ne.imagery.im' });
  check('게이트: 정상 슬롯 통과', r.ok, { violations: r.violations, perSlot: [...r.perSlot], prose: r.proseFindings.filter((f) => f.sev === 'ERROR') });
}
{
  const bad = { ...okSlot, plain: '그래서 오행이 부족해요. 이 이름은 재성이라 나빠요.' };
  const r = validateNameEvidenceSlots({ slots: [bad] }, [s2Case], { stem: '임', bundleKey: 'ne.imagery.im' });
  check('게이트: 접속사 시작+용어 노출 리젝', !r.ok);
  check('게이트: plain 용어 검출', [...r.perSlot.values()].flat().some((v) => v.includes('용어 노출')));
  check('게이트: slot-leading-conjunction 검출', r.proseFindings.some((f) => f.rule === 'slot-leading-conjunction'));
}
{
  const wrongVar = { ...okSlot, plain: '{{frameLabel}}의 기운이 무거워요. 필요한 쪽을 살리지 못하는 흐름이에요.' };
  const r = validateNameEvidenceSlots({ slots: [wrongVar] }, [s2Case], { stem: '임' });
  check('게이트: 허용 밖 변수 리젝', !r.ok && [...r.perSlot.values()].flat().some((v) => v.includes('허용 밖 변수')));
}
{
  const missing = validateNameEvidenceSlots({ slots: [okSlot] }, [s2Case, byId.get('S3.im.geum') as NameEvidenceCase], { stem: '임' });
  check('게이트: 누락 slotId 리젝', !missing.ok && missing.violations.some((v) => v.includes('누락')));
}
{
  const legacyVar = { ...okSlot, plain: '{{charHangul}}의 불 기운은 큰 강물이 눌러 힘을 쏟는 자리예요. 마른 강에는 무거운 짐이 돼요.' };
  const r = validateNameEvidenceSlots({ slots: [legacyVar] }, [s2Case], { stem: '임' });
  check('게이트: 구 변수(charHangul) 리젝', !r.ok && [...r.perSlot.values()].flat().some((v) => v.includes('허용 밖 변수')));
}
{
  const hardcoded = { ...okSlot, plain: '도(都)의 불 기운은 큰 강물이 눌러 힘을 쏟는 자리예요. 마른 강에는 무거운 짐이 돼요.' };
  const r = validateNameEvidenceSlots({ slots: [hardcoded] }, [s2Case], { stem: '임' });
  check('게이트: 한자 하드코딩 리젝', !r.ok && [...r.perSlot.values()].flat().some((v) => v.includes('하드코딩')));
}
{
  // S9(종합)만 2~4문장·긴 분량 허용 — 짧으면 리젝
  const s9Case = byId.get('S9.im.weak.jaeseong.adverse') as NameEvidenceCase;
  const longS9 = {
    slotId: s9Case.slotId,
    plain: '큰 강물이 되어야 할 물의 수원이 아직 얕은 사주예요. 이름이 그 물길을 크게 채우지는 못하니, 부족한 쪽은 배움과 사람에게서 챙기는 편이 좋아요. 물길을 따라 꾸준히 흐르다 보면 강은 제 폭을 찾아요.',
    expert: '신약한 임수 원국에서 재성 과다가 설기로 작동하는 구성이에요. 이름의 자원오행이 용신을 싣지 못한 만큼, 인성의 보급은 문서와 조력의 몫으로 남아요. 수원이 차오르면 강은 스스로 길을 넓히는 배치예요.',
  };
  const r = validateNameEvidenceSlots({ slots: [longS9] }, [s9Case], { stem: '임' });
  check('게이트: S9 장문(2~4문장) 통과', r.ok, { perSlot: [...r.perSlot], prose: r.proseFindings.filter((f) => f.sev === 'ERROR') });
  const shortS9 = { ...longS9, plain: '물길을 찾으면 강은 멀리 흘러요.' };
  const r2 = validateNameEvidenceSlots({ slots: [shortS9] }, [s9Case], { stem: '임' });
  check('게이트: S9 단문 리젝', !r2.ok);
}

// ── 8. prose-lint 슬롯 룰 — 물상 혼입 ───────────────────────────────────────
{
  const rule = imageryMismatchRule('임');
  check('물상: 임 번들에 뿌리(wood 어휘) → ERROR', rule.re.test('마른 뿌리를 내리는 흐름이에요.'));
  check('물상: 임 번들에 강물 → 허용', !rule.re.test('큰 강물이 흐르는 자리예요.'));
  check('물상: 해요체 오탐 없음', !rule.re.test('힘을 쏟는 자리예요. 무리하지 않아도 돼요.'));
  const findings = lintSlotBundle('ne.imagery.im.out.json', [{ slotId: 'S1.im.weak', plain: '촛불처럼요? 화로의 온기가 필요해요. 흐름이 얕아요.', expert: '수원이 마른 상태예요. 받쳐 줄 기운이 필요해요.' }], '임');
  check('물상: lintSlotBundle 혼입 검출', findings.some((f) => f.rule === 'slot-imagery-mismatch'));
}

// ── 9. 조립 — 절 구성·중복 억제·결측 생략·D-1 격리 표시 ─────────────────────
{
  const store = new Map<string, StoredNameEvidenceSlot>();
  const put = (id: string, plain: string, expert: string): void => {
    const c = byId.get(id) as NameEvidenceCase;
    store.set(id, buildStoredSlot(c, { plain, expert }, 'regen-ne-test'));
  };
  put('S1.im.weak', '큰 강물이 되어야 할 물의 수원이 마른 상태예요.', '임수 일간이 신약한 원국이에요.');
  put('S4.geum.hwa.surname_given', '쇠 다음에 불이 오면 서로 부딪히는 흐름이에요.', '금 뒤의 화는 화극금의 부딪힘이에요.');
  put('S6.won.sang', '{{frameLabel}}은 출발의 흐름을 돕는 자리에 놓여 있어요.', '{{frameLabel}}이 상운수에 놓였어요.');
  put('S9.im.weak.jaeseong.adverse', '마른 강에는 물길을 여는 선택이 남아 있어요.', '신약 재성과다 원국에서 이름이 용신을 살리지 못해요.');

  const assembled = assembleReport(j, store, bindings);
  check('조립: 결측 슬롯 기록', assembled.missingSlotIds.length > 0);
  check('조립: 사용 슬롯 = store 보유분', assembled.usedSlotIds.length === 4, assembled.usedSlotIds);
  check('조립: D-1 격리 표시(S6)', assembled.provisionalSlotIds.includes('S6.won.sang'));
  check('조립: frameLabel 치환됨', assembled.sections.some((s) => s.plain.some((p) => p.includes('원격은'))));
  check('조립: 섹션 수 > 0', assembled.sections.length >= 3, assembled.sections.map((s) => s.title));
  const allPlain = assembled.sections.flatMap((s) => s.plain).join(' ');
  check('조립: 미치환 변수 없음', !/\{\{/u.test(allPlain), allPlain);
}

// ── summary ─────────────────────────────────────────────────────────────────
console.log(`\nname-evidence tests · PASS: ${pass}  FAIL: ${fail}`);
if (fail > 0) process.exit(1);
