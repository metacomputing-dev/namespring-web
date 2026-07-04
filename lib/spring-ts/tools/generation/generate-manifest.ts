/**
 * generate-manifest.ts -- Enumerate every equivalence CLASS (reduction v2).
 *
 * Class dims (docs/REDUCTION_FORMULA.md §3): base cell (category, period,
 * audience, band) × 강약coarse(3) × 격국family(6) × nameEffect(4) × gender(2,
 * gender-sensitive categories only). Minors use 강약(2) × nameEffect(3).
 *
 * Writes one JSONL shard per category under data/generation/manifest/ + index.
 * Run: npx tsx tools/generation/generate-manifest.ts
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  Gender, GenerationCase, GenerationSpec, GyeokgukFamily, NameEffect, StrengthCoarse,
} from './case-schema.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = path.resolve(HERE, '../../data/articles');
const OUT_DIR = path.resolve(HERE, '../../data/generation/manifest');

const STRENGTH_TERM: Record<StrengthCoarse, string> = { weak: '신약', balanced: '중화', strong: '신강' };
const STRENGTH_PLAIN: Record<StrengthCoarse, string> = { weak: '여린', balanced: '고른', strong: '단단한' };
const STRENGTH_DIR: Record<StrengthCoarse, string> = {
  weak: '채우고 다지는 쪽(속도보다 기반, 인성·비겁의 도움 받기)',
  balanced: '균형을 유지하며 상황에 맞춰 쓰고 채우는 쪽',
  strong: '쌓인 기운을 쓰고 발산하는 쪽(재성·관성 활용, 나눔·도전)',
};
const GYEOKGUK_TERM: Record<GyeokgukFamily, string> = {
  inseong: '인성 계열(정인·편인격)', siksang: '식상 계열(식신·상관격)',
  jaeseong: '재성 계열(정재·편재격)', gwanseong: '관성 계열(정관·편관격)',
  bigeop: '비겁 계열(비견·겁재격)', special: '특수 계열(종·화기·전왕격)',
};
const GYEOKGUK_MEANING: Record<GyeokgukFamily, string> = {
  inseong: '배우고 수용하며 자격·문서·보호로 힘을 얻는 구조. 기대고 채우는 전략이 맞음.',
  siksang: '표현·생산·재능으로 자신을 드러내는 구조. 만들고 내보내는 전략이 맞음.',
  jaeseong: '재물·현실을 다루고 관리하는 구조. 굴리고 소유하는 전략이 맞음.',
  gwanseong: '규율·책임·지위로 자리를 얻는 구조. 조직·명예의 전략이 맞음.',
  bigeop: '자립·경쟁·동료로 나를 세우는 구조. 주체적으로 밀고 나가는 전략이 맞음.',
  special: '한쪽으로 크게 쏠린 특수 구조. 거스르지 않고 대세를 따르는 전략이 맞음.',
};
const NAME_EFFECT_PLAIN: Record<NameEffect, string> = {
  boost_strong: '이름이 지금 필요한 기운을 여러 글자로 크게 채워 주는',
  boost_mild: '이름이 필요한 기운을 한 글자쯤 거들어 주는',
  neutral: '이름이 그 기운을 직접 담고 있진 않은',
  adverse: '이름은 이미 넉넉한 쪽에 무게가 실려, 부족한 기운은 생활에서 챙기는 편이 나은',
};
const NAME_EFFECT_EXPERT: Record<NameEffect, string> = {
  boost_strong: '자원오행이 사주에 합산돼 이룬 combinedDistribution에서 용신을 여러 자로 크게 보강',
  boost_mild: '자원오행이 combinedDistribution에서 용신을 한 자쯤 완만히 보강',
  neutral: '자원오행이 용신·기신 어느 쪽도 크게 건드리지 않아 중립',
  adverse: '자원오행이 기신 계열로 기울어 combinedDistribution의 과다를 더함 — 이름 밖 생활 보완 권장',
};
const GENDER_TERM: Record<Gender, string> = { male: '건명(乾命)', female: '곤명(坤命)' };

const CATEGORY_TAG: Record<string, string> = {
  overall: 'bigyeon', wealth: 'jaeseong', health: 'jeongin', academic: 'sikshin',
  romance: 'jaeseong', family: 'jeongin', career: 'jeonggwan', study_document: 'jeongin',
  expression_children: 'sikshin', health_stress: 'jeongin', movement: 'sikshin',
};
const GENDER_SENSITIVE = new Set(['romance', 'family', 'career']);
const MINOR_AUDIENCES = new Set(['teen', 'child', 'stage-teen']);

const ADULT_STRENGTHS: readonly StrengthCoarse[] = ['weak', 'balanced', 'strong'];
const MINOR_STRENGTHS: readonly StrengthCoarse[] = ['weak', 'strong'];
const FAMILIES: readonly GyeokgukFamily[] = ['inseong', 'siksang', 'jaeseong', 'gwanseong', 'bigeop', 'special'];
const ADULT_NAME_EFFECTS: readonly NameEffect[] = ['boost_strong', 'boost_mild', 'neutral', 'adverse'];
const MINOR_NAME_EFFECTS: readonly NameEffect[] = ['boost_strong', 'boost_mild', 'neutral'];

interface BaseCell { category: string; period: string; audience: string; band: string; }

function readBaseCells(): BaseCell[] {
  const cells = new Map<string, BaseCell>();
  (function walk(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.articles.json')) {
        const b = JSON.parse(fs.readFileSync(full, 'utf-8')) as { articles?: Array<Record<string, string>> };
        for (const a of b.articles ?? []) {
          const k = `${a.category}.${a.period}.${a.audience}.${a.band}`;
          if (!cells.has(k)) cells.set(k, { category: a.category, period: a.period, audience: a.audience, band: a.band });
        }
      }
    }
  })(ARTICLES_DIR);
  return [...cells.values()];
}

function isMinor(cell: BaseCell): boolean {
  return MINOR_AUDIENCES.has(cell.audience) || cell.audience.startsWith('stage-');
}

function buildSpec(cell: BaseCell, g: StrengthCoarse, fam: GyeokgukFamily, ne: NameEffect, gender: Gender | null): GenerationSpec {
  const minor = isMinor(cell);
  return {
    archetype: `${STRENGTH_TERM[g]}(${STRENGTH_PLAIN[g]}) · ${GYEOKGUK_TERM[fam]} · ${NAME_EFFECT_PLAIN[ne]} · ${gender ? GENDER_TERM[gender] + ' · ' : ''}${cell.category}/${cell.period}/${cell.audience}/등급 ${cell.band}`,
    strengthTerm: STRENGTH_TERM[g],
    strengthPlain: STRENGTH_PLAIN[g],
    adviceDirection: STRENGTH_DIR[g],
    gyeokgukTerm: GYEOKGUK_TERM[fam],
    gyeokgukMeaning: GYEOKGUK_MEANING[fam],
    nameEffectPlain: NAME_EFFECT_PLAIN[ne],
    nameEffectExpert: NAME_EFFECT_EXPERT[ne],
    nameIsAdverse: ne === 'adverse',
    genderTerm: gender ? GENDER_TERM[gender] : null,
    audienceSafety: minor ? 'minor' : 'adult',
    suggestedExpertTags: ['yongshin', CATEGORY_TAG[cell.category] ?? 'bigyeon'],
  };
}

function* enumerate(cell: BaseCell): Generator<GenerationCase> {
  const minor = isMinor(cell);
  const strengths = minor ? MINOR_STRENGTHS : ADULT_STRENGTHS;
  const nameEffects = minor ? MINOR_NAME_EFFECTS : ADULT_NAME_EFFECTS;
  const genders: readonly (Gender | null)[] = (!minor && GENDER_SENSITIVE.has(cell.category)) ? ['male', 'female'] : [null];
  for (const g of strengths) {
    for (const fam of FAMILIES) {
      for (const ne of nameEffects) {
        for (const gender of genders) {
          const caseId = [
            cell.category, cell.period, cell.audience, cell.band,
            g, fam, ne, gender ?? 'x',
          ].join('.');
          yield { caseId, category: cell.category, period: cell.period, audience: cell.audience, band: cell.band, gangyak: g, gyeokgukFamily: fam, nameEffect: ne, gender, spec: buildSpec(cell, g, fam, ne, gender) };
        }
      }
    }
  }
}

function main(): void {
  const baseCells = readBaseCells();
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const perCategory = new Map<string, GenerationCase[]>();
  let total = 0;
  for (const cell of baseCells) {
    for (const c of enumerate(cell)) {
      const list = perCategory.get(c.category) ?? [];
      list.push(c); perCategory.set(c.category, list); total += 1;
    }
  }
  const perCat: Record<string, number> = {};
  for (const [category, cases] of [...perCategory.entries()].sort()) {
    fs.writeFileSync(path.join(OUT_DIR, `${category}.manifest.jsonl`), cases.map((c) => JSON.stringify(c)).join('\n') + '\n', 'utf-8');
    perCat[category] = cases.length;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify({
    schemaVersion: 'spring-ts.generation-manifest.v2',
    baseCells: baseCells.length, totalClasses: total, perCategory: perCat,
    classDims: '강약coarse3 × 격국family6 × nameEffect4 × gender2(민감분야) / 미성년 강약2×nameEffect3',
  }, null, 2), 'utf-8');
  console.log(`base cells: ${baseCells.length}`);
  console.log(`TOTAL classes (v2): ${total}`);
  for (const [c, n] of Object.entries(perCat)) console.log(`  ${c}: ${n}`);
}

main();
