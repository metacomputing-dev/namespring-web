import { normalizeRenderedText, compressBriefHeadlineIfApplicable } from '../../src/report/tiered/template-engine.ts';

const candidates = [
  '이번 달은 사람과의 결이 차분히 정돈되는 흐름이에요.',
  '이번 달은 사람과의 리듬이 차분히 정돈되는 흐름이에요.',
  '이번 달은 사람과의 호흡이 차분히 정돈되는 흐름이에요.',
  '이번 달은 사람과의 자리가 차분히 정돈되는 흐름이에요.',
];
for (const c of candidates) {
  const norm = normalizeRenderedText(c);
  const out = compressBriefHeadlineIfApplicable(norm);
  console.log('IN  (' + [...c].length + '):', c);
  console.log('NRM (' + [...norm].length + '):', norm);
  console.log('OUT (' + [...out].length + '):', out);
  const matches = out.match(/결(?:입니다|이에요|이라|이고|로|처럼|마다|이|은|을|도|만)(?![가-힣])/g) || [];
  console.log('  doubled-gyeol-i:', matches.length >= 2 ? 'YES (' + matches.length + ')' : 'no (' + matches.length + ')');
  console.log('');
}
