import { ClassicalSource, CLASSICAL_SOURCE_INFO } from '../domain/ClassicalSource.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import { RuleCitationRegistry } from './RuleCitationRegistry.js';

export function buildSourceBibliography(a: SajuAnalysis): string {
  const usedSources = new Set<ClassicalSource>();
  for (const step of a.trace) {
    const citation = RuleCitationRegistry.forKey(step.key);
    if (citation) {
      for (const src of citation.sources) {
        usedSources.add(src);
      }
    }
  }

  if (usedSources.size === 0) return '';

  const lines: string[] = [];
  lines.push('■ 참고 원전(出典)');
  lines.push('');

  const allSources = Object.values(ClassicalSource) as ClassicalSource[];
  for (const source of allSources) {
    if (!usedSources.has(source)) continue;
    const info = CLASSICAL_SOURCE_INFO[source];
    lines.push(`  · ${info.koreanName}`);
    lines.push(`    ${info.description}`);
    lines.push(`    시대: ${info.era}`);

    const relatedCitations = RuleCitationRegistry.forSource(source);
    const topics = [...new Set(Object.values(relatedCitations).map(c => c.topic))];
    if (topics.length > 0) {
      lines.push(`    본 보고서 적용: ${topics.join(', ')}`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

