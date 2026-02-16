import { type AnalysisTraceStep } from '../../domain/types.js';
import { RuleCitationRegistry, type RuleCitation } from '../../interpretation/RuleCitationRegistry.js';

function citationList(ruleCitation: RuleCitation | null | undefined): string[] {
  return ruleCitation ? [formatCitation(ruleCitation)] : [];
}

function confidenceForKey(key: string, ruleCitation: RuleCitation | null): number | null {
  const sentenceConfidence = maxSentenceConfidenceForKey(key);
  if (sentenceConfidence !== undefined) return sentenceConfidence;
  return ruleCitation && ruleCitation.confidence > 0 ? ruleCitation.confidence : null;
}

export function formatCitation(citation: RuleCitation): string {
  const sourceList = citation.sources.join(', ');
  return `[근거: ${sourceList} — ${citation.topic}, 신뢰도 ${Math.round(citation.confidence * 100)}%]`;
}

export function tracedStep(
  key: string,
  summary: string,
  evidence: readonly string[] = [],
  reasoning: readonly string[] = [],
): AnalysisTraceStep {
  const ruleCitation = RuleCitationRegistry.forKey(key);
  const citations = citationList(ruleCitation);

  const confidence = confidenceForKey(key, ruleCitation);

  return { key, summary, evidence: [...evidence], citations, reasoning: [...reasoning], confidence };
}

function maxSentenceConfidenceForKey(key: string): number | undefined {
  const keyPrefix = `${key}.`;
  let maxSentenceConfidence: number | undefined;
  for (const [sentenceKey, sentenceCitation] of RuleCitationRegistry.allSentence()) {
    if (!sentenceKey.startsWith(keyPrefix)) continue;
    if (maxSentenceConfidence === undefined || sentenceCitation.confidence > maxSentenceConfidence) {
      maxSentenceConfidence = sentenceCitation.confidence;
    }
  }
  return maxSentenceConfidence;
}

export function detectAndTrace<T>(
  trace: AnalysisTraceStep[],
  detector: () => T,
  buildTraceStep: (detected: T) => AnalysisTraceStep,
): T {
  const detected = detector();
  trace.push(buildTraceStep(detected));
  return detected;
}

