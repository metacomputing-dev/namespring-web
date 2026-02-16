import { RuleCitationRegistry, citationInlineDetailed } from './RuleCitationRegistry.js';

export function sentenceCite(ruleId: string): string {
  const citation = RuleCitationRegistry.forSentence(ruleId);
  return citation ? citationInlineDetailed(citation) : '';
}
