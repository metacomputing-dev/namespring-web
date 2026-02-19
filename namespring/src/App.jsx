import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SeedTs } from "@seed/seed";
import { HanjaRepository } from '@seed/database/hanja-repository';
import { SpringEngine } from '@spring/spring-engine';
import DevDbViewer from './DevDbViewer';
import DevHanjaDbViewer from './DevHanjaDbViewer';
import DevNameStatDbViewer from './DevNameStatDbViewer';
import SplashScreen from './SplashScreen';
import FadeTransition from './FadeTransition';
import AppBackground from './ui/AppBackground';
import HomePage from './HomePage';
import ReportPage from './ReportPage';
import InputForm from './InputForm';
import NamingCandidatesPage from './NamingCandidatesPage';
import CombinedReportPage from './CombinedReportPage';
import SajuReportPage from './SajuReportPage';
import CandidateNamingReportPage from './CandidateNamingReportPage';
import CandidateSajuReportPage from './CandidateSajuReportPage';

const ENTRY_STORAGE_KEY = 'namespring_entry_user_info';
const PAGE_VALUES = [
  'entry',
  'home',
  'report',
  'saju-report',
  'naming-candidates',
  'combined-report',
  'candidate-naming-report',
  'candidate-saju-report',
];

function normalizeEntryUserInfo(value) {
  if (!value || !Array.isArray(value.lastName) || !Array.isArray(value.firstName)) {
    return null;
  }

  const toOptionalInt = (rawValue, min, max) => {
    if (rawValue === null || rawValue === undefined || rawValue === '') return null;
    const n = Number(rawValue);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
    if (n < min || n > max) return null;
    return n;
  };

  const birthDateTime = value.birthDateTime || {};
  const normalizedCalendarType = birthDateTime.calendarType === 'lunar' ? 'lunar' : 'solar';
  const normalizedBirthDateTime = {
    year: toOptionalInt(birthDateTime.year, 1, 9999),
    month: toOptionalInt(birthDateTime.month, 1, 12),
    day: toOptionalInt(birthDateTime.day, 1, 31),
    hour: toOptionalInt(birthDateTime.hour, 0, 23),
    minute: toOptionalInt(birthDateTime.minute, 0, 59),
    calendarType: normalizedCalendarType,
    isLeapMonth: normalizedCalendarType === 'lunar' && birthDateTime.isLeapMonth != null
      ? Boolean(birthDateTime.isLeapMonth)
      : undefined,
  };

  const options = value.options || {};
  const pureHangulNameMode = options.pureHangulNameMode === 'on' || options.pureHangulNameMode === 'off'
    ? options.pureHangulNameMode
    : 'auto';
  const normalizedOptions = {
    pureHangulNameMode,
    useSurnameHanjaInPureHangul: pureHangulNameMode === 'on' && Boolean(options.useSurnameHanjaInPureHangul),
  };

  return {
    ...value,
    birthDateTime: normalizedBirthDateTime,
    gender: value.gender === 'female' ? 'female' : 'male',
    options: normalizedOptions,
  };
}

function loadStoredEntryUserInfo() {
  try {
    const raw = sessionStorage.getItem(ENTRY_STORAGE_KEY);
    return raw ? normalizeEntryUserInfo(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function normalizePage(page, hasEntryUserInfo) {
  const fallback = hasEntryUserInfo ? 'home' : 'entry';
  if (!PAGE_VALUES.includes(page)) return fallback;
  if (!hasEntryUserInfo && page !== 'entry') return 'entry';
  return page;
}

function toSpringNameChars(entries) {
  return (entries || [])
    .map((entry) => ({
      hangul: String(entry?.hangul ?? ''),
      hanja: String(entry?.hanja ?? ''),
    }))
    .filter((entry) => entry.hangul.length > 0);
}

function normalizeNamingContext(value) {
  if (!value || typeof value !== 'object') return {};
  return {
    namingGender: value.namingGender === 'female' ? 'female' : value.namingGender === 'male' ? 'male' : undefined,
    namingStyle: value.namingStyle === 'female'
      ? 'female'
      : value.namingStyle === 'male'
        ? 'male'
        : value.namingStyle === 'neutral'
          ? 'neutral'
          : undefined,
  };
}

function toSpringRequest(userInfo, namingContext) {
  const normalized = normalizeEntryUserInfo(userInfo);
  if (!normalized) {
    throw new Error('입력 정보가 없습니다.');
  }
  const normalizedNamingContext = normalizeNamingContext(namingContext);
  const effectiveGender = normalizedNamingContext.namingGender ?? normalized.gender;

  const surname = toSpringNameChars(normalized.lastName);
  const givenNameLength = Math.max(1, Math.min(4, normalized.firstName.length || 2));
  if (!surname.length) {
    throw new Error('성을 찾을 수 없습니다.');
  }

  return {
    birth: {
      year: normalized.birthDateTime.year,
      month: normalized.birthDateTime.month,
      day: normalized.birthDateTime.day,
      hour: normalized.birthDateTime.hour,
      minute: normalized.birthDateTime.minute,
      calendarType: normalized.birthDateTime.calendarType,
      isLeapMonth: normalized.birthDateTime.isLeapMonth,
      gender: effectiveGender,
    },
    surname,
    givenNameLength,
    mode: 'recommend',
    options: {
      pureHangulNameMode: normalized.options?.pureHangulNameMode ?? 'auto',
      useSurnameHanjaInPureHangul: Boolean(normalized.options?.useSurnameHanjaInPureHangul),
      namingStyle: normalizedNamingContext.namingStyle,
    },
  };
}

function toSpringReportRequest(userInfo, givenName, namingContext) {
  const base = toSpringRequest(userInfo, namingContext);
  const normalizedGivenName = (givenName || [])
    .map((item) => ({
      hangul: String(item?.hangul ?? ''),
      hanja: item?.hanja ? String(item.hanja) : undefined,
    }))
    .filter((item) => item.hangul.length > 0);

  return {
    ...base,
    givenName: normalizedGivenName,
    mode: 'evaluate',
  };
}

function toCurrentNameSpringReportRequest(userInfo, namingContext) {
  const normalized = normalizeEntryUserInfo(userInfo);
  if (!normalized) {
    throw new Error('입력 정보가 없습니다.');
  }

  const givenName = toSpringNameChars(normalized.firstName);
  if (!givenName.length) {
    throw new Error('이름을 찾을 수 없습니다.');
  }

  return {
    ...toSpringRequest(normalized, namingContext),
    givenName,
    mode: 'evaluate',
  };
}

function App() {
  const tool = new URLSearchParams(window.location.search).get("tool");
  const isDevSagyeoksuViewerMode = import.meta.env.DEV && tool === "fourframe-db-viewer";
  const isDevHanjaViewerMode = import.meta.env.DEV && tool === "hanja-db-viewer";
  const isDevNameStatViewerMode = import.meta.env.DEV && tool === "name-stat-db-viewer";

  const [isDbReady, setIsDbReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [entryUserInfo, setEntryUserInfo] = useState(() => loadStoredEntryUserInfo());
  const [selectedCandidateSummary, setSelectedCandidateSummary] = useState(null);
  const [selectedNamingContext, setSelectedNamingContext] = useState(null);
  const [selectedSpringReport, setSelectedSpringReport] = useState(null);
  const [page, setPage] = useState(() => (loadStoredEntryUserInfo() ? 'home' : 'entry'));
  const hanjaRepo = useMemo(() => new HanjaRepository(), []);
  const springEngine = useMemo(() => new SpringEngine(), []);

  // DB Initialization
  useEffect(() => {
    hanjaRepo.init().then(() => setIsDbReady(true));
  }, [hanjaRepo]);

  useEffect(() => {
    return () => {
      springEngine.close();
    };
  }, [springEngine]);

  useEffect(() => {
    if (isDevSagyeoksuViewerMode || isDevHanjaViewerMode || isDevNameStatViewerMode) return;
    window.history.replaceState({ ...(window.history.state || {}), page }, '');
  }, [isDevSagyeoksuViewerMode, isDevHanjaViewerMode, isDevNameStatViewerMode, page]);

  useEffect(() => {
    if (isDevSagyeoksuViewerMode || isDevHanjaViewerMode || isDevNameStatViewerMode) return;

    const onPopState = (event) => {
      const nextPage = normalizePage(event.state?.page, Boolean(entryUserInfo));
      setPage(nextPage);
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [entryUserInfo, isDevSagyeoksuViewerMode, isDevHanjaViewerMode, isDevNameStatViewerMode]);

  useEffect(() => {
    if (!showSplash) return;
    const minTimer = window.setTimeout(() => setMinSplashElapsed(true), 1000);
    return () => {
      window.clearTimeout(minTimer);
    };
  }, [showSplash]);

  useEffect(() => {
    if (!showSplash || !isDbReady || !minSplashElapsed) return;
    setShowSplash(false);
  }, [showSplash, isDbReady, minSplashElapsed]);

  const handleAnalyze = (userInfo) => {
    const engine = new SeedTs();
    return engine.analyze(normalizeEntryUserInfo(userInfo));
  };

  const handleAnalyzeAsync = async (userInfo) => {
    const engine = new SeedTs();
    await Promise.resolve();
    return engine.analyze(normalizeEntryUserInfo(userInfo));
  };

  const handleRecommendAsync = async (userInfo, namingContext) => {
    const springRequest = toSpringRequest(userInfo, namingContext);
    return springEngine.getNameCandidateSummaries(springRequest);
  };

  const handleLoadCombinedReportAsync = async (userInfo, candidate, namingContext) => {
    const springRequest = toSpringReportRequest(userInfo, candidate?.givenName, namingContext);
    if (!springRequest.givenName?.length) {
      throw new Error('선택된 후보 이름 정보가 없습니다.');
    }
    return springEngine.getSpringReport(springRequest);
  };

  const handleLoadCurrentNameReportAsync = async (userInfo, namingContext) => {
    const springRequest = toCurrentNameSpringReportRequest(userInfo, namingContext);
    return springEngine.getSpringReport(springRequest);
  };

  const handleLoadSajuReportAsync = async (userInfo) => {
    const springRequest = toSpringRequest(userInfo);
    return springEngine.getSajuReport(springRequest);
  };

  const handleUpdateEntryUserInfo = useCallback((userInfo) => {
    const normalized = normalizeEntryUserInfo(userInfo);
    setEntryUserInfo(normalized);
    try {
      sessionStorage.setItem(ENTRY_STORAGE_KEY, JSON.stringify(normalized));
    } catch {}
  }, []);

  const handleCombinedReportReady = useCallback((report) => {
    setSelectedSpringReport(report || null);
  }, []);

  const navigateToPage = (nextPage, options = {}) => {
    const hasEntryUserInfo = typeof options.hasEntryUserInfo === 'boolean'
      ? options.hasEntryUserInfo
      : Boolean(entryUserInfo);
    const normalized = normalizePage(nextPage, hasEntryUserInfo);
    setPage(normalized);
    const nextState = { ...(window.history.state || {}), page: normalized };
    if (options.replace) {
      window.history.replaceState(nextState, '');
    } else {
      window.history.pushState(nextState, '');
    }
  };

  const getView = () => {
    if (showSplash) {
      return { key: 'splash', node: <SplashScreen /> };
    }

    if (!isDbReady) {
      return {
        key: 'loading',
        node: (
          <AppBackground>
            <div className="min-h-screen flex items-center justify-center font-sans">
              <div className="text-center animate-pulse">
                <div className="w-16 h-16 bg-[var(--ns-primary)] rounded-full mb-4 mx-auto shadow-xl"></div>
                <p className="text-[var(--ns-muted)] font-black tracking-widest text-[10px] uppercase">Loading Engine...</p>
              </div>
            </div>
          </AppBackground>
        ),
      };
    }

    if (page === 'entry') {
      return {
        key: 'entry',
        node: (
          <AppBackground>
            <div className="min-h-screen flex flex-col items-center p-6 font-sans text-[var(--ns-text)]">
              <div className="bg-[var(--ns-surface)] p-10 rounded-[3rem] shadow-2xl border border-[var(--ns-border)] w-full max-w-2xl overflow-hidden">
                <header className="mb-8 text-center">
                  <h1 className="text-3xl font-black text-[var(--ns-accent-text)]">이름봄</h1>
                  <p className="text-[var(--ns-muted)] text-sm font-semibold">당신의 인생과 어울리는 이름</p>
                </header>
                <InputForm
                  hanjaRepo={hanjaRepo}
                  isDbReady={isDbReady}
                  onEnter={(userInfo) => {
                    const normalized = normalizeEntryUserInfo(userInfo);
                    setEntryUserInfo(normalized);
                    setSelectedCandidateSummary(null);
                    setSelectedNamingContext(null);
                    setSelectedSpringReport(null);
                    try {
                      sessionStorage.setItem(ENTRY_STORAGE_KEY, JSON.stringify(normalized));
                    } catch {}
                    navigateToPage('home', { hasEntryUserInfo: Boolean(normalized) });
                  }}
                  submitLabel="시작하기"
                />
              </div>
            </div>
          </AppBackground>
        ),
      };
    }

    if (page === 'home') {
      return {
        key: 'home',
        node: (
          <AppBackground>
            <HomePage
              entryUserInfo={entryUserInfo}
              onAnalyzeAsync={handleAnalyzeAsync}
              onOpenReport={() => navigateToPage('report')}
              onOpenNamingCandidates={() => navigateToPage('naming-candidates')}
              onOpenEntry={() => navigateToPage('entry')}
            />
          </AppBackground>
        ),
      };
    }

    if (page === 'naming-candidates') {
      return {
        key: 'naming-candidates',
        node: (
          <AppBackground>
            <NamingCandidatesPage
              entryUserInfo={entryUserInfo}
              onRecommendAsync={handleRecommendAsync}
              onLoadCurrentSpringReport={handleLoadCurrentNameReportAsync}
              onUpdateEntryUserInfo={handleUpdateEntryUserInfo}
              onBackHome={() => navigateToPage('home')}
              onOpenCombinedReport={(candidate, namingContext) => {
                setSelectedCandidateSummary(candidate || null);
                setSelectedNamingContext(normalizeNamingContext(namingContext));
                setSelectedSpringReport(null);
                navigateToPage('combined-report');
              }}
            />
          </AppBackground>
        ),
      };
    }

    if (page === 'combined-report') {
      return {
        key: 'combined-report',
        node: (
          <AppBackground>
            <CombinedReportPage
              entryUserInfo={entryUserInfo}
              selectedCandidate={selectedCandidateSummary}
              namingContext={selectedNamingContext}
              onLoadCombinedReport={handleLoadCombinedReportAsync}
              onReportReady={handleCombinedReportReady}
              onBackHome={() => navigateToPage('home')}
              onBackCandidates={() => navigateToPage('naming-candidates')}
              onOpenNamingReport={() => navigateToPage('candidate-naming-report')}
              onOpenSajuReport={() => navigateToPage('candidate-saju-report')}
            />
          </AppBackground>
        ),
      };
    }

    if (page === 'candidate-naming-report') {
      return {
        key: 'candidate-naming-report',
        node: (
          <AppBackground>
            <CandidateNamingReportPage
              springReport={selectedSpringReport}
              onBackCombined={() => navigateToPage('combined-report')}
              onBackHome={() => navigateToPage('home')}
            />
          </AppBackground>
        ),
      };
    }

    if (page === 'candidate-saju-report') {
      return {
        key: 'candidate-saju-report',
        node: (
          <AppBackground>
            <CandidateSajuReportPage
              springReport={selectedSpringReport}
              onBackCombined={() => navigateToPage('combined-report')}
              onBackHome={() => navigateToPage('home')}
            />
          </AppBackground>
        ),
      };
    }

    if (page === 'saju-report') {
      return {
        key: 'saju-report',
        node: (
          <AppBackground>
            <SajuReportPage
              entryUserInfo={entryUserInfo}
              onLoadSajuReport={handleLoadSajuReportAsync}
              onBackHome={() => navigateToPage('home')}
            />
          </AppBackground>
        ),
      };
    }

    return {
      key: 'report',
      node: (
        <AppBackground>
          <ReportPage
            hanjaRepo={hanjaRepo}
            isDbReady={isDbReady}
            onAnalyze={handleAnalyze}
            initialUserInfo={entryUserInfo}
            onBackHome={() => navigateToPage('home')}
          />
        </AppBackground>
      ),
    };
  };

  if (isDevSagyeoksuViewerMode) {
    return <FadeTransition transitionKey="dev-fourframe"><AppBackground><DevDbViewer /></AppBackground></FadeTransition>;
  }
  if (isDevHanjaViewerMode) {
    return <FadeTransition transitionKey="dev-hanja"><AppBackground><DevHanjaDbViewer /></AppBackground></FadeTransition>;
  }
  if (isDevNameStatViewerMode) {
    return <FadeTransition transitionKey="dev-name-stat"><AppBackground><DevNameStatDbViewer /></AppBackground></FadeTransition>;
  }

  const view = getView();
  return <FadeTransition transitionKey={view.key}>{view.node}</FadeTransition>;
}

export default App;

