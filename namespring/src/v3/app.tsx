import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import '../styles/tokens.css';
import './v3.css';
import logoSvg from '../assets/logo.svg';
import { useThemeMode } from './theme';
import { TermsProvider } from './ui/primitives';
import HomeScreen from './screens/HomeScreen';
import IntegratedScreen from './screens/IntegratedScreen';
import SajuScreen from './screens/SajuScreen';
import NamingScreen from './screens/NamingScreen';
import CandidatesScreen from './screens/CandidatesScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import AccountScreen from './screens/AccountScreen';

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

interface NavItem {
  path: string | null;
  label: string;
  icon: JSX.Element;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/',
    label: '처음',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 11.2 12 4l8 7.2M6 9.8V20h12V9.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/reports/integrated',
    label: '통합',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9.4" cy="12" r="5.4" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="14.6" cy="12" r="5.4" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    path: '/reports/saju',
    label: '사주',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3.4v3.2M12 17.4v3.2M3.4 12h3.2M17.4 12h3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    path: '/reports/naming',
    label: '이름',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 4.6h9.2L18 8v11.4H6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 12h6M9 15.4h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: '/naming/candidates',
    label: '작명',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m14.4 5 4.6 4.6L8.6 20H4v-4.6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m12.6 6.8 4.6 4.6" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    path: null,
    label: '궁합',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 19.6C7.2 16.4 4 13.4 4 9.9 4 7.4 6 5.6 8.3 5.6c1.5 0 2.9.8 3.7 2 .8-1.2 2.2-2 3.7-2C18 5.6 20 7.4 20 9.9c0 3.5-3.2 6.5-8 9.7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/favorites',
    label: '보관',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4.6h10v14.8l-5-3.2-5 3.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/account',
    label: '계정',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8.6" r="3.6" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4.8 19.4c1.4-3 4-4.6 7.2-4.6s5.8 1.6 7.2 4.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: null,
    label: '정보',
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 10.8v5M12 7.6v.4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
];

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav className="v3-bottom-nav" aria-label="주요 화면">
      {NAV_ITEMS.map(item => {
        if (item.path === null) {
          return (
            <button
              key={item.label}
              type="button"
              className="v3-bottom-nav-item v3-bottom-nav-item--soon"
              aria-disabled="true"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        }
        const active =
          item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
        return (
          <button
            key={item.path}
            type="button"
            className="v3-bottom-nav-item"
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(item.path!)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default function SpringApp() {
  const navigate = useNavigate();
  const { isDark, toggle } = useThemeMode();

  return (
    <div className="v3-root">
      <header className="v3-masthead">
        <button type="button" className="v3-brand" onClick={() => navigate('/')}>
          <img src={logoSvg} alt="" className="v3-brand-leaf" draggable={false} />
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
      <TermsProvider>
        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/reports/integrated" element={<IntegratedScreen />} />
          <Route path="/reports/saju" element={<SajuScreen />} />
          <Route path="/reports/naming" element={<NamingScreen />} />
          <Route path="/naming/candidates" element={<CandidatesScreen />} />
          <Route path="/favorites" element={<FavoritesScreen />} />
          <Route path="/account" element={<AccountScreen />} />
          <Route path="*" element={<HomeScreen />} />
        </Routes>
      </TermsProvider>
      <BottomNav />
    </div>
  );
}
