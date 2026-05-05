import { renderFragment } from '../../src/report/tiered/template-engine.js';
import fs from 'node:fs';

const json = JSON.parse(fs.readFileSync('./data/narrative/academic/today/expert.fragments.json', 'utf-8'));
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
for (const frag of json.fragments.slice(0, 2)) {
  const r = renderFragment(frag, ctx);
  console.log('=', frag.fragmentId, 'len:', r.plainText.length);
  console.log(r.plainText);
  console.log('---');
}
