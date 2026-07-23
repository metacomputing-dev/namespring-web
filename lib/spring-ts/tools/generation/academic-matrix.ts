/**
 * academic-matrix.ts -- Single source of truth for the academic content matrix
 * (격국 × 이름작용 × 시기국면). Redefined per the 3rd external review (§11):
 * differentiate the *task itself* by 격국, not just the lens — this is what kills
 * the mid-band cross-bundle convergence and makes the name-effect tangible.
 *
 * Design doc: docs/academic-matrix-v1.md (local). Consumed by generate-manifest.ts
 * (writes per-case spec fields, academic-scoped only) and bundle-prompt.ts (injects
 * the per-cell period task). Every string here is *meaning to enforce*, NOT copy to
 * paste — the prompt tells OPUS to realize the task with this bundle's palette so
 * the anti-stamping diversity contract still holds.
 */
import type { GyeokgukFamily, StrengthCoarse } from './case-schema.js';
import { axisIndex, compactHints, rotateEven, type DiversityHints } from './diversity-rotation.js';

/** Per-격국 study temperament + risk, in plain language (no jargon). Relocated from
 *  bundle-prompt.ts and refined per domain review: 비겁=자기결정 우선, 인성=이해 먼저,
 *  식상=표현·산출, 재성=현실 목표·투자. */
export const ACADEMIC_STUDY_PROFILE: Record<GyeokgukFamily, string> = {
  bigeop: '자기결정·자립형 — 스스로 정한 순서로 공부할 때 가장 강함. 결과 동기=시작한 공부를 내 힘으로 끝까지 마침. **리스크**: 혼자 밀어붙이다 막힘, 남과 비교 과열, 도움을 안 받아 헛심.',
  gwanseong: '규칙·마감·시험 체계형 — 짜인 과정·기한·통과기준을 따라갈 때 강함. 결과 동기=자격·통과. **리스크**: 정답 하나 고집·완벽주의로 이해가 굳음, 압박 과부하.',
  inseong: '이해·흡수형 — 충분히 이해하고 받아들일 때 강함(자료보다 이해가 먼저). 결과 동기=깊이 이해. **리스크**: 입력만 쌓고 정리·출력(문제풀이·요약)이 밀림, 결정을 미룸.',
  siksang: '표현·산출형 — 설명·토론·발표·문제풀이로 내보낼 때 이해가 굳음. **리스크**: 벌여만 놓고 마무리가 약함, 규칙과 부딪힘.',
  jaeseong: '현실 목표·투자형 — 쓸모·현실 결과가 보일 때 붙음, 목표에 맞춰 자원을 투자함. **리스크**: 흥미 없으면 안 붙음, 넓게 벌려 얕아짐.',
  special: '한 방향으로 크게 몰입하는 형 — 대세를 따를 때 강함. **리스크**: 균형·기본기를 놓침.',
};

/** Period keys used by the academic adult manifest (PERIOD_LENS keys). */
export type AcademicPeriod = 'today' | 'thisWeek' | 'thisMonth' | 'thisYear' | 'life';

/**
 * A. 격국 × 시기 → the distinct concrete study TASK. The cell's core sentence must
 * carry an activity only this 격국 would do. Period roles (today=1 즉시행동 /
 * week=배치 / month=마일스톤·완주 / year=전략·순환 / life=기질·축적) are preserved
 * but filled with the 격국-specific task.
 */
export const ACADEMIC_PERIOD_TASK: Record<GyeokgukFamily, Record<AcademicPeriod, string>> = {
  bigeop: {
    today: '스스로 잡은 오늘 분량을 중간에 다른 걸로 바꾸지 않고 끝까지 마치기(한 번 앉으면 그 공부를 그 자리에서 끝냄)',
    thisWeek: '이번 주 공부 기준(분량·순서)을 스스로 세우고 끝까지 지키기(남과 견주기보다 내 기준 지키기)',
    thisMonth: '한 교재·과목을 내 순서로 처음부터 끝까지 마치는 한 달 계획',
    thisYear: '올해 "내 힘으로 통과할 목표(시험·자격)" 하나를 골라 자기주도로 밀고 가기',
    life: '남이 짠 과정보다 내가 세운 순서로 끝까지 해내는 공부 방식으로 쌓기',
  },
  gwanseong: {
    today: '오늘 마감·제출 기준 한 칸을 규칙대로 채워 확인 — 절차 한 단계 통과',
    thisWeek: '마감·시험 일정을 역산해 요일별 통과 조건을 배치(점검 목록 재편)',
    thisMonth: '이번 달 시험·자격 범위를 통과기준으로 쪼개 단계별 중간 목표점 점검',
    thisYear: '올해 자격·시험 큰 관문의 단계별 통과 전략(등록→범위→모의→본)',
    life: '기준·절차를 세우고 지켜 신뢰를 쌓는 장기 학습 질서',
  },
  inseong: {
    today: '새 자료 더 모으기 전에, 이미 읽은 한 대목을 충분히 이해했는지 내 말로 설명·정리(이해→출력 전환) 1회',
    thisWeek: '입력(강의·독서)과 정리·출력(요약·문제) 요일을 갈라 배치 — 이해한 걸 내보내는 흐름',
    thisMonth: '한 강의를 완강하며 챕터마다 이해한 걸 정리·문제풀이로 굳히는 달',
    thisYear: '올해 깊게 팔 주제 하나를 이해→정리→산출까지 잇는 장기 흡수',
    life: '오래 붙들어 깊이 이해하되, 입력만 쌓지 않게 정리·출력으로 매듭짓는 방식',
  },
  siksang: {
    today: '오늘 배운 걸 요약·설명·풀이 한 편으로 표현해 이해 굳히기 — 표현·산출 1개',
    thisWeek: '표현·산출물(설명·풀이·정리)을 요일별로 하나씩 쌓아 완결 습관',
    thisMonth: '한 주제를 "설명할 수 있는 수준"까지 표현해 내보내는 달(정리노트·발표·문제집)',
    thisYear: '올해 벌인 표현·산출을 다듬어 결과물(정리물·모음집·답안력)로 잇기',
    life: '표현하고 만들며 배우되, 벌인 것을 마무리로 매듭짓는 습관',
  },
  jaeseong: {
    today: '오늘 끝내면 가장 현실적으로 도움이 되는 한 과제부터(우선순위 3개만 남기고) — 목표에 이어질 것에 시간 투자',
    thisWeek: '이번 주 목표에 비춰 쓸모 큰 과목에 시간·자원을 더 투자(현실 목표 기준 배분)',
    thisMonth: '이번 달 목표를 현실 결과로 정하고 자원을 그 목표에 투자하며 진척 관리',
    thisYear: '올해 "쓸모·현실로 이어질 학습" 큰 목표와 자원(시간·비용·에너지) 투자 전략',
    life: '현실 목표로 학습을 설계하되, 흥미 없는 기초도 투자에 넣는 평생 균형',
  },
  special: {
    today: '가장 몰입되는 한 갈래에 집중 투자하되 기본기 한 대목만 곁들이기',
    thisWeek: '대세인 한 과목·주제에 무게를 싣되 놓치기 쉬운 기본 요일 하나 확보',
    thisMonth: '몰입 주제 하나를 깊게 미는 달, 균형 점검 1회',
    thisYear: '올해 크게 몰아갈 방향에 올인하되 반기마다 기본기 재점검',
    life: '큰 몰입으로 멀리 가되 기본·균형을 평생 관리점으로',
  },
};

/**
 * B. 격국 × 이름작용 → what the name amplifies/tempers for THIS 격국.
 * benefit = the 격국 strength the name adds; risk = the over-side to watch.
 * - boost_strong/boost_mild carry both (mild = a step, conditional on routine).
 * - neutral: name adds nothing → benefit empty (gate forbids positive name-effect),
 *   describe via 원국·시기 only.
 * - adverse: the name pushes an already-strong side further → benefit empty, the
 *   "risk" is the over-strengthened tendency, remedied by living habit (no stigma).
 */
export interface NameEffectCell { readonly benefit: string; readonly risk: string; }

export const ACADEMIC_NAME_EFFECT: Record<GyeokgukFamily, Record<string, NameEffectCell>> = {
  bigeop: {
    boost_strong: { benefit: '시작한 공부를 끝까지 밀고 가는 힘을 크게 감당(더 큰 목표도 내 힘으로 끝냄)', risk: '독주·비교 과열, 도움을 거절해 헛심' },
    boost_mild: { benefit: '꾸준할 때 내 공부 페이스가 한 단계 단단해짐', risk: '혼자 오래 붙들다 막힘' },
    neutral: { benefit: '', risk: '자기주도 성향은 원국·시기 신호로만(이름은 방향을 바꾸지 않음)' },
    adverse: { benefit: '', risk: '이미 강한 자기고집을 더 밀어주는 쪽 → 협업·도움받기를 생활에서 챙기기' },
  },
  gwanseong: {
    boost_strong: { benefit: '더 큰 관문·기준을 감당할 책임 여력', risk: '완벽주의·정답 고집으로 이해 경직, 압박 과부하' },
    boost_mild: { benefit: '마감·규칙을 한 단계 더 지키는 성실', risk: '시키는 것만 하다 응용이 약해짐' },
    neutral: { benefit: '', risk: '규율 성향은 원국·시기 신호로만(이름은 방향을 바꾸지 않음)' },
    adverse: { benefit: '', risk: '이미 강한 압박·완벽주의를 더 밀어주는 쪽 → 여백·오답 허용을 생활에서 챙기기' },
  },
  inseong: {
    boost_strong: { benefit: '깊이 이해·흡수 폭이 크게 넓어짐', risk: '입력만 쌓고 정리·출력이 밀림, 결정 지연' },
    boost_mild: { benefit: '이해·기억이 한 단계 안정', risk: '자료 수집에 머무름' },
    neutral: { benefit: '', risk: '흡수 성향은 원국·시기 신호로만(이름은 방향을 바꾸지 않음)' },
    adverse: { benefit: '', risk: '이미 강한 자료욕심·입력편중을 더 밀어주는 쪽 → 정리·출력·마감을 생활에서 챙기기' },
  },
  siksang: {
    boost_strong: { benefit: '표현·산출 에너지를 크게 감당(많이 만들어 이해 굳힘)', risk: '벌여만 놓고 마무리가 약함, 규칙과 충돌' },
    boost_mild: { benefit: '꾸준히 내보내며 한 단계 정리력', risk: '완성 전 다음 것으로 넘어감' },
    neutral: { benefit: '', risk: '표현 성향은 원국·시기 신호로만(이름은 방향을 바꾸지 않음)' },
    adverse: { benefit: '', risk: '이미 강한 산만·확산을 더 밀어주는 쪽 → 마무리·범위 좁히기를 생활에서 챙기기' },
  },
  jaeseong: {
    boost_strong: { benefit: '넓은 계획 소화·현실 목표 관리를 크게 감당', risk: '넓게 벌려 얕아짐, 흥미 없으면 방치' },
    boost_mild: { benefit: '현실 목표 중심으로 한 단계 또렷해짐', risk: '결과가 안 보이면 미룸' },
    neutral: { benefit: '', risk: '목표관리 성향은 원국·시기 신호로만(이름은 방향을 바꾸지 않음)' },
    adverse: { benefit: '', risk: '이미 강한 결과편중·산만을 더 밀어주는 쪽 → 기초·비인기 과목을 생활에서 챙기기' },
  },
  special: {
    boost_strong: { benefit: '몰입의 폭·깊이를 크게 감당', risk: '기본기·균형을 놓침' },
    boost_mild: { benefit: '한 방향 집중이 한 단계 강화', risk: '편식 학습' },
    neutral: { benefit: '', risk: '몰입 성향은 원국·시기 신호로만(이름은 방향을 바꾸지 않음)' },
    adverse: { benefit: '', risk: '이미 강한 편중을 더 밀어주는 쪽 → 기본기·균형을 생활에서 챙기기' },
  },
};

/** Period task for one (격국, period) cell, or '' if the period is outside the
 *  standard adult set (stages/minor use different period keys → no forced task). */
export function academicPeriodTask(fam: GyeokgukFamily, period: string): string {
  return ACADEMIC_PERIOD_TASK[fam]?.[period as AcademicPeriod] ?? '';
}

/** Name benefit/risk for one (격국, nameEffect) cell. */
export function academicNameEffect(fam: GyeokgukFamily, nameEffect: string): NameEffectCell {
  return ACADEMIC_NAME_EFFECT[fam]?.[nameEffect] ?? { benefit: '', risk: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Diversity palettes (academic). The rotation MECHANISM is common
//  (diversity-rotation.ts); these are academic's VALUES. Assigned deterministically
//  per cell so the 15 cells of one bundle spread across distinct forms — the root
//  fix for the B-category repetition (name-effect formula / 중화 descriptor / expert
//  endings) instead of piling "don't repeat" prompt lines.
// ─────────────────────────────────────────────────────────────────────────────

const PERIOD_ORDER: readonly string[] = ['today', 'thisWeek', 'thisMonth', 'thisYear', 'life'];
const BAND_ORDER: readonly string[] = ['high', 'mid', 'low', 'any'];

/** Name-effect sentence FRAMES (guidance labels, realized in the writer's own
 *  words). Rotated by period so a boost bundle's periods don't all use the same
 *  "이름이 ~ 주는 [명사]" formula (prose-lint name-effect cluster). */
const NAME_FRAMES: readonly string[] = [
  '비교형 — "여러 갈래로 벌일 때보다 하나를 오래 붙들 때 ~" 처럼 A와 B를 견주어',
  '조건형 — "~일수록 / ~할 때라야 또렷해져요" 처럼 조건을 걸어',
  '부정·전환형 — "~로는 잘 안 살고, ~라야 ~" 처럼 안 맞는 쪽을 먼저 짚고 전환',
  '명사구형 — "이름이 더해 주는 [든든함/뒷심]은 ~에서 ~" 처럼 이름 효과를 명사로',
];

/** Gate-valid strength/balance plain forms, one per accepted gate pattern
 *  (validate-generated STRENGTH_PLAIN_PATTERNS). Rotating across them spreads the
 *  중화 descriptor so the "치우치지/쏠리지" cluster stops dominating. */
const STRENGTH_PLAIN_FORMS: Record<StrengthCoarse, readonly string[]> = {
  balanced: ['기복이 크지 않은', '한쪽으로 치우치지 않는', '균형이 잡힌', '고른 흐름의', '안정된', '무난한'],
  strong: ['힘이 실리는', '추진력이 붙는', '주도권을 쥐는', '단단한', '기세가 오르는'],
  weak: ['쉽게 흔들릴 수 있는', '무리하면 지치는', '받쳐 주면 나아지는', '기반을 다져야 하는', '여린'],
};

/** Expert-paragraph ending nouns to anchor a cell's close, spread across the
 *  bundle so 자리/구조/배치 stop repeating (prose-lint expert-ending cluster). */
const EXPERT_ENDINGS: readonly string[] = ['자리', '구조', '배치', '짜임', '결'];

/**
 * Deterministic anti-repetition hints for one academic cell.
 * - nameFrame  : by period (5 periods → 4 frames), boost bundles vary the formula.
 * - balancePhrase: by (period×band), gate-valid form for this person's 강약.
 * - expertEndingHint: by (period×band), spreads expert 종결어.
 * Returns undefined when nothing is set (keeps manifest lean).
 */
export function academicDiversityHints(
  fam: GyeokgukFamily,
  period: string,
  band: string,
  gangyak: StrengthCoarse,
): DiversityHints | undefined {
  const p = axisIndex(period, PERIOD_ORDER);
  const b = axisIndex(band, BAND_ORDER);
  const cellIdx = p * BAND_ORDER.length + b;
  const forms = STRENGTH_PLAIN_FORMS[gangyak] ?? STRENGTH_PLAIN_FORMS.balanced;
  return compactHints({
    nameFrame: rotateEven(NAME_FRAMES, p),
    balancePhrase: rotateEven(forms, cellIdx),
    expertEndingHint: rotateEven(EXPERT_ENDINGS, cellIdx),
  });
}
