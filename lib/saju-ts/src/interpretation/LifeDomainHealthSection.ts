import { Ohaeng, OHAENG_VALUES, OhaengRelations } from '../domain/Ohaeng.js';
import { PillarPosition } from '../domain/PillarPosition.js';
import { SibiUnseong, SIBI_UNSEONG_INFO } from '../domain/SibiUnseong.js';
import { ShinsalType } from '../domain/Shinsal.js';
import { CHEONGAN_INFO } from '../domain/Cheongan.js';
import { JIJI_INFO } from '../domain/Jiji.js';
import type { SajuAnalysis } from '../domain/SajuAnalysis.js';
import { LIFE_DOMAIN_NOTE_CATALOG } from './LifeDomainNoteCatalog.js';
import type { DomainReading } from './LifeDomainShared.js';
import { appendShinsalNotes, deduplicateByType, ohaengKr } from './LifeDomainShared.js';

export function healthDomain(a: SajuAnalysis): DomainReading {
  const details: string[] = [];
  const p = a.pillars;
  const healthNotes = LIFE_DOMAIN_NOTE_CATALOG.health;

  const allElements = [
    p.year.cheongan, p.month.cheongan, p.day.cheongan, p.hour.cheongan,
  ].map(c => CHEONGAN_INFO[c].ohaeng);
  const branchElements = [p.year.jiji, p.month.jiji, p.day.jiji, p.hour.jiji].map(
    j => JIJI_INFO[j].ohaeng,
  );
  const allOhaeng = [...allElements, ...branchElements];

  const counts = new Map<Ohaeng, number>();
  for (const oh of OHAENG_VALUES) counts.set(oh, 0);
  for (const oh of allOhaeng) counts.set(oh, (counts.get(oh) ?? 0) + 1);

  const excess: Ohaeng[] = [];
  const absent: Ohaeng[] = [];
  for (const oh of OHAENG_VALUES) {
    if ((counts.get(oh) ?? 0) >= 3) excess.push(oh);
    if ((counts.get(oh) ?? 0) === 0) absent.push(oh);
  }

  for (const oh of excess) {
    const note = healthNotes.excessNotes[oh];
    if (note) details.push(note);
  }
  for (const oh of absent) {
    const note = healthNotes.absentNotes[oh];
    if (note) details.push(note);
  }

  if (a.sibiUnseong) {
    const dayUnseong = a.sibiUnseong.get(PillarPosition.DAY);
    if (dayUnseong) {
      const info = SIBI_UNSEONG_INFO[dayUnseong];
      if ([SibiUnseong.JANG_SAENG, SibiUnseong.GEON_ROK, SibiUnseong.JE_WANG].includes(dayUnseong)) {
        details.push(`일주 12운성이 ${info.koreanName}으로 기본 체력이 강합니다.`);
      } else if ([SibiUnseong.BYEONG, SibiUnseong.SA, SibiUnseong.MYO].includes(dayUnseong)) {
        details.push(`일주 12운성이 ${info.koreanName}으로 기본 체력이 약할 수 있어 건강관리가 중요합니다.`);
      } else if ([SibiUnseong.TAE, SibiUnseong.YANG].includes(dayUnseong)) {
        details.push(`일주 12운성이 ${info.koreanName}으로 회복력은 있으나 체력 관리가 필요합니다.`);
      } else {
        details.push(`일주 12운성이 ${info.koreanName}으로 평범한 체력이며, 꾸준한 관리가 중요합니다.`);
      }
    }
  }

  const healthShinsals = deduplicateByType(
    a.weightedShinsalHits,
    new Set([ShinsalType.BAEKHO, ShinsalType.CHEONUI, ShinsalType.HYEOLINSAL]),
  );
  appendShinsalNotes(details, healthShinsals, {
    [ShinsalType.BAEKHO]: healthNotes.shinsalNotes[ShinsalType.BAEKHO],
    [ShinsalType.CHEONUI]: healthNotes.shinsalNotes[ShinsalType.CHEONUI],
    [ShinsalType.HYEOLINSAL]: healthNotes.shinsalNotes[ShinsalType.HYEOLINSAL],
  });

  const dmOhaeng: Ohaeng = CHEONGAN_INFO[p.day.cheongan].ohaeng;
  const dayMasterNote = healthNotes.dayMasterNotes[dmOhaeng];
  if (dayMasterNote) details.push(dayMasterNote);

  let overview: string;
  if (excess.length >= 2) {
    overview = '오행 불균형이 크므로 건강 관리에 특별한 주의가 필요합니다.';
  } else if (absent.length > 0) {
    overview = '부재 오행이 있어 해당 장기를 보강하는 생활습관이 중요합니다.';
  } else {
    overview = '오행이 비교적 균형 잡혀 있어 기본 건강 운이 양호합니다.';
  }

  const controlsMe = OhaengRelations.controlledBy(dmOhaeng);
  let advice = `일간 ${ohaengKr(dmOhaeng)} 기준으로 `;
  if ((counts.get(controlsMe) ?? 0) >= 2) {
    advice += `극제 오행(${ohaengKr(controlsMe)})이 강하므로 스트레스 관리에 유의하고, `;
  }
  advice += '용신 오행을 보강하는 음식·색상·계절 활동이 건강 유지에 도움이 됩니다.';

  return { domain: '건강운(健康運)', icon: '\uD83C\uDFE5', overview, details, advice };
}
