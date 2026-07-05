/**
 * gen-stage-skeletons.mjs -- S4 stage×band(high/low) 스켈레톤 2,160개 생성.
 *
 * classId = <cat>.life.<stageAud>.<band>.<gangyak>.<family>.<nameEffect>.x
 *   cat        ∈ {overall,wealth,health,academic,romance,family}        (6)
 *   stageAud   ∈ {stage-teen,stage-early,stage-mid,stage-senior,stage-elder} (5)
 *   band       ∈ {high,low}   -- any는 이미 생성돼 있으므로 제외        (2)
 *   gangyak    ∈ {weak,strong}                                          (2)
 *   family     ∈ {bigeop,siksang,jaeseong,gwanseong,inseong,special}    (6)
 *   nameEffect ∈ {boost_strong,boost_mild,neutral}                      (3)
 *   → 6×5×2×2×6×3 = 2,160
 *
 * 출력: data/generation/staging/stage-bands/<category>/<classId>.json
 * 이 디렉터리는 런타임/팩/prepare-bundles가 읽지 않는 스테이징 전용이다
 * (data/generated 아님). 파일 목록이 곧 S4 채움 작업 체크리스트다
 * (docs/S4_STAGE_BANDS_FILL_PLAN.md).
 *
 * Run: node tools/generation/gen-stage-skeletons.mjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.resolve(HERE, '../../data/generation/staging/stage-bands');

const CATEGORIES = ['overall', 'wealth', 'health', 'academic', 'romance', 'family'];
const STAGE_AUDIENCES = ['stage-teen', 'stage-early', 'stage-mid', 'stage-senior', 'stage-elder'];
const BANDS = ['high', 'low'];
const GANGYAK = ['weak', 'strong'];
const FAMILIES = ['bigeop', 'siksang', 'jaeseong', 'gwanseong', 'inseong', 'special'];
const NAME_EFFECTS = ['boost_strong', 'boost_mild', 'neutral'];

const EXPECTED =
  CATEGORIES.length * STAGE_AUDIENCES.length * BANDS.length *
  GANGYAK.length * FAMILIES.length * NAME_EFFECTS.length; // 2,160

function skeleton(classId, category, audience, band) {
  return {
    schemaVersion: 'spring-ts.article.v1',
    articleId: classId,
    category,
    period: 'life',
    audience,
    band,
    summary: '',
    body: [],
    expert: [],
    livingTips: [],
    cautions: [],
    aiGenerated: true,
    sourceNote: 'skeleton-s4-pending',
    skeleton: true,
  };
}

function main() {
  let written = 0;
  const perCategory = new Map();
  for (const cat of CATEGORIES) {
    const dir = path.join(OUT_ROOT, cat);
    fs.mkdirSync(dir, { recursive: true });
    let n = 0;
    for (const aud of STAGE_AUDIENCES) {
      for (const band of BANDS) {
        for (const g of GANGYAK) {
          for (const fam of FAMILIES) {
            for (const ne of NAME_EFFECTS) {
              const classId = [cat, 'life', aud, band, g, fam, ne, 'x'].join('.');
              const file = path.join(dir, `${classId}.json`);
              fs.writeFileSync(file, `${JSON.stringify(skeleton(classId, cat, aud, band), null, 2)}\n`, 'utf-8');
              written += 1;
              n += 1;
            }
          }
        }
      }
    }
    perCategory.set(cat, n);
  }

  // 검증: 조합 수와 디스크 파일 수가 모두 기대치와 일치해야 한다.
  let onDisk = 0;
  for (const cat of CATEGORIES) {
    onDisk += fs.readdirSync(path.join(OUT_ROOT, cat)).filter((f) => f.endsWith('.json')).length;
  }
  for (const [cat, n] of perCategory) console.log(`  ${cat}: ${n}`);
  console.log(`written=${written} onDisk=${onDisk} expected=${EXPECTED}`);
  if (written !== EXPECTED || onDisk !== EXPECTED) {
    console.error(`MISMATCH: expected ${EXPECTED}, written ${written}, onDisk ${onDisk}`);
    process.exit(1);
  }
  console.log(`OK: ${EXPECTED} skeletons → ${path.relative(process.cwd(), OUT_ROOT)}`);
}

main();
