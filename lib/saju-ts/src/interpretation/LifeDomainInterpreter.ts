import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import type { DomainReading } from './LifeDomainShared.js';
import { careerDomain } from './LifeDomainCareerSection.js';
import { healthDomain } from './LifeDomainHealthSection.js';
import { loveDomain } from './LifeDomainLoveSection.js';
import { wealthDomain } from './LifeDomainWealthSection.js';

export type { DomainReading } from './LifeDomainShared.js';

export function interpretLifeDomains(analysis: SajuAnalysis): DomainReading[] {
  return [
    wealthDomain(analysis),
    careerDomain(analysis),
    healthDomain(analysis),
    loveDomain(analysis),
  ];
}

