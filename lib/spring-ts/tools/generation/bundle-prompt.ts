/**
 * bundle-prompt.ts -- Bundle prompt composer.
 *
 * Pure prompt prose lives under tools/generation/prompt/*.md. This module only
 * prepares manifest-derived context and stitches prompt parts together.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GenerationCase } from './case-schema.js';
import { BURNED_EXPERT_PHRASES, BURNED_PHRASES, UNNATURAL_PLAIN_PHRASES } from './text-quality-rules.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_DIR = path.join(HERE, 'prompt');

type PromptMapping = Record<string, readonly string[]>;
interface PromptMappings {
  readonly categoryLabel: PromptMapping;
  readonly periodLabel: PromptMapping;
  readonly periodRole: PromptMapping;
  readonly bandLabel: PromptMapping;
  readonly bandRole: PromptMapping;
  readonly strengthRole: PromptMapping;
  readonly nameEffectRole: PromptMapping;
  readonly gyeokRole: PromptMapping;
  readonly categoryScenes: PromptMapping;
  readonly stageLabel: PromptMapping;
}

const PROMPT_MAPPINGS = JSON.parse(
  fs.readFileSync(path.join(PROMPT_DIR, 'mappings.json'), 'utf-8'),
) as PromptMappings;

/** Stage audiences are merged into one bundle because they render as one life tab. */
export function bundleKeyOfCase(c: GenerationCase): string {
  const audience = c.audience.startsWith('stage-') ? 'stages' : c.audience;
  return [c.category, audience, c.gangyak, c.gyeokgukFamily, c.nameEffect, c.gender ?? 'x'].join('.');
}

export const BUNDLE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['articles'],
  properties: {
    articles: {
      type: 'array',
      minItems: 1,
      maxItems: 24,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['caseId', 'summary', 'body', 'expert', 'livingTips', 'cautions'],
        properties: {
          caseId: { type: 'string', description: '요청된 caseId 그대로' },
          summary: { type: 'string', description: '60자 이하, 자연스러운 해요체 한 문장' },
          hook: { type: 'string', description: '선택, 24자 이하' },
          body: {
            type: 'array',
            minItems: 3,
            maxItems: 4,
            items: { type: 'string', description: '80-240자, 2-5문장, 평문 해요체' },
          },
          expert: {
            type: 'array',
            minItems: 1,
            maxItems: 2,
            items: { type: 'string', description: '100-380자, 해요체, 전체 #{tag} 2-6개 포함' },
          },
          livingTips: {
            type: 'array',
            minItems: 2,
            maxItems: 3,
            items: { type: 'string', description: '30자 이하, 평문' },
          },
          cautions: {
            type: 'array',
            minItems: 1,
            maxItems: 2,
            items: { type: 'string', description: '44자 이하, 평문 해요체' },
          },
        },
      },
    },
  },
} as const;

function phraseOf(map: PromptMapping, key: string): string {
  return map[key]?.join(', ') ?? key;
}

function stableIndex(seed: string, modulo: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return modulo === 0 ? 0 : hash % modulo;
}

function pickScenes(c: GenerationCase): string {
  const scenes = PROMPT_MAPPINGS.categoryScenes[c.category] ?? PROMPT_MAPPINGS.categoryScenes.overall;
  const start = stableIndex(c.caseId, scenes.length);
  return [scenes[start], scenes[(start + 2) % scenes.length], scenes[(start + 4) % scenes.length]].join(', ');
}

function readPromptPart(fileName: string): string {
  return fs.readFileSync(path.join(PROMPT_DIR, fileName), 'utf-8').trim();
}

function render(template: string, values: Record<string, string>): string {
  return template.replace(/\[\[([A-Z0-9_]+)\]\]/gu, (match, key: string) => values[key] ?? match);
}

function caseBrief(c: GenerationCase, index: number): string {
  const audience = phraseOf(PROMPT_MAPPINGS.stageLabel, c.audience);
  return render(readPromptPart('case-brief.md'), {
    INDEX: String(index + 1),
    CASE_ID: c.caseId,
    AUDIENCE: `${audience}${c.gender ? `, ${c.gender}` : ''}`,
    CATEGORY_LABEL: phraseOf(PROMPT_MAPPINGS.categoryLabel, c.category),
    PERIOD_LABEL: phraseOf(PROMPT_MAPPINGS.periodLabel, c.period),
    PERIOD_ROLE: phraseOf(PROMPT_MAPPINGS.periodRole, c.period),
    BAND_LABEL: phraseOf(PROMPT_MAPPINGS.bandLabel, c.band),
    BAND_ROLE: phraseOf(PROMPT_MAPPINGS.bandRole, c.band),
    STRENGTH_TERM: c.spec.strengthTerm,
    STRENGTH_ROLE: phraseOf(PROMPT_MAPPINGS.strengthRole, c.gangyak),
    GYEOKGUK_TERM: c.spec.gyeokgukTerm,
    GYEOKGUK_ROLE: phraseOf(PROMPT_MAPPINGS.gyeokRole, c.gyeokgukFamily),
    NAME_EFFECT_PLAIN: c.spec.nameEffectPlain,
    NAME_EFFECT_ROLE: phraseOf(PROMPT_MAPPINGS.nameEffectRole, c.nameEffect),
    SCENES: pickScenes(c),
    EXPERT_TAGS: c.spec.suggestedExpertTags.map((t) => `#{${t}}`).join(', '),
  });
}

function bundleFacts(c: GenerationCase): string {
  const s = c.spec;
  return [
    `분야: ${phraseOf(PROMPT_MAPPINGS.categoryLabel, c.category)}`,
    `독자층: ${c.audience}${s.audienceSafety === 'minor' ? ' (미성년 안전 언어 필요)' : ''}`,
    `공통 강약: ${s.strengthTerm} / 글쓰기 방향: ${phraseOf(PROMPT_MAPPINGS.strengthRole, c.gangyak)} / 조언 방향: ${s.adviceDirection}`,
    `공통 격국: ${s.gyeokgukTerm} / 의미: ${s.gyeokgukMeaning}`,
    `이름-사주 관계: ${s.nameEffectPlain}`,
    `이름-사주 전문가 근거: ${s.nameEffectExpert.replace(/combinedDistribution/gu, '이름-사주 오행 분포')}`,
    `이름 정직성: ${s.nameIsAdverse ? '이름이 필요한 기운을 채운다고 말하지 말고 주의 신호로만 다룬다.' : '이름 효과를 과장하지 않고 비례감 있게 다룬다.'}`,
    s.genderTerm ? `성별 맥락: ${s.genderTerm}` : '성별 맥락: 중립',
  ].join('\n');
}

function forbiddenLists(): string {
  return [
    `어색한 평문 금지 표현: ${UNNATURAL_PLAIN_PHRASES.map((p) => `"${p}"`).join(', ')}`,
    `소각 표현: ${BURNED_PHRASES.map((p) => `"${p}"`).join(', ')}`,
    `전문가 문단 금지 메타 표현: ${BURNED_EXPERT_PHRASES.map((p) => `"${p}"`).join(', ')}`,
  ].join('\n');
}

function promptPartsFor(category: string): string[] {
  const categoryPart = `category-${category}.md`;
  return [
    'common-role.md',
    'common-writing-contract.md',
    fs.existsSync(path.join(PROMPT_DIR, categoryPart)) ? categoryPart : 'common-category.md',
    'common-output-contract.md',
  ];
}

export function buildBundlePrompt(cases: readonly GenerationCase[]): string {
  if (cases.length === 0) throw new Error('empty bundle');
  const c0 = cases[0];
  const ordered = [...cases].sort((a, b) => a.caseId.localeCompare(b.caseId));
  const values = {
    BUNDLE_KEY: bundleKeyOfCase(c0),
    ARTICLE_COUNT: String(ordered.length),
    BUNDLE_FACTS: bundleFacts(c0),
    CASE_BRIEFS: ordered.map((c, i) => caseBrief(c, i)).join('\n\n'),
    FORBIDDEN_LISTS: forbiddenLists(),
  };

  return promptPartsFor(c0.category)
    .map((fileName) => render(readPromptPart(fileName), values))
    .join('\n\n');
}
