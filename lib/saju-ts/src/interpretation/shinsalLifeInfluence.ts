import { ShinsalType } from '../domain/Shinsal.js';

export function shinsalLifeInfluence(type: ShinsalType): string | null {
  const INFLUENCES: Partial<Record<ShinsalType, string>> = {
    [ShinsalType.YEOKMA]: '이동·해외·변화에서 기회 확대',
    [ShinsalType.HWAGAE]: '학문·예술·종교적 깊이 강화',
    [ShinsalType.MUNCHANG]: '글재주·학업 성취 촉진',
    [ShinsalType.CHEONUL_GWIIN]: '위기 시 귀인 출현, 사회적 도움',
    [ShinsalType.TAEGUK_GWIIN]: '정신적 품위·리더십 부여',
    [ShinsalType.JANGSEONG]: '통솔력·리더십 강화',
    [ShinsalType.DOHWA]: '대인 매력 강화, 감정 절제 과제',
    [ShinsalType.YANGIN]: '추진력 극대화, 과격함 경계 필요',
    [ShinsalType.BAEKHO]: '외과·사고 주의, 결단력 부여',
    [ShinsalType.GOEGANG]: '강한 결단력, 극단 회피 과제',
    [ShinsalType.GEUMYEO]: '물질적 복록·안정',
    [ShinsalType.AMNOK]: '숨겨진 복록·뜻밖의 행운',
    [ShinsalType.HAKDANG]: '학문적 성취·교육 적성',
    [ShinsalType.CHEONUI]: '치유·의료·상담 적성',
    [ShinsalType.GOSIN]: '독립심·자기만의 길',
    [ShinsalType.GWASUK]: '내면적 외로움 관리 과제',
    [ShinsalType.CHEOLLA_JIMANG]: '전환기 신중함 필요',
    [ShinsalType.GEOPSAL]: '재물 손실 주의',
    [ShinsalType.WONJIN]: '특정 관계 갈등 주의',
    [ShinsalType.HONGYEOM]: '강한 이성 매력, 감정 관리 과제',
  };
  return INFLUENCES[type] ?? null;
}

