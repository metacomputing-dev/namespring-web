#!/usr/bin/env node
/**
 * artifacts/phase5-prose-audit/extract-prose.mjs
 *
 * P5-A5 Task 2 helper: walks all 22 fixture JSONs in
 * artifacts/sample-outputs-2026-05-05-phase3/ and extracts every prose
 * string that ends up in front of an end-user, with a path that lets us
 * jump back to the source fragment for fixes.
 *
 * Output: phase5-prose-audit/prose-flat.ndjson
 *   - one line per prose unit
 *   - { fixture, period, category, depth, slot, fragmentId, text }
 *
 * Usage:  node artifacts/phase5-prose-audit/extract-prose.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(__dirname, '../sample-outputs-2026-05-05-phase3');
const OUT_PATH = path.join(__dirname, 'prose-flat.ndjson');

const TIER_FIXTURE_FILES = fs
  .readdirSync(SAMPLES_DIR)
  .filter((f) => /^\d{2}-.+\.json$/.test(f) && f !== 'index.json')
  .sort();

const out = [];
for (const file of TIER_FIXTURE_FILES) {
  const raw = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), 'utf-8'));
  const fixtureId = raw.sampleId || file;
  const payload = raw.payload || {};

  // Legacy fields (NameSpring-visible, present on every fortune fixture)
  pushLegacy(out, fixtureId, file, payload);

  const tieredMatrix = payload.tieredMatrix;
  if (!tieredMatrix?.periods) continue;
  for (const [period, periodVal] of Object.entries(tieredMatrix.periods)) {
    const overall = periodVal.overall;
    if (overall) {
      collectCell(out, fixtureId, file, period, '__overall', overall);
    }
    const byCat = periodVal.byCategory || {};
    for (const [category, cellVal] of Object.entries(byCat)) {
      collectCell(out, fixtureId, file, period, category, cellVal);
    }
  }
}

function paragraphsToText(paragraphs) {
  if (!Array.isArray(paragraphs)) return '';
  return paragraphs.map((p) => p.plainText || '').join('\n\n').trim();
}

function collectCell(rows, fixtureId, file, period, category, cell) {
  if (!cell || typeof cell !== 'object') return;
  if (cell.brief?.headline) {
    rows.push({
      fixture: fixtureId,
      file,
      period,
      category,
      depth: 'brief',
      slot: 'headline',
      fragmentId: cell.brief.fragmentId || null,
      text: cell.brief.headline,
    });
  }
  if (cell.standard) {
    const text = paragraphsToText(cell.standard.paragraphs);
    if (text) {
      rows.push({
        fixture: fixtureId,
        file,
        period,
        category,
        depth: 'standard',
        slot: 'paragraphs',
        fragmentId: cell.standard.fragmentId || null,
        text,
      });
    }
    for (const [slot, key] of [['livingTips', 'livingTips'], ['cautions', 'cautions']]) {
      const arr = cell.standard[key];
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i += 1) {
          const v = arr[i];
          if (typeof v === 'string' && v.trim()) {
            rows.push({
              fixture: fixtureId,
              file,
              period,
              category,
              depth: 'standard',
              slot: `${slot}[${i}]`,
              fragmentId: cell.standard.fragmentId || null,
              text: v,
            });
          }
        }
      }
    }
  }
  if (cell.expert) {
    const text = paragraphsToText(cell.expert.paragraphs);
    if (text) {
      rows.push({
        fixture: fixtureId,
        file,
        period,
        category,
        depth: 'expert',
        slot: 'paragraphs',
        fragmentId: cell.expert.fragmentId || null,
        text,
      });
    }
    for (const [slot, key] of [['livingTips', 'livingTips'], ['cautions', 'cautions']]) {
      const arr = cell.expert[key];
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i += 1) {
          const v = arr[i];
          if (typeof v === 'string' && v.trim()) {
            rows.push({
              fixture: fixtureId,
              file,
              period,
              category,
              depth: 'expert',
              slot: `${slot}[${i}]`,
              fragmentId: cell.expert.fragmentId || null,
              text: v,
            });
          }
        }
      }
    }
  }
}

function pushLegacy(rows, fixtureId, file, payload) {
  const tryPush = (path, slot, value) => {
    if (typeof value === 'string' && value.trim()) {
      rows.push({
        fixture: fixtureId,
        file,
        period: 'legacy',
        category: path,
        depth: 'legacy',
        slot,
        fragmentId: null,
        text: value,
      });
    }
  };
  if (payload.overviewSummary) {
    tryPush('overviewSummary', 'overallSummary', payload.overviewSummary.overallSummary);
    tryPush('overviewSummary', 'dayMasterDescription', payload.overviewSummary.dayMasterDescription);
    tryPush('overviewSummary', 'strengthDescription', payload.overviewSummary.strengthDescription);
    tryPush('overviewSummary', 'yongshinDescription', payload.overviewSummary.yongshinDescription);
    tryPush('overviewSummary', 'elementBalance', payload.overviewSummary.elementBalance);
  }
  if (payload.lifeFortuneOverview?.summary) {
    tryPush('lifeFortuneOverview', 'summary', payload.lifeFortuneOverview.summary);
  }
  if (payload.personality?.summary) {
    tryPush('personality', 'summary', payload.personality.summary);
  }
  if (Array.isArray(payload.personality?.details)) {
    payload.personality.details.forEach((d, i) => tryPush('personality', `details[${i}]`, d));
  }
  if (Array.isArray(payload.strengthsWeaknesses?.strengths)) {
    payload.strengthsWeaknesses.strengths.forEach((d, i) => tryPush('strengthsWeaknesses', `strengths[${i}]`, d));
  }
  if (Array.isArray(payload.strengthsWeaknesses?.weaknesses)) {
    payload.strengthsWeaknesses.weaknesses.forEach((d, i) => tryPush('strengthsWeaknesses', `weaknesses[${i}]`, d));
  }
  if (Array.isArray(payload.cautions)) {
    payload.cautions.forEach((d, i) => tryPush('cautions', `cautions[${i}]`, d));
  }
  for (const periodKey of ['dailyFortune', 'weeklyFortune', 'monthlyFortune', 'yearlyFortune']) {
    const block = payload[periodKey];
    if (block?.summary) tryPush(periodKey, 'summary', block.summary);
    if (Array.isArray(block?.details)) {
      block.details.forEach((d, i) => tryPush(periodKey, `details[${i}]`, d));
    }
  }
  if (Array.isArray(payload.categoryFortunes)) {
    payload.categoryFortunes.forEach((cf, i) => {
      const tag = `categoryFortunes[${i}](${cf.category || 'unknown'})`;
      if (cf.summary) tryPush(tag, 'summary', cf.summary);
      if (Array.isArray(cf.details)) {
        cf.details.forEach((d, j) => tryPush(tag, `details[${j}]`, d));
      }
    });
  }
  if (Array.isArray(payload.lifeStageFortune)) {
    payload.lifeStageFortune.forEach((stage, i) => {
      if (stage?.summary) tryPush(`lifeStageFortune[${i}]`, 'summary', stage.summary);
    });
  }
}

fs.writeFileSync(OUT_PATH, out.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
console.log(`Wrote ${out.length} prose units across ${TIER_FIXTURE_FILES.length} fixtures to ${OUT_PATH}`);

// Quick category summary
const byFixture = {};
for (const r of out) {
  byFixture[r.fixture] ??= { brief: 0, standard: 0, expert: 0, legacy: 0 };
  byFixture[r.fixture][r.depth] += 1;
}
for (const [fx, counts] of Object.entries(byFixture)) {
  console.log(
    `  ${fx.padEnd(50, ' ')}  brief=${counts.brief}  standard=${counts.standard}  expert=${counts.expert}  legacy=${counts.legacy}`,
  );
}
