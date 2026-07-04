/**
 * pack-generated.ts -- Pack generated class articles into per-person-axis
 * bundles the BROWSER can fetch (a few small files per report instead of 21,060).
 *
 * A person's class axes (강약·격국family·nameEffect·성별) are FIXED across all
 * cells, so all the classIds they need in a category share one key. We group
 * data/generated/<cat>/<classId>.json by (강약.격국.nameEffect.성별) and emit
 * namespring/public/generated-packed/<cat>/<key>.json = { classId: article }.
 * Vite serves /generated-packed/ statically (dev + prod build), so the browser
 * fetches ~11 small bundles per report — no 21k-file bundle bloat.
 *
 * Run: npx tsx tools/generation/pack-generated.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.resolve(HERE, '../../data/generated');
const OUT_DIR = path.resolve(HERE, '../../../../namespring/public/generated-packed');

/** classId = cat.period.aud.band.강약.격국.nameEffect.성별 → key = last 4 parts. */
function packKey(classId: string): string | null {
  const p = classId.split('.');
  if (p.length !== 8) return null;
  return `${p[4]}.${p[5]}.${p[6]}.${p[7]}`;
}

function main(): void {
  if (!fs.existsSync(GENERATED_DIR)) { console.error('no data/generated'); process.exit(1); }
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let total = 0, files = 0;
  for (const category of fs.readdirSync(GENERATED_DIR)) {
    const catDir = path.join(GENERATED_DIR, category);
    if (!fs.statSync(catDir).isDirectory()) continue;
    const bundles = new Map<string, Record<string, unknown>>();
    for (const name of fs.readdirSync(catDir)) {
      if (!name.endsWith('.json')) continue;
      const classId = name.replace(/\.json$/, '');
      const key = packKey(classId);
      if (!key) continue;
      const article = JSON.parse(fs.readFileSync(path.join(catDir, name), 'utf-8'));
      const bundle = bundles.get(key) ?? {};
      bundle[classId] = article;
      bundles.set(key, bundle);
      total += 1;
    }
    const outCat = path.join(OUT_DIR, category);
    fs.mkdirSync(outCat, { recursive: true });
    for (const [key, bundle] of bundles) {
      fs.writeFileSync(path.join(outCat, `${key}.json`), JSON.stringify(bundle), 'utf-8');
      files += 1;
    }
    console.log(`  ${category}: ${bundles.size} bundles`);
  }
  console.log(`packed ${total} articles → ${files} bundles at ${path.relative(process.cwd(), OUT_DIR)}`);
}

main();
