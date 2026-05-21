import type { ReactNode } from 'react';

type MenuIconProps = {
  className?: string;
  locked?: boolean;
};

function LeafMark() {
  return (
    <path
      d="M39.7 24.2c-7.7.3-9.4 3.7-11.5 7-1.8 2.8-3.1 5.5-6.5 6.8-1.2.5-2.4 1.6-3 3.2-.3.9.3 1.5 1.2 1.2 1.7-.5 2.8-1.6 3.5-2.8 2.4-3.3 5.2-4.1 8-3.1 3.7 1.3 7.2.6 10.2-1.7 4.1-3.2 5.4-8.7 4.2-13.8-1.8 1.5-3.7 2.8-6.1 3.2z"
      fill="var(--color-menu-icon-mark)"
    />
  );
}

function LockOverlay() {
  return (
    <g className="ib-menu-icon__lock">
      <rect x="41" y="41" width="13" height="11" rx="3" fill="var(--color-menu-icon-lock-bg)" />
      <path
        d="M44.2 41v-2.1a3.2 3.2 0 0 1 6.4 0V41"
        fill="none"
        stroke="var(--color-menu-icon-lock-mark)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M47.5 45.2v2.1"
        stroke="var(--color-menu-icon-lock-mark)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

function MenuIconFrame({
  children,
  className = '',
  locked = false,
}: MenuIconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`ib-menu-icon ${locked ? 'ib-menu-icon--locked' : ''} ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="7"
        y="7"
        width="50"
        height="50"
        rx="17"
        fill="var(--color-menu-icon-bg)"
        stroke="var(--color-menu-icon-border)"
        strokeWidth="1.4"
        transform="rotate(5 32 32)"
      />
      {children}
      {locked ? <LockOverlay /> : null}
    </svg>
  );
}

export function MenuReportIcon(props: MenuIconProps) {
  return (
    <MenuIconFrame {...props}>
      <g
        fill="none"
        stroke="var(--color-menu-icon-mark)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 18h14.5L44 25.5V46H22V18Z" />
        <path d="M36.5 18v7.5H44" />
        <path d="M27 31h9" />
        <path d="M27 37h6" />
      </g>
      <g transform="translate(5 3) scale(0.78)">
        <LeafMark />
      </g>
    </MenuIconFrame>
  );
}

export function MenuNamingIcon(props: MenuIconProps) {
  return (
    <MenuIconFrame {...props}>
      <g
        fill="none"
        stroke="var(--color-menu-icon-mark)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 43l6.2-1.5L43.5 25.2l-4.7-4.7L22.5 36.8 21 43Z" />
        <path d="M36.7 22.6l4.7 4.7" />
        <path d="M25.2 36.3l2.5 2.5" />
      </g>
      <g transform="translate(10 8) scale(0.64)">
        <LeafMark />
      </g>
    </MenuIconFrame>
  );
}

export function MenuCoffeeIcon(props: MenuIconProps) {
  return (
    <MenuIconFrame {...props}>
      <g
        fill="none"
        stroke="var(--color-menu-icon-mark)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.5 28.5h24v8.2A10.2 10.2 0 0 1 34.3 47H30.7a10.2 10.2 0 0 1-10.2-10.3v-8.2Z" />
        <path d="M44.5 31.2H48a4.6 4.6 0 0 1 0 9.2h-3.5" />
        <path d="M25 49h17" />
        <path d="M27 20.8c-1.5 1.3-1.5 2.8 0 4.1" />
        <path d="M34 20.8c-1.5 1.3-1.5 2.8 0 4.1" />
      </g>
      <g transform="translate(7 8) scale(0.58)">
        <LeafMark />
      </g>
    </MenuIconFrame>
  );
}

export function MenuInfoIcon(props: MenuIconProps) {
  return (
    <MenuIconFrame {...props}>
      <g
        fill="none"
        stroke="var(--color-menu-icon-mark)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 19h16.5a5.5 5.5 0 0 1 5.5 5.5V45H25.5A4.5 4.5 0 0 1 21 40.5V19Z" />
        <path d="M25.5 45A4.5 4.5 0 0 1 21 40.5V23.5A4.5 4.5 0 0 1 25.5 19" />
        <path d="M28 29h8" />
        <path d="M28 35h6" />
      </g>
      <g transform="translate(9 7) scale(0.58)">
        <LeafMark />
      </g>
    </MenuIconFrame>
  );
}
