import React, { useState, useEffect, useRef } from 'react';
import { SpringEngine } from "@spring/index";
import DevDbViewer from './DevDbViewer';
import DevHanjaDbViewer from './DevHanjaDbViewer';
import DevNameStatDbViewer from './DevNameStatDbViewer';
import SplashScreen from './SplashScreen';
import FadeTransition from './FadeTransition';
import AppBackground from './ui/AppBackground';
import HomePage from './HomePage';
import ReportPage from './ReportPage';
import InputForm from './InputForm';

/** Convert InputForm userInfo → SpringRequest */
function toSpringRequest(userInfo) {
  const { lastName, firstName, birthDateTime, gender } = userInfo;
  return {
    birth: {
      year: birthDateTime.year,
      month: birthDateTime.month,
      day: birthDateTime.day,
      hour: birthDateTime.hour,
      minute: birthDateTime.minute,
      gender: gender === '남' ? 'male' : 'female',
    },
    surname: lastName.map((entry) => ({ hangul: entry.hangul, hanja: entry.hanja })),
    givenName: firstName.map((entry) => ({ hangul: entry.hangul, hanja: entry.hanja })),
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
  const [page, setPage] = useState('entry');
  const [entryUserInfo, setEntryUserInfo] = useState(() => {
    try {
      const raw = sessionStorage.getItem('namespring_entry_user_info');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const engineRef = useRef(null);

  // Engine Initialization
  useEffect(() => {
    const engine = new SpringEngine();
    engine.init().then(() => {
      engineRef.current = engine;
      setIsDbReady(true);
    });
  }, []);

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

  const handleAnalyze = async (userInfo) => {
    const request = toSpringRequest(userInfo);
    return engineRef.current.getNamingReport(request);
  };

  const handleAnalyzeAsync = async (userInfo) => {
    const request = toSpringRequest(userInfo);
    return engineRef.current.getNamingReport(request);
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
                  hanjaRepo={engineRef.current?.getHanjaRepository()}
                  isDbReady={isDbReady}
                  onEnter={(userInfo) => {
                    setEntryUserInfo(userInfo);
                    try {
                      sessionStorage.setItem('namespring_entry_user_info', JSON.stringify(userInfo));
                    } catch {}
                    setPage('home');
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
              onOpenReport={() => setPage('report')}
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
            hanjaRepo={engineRef.current?.getHanjaRepository()}
            isDbReady={isDbReady}
            onAnalyze={handleAnalyze}
            initialUserInfo={entryUserInfo}
            onBackHome={() => setPage('home')}
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
