import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listFavorites, removeFavorite, type FavoriteName } from '../model/favorites';
import {
  loadOriginalProfile,
  setCandidateOverride,
  type V3Profile,
} from '../model/profile';
import { clearDeliveryCache } from '../engine/client';

export default function FavoritesScreen() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<FavoriteName[]>(listFavorites);

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

  return (
    <main className="v3-page">
      <div className="v3-page-head">
        <p className="v3-kicker">보관함</p>
        <h1 className="v3-page-title">마음에 담아 둔 이름</h1>
        <p className="v3-page-lede">
          작명에서 별표를 눌러 저장한 이름들이에요. 이 기기에만 보관돼요.
        </p>
      </div>

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
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
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
    </main>
  );
}
