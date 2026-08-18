import React from 'react';
import { cx } from './ReportPrimitives';
import { ELEMENT_HANJA } from '../../report/combined/element-relations.js';

export function YongshinMedallion({ element, className }) {
  if (!element) return null;
  return (
    <div
      className={cx('cr-v3-medallion', `cr-v3-el-${element}`, className)}
      role="img"
      aria-label={`용신 오행 ${ELEMENT_HANJA[element] || ''}`}
    >
      {ELEMENT_HANJA[element] || '—'}
    </div>
  );
}
