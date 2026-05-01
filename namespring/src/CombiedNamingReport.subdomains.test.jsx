import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CategorySubDomainBreakdown } from './CombiedNamingReport.jsx';

describe('CategorySubDomainBreakdown', () => {
  it('renders up to three sub-domain rows with title, stars, and narrative', () => {
    const html = renderToStaticMarkup(
      <CategorySubDomainBreakdown
        subDomains={[
          {
            name: 'career',
            title: 'Career flow',
            stars: 4,
            narrative: 'Role selection and long-term expansion have support.',
          },
          {
            name: 'movement',
            title: 'Movement',
            stars: 2,
            narrative: 'Keep travel and relocation plans narrow.',
          },
          {
            name: 'study_document',
            title: 'Study documents',
            stars: 5,
            narrative: 'Organization and records are strong signals.',
          },
          {
            name: 'extra',
            title: 'Fourth row',
            stars: 3,
            narrative: 'This row should not render.',
          },
        ]}
      />
    );

    expect(html).toContain('Career flow');
    expect(html).toContain('4.0 / 5');
    expect(html).toContain('Movement');
    expect(html).toContain('2.0 / 5');
    expect(html).toContain('Study documents');
    expect(html).toContain('Organization and records are strong signals.');
    expect(html).not.toContain('Fourth row');
    expect(html).toMatchSnapshot();
  });

  it('renders nothing for legacy cards without subDomains', () => {
    expect(renderToStaticMarkup(<CategorySubDomainBreakdown />)).toBe('');
    expect(renderToStaticMarkup(<CategorySubDomainBreakdown subDomains={[]} />)).toBe('');
  });
});
