import { createContext, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ELEMENT_KO } from '../model/facts';
import {
  clearCandidateOverride,
  hasCandidateOverride,
  loadOriginalProfile,
  loadProfile,
  fullHangulName,
} from '../model/profile';
import { clearDeliveryCache } from '../engine/client';

/* ---------- 전문 용어 토글 (보고서 전역) ---------- */

const TermsContext = createContext<{ expert: boolean; toggle: () => void }>({
  expert: false,
  toggle: () => {},
});

export function TermsProvider({ children }: { children: ReactNode }) {
  const [expert, setExpert] = useState(false);
  return (
    <TermsContext.Provider value={{ expert, toggle: () => setExpert(v => !v) }}>
      {children}
    </TermsContext.Provider>
  );
}

export function useTerms() {
  return useContext(TermsContext);
}

export function TermToggle() {
  const { expert, toggle } = useTerms();
  return (
    <div
      className="v3-screen-only"
      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}
    >
      <button
        type="button"
        className="v3-tab"
        aria-selected={expert}
        aria-pressed={expert}
        onClick={toggle}
      >
        {expert ? '쉬운 말로 보기' : '전문 용어 보기'}
      </button>
      <span className="v3-hint">
        {expert
          ? '원국 용어와 해설을 함께 보고 있어요.'
          : '어려운 용어는 접어 두고 쉬운 말로 보여드려요.'}
      </span>
    </div>
  );
}

/* ---------- 별점 ---------- */

export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  const filled = Math.round(value);
  return (
    <span
      className="v3-stars"
      role="img"
      aria-label={`별점 5점 만점에 ${value}점`}
    >
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          className={i < filled ? undefined : 'v3-star--empty'}
          width="15"
          height="15"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9Z"
            fill={i < filled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ))}
      <span className="v3-stars-value" aria-hidden="true">
        {value.toFixed(1)} / {max}.0
      </span>
    </span>
  );
}

/* ---------- 오행 배지 ---------- */

const ELEMENT_CLASS: Record<string, string> = {
  wood: 'v3-badge--wood',
  fire: 'v3-badge--fire',
  earth: 'v3-badge--earth',
  metal: 'v3-badge--metal',
  water: 'v3-badge--water',
};

export function ElementBadge({ element, suffix }: { element: string; suffix?: string }) {
  const key = element.toLowerCase();
  const label = ELEMENT_KO[key] ?? element;
  return (
    <span className={`v3-badge ${ELEMENT_CLASS[key] ?? ''}`}>
      {label}
      {suffix ? ` ${suffix}` : ''}
    </span>
  );
}

/* ---------- 인용 카드 (인사이트) ---------- */

export function QuoteCard({
  main,
  expertNote,
  tags,
}: {
  main: string;
  expertNote?: string | null;
  tags?: string[];
}) {
  const { expert } = useTerms();
  return (
    <div className="v3-quote">
      <p className="v3-quote-main">{main}</p>
      {expert && expertNote ? <p className="v3-quote-expert">{expertNote}</p> : null}
      {expert && tags && tags.length > 0 ? (
        <div className="v3-quote-tags">
          {tags.map(tag => (
            <span key={tag} className="v3-badge">
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- 섹션 ---------- */

export function Section({
  title,
  lede,
  children,
  id,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="v3-section" id={id}>
      <h2 className="v3-section-title">{title}</h2>
      {lede ? <p className="v3-section-lede">{lede}</p> : null}
      {children}
    </section>
  );
}

/* ---------- 후보 이름으로 보는 중 배너 ---------- */

export function OverrideBanner() {
  if (!hasCandidateOverride()) return null;
  const viewing = loadProfile();
  const original = loadOriginalProfile();
  if (!viewing) return null;
  const viewingName = fullHangulName(viewing);
  const viewingCode = viewingName.charCodeAt(viewingName.length - 1);
  const jongseong =
    viewingCode >= 0xac00 && viewingCode <= 0xd7a3 ? (viewingCode - 0xac00) % 28 : 0;
  // 받침이 없거나 ㄹ 받침(인덱스 8)이면 '로' — '하늘로', '민지로'.
  const euro = jongseong !== 0 && jongseong !== 8 ? '으로' : '로';
  return (
    <div className="v3-override-banner" role="status">
      <span>
        지금은 새 이름 <strong>{viewingName}</strong>
        {original
          ? `${euro} 보고 있어요. 처음 입력한 ${fullHangulName(original)} 이름은 그대로 있어요.`
          : `${euro} 보고 있어요.`}
      </span>
      <button
        type="button"
        className="v3-button v3-button--ghost"
        onClick={() => {
          clearCandidateOverride();
          clearDeliveryCache();
          window.location.reload();
        }}
      >
        내 이름으로 돌아가기
      </button>
    </div>
  );
}

/* ---------- 보고서 하단 동작 ---------- */

export function ReportActions() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  async function share() {
    // 개인정보 없는 안내만 공유한다 — 이름·생년월일은 어떤 형태로도 싣지 않는다.
    const url = window.location.origin;
    const text = '이름과 사주를 함께 읽는 시간, 이름봄';
    try {
      if (navigator.share) {
        await navigator.share({ title: '이름봄', text, url });
        return;
      }
    } catch {
      /* 사용자가 공유를 취소한 경우 등 */
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="v3-report-actions">
      <button type="button" className="v3-button v3-button--ghost" onClick={() => window.print()}>
        PDF 저장
      </button>
      <button type="button" className="v3-button" onClick={share}>
        {copied ? '주소를 복사했어요' : '공유하기'}
      </button>
      <button type="button" className="v3-button v3-button--ghost" onClick={() => navigate('/')}>
        처음으로
      </button>
    </div>
  );
}

/* ---------- 보고서 공통 고지 (화면당 1회) ---------- */

export function ReportFootnote() {
  return (
    <p className="v3-hint" style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
      이 보고서는 전통 명리학과 성명학의 관점을 옮긴 참고 자료예요. 계산은 이 기기
      안에서 이루어지고, 성격이나 미래를 확정하지 않아요.
    </p>
  );
}

/* ---------- 로딩 ---------- */

export function Loading({ message }: { message: string }) {
  return (
    <div className="v3-loading" role="status">
      <div className="v3-loading-leaf" aria-hidden="true" />
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}
