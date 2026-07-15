import {
  AUTHORITY_TRUTH_PAYLOAD_ROOTS,
  PANEL_ADJUDICATED_SOURCE_TYPE,
} from './authority-evidence.mjs';
import { canonicalPolicyValue } from './policy-core.mjs';

const KNOWN_AI_SOURCE_TYPES = new Set([
  PANEL_ADJUDICATED_SOURCE_TYPE,
  'ai_authored_insight_text',
  'training_derived',
  'synthetic',
]);

const AI_BOOLEAN_KEYS = new Set([
  'aiGenerated',
  'generatedByAi',
  'generatedByAI',
  'llmGenerated',
  'modelGenerated',
  'machineGenerated',
  'isAiGenerated',
  'generatedWithAI',
  'authoredWithAI',
]);

const EXPLICIT_AI_MODEL_KEYS = new Set([
  'ai_model',
  'aiModel',
  'llmModel',
]);

const AI_PROVENANCE_KEYS = new Set([
  'kind',
  'provenance',
  'sourceType',
  'generator',
  'provider',
  'status',
  'generatedBy',
  'createdBy',
  'tier',
]);

const AI_MODEL_VALUE_KEYS = new Set([
  'model',
  'models',
  'modelProvider',
]);

const AI_DISCLOSURE_TEXT_KEYS = new Set([
  'humanInterpretation',
  'copyrightNote',
]);

function valueMarksAiProvenance(value) {
  const canonical = canonicalPolicyValue(value);
  if (!canonical) return false;
  if (KNOWN_AI_SOURCE_TYPES.has(canonical)) return true;
  const tokens = canonical.split('_').filter(Boolean);
  if (tokens.some((token) =>
    /^(ai|llm|gpt\d*|chatgpt\d*|openai|anthropic|claude\d*|deepseek\d*|gemini\d*|o\d+|qwen\d*)$/.test(token))) {
    return true;
  }
  if (tokens.includes('synthetic')) return true;
  if (tokens.includes('training') && tokens.includes('derived')) return true;
  const generatedAction = tokens.some((token) =>
    ['authored', 'derived', 'drafted', 'generated', 'output', 'source', 'extract'].includes(token));
  return generatedAction && tokens.some((token) => token === 'model' || token === 'machine');
}

function disclosureTextMarksAiAuthorship(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.normalize('NFKC');
  const withoutNegatedClaims = normalized
    .replace(/\b(?:not|without)\s+(?:AI|LLM|model)[ -]?(?:generated|authored|derived)\b/gi, '')
    .replace(/\bnot\s+(?:generated|authored|derived|drafted|written)\s+(?:by|with)\s+(?:AI|LLM|ChatGPT|OpenAI|Anthropic|Claude\d*|Gemini\d*|GPT\d*)\b/gi, '')
    .replace(/\b(?:AI|LLM|model)[ -]?generated\s+claims?\s+(?:are|is)\s+excluded\b/gi, '');
  return [
    /\b(?:AI|LLM|model)[ -]?(?:assisted|generated|authored|derived|drafted)\b/i,
    /\b(?:generated|authored|derived|drafted|written)\s+(?:by|with)\s+(?:AI|LLM|ChatGPT|OpenAI|Anthropic|Claude\d*|Gemini\d*|GPT\d*)\b/i,
    /(?:AI|인공지능)(?:가|이)?\s*(?:작성|생성|초안|보조)/i,
  ].some((pattern) => pattern.test(withoutNegatedClaims));
}

function isAuthorityPayloadPath(currentPath) {
  return AUTHORITY_TRUTH_PAYLOAD_ROOTS.some((prefix) =>
    currentPath === prefix ||
    currentPath.startsWith(prefix + '.') ||
    currentPath.startsWith(prefix + '['));
}

function isGenerationMetadataKey(key, value) {
  const canonical = canonicalPolicyValue(key);
  const tokens = canonical.split('_').filter(Boolean);
  if (tokens.some((token) => [
    'ai',
    'generation',
    'generator',
    'generators',
    'llm',
    'model',
    'models',
  ].includes(token))) {
    return true;
  }
  if (
    tokens.some((token) => ['engine', 'system', 'tool'].includes(token)) &&
    typeof value === 'string' &&
    valueMarksAiProvenance(value)
  ) {
    return true;
  }
  return /^(generated|created|authored|produced|written)_(by|with)$/.test(canonical);
}

function isProvenanceValueKey(key) {
  if (AI_PROVENANCE_KEYS.has(key)) return true;
  const canonical = canonicalPolicyValue(key);
  return [
    'generator',
    'provider',
    'status',
    'generated_by',
    'generated_with',
    'created_by',
    'authored_by',
  ].includes(canonical);
}

export function findAmbiguousGenerationMetadata(record) {
  const paths = [];
  const seen = new WeakSet();
  function visit(value, currentPath, isRoot = false) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, currentPath + '[' + index + ']'));
      return;
    }
    if (
      !isRoot &&
      !isAuthorityPayloadPath(currentPath) &&
      value.sourceTier &&
      typeof value.sourceTier === 'object' &&
      !Array.isArray(value.sourceTier)
    ) {
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      const itemPath = currentPath + '.' + key;
      if (
        isGenerationMetadataKey(key, item) &&
        item !== null &&
        item !== false &&
        item !== '' &&
        !(currentPath.endsWith('.panelAdjudication') && key === 'models')
      ) {
        paths.push(itemPath);
      }
      visit(item, itemPath);
    }
  }
  visit(record, '$', true);
  return paths;
}

export function classifyAiProvenance(record) {
  const sourceTier = record?.sourceTier ?? record;
  const rawSourceType = typeof sourceTier?.sourceType === 'string'
    ? sourceTier.sourceType
    : '';
  const sourceType = rawSourceType.trim();
  const reasons = [];
  if (valueMarksAiProvenance(sourceType)) {
    reasons.push(record?.sourceTier ? '$.sourceTier.sourceType' : '$.sourceType');
  }

  const seen = new WeakSet();
  function visit(value, currentPath, isRoot = false) {
    if (!value || typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, currentPath + '[' + index + ']'));
      return;
    }
    if (
      !isRoot &&
      !isAuthorityPayloadPath(currentPath) &&
      value.sourceTier &&
      typeof value.sourceTier === 'object' &&
      !Array.isArray(value.sourceTier)
    ) {
      return;
    }
    for (const [key, item] of Object.entries(value)) {
      const itemPath = currentPath + '.' + key;
      const canonicalKey = canonicalPolicyValue(key);
      const keyTokens = canonicalKey.split('_').filter(Boolean);
      const semanticAiBoolean =
        keyTokens.some((token) => token === 'ai' || token === 'llm') &&
        keyTokens.some((token) =>
          ['assisted', 'authored', 'derived', 'drafted', 'generated'].includes(token));
      if ((AI_BOOLEAN_KEYS.has(key) || semanticAiBoolean) && item === true) {
        reasons.push(itemPath);
      }
      if (key === 'panelAdjudication' && item !== null && item !== undefined) {
        reasons.push(itemPath);
      }
      if (EXPLICIT_AI_MODEL_KEYS.has(key) && item !== null && item !== false && item !== '') {
        reasons.push(itemPath);
      }
      if (
        isProvenanceValueKey(key) &&
        typeof item === 'string' &&
        valueMarksAiProvenance(item)
      ) {
        reasons.push(itemPath);
      }
      if (AI_MODEL_VALUE_KEYS.has(key)) {
        const values = Array.isArray(item) ? item : [item];
        if (values.some((model) => typeof model === 'string' && valueMarksAiProvenance(model))) {
          reasons.push(itemPath);
        }
      }
      if (
        AI_DISCLOSURE_TEXT_KEYS.has(key) &&
        disclosureTextMarksAiAuthorship(item)
      ) {
        reasons.push(itemPath);
      }
      visit(item, itemPath);
    }
  }
  visit(record, '$', true);
  return {
    isAiDerived: new Set(reasons).size > 0,
    isPanelAdjudicated: rawSourceType === PANEL_ADJUDICATED_SOURCE_TYPE,
    sourceType,
    reasons: [...new Set(reasons)],
  };
}
