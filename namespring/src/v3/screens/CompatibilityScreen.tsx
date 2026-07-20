import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CompatRelationshipV1 } from '@spring/report/compatibility/index';
import {
  clearCompatSlot,
  loadCompatRelationship,
  loadCompatSlot,
  RELATIONSHIP_KO,
  saveCompatRelationship,
  saveCompatSlot,
  type CompatRelationshipSelection,
  type CompatSlot,
  type CompatSlotKey,
} from '../model/compat';
import { listPeople, personBirthLabel, personName, savePerson } from '../model/people';
import { loadOriginalProfile, fullHangulName, type V3Profile } from '../model/profile';
import {
  guessRelationshipCategory,
  searchRelationshipPresets,
  type RelationshipPreset,
} from '../model/relationship-catalog';
import PersonForm from '../ui/PersonForm';
import { Loading, Section } from '../ui/primitives';
import {
  CompatPremiumSection,
  CompatReportTail,
  ContextCard,
  ElementPairCompareSection,
  GRADE_KO,
  PersonEchoCard,
  SaveCompatStar,
  SummaryCard,
  useCompatibilityResult,
} from './compat/shared';

/** 관계 카테고리 선택지 (표시 순서 고정). */
const RELATIONSHIP_OPTIONS: readonly CompatRelationshipV1[] = [
  'romance',
  'friendship',
  'family',
  'partnership',
  'unspecified',
];

/* ================================================================== */
/* 관계 고르기: 검색 콤보박스 + 직접 입력 + 카테고리 빠른 선택               */
/* ================================================================== */

function RelationshipPicker({
  selection,
  onChange,
}: {
  selection: CompatRelationshipSelection;
  onChange: (next: CompatRelationshipSelection) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => searchRelationshipPresets(query), [query]);
  const trimmed = query.trim();

  function pickPreset(preset: RelationshipPreset) {
    onChange({ category: preset.category, label: preset.label, tone: preset.tone });
    setQuery('');
    setOpen(false);
  }

  function pickCustom() {
    if (!trimmed) return;
    onChange({ category: guessRelationshipCategory(trimmed), label: trimmed });
    setQuery('');
    setOpen(false);
  }

  // 상세 관계가 정해져 있으면 칩으로 보여주고, 바꾸기로 되돌린다.
  if (selection.label) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="v3-badge v3-badge--accent">{selection.label}</span>
          {selection.category !== 'unspecified' ? (
            <span className="v3-hint">{RELATIONSHIP_KO[selection.category]}의 언어로 읽어요</span>
          ) : null}
          <button
            type="button"
            className="v3-button v3-button--ghost"
            onClick={() => onChange({ category: 'unspecified' })}
          >
            바꾸기
          </button>
        </div>
        {selection.category === 'unspecified' ? (
          <div style={{ marginTop: '0.55rem' }}>
            <p className="v3-hint" style={{ margin: '0 0 0.35rem' }}>
              이 관계를 어느 갈래로 읽을지 골라 주세요.
            </p>
            <div
              className="v3-segment"
              role="group"
              aria-label="직접 입력한 관계의 갈래"
              style={{ flexWrap: 'wrap' }}
            >
              {RELATIONSHIP_OPTIONS.map(value => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selection.category === value}
                  onClick={() => onChange({ ...selection, category: value })}
                >
                  {RELATIONSHIP_KO[value]}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div
        className="v3-combo"
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <input
          className="v3-input"
          role="combobox"
          aria-expanded={open}
          aria-controls="v3-relationship-combo-list"
          aria-autocomplete="list"
          aria-label="두 사람의 관계 검색"
          placeholder="관계를 찾아보거나 그대로 적어 주세요 (예: 엄마와 딸)"
          value={query}
          maxLength={16}
          onFocus={() => setOpen(true)}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') setOpen(false);
            if (event.key === 'Enter') {
              event.preventDefault();
              // 빈 입력에서의 Enter(키보드 닫기 등)가 첫 프리셋을 멋대로 고르지 않게 한다.
              if (!trimmed) return;
              if (matches.length > 0) pickPreset(matches[0]);
              else pickCustom();
            }
          }}
        />
        {open ? (
          <div
            className="v3-combo-list"
            id="v3-relationship-combo-list"
            role="listbox"
            aria-label="관계 선택지"
          >
            {matches.map(preset => (
              <button
                key={preset.label}
                type="button"
                role="option"
                aria-selected={false}
                className="v3-hanja-option"
                onMouseDown={event => event.preventDefault()}
                onClick={() => pickPreset(preset)}
              >
                <span className="v3-hanja-meaning">{preset.label}</span>
                <span className="v3-badge">{RELATIONSHIP_KO[preset.category]}</span>
              </button>
            ))}
            {matches.length === 0 && trimmed ? (
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="v3-hanja-option"
                onMouseDown={event => event.preventDefault()}
                onClick={pickCustom}
              >
                <span className="v3-hanja-meaning">{`'${trimmed}' 그대로 쓰기`}</span>
                <span className="v3-badge">직접 입력</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div style={{ marginTop: '0.55rem' }}>
        <div
          className="v3-segment"
          role="group"
          aria-label="두 사람의 관계"
          style={{ flexWrap: 'wrap' }}
        >
          {RELATIONSHIP_OPTIONS.map(value => (
            <button
              key={value}
              type="button"
              aria-pressed={selection.category === value}
              onClick={() => onChange({ category: value })}
            >
              {RELATIONSHIP_KO[value]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 사람 선택 슬롯                                                        */
/* ================================================================== */

type SlotMode = 'closed' | 'people' | 'form';

function SlotChosenCard({
  slot,
  title,
  onClear,
}: {
  slot: CompatSlot;
  title: string;
  onClear: () => void;
}) {
  const name = fullHangulName(slot.profile);
  const label = slot.label?.trim();
  return (
    <div className="v3-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <p className="v3-kicker">{title}</p>
      <p className="v3-core-value" style={{ marginBottom: '0.2rem' }}>
        {name}
        {label && label !== name ? (
          <span className="v3-badge" style={{ marginLeft: '0.45rem' }}>{label}</span>
        ) : null}
      </p>
      <p className="v3-hint" style={{ margin: '0 0 0.7rem' }}>{personBirthLabel(slot.profile)}</p>
      <div style={{ marginTop: 'auto', paddingTop: '0.7rem' }}>
        <button
          type="button"
          className="v3-button v3-button--ghost v3-button--wide"
          onClick={onClear}
        >
          다른 사람으로 바꾸기
        </button>
      </div>
    </div>
  );
}

function SlotPicker({
  slotKey,
  title,
  hint,
  onChosen,
}: {
  slotKey: CompatSlotKey;
  title: string;
  hint: string;
  onChosen: (slot: CompatSlot) => void;
}) {
  const [mode, setMode] = useState<SlotMode>('closed');
  const [saveToPeople, setSaveToPeople] = useState(true);
  const [label, setLabel] = useState('');
  const people = useMemo(listPeople, [mode]);
  const myProfile = useMemo(loadOriginalProfile, []);

  function choose(profile: V3Profile, chosenLabel?: string) {
    const slot: CompatSlot = { profile, label: chosenLabel };
    saveCompatSlot(slotKey, slot);
    onChosen(slot);
  }

  return (
    <div className="v3-card">
      <p className="v3-kicker">{title}</p>
      <p className="v3-hint" style={{ margin: '0 0 0.7rem' }}>{hint}</p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {myProfile ? (
          <button
            type="button"
            className="v3-button v3-button--ghost"
            onClick={() => choose(myProfile)}
          >
            내 정보 불러오기 ({fullHangulName(myProfile)})
          </button>
        ) : null}
        <button
          type="button"
          className="v3-button v3-button--ghost"
          aria-expanded={mode === 'people'}
          onClick={() => setMode(mode === 'people' ? 'closed' : 'people')}
        >
          담아 둔 이름에서 고르기
        </button>
        <button
          type="button"
          className="v3-button v3-button--ghost"
          aria-expanded={mode === 'form'}
          onClick={() => setMode(mode === 'form' ? 'closed' : 'form')}
        >
          직접 입력하기
        </button>
      </div>

      {mode === 'people' ? (
        people.length === 0 ? (
          <p className="v3-hint" style={{ marginTop: '0.7rem' }}>
            담아 둔 이름이 아직 없어요. 직접 입력하면서 담아 두면 다음에 바로 불러올 수 있어요.
          </p>
        ) : (
          <div style={{ marginTop: '0.7rem', display: 'grid', gap: '0.45rem' }}>
            {people.map(person => (
              <button
                key={person.id}
                type="button"
                className="v3-hanja-option"
                onClick={() => choose(person.profile, person.label)}
              >
                <span className="v3-hanja-info">
                  <span className="v3-hanja-meaning">{personName(person)}</span>
                  <span className="v3-hint">{personBirthLabel(person.profile)}</span>
                </span>
              </button>
            ))}
          </div>
        )
      ) : null}

      {mode === 'form' ? (
        <div style={{ marginTop: '0.8rem' }}>
          <div className="v3-field" style={{ marginBottom: '0.7rem' }}>
            <label className="v3-label">호칭 (선택)</label>
            <input
              className="v3-input"
              placeholder="예: 남편, 첫째, 어머니"
              value={label}
              onChange={event => setLabel(event.target.value)}
              maxLength={12}
            />
          </div>
          <PersonForm
            submitLabel="이 사람으로 정하기"
            onSubmit={profile => {
              if (saveToPeople) savePerson(profile, label || undefined);
              choose(profile, label || undefined);
            }}
          />
          <label className="v3-check" style={{ marginTop: '0.6rem' }}>
            <input
              type="checkbox"
              checked={saveToPeople}
              onChange={event => setSaveToPeople(event.target.checked)}
            />
            이 이름을 이 기기에 담아 두기
          </label>
        </div>
      ) : null}
    </div>
  );
}

/* ================================================================== */
/* 상세 페이지로 가는 카드                                                */
/* ================================================================== */

function DetailLinkCard({
  kicker,
  headline,
  score,
  gradeLabel,
  to,
  buttonLabel,
}: {
  kicker: string;
  headline: string;
  score: number | null;
  gradeLabel: string | null;
  to: string;
  buttonLabel: string;
}) {
  return (
    <div className="v3-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <p className="v3-kicker">{kicker}</p>
      {score !== null ? (
        <p className="v3-core-value" style={{ marginBottom: '0.25rem' }}>
          {score}
          <span className="v3-hint" style={{ marginLeft: '0.25rem' }}>/ 100</span>
          {gradeLabel ? (
            <span className="v3-badge" style={{ marginLeft: '0.45rem' }}>{gradeLabel}</span>
          ) : null}
        </p>
      ) : null}
      <p style={{ margin: 0 }}>{headline}</p>
      <div style={{ marginTop: 'auto', paddingTop: '0.9rem' }}>
        <Link to={to} className="v3-button v3-button--ghost v3-button--wide">
          {buttonLabel}
        </Link>
      </div>
    </div>
  );
}

/* ================================================================== */
/* 화면: 통합 궁합                                                        */
/* ================================================================== */

export default function CompatibilityScreen() {
  const [slotA, setSlotA] = useState<CompatSlot | null>(() => loadCompatSlot('a'));
  const [slotB, setSlotB] = useState<CompatSlot | null>(() => loadCompatSlot('b'));
  const [selection, setSelection] = useState<CompatRelationshipSelection>(loadCompatRelationship);
  const [editingSetup, setEditingSetup] = useState(false);
  const state = useCompatibilityResult(slotA, slotB, selection);
  // 선택이 끝나 결과가 보이면 선택 구역을 접는다 — 바꾸기를 눌러야 다시 펼쳐진다.
  const setupCollapsed = state.status === 'ready' && !editingSetup && !!slotA && !!slotB;

  function clearSlot(key: CompatSlotKey) {
    clearCompatSlot(key);
    if (key === 'a') setSlotA(null);
    else setSlotB(null);
  }

  function chooseRelationship(next: CompatRelationshipSelection) {
    saveCompatRelationship(next);
    setSelection(next);
  }

  const result = state.status === 'ready' ? state.result : null;
  const nameSummary = result?.sections.name.summary ?? null;
  const sajuSummary = result?.sections.saju.summary ?? null;

  return (
    <main className="v3-page">
      <div className="v3-page-head">
        <p className="v3-kicker">통합 궁합</p>
        <h1 className="v3-page-title">
          {result
            ? `${result.persons.a.displayName} · ${result.persons.b.displayName}`
            : '두 사람의 인연 읽기'}
        </h1>
        <p className="v3-page-lede">
          두 사람 각자의 사주와 이름을 먼저 온전히 계산한 뒤, 그 결과를 짝지어
          명리와 성명학의 눈으로 읽어요. 어떤 성별의 조합이든 같은 잣대로 살펴요.
          모든 계산은 이 기기 안에서 끝나요.
        </p>
      </div>

      {setupCollapsed ? (
        <div
          className="v3-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.7rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <p className="v3-kicker" style={{ marginBottom: '0.15rem' }}>누구와 누구의 궁합인가요?</p>
            <p style={{ margin: 0 }}>
              <strong>{fullHangulName(slotA!.profile)}</strong>
              {' · '}
              <strong>{fullHangulName(slotB!.profile)}</strong>
              {selection.label ? (
                <span className="v3-badge" style={{ marginLeft: '0.45rem' }}>{selection.label}</span>
              ) : selection.category !== 'unspecified' ? (
                <span className="v3-badge" style={{ marginLeft: '0.45rem' }}>
                  {RELATIONSHIP_KO[selection.category]}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            className="v3-button v3-button--ghost"
            onClick={() => setEditingSetup(true)}
          >
            바꾸기
          </button>
        </div>
      ) : (
        <Section title="누구와 누구의 궁합인가요?">
          <div className="v3-grid-2">
            {slotA ? (
              <SlotChosenCard slot={slotA} title="첫 번째 사람" onClear={() => clearSlot('a')} />
            ) : (
              <SlotPicker
                slotKey="a"
                title="첫 번째 사람"
                hint="보통 나 자신이에요. 내 정보를 불러오거나 직접 입력해 주세요."
                onChosen={setSlotA}
              />
            )}
            {slotB ? (
              <SlotChosenCard slot={slotB} title="두 번째 사람" onClear={() => clearSlot('b')} />
            ) : (
              <SlotPicker
                slotKey="b"
                title="두 번째 사람"
                hint="궁합을 보고 싶은 상대예요. 담아 둔 이름에서 고르거나 직접 입력해 주세요."
                onChosen={setSlotB}
              />
            )}
          </div>
          <div style={{ marginTop: 'var(--space-sm)' }}>
            <p className="v3-label" style={{ marginBottom: '0.45rem' }}>두 사람은 어떤 사이인가요?</p>
            <RelationshipPicker selection={selection} onChange={chooseRelationship} />
            <p className="v3-hint" style={{ margin: '0.45rem 0 0' }}>
              관계에 따라 같은 계산도 다른 언어로 읽어드려요. 아이가 포함된 짝은
              자동으로 우정과 성장의 언어로 읽어요.
            </p>
          </div>
          {state.status === 'same' ? (
            <div className="v3-card v3-card--tinted" style={{ marginTop: 'var(--space-sm)' }}>
              <p style={{ margin: 0 }}>
                두 자리에 같은 사람이 들어 있어요. 서로 다른 두 사람을 골라 주시겠어요?
              </p>
            </div>
          ) : null}
          {state.status === 'ready' ? (
            <div style={{ marginTop: 'var(--space-sm)' }}>
              <button
                type="button"
                className="v3-button v3-button--ghost v3-button--wide"
                onClick={() => setEditingSetup(false)}
              >
                이대로 보기 (선택 접기)
              </button>
            </div>
          ) : null}
        </Section>
      )}

      {state.status === 'loading' ? (
        <Loading message="두 사람의 기운을 각각 계산해 짝지어 읽고 있어요…" />
      ) : null}

      {state.status === 'error' ? (
        <div className="v3-card">
          <p style={{ margin: 0 }}>
            궁합 보고서를 준비하지 못했어요. 두 사람의 입력을 다시 확인해 주시겠어요?
          </p>
        </div>
      ) : null}

      {result && slotA && slotB ? (
        <>
          <Section title="두 사람, 나란히 보기">
            <div className="v3-grid-2">
              <PersonEchoCard
                echo={result.persons.a}
                title="첫 번째 사람"
                framing={result.context.fact.framing}
                slot={slotA}
              />
              <PersonEchoCard
                echo={result.persons.b}
                title="두 번째 사람"
                framing={result.context.fact.framing}
                slot={slotB}
              />
            </div>
            <div style={{ marginTop: 'var(--space-sm)' }}>
              <ContextCard context={result.context} />
            </div>
          </Section>

          <Section
            title="요약"
            lede="사주 궁합, 이름 궁합, 이름이 상대 사주에 주는 기운까지 하나로 모은 결론이에요."
          >
            <SummaryCard
              summary={result.sections.integrated.summary}
              kicker="두 분의 인연"
              headerAction={
                <SaveCompatStar
                  slotA={slotA}
                  slotB={slotB}
                  result={result}
                  selection={selection}
                />
              }
            />
          </Section>

          <ElementPairCompareSection result={result} />

          <Section
            title="더 자세히 읽기"
            lede="축 하나하나의 근거와 해석은 각각의 상세 보고서에 있어요. 전 생애 대운 겹쳐 보기는 사주간 궁합에서 볼 수 있어요."
          >
            <div className="v3-grid-2">
              <DetailLinkCard
                kicker="이름간 궁합"
                headline={nameSummary?.headline ?? '이름 궁합을 계산할 정보가 부족했어요.'}
                score={
                  nameSummary && nameSummary.availability.status !== 'unavailable'
                    ? nameSummary.score
                    : null
                }
                gradeLabel={
                  nameSummary && nameSummary.availability.status !== 'unavailable'
                    ? GRADE_KO[nameSummary.grade]
                    : null
                }
                to="/compatibility/name"
                buttonLabel="이름간 궁합 자세히 보기"
              />
              <DetailLinkCard
                kicker="사주간 궁합"
                headline={sajuSummary?.headline ?? '사주 궁합을 계산할 정보가 부족했어요.'}
                score={
                  sajuSummary && sajuSummary.availability.status !== 'unavailable'
                    ? sajuSummary.score
                    : null
                }
                gradeLabel={
                  sajuSummary && sajuSummary.availability.status !== 'unavailable'
                    ? GRADE_KO[sajuSummary.grade]
                    : null
                }
                to="/compatibility/saju"
                buttonLabel="사주간 궁합 자세히 보기"
              />
            </div>
          </Section>

          <CompatPremiumSection />
          <CompatReportTail />
        </>
      ) : null}
    </main>
  );
}
