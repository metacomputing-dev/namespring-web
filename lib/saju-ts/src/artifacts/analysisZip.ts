import type { AnalysisBundle, Artifact } from '../api/types.js';
import type { NarrationOptions } from '../narration/buildNarration.js';
import { buildNarrationArtifact } from '../narration/buildNarration.js';
import { stableStringify } from '../utils/json.js';
import { sha256Hex } from '../utils/hash.js';
import { fromBase64, toBase64 } from '../utils/base64.js';

// NOTE: fflate is a tiny pure-JS zip implementation.
// We only use the synchronous API to keep the engine deterministic.
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export type AnalysisZipInclude =
  | 'bundle'
  | 'summary'
  | 'report'
  | 'facts'
  | 'trace'
  | 'diagnostics'
  | 'config'
  | 'narration';

export interface AnalysisZipOptions {
  /** Artifact key name to store the zip under. (Engine default: 'analysis.zip') */
  key?: string;

  /** If true, JSON files are pretty-printed (space=2). (default: false) */
  prettyJson?: boolean;

  /** Which parts to include. (default: ['summary','report','facts','trace','diagnostics','config','narration']) */
  include?: AnalysisZipInclude[];

  /** Zip compression level (0..9). (default: 6) */
  level?: number;

  /** Options for narration generation (narration.md / narration.json). */
  narration?: NarrationOptions;
}

export interface AnalysisZipManifest {
  kind: 'saju.analysis.zip';
  createdAt: string;
  schemaVersion: string;
  configDigest: string;
  files: Array<{ path: string; bytes: number; sha256: string }>;
}

function jsonFile(path: string, value: unknown, space?: number): Uint8Array {
  // UTF-8 encode (default). Using latin1 would corrupt Korean/Hanja.
  return strToU8(stableStringify(value, space));
}

/**
 * Pack the analysis bundle into a single ZIP artifact.
 *
 * This is intentionally "API-stability" focused:
 * - your top-level API can stay stable
 * - internal data can expand inside the zip without changing the contract
 */
export function packAnalysisBundleZip(bundle: AnalysisBundle, opts: AnalysisZipOptions = {}): Artifact {
  const include = new Set<AnalysisZipInclude>(
    opts.include ?? ['summary', 'report', 'facts', 'trace', 'diagnostics', 'config', 'narration'],
  );
  const space = opts.prettyJson ? 2 : undefined;
  const level = typeof opts.level === 'number' ? Math.max(0, Math.min(9, Math.floor(opts.level))) : 6;

  const files: Record<string, Uint8Array> = {};

  if (include.has('bundle')) files['bundle.json'] = jsonFile('bundle.json', bundle, space);
  if (include.has('summary')) files['summary.json'] = jsonFile('summary.json', bundle.summary, space);
  if (include.has('report')) files['report.json'] = jsonFile('report.json', bundle.report, space);
  if (include.has('facts')) files['facts.json'] = jsonFile('facts.json', bundle.report.facts, space);
  if (include.has('trace')) files['trace.json'] = jsonFile('trace.json', bundle.report.trace, space);
  if (include.has('diagnostics')) files['diagnostics.json'] = jsonFile('diagnostics.json', bundle.report.diagnostics, space);

  // Convenience: stable config snapshot (already inside facts.config, but kept as a top-level file).
  if (include.has('config')) files['config.json'] = jsonFile('config.json', (bundle.report.facts as any)?.config ?? {}, space);

  if (include.has('narration')) {
    const narr = buildNarrationArtifact(bundle, opts.narration ?? {});
    files['narration.json'] = jsonFile('narration.json', narr, space);
    files['narration.md'] = strToU8(narr.markdown);
  }

  const manifest: AnalysisZipManifest = {
    kind: 'saju.analysis.zip',
    createdAt: new Date().toISOString(),
    schemaVersion: bundle.config.schemaVersion,
    configDigest: bundle.config.digest,
    files: Object.entries(files)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, bytes]) => ({
        path,
        bytes: bytes.length,
        sha256: sha256Hex(strFromU8(bytes)),
      })),
  };

  files['manifest.json'] = jsonFile('manifest.json', manifest, 2);

  const zipped = zipSync(files, { level });

  return {
    mime: 'application/zip',
    encoding: 'base64',
    data: toBase64(zipped),
  } satisfies Artifact;
}

/**
 * Unpack a ZIP artifact produced by `packAnalysisBundleZip`.
 *
 * Returns raw bytes and a best-effort JSON parse for `*.json` files.
 */
export function unpackAnalysisBundleZip(artifact: Artifact): {
  files: Record<string, Uint8Array>;
  text: Record<string, string>;
  json: Record<string, unknown>;
  manifest?: AnalysisZipManifest;
} {
  if (!artifact || typeof artifact !== 'object') throw new Error('Artifact is required');
  if (artifact.encoding !== 'base64') throw new Error(`Unsupported artifact.encoding: ${String(artifact.encoding)}`);
  const b64 = String((artifact as any).data ?? '');
  const bytes = fromBase64(b64);

  const files = unzipSync(bytes);
  const text: Record<string, string> = {};
  const json: Record<string, unknown> = {};

  for (const [path, u8] of Object.entries(files)) {
    // Decode as text when it looks like text.
    if (path.endsWith('.json') || path.endsWith('.txt') || path.endsWith('.md')) {
      const s = strFromU8(u8);
      text[path] = s;
      if (path.endsWith('.json')) {
        try {
          json[path] = JSON.parse(s);
        } catch {
          // ignore
        }
      }
    }
  }

  const manifest = (json['manifest.json'] ?? undefined) as AnalysisZipManifest | undefined;
  return { files, text, json, manifest };
}
