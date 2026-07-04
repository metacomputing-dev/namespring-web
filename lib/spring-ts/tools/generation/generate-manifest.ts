/**
 * generate-manifest.ts -- Enumerate every no-sharing generation case.
 *
 * Reads the existing base cells (category, period, audience, band) from
 * data/articles/** and crosses each with the personal branch axes:
 *   - adult cells (band high/mid/low): 강약(5) × 용신오행(5) × 이름보완(3) = 75
 *   - minor/stage cells (band any):    강약(3) × 이름보완(2) = 6  (용신 = slot)
 *
 * Writes one JSONL shard per category under data/generation/manifest/ plus an
 * index.json with counts. This manifest is the durable data structure the
 * parallel expert-agent generation fans out over.
 *
 * Run: npx tsx tools/generation/generate-manifest.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ElementCode, GenerationCase, GenerationSpec, NameReinforce, StrengthBand,
} from './case-schema.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = path.resolve(HERE, '../../data/articles');
const OUT_DIR = path.resolve(HERE, '../../data/generation/manifest');

const ELEMENT_KO: Record<ElementCode, string> = {
  WOOD: '나무', FIRE: '불', EARTH: '흙', METAL: '쇠', WATER: '물',
};
const STRENGTH_TERM: Record<StrengthBand, string> = {
  EXTREME_WEAK: '극신약', WEAK: '신약', BALANCED: '중화', STRONG: '신강', EXTREME_STRONG: '극신강',
};
const STRENGTH_PLAIN: Record<StrengthBand, string> = {
  EXTREME_WEAK: '아주 여린', WEAK: '여린', BALANCED: '고른', STRONG: '단단한', EXTREME_STRONG: '아주 단단한',
};
const STRENGTH_DIRECTION: Record<StrengthBand, string> = {
  EXTREME_WEAK: '기운을 채우고 보강하는 쪽(무리한 확장 자제, 인성·비겁의 도움 받기)',
  WEAK: '채우고 다지는 쪽(속도보다 기반, 도움 구하기)',
  BALANCED: '균형을 유지하며 상황에 맞춰 쓰고 채우는 쪽',
  STRONG: '쌓인 기운을 쓰고 발산하는 쪽(재성·관성 활용, 나눔·도전)',
  EXTREME_STRONG: '넘치는 기운을 적극적으로 흘려보내는 쪽(과감한 활용, 독주 경계)',
};
const NAME_REINFORCE_KO: Record<NameReinforce, string> = {
  strong: '이름이 필요한 기운을 여러 글자로 크게 채워 주는',
  weak: '이름이 필요한 기운을 한 글자쯤 거들어 주는',
  none: '이름이 그 기운을 직접 담고 있진 않은',
};

const ADULT_STRENGTHS: readonly StrengthBand[] = ['EXTREME_WEAK', 'WEAK', 'BALANCED', 'STRONG', 'EXTREME_STRONG'];
const MINOR_STRENGTHS: readonly StrengthBand[] = ['WEAK', 'BALANCED', 'STRONG'];
const ELEMENTS: readonly ElementCode[] = ['WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'];
const ADULT_REINFORCE: readonly NameReinforce[] = ['strong', 'weak', 'none'];
const MINOR_REINFORCE: readonly NameReinforce[] = ['strong', 'none'];

/** category → a 십성-domain glossary tag the expert paragraph can anchor on,
 *  so the plain tier and the expert tier stay a consistent pair. */
const CATEGORY_TAG: Record<string, string> = {
  overall: 'bigyeon', wealth: 'jaeseong', health: 'jeongin', academic: 'sikshin',
  romance: 'jaeseong', family: 'jeongin', career: 'jeonggwan', study_document: 'jeongin',
  expression_children: 'sikshin', health_stress: 'jeongin', movement: 'sikshin',
};

const MINOR_AUDIENCES = new Set(['teen', 'child', 'stage-teen']);

interface BaseCell {
  readonly category: string;
  readonly period: string;
  readonly audience: string;
  readonly band: string;
}

function readBaseCells(): BaseCell[] {
  const cells = new Map<string, BaseCell>();
  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.articles.json')) {
        const bundle = JSON.parse(fs.readFileSync(full, 'utf-8')) as { articles?: Array<Record<string, string>> };
        for (const a of bundle.articles ?? []) {
          const key = `${a.category}.${a.period}.${a.audience}.${a.band}`;
          if (!cells.has(key)) cells.set(key, { category: a.category, period: a.period, audience: a.audience, band: a.band });
        }
      }
    }
  }
  walk(ARTICLES_DIR);
  return [...cells.values()];
}

function buildSpec(
  cell: BaseCell, gangyak: StrengthBand, yongshin: ElementCode | null, nameReinforce: NameReinforce,
): GenerationSpec {
  const minor = MINOR_AUDIENCES.has(cell.audience) || cell.audience.startsWith('stage-');
  const yongshinKo = yongshin ? ELEMENT_KO[yongshin] : null;
  const archetype = [
    `${STRENGTH_TERM[gangyak]}(${STRENGTH_PLAIN[gangyak]} 기운)`,
    yongshinKo ? `용신 ${yongshinKo}` : '용신 오행은 슬롯 처리',
    NAME_REINFORCE_KO[nameReinforce],
    `${cell.category} / ${cell.period} / ${cell.audience} / 등급 ${cell.band}`,
  ].join(' · ');
  return {
    archetype,
    strengthTerm: STRENGTH_TERM[gangyak],
    strengthPlain: STRENGTH_PLAIN[gangyak],
    yongshinKo,
    nameReinforceKo: NAME_REINFORCE_KO[nameReinforce],
    adviceDirection: STRENGTH_DIRECTION[gangyak],
    audienceSafety: minor ? 'minor' : 'adult',
    suggestedExpertTags: ['yongshin', CATEGORY_TAG[cell.category] ?? 'bigyeon'],
  };
}

function* enumerateCases(cell: BaseCell): Generator<GenerationCase> {
  const minor = MINOR_AUDIENCES.has(cell.audience) || cell.audience.startsWith('stage-');
  const strengths = minor ? MINOR_STRENGTHS : ADULT_STRENGTHS;
  const reinforces = minor ? MINOR_REINFORCE : ADULT_REINFORCE;
  const yongshins: readonly (ElementCode | null)[] = minor ? [null] : ELEMENTS;
  for (const gangyak of strengths) {
    for (const yongshin of yongshins) {
      for (const nameReinforce of reinforces) {
        const caseId = [
          cell.category, cell.period, cell.audience, cell.band,
          gangyak, yongshin ?? 'slot', nameReinforce,
        ].join('.');
        yield {
          caseId, category: cell.category, period: cell.period, audience: cell.audience, band: cell.band,
          gangyak, yongshin, nameReinforce,
          spec: buildSpec(cell, gangyak, yongshin, nameReinforce),
        };
      }
    }
  }
}

function main(): void {
  const baseCells = readBaseCells();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const perCategory = new Map<string, GenerationCase[]>();
  let total = 0;
  for (const cell of baseCells) {
    for (const c of enumerateCases(cell)) {
      const list = perCategory.get(c.category) ?? [];
      list.push(c);
      perCategory.set(c.category, list);
      total += 1;
    }
  }
  const index: Record<string, unknown> = {
    schemaVersion: 'spring-ts.generation-manifest.v1',
    baseCells: baseCells.length,
    totalCases: total,
    perCategory: {} as Record<string, number>,
    axes: {
      adult: '강약(5) × 용신(5) × 이름보완(3) = 75 per cell',
      minor: '강약(3) × 이름보완(2) = 6 per cell (용신=slot)',
    },
  };
  for (const [category, cases] of [...perCategory.entries()].sort()) {
    const shard = path.join(OUT_DIR, `${category}.manifest.jsonl`);
    fs.writeFileSync(shard, cases.map((c) => JSON.stringify(c)).join('\n') + '\n', 'utf-8');
    (index.perCategory as Record<string, number>)[category] = cases.length;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2), 'utf-8');
  console.log(`base cells: ${baseCells.length}`);
  console.log(`TOTAL generation cases: ${total}`);
  for (const [c, n] of Object.entries(index.perCategory as Record<string, number>)) console.log(`  ${c}: ${n}`);
  console.log(`manifest written to ${path.relative(process.cwd(), OUT_DIR)}`);
}

main();
