import React, { useState, useEffect, useMemo } from 'react';
import { SeedTs } from "@seed/seed";
import { HanjaRepository } from '@seed/database/hanja-repository';
import DevDbViewer from './DevDbViewer';
import DevHanjaDbViewer from './DevHanjaDbViewer';
import DevNameStatDbViewer from './DevNameStatDbViewer';
import SplashScreen from './SplashScreen';
import FadeTransition from './FadeTransition';
import AppBackground from './ui/AppBackground';
import HomePage from './HomePage';
import ReportPage from './ReportPage';
import InputForm from './InputForm';

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
  const hanjaRepo = useMemo(() => new HanjaRepository(), []);

  // DB Initialization
  useEffect(() => {
    hanjaRepo.init().then(() => setIsDbReady(true));
  }, [hanjaRepo]);

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
    return engine.analyze(userInfo);
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
                  <h1 className="text-3xl font-black text-[var(--ns-accent-text)]">입장 정보</h1>
                  <p className="text-[var(--ns-muted)] text-sm font-semibold">입력을 마치면 홈으로 이동해요.</p>
                </header>
                <InputForm
                  hanjaRepo={hanjaRepo}
                  isDbReady={isDbReady}
                  onEnter={(userInfo) => {
                    setEntryUserInfo(userInfo);
                    try {
                      sessionStorage.setItem('namespring_entry_user_info', JSON.stringify(userInfo));
                    } catch {}
                    setPage('home');
                  }}
                  submitLabel="입장하기"
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
            <HomePage onOpenReport={() => setPage('report')} />
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
