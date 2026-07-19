import { useEffect, useMemo, useRef, useState } from 'react';
import { HanjaRepository, type HanjaEntry } from '@seed/database/hanja-repository';
import { ELEMENT_KO } from '../model/facts';

function elementLabel(raw: string): string {
  return ELEMENT_KO[raw.toLowerCase()] ? `${ELEMENT_KO[raw.toLowerCase()]} 기운` : raw;
}

let repoSingleton: HanjaRepository | null = null;
let repoInit: Promise<void> | null = null;

function getRepo(): { repo: HanjaRepository; ready: Promise<void> } {
  if (!repoSingleton) {
    repoSingleton = new HanjaRepository();
    repoInit = repoSingleton.init();
  }
  return { repo: repoSingleton, ready: repoInit! };
}

export interface HanjaChoice {
  hanja: string;
  meaning: string;
  strokes: number;
}

export function HanjaPickerModal({
  hangul,
  isSurname,
  onSelect,
  onClose,
}: {
  hangul: string;
  isSurname: boolean;
  onSelect: (choice: HanjaChoice) => void;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<HanjaEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const { repo, ready } = getRepo();
    ready
      .then(() =>
        isSurname ? repo.findSurnamesByHangul(hangul) : repo.findByHangul(hangul),
      )
      .then(found => {
        if (!cancelled) setEntries(found);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hangul, isSurname]);

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const visible = useMemo(() => {
    if (!entries) return [];
    const q = query.trim();
    if (!q) return entries;
    return entries.filter(entry => entry.meaning.includes(q) || entry.hanja === q);
  }, [entries, query]);

  return (
    <div className="v3-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="v3-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`'${hangul}' 한자 고르기`}
        onClick={event => event.stopPropagation()}
      >
        <div className="v3-modal-head">
          <strong>‘{hangul}’ 한자 고르기</strong>
          <button type="button" className="v3-icon-button" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <input
          ref={searchRef}
          className="v3-input"
          placeholder="뜻으로 검색 (예: 빼어날)"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <div className="v3-modal-list">
          {failed ? (
            <p className="v3-hint">한자 사전을 불러오지 못했어요. 네트워크 연결을 확인해 주세요.</p>
          ) : entries === null ? (
            <p className="v3-hint">한자 사전을 여는 중…</p>
          ) : visible.length === 0 ? (
            <p className="v3-hint">
              {query ? '해당 뜻의 한자가 없어요.' : '고를 수 있는 한자가 없어요.'}
            </p>
          ) : (
            visible.map(entry => (
              <button
                key={entry.id}
                type="button"
                className="v3-hanja-option"
                onClick={() =>
                  onSelect({ hanja: entry.hanja, meaning: entry.meaning, strokes: entry.strokes })
                }
              >
                <span className="v3-hanja-glyph">{entry.hanja}</span>
                <span className="v3-hanja-info">
                  <span className="v3-hanja-meaning">{entry.meaning}</span>
                  <span className="v3-hint">
                    {entry.strokes}획 · {elementLabel(entry.resource_element)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
