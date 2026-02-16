import { ClassicalSource, CLASSICAL_SOURCE_INFO } from '../domain/ClassicalSource.js';
import { REGISTRY, SENTENCE_REGISTRY } from './RuleCitationRegistryData.js';

export interface RuleCitation {
  readonly sources: readonly ClassicalSource[];
  readonly topic: string;
  readonly note: string;
  readonly confidence: number;
}

export function createRuleCitation(
  sources: ClassicalSource | readonly ClassicalSource[],
  topic: string,
  note: string = '',
  confidence: number = 0,
): RuleCitation {
  return {
    sources: Array.isArray(sources) ? sources : [sources],
    topic,
    note,
    confidence,
  };
}

function sourceLabels(citation: RuleCitation): string {
  return citation.sources.map(source => CLASSICAL_SOURCE_INFO[source].shortLabel).join('+');
}

export function citationInline(citation: RuleCitation): string {
  const sourceNames = sourceLabels(citation);
  return `[출처: ${sourceNames} — ${citation.topic}]`;
}

export function citationInlineDetailed(citation: RuleCitation): string {
  if (citation.confidence <= 0) return citationInline(citation);
  const sourceNames = sourceLabels(citation);
  return `[근거: ${sourceNames} — ${citation.topic}, 신뢰도 ${citation.confidence}%]`;
}

export function citationTraceForm(citation: RuleCitation): string {
  const sourceNames = sourceLabels(citation);
  return `${sourceNames}:${citation.topic}`;
}

type CitationIndexBySource = ReadonlyMap<ClassicalSource, ReadonlyMap<string, RuleCitation>>;

function buildCitationIndexBySource(
  registry: ReadonlyMap<string, RuleCitation>,
): CitationIndexBySource {
  const index = new Map<ClassicalSource, Map<string, RuleCitation>>();
  for (const [key, citation] of registry) {
    for (const source of citation.sources) {
      const bucket = index.get(source) ?? new Map<string, RuleCitation>();
      bucket.set(key, citation);
      index.set(source, bucket);
    }
  }
  return index;
}

const REGISTRY_BY_SOURCE = buildCitationIndexBySource(REGISTRY);


export const RuleCitationRegistry = {
  forKey(key: string): RuleCitation | null {
    return REGISTRY.get(key) ?? null;
  },

  forSentence(ruleId: string): RuleCitation | null {
    return SENTENCE_REGISTRY.get(ruleId) ?? null;
  },

  all(): ReadonlyMap<string, RuleCitation> {
    return REGISTRY;
  },

  allSentence(): ReadonlyMap<string, RuleCitation> {
    return SENTENCE_REGISTRY;
  },

  forSource(source: ClassicalSource): Map<string, RuleCitation> {
    return new Map(REGISTRY_BY_SOURCE.get(source) ?? []);
  },
} as const;

