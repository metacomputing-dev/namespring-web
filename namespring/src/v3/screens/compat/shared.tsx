/**
 * 궁합 화면 3장(통합·이름간·사주간)이 함께 쓰는 조각들.
 * 데이터 훅, 점수·축 카드, 교차 신호 브라우저, 유료·저장·공유 꼬리 구조.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  BranchPairFactV1,
  CompatContextV1,
  CompatFramingV1,
  CompatibilityAxisV1,
  CompatibilityGradeV1,
  CompatibilityPersonEchoV1,
  CompatibilitySummaryV1,
  CoupleCompatibilityV1,
  StemPairFactV1,
} from '@spring/report/compatibility/index';
import { deriveColoredAnimal } from '@spring/report/zodiac';
import { computeCompatibility, isSamePerson } from '../../engine/compatibility';
import type { CompatRelationshipSelection, CompatSlot } from '../../model/compat';
import { ELEMENT_KO } from '../../model/facts';
import { PILLAR_KO } from '../../model/saju-labels';
import {
  compatPairKey,
  isCompatSaved,
  listSavedCompats,
  removeSavedCompat,
  saveCompat,
} from '../../model/saved-compat';
import { ElementBadge, ReportActions, Section, useTerms } from '../../ui/primitives';
import { PersonSceneryArt } from './PersonSceneryPair';

/* ================================================================== */
/* 라벨                                                                 */
/* ================================================================== */

export const GRADE_KO: Record<CompatibilityGradeV1, string> = {
  excellent: '아주 잘 맞아요',
  good: '잘 맞는 편이에요',
  balanced: '무난해요',
  watch: '완급 조절이 필요해요',
  challenging: '노력이 필요해요',
};

const BRANCH_RELATION_CHIP: Record<string, { label: string; tone: 'help' | 'pace' }> = {
  yukhap: { label: '육합', tone: 'help' },
  samhap: { label: '삼합 반합', tone: 'help' },
  banghap: { label: '방합', tone: 'help' },
  chung: { label: '충', tone: 'pace' },
  hyeong: { label: '형', tone: 'pace' },
  jahyeong: { label: '자형', tone: 'pace' },
  hae: { label: '해', tone: 'pace' },
  pa: { label: '파', tone: 'pace' },
  wonjin: { label: '원진', tone: 'pace' },
  gwimun: { label: '귀문', tone: 'pace' },
};

const RELATION_GLOSS: Record<string, string> = {
  yukhap: '서로 끌어당겨 하나의 기운으로 모이는 관계예요.',
  samhap: '뜻과 방향이 자연스럽게 맞물리는 관계예요.',
  banghap: '같은 계절의 기운이 모여 익숙하고 편안한 관계예요.',
  chung: '정면으로 부딪히며 변화를 여는 관계예요.',
  hyeong: '서로를 다듬으며 긴장을 만드는 관계예요.',
  jahyeong: '닮은 자리끼리 서로의 약점을 비추는 관계예요.',
  hae: '은근히 어긋나 신경이 쓰이는 관계예요.',
  pa: '맞물린 흐름이 어긋나기 쉬운 관계예요.',
  wonjin: '까닭 없이 서운함이 쌓이기 쉬운 관계예요.',
  gwimun: '예민하게 끌리고 깊이 몰입하게 되는 관계예요.',
  hap: '서로 끌어당겨 하나의 기운으로 모이는 관계예요.',
  stemChung: '정면으로 부딪히며 변화를 여는 관계예요.',
};

/* ================================================================== */
/* 데이터 훅                                                             */
/* ================================================================== */

export type CompatState =
  | { status: 'missing' }
  | { status: 'same' }
  | { status: 'loading' }
  | { status: 'ready'; result: CoupleCompatibilityV1 }
  | { status: 'error'; message: string };

export function useCompatibilityResult(
  slotA: CompatSlot | null,
  slotB: CompatSlot | null,
  selection: CompatRelationshipSelection = { category: 'unspecified' },
): CompatState {
  const [state, setState] = useState<CompatState>({ status: 'missing' });
  const { category, label, tone } = selection;

  useEffect(() => {
    if (!slotA || !slotB) {
      setState({ status: 'missing' });
      return;
    }
    if (isSamePerson(slotA.profile, slotB.profile)) {
      setState({ status: 'same' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    computeCompatibility(slotA, slotB, { category, label, tone })
      .then(result => {
        if (!cancelled) setState({ status: 'ready', result });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slotA, slotB, category, label, tone]);

  return state;
}

/* ================================================================== */
/* 점수·축 카드                                                          */
/* ================================================================== */

export function ScoreBar({ score }: { score: number }) {
  return (
    <div className="v3-compare-track" aria-hidden="true" style={{ marginTop: '0.5rem' }}>
      <div
        className="v3-compare-fill v3-compare-fill--saju"
        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
      />
    </div>
  );
}

export function SummaryCard({
  summary,
  kicker,
  headerAction,
}: {
  summary: CompatibilitySummaryV1;
  kicker: string;
  /** 카드 우상단에 붙는 동작 (예: 보관 별표 토글). */
  headerAction?: React.ReactNode;
}) {
  if (summary.availability.status === 'unavailable') {
    return (
      <div className="v3-card v3-card--tinted">
        <p className="v3-kicker">{kicker}</p>
        <p style={{ margin: 0 }}>{summary.headline}</p>
      </div>
    );
  }
  return (
    <div className="v3-card">
      <p className="v3-kicker">{kicker}</p>
      <div className="v3-fortune-cell-head">
        <p className="v3-core-value" style={{ margin: 0 }}>
          {summary.score}
          <span className="v3-hint" style={{ marginLeft: '0.25rem' }}>/ 100</span>
        </p>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <span className="v3-badge v3-badge--accent">{GRADE_KO[summary.grade]}</span>
          {headerAction}
        </span>
      </div>
      <ScoreBar score={summary.score} />
      <p style={{ margin: '0.6rem 0 0' }}>{summary.headline}</p>
      {summary.paragraphs.map((paragraph, index) => (
        <p key={index} style={{ margin: '0.45rem 0 0' }}>{paragraph}</p>
      ))}
      {summary.cautions.length > 0 ? (
        <div className="v3-callout v3-callout--caution" style={{ marginTop: '0.6rem' }}>
          <p className="v3-callout-title">
            <span aria-hidden="true">✦</span> 한 번 더 살필 점
          </p>
          <ul>
            {summary.cautions.map((caution, index) => (
              <li key={index}>{caution}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="v3-hint" style={{ margin: '0.6rem 0 0' }}>{summary.weightsNote}</p>
    </div>
  );
}

export function AxisCard({
  axis,
  defaultOpen = false,
}: {
  axis: CompatibilityAxisV1;
  defaultOpen?: boolean;
}) {
  // 축별 비중(가중치)은 점수 산출의 전문 정보라 전문 모드에서만 드러낸다.
  const { expert } = useTerms();
  if (axis.availability.status === 'unavailable') {
    return (
      <div className="v3-card v3-card--tinted">
        <div className="v3-fortune-cell-head">
          <strong>{axis.label}</strong>
        </div>
        <p className="v3-hint" style={{ margin: '0.4rem 0 0' }}>{axis.headline}</p>
        {axis.paragraphs.map((paragraph, index) => (
          <p key={index} className="v3-hint" style={{ margin: '0.3rem 0 0' }}>{paragraph}</p>
        ))}
      </div>
    );
  }
  return (
    <div className="v3-card">
      <div className="v3-fortune-cell-head">
        <div>
          <strong>{axis.label}</strong>{' '}
          <span className="v3-badge" style={{ marginLeft: '0.3rem' }}>{GRADE_KO[axis.grade]}</span>
        </div>
        <span>
          <strong>{axis.score}</strong>
          <span className="v3-hint">
            점{expert && axis.weight < 1 ? ` · 비중 ${Math.round(axis.weight * 100)}%` : ''}
          </span>
        </span>
      </div>
      <ScoreBar score={axis.score} />
      <p style={{ margin: '0.55rem 0 0' }}>{axis.headline}</p>
      {axis.paragraphs.length > 0 || axis.tips.length > 0 || axis.cautions.length > 0 ? (
        <details style={{ marginTop: '0.45rem' }} open={defaultOpen}>
          <summary className="v3-hint" style={{ cursor: 'pointer' }}>자세히 읽기</summary>
          <div className="v3-reading">
            {axis.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {axis.tips.length > 0 ? (
              <div className="v3-callout v3-callout--tip">
                <p className="v3-callout-title">
                  <span aria-hidden="true">☘</span> 이 흐름을 살리는 방법
                </p>
                <ul>
                  {axis.tips.map((tip, index) => (
                    <li key={index}>{tip}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {axis.cautions.length > 0 ? (
              <div className="v3-callout v3-callout--caution">
                <p className="v3-callout-title">
                  <span aria-hidden="true">✦</span> 한 번 더 살필 점
                </p>
                <ul>
                  {axis.cautions.map((caution, index) => (
                    <li key={index}>{caution}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function axesOf(
  result: CoupleCompatibilityV1,
  ids: readonly string[],
): CompatibilityAxisV1[] {
  return ids
    .map(id => result.axes.find(axis => axis.id === id))
    .filter((axis): axis is CompatibilityAxisV1 => !!axis);
}

/* ================================================================== */
/* 사람 요약                                                             */
/* ================================================================== */

/** 일지의 부름말은 프레임을 따른다 — 아이·가족 짝에 배우자궁 언어를 쓰지 않는다. */
export function dayBranchSeatLabel(framing: CompatFramingV1): string {
  return framing === 'couple' ? '일지(배우자궁)' : '일지(속마음 자리)';
}

/** 마지막 한글 음절의 받침 유무 — 조사(과/와, 이에요/예요) 선택용. */
function hasJongseong(word: string): boolean {
  for (let index = word.length - 1; index >= 0; index -= 1) {
    const code = word.charCodeAt(index);
    if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  }
  return false;
}

function gwaWa(word: string): string {
  return `${word}${hasJongseong(word) ? '과' : '와'}`;
}

export function PersonEchoCard({
  echo,
  title,
  framing = 'companion',
  slot,
}: {
  echo: CompatibilityPersonEchoV1;
  title: string;
  framing?: CompatFramingV1;
  /** 있으면 사람별 풍경 그림을 카드 하단에 그린다 (준비되는 대로). */
  slot?: CompatSlot;
}) {
  // 일주 동물(생일·나 자신)은 띠(생년)와 다르다 — 같은 파생 함수로 뽑아 함께 보여준다.
  const dayAnimal =
    echo.dayStem && echo.dayBranch
      ? deriveColoredAnimal(echo.dayStem.element, echo.dayBranch.code)
      : null;
  return (
    <div className="v3-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <p className="v3-kicker">{title}</p>
      <p className="v3-core-value" style={{ marginBottom: '0.35rem' }}>
        {echo.displayName}
        {echo.fullHanja ? <span className="v3-title-hanja"> {echo.fullHanja}</span> : null}
      </p>
      <ul className="v3-plain-list">
        {echo.zodiac ? (
          <li>
            띠(생년){' '}
            <strong>
              {echo.zodiac.color
                ? `${echo.zodiac.label}(${echo.zodiac.labelHanja})`
                : echo.zodiac.zodiacLabel}
            </strong>
            {echo.zodiac.color ? <span className="v3-hint"> {echo.zodiac.zodiacLabel}</span> : null}
          </li>
        ) : null}
        {echo.dayStem ? (
          <li>
            일간 <strong>{echo.dayStem.hangul}({echo.dayStem.hanja})</strong>{' '}
            <ElementBadge element={echo.dayStem.element} suffix="기운" />
            {dayAnimal ? (
              <span className="v3-hint">
                {' '}일주 동물 {dayAnimal.color ? dayAnimal.label : dayAnimal.animal} (나 자신)
              </span>
            ) : null}
          </li>
        ) : null}
        {echo.dayBranch ? (
          <li>
            {dayBranchSeatLabel(framing)}{' '}
            <strong>{echo.dayBranch.hangul}({echo.dayBranch.hanja})</strong>{' '}
            <ElementBadge element={echo.dayBranch.element} suffix="기운" />
          </li>
        ) : null}
        {echo.yongshinElement ? (
          <li>
            반기는 기운 <ElementBadge element={echo.yongshinElement} suffix="기운" />
          </li>
        ) : null}
      </ul>
      {/* 풍경 그림은 카드의 맨 아래에 둔다 — 셀 하단 배치가 확정 지시다. */}
      {slot ? (
        <div style={{ marginTop: 'auto', paddingTop: '0.7rem' }}>
          <PersonSceneryArt slot={slot} />
        </div>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* 두 사람의 자리 (관계·나이 맥락)                                         */
/* ================================================================== */

const FRAMING_KO: Record<CompatFramingV1, string> = {
  couple: '연인·부부의 언어로 읽어요',
  companion: '우정·동반의 언어로 읽어요',
  guardian: '돌봄·성장의 언어로 읽어요',
  kids: '기질·우정의 언어로 읽어요',
};

export function ContextCard({ context }: { context: CompatContextV1 }) {
  // 계약상 context는 항상 오지만, 구 빌더 캐시가 남아 있는 동안은 조용히 비운다.
  if (!context?.fact) return null;
  const { fact, notes } = context;
  const ageChipLabel =
    fact.sameAge === true || fact.ageGapYears === 0
      ? '동갑'
      : fact.ageGapYears !== null
        ? `나이차 ${fact.ageGapYears}살`
        : null;

  // 계약에는 있지만 병렬 엔진 작업이 랜딩되기 전에는 런타임에 없을 수 있다.
  const relationshipLabel = fact.relationshipLabel ?? null;

  return (
    <div className="v3-card">
      <p className="v3-kicker">두 사람의 자리</p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {relationshipLabel ? (
          <span className="v3-badge v3-badge--accent">{relationshipLabel}</span>
        ) : null}
        <span className={relationshipLabel ? 'v3-badge' : 'v3-badge v3-badge--accent'}>
          {FRAMING_KO[fact.framing]}
        </span>
        {ageChipLabel ? <span className="v3-badge">{ageChipLabel}</span> : null}
        {fact.twelveGapSameZodiac ? <span className="v3-badge">띠동갑</span> : null}
      </div>
      {notes.map((note, index) => (
        <p key={index} style={{ margin: '0.55rem 0 0' }}>{note}</p>
      ))}
    </div>
  );
}

/* ================================================================== */
/* 오행으로 견주어 보기 (두 사람 원국 분포 비교)                             */
/* ================================================================== */

const COMPARE_ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'] as const;

type ElementShare = NonNullable<CompatibilityPersonEchoV1['sajuElements']>;

/**
 * 통합 보고서의 ElementCompareBars와 대칭인 두 사람 비교 막대.
 * 위 두 줄 = 사주(녹색), 아래 두 줄 = 이름(갈색). 각 묶음에서 진한 색이
 * 첫 번째 사람, 연한 색이 두 번째 사람이다.
 * 두 사람 다 사주 분포 echo가 없으면 아무것도 그리지 않는다.
 */
export function ElementPairCompareSection({ result }: { result: CoupleCompatibilityV1 }) {
  const aSaju = result.persons.a.sajuElements ?? null;
  const bSaju = result.persons.b.sajuElements ?? null;
  if (!aSaju || !bSaju) return null;
  const aName = result.persons.a.nameElements ?? null;
  const bName = result.persons.b.nameElements ?? null;
  const share = (values: ElementShare | null, element: string) =>
    values?.find(value => value.element === element)?.sharePercent ?? 0;
  const aLabel = result.persons.a.displayName;
  const bLabel = result.persons.b.displayName;

  return (
    <Section title="오행으로 견주어 보기">
      <div className="v3-card">
        <div className="v3-compare">
          {COMPARE_ELEMENTS.map(element => (
            <div key={element} className="v3-compare-row">
              <span className="v3-compare-label">{ELEMENT_KO[element]}</span>
              <div className="v3-compare-tracks v3-compare-tracks--pair">
                {/* 사주 (녹색): 진한=첫 사람, 연한=둘째 사람 */}
                <div className="v3-compare-track">
                  <div className="v3-compare-fill v3-compare-fill--saju" style={{ width: `${share(aSaju, element)}%` }} />
                </div>
                <div className="v3-compare-track">
                  <div className="v3-compare-fill v3-compare-fill--saju-light" style={{ width: `${share(bSaju, element)}%` }} />
                </div>
                {/* 이름 (갈색): 진한=첫 사람, 연한=둘째 사람. 회색 트랙은 전체 폭,
                    색 채움만 절반 눈금(재료가 적어 사주와 규모가 다름을 표시). */}
                <div className="v3-compare-track">
                  <div className="v3-compare-fill v3-compare-fill--name" style={{ width: `${share(aName, element) / 2}%` }} />
                </div>
                <div className="v3-compare-track">
                  <div className="v3-compare-fill v3-compare-fill--name-light" style={{ width: `${share(bName, element) / 2}%` }} />
                </div>
              </div>
              <span className="v3-compare-values">
                <span style={{ display: 'block' }}>
                  {Math.round(share(aSaju, element))}·{Math.round(share(bSaju, element))}%
                </span>
                <span style={{ display: 'block', opacity: 0.65 }}>
                  {Math.round(share(aName, element))}·{Math.round(share(bName, element))}%
                </span>
              </span>
            </div>
          ))}
          <p className="v3-hint" style={{ marginTop: '0.5rem' }}>
            위 두 줄이 사주(녹색), 아래 두 줄이 이름(갈색)이에요. 각 묶음에서 진한 색이
            {' '}{aLabel}, 연한 색이 {bLabel}{hasJongseong(bLabel) ? '이에요' : '예요'}. 이름은
            글자 수가 적어 절반 눈금으로 그렸어요. 오른쪽 숫자(위 사주·아래 이름)는 실제 비율이에요.
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ================================================================== */
/* 여덟 기둥 교차 신호 브라우저                                            */
/* ================================================================== */

export function CrossSignalBrowser({
  result,
  title,
  lede,
}: {
  result: CoupleCompatibilityV1;
  /**
   * 있으면 칩이 하나라도 있을 때만 Section으로 감싸 그린다 —
   * 내용 없는 제목·리드만 남는 빈 섹션을 만들지 않기 위해서다.
   */
  title?: string;
  lede?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const aName = result.persons.a.displayName;
  const bName = result.persons.b.displayName;

  const stemPairs = result.facts.filter(
    (fact): fact is StemPairFactV1 =>
      fact.kind === 'stem_pair'
      && !(fact.aPosition === 'day' && fact.bPosition === 'day')
      && (fact.relation === 'hap' || fact.relation === 'chung'),
  );
  const branchPairs = result.facts.filter(
    (fact): fact is BranchPairFactV1 =>
      fact.kind === 'branch_pair'
      && !(fact.aPosition === 'day' && fact.bPosition === 'day')
      && !(fact.aPosition === 'year' && fact.bPosition === 'year')
      && fact.relations.length > 0,
  );
  if (stemPairs.length === 0 && branchPairs.length === 0) return null;

  interface Chip {
    id: string;
    label: string;
    tone: 'help' | 'pace';
    gloss: string;
    detail: string;
  }
  const seatOf = (aPos: string, bPos: string) =>
    `${PILLAR_KO[aPos]?.[0] ?? aPos}↔${PILLAR_KO[bPos]?.[0] ?? bPos}`;
  const chips: Chip[] = [];
  for (const fact of stemPairs) {
    const tone = fact.relation === 'hap' ? 'help' : 'pace';
    const word = fact.relation === 'hap' ? '합' : '충';
    chips.push({
      id: fact.id,
      label: `${fact.a.hangul}·${fact.b.hangul} ${word} ${seatOf(fact.aPosition, fact.bPosition)}`,
      tone,
      gloss: RELATION_GLOSS[fact.relation === 'hap' ? 'hap' : 'stemChung'],
      detail: `${aName}님의 ${PILLAR_KO[fact.aPosition]} 천간 ${gwaWa(`${fact.a.hangul}(${fact.a.hanja})`)} ${bName}님의 ${PILLAR_KO[fact.bPosition]} 천간 ${fact.b.hangul}(${fact.b.hanja})${hasJongseong(fact.b.hangul) ? '이' : '가'} ${word}을 이뤄요.`,
    });
  }
  for (const fact of branchPairs) {
    for (const relation of fact.relations) {
      const meta = BRANCH_RELATION_CHIP[relation];
      if (!meta) continue;
      chips.push({
        id: `${fact.id}.${relation}`,
        label: `${fact.a.hangul}·${fact.b.hangul} ${meta.label} ${seatOf(fact.aPosition, fact.bPosition)}`,
        tone: meta.tone,
        gloss: RELATION_GLOSS[relation] ?? '',
        detail: `${aName}님의 ${PILLAR_KO[fact.aPosition]} 지지 ${gwaWa(`${fact.a.hangul}(${fact.a.hanja})`)} ${bName}님의 ${PILLAR_KO[fact.bPosition]} 지지 ${fact.b.hangul}(${fact.b.hanja}) 사이의 신호예요.`,
      });
    }
  }

  const open = chips.find(chip => chip.id === selected) ?? null;

  const card = (
    <div className="v3-card">
      <p className="v3-kicker">여덟 기둥 교차 신호</p>
      <p className="v3-hint" style={{ margin: '0 0 0.6rem' }}>
        일지·띠 외의 기둥끼리 오가는 합·충 신호예요. 점수에는 넣지 않고 참고로만
        보여드려요. (일↔월은 내 일주와 상대 월주 사이라는 뜻이에요.)
      </p>
      <div className="v3-signal-pills">
        {chips.map(chip => (
          <button
            key={chip.id}
            type="button"
            className={`v3-signal-pill v3-signal-pill--${chip.tone === 'help' ? 'help' : 'pace'} v3-signal-pill--mid`}
            aria-expanded={selected === chip.id}
            onClick={() => setSelected(selected === chip.id ? null : chip.id)}
          >
            {chip.label}
          </button>
        ))}
      </div>
      {open ? (
        <div className="v3-quote" style={{ marginTop: '0.6rem' }}>
          <p className="v3-quote-main">{open.detail} {open.gloss}</p>
        </div>
      ) : null}
    </div>
  );

  if (title) {
    return (
      <Section title={title} lede={lede}>
        {card}
      </Section>
    );
  }
  return card;
}

/* ================================================================== */
/* 꼬리: 유료 → 보관·PDF·공유 → 고지 (세 화면 대칭 구조)                     */
/* ================================================================== */

export function CompatPremiumSection() {
  return (
    <section className="v3-section">
      <h2 className="v3-section-title">이 인연을 더 깊이 읽고 싶다면</h2>
      <div className="v3-card v3-card--hero">
        <p style={{ margin: 0 }}>
          지금 보신 궁합이 두 분의 방향을 잡아 주었다면, 완성 리포트는 그 결론이
          왜 두 분의 사주와 이름에 닿는지 차분히 짚어 줍니다. 관계의 시기별 흐름,
          함께 조심할 시기와 살릴 시기, 다시 읽을 수 있는 PDF까지 한 번에
          정리됩니다.
        </p>
        <Link to="/account?intent=premium" className="v3-button" style={{ marginTop: '0.9rem' }}>
          두 사람의 해석 완성하기
        </Link>
        <p className="v3-hint" style={{ margin: '0.55rem 0 0' }}>
          결제 전에 계정을 확인해요. 계정이 준비되기 전에는 이메일로 받는 영수증만으로도
          진행할 수 있어요.
        </p>
      </div>
    </section>
  );
}

/**
 * 보관 별표 토글 — 작명 후보 카드와 같은 패턴. 요약 카드 우상단에 붙는다.
 */
export function SaveCompatStar({
  slotA,
  slotB,
  result,
  selection = { category: 'unspecified' },
}: {
  slotA: CompatSlot;
  slotB: CompatSlot;
  result: CoupleCompatibilityV1;
  selection?: CompatRelationshipSelection;
}) {
  const [saved, setSaved] = useState(() => isCompatSaved(slotA, slotB));
  const summary = result.sections.integrated.summary;

  function toggle() {
    if (saved) {
      const key = compatPairKey(slotA, slotB);
      const entry = listSavedCompats().find(
        item => compatPairKey(item.a, item.b) === key,
      );
      if (entry) removeSavedCompat(entry.id);
      setSaved(false);
      return;
    }
    saveCompat(
      slotA,
      slotB,
      summary.availability.status === 'unavailable' ? null : summary.score,
      summary.availability.status === 'unavailable' ? null : GRADE_KO[summary.grade],
      selection,
    );
    setSaved(true);
  }

  return (
    <button
      type="button"
      className={`v3-star-button${saved ? ' v3-star-button--on' : ''}`}
      aria-pressed={saved}
      aria-label={saved ? '담아 둔 궁합에서 빼기' : '이 궁합 담아두기'}
      title={saved ? '담아 두었어요' : '이 궁합 담아두기'}
      onClick={toggle}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.4l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.8l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8Z"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * 통합 보고서 화면과 같은 구성의 꼬리: 저장 안내 카드(PDF·공유·처음으로) + 고지.
 * 보관 저장은 요약 카드의 별표(SaveCompatStar)가 담당한다.
 */
export function CompatReportTail() {
  return (
    <>
      <div className="v3-card v3-report-tail" style={{ marginTop: 'var(--space-lg)' }}>
        <p style={{ margin: '0 0 0.7rem', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          읽은 결과는 저장하고, 다시 열어 볼 수 있게 남겨두세요.
        </p>
        <ReportActions />
      </div>
      <p className="v3-hint" style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
        궁합은 두 사람 기운의 경향성을 읽는 전통적 참고 자료일 뿐, 관계의 성패를
        결정하지 않아요. 어떤 조합이든 이해와 노력이 가장 큰 변수예요. 계산은 이
        기기 안에서 이루어지고, 어디에도 전송되지 않아요.
      </p>
    </>
  );
}
