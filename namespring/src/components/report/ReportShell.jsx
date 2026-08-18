import React from 'react';
import { withBasePath } from '../../lib/paths';
import logoSvg from '../../assets/logo.svg';
import { cx, EditIcon, HomeIcon } from './ReportPrimitives';
import { useThemeMode } from '../../theme/theme-mode';

function SunIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 2.4v2M10 15.6v2M2.4 10h2M15.6 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M15.4 4.6 14 6M6 14l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M16 11.4A6.4 6.4 0 0 1 8.6 4a6.4 6.4 0 1 0 7.4 7.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// NS-G: manual light/dark switch, sits beside the home action in the masthead.
function ThemeToggle() {
  const { theme, toggle } = useThemeMode();
  const isDark = theme === 'dark';
  const label = isDark ? '라이트 모드로 전환' : '다크 모드로 전환';
  return (
    <button
      type="button"
      className="ns-icon-button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      data-pdf-exclude="true"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

const NAV_ITEMS = [
  { key: 'preview', label: '사주 미리보기' },
  { key: 'naming', label: '작명하기' },
  { key: 'report', label: '보고서' },
  { key: 'support', label: '개발자에게 커피 한 잔' },
  { key: 'info', label: '이름봄 정보' },
];

function Wordmark({ onHome }) {
  const content = (
    <>
      <img src={logoSvg} alt="" className="ns-wordmark__logo" draggable="false" />
      <span>이름봄</span>
    </>
  );

  if (typeof onHome === 'function') {
    return (
      <button type="button" className="ns-wordmark" onClick={onHome} aria-label="홈으로">
        {content}
      </button>
    );
  }

  return (
    <a className="ns-wordmark" href={withBasePath('/')} aria-label="이름봄 홈">
      {content}
    </a>
  );
}

function HeaderAction({ action }) {
  if (!action) return null;
  const Component = action.href ? 'a' : 'button';
  return (
    <Component
      type={action.href ? undefined : 'button'}
      href={action.href}
      onClick={action.onClick}
      className={action.iconOnly ? 'ns-icon-button' : 'ns-quiet-button'}
      aria-label={action.ariaLabel || action.label}
      title={action.ariaLabel || action.label}
    >
      {action.icon || null}
      {!action.iconOnly ? <span>{action.label}</span> : null}
    </Component>
  );
}

export default function ReportShell({
  children,
  activeNav = '',
  onHome,
  onEdit,
  homeLabel = '홈으로',
  editLabel = '정보 수정',
  actions = [],
  size = 'default',
  className = '',
  contentClassName = '',
  showNav = false,
}) {
  const sizeClass = size === 'narrow'
    ? 'ns-page-main--narrow'
    : size === 'reader'
      ? 'ns-page-main--reader'
      : size === 'wide'
        ? 'ns-page-main--wide'
        : '';
  const resolvedActions = [
    onHome ? {
      label: homeLabel,
      icon: <HomeIcon />,
      iconOnly: true,
      onClick: onHome,
      ariaLabel: homeLabel,
    } : null,
    onEdit ? {
      label: editLabel,
      icon: <EditIcon />,
      onClick: onEdit,
      ariaLabel: editLabel,
    } : null,
    ...actions,
  ].filter(Boolean);

  return (
    <div className={cx('ns-page-shell', className)}>
      <div className="ns-shell-frame">
        <header className="ns-masthead">
          <Wordmark onHome={onHome} />
          {showNav ? (
            <nav className="ns-masthead__nav" aria-label="주요 메뉴">
              {NAV_ITEMS.map((item) => (
                <span key={item.key} aria-current={activeNav === item.key ? 'page' : undefined}>
                  {item.label}
                </span>
              ))}
            </nav>
          ) : null}
          <div className="ns-masthead__actions">
            <ThemeToggle />
            {resolvedActions.map((action) => (
              <HeaderAction key={action.label} action={action} />
            ))}
          </div>
        </header>
        <main className={cx('ns-page-main', sizeClass, contentClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
}
