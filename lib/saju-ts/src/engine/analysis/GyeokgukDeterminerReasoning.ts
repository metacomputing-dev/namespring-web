import { Cheongan, CHEONGAN_INFO } from '../../domain/Cheongan.js';
import { Jiji, JIJI_INFO } from '../../domain/Jiji.js';
import { GyeokgukType, GYEOKGUK_TYPE_INFO } from '../../domain/Gyeokguk.js';
import { HiddenStemRole, HiddenStemTable } from '../../domain/HiddenStem.js';
import { Sipseong, SIPSEONG_INFO } from '../../domain/Sipseong.js';

export function buildTouchulReasoning(
  dayMaster: Cheongan,
  monthBranch: Jiji,
  revealedStem: Cheongan,
  role: HiddenStemRole,
  sipseong: Sipseong,
  type: GyeokgukType,
): string {
  const roleKorean = (() => {
    switch (role) {
      case HiddenStemRole.JEONGGI: return '정기(正氣)';
      case HiddenStemRole.JUNGGI:  return '중기(中氣)';
      case HiddenStemRole.YEOGI:   return '여기(餘氣)';
    }
  })();
  const dayInfo = CHEONGAN_INFO[dayMaster];
  const branchInfo = JIJI_INFO[monthBranch];
  const stemInfo = CHEONGAN_INFO[revealedStem];
  const sipInfo = SIPSEONG_INFO[sipseong];
  const typeInfo = GYEOKGUK_TYPE_INFO[type];

  return `일간 ${dayInfo.hangul}(${dayInfo.hanja}) 기준, ` +
    `월지 ${branchInfo.hangul}(${branchInfo.hanja})의 ` +
    `${roleKorean} ${stemInfo.hangul}(${stemInfo.hanja})이(가) ` +
    `천간에 투출(透出)하여 ` +
    `${sipInfo.koreanName}(${sipInfo.hanja})이므로 ` +
    `${typeInfo.koreanName}(${typeInfo.hanja})으로 판단.`;
}

export function buildNaegyeokReasoning(
  dayMaster: Cheongan,
  monthBranch: Jiji,
  sipseong: Sipseong,
  type: GyeokgukType,
): string {
  const principalStem = HiddenStemTable.getPrincipalStem(monthBranch);
  const dayInfo = CHEONGAN_INFO[dayMaster];
  const branchInfo = JIJI_INFO[monthBranch];
  const stemInfo = CHEONGAN_INFO[principalStem];
  const sipInfo = SIPSEONG_INFO[sipseong];
  const typeInfo = GYEOKGUK_TYPE_INFO[type];

  return `일간 ${dayInfo.hangul}(${dayInfo.hanja}) 기준, ` +
    `월지 ${branchInfo.hangul}(${branchInfo.hanja})의 ` +
    `정기 ${stemInfo.hangul}(${stemInfo.hanja})이(가) ` +
    `${sipInfo.koreanName}(${sipInfo.hanja})이므로 ` +
    `${typeInfo.koreanName}(${typeInfo.hanja})으로 판단.`;
}

