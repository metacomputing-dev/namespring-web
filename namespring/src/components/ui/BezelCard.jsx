import React from 'react';
import { cx } from '../report/ReportPrimitives.jsx';

export function BezelCard({ as: Tag = 'div', invert = false, className, faceClassName, children, ...rest }) {
  return (
    <Tag
      className={cx('ns-bezel-card', invert && 'ns-bezel-card--invert', className)}
      {...rest}
    >
      <div className={cx('ns-bezel-card__face', faceClassName)}>{children}</div>
    </Tag>
  );
}
