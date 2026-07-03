import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SPRING_TS_ROOT = path.resolve(__dirname, '..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const OUT_DIR = path.resolve(REPO_ROOT, 'artifacts/p40-paid-ui-samples');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr.startsWith('https://sql.js.org/') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url, options);
};

import { SpringEngine } from '../src/index.js';

const PERIODS = ['today', 'thisWeek', 'thisMonth', 'thisYear', 'life'] as const;
const CATEGORIES = [
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
] as const;
const LIFE_STAGE_BANDS = ['10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-99', '100-109'] as const;

const PERIOD_LABELS: Record<string, string> = {
  today: '오늘',
  thisWeek: '이번 주',
  thisMonth: '이번 달',
  thisYear: '올해',
  life: '인생 전체',
};
const CATEGORY_LABELS: Record<string, string> = {
  overall: '총운',
  wealth: '돈과 물건 관리',
  health: '몸과 마음',
  academic: '공부 흐름',
  romance: '관계와 마음',
  family: '가족 관계',
  career: '진로/직업',
  study_document: '기록과 준비',
  expression_children: '표현과 창의력',
  health_stress: '긴장과 회복',
  movement: '이동과 변화',
};

const samples = [
  {
    label: 'adult-choi-1994',
    displayName: '최하윤',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1994, month: 9, day: 16, hour: 0, minute: 35, gender: 'female' as const },
    surname: [{ hangul: '최', hanja: '崔' }],
    givenName: [{ hangul: '하', hanja: '夏' }, { hangul: '윤', hanja: '潤' }],
  },
  {
    label: 'adult-park-1962',
    displayName: '박지우',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1962, month: 12, day: 27, hour: 21, minute: 5, gender: 'female' as const },
    surname: [{ hangul: '박', hanja: '朴' }],
    givenName: [{ hangul: '지', hanja: '智' }, { hangul: '우', hanja: '祐' }],
  },
  {
    label: 'senior-jung-1954',
    displayName: '정도현',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1954, month: 4, day: 4, hour: 9, minute: 50, gender: 'male' as const },
    surname: [{ hangul: '정', hanja: '鄭' }],
    givenName: [{ hangul: '도', hanja: '度' }, { hangul: '현', hanja: '賢' }],
  },
  {
    label: 'adult-kim-1971',
    displayName: '김민준',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1971, month: 2, day: 18, hour: 6, minute: 20, gender: 'male' as const },
    surname: [{ hangul: '김', hanja: '金' }],
    givenName: [{ hangul: '민', hanja: '旻' }, { hangul: '준', hanja: '俊' }],
  },
  {
    label: 'adult-lee-1988',
    displayName: '이서현',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1988, month: 7, day: 9, hour: 14, minute: 15, gender: 'female' as const },
    surname: [{ hangul: '이', hanja: '李' }],
    givenName: [{ hangul: '서', hanja: '瑞' }, { hangul: '현', hanja: '賢' }],
  },
  {
    label: 'adult-kang-1977',
    displayName: '강유진',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1977, month: 5, day: 30, hour: 18, minute: 10, gender: 'male' as const },
    surname: [{ hangul: '강', hanja: '姜' }],
    givenName: [{ hangul: '유', hanja: '有' }, { hangul: '진', hanja: '珍' }],
  },
  {
    label: 'senior-yoon-1948',
    displayName: '윤서진',
    targetDate: '2026-05-01T00:00:00+09:00',
    birth: { year: 1948, month: 10, day: 2, hour: 11, minute: 40, gender: 'female' as const },
    surname: [{ hangul: '윤', hanja: '尹' }],
    givenName: [{ hangul: '서', hanja: '瑞' }, { hangul: '진', hanja: '珍' }],
  },
];

function renderTokens(paragraph: any): string {
  const tokens = Array.isArray(paragraph?.tokens) ? paragraph.tokens : [];
  if (!tokens.length) return String(paragraph?.plainText ?? '').trim();
  return tokens.map((token: any) => {
    if (token?.kind === 'tag') return `#${token.label ?? token.tagId ?? ''}`;
    return String(token?.value ?? '');
  }).join('').trim();
}

function renderParagraphs(lines: string[], title: string, paragraphs: any[] | undefined): void {
  lines.push(`#### ${title}`);
  const values = (paragraphs ?? []).map(renderTokens).filter(Boolean);
  if (!values.length) {
    lines.push('- 없음');
    return;
  }
  values.forEach((text, index) => {
    lines.push(`${index + 1}. ${text}`);
  });
}

function renderList(lines: string[], title: string, values: any[] | undefined): void {
  const list = (values ?? []).map((value) => String(value ?? '').trim()).filter(Boolean);
  if (!list.length) return;
  lines.push(`#### ${title}`);
  list.forEach((value) => lines.push(`- ${value}`));
}

function starText(stars: number | null | undefined): string {
  if (stars == null) return '해당 없음';
  return `${stars}/5`;
}

function renderPeriodMeta(meta: any): string {
  const chunks: string[] = [];
  if (meta?.relativeNote) chunks.push(String(meta.relativeNote));
  const stems = (meta?.stems ?? []).map((row: any) => `${row.position}:${row.stem}/${row.element}`);
  const branches = (meta?.branches ?? []).map((row: any) => `${row.position}:${row.branch}/${row.element}`);
  if (stems.length) chunks.push(`천간 ${stems.join(', ')}`);
  if (branches.length) chunks.push(`지지 ${branches.join(', ')}`);
  return chunks.join(' | ');
}

function renderEvidence(lines: string[], rows: any[] | undefined): void {
  const values = (rows ?? []).filter(Boolean);
  if (!values.length) return;
  lines.push('#### 수치 근거');
  for (const row of values) {
    const unit = row.unit ? String(row.unit) : '';
    lines.push(`- ${row.label}: ${row.value}${unit}`);
  }
}

function renderCell(lines: string[], heading: string, cell: any, level = 3): void {
  const prefix = '#'.repeat(level);
  lines.push(`${prefix} ${heading}`);
  lines.push(`- 의미도: ${cell?.meaningfulness ?? '없음'}`);
  lines.push(`- 별점: ${starText(cell?.stars)}`);
  if (cell?.brief?.headline) lines.push(`- 요약: ${cell.brief.headline}`);
  if (cell?.brief?.hook) lines.push(`- 한 줄 훅: ${cell.brief.hook}`);
  renderParagraphs(lines, '일반 해설', cell?.standard?.paragraphs ?? []);
  renderList(lines, '생활 팁', cell?.standard?.livingTips);
  renderList(lines, '주의할 점', cell?.standard?.cautions);
  renderParagraphs(lines, '전문가 근거', cell?.expert?.paragraphs ?? []);
  renderEvidence(lines, cell?.expert?.numericalEvidence);
  lines.push('');
}

function renderPeriod(lines: string[], periodKey: string, period: any): void {
  lines.push(`## ${PERIOD_LABELS[periodKey] ?? periodKey} - ${period?.periodLabel ?? ''}`.trim());
  const meta = renderPeriodMeta(period?.periodMeta);
  if (meta) lines.push(`- 기간 근거: ${meta}`);
  renderCell(lines, '총운', period?.overall, 3);
  for (const category of CATEGORIES) {
    renderCell(lines, CATEGORY_LABELS[category] ?? category, period?.byCategory?.[category], 3);
  }
}

function renderLifeBands(lines: string[], lifePeriod: any): void {
  lines.push('## 인생 전체 - 10년 단위 상세');
  for (const band of LIFE_STAGE_BANDS) {
    const scoped = lifePeriod?.byAgeBand?.[band];
    if (!scoped) continue;
    lines.push(`### ${band}세 - ${scoped.periodLabel ?? ''}`.trim());
    lines.push(`- 선택 연령대: ${scoped.ageBand}, 대표 나이: ${scoped.representativeAge}`);
    const meta = renderPeriodMeta(scoped.periodMeta);
    if (meta) lines.push(`- 기간 근거: ${meta}`);
    renderCell(lines, `${band}세 총운`, scoped.overall, 4);
    for (const category of CATEGORIES) {
      renderCell(lines, `${band}세 ${CATEGORY_LABELS[category] ?? category}`, scoped.byCategory?.[category], 4);
    }
  }
}

function renderGlossary(lines: string[], glossary: any): void {
  lines.push('## 전문가 태그 풀이');
  const used = glossary?.usedInThisReport ?? [];
  const entries = glossary?.entries ?? {};
  if (!used.length) {
    lines.push('- 사용된 태그 없음');
    return;
  }
  for (const tagId of used) {
    const entry = entries[tagId];
    if (!entry) continue;
    lines.push(`### ${entry.hashLabel ?? `#${entry.label ?? tagId}`}`);
    lines.push(`- 분류: ${entry.category ?? ''}`);
    if (entry.brief) lines.push(`- 짧은 풀이: ${entry.brief}`);
    if (entry.detailed) lines.push(`- 자세한 풀이: ${String(entry.detailed).replace(/\n+/g, ' / ')}`);
    const related = (entry.related ?? []).filter(Boolean);
    if (related.length) lines.push(`- 관련 태그: ${related.map((id: string) => entries[id]?.hashLabel ?? `#${id}`).join(', ')}`);
  }
}

function renderNamingEvidence(lines: string[], evidence: any): void {
  if (!evidence) return;
  lines.push('## 이름 수리 근거');
  lines.push(`- 종합 수리 점수: ${evidence.fourFrameScore}`);
  lines.push(`- 길흉 점수: ${evidence.luckScore}`);
  lines.push(`- 오행 점수: ${evidence.elementScore}`);
  for (const frame of evidence.frames ?? []) {
    lines.push(`### ${frame.label}`);
    lines.push(`- 획수: ${frame.strokeSum}`);
    lines.push(`- 오행: ${frame.elementLabel ?? frame.element}`);
    lines.push(`- 음양: ${frame.polarity}`);
    lines.push(`- 길흉 단계: ${frame.luckyLevel}`);
    if (frame.title) lines.push(`- 제목: ${frame.title}`);
    if (frame.summary) lines.push(`- 요약: ${frame.summary}`);
    if (frame.lifePeriodInfluence) lines.push(`- 생애 영향: ${frame.lifePeriodInfluence}`);
  }
}

function compactPreview(tm: any): string[] {
  const keys: Array<[string, string, any]> = [
    ['올해', '진로/직업', tm?.periods?.thisYear?.byCategory?.career],
    ['인생 전체 50-59세', '공부 흐름', tm?.periods?.life?.byAgeBand?.['50-59']?.byCategory?.academic],
    ['인생 전체 90-99세', '이동과 변화', tm?.periods?.life?.byAgeBand?.['90-99']?.byCategory?.movement],
  ];
  const lines: string[] = [];
  for (const [period, category, cell] of keys) {
    if (!cell) continue;
    lines.push(`## ${period} / ${category}`);
    lines.push(`- 별점: ${starText(cell.stars)} / 의미도: ${cell.meaningfulness}`);
    lines.push(`- 요약: ${cell.brief?.headline ?? ''}`);
    const standard = (cell.standard?.paragraphs ?? []).slice(0, 3).map(renderTokens);
    standard.forEach((text, index) => lines.push(`일반 ${index + 1}. ${text}`));
    const expert = (cell.expert?.paragraphs ?? []).slice(0, 2).map(renderTokens);
    expert.forEach((text, index) => lines.push(`전문 ${index + 1}. ${text}`));
    lines.push('');
  }
  return lines;
}

async function main(): Promise<void> {
const engine = new SpringEngine();
for (const repo of [(engine as any).hanjaRepo, (engine as any).fourFrameRepo]) {
  if (repo) (repo as any).wasmUrl = WASM_PATH;
}
await engine.init();

const indexLines: string[] = [
  '# P40 유료 UI 실제 출력 샘플',
  '',
  '이 파일들은 `precisionConfig.surfaceTieredMatrix=true`로 생성한 실제 `tieredMatrix` 고객 노출 텍스트입니다.',
  '내부 QA용 fragment id/selection seed는 제외했고, 고객 화면에서 보일 수 있는 요약, 일반 해설, 전문가 근거, 수치 근거, 태그 풀이, 이름 수리 근거를 담았습니다.',
  '',
];

for (const sample of samples) {
  const request = {
    targetDate: sample.targetDate,
    birth: sample.birth,
    surname: sample.surname,
    givenName: sample.givenName,
    options: { precisionConfig: { surfaceTieredMatrix: true } },
  };
  const report: any = await engine.getFortuneReport(request);
  const tm = report?.tieredMatrix;
  const fullLines: string[] = [];
  fullLines.push(`# 유료 UI 샘플 - ${sample.label}`);
  fullLines.push('');
  fullLines.push('## 입력 정보');
  fullLines.push(`- 표시 이름: ${sample.displayName}`);
  fullLines.push(`- 성명 한자: ${sample.surname.map((x) => `${x.hangul}(${x.hanja})`).join('')}${sample.givenName.map((x) => `${x.hangul}(${x.hanja})`).join('')}`);
  fullLines.push(`- 생년월일시: ${sample.birth.year}-${String(sample.birth.month).padStart(2, '0')}-${String(sample.birth.day).padStart(2, '0')} ${String(sample.birth.hour).padStart(2, '0')}:${String(sample.birth.minute).padStart(2, '0')}`);
  fullLines.push(`- 성별: ${sample.birth.gender}`);
  fullLines.push(`- 기준일: ${sample.targetDate}`);
  fullLines.push('');
  fullLines.push('## 표시 항목 안내');
  fullLines.push('- 각 셀은 `요약`, `일반 해설`, `전문가 근거`, 필요 시 `수치 근거`, `생활 팁`, `주의할 점`으로 구성됩니다.');
  fullLines.push('- `standard`에는 태그를 노출하지 않고, `expert`에는 태그를 `#태그` 형태로 노출합니다.');
  fullLines.push('');
  for (const period of PERIODS) renderPeriod(fullLines, period, tm?.periods?.[period]);
  renderLifeBands(fullLines, tm?.periods?.life);
  renderNamingEvidence(fullLines, tm?.namingEvidence);
  renderGlossary(fullLines, tm?.glossary);

  const fullPath = path.join(OUT_DIR, `${sample.label}-full-paid-ui.md`);
  fs.writeFileSync(fullPath, fullLines.join('\n'), 'utf8');

  const previewLines = [`# 핵심 미리보기 - ${sample.label}`, '', ...compactPreview(tm)];
  const previewPath = path.join(OUT_DIR, `${sample.label}-preview.md`);
  fs.writeFileSync(previewPath, previewLines.join('\n'), 'utf8');

  const relativeFull = path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
  const relativePreview = path.relative(REPO_ROOT, previewPath).replace(/\\/g, '/');
  indexLines.push(`## ${sample.label}`);
  indexLines.push(`- 전체 UI 샘플: ${relativeFull}`);
  indexLines.push(`- 핵심 미리보기: ${relativePreview}`);
  indexLines.push(`- 전체 줄 수: ${fullLines.length}`);
  indexLines.push('');
  console.log(`${sample.label}\t${fullPath}\tlines=${fullLines.length}`);
}

fs.writeFileSync(path.join(OUT_DIR, 'README.md'), indexLines.join('\n'), 'utf8');
engine.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});