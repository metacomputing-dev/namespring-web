import React, { useEffect, useState } from 'react';
import { cx } from './ReportPrimitives';

export function AnchorRail({ items = [], className }) {
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !items.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    const observed = items
      .map((item) => document.getElementById(item.id))
      .filter(Boolean);
    observed.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [items]);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!items.length) return null;

  return (
    <nav
      className={cx('ns-anchor-rail cr-v3-rail', className)}
      aria-label="보고서 섹션 이동"
      data-pdf-exclude="true"
    >
      <div className="ns-glass ns-anchor-rail__track">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="ns-anchor-rail__chip"
            aria-current={activeId === item.id ? 'true' : undefined}
            onClick={() => scrollToSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
