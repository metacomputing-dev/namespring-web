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
  const yongshin = a.yongshinResult?.finalYongshin ?? null;
  const heesin = a.yongshinResult?.finalHeesin ?? null;
  const gisin = a.yongshinResult?.gisin ?? null;

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
    if (!note) continue;
    if (gisin === oh) {
      details.push(`${ohaengKr(oh)} 부재 — 관련 장기 기본 관리는 필요하나, 기신 축이라 과보충보다 리듬 관리와 과다화 점검이 우선입니다.`);
      continue;
    }
    if (yongshin === oh || heesin === oh) {
      details.push(note);
      continue;
    }
    details.push(`${note} 과도한 보강보다 꾸준한 생활 습관으로 균형을 맞추세요.`);
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
  const hasAbsentGisin = gisin != null && absent.includes(gisin);
  if (excess.length >= 2) {
    overview = '오행 불균형이 크므로 건강 관리에 특별한 주의가 필요합니다.';
  } else if (absent.length > 0) {
    overview = hasAbsentGisin
      ? absent.length === 1
        ? '부재 오행이 기신 축이라 무리한 보충보다 균형 관리가 중요합니다.'
        : '부재 오행 보완이 필요하지만, 기신 축은 과보충을 피하고 균형 관리가 중요합니다.'
      : '부재 오행이 있어 해당 장기를 보완하는 생활습관이 중요합니다.';
  } else {
    overview = '오행이 비교적 균형 잡혀 있어 기본 건강 운이 양호합니다.';
  }

  const controlsMe = OhaengRelations.controlledBy(dmOhaeng);
  let advice = `일간 ${ohaengKr(dmOhaeng)} 기준으로 `;
  if ((counts.get(controlsMe) ?? 0) >= 2) {
    advice += `극제 오행(${ohaengKr(controlsMe)})이 강하므로 스트레스 관리에 유의하고, `;
  }
  if (a.yongshinResult != null) {
    const yongshinLabel = ohaengKr(a.yongshinResult.finalYongshin);
    const gisinLabel = a.yongshinResult.gisin != null ? ohaengKr(a.yongshinResult.gisin) : null;
    advice += `용신 오행(${yongshinLabel}) 중심의 생활 루틴이 건강 유지에 도움이 됩니다.`;
    if (gisinLabel != null) {
      advice += ` 기신 오행(${gisinLabel})은 과도한 증강보다 변동 시기 점검이 안전합니다.`;
    }
  } else {
    advice += '생활 리듬(수면·식사·활동)을 일정하게 유지하는 것이 건강 유지에 도움이 됩니다.';
  }

  return { domain: '건강운(健康運)', icon: '\uD83C\uDFE5', overview, details, advice };
}
