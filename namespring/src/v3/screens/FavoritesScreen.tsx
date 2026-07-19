import { useState } from 'react';
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
  loadOriginalProfile,
  setCandidateOverride,
  type V3Profile,
} from '../model/profile';
import { clearDeliveryCache } from '../engine/client';
import { Section } from '../ui/primitives';

export default function FavoritesScreen() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FavoriteName[]>(listFavorites);
  const [people, setPeople] = useState<StoredPerson[]>(listPeople);
  const [savedCompats, setSavedCompats] = useState<SavedCompat[]>(listSavedCompats);

  function openFavorite(entry: FavoriteName) {
    const original = loadOriginalProfile();
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

  function openCompatibility(person: StoredPerson) {
    // 이전 짝에서 고른 관계 라벨(예: 부부)이 새로운 짝에 소리 없이 적용되지 않게
    // 관계 선택을 초기화한다. 첫 번째 자리는 보통 '나'라 그대로 둔다.
    saveCompatRelationship({ category: 'unspecified' });
    // 고른 사람이 이미 첫 번째 자리에 있으면 같은 사람 궁합이 되므로 비워 준다.
    const slotA = loadCompatSlot('a');
    if (slotA && personContentKey(slotA.profile) === personContentKey(person.profile)) {
      clearCompatSlot('a');
    }
    saveCompatSlot('b', { profile: person.profile, label: person.label });
    navigate('/compatibility');
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
        <h1 className="v3-page-title">마음에 담아 둔 이름과 사람</h1>
        <p className="v3-page-lede">
          작명에서 별표를 눌러 저장한 이름, 궁합에서 저장한 사람과 궁합 결과예요.
          이 기기에만 보관돼요.
        </p>
      </div>

      <Section title="담아 둔 이름">
        {entries.length === 0 ? (
          <div className="v3-card">
            <p style={{ margin: 0 }}>아직 담아 둔 이름이 없어요.</p>
            <Link to="/naming/candidates" className="v3-button" style={{ marginTop: '0.8rem' }}>
              이름 후보 보러 가기
            </Link>
          </div>
        ) : (
          <div className="v3-grid-2">
            {entries.map(entry => (
              <div key={entry.id} className="v3-card v3-candidate-card">
                <div className="v3-candidate-head">
                  <div>
                    <strong className="v3-candidate-name">{entry.fullHangul}</strong>
                    <span className="v3-title-hanja" style={{ marginLeft: '0.35rem' }}>
                      {entry.fullHanja}
                    </span>
                  </div>
                </div>
                {entry.givenName.some(c => c.meaning) ? (
                  <p style={{ margin: '0.4rem 0 0' }}>
                    {entry.givenName
                      .map(c => c.meaning?.split(',')[0].trim())
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '0.7rem' }}>
                  <button
                    type="button"
                    className="v3-button v3-button--ghost"
                    style={{ flex: 1 }}
                    onClick={() => openFavorite(entry)}
                  >
                    이 이름으로 함께 읽어 보기
                  </button>
                  <button
                    type="button"
                    className="v3-button v3-button--ghost"
                    onClick={() => {
                      removeFavorite(entry.id);
                      setEntries(listFavorites());
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

      <Section
        title="보관해 둔 궁합"
        lede="다시 열어 보고 싶은 두 사람의 짝이에요. 열면 최신 계산으로 다시 읽어드려요."
      >
        {savedCompats.length === 0 ? (
          <div className="v3-card">
            <p style={{ margin: 0 }}>
              아직 보관해 둔 궁합이 없어요. 궁합 보고서 아래의 「이 궁합 보관하기」를
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

      <Section
        title="보관해 둔 사람"
        lede="궁합에서 다시 쓸 수 있게 출생 정보까지 담아 둔 사람들이에요."
      >
        {people.length === 0 ? (
          <div className="v3-card">
            <p style={{ margin: 0 }}>
              아직 보관해 둔 사람이 없어요. 궁합에서 직접 입력할 때 저장해 두면 여기에
              모여요.
            </p>
            <Link to="/compatibility" className="v3-button" style={{ marginTop: '0.8rem' }}>
              궁합 보러 가기
            </Link>
          </div>
        ) : (
          <div className="v3-grid-2">
            {people.map(person => (
              <div key={person.id} className="v3-card v3-candidate-card">
                <div className="v3-candidate-head">
                  <div>
                    <strong className="v3-candidate-name">{personName(person)}</strong>
                    {personLabel(person) ? (
                      <span className="v3-badge" style={{ marginLeft: '0.35rem' }}>
                        {personLabel(person)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="v3-hint" style={{ margin: '0.4rem 0 0' }}>
                  {personBirthLabel(person.profile)}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '0.7rem' }}>
                  <button
                    type="button"
                    className="v3-button v3-button--ghost"
                    style={{ flex: 1 }}
                    onClick={() => openCompatibility(person)}
                  >
                    이 사람과 궁합 보기
                  </button>
                  <button
                    type="button"
                    className="v3-button v3-button--ghost"
                    onClick={() => {
                      removePerson(person.id);
                      setPeople(listPeople());
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
