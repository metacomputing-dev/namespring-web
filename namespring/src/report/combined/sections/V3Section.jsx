import React from 'react';
import { cx } from '../../../components/report/ReportPrimitives';
import { RevealOnScroll } from '../../../components/ui/RevealOnScroll.jsx';

export function V3Section({ id, kicker, title, dek, className, children }) {
  return (
    <RevealOnScroll as="section" id={id} className={cx('cr-v3-section', className)}>
      {kicker ? <p className="cr-v3-kicker">{kicker}</p> : null}
      {title ? <h2 className="cr-v3-section__title">{title}</h2> : null}
      {dek ? <p className="cr-v3-section__dek">{dek}</p> : null}
      {children}
    </RevealOnScroll>
  );
}
