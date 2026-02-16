import { Ohaeng } from '../domain/Ohaeng.js';
import { Sipseong } from '../domain/Sipseong.js';
import { ShinsalType } from '../domain/Shinsal.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import { LIFE_DOMAIN_NOTE_CATALOG } from './LifeDomainNoteCatalog.js';
import type { DomainReading } from './LifeDomainShared.js';
import {
  WEALTH_STARS,
  appendShinsalNotes,
  collectSipseongHits,
  deduplicateByType,
  ohaengKr,
} from './LifeDomainShared.js';

export function wealthDomain(a: SajuAnalysis): DomainReading {
  const details: string[] = [];
  const wealthStars = collectSipseongHits(a, WEALTH_STARS);
  const wealthCount = wealthStars.length;
  const hasJeongJae = wealthStars.some(w => w.sipseong === Sipseong.JEONG_JAE);
  const hasPyeonJae = wealthStars.some(w => w.sipseong === Sipseong.PYEON_JAE);
  const isStrong = a.strengthResult?.isStrong ?? true;
  const wealthShinsalNotes = LIFE_DOMAIN_NOTE_CATALOG.wealth.shinsalNotes;

  if (wealthCount === 0) {
    details.push('원국에 재성(편재/정재)이 없습니다. 재물은 대운/세운에서 들어올 때 기회를 잡아야 합니다.');
  } else {
    if (hasJeongJae && hasPyeonJae) {
      details.push('정재와 편재가 모두 있어 안정적 수입과 투자 수익 두 경로가 열려 있습니다.');
    } else if (hasJeongJae) {
      details.push('정재가 있어 꾸준한 노력으로 재물을 축적하는 정공법이 유리합니다.');
    } else if (hasPyeonJae) {
      details.push('편재가 있어 사업·투자·큰 거래에서 재물 기회가 옵니다.');
    }
    if (!isStrong && wealthCount >= 2) {
      details.push("신약한 일간에 재성이 많아 '재다신약(財多身弱)' — 재물은 보이나 감당이 어려울 수 있습니다.");
    } else if (isStrong && wealthCount >= 2) {
      details.push('신강한 일간이 재성을 잘 다스리므로 적극적 재물 활동이 가능합니다.');
    }
  }

  if (a.yongshinResult) {
    const yr = a.yongshinResult;
    const wealthOhaeng = [Ohaeng.METAL, Ohaeng.WATER];
    if (wealthOhaeng.includes(yr.finalYongshin)) {
      details.push(`용신이 재물 오행(${ohaengKr(yr.finalYongshin)})이므로 재물 추구가 인생 발전과 일치합니다.`);
    }
  }

  const wealthShinsals = deduplicateByType(
    a.weightedShinsalHits,
    new Set([ShinsalType.GEUMYEO, ShinsalType.AMNOK, ShinsalType.GEOPSAL]),
  );
  appendShinsalNotes(details, wealthShinsals, {
    [ShinsalType.GEUMYEO]: wealthShinsalNotes[ShinsalType.GEUMYEO],
    [ShinsalType.AMNOK]: wealthShinsalNotes[ShinsalType.AMNOK],
    [ShinsalType.GEOPSAL]: wealthShinsalNotes[ShinsalType.GEOPSAL],
  });

  const overview = wealthCount >= 3
    ? '재성이 풍부하여 재물 운이 강한 사주입니다.'
    : wealthCount >= 1
      ? '적절한 재성이 있어 노력에 비례하는 재물 운입니다.'
      : '원국에 재성이 부재하여 대운/세운의 재성 유입이 중요합니다.';

  let advice: string;
  if (!isStrong && wealthCount >= 2) {
    advice = '무리한 투자보다 인성(학습)과 비겁(협력)으로 기초 체력을 키운 후 재물을 추구하세요.';
  } else if (isStrong && wealthCount === 0) {
    advice = '재성 대운이 올 때를 대비하여 사업/투자 역량을 미리 갖추세요.';
  } else if (isStrong && wealthCount >= 1) {
    advice = '재물 활동에 적극적으로 임하되, 식상(아이디어/기술)을 통한 생재(生財)가 가장 효과적입니다.';
  } else {
    advice = '무리한 확장보다는 정재적 접근(꾸준한 저축, 안정적 직업)이 유리합니다.';
  }

  return { domain: '재물운(財物運)', icon: '\uD83D\uDCB0', overview, details, advice };
}
