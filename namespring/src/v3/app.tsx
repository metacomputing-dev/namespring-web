import { Route, Routes, useNavigate } from 'react-router-dom';
import '../styles/tokens.css';
import './v3.css';
import { useThemeMode } from './theme';
import HomeScreen from './screens/HomeScreen';
import IntegratedScreen from './screens/IntegratedScreen';
import SajuScreen from './screens/SajuScreen';
import NamingScreen from './screens/NamingScreen';
import CandidatesScreen from './screens/CandidatesScreen';

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.4 14.2A8.5 8.5 0 0 1 9.8 3.6a8.5 8.5 0 1 0 10.6 10.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function SpringApp() {
  const navigate = useNavigate();
  const { isDark, toggle } = useThemeMode();

  return (
    <div className="v3-root">
      <header className="v3-masthead">
        <button type="button" className="v3-brand" onClick={() => navigate('/')}>
          <span className="v3-brand-mark" aria-hidden="true">
            ❀
          </span>
          이름봄
        </button>
        <div className="v3-masthead-actions">
          <button
            type="button"
            className="v3-icon-button"
            onClick={toggle}
            aria-label={isDark ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기'}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/reports/integrated" element={<IntegratedScreen />} />
        <Route path="/reports/saju" element={<SajuScreen />} />
        <Route path="/reports/naming" element={<NamingScreen />} />
        <Route path="/naming/candidates" element={<CandidatesScreen />} />
        <Route path="*" element={<HomeScreen />} />
      </Routes>
    </div>
  );
}
