import React from 'react';
import { cx } from '../report/ReportPrimitives.jsx';

export function StepProgress({ total, current, className, label }) {
  return (
    <ol
      className={cx('ns-step-dots', className)}
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
    >
      {Array.from({ length: total }, (_, index) => (
        <li
          key={index}
          className={cx('ns-step-dots__dot', index < current && 'ns-step-dots__dot--done')}
        />
      ))}
    </ol>
  );
}
