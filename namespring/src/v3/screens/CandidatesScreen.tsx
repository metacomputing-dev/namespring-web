import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CandidateSearchItemV1, CandidateSearchResponseV1 } from '@spring/experience/types';
import { getEngine, clearDeliveryCache } from '../engine/client';
import { loadProfile, saveProfile, type V3Profile } from '../model/profile';
import { ELEMENT_KO } from '../model/facts';
import { Loading } from '../ui/primitives';

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; response: CandidateSearchResponseV1 }
  | { status: 'error' };

function firstMeaning(meaning: string | undefined): string | null {
  if (!meaning) return null;
  return meaning.split(',')[0].trim();
}

function CandidateCard({
  item,
  onOpen,
}: {
  item: CandidateSearchItemV1;
  onOpen: (item: CandidateSearchItemV1) => void;
}) {
  const meanings = item.name.givenCharacters
    .map(character => firstMeaning(character.meaning))
    .filter((value): value is string => Boolean(value));
  const elements = item.name.givenCharacters
    .map(character => (character.element ? ELEMENT_KO[character.element.toLowerCase()] : null))
    .filter(Boolean);
  return (
    <div className="v3-card v3-candidate-card">
      <div className="v3-candidate-head">
        <div>
          <strong className="v3-candidate-name">{item.name.fullHangul}</strong>
          <span className="v3-title-hanja" style={{ marginLeft: '0.35rem' }}>
            {item.name.fullHanja}
          </span>
        </div>
        <span className="v3-badge">{item.score.final.toFixed(1)}점</span>
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
      <button
        type="button"
        className="v3-button v3-button--ghost v3-button--wide"
        style={{ marginTop: '0.7rem' }}
        onClick={() => onOpen(item)}
      >
        이 이름으로 함께 읽어 보기
      </button>
    </div>
  );
}

export default function CandidatesScreen() {
  const navigate = useNavigate();
  const profile = useMemo(loadProfile, []);
  const [givenLength, setGivenLength] = useState<1 | 2>(2);
  const [state, setState] = useState<SearchState>({ status: 'idle' });

  useEffect(() => {
    if (!profile) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    const engine = getEngine();
    engine
      .getCandidateSearch({
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
        mode: 'recommend',
      })
      .then(response => {
        if (!cancelled) setState({ status: 'ready', response });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [profile, givenLength, navigate]);

  if (!profile) return null;

  function openCandidate(item: CandidateSearchItemV1) {
    // 후보 이름으로 프로필을 통째로 바꿔 통합 보고서까지 같은 이름으로 읽히게 한다.
    const next: V3Profile = {
      ...profile!,
      surname: item.name.givenCharacters.length > 0
        ? profile!.surname
        : profile!.surname,
      givenName: item.name.givenCharacters.map(character => ({
        hangul: character.hangul,
        hanja: character.hanja || undefined,
        meaning: character.meaning,
      })),
      pureHangul: false,
    };
    saveProfile(next);
    clearDeliveryCache();
    navigate('/reports/integrated');
  }

  const surnameText = profile.surname.map(c => c.hangul).join('');

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

      <div className="v3-segment" role="group" aria-label="이름 글자 수">
        <button type="button" aria-pressed={givenLength === 2} onClick={() => setGivenLength(2)}>
          두 글자 이름
        </button>
        <button type="button" aria-pressed={givenLength === 1} onClick={() => setGivenLength(1)}>
          한 글자 이름
        </button>
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
            <p className="v3-hint" style={{ margin: '0 0 0.8rem' }}>
              {state.response.pagination.returnedCount}개의 이름을 골랐어요.
            </p>
            <div className="v3-grid-2">
              {state.response.items.map(item => (
                <CandidateCard key={item.candidateId} item={item} onOpen={openCandidate} />
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
