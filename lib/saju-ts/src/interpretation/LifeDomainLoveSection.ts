import { PillarPosition } from '../domain/PillarPosition.js';
import { ShinsalType } from '../domain/Shinsal.js';
import { Gender } from '../domain/Gender.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import { LIFE_DOMAIN_NOTE_CATALOG } from './LifeDomainNoteCatalog.js';
import type { DomainReading } from './LifeDomainShared.js';
import {
  OFFICIAL_STARS,
  WEALTH_STARS,
  appendShinsalNotes,
  collectSipseongHits,
  deduplicateByType,
} from './LifeDomainShared.js';

function dohwaPositionNote(position: PillarPosition): string {
  if (position === PillarPosition.DAY) {
    return '일주 도화(桃花)는 배우자가 매력적이며 좋은 인연입니다.';
  }
  if (position === PillarPosition.YEAR) {
    return '년주 도화(桃花)는 이른 시기부터 이성의 관심을 받습니다.';
  }
  if (position === PillarPosition.HOUR) {
    return '시주 도화(桃花)는 말년에 이성 인연이 활발해질 수 있습니다.';
  }
  return '도화(桃花)가 있어 이성에게 매력적이나 감정 절제가 필요합니다.';
}

export function loveDomain(a: SajuAnalysis): DomainReading {
  const details: string[] = [];
  const gender = a.input.gender;
  const spouseStars = gender === Gender.MALE ? WEALTH_STARS : OFFICIAL_STARS;
  const spouseLabel = gender === Gender.MALE ? '재성(편재/정재)' : '관성(편관/정관)';
  const loveShinsalNotes = LIFE_DOMAIN_NOTE_CATALOG.love.shinsalNotes;

  const spouseHits = collectSipseongHits(a, spouseStars);
  const spouseCount = spouseHits.length;
  const hasDayBranchSpouse = spouseHits.some(h => h.position === PillarPosition.DAY);

  if (spouseCount === 0) {
    details.push(`${spouseLabel}이 원국에 없어 배우자 인연이 대운/세운에서 들어옵니다. 결혼이 늦어질 수 있습니다.`);
  } else if (spouseCount === 1) {
    details.push(`${spouseLabel}이 적절하게 있어 안정적인 배우자 인연입니다.`);
  } else if (spouseCount >= 3) {
    if (gender === Gender.MALE) {
      details.push('재성이 3개 이상으로 이성 인연이 많으나 한 사람에게 집중하기 어려울 수 있습니다.');
    } else {
      details.push('관성이 3개 이상으로 이성 인연이 많으나 관계 안정에 노력이 필요합니다.');
    }
  }

  if (hasDayBranchSpouse) {
    details.push('일지(배우자궁)에 배우자 십성이 있어 배우자와의 인연이 강하고 좋은 관계가 기대됩니다.');
  }

  if (a.palaceAnalysis) {
    const dayPalace = a.palaceAnalysis[PillarPosition.DAY];
    if (dayPalace?.interpretation) {
      details.push(`배우자궁: ${dayPalace.interpretation.summary}`);
    }
  }

  const romanceShinsals = deduplicateByType(
    a.weightedShinsalHits,
    new Set([ShinsalType.DOHWA, ShinsalType.HONGYEOM, ShinsalType.GEUMYEO]),
  );
  appendShinsalNotes(details, romanceShinsals, {
    [ShinsalType.DOHWA]: hit => dohwaPositionNote(hit.hit.position),
    [ShinsalType.HONGYEOM]: loveShinsalNotes[ShinsalType.HONGYEOM],
    [ShinsalType.GEUMYEO]: loveShinsalNotes[ShinsalType.GEUMYEO],
  });

  const isStrong = a.strengthResult?.isStrong ?? true;
  if (gender === Gender.MALE) {
    if (isStrong && spouseCount >= 1) {
      details.push('신강한 일간이 재성을 잘 다스리므로 적극적인 연애가 가능합니다.');
    } else if (!isStrong && spouseCount >= 2) {
      details.push('신약한 일간에 재성이 많아 배우자에게 끌려다닐 수 있으니 자기 주관을 지키세요.');
    }
  } else {
    if (isStrong && spouseCount >= 1) {
      details.push('신강한 일간이 관성을 감당하므로 배우자와 대등한 관계를 유지할 수 있습니다.');
    } else if (!isStrong && spouseCount >= 2) {
      details.push('신약한 일간에 관성이 많아 배우자의 기대·압박이 부담이 될 수 있습니다.');
    }
  }

  const lonelyShinsals = a.weightedShinsalHits.filter(
    h => h.hit.type === ShinsalType.GOSIN || h.hit.type === ShinsalType.GWASUK,
  );
  if (lonelyShinsals.length > 0) {
    details.push('고신/과숙살이 있어 혼자 있는 시간이 많을 수 있으나, 독립심이 강한 장점도 됩니다.');
  }

  let overview: string;
  if (spouseCount >= 1 && romanceShinsals.length > 0) {
    overview = '이성 인연이 풍부하고 매력이 넘치는 연애운입니다.';
  } else if (spouseCount >= 1) {
    overview = '배우자 인연이 있어 적절한 시기에 좋은 만남이 기대됩니다.';
  } else if (romanceShinsals.length > 0) {
    overview = '이성 관심은 많으나 진정한 인연을 찾는 데 시간이 필요합니다.';
  } else {
    overview = '원국의 연애 기운은 약하나 대운/세운에서 인연이 들어올 수 있습니다.';
  }

  let advice: string;
  if (spouseCount === 0) {
    advice = '배우자 십성이 들어오는 대운/세운 시기에 적극적으로 만남의 기회를 만드세요.';
  } else if (spouseCount >= 3) {
    advice = '이성 인연이 많으므로 한 사람과 깊은 관계를 맺는 연습이 필요합니다.';
  } else if (hasDayBranchSpouse) {
    advice = '일지에 배우자 성분이 있어 가정 중심의 안정적인 결혼 생활이 가능합니다.';
  } else {
    advice = '배우자에 대한 존중과 소통이 좋은 관계의 핵심입니다.';
  }

  return { domain: '연애/결혼운(戀愛運)', icon: '\u2764\uFE0F', overview, details, advice };
}
