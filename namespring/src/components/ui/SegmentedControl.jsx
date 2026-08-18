import React, { useId } from 'react';
import { cx } from '../report/ReportPrimitives.jsx';

export function SegmentedControl({ name, value, options, onChange, className, disabled = false }) {
  const groupId = useId();
  const groupName = name || groupId;
  return (
    <div className={cx('ns-seg', className)} role="radiogroup">
      {options.map((option) => {
        const inputId = `${groupName}-${option.value}`;
        return (
          <React.Fragment key={option.value}>
            <input
              id={inputId}
              className="ns-seg__input"
              type="radio"
              name={groupName}
              value={option.value}
              checked={value === option.value}
              disabled={disabled || option.disabled}
              onChange={() => onChange?.(option.value)}
            />
            <label className="ns-seg__label" htmlFor={inputId}>
              {option.label}
            </label>
          </React.Fragment>
        );
      })}
    </div>
  );
}
