import { PillarPosition } from '../domain/PillarPosition.js';
import { Sipseong } from '../domain/Sipseong.js';
import { ShinsalType } from '../domain/Shinsal.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import type { DomainReading } from './LifeDomainShared.js';
import { LIFE_DOMAIN_NOTE_CATALOG } from './LifeDomainNoteCatalog.js';
import {
  EXPRESSION_STARS,
  OFFICIAL_STARS,
  appendShinsalNotes,
  collectSipseongHits,
  deduplicateByType,
} from './LifeDomainShared.js';

export function careerDomain(a: SajuAnalysis): DomainReading {
  const details: string[] = [];
  const officialStars = collectSipseongHits(a, OFFICIAL_STARS);
  const expressionStars = collectSipseongHits(a, EXPRESSION_STARS);
  const isStrong = a.strengthResult?.isStrong ?? true;
  const careerNotes = LIFE_DOMAIN_NOTE_CATALOG.career;

  if (a.gyeokgukResult) {
    const gr = a.gyeokgukResult;
    const note = careerNotes.gyeokgukNotes[gr.type];
    if (note) details.push(note);
  }

  if (a.tenGodAnalysis) {
    const monthTg = a.tenGodAnalysis.byPosition[PillarPosition.MONTH];
    if (monthTg) {
      const monthNote = careerNotes.monthNotes[monthTg.cheonganSipseong];
      if (monthNote) details.push(monthNote);
    }
  }

  if (isStrong && officialStars.length > 0) {
    details.push('신강한 일간이 관성을 감당하므로 조직에서 리더십을 발휘할 수 있습니다.');
  } else if (!isStrong && officialStars.length >= 2) {
    details.push('관다신약(官多身弱) — 과도한 책임·압박에 시달릴 수 있으니 인성(학습/자격증)으로 보강하세요.');
  }

  const careerShinsals = deduplicateByType(
    a.weightedShinsalHits,
    new Set([ShinsalType.JANGSEONG, ShinsalType.YEOKMA, ShinsalType.MUNCHANG, ShinsalType.HAKDANG]),
  );
  appendShinsalNotes(details, careerShinsals, {
    [ShinsalType.JANGSEONG]: careerNotes.shinsalNotes[ShinsalType.JANGSEONG],
    [ShinsalType.YEOKMA]: careerNotes.shinsalNotes[ShinsalType.YEOKMA],
    [ShinsalType.MUNCHANG]: careerNotes.shinsalNotes[ShinsalType.MUNCHANG],
    [ShinsalType.HAKDANG]: careerNotes.shinsalNotes[ShinsalType.HAKDANG],
  });

  let overview: string;
  if (officialStars.length >= 2 && isStrong) {
    overview = '관성이 강하고 일간도 튼튼하여 높은 직위에 오를 수 있는 직업 운입니다.';
  } else if (expressionStars.length > 0) {
    overview = '식상이 있어 창의력과 기술력으로 직업적 성과를 내는 구조입니다.';
  } else if (officialStars.length === 0 && expressionStars.length === 0) {
    overview = '관성/식상이 부재하여 자유업이나 독립적 활동이 더 맞을 수 있습니다.';
  } else {
    overview = '직업적 잠재력이 있으며, 적성에 맞는 분야를 찾는 것이 핵심입니다.';
  }

  let advice: string;
  if (!isStrong && officialStars.length >= 2) {
    advice = '조직의 기대에 부응하기 위해 인성(자기계발/학습)을 강화하세요.';
  } else if (isStrong && expressionStars.length > 0) {
    advice = '식상의 창의력과 관성의 구조를 결합하여 자신만의 전문 영역을 구축하세요.';
  } else if (isStrong && officialStars.length === 0) {
    advice = '자유로운 환경에서 능력을 발휘할 수 있는 독립적 직업이 적합합니다.';
  } else {
    advice = '용신 오행이 강화되는 대운 시기에 직업적 도약의 기회가 옵니다.';
  }

  return { domain: '직업운(職業運)', icon: '\uD83D\uDCBC', overview, details, advice };
}
