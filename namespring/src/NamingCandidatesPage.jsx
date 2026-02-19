import React, { useEffect, useMemo, useState } from 'react';

function toOptionalInt(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function isOptionalIntValid(value, min, max) {
  return value === '' || toOptionalInt(value, min, max) !== null;
}

function getDisplayName(candidate) {
  const fullHangul = candidate?.fullHangul || candidate?.namingReport?.name?.fullHangul || '-';
  const fullHanja = candidate?.fullHanja || candidate?.namingReport?.name?.fullHanja || '-';
  return fullHanja && fullHanja !== '-' ? `${fullHangul} (${fullHanja})` : fullHangul;
}

function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return '0.0';
  return score.toFixed(1);
}

function getPopularityRank(candidate) {
  const rank = Number(candidate?.popularityRank);
  return Number.isFinite(rank) && rank > 0 ? rank : null;
}

function formatRank(rank) {
  return rank ? `${Math.round(rank).toLocaleString()}위` : '-';
}

function birthStateFromUserInfo(userInfo) {
  const birth = userInfo?.birthDateTime || {};
  return {
    birthYear: birth.year != null ? String(birth.year) : '',
    birthMonth: birth.month != null ? String(birth.month) : '',
    birthDay: birth.day != null ? String(birth.day) : '',
    birthHour: birth.hour != null ? String(birth.hour) : '',
    birthMinute: birth.minute != null ? String(birth.minute) : '',
    calendarType: birth.calendarType === 'lunar' ? 'lunar' : 'solar',
  };
}

function NamingCandidatesPage({
  entryUserInfo,
  onRecommendAsync,
  onLoadCurrentSpringReport,
  onBackHome,
  onOpenCombinedReport,
  onUpdateEntryUserInfo,
}) {
  const initialBirthState = useMemo(() => birthStateFromUserInfo(entryUserInfo), [entryUserInfo]);
  const profileGenderDefault = entryUserInfo?.gender === 'female'
    ? 'female'
    : entryUserInfo?.gender === 'male'
      ? 'male'
      : '';

  const [isLoading, setIsLoading] = useState(false);
  const [isCurrentLoading, setIsCurrentLoading] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [error, setError] = useState('');
  const [sortMode, setSortMode] = useState('popularity');
  const [candidates, setCandidates] = useState([]);
  const [currentSpringReport, setCurrentSpringReport] = useState(null);
  const [namingGender, setNamingGender] = useState(profileGenderDefault);
  const [namingStyle, setNamingStyle] = useState(profileGenderDefault);
  const [birthYear, setBirthYear] = useState(initialBirthState.birthYear);
  const [birthMonth, setBirthMonth] = useState(initialBirthState.birthMonth);
  const [birthDay, setBirthDay] = useState(initialBirthState.birthDay);
  const [birthHour, setBirthHour] = useState(initialBirthState.birthHour);
  const [birthMinute, setBirthMinute] = useState(initialBirthState.birthMinute);
  const [calendarType, setCalendarType] = useState(initialBirthState.calendarType);

  useEffect(() => {
    const next = birthStateFromUserInfo(entryUserInfo);
    setBirthYear(next.birthYear);
    setBirthMonth(next.birthMonth);
    setBirthDay(next.birthDay);
    setBirthHour(next.birthHour);
    setBirthMinute(next.birthMinute);
    setCalendarType(next.calendarType);
  }, [entryUserInfo]);

  const parsedBirth = useMemo(() => ({
    year: toOptionalInt(birthYear, 1, 9999),
    month: toOptionalInt(birthMonth, 1, 12),
    day: toOptionalInt(birthDay, 1, 31),
    hour: toOptionalInt(birthHour, 0, 23),
    minute: toOptionalInt(birthMinute, 0, 59),
  }), [birthDay, birthHour, birthMinute, birthMonth, birthYear]);

  const isBirthInputValid = useMemo(() => (
    isOptionalIntValid(birthYear, 1, 9999)
    && isOptionalIntValid(birthMonth, 1, 12)
    && isOptionalIntValid(birthDay, 1, 31)
    && isOptionalIntValid(birthHour, 0, 23)
    && isOptionalIntValid(birthMinute, 0, 59)
  ), [birthDay, birthHour, birthMinute, birthMonth, birthYear]);

  const isBirthInputComplete = parsedBirth.year != null
    && parsedBirth.month != null
    && parsedBirth.day != null
    && parsedBirth.hour != null
    && parsedBirth.minute != null;

  const isNamingGenderSelected = namingGender === 'female' || namingGender === 'male';
  const isNamingStyleSelected = namingStyle === 'female' || namingStyle === 'male' || namingStyle === 'neutral';
  const isSelectionComplete = isNamingGenderSelected && isNamingStyleSelected && isBirthInputValid && isBirthInputComplete;

  const sortedCandidates = useMemo(() => {
    return [...candidates].sort((a, b) => {
      if (sortMode === 'popularity') {
        const aRank = getPopularityRank(a);
        const bRank = getPopularityRank(b);
        const safeA = aRank ?? Number.POSITIVE_INFINITY;
        const safeB = bRank ?? Number.POSITIVE_INFINITY;
        if (safeA !== safeB) return safeA - safeB;
      }
      return Number(b?.finalScore ?? 0) - Number(a?.finalScore ?? 0);
    });
  }, [candidates, sortMode]);

  const scoreRangeText = useMemo(() => {
    if (!candidates.length) return '-';
    const scores = candidates
      .map((candidate) => Number(candidate?.finalScore))
      .filter((score) => Number.isFinite(score));
    if (!scores.length) return '-';
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    return `${formatScore(max)}점 ~ ${formatScore(min)}점`;
  }, [candidates]);

  const popularityRangeText = useMemo(() => {
    const ranks = candidates
      .map((candidate) => getPopularityRank(candidate))
      .filter((rank) => Number.isFinite(rank));
    if (!ranks.length) return '-';
    const min = Math.min(...ranks);
    const max = Math.max(...ranks);
    return `${Math.round(min).toLocaleString()}위 ~ ${Math.round(max).toLocaleString()}위`;
  }, [candidates]);

  const currentTotalScoreText = useMemo(() => {
    const score = Number(currentSpringReport?.finalScore);
    return Number.isFinite(score) ? `${formatScore(score)}점` : '-';
  }, [currentSpringReport]);

  const currentPopularityText = useMemo(() => {
    const rank = Number(currentSpringReport?.popularityRank);
    return Number.isFinite(rank) && rank > 0 ? `${Math.round(rank).toLocaleString()}위` : '-';
  }, [currentSpringReport]);

  const handleRecommend = async () => {
    if (!entryUserInfo || !onRecommendAsync) {
      setError('입력 정보가 없어 작명을 진행할 수 없습니다.');
      setHasRequested(true);
      return;
    }

    if (!isBirthInputValid) {
      setError('생년월일시분 입력값을 확인해 주세요.');
      return;
    }
    if (!isBirthInputComplete) {
      setError('작명에는 생년월일시분(년/월/일/시/분) 전체 입력이 필요합니다.');
      return;
    }
    if (!isNamingGenderSelected || !isNamingStyleSelected) {
      setError('작명 성별과 이름 성향을 모두 선택해 주세요.');
      return;
    }

    const nextUserInfo = {
      ...entryUserInfo,
      birthDateTime: {
        ...(entryUserInfo.birthDateTime || {}),
        year: parsedBirth.year,
        month: parsedBirth.month,
        day: parsedBirth.day,
        hour: parsedBirth.hour,
        minute: parsedBirth.minute,
        calendarType,
      },
    };

    const namingContext = { namingGender, namingStyle };
    onUpdateEntryUserInfo?.(nextUserInfo);

    setHasRequested(true);
    setSortMode('popularity');
    setError('');
    setCandidates([]);
    setCurrentSpringReport(null);
    setIsLoading(true);
    setIsCurrentLoading(true);

    try {
      const [reports, currentReport] = await Promise.all([
        onRecommendAsync(nextUserInfo, namingContext),
        onLoadCurrentSpringReport ? onLoadCurrentSpringReport(nextUserInfo, namingContext) : Promise.resolve(null),
      ]);

      const safeReports = Array.isArray(reports) ? reports : [];
      setCandidates(safeReports);
      setCurrentSpringReport(currentReport || null);
      if (!safeReports.length) {
        setError('추천 결과가 없습니다.');
      }
    } catch {
      setError('작명 결과를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
      setIsCurrentLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center p-3 font-sans text-[var(--ns-text)]">
      <div className="bg-[var(--ns-surface)] p-5 rounded-[2rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--ns-accent-text)]">이름봄 작명하기</h1>
          </div>
          <button
            onClick={onBackHome}
            aria-label="홈으로"
            title="홈으로"
            className="w-10 h-10 rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] font-bold inline-flex items-center justify-center"
          >
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
              <path d="M3 9.5L10 4L17 9.5V16.5H12.5V12H7.5V16.5H3V9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </header>

        <section className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-black text-[var(--ns-muted)]">생년월일시분 (작명 필수)</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={birthYear}
                onChange={(e) => setBirthYear(String(e.target.value).slice(0, 4))}
                className={`w-full p-2 rounded-xl border bg-[var(--ns-surface)] text-sm font-bold text-[var(--ns-text)] ${isOptionalIntValid(birthYear, 1, 9999) ? 'border-[var(--ns-border)]' : 'border-rose-300'}`}
                placeholder="년"
              />
              <input
                type="number"
                inputMode="numeric"
                value={birthMonth}
                onChange={(e) => setBirthMonth(String(e.target.value).slice(0, 2))}
                className={`w-full p-2 rounded-xl border bg-[var(--ns-surface)] text-sm font-bold text-[var(--ns-text)] ${isOptionalIntValid(birthMonth, 1, 12) ? 'border-[var(--ns-border)]' : 'border-rose-300'}`}
                placeholder="월"
              />
              <input
                type="number"
                inputMode="numeric"
                value={birthDay}
                onChange={(e) => setBirthDay(String(e.target.value).slice(0, 2))}
                className={`w-full p-2 rounded-xl border bg-[var(--ns-surface)] text-sm font-bold text-[var(--ns-text)] ${isOptionalIntValid(birthDay, 1, 31) ? 'border-[var(--ns-border)]' : 'border-rose-300'}`}
                placeholder="일"
              />
              <input
                type="number"
                inputMode="numeric"
                value={birthHour}
                onChange={(e) => setBirthHour(String(e.target.value).slice(0, 2))}
                className={`w-full p-2 rounded-xl border bg-[var(--ns-surface)] text-sm font-bold text-[var(--ns-text)] ${isOptionalIntValid(birthHour, 0, 23) ? 'border-[var(--ns-border)]' : 'border-rose-300'}`}
                placeholder="시"
              />
              <input
                type="number"
                inputMode="numeric"
                value={birthMinute}
                onChange={(e) => setBirthMinute(String(e.target.value).slice(0, 2))}
                className={`w-full p-2 rounded-xl border bg-[var(--ns-surface)] text-sm font-bold text-[var(--ns-text)] ${isOptionalIntValid(birthMinute, 0, 59) ? 'border-[var(--ns-border)]' : 'border-rose-300'}`}
                placeholder="분"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCalendarType('solar')}
                className={`py-2 rounded-xl text-xs font-black border ${calendarType === 'solar' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                양력
              </button>
              <button
                type="button"
                onClick={() => setCalendarType('lunar')}
                className={`py-2 rounded-xl text-xs font-black border ${calendarType === 'lunar' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                음력
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black text-[var(--ns-muted)]">작명 성별 (남/여 필수)</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNamingGender('female')}
                className={`py-3 rounded-xl font-black text-sm border ${namingGender === 'female' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                여성
              </button>
              <button
                type="button"
                onClick={() => setNamingGender('male')}
                className={`py-3 rounded-xl font-black text-sm border ${namingGender === 'male' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                남성
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-black text-[var(--ns-muted)]">이름 성향 (남/여/중성 필수)</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setNamingStyle('female')}
                className={`py-3 rounded-xl font-black text-sm border ${namingStyle === 'female' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                여성
              </button>
              <button
                type="button"
                onClick={() => setNamingStyle('male')}
                className={`py-3 rounded-xl font-black text-sm border ${namingStyle === 'male' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                남성
              </button>
              <button
                type="button"
                onClick={() => setNamingStyle('neutral')}
                className={`py-3 rounded-xl font-black text-sm border ${namingStyle === 'neutral' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                중성
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRecommend}
            disabled={isLoading || !isSelectionComplete}
            className="w-full py-3 rounded-xl font-black text-sm bg-[var(--ns-primary)] text-[var(--ns-accent-text)] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? '작명 중...' : '작명하기'}
          </button>
        </section>

        {!hasRequested && (
          <div className="mt-3 h-20 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex items-center justify-center px-4">
            <p className="text-sm font-bold text-[var(--ns-muted)] text-center">
              생년월일시분, 작명 성별, 이름 성향을 모두 선택한 뒤 작명하기를 눌러 주세요.
            </p>
          </div>
        )}

        {hasRequested && (
          <section className="space-y-3 mt-3">
            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3">
              <p className="text-xs font-black text-[var(--ns-muted)] mb-2">현재 이름 비교 기준</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">
                  {currentSpringReport?.namingReport?.name?.fullHangul || '-'}
                  {currentSpringReport?.namingReport?.name?.fullHanja
                    ? ` (${currentSpringReport.namingReport.name.fullHanja})`
                    : ''}
                </p>
                {isCurrentLoading ? (
                  <span className="text-xs font-semibold text-[var(--ns-muted)]">기준 정보를 계산 중...</span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
                  <p className="text-[11px] font-black text-[var(--ns-muted)]">현재 이름 총점</p>
                  <p className="text-sm font-black text-[var(--ns-accent-text)]">{currentTotalScoreText}</p>
                </div>
                <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
                  <p className="text-[11px] font-black text-[var(--ns-muted)]">현재 이름 인기순위</p>
                  <p className="text-sm font-black text-[var(--ns-accent-text)]">{currentPopularityText}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] p-3">
              <p className="text-xs font-black text-[var(--ns-muted)] mb-2">후보 요약</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
                  <p className="text-[11px] font-black text-[var(--ns-muted)]">총점 범위</p>
                  <p className="text-sm font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">{scoreRangeText}</p>
                </div>
                <div className="rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] px-3 py-2">
                  <p className="text-[11px] font-black text-[var(--ns-muted)]">인기순위 범위</p>
                  <p className="text-sm font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">{popularityRangeText}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-black text-[var(--ns-muted)]">총 {candidates.length}개 후보</p>
              <div className="flex items-center gap-2">
                <label htmlFor="candidate-sort" className="text-xs font-black text-[var(--ns-muted)]">정렬</label>
                <select
                  id="candidate-sort"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-sm font-bold text-[var(--ns-text)]"
                >
                  <option value="score">점수순</option>
                  <option value="popularity">인기순위순</option>
                </select>
              </div>
            </div>

            {isLoading && (
              <div className="h-40 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex flex-col items-center justify-center gap-3">
                <div className="h-12 w-12 rounded-full border-4 border-[var(--ns-primary)] border-t-transparent animate-spin" />
                <p className="text-sm font-bold text-[var(--ns-muted)]">작명 중입니다. 잠시만 기다려 주세요.</p>
              </div>
            )}

            {!isLoading && error && (
              <div className="h-24 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] flex items-center justify-center px-4">
                <p className="text-sm font-bold text-[var(--ns-muted)] text-center">{error}</p>
              </div>
            )}

            {!isLoading && !error && (
              <ul className="max-h-[66vh] overflow-y-auto space-y-2 pr-1">
                {sortedCandidates.map((candidate, index) => (
                  <li
                    key={`${candidate?.rank ?? index}-${candidate?.fullHanja ?? candidate?.namingReport?.name?.fullHanja ?? index}`}
                    className="rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)]"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenCombinedReport?.(candidate, { namingGender, namingStyle })}
                      className="w-full text-left px-4 py-3 hover:bg-white/60 transition-colors rounded-xl"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm md:text-base font-black text-[var(--ns-accent-text)] break-keep whitespace-normal">
                          {getDisplayName(candidate)}
                        </p>
                        <p className="text-sm font-black text-[var(--ns-text)]">
                          최종 점수 {formatScore(candidate?.finalScore)}
                        </p>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-[var(--ns-muted)] flex justify-end">
                        인기순위 {formatRank(getPopularityRank(candidate))}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default NamingCandidatesPage;
