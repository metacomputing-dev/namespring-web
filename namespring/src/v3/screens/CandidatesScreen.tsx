import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CandidateSearchItemV1 } from '@spring/experience/types';
import { getEngine, clearDeliveryCache } from '../engine/client';
import {
  loadOriginalProfile,
  setCandidateOverride,
  type ProfileNameChar,
  type V3Profile,
} from '../model/profile';
import { favoriteId, listFavorites, toggleFavorite } from '../model/favorites';
import { ELEMENT_KO } from '../model/facts';
import { getHangulInitials, isChoseongQuery, normalizeQuery } from '../model/hangul';
import { Loading } from '../ui/primitives';

/** 한눈에 견줄 수 있는 만큼만. 열이 더 늘면 표가 아니라 목록이 된다. */
const MAX_COMPARE = 3;

/** 엔진이 한 번에 내주는 최대치(MAX_CANDIDATE_SEARCH_PAGE_SIZE_V1). */
const FETCH_PAGE_SIZE = 100;
/** 화면에 한 번에 늘려 그리는 개수. 받아 둔 양과는 별개다. */
const RENDER_STEP = 20;
/** 무한 루프 방지용. maxBrowsableCandidates(500)로도 멈추지만 한 겹 더 둔다. */
const MAX_FETCH_PAGES = 20;

const TENDENCY_KO: Record<string, string> = {
  male: '주로 남자아이',
  female: '주로 여자아이',
  neutral: '두루 쓰임',
};

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; items: CandidateSearchItemV1[] }
  | { status: 'error' };

function firstMeaning(meaning: string | undefined): string | null {
  if (!meaning) return null;
  return meaning.split(',')[0].trim();
}

function candidateChars(item: CandidateSearchItemV1): ProfileNameChar[] {
  return item.name.givenCharacters.map(character => ({
    hangul: character.hangul,
    hanja: character.hanja || undefined,
    meaning: character.meaning,
  }));
}

/** 한글·한자 부분일치로 먼저 찾고, 초성만 입력했을 때에 한해 초성으로도 찾는다. */
function matchesQuery(item: CandidateSearchItemV1, query: string): boolean {
  if (!query) return true;
  const { fullHangul, fullHanja } = item.name;
  const targets = [fullHangul, fullHanja, `${fullHangul}${fullHanja}`].map(normalizeQuery);
  if (targets.some(target => target.includes(query))) return true;
  if (isChoseongQuery(query)) {
    return normalizeQuery(getHangulInitials(fullHangul)).includes(query);
  }
  return false;
}

interface CompareRow {
  id: string;
  label: string;
  help?: string;
  values: (string | null)[];
}

function joinChars(
  item: CandidateSearchItemV1,
  pick: (character: CandidateSearchItemV1['name']['givenCharacters'][number]) => string | null | undefined,
): string | null {
  const parts = item.name.givenCharacters.map(pick).filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** 획수는 글자가 하나라도 비면 합계를 만들지 않는다 — 반쪽 합은 오해를 부른다. */
function strokeSum(item: CandidateSearchItemV1): string | null {
  const strokes = item.name.givenCharacters
    .map(character => character.strokes)
    .filter((value): value is number => typeof value === 'number');
  if (strokes.length !== item.name.givenCharacters.length || strokes.length === 0) return null;
  return `${strokes.reduce((sum, value) => sum + value, 0)}획`;
}

function buildCompareRows(items: CandidateSearchItemV1[]): CompareRow[] {
  const rows: CompareRow[] = [
    { id: 'hanja', label: '한자', values: items.map(item => item.name.fullHanja || null) },
    {
      id: 'meaning',
      label: '글자 뜻',
      values: items.map(item => joinChars(item, character => firstMeaning(character.meaning))),
    },
    {
      id: 'element',
      label: '오행 기운',
      help: '글자마다 붙는 나무·불·흙·쇠·물 기운이에요.',
      values: items.map(item =>
        joinChars(item, character => (character.element ? ELEMENT_KO[character.element.toLowerCase()] : null)),
      ),
    },
    {
      id: 'strokes',
      label: '획수',
      help: '이름 한자의 획수를 더한 값이에요.',
      values: items.map(strokeSum),
    },
    {
      id: 'score',
      label: '계산 점수',
      help: '뜻·소리·획수·사주 어울림을 함께 계산한 값이에요. 항목마다 기준이 달라 서로 더하지는 않았어요.',
      values: items.map(item => `${item.score.final.toFixed(1)}점`),
    },
    {
      id: 'popularity',
      label: '인기 순위',
      help: '출생신고 이름 통계에서의 순위예요. 순위가 없으면 흔치 않은 이름이에요.',
      values: items.map(item => (item.popularity.rank ? `${item.popularity.rank.toLocaleString()}위` : null)),
    },
    {
      id: 'tendency',
      label: '이름 쓰임새',
      values: items.map(item => TENDENCY_KO[item.popularity.tendency] ?? null),
    },
  ];
  // 고른 이름 어디에도 값이 없는 항목은 빈 줄로 남기지 않고 지운다.
  return rows.filter(row => row.values.some(Boolean));
}

function CandidateCard({
  item,
  saved,
  compared,
  compareFull,
  onToggleFavorite,
  onToggleCompare,
  onOpen,
}: {
  item: CandidateSearchItemV1;
  saved: boolean;
  compared: boolean;
  compareFull: boolean;
  onToggleFavorite: (item: CandidateSearchItemV1) => void;
  onToggleCompare: (item: CandidateSearchItemV1) => void;
  onOpen: (item: CandidateSearchItemV1) => void;
}) {
  const meanings = item.name.givenCharacters
    .map(character => firstMeaning(character.meaning))
    .filter((value): value is string => Boolean(value));
  const elements = item.name.givenCharacters
    .map(character => (character.element ? ELEMENT_KO[character.element.toLowerCase()] : null))
    .filter(Boolean);
  return (
    <div className={`v3-card v3-candidate-card${compared ? ' v3-candidate-card--compare' : ''}`}>
      <div className="v3-candidate-head">
        <div>
          <strong className="v3-candidate-name">{item.name.fullHangul}</strong>
          <span className="v3-title-hanja" style={{ marginLeft: '0.35rem' }}>
            {item.name.fullHanja}
          </span>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="v3-badge">{item.score.final.toFixed(1)}점</span>
          <button
            type="button"
            className={`v3-star-button${saved ? ' v3-star-button--on' : ''}`}
            aria-pressed={saved}
            aria-label={saved ? '보관함에서 빼기' : '보관함에 담기'}
            onClick={() => onToggleFavorite(item)}
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
        </div>
      </div>
      {meanings.length > 0 ? (
        <p style={{ margin: '0.4rem 0 0' }}>{meanings.join(' · ')}</p>
      ) : null}
      <p className="v3-hint" style={{ margin: '0.3rem 0 0' }}>
        {[
          elements.length > 0 ? `${elements.join('·')} 기운` : null,
          item.popularity.rank ? `인기 ${item.popularity.rank.toLocaleString()}위` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <div className="v3-candidate-actions">
        <label className="v3-check">
          <input
            type="checkbox"
            checked={compared}
            disabled={!compared && compareFull}
            onChange={() => onToggleCompare(item)}
          />
          비교에 넣기
        </label>
        <button
          type="button"
          className="v3-button v3-button--ghost v3-button--wide"
          onClick={() => onOpen(item)}
        >
          이 이름으로 함께 읽어 보기
        </button>
      </div>
    </div>
  );
}

export default function CandidatesScreen() {
  const navigate = useNavigate();
  const profile = useMemo(loadOriginalProfile, []);
  const [givenLength, setGivenLength] = useState<1 | 2>(2);
  const [showAllGenders, setShowAllGenders] = useState(false);
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    () => new Set(listFavorites().map(entry => entry.id)),
  );
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(RENDER_STEP);
  const [state, setState] = useState<SearchState>({ status: 'idle' });

  useEffect(() => {
    if (!profile) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    // 글자 수를 바꾸면 후보 목록이 통째로 갈리므로 비교 선택도 함께 비운다.
    setCompareIds([]);
    const engine = getEngine();
    const request = {
      birth: {
        year: profile.birth.year,
        month: profile.birth.month,
        day: profile.birth.day,
        hour: profile.birth.hour,
        minute: profile.birth.minute,
        gender: profile.birth.gender,
        calendarType: profile.birth.calendarType,
        isLeapMonth: profile.birth.calendarType === 'lunar' ? profile.birth.isLeapMonth : undefined,
        region: profile.birth.region ?? undefined,
      },
      surname: profile.surname.map(c => (c.hanja ? { hangul: c.hangul, hanja: c.hanja } : { hangul: c.hangul })),
      givenNameLength: givenLength,
      mode: 'recommend' as const,
    };

    // 엔진이 이 세션에 보관하는 후보를 전부 받아 둔다. 비싼 건 첫 장이 만드는
    // 스냅샷뿐이고 이후 장은 같은 queryId로 잘라 오기만 한다(실측 4장 18ms).
    // 검색·필터가 첫 장이 아니라 후보 전체를 대상으로 돌게 하려면 이게 필요하다.
    (async () => {
      try {
        const first = await engine.getCandidateSearch({
          ...request,
          options: { limit: FETCH_PAGE_SIZE, offset: 0 },
        });
        if (cancelled) return;
        const items = [...first.items];
        let hasMore = first.pagination.hasMore === true;
        for (let page = 1; hasMore && page < MAX_FETCH_PAGES; page += 1) {
          if (items.length >= first.query.maxBrowsableCandidates) break;
          const next = await engine.getCandidateSearch(
            { ...request, options: { limit: FETCH_PAGE_SIZE, offset: items.length } },
            { queryId: first.query.queryId },
          );
          if (cancelled) return;
          if (next.items.length === 0) break;
          items.push(...next.items);
          hasMore = next.pagination.hasMore === true;
        }
        setState({ status: 'ready', items });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, givenLength, navigate]);

  // 조건이 바뀌면 위에서부터 다시 읽는 게 자연스럽다.
  useEffect(() => {
    setVisibleCount(RENDER_STEP);
  }, [query, favoritesOnly, showAllGenders, givenLength]);

  if (!profile) return null;

  function openCandidate(item: CandidateSearchItemV1) {
    // 원본 프로필은 그대로 두고, 후보 이름을 "잠깐 읽어 보기"로만 얹는다.
    const override: V3Profile = {
      ...profile!,
      givenName: candidateChars(item),
      pureHangul: false,
    };
    setCandidateOverride(override);
    clearDeliveryCache();
    navigate('/reports/integrated');
  }

  function toggleCandidateFavorite(item: CandidateSearchItemV1) {
    const id = favoriteId(item.name.fullHangul, item.name.fullHanja);
    const nowSaved = toggleFavorite({
      id,
      fullHangul: item.name.fullHangul,
      fullHanja: item.name.fullHanja,
      surname: profile!.surname,
      givenName: candidateChars(item),
    });
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (nowSaved) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleCompare(item: CandidateSearchItemV1) {
    setCompareIds(prev => {
      if (prev.includes(item.candidateId)) return prev.filter(id => id !== item.candidateId);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, item.candidateId];
    });
  }

  const surnameText = profile.surname.map(c => c.hangul).join('');
  const gender = profile.birth.gender;
  const genderNote =
    gender === 'male'
      ? '남자아이에게 주로 쓰이는 이름과 두루 쓰이는 이름을 보여드려요.'
      : gender === 'female'
        ? '여자아이에게 주로 쓰이는 이름과 두루 쓰이는 이름을 보여드려요.'
        : null;

  const allItems = state.status === 'ready' ? state.items : [];
  const normalizedQuery = normalizeQuery(query);
  const visibleItems = allItems.filter(item => {
    const tendency = item.popularity.tendency;
    const genderOk =
      showAllGenders || gender === 'neutral' || tendency === gender || tendency === 'unknown';
    if (!genderOk) return false;
    if (favoritesOnly && !favoriteIds.has(favoriteId(item.name.fullHangul, item.name.fullHanja))) {
      return false;
    }
    return matchesQuery(item, normalizedQuery);
  });
  const filtering = normalizedQuery.length > 0 || favoritesOnly;
  const shownItems = visibleItems.slice(0, visibleCount);
  const restCount = visibleItems.length - shownItems.length;

  // 비교는 명시적으로 고른 것이라, 검색·필터로 목록에서 사라져도 표에는 남긴다.
  const compareItems = compareIds
    .map(id => allItems.find(item => item.candidateId === id))
    .filter((item): item is CandidateSearchItemV1 => Boolean(item));
  const compareRows = compareItems.length >= 2 ? buildCompareRows(compareItems) : [];

  return (
    <main className="v3-page">
      <div className="v3-page-head">
        <p className="v3-kicker">작명</p>
        <h1 className="v3-page-title">{surnameText}씨와 어울리는 새 이름</h1>
        <p className="v3-page-lede">
          같은 출생 정보를 기준으로, 뜻·소리·획수·사주 어울림을 함께 계산해 고른
          이름들이에요. 추천 순서는 계산 결과 그대로예요.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="v3-segment" role="group" aria-label="이름 글자 수">
          <button type="button" aria-pressed={givenLength === 2} onClick={() => setGivenLength(2)}>
            두 글자 이름
          </button>
          <button type="button" aria-pressed={givenLength === 1} onClick={() => setGivenLength(1)}>
            한 글자 이름
          </button>
        </div>
        {gender !== 'neutral' ? (
          <label className="v3-check">
            <input
              type="checkbox"
              checked={showAllGenders}
              onChange={event => setShowAllGenders(event.target.checked)}
            />
            성별 상관없이 모두 보기
          </label>
        ) : null}
      </div>
      {genderNote && !showAllGenders ? (
        <p className="v3-hint" style={{ margin: '0.5rem 0 0' }}>{genderNote}</p>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: '0.8rem',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          marginTop: 'var(--space-2xs)',
        }}
      >
        <div className="v3-field" style={{ flex: '1 1 14rem' }}>
          <label className="v3-label" htmlFor="v3-candidate-search">
            이름 찾기
          </label>
          <input
            id="v3-candidate-search"
            className="v3-input"
            placeholder="이름이나 초성으로 (예: 서준, ㅅㅈ)"
            value={query}
            maxLength={12}
            onChange={event => setQuery(event.target.value)}
          />
        </div>
        <label className="v3-check" style={{ paddingBottom: '0.7rem' }}>
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={event => setFavoritesOnly(event.target.checked)}
          />
          보관함에 담은 이름만
        </label>
      </div>

      <div style={{ marginTop: 'var(--space-md)' }}>
        {state.status === 'loading' || state.status === 'idle' ? (
          <Loading message="어울리는 이름을 고르고 있어요… 잠시만요." />
        ) : state.status === 'error' ? (
          <div className="v3-card">
            <p style={{ margin: 0 }}>
              지금은 이름 후보를 만들지 못했어요. 성씨의 한자를 고른 뒤 다시 시도해
              주시겠어요?
            </p>
            <Link to="/" className="v3-button" style={{ marginTop: '0.8rem' }}>
              입력 화면으로
            </Link>
          </div>
        ) : (
          <>
            <p className="v3-hint" style={{ margin: '0 0 0.8rem' }} role="status" aria-live="polite">
              {visibleItems.length === 0
                ? '지금 조건에 맞는 이름이 없어요.'
                : restCount > 0
                  ? `이름 ${visibleItems.length}개 가운데 ${shownItems.length}개를 보여드리고 있어요.`
                  : `${visibleItems.length}개의 이름을 보여드려요.`}
              {visibleItems.length < allItems.length
                ? ` 전체 ${allItems.length}개 중 ${allItems.length - visibleItems.length}개는 접어 두었어요.`
                : ''}
            </p>
            {visibleItems.length === 0 && filtering ? (
              <button
                type="button"
                className="v3-button v3-button--ghost"
                style={{ marginBottom: '0.8rem' }}
                onClick={() => {
                  setQuery('');
                  setFavoritesOnly(false);
                }}
              >
                찾는 조건 지우기
              </button>
            ) : null}
            <div className="v3-grid-2">
              {shownItems.map(item => (
                <CandidateCard
                  key={item.candidateId}
                  item={item}
                  saved={favoriteIds.has(favoriteId(item.name.fullHangul, item.name.fullHanja))}
                  compared={compareIds.includes(item.candidateId)}
                  compareFull={compareIds.length >= MAX_COMPARE}
                  onToggleFavorite={toggleCandidateFavorite}
                  onToggleCompare={toggleCompare}
                  onOpen={openCandidate}
                />
              ))}
            </div>

            {restCount > 0 ? (
              <button
                type="button"
                className="v3-button v3-button--ghost v3-button--wide"
                style={{ marginTop: 'var(--space-sm)' }}
                onClick={() => setVisibleCount(count => count + RENDER_STEP)}
              >
                이름 {Math.min(restCount, RENDER_STEP)}개 더 보기 (남은 {restCount}개)
              </button>
            ) : null}

            {compareRows.length > 0 ? (
              <section
                className="v3-card"
                style={{ marginTop: 'var(--space-md)' }}
                aria-labelledby="v3-candidate-compare-title"
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: '0.6rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <p className="v3-kicker">비교</p>
                    <h2 className="v3-section-title" id="v3-candidate-compare-title">
                      고른 이름 나란히 보기
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="v3-button v3-button--ghost"
                    onClick={() => setCompareIds([])}
                  >
                    비교 비우기
                  </button>
                </div>
                <p className="v3-hint" id="v3-candidate-compare-help" style={{ marginTop: '0.4rem' }}>
                  좋고 나쁨을 합쳐 매기지 않고, 같은 항목을 그대로 나란히 놓았어요. 화면이 좁으면 표를
                  좌우로 밀어 보실 수 있어요.
                </p>
                <div
                  className="v3-candidate-compare"
                  role="region"
                  aria-labelledby="v3-candidate-compare-title"
                  aria-describedby="v3-candidate-compare-help"
                  tabIndex={0}
                >
                  <table className="v3-table">
                    <caption className="v3-sr-only">고른 이름의 뜻·기운·점수 비교</caption>
                    <thead>
                      <tr>
                        <th scope="col">비교 항목</th>
                        {compareItems.map(item => (
                          <th scope="col" key={item.candidateId}>
                            {item.name.fullHangul}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compareRows.map(row => (
                        <tr key={row.id}>
                          <th scope="row">
                            {row.label}
                            {row.help ? (
                              <span className="v3-hint v3-candidate-compare-help">{row.help}</span>
                            ) : null}
                          </th>
                          {row.values.map((value, index) => (
                            <td key={compareItems[index].candidateId}>{value ?? '자료 없음'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : compareItems.length === 1 ? (
              <p className="v3-hint" style={{ marginTop: 'var(--space-sm)' }}>
                이름을 하나 더 고르시면 나란히 비교해 드릴게요. 최대 {MAX_COMPARE}개까지 됩니다.
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
