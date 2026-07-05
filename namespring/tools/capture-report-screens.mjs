// 통합 리포트 스크린샷 캡처 — 입력 플로우(데모: 최성수 崔成秀 1986-04-19 05:45 남)를
// 자동 재생해 나이대별/인사이트 섹션을 파일로 저장한다. PR 캡처 갱신용.
// PR #649 스크린샷 캡처 — 실제 입력 플로우 재생 후 섹션별 캡처
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

// 사용: node namespring/tools/capture-report-screens.mjs <출력디렉터리> [베이스URL]
// 전제: dev 서버 실행 중(vite, 기본 http://localhost:5173) + Chrome 설치 +
//       임시로 npm i puppeteer-core (레포 deps에 넣지 않음 — 일회성).
const OUT = process.argv[2] || 'docs/pr/_screens';
const BASE = process.argv[3] || 'http://localhost:5173';
fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function runFlow(page) {
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('input[placeholder="성"]', { timeout: 30000 });
  await page.type('input[placeholder="성"]', '최', { delay: 40 });
  await page.type('input[placeholder="이름"]', '성수', { delay: 40 });
  await wait(300);

  await page.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const click = (el) => { if (!el) return false; ['pointerdown','mousedown','pointerup','mouseup','click'].forEach((ev) => el.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true }))); return true; };
    const byText = (txt, exact) => [...document.querySelectorAll('button')].find((b) => exact ? b.textContent.trim() === txt : b.textContent.includes(txt));
    for (const han of ['崔', '成', '秀']) {
      const pickers = [...document.querySelectorAll('button')].filter((b) => b.textContent.includes('한자 고르기'));
      if (!pickers.length) break;
      click(pickers[0]); await w(450);
      click([...document.querySelectorAll('button,li,[role=option]')].find((e) => e.textContent.includes(han))); await w(450);
    }
    click(byText('YYYY')); await w(550);
    click(byText('1986년', true)); await w(450);
    const prev = () => click([...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || '').includes('Previous Month')));
    for (let i = 0; i < 3; i++) { prev(); await w(220); }
    click([...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === '19')[0]); await w(450);
    click(byText('05시', true)); await w(250);
    click(byText('45분', true)); await w(250);
    click(byText('적용', true)); await w(500);
    click(byText('남성', true)); await w(350);
    click(byText('시작하기', true));
  });

  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((x) => x.textContent.includes('통합 평가 보고서')), { timeout: 30000 });
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.textContent.includes('통합 평가 보고서')).click(); });
  await page.waitForSelector('.cr-life-chart svg', { timeout: 90000 });
  await page.waitForSelector('#combined-insights', { timeout: 30000 });
  await wait(800);
}

async function clipShot(page, fromSel, toSel, file, pad = 12) {
  const box = await page.evaluate((a, b) => {
    const ea = document.querySelector(a); const eb = document.querySelector(b);
    if (!ea || !eb) return null;
    const ra = ea.getBoundingClientRect(); const rb = eb.getBoundingClientRect();
    const top = Math.min(ra.top, rb.top) + window.scrollY;
    const bottom = Math.max(ra.bottom, rb.bottom) + window.scrollY;
    const left = Math.min(ra.left, rb.left) + window.scrollX;
    const right = Math.max(ra.right, rb.right) + window.scrollX;
    return { x: left, y: top, width: right - left, height: bottom - top };
  }, fromSel, toSel);
  if (!box) { console.log('clip miss', file); return; }
  await page.screenshot({ path: path.join(OUT, file), clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 } });
  console.log('saved', file);
}

async function elementShot(page, sel, file) {
  const el = await page.$(sel);
  if (!el) { console.log('miss', file); return; }
  await el.screenshot({ path: path.join(OUT, file) });
  console.log('saved', file);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars'],
    defaultViewport: { width: 1000, height: 900 },
  });
  const page = await browser.newPage();
  await runFlow(page);

  // 1) 라이프 커브 + 기본 선택 대운(요약까지)
  await page.evaluate(() => document.getElementById('combined-life-flow').scrollIntoView());
  await wait(400);
  await clipShot(page, '#combined-life-flow .cr-life-flow', '#combined-life-flow .cr-period-summary', 'lifeflow-curve.png');

  // 2) 역풍 대운(을미 25~35, ★2) 클릭 — 등급이 서사에 실리는 증거
  await page.evaluate(() => {
    const dots = [...document.querySelectorAll('.cr-life-chart .cr-life-chart__point')];
    dots[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await wait(600);
  await clipShot(page, '#combined-life-flow .cr-life-flow', '#combined-life-flow .cr-period-summary', 'lifeflow-daeun-low.png');

  // 3) 전문 인사이트 — 하이라이트(접힌 기본 상태)
  await page.evaluate(() => document.getElementById('combined-insights').scrollIntoView());
  await wait(400);
  await elementShot(page, '#combined-insights', 'insights-highlights.png');

  // 4) 펼침 — 칩 클라우드(주요도 농도) + 상세 패널 하나
  await page.evaluate(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('.cr-insight-toggle')?.click(); await w(400);
    const chip = [...document.querySelectorAll('.cr-insight-chip')].find((c) => c.textContent.includes('묘진해'));
    chip?.click(); await w(300);
  });
  await wait(500);
  await clipShot(page, '.cr-insight-toggle', '.cr-insight-hint', 'insights-chips.png');

  // 5) 모바일(375) — 칩+근접 상세 패널
  await page.setViewport({ width: 375, height: 812 });
  await wait(600);
  await page.evaluate(() => document.getElementById('combined-insights').scrollIntoView());
  await wait(400);
  await clipShot(page, '.cr-insight-toggle', '.cr-insight-hint', 'insights-mobile.png');

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
