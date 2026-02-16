import { ClassicalSource } from '../domain/ClassicalSource.js';
import { ANALYSIS_KEYS } from '../domain/SajuAnalysis.js';

import type { RuleCitation } from './RuleCitationRegistry.js';
import { createRegistryCitation } from './RuleCitationFactory.js';

type CitationSources = Parameters<typeof createRegistryCitation>[0];

function traceEntry(
  key: string,
  sources: CitationSources,
  title: string,
  summary: string,
): readonly [string, RuleCitation] {
  return [key, createRegistryCitation(sources, title, summary)];
}

const REGISTRY: ReadonlyMap<string, RuleCitation> = new Map<string, RuleCitation>([
  traceEntry('core', [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.SAMMYEONGTTONGHOE], '사주 원국 산출', '천문역법 기반 사주(四柱) 배열, 절기 기준 월주·년주 결정',),

    traceEntry(ANALYSIS_KEYS.TEN_GODS, [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.SAMMYEONGTTONGHOE], '십성 배치', '일간 기준 천간·지지의 오행 관계에 따른 십성 판별',),

    traceEntry(ANALYSIS_KEYS.HIDDEN_STEMS, [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.SAMMYEONGTTONGHOE], '지장간', '여기(餘氣)·중기(中氣)·정기(正氣) 3분류, 격국·투출 판별의 핵심',),

    traceEntry(ANALYSIS_KEYS.CHEONGAN_RELATIONS, [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.JEOKCHEONSU], '천간 합충', '천간오합(甲己合 등)과 천간충(甲庚沖 등)의 원리',),

    traceEntry(ANALYSIS_KEYS.HAPWHA, [ClassicalSource.JEOKCHEONSU, ClassicalSource.JAPYEONGJINJEON], '천간 합화', '합화 성립 5조건: 인접, 월령 투출, 화신 통근, 극신 부재, 시기 적합',),

    traceEntry(ANALYSIS_KEYS.RESOLVED_JIJI, [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.SAMMYEONGTTONGHOE], '지지 합충형파해', '삼합·방합·육합·반합, 충·형·파·해·원진의 우선순위 해소',),

    traceEntry(ANALYSIS_KEYS.SCORED_CHEONGAN, [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.JEOKCHEONSU], '천간 관계 점수', '합화/합거/불성립 상태에 따른 강도 평가',),

    traceEntry(ANALYSIS_KEYS.SIBI_UNSEONG, ClassicalSource.YEONHAEJAYPYEONG, '십이운성', '장생→제왕→절지 12단계 에너지 순환, 화토동법/양순음역 유파 분기',),

    traceEntry(ANALYSIS_KEYS.GONGMANG, [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.SAMMYEONGTTONGHOE], '공망', '갑자순(甲子旬) 기준 일주의 공망지(空亡支) 판별',),

    traceEntry(ANALYSIS_KEYS.STRENGTH, [ClassicalSource.JEOKCHEONSU, ClassicalSource.KOREAN_MODERN_PRACTICE], '신강신약', '득령(월지)+득지(지장간)+득세(비겁·인성) 3요소 채점법',),

    traceEntry(ANALYSIS_KEYS.GYEOKGUK, [ClassicalSource.JAPYEONGJINJEON, ClassicalSource.MYEONGLIJEONGJON], '격국', '4단계 판별: 화격→종격→일행득기→내격(정격), 성격·파격 평가',),

    traceEntry(ANALYSIS_KEYS.YONGSHIN, [ClassicalSource.GUNGTONGBOGAM, ClassicalSource.JEOKCHEONSU, ClassicalSource.JAPYEONGJINJEON], '용신', '조후(궁통보감)+억부(적천수)+격국(자평진전) 통합 결정',),

    traceEntry(ANALYSIS_KEYS.SHINSAL, [ClassicalSource.SAMMYEONGTTONGHOE, ClassicalSource.YEONHAEJAYPYEONG], '신살', '천을귀인·역마·도화·화개 등 41종 신살 검출',),

    traceEntry(ANALYSIS_KEYS.WEIGHTED_SHINSAL, [ClassicalSource.SAMMYEONGTTONGHOE, ClassicalSource.KOREAN_MODERN_PRACTICE], '신살 가중치', '신살 등급(S/A/B/C)과 기둥 위치 배율에 의한 가중 점수',),

    traceEntry(ANALYSIS_KEYS.SHINSAL_COMPOSITES, ClassicalSource.KOREAN_MODERN_PRACTICE, '신살 조합 해석', '역마+도화, 양인+백호 등 복합 패턴의 시너지/상충 분석',),

    traceEntry(ANALYSIS_KEYS.PALACE, [ClassicalSource.SAMMYEONGTTONGHOE, ClassicalSource.KOREAN_MODERN_PRACTICE], '궁성론', '년주(조상궁)·월주(부모/사회궁)·일주(자아/배우자궁)·시주(자녀궁) 해석',),

    traceEntry(ANALYSIS_KEYS.DAEUN, [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.JEOKCHEONSU], '대운', '양남음녀 순행, 음남양녀 역행, 절기 기반 기운 시작 나이',),

    traceEntry(ANALYSIS_KEYS.SAEUN, ClassicalSource.YEONHAEJAYPYEONG, '세운', '매년의 천간지지가 원국과 맺는 관계에 의한 운세 변화',),
]);


export { REGISTRY };

