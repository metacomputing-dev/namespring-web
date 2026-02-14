import React, { useState, useEffect, useMemo } from 'react';
import { SeedTs } from "@seed/seed";
import { HanjaRepository } from '@seed/database/hanja-repository';
import InputForm from './InputForm';
import NamingReport from './NamingReport';

function App() {
  const [isDbReady, setIsDbReady] = useState(false);
  const hanjaRepo = useMemo(() => new HanjaRepository(), []);

  const [analysisResult, setAnalysisResult] = useState(null);

  // DB Initialization
  useEffect(() => {
    hanjaRepo.init().then(() => setIsDbReady(true));
  }, [hanjaRepo]);

  const handleAnalyze = (userInfo) => {
    const engine = new SeedTs();
    const result = engine.analyze(userInfo);
    setAnalysisResult(result);
  };

  if (!isDbReady) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
      <div className="text-center animate-pulse">
        <div className="w-16 h-16 bg-indigo-600 rounded-full mb-4 mx-auto shadow-xl"></div>
        <p className="text-slate-400 font-black tracking-widest text-[10px] uppercase">Loading Engine...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 font-sans">
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-black text-indigo-600 mb-2">이름봄</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Professional Naming Analysis</p>
        </header>

        {!analysisResult && <InputForm hanjaRepo={hanjaRepo} isDbReady={isDbReady} onAnalyze={handleAnalyze} />}
        {analysisResult && <NamingReport result={analysisResult.candidates[0]} onNewAnalysis={() => setAnalysisResult(null)} />}
      </div>
    </div>
  );
}

export default App;
