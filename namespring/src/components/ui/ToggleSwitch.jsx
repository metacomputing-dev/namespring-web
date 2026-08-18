import React from 'react';
import { cx } from '../report/ReportPrimitives.jsx';

export function ToggleSwitch({ checked, onChange, className, disabled = false, ...rest }) {
  return (
    <input
      type="checkbox"
      className={cx('ns-switch', className)}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.checked)}
      {...rest}
    />
  );
}
