import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { SHARE_QUERY_KEY, parseShareEntryUserInfoToken } from './share-entry-user-info';

const ENTRY_STORAGE_KEY = 'namespring_entry_user_info';
const PAGE_VALUES = ['entry', 'home', 'report', 'saju-report', 'naming-candidates', 'combined-report'];

function cloneNameEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object') return {};
    return { ...entry };
  });
}

function toHangulText(entries) {
  return (entries || [])
    .map((entry) => String(entry?.hangul ?? ''))
    .join('');
}

function normalizeEntryUserInfo(value) {
  if (!value || !Array.isArray(value.lastName) || !Array.isArray(value.firstName)) {
    return null;
  }

  const normalizedLastName = cloneNameEntries(value.lastName);
  const normalizedFirstName = cloneNameEntries(value.firstName);
  const birthDateTime = value.birthDateTime || {};
  const normalizedBirthDateTime = {
    year: Number(birthDateTime.year) || 0,
    month: Number(birthDateTime.month) || 0,
    day: Number(birthDateTime.day) || 0,
    hour: Number.isFinite(Number(birthDateTime.hour)) ? Number(birthDateTime.hour) : 12,
    minute: Number.isFinite(Number(birthDateTime.minute)) ? Number(birthDateTime.minute) : 0,
  };

  return {
    ...value,
    lastName: normalizedLastName,
    firstName: normalizedFirstName,
    lastNameText: String(value.lastNameText ?? toHangulText(normalizedLastName)),
    firstNameText: String(value.firstNameText ?? toHangulText(normalizedFirstName)),
    birthDateTime: normalizedBirthDateTime,
    gender: value.gender === 'female' ? 'female' : 'male',
    isNativeKoreanName: Boolean(value.isNativeKoreanName),
    isSolarCalendar: value.isSolarCalendar !== false,
    isBirthTimeUnknown: Boolean(value.isBirthTimeUnknown),
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

function loadSharedEntryUserInfo() {
  try {
    const query = new URLSearchParams(window.location.search);
    const token = query.get(SHARE_QUERY_KEY);
    if (!token) return null;
    return normalizeEntryUserInfo(parseShareEntryUserInfoToken(token));
  } catch {
    return null;
  }
}

function loadInitialAppState() {
  const sharedEntryUserInfo = loadSharedEntryUserInfo();
  if (sharedEntryUserInfo) {
    return {
      entryUserInfo: sharedEntryUserInfo,
      page: 'report',
    };
  }

  const storedEntryUserInfo = loadStoredEntryUserInfo();
  return {
    entryUserInfo: storedEntryUserInfo,
    page: storedEntryUserInfo ? 'home' : 'entry',
  };
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

function toSpringRequest(userInfo) {
  const normalized = normalizeEntryUserInfo(userInfo);
  if (!normalized) {
    throw new Error('입력 정보가 없습니다.');
  }

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
      gender: normalized.gender,
    },
    surname,
    givenNameLength,
    mode: 'recommend',
  };
}

function toSpringReportRequest(userInfo, givenName) {
  const base = toSpringRequest(userInfo);
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

function toCurrentNameSpringReportRequest(userInfo) {
  const normalized = normalizeEntryUserInfo(userInfo);
  if (!normalized) {
    throw new Error('입력 정보가 없습니다.');
  }

  const givenName = toSpringNameChars(normalized.firstName);
  if (!givenName.length) {
    throw new Error('이름을 찾을 수 없습니다.');
  }

  return {
    ...toSpringRequest(normalized),
    givenName,
    mode: 'evaluate',
  };
}

function toRequestCacheKey(request) {
  return JSON.stringify(request);
}

function App() {
  const tool = new URLSearchParams(window.location.search).get("tool");
  const isDevSagyeoksuViewerMode = import.meta.env.DEV && tool === "fourframe-db-viewer";
  const isDevHanjaViewerMode = import.meta.env.DEV && tool === "hanja-db-viewer";
  const isDevNameStatViewerMode = import.meta.env.DEV && tool === "name-stat-db-viewer";
  const initialAppState = useMemo(() => loadInitialAppState(), []);

  const [isDbReady, setIsDbReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [entryUserInfo, setEntryUserInfo] = useState(initialAppState.entryUserInfo);
  const [selectedCandidateSummary, setSelectedCandidateSummary] = useState(null);
  const [page, setPage] = useState(initialAppState.page);
  const hanjaRepo = useMemo(() => new HanjaRepository(), []);
  const springEngine = useMemo(() => new SpringEngine(), []);
  const recommendResultCacheRef = useRef(new Map());
  const currentNameReportCacheRef = useRef(new Map());

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

  const handleRecommendAsync = useCallback(async (userInfo) => {
    const springRequest = toSpringRequest(userInfo);
    const cacheKey = toRequestCacheKey(springRequest);
    const cachedPromise = recommendResultCacheRef.current.get(cacheKey);
    if (cachedPromise) {
      return cachedPromise;
    }

    const requestPromise = springEngine.getNameCandidateSummaries(springRequest)
      .catch((error) => {
        recommendResultCacheRef.current.delete(cacheKey);
        throw error;
      });
    recommendResultCacheRef.current.set(cacheKey, requestPromise);
    return requestPromise;
  }, [springEngine]);

  const handleLoadCombinedReportAsync = async (userInfo, candidate) => {
    const springRequest = toSpringReportRequest(userInfo, candidate?.givenName);
    if (!springRequest.givenName?.length) {
      throw new Error('선택한 후보 이름 정보가 없습니다.');
    }
    return springEngine.getSpringReport(springRequest);
  };

  const handleLoadCurrentNameReportAsync = useCallback(async (userInfo) => {
    const springRequest = toCurrentNameSpringReportRequest(userInfo);
    const cacheKey = toRequestCacheKey(springRequest);
    const cachedPromise = currentNameReportCacheRef.current.get(cacheKey);
    if (cachedPromise) {
      return cachedPromise;
    }

    const requestPromise = springEngine.getSpringReport(springRequest)
      .catch((error) => {
        currentNameReportCacheRef.current.delete(cacheKey);
        throw error;
      });
    currentNameReportCacheRef.current.set(cacheKey, requestPromise);
    return requestPromise;
  }, [springEngine]);

  const handleLoadSajuReportAsync = async (userInfo) => {
    const springRequest = toSpringRequest(userInfo);
    return springEngine.getSajuReport(springRequest);
  };

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
                  <p className="text-[var(--ns-muted)] text-sm font-semibold">당신의 인생과 함께하는 이름</p>
                </header>
                <InputForm
                  hanjaRepo={hanjaRepo}
                  isDbReady={isDbReady}
                  initialUserInfo={entryUserInfo}
                  onEnter={(userInfo) => {
                    const normalized = normalizeEntryUserInfo(userInfo);
                    setEntryUserInfo(normalized);
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
              onOpenEntry={(userInfoFromHome) => {
                const normalized = normalizeEntryUserInfo(userInfoFromHome || entryUserInfo);
                if (normalized) {
                  setEntryUserInfo(normalized);
                }
                navigateToPage('entry', { hasEntryUserInfo: Boolean(normalized) });
              }}
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
              onBackHome={() => navigateToPage('home')}
              onOpenCombinedReport={(candidate) => {
                setSelectedCandidateSummary(candidate || null);
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
              onLoadCombinedReport={handleLoadCombinedReportAsync}
              onBackHome={() => navigateToPage('home')}
              onBackCandidates={() => navigateToPage('naming-candidates')}
              onOpenNamingReport={() => navigateToPage('report')}
              onOpenSajuReport={() => navigateToPage('saju-report')}
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
