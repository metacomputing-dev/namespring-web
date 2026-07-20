import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadOriginalProfile } from '../model/profile';
import ProfileSetupForm from '../ui/ProfileSetupForm';

/**
 * 처음 화면 — 입력 폼 본체는 ProfileSetupForm으로 옮겼고(통합 보고서에서도
 * 같은 폼을 쓴다), 여기는 랜딩 머리와 저장된 보고서 바로가기만 남는다.
 */
export default function HomeScreen() {
  const navigate = useNavigate();
  const saved = useMemo(loadOriginalProfile, []);

  return (
    <main className="v3-page">
      <div className="v3-page-head">
        <p className="v3-kicker">NameSpring</p>
        <h1 className="v3-page-title">이름과 사주를 함께 읽는 시간</h1>
        <p className="v3-page-lede">
          태어난 순간의 기운과 이름에 담긴 뜻·소리를 나란히 살펴봐요. 모든 계산은 이
          기기 안에서 끝나요.
        </p>
      </div>

      {saved ? (
        <section className="v3-card v3-card--tinted" style={{ marginBottom: 'var(--space-md)' }}>
          <p style={{ margin: 0 }}>
            <strong>
              {saved.surname.map(c => c.hangul).join('')}
              {saved.givenName.map(c => c.hangul).join('')}
            </strong>
            님의 보고서가 준비되어 있어요. 입력을 바꾸지 않았다면 바로 이어 볼 수 있어요.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
            <button type="button" className="v3-button" onClick={() => navigate('/reports/integrated')}>
              통합 보고서 이어 보기
            </button>
            <button type="button" className="v3-button v3-button--ghost" onClick={() => navigate('/reports/saju')}>
              사주
            </button>
            <button type="button" className="v3-button v3-button--ghost" onClick={() => navigate('/reports/naming')}>
              이름
            </button>
          </div>
        </section>
      ) : null}

      <ProfileSetupForm onDone={() => navigate('/reports/integrated')} />
    </main>
  );
}
