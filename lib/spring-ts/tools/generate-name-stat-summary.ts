import path from 'node:path';

import {
  NAME_STAT_SUMMARY_ASSET_PATH,
  collectNameStatSummary,
  verifyCommittedNameStatSummaryArtifact,
  writeNameStatSummaryArtifact,
} from './name-stat-summary-core.js';

const mode = process.argv[2];
if (mode !== '--check' && mode !== '--write') {
  throw new Error(
    'Usage: tsx tools/generate-name-stat-summary.ts --check|--write',
  );
}

const build = await collectNameStatSummary();
const artifact = mode === '--write'
  ? writeNameStatSummaryArtifact(build)
  : verifyCommittedNameStatSummaryArtifact(build);

process.stdout.write(
  `${mode === '--write' ? 'wrote' : 'verified'} `
  + `${path.relative(process.cwd(), NAME_STAT_SUMMARY_ASSET_PATH)} `
  + `(${artifact.provenance.rowCount} entries, `
  + `${artifact.provenance.compressedByteLength} compressed bytes, `
  + `${artifact.provenance.compressedSha256})\n`,
);
