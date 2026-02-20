import type { AnalysisBundle } from '../api/types.js';
import type { BranchIdx, PillarIdx, StemIdx } from '../core/cycle.js';
import {
  branchElement,
  branchHanja,
  branchYinYang,
  stemElement,
  stemHanja,
  stemYinYang,
} from '../core/cycle.js';

export type NarrationLanguage = 'ko' | 'en';

export interface NarrationOptions {
  language?: NarrationLanguage;
  /** Max number of shinsal hits to print in the markdown narrative. */
  maxShinsal?: number;
}

export interface NarrationArtifact {
  language: NarrationLanguage;
  markdown: string;
  meta: {
    engineName?: string;
    engineVersion?: string;
    createdAtUtc: string;
  };
}

const ELEMENT_KO: Record<string, string> = {
  WOOD: '목',
  FIRE: '화',
  EARTH: '토',
  METAL: '금',
  WATER: '수',
};

const ELEMENT_EN: Record<string, string> = {
  WOOD: 'Wood',
  FIRE: 'Fire',
  EARTH: 'Earth',
  METAL: 'Metal',
  WATER: 'Water',
};

const YY_KO: Record<string, string> = { YANG: '양', YIN: '음' };
const YY_EN: Record<string, string> = { YANG: 'Yang', YIN: 'Yin' };

function asIsoUtc(ms: unknown): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

function fmtStem(lang: NarrationLanguage, idx: StemIdx): string {
  const h = stemHanja(idx);
  const el = stemElement(idx);
  const yy = stemYinYang(idx);
  const elText = lang === 'ko' ? (ELEMENT_KO[el] ?? el) : (ELEMENT_EN[el] ?? el);
  const yyText = lang === 'ko' ? (YY_KO[yy] ?? yy) : (YY_EN[yy] ?? yy);
  return `${h}(${elText}${yyText})`;
}

function fmtBranch(lang: NarrationLanguage, idx: BranchIdx): string {
  const h = branchHanja(idx);
  const el = branchElement(idx);
  const yy = branchYinYang(idx);
  const elText = lang === 'ko' ? (ELEMENT_KO[el] ?? el) : (ELEMENT_EN[el] ?? el);
  const yyText = lang === 'ko' ? (YY_KO[yy] ?? yy) : (YY_EN[yy] ?? yy);
  return `${h}(${elText}${yyText})`;
}

function fmtPillar(lang: NarrationLanguage, p: PillarIdx): string {
  const stem = fmtStem(lang, p.stem as StemIdx);
  const branch = fmtBranch(lang, p.branch as BranchIdx);
  return `${stem}${branch}`;
}

function pickPillarsFromFacts(bundle: AnalysisBundle): {
  year?: PillarIdx;
  month?: PillarIdx;
  day?: PillarIdx;
  hour?: PillarIdx;
} {
  const facts: any = bundle?.report?.facts ?? {};
  const year = facts['pillars.year'] as any;
  const month = facts['pillars.month'] as any;
  const day = facts['pillars.day'] as any;
  const hour = facts['pillars.hour'] as any;

  const ok = (x: any) => x && typeof x === 'object' && typeof x.stem === 'number' && typeof x.branch === 'number';

  return {
    year: ok(year) ? (year as PillarIdx) : undefined,
    month: ok(month) ? (month as PillarIdx) : undefined,
    day: ok(day) ? (day as PillarIdx) : undefined,
    hour: ok(hour) ? (hour as PillarIdx) : undefined,
  };
}

function mdEscape(text: string): string {
  return text.replace(/([\\`*_{}\[\]()#+\-.!|>])/g, '\\$1');
}

function section(title: string, lines: string[]): string {
  const body = lines.filter(Boolean).join('\n');
  return `## ${title}\n\n${body}\n`;
}

export function buildNarrationArtifact(bundle: AnalysisBundle, opts: NarrationOptions = {}): NarrationArtifact {
  const language: NarrationLanguage = opts.language ?? 'ko';
  const maxShinsal = typeof opts.maxShinsal === 'number' && Number.isFinite(opts.maxShinsal) ? Math.max(0, opts.maxShinsal) : 40;

  const req = bundle?.input?.normalizedRequest as any;
  const pillars = pickPillarsFromFacts(bundle);

  const summary: any = bundle?.summary ?? {};

  const reportFacts: any = bundle?.report?.facts ?? {};
  const ruleFacts: any = reportFacts['rules.facts'] ?? {};
  const yongshinRes: any = reportFacts['rules.yongshin'] ?? {};
  const gyeokgukRes: any = reportFacts['rules.gyeokguk'] ?? {};


  const lines: string[] = [];
  const title = language === 'ko' ? '사주 분석 근거 요약' : 'Saju analysis narration';
  lines.push(`# ${title}`);

  // --- Input
  const inputLines: string[] = [];
  if (req?.birth?.instant) {
    inputLines.push(`- ${language === 'ko' ? '출생 시각' : 'Birth instant'}: ${mdEscape(String(req.birth.instant))}`);
  }
  if (req?.sex) {
    inputLines.push(`- ${language === 'ko' ? '성별' : 'Sex'}: ${mdEscape(String(req.sex))}`);
  }
  if (req?.location && typeof req.location === 'object') {
    const loc = req.location;
    const name = typeof loc.name === 'string' ? loc.name : undefined;
    const lat = typeof loc.lat === 'number' ? loc.lat.toFixed(6) : undefined;
    const lon = typeof loc.lon === 'number' ? loc.lon.toFixed(6) : undefined;
    const parts = [name, lat != null && lon != null ? `${lat}, ${lon}` : undefined].filter(Boolean);
    if (parts.length) inputLines.push(`- ${language === 'ko' ? '출생지' : 'Location'}: ${mdEscape(parts.join(' / '))}`);
  }
  lines.push(section(language === 'ko' ? '입력' : 'Input', inputLines));

  // --- Pillars
  const pillarLines: string[] = [];
  const hasPillars = !!(pillars.year && pillars.month && pillars.day && pillars.hour);
  if (hasPillars) {
    pillarLines.push(`- ${language === 'ko' ? '연주' : 'Year'}: ${fmtPillar(language, pillars.year!)}`);
    pillarLines.push(`- ${language === 'ko' ? '월주' : 'Month'}: ${fmtPillar(language, pillars.month!)}`);
    pillarLines.push(`- ${language === 'ko' ? '일주' : 'Day'}: ${fmtPillar(language, pillars.day!)}`);
    pillarLines.push(`- ${language === 'ko' ? '시주' : 'Hour'}: ${fmtPillar(language, pillars.hour!)}`);
  } else {
    pillarLines.push(`- ${language === 'ko' ? '주요 기둥 정보가 요약에 포함되지 않았습니다.' : 'Pillars were not included in the summary.'}`);
  }
  lines.push(section(language === 'ko' ? '사주 팔자(간지)' : 'Four pillars', pillarLines));

  // --- Strength / Yongshin / Gyeokguk (+ school-oriented details)
  const ruleLines: string[] = [];

  // Strength (신강/신약)
  if (summary?.strength && typeof summary.strength === 'object') {
    const s = summary.strength as any;
    if (typeof s.index === 'number') {
      ruleLines.push(`- ${language === 'ko' ? '신강지수' : 'Strength index'}: ${s.index.toFixed(4)}`);
    }
    if (typeof s.model === 'string') {
      ruleLines.push(`- ${language === 'ko' ? '신강 모델' : 'Strength model'}: ${mdEscape(String(s.model))}`);
    }
    if (s.details?.season && typeof s.details.season === 'object') {
      const se = s.details.season;
      if (typeof se.score === 'number') {
        ruleLines.push(
          `- ${language === 'ko' ? '월령(득령) 점수' : 'Season support score'}: ${se.score.toFixed(3)} (×${typeof se.factor === 'number' ? se.factor.toFixed(3) : '?'})`,
        );
      }
    }
    if (s.details?.roots && typeof s.details.roots === 'object') {
      const rt = s.details.roots;
      if (typeof rt.score === 'number') {
        ruleLines.push(
          `- ${language === 'ko' ? '통근(근/인) 점수' : 'Root support score'}: ${rt.score.toFixed(3)} (×${typeof rt.factor === 'number' ? rt.factor.toFixed(3) : '?'})`,
        );
      }
    }
    if (s.details?.delingdiShi && typeof s.details.delingdiShi === 'object') {
      const dd = s.details.delingdiShi;
      if (dd.deLing && typeof dd.deLing.score === 'number') {
        ruleLines.push(
          `- ${language === 'ko' ? '득령(월령) 점수' : 'De-ling (season)'}: ${dd.deLing.score.toFixed(3)} (×${typeof dd.deLing.factor === 'number' ? dd.deLing.factor.toFixed(3) : '?'})`,
        );
      }
      if (dd.deDi && typeof dd.deDi.score === 'number') {
        ruleLines.push(
          `- ${language === 'ko' ? '득지/통근 점수' : 'De-di (roots)'}: ${dd.deDi.score.toFixed(3)} (norm=${typeof dd.deDi.normalized === 'number' ? dd.deDi.normalized.toFixed(3) : '?'}, ×${typeof dd.deDi.factor === 'number' ? dd.deDi.factor.toFixed(3) : '?'})`,
        );
      }
      if (dd.deShi && typeof dd.deShi.score === 'number') {
        ruleLines.push(
          `- ${language === 'ko' ? '득세/투간 점수' : 'De-shi (heavenly support)'}: ${dd.deShi.score.toFixed(3)} (norm=${typeof dd.deShi.normalized === 'number' ? dd.deShi.normalized.toFixed(3) : '?'}, ×${typeof dd.deShi.factor === 'number' ? dd.deShi.factor.toFixed(3) : '?'})`,
        );
      }
    }
  }

  // Element concentration (일행득기/专旺) signal
  const oneEl = ruleFacts?.patterns?.elements?.oneElement;
  if (oneEl && typeof oneEl === 'object' && oneEl.enabled) {
    const el = oneEl.element ? mdEscape(String(oneEl.element)) : '?';
    const f = typeof oneEl.factor === 'number' ? oneEl.factor.toFixed(3) : '?';
    const zw = typeof (oneEl as any).zhuanwangFactor === 'number' ? (oneEl as any).zhuanwangFactor : null;
    const zc = typeof (oneEl as any).zhuanwangConditionFactor === 'number' ? (oneEl as any).zhuanwangConditionFactor : null;
    const zwExtra =
      zw != null && Number.isFinite(zw) && zw > 0
        ? `, zw=${zw.toFixed(3)}${zc != null && Number.isFinite(zc) ? ` (cond=${zc.toFixed(3)})` : ''}`
        : '';
    if (oneEl.isOneElement) {
      ruleLines.push(`- ${language === 'ko' ? '일행득기 신호' : 'One-element dominance'}: ${el} (factor=${f}${zwExtra})`);
    } else if (typeof oneEl.factor === 'number' && oneEl.factor > 0.15) {
      ruleLines.push(`- ${language === 'ko' ? '오행 편중 신호' : 'Element concentration'}: ${el} (factor=${f}${zwExtra})`);
    }
  }


  // Transformation (合化/화격) signal
  const tf = ruleFacts?.patterns?.transformations;
  const bestTf = tf && typeof tf === 'object' ? (tf as any).best : null;
  if (tf && typeof tf === 'object' && (tf as any).enabled && bestTf && typeof bestTf.factor === 'number') {
    const f = bestTf.factor.toFixed(3);
    const raw = typeof bestTf.rawFactor === 'number' ? bestTf.rawFactor.toFixed(3) : null;
    const br = typeof bestTf.breakFactor === 'number' ? bestTf.breakFactor.toFixed(3) : null;
    const comp = typeof bestTf.competitionFactor === 'number' ? bestTf.competitionFactor.toFixed(3) : null;
    const eff = typeof bestTf.effectiveFactor === 'number' ? bestTf.effectiveFactor.toFixed(3) : null;
    const extra = [raw ? `raw=${raw}` : null, br ? `break=${br}` : null, comp ? `comp=${comp}` : null, eff && eff !== f ? `eff=${eff}` : null]
      .filter(Boolean)
      .join(', ');
    if (bestTf.factor > 0.15) {
      ruleLines.push(
        `- ${language === 'ko' ? '합화(화격) 신호' : 'Transformation signal'}: ${mdEscape(String(bestTf.pair))} → ${mdEscape(String(bestTf.resultElement))} (factor=${f}${extra ? `, ${extra}` : ''})`,
      );
    }
  }


  // Follow (从格/종격) signal
  const fol = ruleFacts?.patterns?.follow;
  if (fol && typeof fol === 'object' && fol.enabled === true) {
    const mode = typeof (fol as any).mode === 'string' ? String((fol as any).mode) : '?';
    const domRole = typeof (fol as any).dominantRole === 'string' ? String((fol as any).dominantRole) : '?';
    const domEl = typeof (fol as any).dominantElement === 'string' ? String((fol as any).dominantElement) : '?';
    const typ = typeof (fol as any).followType === 'string' ? String((fol as any).followType) : null;
    const tg = typeof (fol as any).followTenGod === 'string' ? String((fol as any).followTenGod) : null;

    const domR = typeof (fol as any).dominanceRatio === 'number' ? (fol as any).dominanceRatio.toFixed(3) : '?';
    const pRaw = typeof (fol as any).potentialRaw === 'number' ? (fol as any).potentialRaw.toFixed(3) : '?';
    const p = typeof (fol as any).potential === 'number' ? (fol as any).potential.toFixed(3) : '?';
    const cond = typeof (fol as any).jonggyeokConditionFactor === 'number' ? (fol as any).jonggyeokConditionFactor.toFixed(3) : null;
    const jong = typeof (fol as any).jonggyeokFactor === 'number' ? (fol as any).jonggyeokFactor.toFixed(3) : null;

    const extras = [typ ? `type=${typ}` : null, tg ? `tg=${tg}` : null, cond ? `cond=${cond}` : null, jong ? `jong=${jong}` : null]
      .filter(Boolean)
      .join(', ');

    ruleLines.push(
      `- ${language === 'ko' ? '종격(从格) 신호' : 'Follow pattern'}: mode=${mdEscape(mode)}, domRole=${mdEscape(domRole)}, domEl=${mdEscape(domEl)}, domRatio=${domR}, pRaw=${pRaw}, p=${p}${extras ? `, ${mdEscape(extras)}` : ''}`,
    );
  }


  // Month climate (調候)
  const cl = ruleFacts?.climate;
  if (cl && typeof cl === 'object' && cl.need && typeof cl.need === 'object') {
    const t = typeof cl.need.temp === 'number' ? cl.need.temp.toFixed(3) : '?';
    const m = typeof cl.need.moist === 'number' ? cl.need.moist.toFixed(3) : '?';
    ruleLines.push(`- ${language === 'ko' ? '조후 필요(온도/습도)' : 'Climate need (temp/moist)'}: temp=${t}, moist=${m}`);
  }

  // Month gyeok (格局) hint
  const mg = ruleFacts?.month?.gyeok;
  if (mg && typeof mg === 'object' && typeof mg.tenGod === 'string') {
    ruleLines.push(`- ${language === 'ko' ? '월지 격(십성)' : 'Month pattern (ten-god)'}: ${mdEscape(String(mg.tenGod))} (${mdEscape(String(mg.method ?? ''))})`);

    if (mg.support && typeof mg.support === 'object') {
      ruleLines.push(
        `  - ${language === 'ko' ? '회지(삼합/방합)' : 'Branch-combo support'}: ${mdEscape(String(mg.support.type))} / ${mdEscape(String(mg.support.element))}`,
      );
    }

    if (Array.isArray(mg.candidates)) {
      const top = mg.candidates.slice(0, 3).map((c: any) => {
        const stem = typeof c.stem === 'number' ? String(c.stem) : String(c.stem);
        const el = typeof c.element === 'string' ? c.element : '';
        const sc = typeof c.score === 'number' ? c.score.toFixed(3) : String(c.score);
        return `${stem}:${el}(${sc})`;
      });
      if (top.length) ruleLines.push(`  - ${language === 'ko' ? '후보(상위)' : 'Candidates (top)'}: ${top.join(', ')}`);
    }

    // 格局 품질(청탁/파격) — optional detailed metrics
    if (mg.quality && typeof mg.quality === 'object') {
      const q = mg.quality as any;
      const clarity = typeof q.clarity === 'number' ? q.clarity.toFixed(3) : '?';
      const integrity = typeof q.integrity === 'number' ? q.integrity.toFixed(3) : '?';
      const mult = typeof q.multiplier === 'number' ? q.multiplier.toFixed(3) : '?';
      const qz = typeof q.qingZhuo === 'string' ? q.qingZhuo : '';
      const br = q.broken === true ? 'broken' : '';
      const mx = q.mixed === true ? 'mixed' : '';
      ruleLines.push(`  - ${language === 'ko' ? '격국 품질' : 'Pattern quality'}: clarity=${clarity}, integrity=${integrity}, multiplier=${mult} ${mdEscape([qz, br, mx].filter(Boolean).join(' '))}`);
      if (Array.isArray(q.reasons) && q.reasons.length) {
        ruleLines.push(`  - ${language === 'ko' ? '품질 근거' : 'Quality reasons'}: ${mdEscape(q.reasons.slice(0, 8).join(', '))}`);
      }
    }
  }

  // Yongshin (용신)
  if (summary?.yongshin && typeof summary.yongshin === 'object') {
    const ys = summary.yongshin as any;
    if (typeof ys.best === 'string') {
      ruleLines.push(`- ${language === 'ko' ? '용신' : 'Yongshin'}: ${mdEscape(String(ys.best))}`);
    }
    if (Array.isArray(ys.ranking)) {
      const top = ys.ranking.slice(0, 5).map((r: any) => `${r.element}:${typeof r.score === 'number' ? r.score.toFixed(4) : r.score}`);
      if (top.length) ruleLines.push(`- ${language === 'ko' ? '용신 랭킹(상위)' : 'Yongshin ranking (top)'}: ${top.join(', ')}`);
    }
  }

  const effW = yongshinRes?.base?.effectiveWeights;
  if (effW && typeof effW === 'object') {
    const b = typeof effW.balance === 'number' ? effW.balance.toFixed(3) : '?';
    const r = typeof effW.role === 'number' ? effW.role.toFixed(3) : '?';
    const c = typeof effW.climate === 'number' ? effW.climate.toFixed(3) : '?';
    const md = typeof effW.medicine === 'number' ? effW.medicine.toFixed(3) : '?';
    const tg = typeof (effW as any).tongguan === 'number' ? (effW as any).tongguan.toFixed(3) : null;
    const fl = typeof (effW as any).follow === 'number' ? (effW as any).follow.toFixed(3) : null;
    const jt = typeof (effW as any).johooTemplate === 'number' ? (effW as any).johooTemplate.toFixed(3) : null;
    const tr = typeof (effW as any).transformations === 'number' ? (effW as any).transformations.toFixed(3) : null;
    const oe = typeof (effW as any).oneElement === 'number' ? (effW as any).oneElement.toFixed(3) : null;
    const extra = [tg != null ? `tong=${tg}` : null, fl != null ? `fol=${fl}` : null, jt != null ? `tpl=${jt}` : null, tr != null ? `tr=${tr}` : null, oe != null ? `one=${oe}` : null]
      .filter(Boolean)
      .join(', ');
    ruleLines.push(
      `- ${language === 'ko' ? '가중치(실효)' : 'Effective weights'}: bal=${b}, role=${r}, clim=${c}, med=${md}${extra ? `, ${extra}` : ''}`,
    );
  }

  const urg = yongshinRes?.base?.climateUrgency;
  if (urg && typeof urg === 'object' && typeof urg.magnitude === 'number') {
    const mag = urg.magnitude.toFixed(3);
    const th = typeof urg.threshold === 'number' ? urg.threshold.toFixed(3) : '?';
    const f = typeof urg.factor === 'number' ? urg.factor.toFixed(3) : '?';
    ruleLines.push(`- ${language === 'ko' ? '조후 긴급도' : 'Climate urgency'}: |need|=${mag} (thr=${th}, factor=${f})`);
  }

  const ms = yongshinRes?.base?.methodSelector;
  if (ms && typeof ms === 'object' && ms.enabled === true) {
    const parts: string[] = [];
    if (ms.climate && typeof ms.climate === 'object') {
      const mag = typeof ms.climate.magnitude === 'number' ? ms.climate.magnitude.toFixed(3) : '?';
      const f = typeof ms.climate.factor === 'number' ? ms.climate.factor.toFixed(3) : '?';
      parts.push(`climate(|need|=${mag}, f=${f})`);
    }
    if (ms.medicine && typeof ms.medicine === 'object') {
      const mx = typeof ms.medicine.maxExcess === 'number' ? ms.medicine.maxExcess.toFixed(3) : '?';
      const f = typeof ms.medicine.factor === 'number' ? ms.medicine.factor.toFixed(3) : '?';
      parts.push(`medicine(maxEx=${mx}, f=${f})`);
    }
    if (ms.tongguan && typeof ms.tongguan === 'object') {
      const mx = typeof ms.tongguan.maxIntensity === 'number' ? ms.tongguan.maxIntensity.toFixed(3) : '?';
      const eff = typeof (ms.tongguan as any).effectiveMaxIntensity === 'number' ? (ms.tongguan as any).effectiveMaxIntensity.toFixed(3) : null;
      const dom = typeof (ms.tongguan as any).dominance === 'number' ? (ms.tongguan as any).dominance.toFixed(3) : null;
      const f = typeof ms.tongguan.factor === 'number' ? ms.tongguan.factor.toFixed(3) : '?';
      const extra = [eff != null ? `eff=${eff}` : null, dom != null ? `dom=${dom}` : null].filter(Boolean).join(', ');
      parts.push(`tongguan(max=${mx}${extra ? `, ${extra}` : ''}, f=${f})`);
    }
    if (ms.follow && typeof ms.follow === 'object') {
      const p = typeof ms.follow.potential === 'number' ? ms.follow.potential.toFixed(3) : '?';
      const f = typeof ms.follow.factor === 'number' ? ms.follow.factor.toFixed(3) : '?';
      const mode = typeof (ms.follow as any).mode === 'string' ? String((ms.follow as any).mode) : null;
      parts.push(`follow(${mode ? `mode=${mode}, ` : ''}p=${p}, f=${f})`);
    }
    if (ms.johooTemplate && typeof ms.johooTemplate === 'object') {
      const f = typeof ms.johooTemplate.factor === 'number' ? ms.johooTemplate.factor.toFixed(3) : '?';
      parts.push(`template(f=${f})`);
    }
    if ((ms as any).transformations && typeof (ms as any).transformations === 'object') {
      const tf = (ms as any).transformations;
      const bf = typeof tf.bestFactor === 'number' ? tf.bestFactor.toFixed(3) : '?';
      const f = typeof tf.factor === 'number' ? tf.factor.toFixed(3) : '?';
      const el = typeof tf.resultElement === 'string' ? String(tf.resultElement) : null;
      const pair = typeof tf.pair === 'string' ? String(tf.pair) : null;
      parts.push(`transform(${pair && el ? `${pair}→${el}, ` : ''}best=${bf}, f=${f})`);
    }

    if ((ms as any).oneElement && typeof (ms as any).oneElement === 'object') {
      const oe = (ms as any).oneElement;
      const sig = typeof oe.signal === 'number' ? oe.signal.toFixed(3) : '?';
      const f = typeof oe.factor === 'number' ? oe.factor.toFixed(3) : '?';
      const el = typeof oe.element === 'string' ? String(oe.element) : null;
      parts.push(`oneElement(${el ? `${el}, ` : ''}sig=${sig}, f=${f})`);
    }
    if ((ms as any).competition && typeof (ms as any).competition === 'object') {
      const c = (ms as any).competition;
      const methods = Array.isArray(c.methods) ? c.methods.join('+') : '';
      const active = Array.isArray(c.activeMethods) ? c.activeMethods.join('+') : '';

      const win: any = c.winner && typeof c.winner === 'object' ? c.winner : null;
      const winText = win && typeof win.method === 'string'
        ? ` winner=${win.method}${typeof win.share === 'number' ? `(${win.share.toFixed(2)})` : ''}`
        : '';

      const rnText = c.renormalize === true ? ' rn' : '';
      const scaleText = c.renormalize === true && typeof c.scale === 'number' && Number.isFinite(c.scale) && c.scale !== 1
        ? ` scale=${c.scale.toFixed(3)}`
        : '';
      const shares = c.shares && typeof c.shares === 'object'
        ? Object.entries(c.shares).map(([k, v]: any) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(',')
        : '';
      const mults = c.multipliers && typeof c.multipliers === 'object'
        ? Object.entries(c.multipliers).map(([k, v]: any) => `${k}×${typeof v === 'number' ? v.toFixed(2) : v}`).join(',')
        : '';
      parts.push(`comp(${methods}${active ? ` active=${active}` : ''}${winText}${rnText}${scaleText}${shares ? ` shares=${shares}` : ''}${mults ? ` mult=${mults}` : ''})`);
    }
    if (parts.length) {
      ruleLines.push(`- ${language === 'ko' ? '메타-선택기' : 'Method selector'}: ${parts.join(', ')}`);
    }
  }

  // Gyeokguk (격국)
  if (summary?.gyeokguk && typeof summary.gyeokguk === 'object') {
    const gg = summary.gyeokguk as any;
    if (typeof gg.best === 'string') {
      ruleLines.push(`- ${language === 'ko' ? '격국' : 'Gyeokguk'}: ${mdEscape(String(gg.best))}`);
    }
    if (Array.isArray(gg.ranking)) {
      const top = gg.ranking.slice(0, 5).map((r: any) => `${r.key}:${typeof r.score === 'number' ? r.score.toFixed(4) : r.score}`);
      if (top.length) ruleLines.push(`- ${language === 'ko' ? '격국 랭킹(상위)' : 'Gyeokguk ranking (top)'}: ${top.join(', ')}`);
    }

    // Optional: special-frame competition (HUA_QI vs ZHUAN_WANG vs CONG_*) from full rule result
    const ggComp: any = (gyeokgukRes as any)?.basis?.competition ?? (gyeokgukRes as any)?.competition;
    if (ggComp && typeof ggComp === 'object' && ggComp.enabled === true) {
      const methods = Array.isArray(ggComp.methods) ? ggComp.methods.join('+') : '';
      const shares = ggComp.shares && typeof ggComp.shares === 'object'
        ? Object.entries(ggComp.shares).map(([k, v]: any) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`).join(',')
        : '';
      const mults = ggComp.multipliers && typeof ggComp.multipliers === 'object'
        ? Object.entries(ggComp.multipliers).map(([k, v]: any) => `${k}×${typeof v === 'number' ? v.toFixed(2) : v}`).join(',')
        : '';

      const win: any = ggComp.winner && typeof ggComp.winner === 'object' ? ggComp.winner : null;
      const winText = win && typeof win.method === 'string'
        ? ` winner=${win.method}${typeof win.share === 'number' ? `(${win.share.toFixed(2)})` : ''}`
        : '';

      ruleLines.push(`- ${language === 'ko' ? '격국 변격 경쟁' : 'Gyeokguk special-frame competition'}: ${methods}${winText}${shares ? ` shares=${shares}` : ''}${mults ? ` mult=${mults}` : ''}`);

      // Optional: show a small diff of affected keys (top by |before|)
      const aff: any = ggComp.affected;
      if (aff && typeof aff === 'object') {
        const rows = Object.entries(aff)
          .map(([k, v]: any) => ({
            key: k,
            before: typeof v?.before === 'number' ? (v.before as number) : 0,
            after: typeof v?.after === 'number' ? (v.after as number) : 0,
          }))
          .filter((r) => Number.isFinite(r.before) && Number.isFinite(r.after))
          .sort((a, b) => Math.abs(b.before) - Math.abs(a.before))
          .slice(0, 6)
          .map((r) => `${r.key}:${r.before.toFixed(3)}→${r.after.toFixed(3)}`);
        if (rows.length) {
          ruleLines.push(`  - ${language === 'ko' ? '영향(일부)' : 'Affected (partial)'}: ${rows.join(', ')}`);
        }
      }
    }
  }

  if (ruleLines.length) {
    lines.push(section(language === 'ko' ? '규칙 엔진(요약)' : 'Rule engine (summary)', ruleLines));
  }

  // --- Fortune
  const fortuneLines: string[] = [];
  if (summary?.fortune && typeof summary.fortune === 'object') {
    const ft = summary.fortune;
    if (ft.start && typeof ft.start === 'object') {
      fortuneLines.push(`- ${language === 'ko' ? '대운 방향' : 'Fortune direction'}: ${mdEscape(String(ft.start.direction))}`);
      if (ft.start.boundary) {
        const iso = asIsoUtc(ft.start.boundary.utcMs);
        fortuneLines.push(`- ${language === 'ko' ? '경계 절기' : 'Boundary term'}: ${mdEscape(String(ft.start.boundary.id))}${iso ? ` (${iso})` : ''}`);
      }
      if (typeof ft.start.deltaMs === 'number') {
        const days = ft.start.deltaMs / (1000 * 60 * 60 * 24);
        fortuneLines.push(`- ${language === 'ko' ? '절입까지' : 'Delta to boundary'}: ${days.toFixed(3)} ${language === 'ko' ? '일' : 'days'}`);
      }
      if (typeof ft.start.startAgeYears === 'number') {
        fortuneLines.push(`- ${language === 'ko' ? '대운 시작 나이(근사)' : 'Luck start age (approx)'}: ${ft.start.startAgeYears.toFixed(4)} ${language === 'ko' ? '세' : 'years'}`);
      }
      if (typeof ft.start.formula === 'string') {
        fortuneLines.push(`- ${language === 'ko' ? '계산식' : 'Formula'}: ${mdEscape(ft.start.formula)}`);
      }
    }

    if (Array.isArray(ft.decades) && ft.decades.length) {
      const list = ft.decades.slice(0, 8).map((d: any) => {
        const p = d.pillar?.stem?.text && d.pillar?.branch?.text ? `${d.pillar.stem.text}${d.pillar.branch.text}` : '';
        return `${d.index}:${p}@${typeof d.startAgeYears === 'number' ? d.startAgeYears.toFixed(1) : '?'}-${typeof d.endAgeYears === 'number' ? d.endAgeYears.toFixed(1) : '?'}${language === 'ko' ? '세' : 'y'}`;
      });
      fortuneLines.push(`- ${language === 'ko' ? '대운(일부)' : 'Decades (partial)'}: ${list.join(', ')}`);
    }
  }
  if (fortuneLines.length) {
    lines.push(section(language === 'ko' ? '대운/세운(요약)' : 'Fortune timeline (summary)', fortuneLines));
  }

  // --- Shinsal hits
  const shinsalLines: string[] = [];
  const hits: any[] = Array.isArray(summary?.shinsalHits) ? summary.shinsalHits : [];
  if (hits.length) {
    shinsalLines.push(`- ${language === 'ko' ? '감지된 신살 수' : 'Detections'}: ${hits.length}`);
    const shown = hits.slice(0, maxShinsal);
    for (const h of shown) {
      const name = String(h.name ?? '');
      const basedOn = String(h.basedOn ?? '');
      const q = typeof h.qualityWeight === 'number' ? ` qw=${h.qualityWeight.toFixed(3)}` : '';
      const inv = h.invalidated ? ' (invalidated)' : '';

      let target = '';
      if (h.targetKind === 'BRANCH' && h.targetBranch?.text) target = h.targetBranch.text;
      else if (h.targetKind === 'STEM' && h.targetStem?.text) target = h.targetStem.text;
      else if (h.targetKind === 'NONE') target = '-';

      const details = target ? ` @${target}` : '';
      shinsalLines.push(`- ${mdEscape(name)} [${mdEscape(basedOn)}]${details}${q}${inv}`);
    }
    if (hits.length > shown.length) {
      shinsalLines.push(`- ... ${hits.length - shown.length} more`);
    }
  }
  if (shinsalLines.length) {
    lines.push(section(language === 'ko' ? '신살(요약)' : 'Shinsal (summary)', shinsalLines));
  }

  // --- Notes: where to find exact numbers
  const hintLines: string[] = [];
  hintLines.push(
    language === 'ko'
      ? '- 이 문서는 사람이 읽기 쉬운 요약입니다. 모든 계산 근거/수치/트레이스는 `report.json` 및 `facts.json`(또는 동일 역할 파일)에서 확인하세요.'
      : '- This is a human-readable summary. For full numeric evidence and traces, see `report.json` and `facts.json`.',
  );
  lines.push(section(language === 'ko' ? '참고' : 'Notes', hintLines));

  const markdown = lines.join('\n');

  return {
    language,
    markdown,
    meta: {
      engineName: bundle?.engine?.name,
      engineVersion: bundle?.engine?.version,
      createdAtUtc: new Date().toISOString(),
    },
  };
}
