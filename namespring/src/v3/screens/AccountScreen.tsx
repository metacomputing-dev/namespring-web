import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchAuthStatus, PROVIDER_LABELS, type AuthStatus } from '../model/session';
import { clearProfile, loadOriginalProfile, fullHangulName } from '../model/profile';
import { listFavorites } from '../model/favorites';
import { listPeople } from '../model/people';
import { compatPairName, listSavedCompats } from '../model/saved-compat';
import { clearCompatRelationship, clearCompatSlot } from '../model/compat';
import { clearDeliveryCache } from '../engine/client';
import { Loading, Section } from '../ui/primitives';

function SignInOptions({ enabledProviders }: { enabledProviders: string[] }) {
  const known = enabledProviders.filter(provider => PROVIDER_LABELS[provider]);
  if (known.length === 0) {
    return (
      <div className="v3-card v3-card--tinted">
        <p style={{ margin: 0 }}>
          로그인은 지금 준비하고 있어요. 카카오·구글·이메일 링크로 이 자리에서 바로
          시작할 수 있게 만드는 중이에요.
        </p>
        <p className="v3-hint" style={{ margin: '0.5rem 0 0' }}>
          로그인 없이도 모든 분석은 이 기기에서 계속 쓸 수 있어요.
        </p>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {known.map(provider => (
        <button key={provider} type="button" className="v3-button v3-button--wide">
          {PROVIDER_LABELS[provider]}
        </button>
      ))}
    </div>
  );
}

export default function AccountScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const premiumIntent = params.get('intent') === 'premium';
  const [status, setStatus] = useState<AuthStatus>({ state: 'loading' });
  const [wipeAsked, setWipeAsked] = useState(false);
  const [wiped, setWiped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAuthStatus().then(result => {
      if (!cancelled) setStatus(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = loadOriginalProfile();
  const favoritesCount = listFavorites().length;
  const peopleCount = listPeople().length;
  const savedCompats = listSavedCompats();

  function wipeDevice() {
    clearProfile();
    clearDeliveryCache();
    clearCompatSlot('a');
    clearCompatSlot('b');
    clearCompatRelationship();
    try {
      localStorage.removeItem('namespring_v3_favorites');
      localStorage.removeItem('namespring_v3_people');
      localStorage.removeItem('namespring_v3_saved_compat');
    } catch {
      /* storage unavailable */
    }
    setWiped(true);
    setWipeAsked(false);
  }

  return (
    <main className="v3-page">
      <div className="v3-page-head">
        <p className="v3-kicker">계정</p>
        <h1 className="v3-page-title">내 계정</h1>
        {premiumIntent ? (
          <p className="v3-page-lede">
            완성 리포트를 나중에 다시 열어 보려면 계정이 있으면 좋아요. 준비되기 전에는
            이메일 영수증만으로도 진행할 수 있어요.
          </p>
        ) : (
          <p className="v3-page-lede">
            로그인 없이도 모든 분석은 이 기기에서 바로 쓸 수 있어요. 계정은 완성
            리포트를 다시 열고, 다른 기기에서 이어 보는 데 쓰여요.
          </p>
        )}
      </div>

      {premiumIntent ? (
        <div className="v3-override-banner" role="status">
          <span>완성 리포트 결제를 이어가려는 중이에요.</span>
          <Link to="/support" className="v3-button v3-button--ghost">
            이메일 영수증으로 계속하기
          </Link>
        </div>
      ) : null}

      <Section title="로그인">
        {status.state === 'loading' ? (
          <Loading message="계정 상태를 확인하고 있어요…" />
        ) : status.state === 'signed_in' ? (
          <div className="v3-card">
            <p style={{ margin: 0 }}>로그인되어 있어요.</p>
            {status.providers.length > 0 ? (
              <p className="v3-hint" style={{ margin: '0.4rem 0 0' }}>
                연결된 로그인: {status.providers.join(', ')}
              </p>
            ) : null}
            {premiumIntent ? (
              <Link to="/support" className="v3-button" style={{ marginTop: '0.8rem' }}>
                결제 이어가기
              </Link>
            ) : null}
          </div>
        ) : status.state === 'signed_out' ? (
          <SignInOptions enabledProviders={status.enabledProviders} />
        ) : (
          <div className="v3-card v3-card--tinted">
            <p style={{ margin: 0 }}>
              지금은 계정 서버에 연결할 수 없어요. 로그인 없이도 분석은 계속 쓸 수
              있고, 연결되면 이 자리에서 바로 시작할 수 있어요.
            </p>
          </div>
        )}
      </Section>

      <Section
        title="이 기기에 저장된 것"
        lede="분석 입력과 보관함은 서버가 아니라 이 기기 안에만 있어요."
      >
        <div className="v3-card">
          <ul className="v3-plain-list">
            <li>
              분석 입력 —{' '}
              {profile ? `${fullHangulName(profile)}님의 이름과 출생 정보` : '저장된 입력이 없어요'}
            </li>
            <li>보관함 — 담아 둔 이름 {favoritesCount}개 · 보관한 사람 {peopleCount}명</li>
            <li>
              보관한 궁합 — {savedCompats.length}건
              {savedCompats.length > 0
                ? ` (${savedCompats
                    .slice(0, 3)
                    .map(entry => compatPairName(entry))
                    .join(', ')}${savedCompats.length > 3 ? ' …' : ''})`
                : ''}
            </li>
          </ul>
          {savedCompats.length > 0 ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.7rem' }}>
              <Link to="/favorites" className="v3-button v3-button--ghost">
                보관함에서 궁합 다시 보기
              </Link>
            </div>
          ) : null}
          {wiped ? (
            <p className="v3-hint" style={{ marginTop: '0.7rem' }}>
              이 기기의 기록을 모두 지웠어요.
            </p>
          ) : wipeAsked ? (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem', flexWrap: 'wrap' }}>
              <button type="button" className="v3-button v3-button--danger" onClick={wipeDevice}>
                네, 모두 지울게요
              </button>
              <button
                type="button"
                className="v3-button v3-button--ghost"
                onClick={() => setWipeAsked(false)}
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="v3-button v3-button--ghost"
              style={{ marginTop: '0.7rem' }}
              onClick={() => setWipeAsked(true)}
            >
              이 기기의 기록 모두 지우기
            </button>
          )}
        </div>
      </Section>

      <Section title="궁금할 수 있는 것">
        <div className="v3-card">
          <ul className="v3-plain-list">
            <li>사주와 이름 계산은 전부 이 기기 안에서 끝나요. 무료 분석은 서버로 보내지 않아요.</li>
            <li>완성 리포트를 결제하면 그 내용만 서버에서 안전하게 만들어 드려요.</li>
            <li>공유하기에는 이름·생년월일이 어떤 형태로도 실리지 않아요.</li>
          </ul>
        </div>
      </Section>

      {!premiumIntent && profile ? (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <button
            type="button"
            className="v3-button v3-button--ghost v3-button--wide"
            onClick={() => navigate('/reports/integrated')}
          >
            보고서로 돌아가기
          </button>
        </div>
      ) : null}
    </main>
  );
}
