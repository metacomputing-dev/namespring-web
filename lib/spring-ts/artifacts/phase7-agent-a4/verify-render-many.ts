import { renderFragment } from '../../src/report/tiered/template-engine.js';
import fs from 'node:fs';

// Sample multiple categories to ensure rendered output reads cohesively.
const samples = [
  { file: './data/narrative/academic/today/expert.fragments.json', n: 1 },
  { file: './data/narrative/career/thisYear/expert.fragments.json', n: 1 },
  { file: './data/narrative/wealth/life/expert.fragments.json', n: 1 },
  { file: './data/narrative/family/today/expert.fragments.json', n: 1 },
  { file: './data/narrative/health/today/expert.fragments.json', n: 1 },
];

const ctx = {
  seedKey: 'test',
  periodLabel: '오늘',
  feature: {
    ageBand: '40-54',
    dayMasterElement: 'WATER',
    yongshinElement: 'WOOD',
    dayMasterStrength: 'BALANCED',
    yongshinAlignment: 'aligned',
    gyeokguk: null,
    gender: 'male',
    birthSeason: 'spring',
    currentSeason: 'spring',
    dayMasterPolarity: 'YIN',
    agePhase: 'late_30s',
    ageYears: 40,
    heeshinElement: null,
    gishinElement: null,
  } as any,
};

for (const { file, n } of samples) {
  const json = JSON.parse(fs.readFileSync(file, 'utf-8'));
  console.log('===========================================');
  console.log('FILE:', file);
  for (const frag of json.fragments.slice(0, n)) {
    const r = renderFragment(frag, ctx);
    console.log('Fragment:', frag.fragmentId, 'len:', r.plainText.length);
    console.log(r.plainText);
    console.log('---');
  }
}
