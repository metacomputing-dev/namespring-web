import { ClassicalSource } from '../domain/ClassicalSource.js';

import type { RuleCitation } from './RuleCitationRegistry.js';
import { createRegistryCitation } from './RuleCitationFactory.js';

type CitationSources = Parameters<typeof createRegistryCitation>[0];

function sentenceEntry(
  key: string,
  sources: CitationSources,
  title: string,
  summary: string,
  confidence: number,
): readonly [string, RuleCitation] {
  return [key, createRegistryCitation(sources, title, summary, confidence)];
}

const SENTENCE_REGISTRY: ReadonlyMap<string, RuleCitation> = new Map<string, RuleCitation>([
  sentenceEntry('strength.level', [ClassicalSource.JEOKCHEONSU, ClassicalSource.KOREAN_MODERN_PRACTICE], '신강신약 판정', '득령+득지+득세 3요소 종합 점수에 의한 강약 등급 결정', 95,),
    sentenceEntry('strength.deukryeong', ClassicalSource.JEOKCHEONSU, '득령 판정', '월지가 일간을 생하거나 동일 오행이면 득령', 95,),
    sentenceEntry('strength.deukji', [ClassicalSource.JEOKCHEONSU, ClassicalSource.KOREAN_MODERN_PRACTICE], '득지 판정', '지장간 중 일간을 돕는 비겁·인성의 유무', 95,),
    sentenceEntry('strength.deukse', [ClassicalSource.JEOKCHEONSU, ClassicalSource.KOREAN_MODERN_PRACTICE], '득세(得勢) 채점', '비겁(동류)은 직접 부조 7점, 인성(생조)은 간접 부조 5점 [적천수: 比肩扶身]', 90,),

    sentenceEntry('gyeokguk.type', [ClassicalSource.JAPYEONGJINJEON, ClassicalSource.MYEONGLIJEONGJON], '격국 판별', '월지 사령 기준 정격 판별, 특별격 우선 검토', 85,),
    sentenceEntry('gyeokguk.formation', [ClassicalSource.JAPYEONGJINJEON, ClassicalSource.KOREAN_MODERN_PRACTICE], '성격/파격 판별', '격국의 성립 여부와 파격 요인·구원 요인 검토', 80,),
    sentenceEntry('gyeokguk.jonggyeok', [ClassicalSource.JAPYEONGJINJEON, ClassicalSource.JEOKCHEONSU], '종격(從格) 판별', '특정 오행이 극도로 강하거나 약할 때 종격 성립 [자평진전 격국론]', 85,),
    sentenceEntry('gyeokguk.hwagyeok', [ClassicalSource.JAPYEONGJINJEON, ClassicalSource.JEOKCHEONSU], '화격(化格) 판별', '천간합 합화 성립 시 결과 오행 기반 화격 [자평진전: 합화가 성립하면 화격]', 80,),
    sentenceEntry('gyeokguk.ilhaeng', [ClassicalSource.MYEONGLIJEONGJON, ClassicalSource.JEOKCHEONSU], '일행득기격(一行得氣格) 판별', '한 오행이 사주를 완전히 지배할 때 일행득기격 성립 [명리정종]', 80,),

    sentenceEntry('yongshin.final', [ClassicalSource.GUNGTONGBOGAM, ClassicalSource.JEOKCHEONSU, ClassicalSource.JAPYEONGJINJEON], '최종 용신 결정', '조후+억부+격국 통합 판정, 유파별 우선순위에 따른 최종 선택', 80,),
    sentenceEntry('yongshin.johu', ClassicalSource.GUNGTONGBOGAM, '조후용신', '10천간×12월지 궁통보감 처방에 의한 조후 결정', 95,),
    sentenceEntry('yongshin.eokbu', ClassicalSource.JEOKCHEONSU, '억부용신', '신강이면 설기/극제, 신약이면 인성/비겁으로 균형', 85,),
    sentenceEntry('yongshin.confidence', ClassicalSource.KOREAN_MODERN_PRACTICE, '용신 신뢰도', '억부·조후 일치도에 따른 동적 신뢰도 산출', 85,),

    sentenceEntry('sipseong.interpretation', [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.SAMMYEONGTTONGHOE], '십성 해석', '비견·겁재·식신·상관·편재·정재·편관·정관·편인·정인의 성향 해석', 90,),

    sentenceEntry('sibiUnseong.interpretation', ClassicalSource.YEONHAEJAYPYEONG, '십이운성 해석', '12단계 에너지 순환(장생→제왕→절지)의 의미 해석', 90,),

    sentenceEntry('palace.interpretation', [ClassicalSource.SAMMYEONGTTONGHOE, ClassicalSource.KOREAN_MODERN_PRACTICE], '궁성 해석', '기둥 위치별 생활 영역(조상궁/사회궁/배우자궁/자녀궁) 해석', 85,),

    sentenceEntry('ilju.personality', [ClassicalSource.SAMMYEONGTTONGHOE, ClassicalSource.KOREAN_MODERN_PRACTICE], '일주 성격론', '60갑자 일주별 천간+지지+12운성+지장간 통합 성격 해석', 75,),

    sentenceEntry('gongmang.detection', [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.SAMMYEONGTTONGHOE], '공망 판별', '일주 간지의 순(旬) 기준 공망지 계산', 95,),

    sentenceEntry('relation.cheongan.hap', [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.JEOKCHEONSU], '천간합', '갑기합·을경합·병신합·정임합·무계합 판별', 95,),
    sentenceEntry('relation.cheongan.chung', ClassicalSource.YEONHAEJAYPYEONG, '천간충', '갑경충·을신충·병임충·정계충 판별', 95,),
    sentenceEntry('relation.jiji.samhap', ClassicalSource.YEONHAEJAYPYEONG, '지지삼합', '인오술·사유축·신자진·해묘미 삼합 판별', 95,),
    sentenceEntry('relation.jiji.chung', ClassicalSource.YEONHAEJAYPYEONG, '지지충', '자오충·축미충·인신충·묘유충·진술충·사해충 판별', 95,),
    sentenceEntry('relation.jiji.hyeong', [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.SAMMYEONGTTONGHOE], '지지형', '무은지형·지세지형·무례지형·자형 4류 형살 판별', 95,),
    sentenceEntry('relation.hapwha', [ClassicalSource.JEOKCHEONSU, ClassicalSource.JAPYEONGJINJEON], '합화 판정', '천간합의 화(化) 성립 5조건 검증', 95,),
    sentenceEntry('relation.interaction.outcome', [ClassicalSource.JEOKCHEONSU, ClassicalSource.SAMMYEONGTTONGHOE], '관계 상호작용 해소', '합해충(合解沖) 원칙: 합이 충을 만나면 약화/해소 [적천수]', 85,),

    sentenceEntry('shinsal.detection', [ClassicalSource.SAMMYEONGTTONGHOE, ClassicalSource.YEONHAEJAYPYEONG], '신살 검출', '일지/년지 기준 41종 신살 패턴 매칭', 95,),
    sentenceEntry('shinsal.weight', [ClassicalSource.SAMMYEONGTTONGHOE, ClassicalSource.KOREAN_MODERN_PRACTICE], '신살 가중치', '등급(S/A/B/C) × 기둥 배율에 의한 가중 점수 산출', 85,),
    sentenceEntry('shinsal.composite', ClassicalSource.KOREAN_MODERN_PRACTICE, '신살 조합', '복합 패턴(역마+도화, 양인+백호 등)의 시너지/상충 해석', 75,),
    sentenceEntry('shinsal.grading', [ClassicalSource.SAMMYEONGTTONGHOE, ClassicalSource.KOREAN_MODERN_PRACTICE], '신살 가중치 등급', '삼명통회 신살론 4등급: 귀인(S)->길신(A)->잡살(B)->참고(C)', 80,),

    sentenceEntry('daeun.direction', [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.JEOKCHEONSU], '대운 방향', '양남음녀 순행, 음남양녀 역행 판별', 95,),
    sentenceEntry('daeun.startAge', [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.KOREAN_MODERN_PRACTICE], '대운 시작 연령 계산', '3일=1년 비율로 생일~절기 간격을 대운 개시 연령으로 환산 [연해자평]', 95,),
    sentenceEntry('daeun.interpretation', [ClassicalSource.JEOKCHEONSU, ClassicalSource.KOREAN_MODERN_PRACTICE], '대운 해석', '대운 천간지지와 원국의 관계에 의한 운세 해석', 70,),
    sentenceEntry('saeun.interpretation', ClassicalSource.YEONHAEJAYPYEONG, '세운 해석', '해당 연도 천간지지와 원국+대운의 복합 관계 해석', 70,),
    sentenceEntry('saeun.pillar', ClassicalSource.YEONHAEJAYPYEONG, '세운 기둥 산출', '60갑자 순서에 따라 해당 년도의 천간지지 결정 [연해자평: 기계적 규칙]', 95,),

    sentenceEntry('ohaeng.distribution', ClassicalSource.YEONHAEJAYPYEONG, '오행 분포', '8자(4천간+4지지) 중 오행별 개수와 과부족 분석', 95,),
    sentenceEntry('ohaeng.flow', [ClassicalSource.YEONHAEJAYPYEONG, ClassicalSource.KOREAN_MODERN_PRACTICE], '오행 흐름', '상생/상극 순환 연결 상태와 일간 중심 역학 분석', 85,),

    sentenceEntry('overall.synthesis', ClassicalSource.KOREAN_MODERN_PRACTICE, '종합 판단', '격국+용신+강약+신살+일주론 교차 종합 판단', 75,),
]);


export { SENTENCE_REGISTRY };

