import React, { useEffect, useRef } from 'react';
import { cx } from '../report/ReportPrimitives.jsx';

export function RevealOnScroll({ as: Tag = 'div', className, children, ...rest }) {
  const nodeRef = useRef(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('in');
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={nodeRef} className={cx('ns-reveal', className)} {...rest}>
      {children}
    </Tag>
  );
}
