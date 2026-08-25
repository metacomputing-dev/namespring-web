import React, { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from 'react';
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
import EntryFunnel from './entry/EntryFunnel';
import NamingCandidatesPage from './NamingCandidatesPage';
import CombinedReportPage from './CombinedReportPage';
import SajuReportPage from './SajuReportPage';
import ReportShell from './components/report/ReportShell';
import { StatusPanel } from './components/report/ReportPrimitives';
import { SHARE_QUERY_KEY, parseShareEntryUserInfoToken } from './share-entry-user-info';
import { useNavigate } from 'react-router-dom';
import { getFrontRuntimeConfig } from './lib/runtime';

const ENTRY_STORAGE_KEY = 'namespring_entry_user_info';
const PAGE_VALUES = ['entry', 'home', 'report', 'saju-report', 'naming-candidates', 'combined-report'];
const DEFAULT_BIRTH_REGION_LABEL = '서울';

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
    useYajasiAdjustment: Boolean(value.useYajasiAdjustment),
    useTrueSolarTimeAdjustment: Boolean(value.useTrueSolarTimeAdjustment),
    useBirthLongitudeAdjustment: value.useBirthLongitudeAdjustment !== false,
    birthLongitudeOption: String(value.birthLongitudeOption ?? DEFAULT_BIRTH_REGION_LABEL).trim() || DEFAULT_BIRTH_REGION_LABEL,
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
  // Share links land on the combined report — it carries the full naming
  // evaluation now, so the standalone naming report is no longer the target.
  const sharedEntryUserInfo = loadSharedEntryUserInfo();
  if (sharedEntryUserInfo) {
    const givenName = toSpringNameChars(sharedEntryUserInfo.firstName);
    if (givenName.length) {
      return {
        entryUserInfo: sharedEntryUserInfo,
        page: 'combined-report',
        selectedCandidateSummary: {
          givenName,
          fullHangul: `${sharedEntryUserInfo.lastNameText}${sharedEntryUserInfo.firstNameText}`,
          fullHanja: [...sharedEntryUserInfo.lastName, ...sharedEntryUserInfo.firstName]
            .map((entry) => String(entry?.hanja ?? ''))
            .join(''),
        },
      };
    }
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

function scrollAppToTop() {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.documentElement?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  document.body?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  document.getElementById('root')?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
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

function toOptionalText(...values) {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return undefined;
}

function toOptionalNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim().length === 0) continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function readBirthGeoOverridesFromQuery() {
  if (typeof window === 'undefined') return {};
  const query = new URLSearchParams(window.location.search);
  return {
    region: toOptionalText(query.get('region'), query.get('birthRegion')),
    city: toOptionalText(query.get('city'), query.get('birthCity')),
    birthPlace: toOptionalText(
      query.get('birthPlace'),
      query.get('birthLocation'),
      query.get('location'),
      query.get('place'),
    ),
    latitude: toOptionalNumber(query.get('latitude'), query.get('lat')),
    longitude: toOptionalNumber(query.get('longitude'), query.get('lng'), query.get('lon')),
    timezone: toOptionalText(query.get('timezone'), query.get('tz')),
  };
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

  const rawHour = Number(normalized.birthDateTime.hour);
  const rawMinute = Number(normalized.birthDateTime.minute);
  const hasKnownBirthTime = !normalized.isBirthTimeUnknown
    && Number.isInteger(rawHour)
    && Number.isInteger(rawMinute)
    && rawHour >= 0
    && rawHour <= 23
    && rawMinute >= 0
    && rawMinute <= 59;
  const useYajasiAdjustment = Boolean(normalized.useYajasiAdjustment);
  const useTrueSolarTimeAdjustment = Boolean(normalized.useTrueSolarTimeAdjustment);
  const useBirthLongitudeAdjustment = normalized.useBirthLongitudeAdjustment !== false;
  const selectedBirthRegion = useBirthLongitudeAdjustment
    ? toOptionalText(normalized.birthLongitudeOption)
    : undefined;
  const queryGeo = readBirthGeoOverridesFromQuery();
  const region = toOptionalText(
    queryGeo.region,
    selectedBirthRegion,
    normalized.region,
    normalized.birthRegion,
    normalized.regionName,
    normalized.province,
    normalized.sido,
  );
  const city = toOptionalText(
    queryGeo.city,
    normalized.city,
    normalized.birthCity,
    normalized.cityName,
    normalized.sigungu,
  );
  const birthPlace = toOptionalText(
    queryGeo.birthPlace,
    selectedBirthRegion,
    normalized.birthPlace,
    normalized.birthLocation,
    normalized.location,
    normalized.place,
    normalized.address,
  );
  const latitude = toOptionalNumber(
    queryGeo.latitude,
    normalized.latitude,
    normalized.birthLatitude,
    normalized.lat,
  );
  const longitude = toOptionalNumber(
    queryGeo.longitude,
    normalized.longitude,
    normalized.birthLongitude,
    normalized.lng,
    normalized.lon,
  );
  const timezone = toOptionalText(
    queryGeo.timezone,
    normalized.timezone,
    normalized.birthTimezone,
  );
  const sajuTimePolicy = hasKnownBirthTime
    ? {
      trueSolarTime: useTrueSolarTimeAdjustment ? 'on' : 'off',
      longitudeCorrection: useBirthLongitudeAdjustment ? 'on' : 'off',
      yaza: useYajasiAdjustment ? 'on' : 'off',
    }
    : undefined;

  return {
    birth: {
      year: normalized.birthDateTime.year,
      month: normalized.birthDateTime.month,
      day: normalized.birthDateTime.day,
      hour: hasKnownBirthTime ? rawHour : null,
      minute: hasKnownBirthTime ? rawMinute : null,
      gender: normalized.gender,
      calendarType: normalized.isSolarCalendar === false ? 'lunar' : 'solar',
      region,
      city,
      birthPlace,
      latitude,
      longitude,
      timezone,
    },
    surname,
    givenNameLength,
    mode: 'recommend',
    options: sajuTimePolicy ? { sajuTimePolicy } : undefined,
  };
}

function toFortuneReportRequest(userInfo, givenName) {
  const base = toSpringRequest(userInfo);
  const normalizedGivenName = (givenName || [])
    .map((item) => ({
      hangul: String(item?.hangul ?? ''),
      hanja: item?.hanja ? String(item.hanja) : undefined,
    }))
    .filter((item) => item.hangul.length > 0);

  return {
    birth: base.birth,
    surname: base.surname,
    givenName: normalizedGivenName,
    options: {
      ...(base.options || {}),
      precisionConfig: {
        ...(base.options?.precisionConfig || {}),
        surfaceTieredMatrix: true,
        // 전문 인사이트 원자료(신살·공망·합충형파해 등) — 해석 파일이 채워진
        // fact만 렌더되므로 충전 전에는 화면 변화 없음 (성인 대상자 전용).
        surfaceInsightFacts: true,
        // 총평 요약에 plainText/expertText 쌍을 함께 실어 v2의
        // 평문/전문가 티어가 실제 엔진 서사를 쓰도록 한다.
        narrativeStyle: 'sideBySide',
      },
    },
  };
}

function toEvaluateSpringRequest(userInfo, givenNameOverride) {
  const normalized = normalizeEntryUserInfo(userInfo);
  if (!normalized) {
    throw new Error('입력 정보가 없습니다.');
  }

  const givenName = givenNameOverride?.length
    ? givenNameOverride
      .map((item) => ({
        hangul: String(item?.hangul ?? ''),
        hanja: String(item?.hanja ?? ''),
      }))
      .filter((item) => item.hangul.length > 0)
    : toSpringNameChars(normalized.firstName);
  if (!givenName.length) {
    throw new Error('이름을 찾을 수 없습니다.');
  }

  return {
    ...toSpringRequest(normalized),
    givenName,
    mode: 'evaluate',
  };
}

function toCurrentNameSpringReportRequest(userInfo) {
  return toEvaluateSpringRequest(userInfo);
}

function toRequestCacheKey(request) {
  return JSON.stringify(request);
}

function buildAbsoluteSupportUrl(paymentAppOrigin) {
  if (!paymentAppOrigin) {
    return null;
  }
  return new URL('/support', `${paymentAppOrigin.replace(/\/+$/g, '')}/`).toString();
}

function App() {
  const tool = new URLSearchParams(window.location.search).get("tool");
  const isDevSagyeoksuViewerMode = import.meta.env.DEV && tool === "fourframe-db-viewer";
  const isDevHanjaViewerMode = import.meta.env.DEV && tool === "hanja-db-viewer";
  const isDevNameStatViewerMode = import.meta.env.DEV && tool === "name-stat-db-viewer";
  const navigate = useNavigate();
  const runtimeConfig = useMemo(() => getFrontRuntimeConfig(), []);
  const initialAppState = useMemo(() => loadInitialAppState(), []);

  const [isDbReady, setIsDbReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [entryUserInfo, setEntryUserInfo] = useState(initialAppState.entryUserInfo);
  const [selectedCandidateSummary, setSelectedCandidateSummary] = useState(
    initialAppState.selectedCandidateSummary ?? null,
  );
  const [page, setPage] = useState(initialAppState.page);
  const hanjaRepo = useMemo(() => new HanjaRepository(), []);
  const springEngine = useMemo(() => new SpringEngine(), []);
  const recommendResultCacheRef = useRef(new Map());
  const currentNameReportCacheRef = useRef(new Map());

  useLayoutEffect(() => {
    scrollAppToTop();
    const frame = window.requestAnimationFrame(scrollAppToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [page]);

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
    const fortuneRequest = toFortuneReportRequest(userInfo, candidate?.givenName);
    if (!fortuneRequest.givenName?.length) {
      throw new Error('선택한 후보 이름 정보가 없습니다.');
    }
    return springEngine.getFortuneReport(fortuneRequest);
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

  const handleLoadSpringReportForCandidateAsync = useCallback(async (userInfo, givenName) => {
    const springRequest = toEvaluateSpringRequest(userInfo, givenName);
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

  // Fortune report for the user's own name — feeds the life-flow and period
  // sections on the saju page (moved there from the legacy combined report).
  const handleLoadOwnFortuneReportAsync = useCallback(async (userInfo) => {
    const normalized = normalizeEntryUserInfo(userInfo);
    const givenName = toSpringNameChars(normalized?.firstName);
    if (!givenName.length) return null;
    return springEngine.getFortuneReport(toFortuneReportRequest(normalized, givenName));
  }, [springEngine]);

  const handleOpenCombinedReportFromHome = useCallback(() => {
    const normalized = normalizeEntryUserInfo(entryUserInfo);
    if (!normalized) {
      navigateToPage('entry', { hasEntryUserInfo: false });
      return;
    }

    const givenName = toSpringNameChars(normalized.firstName);
    if (!givenName.length) {
      navigateToPage('entry', { hasEntryUserInfo: true });
      return;
    }

    setSelectedCandidateSummary({
      givenName,
      fullHangul: `${normalized.lastNameText}${normalized.firstNameText}`,
      fullHanja: `${normalized.lastName.map((v) => String(v?.hanja ?? '')).join('')}${normalized.firstName.map((v) => String(v?.hanja ?? '')).join('')}`,
    });
    navigateToPage('combined-report');
  }, [entryUserInfo]);

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

  const openSupportPage = () => {
    const externalSupportUrl = buildAbsoluteSupportUrl(runtimeConfig.paymentAppOrigin);
    if (externalSupportUrl) {
      const externalOrigin = new URL(externalSupportUrl).origin;
      if (externalOrigin !== window.location.origin) {
        window.location.assign(externalSupportUrl);
        return;
      }
    }
    navigate('/support');
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
            <ReportShell size="narrow" showNav={false}>
              <StatusPanel tone="neutral" title="분석 엔진을 준비하고 있습니다.">
                Loading engine...
              </StatusPanel>
            </ReportShell>
          </AppBackground>
        ),
      };
    }

    if (page === 'entry') {
      return {
        key: 'entry',
        node: (
          <AppBackground>
            <ReportShell size="narrow" showNav={false}>
              <EntryFunnel
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
            </ReportShell>
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
              onLoadSajuReport={handleLoadSajuReportAsync}
              onOpenCombinedReport={handleOpenCombinedReportFromHome}
              onOpenNamingCandidates={() => navigateToPage('naming-candidates')}
              onOpenSupport={openSupportPage}
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
              onLoadSpringReport={handleLoadSpringReportForCandidateAsync}
              onBackHome={() => navigateToPage('home')}
              onBackCandidates={() => navigateToPage('naming-candidates')}
              onOpenNamingReport={() => navigateToPage('report')}
              onOpenSajuReport={() => navigateToPage('saju-report')}
              onOpenPremium={openSupportPage}
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
              onLoadFortuneReport={handleLoadOwnFortuneReportAsync}
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
