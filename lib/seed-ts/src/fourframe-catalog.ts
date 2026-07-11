import {
  compileFourFrameContract,
  normalizeFourFrameNumber,
  type CompiledFourFrameContract,
  type FourFrameLuckyLevel,
} from './fourframe-contract.js';
import {
  GENERATED_FOURFRAME_CATALOG_JSON_PARTS,
  GENERATED_FOURFRAME_CATALOG_PROVENANCE,
} from './fourframe-catalog.generated.js';
import { deepFreeze } from './utils/deep-freeze.js';

export interface FourframeMeaningEntry {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly summary: string;
  readonly detailed_explanation: string;
  readonly positive_aspects: string;
  readonly caution_points: string;
  readonly personality_traits: readonly string[];
  readonly suitable_career: readonly string[];
  readonly life_period_influence: string;
  readonly special_characteristics: string;
  readonly challenge_period: string;
  readonly opportunity_area: string;
  readonly lucky_level: FourFrameLuckyLevel;
}

export type CompiledFourFrameMeaningContract =
  CompiledFourFrameContract<FourframeMeaningEntry>;

export interface FourframeCatalogProvenance {
  readonly schemaVersion: 'namespring.fourframe-meaning-catalog/v1';
  readonly snapshotVersion: string;
  readonly sourcePath: 'namespring/public/data/fourframe.db';
  readonly sourceDatabaseSha256: string;
  readonly canonicalContentSha256: string;
  readonly canonicalization: string;
  readonly rowCount: 81;
}

export const FOURFRAME_CATALOG_PROVENANCE: FourframeCatalogProvenance = deepFreeze({
  ...GENERATED_FOURFRAME_CATALOG_PROVENANCE,
});

const CATALOG_FIELDS = new Set([
  'id',
  'number',
  'title',
  'summary',
  'detailed_explanation',
  'positive_aspects',
  'caution_points',
  'personality_traits',
  'suitable_career',
  'life_period_influence',
  'special_characteristics',
  'challenge_period',
  'opportunity_area',
  'lucky_level',
]);

const REQUIRED_DETAIL_FIELDS = [
  'detailed_explanation',
  'positive_aspects',
  'caution_points',
  'life_period_influence',
  'special_characteristics',
  'challenge_period',
  'opportunity_area',
] as const;

function failCatalog(path: string, reason: string): never {
  throw new Error(`Embedded four-frame catalog is invalid at ${path}: ${reason}`);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return failCatalog(path, 'expected an object');
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== CATALOG_FIELDS.size || keys.some((key) => !CATALOG_FIELDS.has(key))) {
    return failCatalog(path, 'schema fields did not match catalog v1');
  }
  return record;
}

function requirePositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    return failCatalog(path, 'expected a positive safe integer');
  }
  return value;
}

function requireText(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return failCatalog(path, 'expected non-empty text');
  }
  return value;
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return failCatalog(path, 'expected a non-empty string array');
  }
  return value.map((item, index) =>
    requireText(item, `${path}[${index}]`));
}

function compileEmbeddedCatalog(): readonly FourframeMeaningEntry[] {
  const rawText = GENERATED_FOURFRAME_CATALOG_JSON_PARTS.join('');
  const parsed = JSON.parse(rawText) as unknown;
  if (!Array.isArray(parsed)) return failCatalog('root', 'expected an array');

  const records = parsed.map((value, index) => requireRecord(value, `rows[${index}]`));
  const contractInput = records.map((record) => ({
    number: record.number as number,
    title: record.title as string,
    summary: record.summary as string,
    lucky_level: record.lucky_level as string | null,
  }));
  const contract = compileFourFrameContract(contractInput);

  const catalog = records.map((record, index): FourframeMeaningEntry => {
    const contractRecord = contractInput[index];
    const luckyLevel = contract.luckyByNumber.get(contractRecord.number);
    if (!luckyLevel) {
      return failCatalog(`rows[${index}].lucky_level`, 'contract lookup failed');
    }

    const details = Object.fromEntries(
      REQUIRED_DETAIL_FIELDS.map((field) => [
        field,
        requireText(record[field], `rows[${index}].${field}`),
      ]),
    ) as Record<(typeof REQUIRED_DETAIL_FIELDS)[number], string>;

    return {
      id: requirePositiveInteger(record.id, `rows[${index}].id`),
      number: contractRecord.number,
      title: contractRecord.title,
      summary: contractRecord.summary,
      detailed_explanation: details.detailed_explanation,
      positive_aspects: details.positive_aspects,
      caution_points: details.caution_points,
      personality_traits: requireStringArray(
        record.personality_traits,
        `rows[${index}].personality_traits`,
      ),
      suitable_career: requireStringArray(
        record.suitable_career,
        `rows[${index}].suitable_career`,
      ),
      life_period_influence: details.life_period_influence,
      special_characteristics: details.special_characteristics,
      challenge_period: details.challenge_period,
      opportunity_area: details.opportunity_area,
      lucky_level: luckyLevel,
    };
  }).sort((left, right) => left.number - right.number);

  return deepFreeze(catalog);
}

export const FOURFRAME_MEANING_CATALOG = compileEmbeddedCatalog();

export function getFourframeMeaningByNumber(number: number): FourframeMeaningEntry {
  const normalized = normalizeFourFrameNumber(number);
  const entry = FOURFRAME_MEANING_CATALOG[normalized - 1];
  if (!entry || entry.number !== normalized) {
    return failCatalog(`lookup[${normalized}]`, 'compiled index was inconsistent');
  }
  return entry;
}
