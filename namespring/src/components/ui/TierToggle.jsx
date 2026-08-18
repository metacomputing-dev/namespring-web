import React, { createContext, useContext, useMemo, useState } from 'react';
import { SegmentedControl } from './SegmentedControl.jsx';

const TierContext = createContext({ tier: 'plain', setTier: () => {} });

export function TierProvider({ initialTier = 'plain', children }) {
  const [tier, setTier] = useState(initialTier);
  const value = useMemo(() => ({ tier, setTier }), [tier]);
  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
}

export function useTier() {
  return useContext(TierContext);
}

const TIER_OPTIONS = [
  { value: 'plain', label: '평문' },
  { value: 'expert', label: '전문가' },
];

export function TierToggle({ className }) {
  const { tier, setTier } = useTier();
  return (
    <SegmentedControl
      className={className}
      name="report-tier"
      value={tier}
      options={TIER_OPTIONS}
      onChange={setTier}
    />
  );
}

export function TierText({ plain, expert, as: Tag = 'span', className }) {
  return (
    <>
      <Tag className={`tier-plain ${className || ''}`.trim()}>{plain}</Tag>
      {expert != null ? <Tag className={`tier-expert ${className || ''}`.trim()}>{expert}</Tag> : null}
    </>
  );
}

export function ExpertOnly({ children }) {
  const { tier } = useTier();
  if (tier !== 'expert') return null;
  return children;
}
