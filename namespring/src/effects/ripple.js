// NS-F: one shared click/touch ripple for every selectable view.
// A single delegated pointerdown listener spawns the ripple ink on any element
// carrying the `ns-ripple` class, so components opt in with just a class name.
import { useEffect } from 'react';

const RIPPLE_SELECTOR = '.ns-ripple';
const RIPPLE_CLEANUP_MS = 700;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function isInteractive(target) {
  return !(
    target.hasAttribute('disabled')
    || target.getAttribute('aria-disabled') === 'true'
    || target.dataset.rippleOff === 'true'
  );
}

function spawnRipple(target, clientX, clientY) {
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const size = Math.max(rect.width, rect.height);
  // Keyboard-driven clicks report (0, 0); fall back to the element centre.
  const originX = clientX || rect.left + rect.width / 2;
  const originY = clientY || rect.top + rect.height / 2;

  const ink = document.createElement('span');
  ink.className = 'ns-ripple__ink';
  ink.style.width = `${size}px`;
  ink.style.height = `${size}px`;
  ink.style.left = `${originX - rect.left - size / 2}px`;
  ink.style.top = `${originY - rect.top - size / 2}px`;

  const remove = () => ink.remove();
  ink.addEventListener('animationend', remove);
  window.setTimeout(remove, RIPPLE_CLEANUP_MS);
  target.appendChild(ink);
}

export function useGlobalRipple() {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const onPointerDown = (event) => {
      if (event.button != null && event.button > 0) return; // primary button / touch only
      if (prefersReducedMotion()) return;
      const target = typeof event.target?.closest === 'function'
        ? event.target.closest(RIPPLE_SELECTOR)
        : null;
      if (!target || !isInteractive(target)) return;
      spawnRipple(target, event.clientX, event.clientY);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);
}
