import { type CSSProperties, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listFavorites, removeFavorite, type FavoriteName } from '../model/favorites';
import {
  listPeople,
  personBirthLabel,
  personContentKey,
  personLabel,
  personName,
  removePerson,
  type StoredPerson,
} from '../model/people';
import {
  clearCompatSlot,
  loadCompatSlot,
  RELATIONSHIP_KO,
  saveCompatRelationship,
  saveCompatSlot,
} from '../model/compat';
import {
  compatPairName,
  compatSlotLabel,
  listSavedCompats,
  removeSavedCompat,
  type SavedCompat,
} from '../model/saved-compat';
import {
  fullHangulName,
  fullHanjaName,
  loadOriginalProfile,
  setCandidateOverride,
  type V3Profile,
} from '../model/profile';
import { clearDeliveryCache } from '../engine/client';
import { Section } from '../ui/primitives';

/**
 * 담아 둔 이름 카드 (사람·작명 후보 공통). 모두 생년월일시분과 한자를 보이고,
 * 버튼은 통합 보기 · 궁합 보기 · 지우기 셋을 한 줄에 둔다.
 */
function KeptNameCard({
  hangul,
  hanja,
  labelBadge,
  birth,
  meaning,
  onIntegrated,
  onCompat,
  onRemove,
}: {
  hangul: string;
  hanja: string | null;
  labelBadge: string | null;
  birth: string;
  meaning: string | null;
  onIntegrated: () => void;
  onCompat: () => void;
  onRemove: () => void;
}) {
  // 좁은 카드에서도 3개가 한 줄에 들어가도록 여백을 줄이고 줄바꿈을 막는다.
  const compact: CSSProperties = { padding: '0.55rem 0.4rem', whiteSpace: 'nowrap' };
  return (
    <div className="v3-card v3-candidate-card">
      <div className="v3-candidate-head">
        <div>
          <strong className="v3-candidate-name">{hangul}</strong>
          {hanja ? (
            <span className="v3-title-hanja" style={{ marginLeft: '0.35rem' }}>{hanja}</span>
          ) : null}
        </div>
        {labelBadge ? <span className="v3-badge">{labelBadge}</span> : null}
      </div>
      <p className="v3-hint" style={{ margin: '0.4rem 0 0' }}>{birth}</p>
      {meaning ? <p style={{ margin: '0.3rem 0 0' }}>{meaning}</p> : null}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          marginTop: 'auto',
          paddingTop: '0.7rem',
        }}
      >
        <button type="button" className="v3-button v3-button--ghost" style={{ ...compact, flex: 1 }} onClick={onIntegrated}>
          통합 보기
        </button>
        <button type="button" className="v3-button v3-button--ghost" style={{ ...compact, flex: 1 }} onClick={onCompat}>
          궁합 보기
        </button>
        <button type="button" className="v3-button v3-button--ghost" style={compact} onClick={onRemove}>
          지우기
        </button>
      </div>
    </div>
  );
}

export default function FavoritesScreen() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FavoriteName[]>(listFavorites);
  const [people, setPeople] = useState<StoredPerson[]>(listPeople);
  const [savedCompats, setSavedCompats] = useState<SavedCompat[]>(listSavedCompats);

  const original = loadOriginalProfile();

  function openFavorite(entry: FavoriteName) {
    if (!original) {
      navigate('/');
      return;
    }
    const override: V3Profile = {
      ...original,
      surname: entry.surname,
      givenName: entry.givenName,
      pureHangul: false,
    };
    setCandidateOverride(override);
    clearDeliveryCache();
    navigate('/reports/integrated');
  }

  // 담아 둔 사람을 통합 보고서 주인공으로 삼는다 (원래 입력은 그대로 두는 임시 보기).
  function openPersonIntegrated(person: StoredPerson) {
    setCandidateOverride(person.profile);
    clearDeliveryCache();
    navigate('/reports/integrated');
  }

  function openCompatibilityProfile(profile: V3Profile, label?: string) {
    // 이전 짝에서 고른 관계 라벨(예: 부부)이 새로운 짝에 소리 없이 적용되지 않게
    // 관계 선택을 초기화한다. 첫 번째 자리는 보통 '나'라 그대로 둔다.
    saveCompatRelationship({ category: 'unspecified' });
    // 고른 이름이 이미 첫 번째 자리에 있으면 같은 사람 궁합이 되므로 비워 준다.
    const slotA = loadCompatSlot('a');
    if (slotA && personContentKey(slotA.profile) === personContentKey(profile)) {
      clearCompatSlot('a');
    }
    saveCompatSlot('b', { profile, label });
    navigate('/compatibility');
  }

  // 작명 후보 이름은 생일이 없으니 처음 입력한 출생 정보를 얹어 궁합 상대로 만든다.
  function openFavoriteCompatibility(entry: FavoriteName) {
    if (!original) {
      navigate('/');
      return;
    }
    openCompatibilityProfile({
      ...original,
      surname: entry.surname,
      givenName: entry.givenName,
      pureHangul: false,
    });
  }

  function openSavedCompat(entry: SavedCompat) {
    saveCompatSlot('a', entry.a);
    saveCompatSlot('b', entry.b);
    saveCompatRelationship(entry.relationship ?? { category: 'unspecified' });
    navigate('/compatibility');
  }

  return (
    <main className="v3-page">
      <div className="v3-page-head">
        <p className="v3-kicker">보관함</p>
        <h1 className="v3-page-title">마음에 담아 둔 이름</h1>
        <p className="v3-page-lede">
          작명에서 별표로 담은 이름, 통합·궁합에서 담아 둔 이름과 궁합 결과예요.
          이 기기에만 보관돼요.
        </p>
      </div>

      <Section
        title="담아 둔 이름"
        lede="생일까지 담아 둔 이름은 통합·궁합에서 바로 불러오고, 작명에서 담은 이름은 처음 입력한 출생 정보로 다시 읽어볼 수 있어요."
      >
        {people.length === 0 && entries.length === 0 ? (
          <div className="v3-card">
            <p style={{ margin: 0 }}>
              아직 담아 둔 이름이 없어요. 통합·궁합에서 이름을 입력할 때 '담아 두기'를
              켜거나, 작명 후보에서 별표를 누르면 여기에 모여요.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
              <Link to="/compatibility" className="v3-button">궁합 보러 가기</Link>
              <Link to="/naming/candidates" className="v3-button v3-button--ghost">이름 후보 보러 가기</Link>
            </div>
          </div>
        ) : (
          <div className="v3-grid-2">
            {/* 생일까지 담아 둔 이름 — 통합·궁합에서 바로 쓴다. */}
            {people.map(person => (
              <KeptNameCard
                key={person.id}
                hangul={personName(person)}
                hanja={fullHanjaName(person.profile)}
                labelBadge={personLabel(person)}
                birth={personBirthLabel(person.profile)}
                meaning={null}
                onIntegrated={() => openPersonIntegrated(person)}
                onCompat={() => openCompatibilityProfile(person.profile, person.label)}
                onRemove={() => {
                  removePerson(person.id);
                  setPeople(listPeople());
                }}
              />
            ))}
            {/* 작명 후보에서 별표로 담은 이름 — 생일이 없어 처음 입력한 출생 정보로 읽는다. */}
            {entries.map(entry => (
              <KeptNameCard
                key={entry.id}
                hangul={entry.fullHangul}
                hanja={entry.fullHanja}
                labelBadge="작명"
                birth={original ? personBirthLabel(original) : '처음 입력한 출생 정보로 읽어요'}
                meaning={
                  entry.givenName.some(c => c.meaning)
                    ? entry.givenName
                        .map(c => c.meaning?.split(',')[0].trim())
                        .filter(Boolean)
                        .join(' · ')
                    : null
                }
                onIntegrated={() => openFavorite(entry)}
                onCompat={() => openFavoriteCompatibility(entry)}
                onRemove={() => {
                  removeFavorite(entry.id);
                  setEntries(listFavorites());
                }}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="담아 둔 궁합"
        lede="다시 열어 보고 싶은 두 사람의 궁합이에요. 열면 그때그때 새로 계산해 다시 읽어드려요."
      >
        {savedCompats.length === 0 ? (
          <div className="v3-card">
            <p style={{ margin: 0 }}>
              아직 담아 둔 궁합이 없어요. 궁합 보고서 아래의 「이 궁합 담아두기」를
              누르면 여기에 모여요.
            </p>
            <Link to="/compatibility" className="v3-button" style={{ marginTop: '0.8rem' }}>
              궁합 보러 가기
            </Link>
          </div>
        ) : (
          <div className="v3-grid-2">
            {savedCompats.map(entry => (
              <div key={entry.id} className="v3-card v3-candidate-card">
                <div className="v3-candidate-head">
                  <strong
                    className="v3-candidate-name"
                    title={compatPairName(entry)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}
                  >
                    <span>{fullHangulName(entry.a.profile)}</span>
                    {compatSlotLabel(entry.a) ? (
                      <span className="v3-badge">{compatSlotLabel(entry.a)}</span>
                    ) : null}
                    <span aria-hidden="true">·</span>
                    <span>{fullHangulName(entry.b.profile)}</span>
                    {compatSlotLabel(entry.b) ? (
                      <span className="v3-badge">{compatSlotLabel(entry.b)}</span>
                    ) : null}
                  </strong>
                  <span style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {entry.relationship
                    && (entry.relationship.label || entry.relationship.category !== 'unspecified') ? (
                      <span className="v3-badge v3-badge--accent">
                        {entry.relationship.label ?? RELATIONSHIP_KO[entry.relationship.category]}
                      </span>
                    ) : null}
                    {entry.score !== null ? (
                      <span className="v3-badge">
                        {entry.score}점{entry.gradeLabel ? ` · ${entry.gradeLabel}` : ''}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '0.7rem' }}>
                  <button
                    type="button"
                    className="v3-button v3-button--ghost"
                    style={{ flex: 1 }}
                    onClick={() => openSavedCompat(entry)}
                  >
                    이 궁합 다시 보기
                  </button>
                  <button
                    type="button"
                    className="v3-button v3-button--ghost"
                    onClick={() => {
                      removeSavedCompat(entry.id);
                      setSavedCompats(listSavedCompats());
                    }}
                  >
                    지우기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </main>
  );
}
