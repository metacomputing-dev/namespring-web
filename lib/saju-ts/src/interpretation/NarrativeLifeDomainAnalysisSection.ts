import { ClassicalSource, inlineCitation } from '../domain/ClassicalSource.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import { interpretLifeDomains } from './LifeDomainInterpreter.js';

export const DOMAIN_CITATIONS: Record<string, string> = {
  '재물운(財物運)': `${inlineCitation(ClassicalSource.JEOKCHEONSU)} ${inlineCitation(ClassicalSource.YEONHAEJAYPYEONG)}`,
  '직업운(職業運)': `${inlineCitation(ClassicalSource.JAPYEONGJINJEON)} ${inlineCitation(ClassicalSource.JEOKCHEONSU)}`,
  '건강운(健康運)': `${inlineCitation(ClassicalSource.SAMMYEONGTTONGHOE)}`,
  '연애/결혼운(戀愛運)': `${inlineCitation(ClassicalSource.YEONHAEJAYPYEONG)} ${inlineCitation(ClassicalSource.JEOKCHEONSU)}`,
};

export function buildLifeDomainAnalysis(a: SajuAnalysis): string {
  const readings = interpretLifeDomains(a);
  const lines: string[] = [];
  lines.push('■ 생활영역별 운세 분석');
  lines.push('');

  for (const reading of readings) {
    const cite = DOMAIN_CITATIONS[reading.domain] ?? '';
    lines.push(`【${reading.domain}】 ${cite}`.trimEnd());
    lines.push(`  ${reading.overview}`);
    for (const detail of reading.details) {
      lines.push(`  · ${detail}`);
    }
    lines.push(`  → ${reading.advice}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

