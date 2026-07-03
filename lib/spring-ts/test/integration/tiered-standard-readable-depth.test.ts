/**
 * test/integration/tiered-standard-readable-depth.test.ts
 *
 * Guards the commercial-reader shape of the standard tier. Brief stays short,
 * expert stays technical, and standard must be rich enough for a general user
 * to read without opening expert detail.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr.startsWith('https://sql.js.org/') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  return originalFetch(url, options);
};

import { SpringEngine } from '../../src/index.js';

const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'] as const;
const CATEGORIES = [
  'wealth', 'health', 'academic', 'romance', 'family',
  'career', 'study_document', 'expression_children', 'health_stress', 'movement',
] as const;
const MIN_STANDARD_PARAGRAPHS = 6;
const MIN_SENTENCES_PER_PARAGRAPH = 2;
const MAX_ACADEMIC_STANDARD_PARAGRAPH_CHARS = 255;
const MAX_ACADEMIC_STANDARD_SENTENCES = 5;
const MAX_FOCUSED_CAREER_FIRST_PARAGRAPH_CHARS = 245;
const MAX_FOCUSED_CAREER_FIRST_PARAGRAPH_SENTENCES = 3;
const MAX_FOCUSED_MOVEMENT_PARAGRAPH_SENTENCES = 4;
const MAX_FOCUSED_MOVEMENT_PARAGRAPH_CHARS = 260;
const MAX_MINOR_FUTURE_HORIZON_TERMS_PER_STANDARD_CELL = 3;
const FUTURE_HORIZON_TERM_RE = /\uBA3C \uD6D7\uB0A0|\uB098\uC911/g;
const READER_BRIDGE_RE = /숫자와 별점|이 점수는|별점은|숫자는 전체 분위기|점수는 크게|쉬운 기준으로 보면|생활 기준으로 보면|먼저 볼 것은|점수 해석은|점수보다 먼저 볼 것은|이 흐름은 결과를|조금 더 쉽게 보면|실제로 읽을 때는|실제 생활에서는|가장 먼저 볼 부분은|쉽게 말하면|생활에서는|이 해석은/;
const REPETITIVE_SCORE_BRIDGE_RE = /숫자와 별점은 정답표|별점은 결과를 맞히는 답|숫자는 전체 분위기를 짧게|점수는 크게 겁내거나|이 점수는/;
const SCORE_PACING_RE = /직업 방향이 좋게 보일 때|직업 방향이 좋게 느껴질 때|직업 방향이 무난하게 보일 때|직업 방향이 보통으로 보인다는 말|직업 방향이 낮게 보일 때|진로 감각이 낮게 보일 때|이어 갈 이해|이어 갈 질문|오래 두고 볼 기준|점수가 좋게 보일 때|좋은 흐름이 보이면|마음을 크게 밀어붙이기보다|지금 서로 편한 장면|결론을 서두르지 말고 말투|관계가 애매하다는 뜻|편했던 순간 하나|말의 속도를 늦추라는 표시|안부 한마디나 고마움|서로 예민한 장면|작은 배려가 관계의 안정감|좋게 보이는 흐름|보통으로 보이는 흐름|낮게 보이는 흐름|흐름이 좋게 보일 때|흐름이 좋게 보이더라도|흐름이 보통으로 보일 때|흐름이 보통으로 보인다는 말|흐름이 보통으로 보인다면|흐름이 낮게 보일 때|흐름이 낮게 보이더라도|흐름이 낮게 보이면|결과보다 관찰|점수보다 더 분명한 체감|무난하게 보인다는 말|무난한 흐름일수록|무난하게 보이는 변화|작은 확인을 붙일수록 도움이|보통 점수는|일이 중간처럼 느껴질 때|흐름이 무난할수록|다시 정렬할 여지|아주 강한 흐름|아주 강한 신호|보통으로 보이는 흐름|좋은 분위기일수록|편한 말투 하나|좋은 신호가 보일수록|지금 편한 방식|분위기가 괜찮게 느껴질 때|좋은 흐름은 더 많이 벌리는 신호라기보다|가장 효과가 좋았던 한 가지|자신감을 생활의 리듬으로|낮게 보이는 흐름은|낮은 흐름은 멈추라는 말|조심스럽게 보일 때는 결과를 걱정하기보다|새 결정을 서두르지 말고|낮은 점수는 겁을 주려는 신호|낮은 흐름은 속도를|낮은 흐름은 쉬어|먼저 들을 시간과 쉬어 갈 시간|분위기가 무겁게 느껴질 때|작게 말하고 충분히 쉬면|마음이 잘 맞지 않는 날|결론보다 회복|몸이 보내는 작은 신호|무리한 약속을 줄이고|컨디션 신호가 약하게|보통으로 보이는 흐름은 마음이 식었다는 뜻|반복되는 말투와 시간을|관계가 중간처럼 느껴질 때|좋은 흐름은 더 많이 밀어붙이라는 신호|점수가 높게 느껴질 때|점수가 높게 느껴지는 때|좋은 기세가 있을수록|좋은 기세가 보이면|이미 이해한 내용을 자기 말로|몸이 보내는 신호를 먼저 알아차리는|쉬는 시간을 먼저 잡아|컨디션이 약하게 느껴질 때|대화의 크기를 줄이는|서로 덜 날카로울 시간|모든 이유를 한 번에 풀려고|모든 이유를 그 자리에서 다 풀지 않아도|대화를 쉬어 갈 시간|지금 잘 통했던 방식|상대를 더 밀어붙이기보다|기본을 더 가볍게|익숙한 신뢰|상대의 마음을 단정하기보다|말의 양보다 말의 온도|좋은 흐름은 공부량|좋은 흐름은 배움의 양|성공한 방식을 기록|기초를 가볍게 반복|다시 쓸 수 있는 방법|다음 배움|배움의 출발점|배움이 끊긴 것은 아니에요|배움을 포기하라는 말|계속할 수 있는 크기|이어 갈 크기|흐름이 안정돼요|배운 내용을 생활 속 말|무난하게 보일 때|무난하게 보일 때는 노트를|생활 리듬을 확인|몸을 더 몰아붙이라는 뜻|회복 기준을 또렷하게|몸은 작은 반복에 반응|더 가까워져야만|말의 양보다 반복되는 태도|서로를 다시 맞춰 볼 시간|상대가 편했던 순간|관계가 멈췄다는 뜻|덜 날카롭게 말할|내가 반복하는 반응|관계를 방치하라는 뜻|이동이 막혔다는 뜻|먼 곳보다 익숙한 기준|아무것도 하지 말라는 뜻|새 장소보다 돌아올 시간|지금 자리에서 정리할 일을 먼저|멀리 움직이는 결정을|이동의 흐름이 약하게|가까운 곳의 작은 조정|새 일정은 작게 시험|무거운 이동은 몸과 마음|가장 안전하게 시험할 수 있는 작은 이동|관계를 포기하라는 뜻|대화를 작게 나누라는 신호|말의 순서가 생기면|가까운 사람이 멀어진다는 단정|큰 약속보다 작은 예의|반복되는 말투|서로의 속도를 낮추는|서운함이 커질|먼저 확인할 말|덜 부담스러워할 시간|덜 날카로운 말 하나|다시 시작할 크기를 줄여|공부를 포기하라는 말|쉬운 단계를 먼저 끝내는|실력이 정해졌다는 뜻|일을 더 키우기보다|모든 것을 한꺼번에 넓히라는 뜻|새 목표보다 유지할 기준을 먼저|더 많이 해내라는 압박|모든 빈칸을 한 번에|무난하게 보인다면 지금까지 된 부분|순서를 다시 잡으라는 신호|혼자 책임을 전부 떠안지 않는|실패가 정해진 것은 아니에요|성과보다 회복 가능한 일의 크기|잠시 속도를 낮추라는 안내|이미 맞아떨어진 확인 방식|다시 검토할 기준|한곳에 몰아두지 말고|이름, 날짜, 위치|제출할 것과 보관할 것|확인받을 항목|작은 오류를 잡을 시간|정리 기준을 짧게|보통의 흐름에서는|중간처럼 보이는 흐름|무난한 관계일수록|흐름이 보통일 때|자주 보이는 말투|큰 변화보다 작은 말투|좋은 기세가 있을 때는 많이 해낸 양|성공한 방법을 기록|잘 풀린 조건|보통으로 보이는 흐름은 몸이|무난한 흐름일수록 작은 신호|중간 정도의 흐름은 생활 리듬|보통 점수는 방심하라는 뜻|검토 순서를 짧게|보통 흐름은 다시 확인할 순서를|흐름이 보통으로 보인다면 정리가|헷갈리는 기록|필요한 기록과 나중에 볼 기록|보관 기준을 작게|확인할 항목을 나누|기억에 맡기지 말고|잘 맞은 확인 방식|다시 찾을 자료|보관 위치|급한 제출과 기다려도 되는 기록|돈 문제가 애매하다는 뜻|돈을 더 묶어 두라는 뜻|작은 돈 기준|지출이 흔들린다는 말|돈의 속도를 다시 정리|생활을 흔드는 지출|기다릴 수 있는 돈|돈의 방향을 다시 맞춰 볼 기회|큰 성과보다 작은 확인|돈의 기준을 세우기에는 충분|내 생활을 지키는 지출|영수증 하나|더 아끼라는 압박|서로 편했던 방식을 오래 유지|이미 지킨 작은 예의|관계가 잘 풀리는 듯할수록|보관 방식도 한 번 더|문서를 빨리 끝내라는 뜻보다|찾는 길을 단순하게|정리 기준을 다시 잡기 좋은 때|급한 기록과 기다려도 되는 기록|서류를 한꺼번에 끝내려 하지 않아도|문서 보관도 여러 안전장치|다시 꺼내 볼 길을 분명히/;
const SCORE_BRIDGE_TONE_RE = /잘 풀릴 여지가 커요|큰 흔들림이 적고|신중하게 살필수록 부담이 줄어요|아직 점수로 단정하기 어렵다면/;
function hasScoreAwareText(text: string): boolean {
  return SCORE_PACING_RE.test(text) || SCORE_BRIDGE_TONE_RE.test(text);
}
const PERIOD_SCOPE_RE = /오늘 안에서는|오늘 돈 흐름은|오늘 컨디션은|오늘 배움은|오늘 일은|오늘 문서는|오늘 떠오른 생각은|오늘 회복은|오늘 이동은|한 번에 풀려고 하지 않아도|짧게 안부를 전할 시간|눈앞의 대화를 편하게|이번 주에는|이번 달에는|이번 달 기록과 서류는\s|이번 달은 서류|이번 달은 제출할 자료|이번 달은 새 문서|이번 달은 학교에서 받은|올해에는|긴 흐름에서는/;
const SELF_CHECK_RE = /읽고 난 뒤에는|다 읽은 뒤에는|해석을 덮기 전에|마지막으로 .* 내가 이미 잘하고 있는 부분|마지막으로 인생 전체 흐름에서|마지막으로 인생 전체의 표현과 창의(?: 영역)?에서|새로 가 볼 곳과 돌아올 자리|가장 안전하게 시험해 볼 변화|무리해서 멀리 움직일 일|새로운 환경에서 내가 지킬 기준|출발 시간이나 돌아올 시간|새로 시도할 장소보다 돌아왔을 때|이동 뒤에 쉴 시간|가볍게 움직일 일 하나|비용, 시간, 체력 중 가장 먼저 확인|생활을 흔드는 변화와 생활을 가볍게 하는 변화|새 길을 고르기 전에 돌아올 시간|이동이 필요한 일과 제자리에서 정리할 일|다음 이동에서 챙길 사람|오늘 꼭 지킬 기준|돈을 쓰고 싶은 이유/;
const CLOSING_GUIDANCE_RE = /마지막으로, 이 해석은|끝으로, .*한 번에 맞히는 답보다|덧붙이면, 이 해석은|정리하면, .*(?:점수만 보는 것보다|생활과 함께 읽을 때|함께 놓고 볼 때|생활에 맞는 조절점)|크게 맞고 틀리는 문제|더 불안하게 만들기|여러 조언을 한꺼번에|방향을 넓게 보여 주는|오래 두고 다시 읽을수록|무리하지 않을 순서|큰 사건보다 반복되는 선택|마지막으로, 전체 생활은 한 번 읽고 끝내기보다|덧붙이면, 전체 생활은 좋은 말만 모으는 글|정리하면, 전체 생활은 지금의 나를 몰아붙이기 위한 답|끝으로, 전체 생활은 여러 문장을 모두 적용할 때보다|마지막으로, 전체 생활은 시간이 지나며 의미가 달라질 수|부담을 조금 낮출 방법|덜 무거워지는 선택|모든 답을 한 번에 정하는 글/;
const META_PATCH_RE = /이 문장은 하나의 결론/;
const EXPERT_TERMS_RE = /극신강|극신약|신강|신약|천을귀인|천덕귀인|월덕귀인|공망|용신|희신|기신|구신|일간|격국|십성|식상|재성|관성|인성|비겁|천간|오행|음양|신살|대운|세운|정관|편관|정인|편인|상관|식신|비견|겁재/;
const MINOR_ADULT_RE = /연애|결혼|배우자궁|처궁|투자|보증|큰 계약|전성기|자녀·손주|손주/;
const MINOR_FUTURE_ADULT_LIFE_RE = /^life\.(?!(?:0-9|10-19)\.)[^.]+\./;
const MINOR_FUTURE_LIFE_CURRENT_LABEL_RE = /(?:인생 전체로 보면|인생 전체의|긴 흐름에서는)\s*(?:친구 관계|진로 감각|물건과 작은 선택|용돈과 물건 관리)|아이에게 맞는 속도|나에게 맞는 속도를 함께 보세요|아이에게 바로 요구|보호자는 예측보다 관찰|친구 관계에서는|친구 관계는|지금 아이에게 당장|아이에게 습관을 바로 요구/;
const MINOR_FUTURE_WEALTH_OLD_FRAMING_RE = /먼 훗날의 돈과 물건 관리|비용과 약속을 확인하는 습관|큰돈을 바로 맡긴다는 뜻|지금 큰돈을 맡기라는 뜻|큰 결정을 시키려는 뜻|돈과 물건 관리(?:는|를|가|에서)/;
const MINOR_CURRENT_STUDY_DOCUMENT_ADULT_DOC_RE = /계약서|법률문서|등기|서명|원본|사진본|금액|이력서|증명서|돈과 관련된 기록|자격 준비|자격 관련|자격/;
const STUDY_DOCUMENT_ROLE_DRIFT_RE = /공부·서류|배움과 서류|학습 자산|학습 지도|자기만의 공부 방식|오늘의 공부가 자기만의 자료|다음 공부|경쟁보다 배움|내 공부의 전부|함께 확인할 문제|확인 표시을|기본 자료 확인를|검토 순서을/;
const STUDY_DOCUMENT_STUDY_LEAK_RE = /이번 달 공부는 약한 부분|오늘은 책 한 권을 끝까지 읽기보다|오늘의 공부가 자기만의 자료|다음 공부의 시작점|다음 공부의 출발점|공부 기록이 생활 안에서 힘|선생님이나 친구에게 물어볼 때|좋아하는 것을 한 가지씩 알아 가는 시간|누군가의 한마디 조언으로 막혔던 부분|조언이 너무 많아 결정을 미루는|이번 주 공부와 기록|공부 지도|그 공부|학교 시험·읽기쓰기|한 과목|한 단원|모든 과목|올해 공부운|공부 자산|내가 이해한 부분|새로 시작하는 시험|공부 계획이나 서류 목록|새 공부나 문서 프로젝트|공부, 자격, 문서 작업|배운 내용이 실제 성과|속도가 무기|외부 도움 없이도 스스로 결과|외부 도움 없이도 결과|끝까지 밀고 가는 힘|추진력으로 자격·문서|추진력으로 자격·서류 한 트랙|시작과 마무리를 같은 사람이|단단한 흙 위에 기둥|스스로 결과를 만들어 내는|좋은 멘토|어깨를 기댈 언덕|환경의 도움|한마디 조언|한 해의 걸음|결정의 기준이 분명해지는|오랜 기록을 새로운 자산|다음 세대에 한 줄 노하우|올해 공부와 문서 일|큰 시험은 막판|한 트랙|어떤 자리든 무리하지 않으면|익숙한 자리에서 한 발만 더|익숙함에서 한 발만|새 자리로 나가|미뤄도 되는 일과 섞|생활에 붙여 보면|작은 역할 나누기|역할이 나뉘면|책임의 경계|기록과 서류는 무난하지만 조금씩 관리하면 좋아요|올해 기록과 서류는 무난하지만 조금씩 관리하면 좋아요|인생 전체로 보면 기록과 서류는 무난하지만 조금씩 관리하면 좋아요/;
const STUDY_DOCUMENT_FIRST_PARAGRAPH_REPEAT_RE = /기록할 것[^.!?]{0,120}확인받을 것|확인받을 것[^.!?]{0,120}기록할 것|확인받을 것[^.!?]{0,120}확인할 사람|기록할 것, 확인받을 것, 다시 볼 것/;
const STUDY_DOCUMENT_EXPERT_PAIRING_DRIFT_RE = /학습\/문서운|학업·시험에서는|젊은 시기의|오늘 한 단원의 깊이|이번 주 한 단원의 깊이|한 달의 한 단원|한 해의 한 트랙|한 단원|한 트랙|한 페이지의 깊이|키가 돼요|첫 자격·시험|다음 시험·자격|학교 과정보다 자기 호기심|기본 자료 확인를|검토 순서을|학습이 글·메모|자기 학습|문서 장기운|후반부까지 이어지는 자리|외부에 전달되는 자리|남기는 자리가 결실|정리 자체가 자산이 되는 사주|자산이 되는 사주|자격·문서 자리|자격·서류운|평생의 자산이 되는 사주|자격 갱신·전수의 자리가|전문가의 자리에|한 분야의 권위자로 자리잡는|큰 문서 앞에서 흔들리지 않는 자리|자격·서류운|깊은 학습이 함께 가는 자리|외부에 남는 자리가|속도 자체가 무기인 사주|자기 무기가 되어|도움 청하는 한 마디가 가장 큰 자산|가장 큰 자산이 되어 주는 사주|자격·자리가|큰 결단·확장의 자리가|시스템이 가장 큰 자산|큰 자리의 폭|큰 결단의 무대|부담이 자산/;
const ACADEMIC_GENERIC_DRIFT_RE = /공부와 배움에서는 지금 확인할 작은 범위|믿을 만한 사람에게 묻고, 들은 조언은 내 말로 짧게 다시 적어|시작 전에 지금 확인할 표시 하나를 남기면 다음 공부/;
const LIFE_SHORT_HORIZON_RE = /오늘|지금 바로|지금 당장|당장|가까운 일정|실제 하루|생활에서 바로|하루 더|바로 결론|바로 처리|작은 행동|첫 행동|써먹|지금은 어려운 범위|지금은 마음이|지금 필요한 조정|지금 필요한 준비|지금 잘 맞지 않는 말/;
const MOVEMENT_GENERIC_OVERLOAD_RE = /이동운|시간, 비용, 회복 기준|동선, 비용, 체력|준비 부담과 회복 여유|출발 전 부담과 회복 여유|출발 전 부담과 다녀온 뒤 회복 시간|출발 전 부담|다녀온 뒤 회복 여유|돌아온 뒤 회복 여유|비용, 돌아올 시간|생활비, 회복 여유|이동 시간, 쉴 곳, 동행할 사람|준비물 하나, 동선 하나, 회복 시간 하나|함께 확인할 사람, 들어갈 비용, 회복할 시간|출발 전과 돌아온 뒤의 시간|돌아와 쉴 칸|다녀온 뒤 지킬 생활 리듬|새로 가 볼 곳과 다녀온 뒤 지킬 생활 리듬|새로 바꿀 것과 그대로 둘 생활 리듬|바꿀 것과 지킬 생활 리듬|먼저 바꿀 동선과 그대로 지킬 생활 리듬|지금 생활 안에서|지금 떠날 일|지금의 동선|돌아온 뒤 몸과 마음을 살필 기준|준비와 회복의 안전함|지금 생활을|자리에서 정리해도 되는 일|시간, 비용, 체력|시간, 비용, 몸 상태|시간, 체력, 비용|비용, 시간, 체력|이동과 비용, 체력|출발 시간, 비용, 체력|시간, 비용, 돌아올 기준|돌아올 기준|새로 가 볼 곳과 돌아올 자리|출발 시간이나 돌아올 시간|이동 뒤에 쉴 시간|가볍게 움직일 일 하나|새 길을 고르기 전에 돌아올 시간|가까운 곳의 작은 조정|작은 이동|평생 회복의 자산|회복의 자산|큰 이동의 기회|지금 갈 일|지금 자리에서 정리할 일|출발 출발/g;
const ACADEMIC_LIGHTWEIGHT_ACTION_RE = /써먹|돌아올 기준|학업운|20대의 학업 방향|30대의 학업 방향|40대~50대의 학업 결|50대 후반에서 60대의 학업 결|70대 이후의 학업 결|평생 학업|학교 중심의 공부|실무 공부|공부 방식|공부 리듬|공부량|잘 맞는 배우는 방식|필요한 배움과 나중에 다시 볼 배움|학습 한 단원|한 단원씩 차분히 매듭|새로운 공부 습관|낯선 과목|어려운 단원|공부가 잘되는 시간대|과제, 시험, 자격 준비|새로운 공부는 작은 결과물|반복 학습|월 목표는 단원|단원, 문제 수|탄탄히요|학습 시간|학습 자리|학습 리듬|책상의 자리|가르치며 배우는 자리|작은 실천 결|자녀·손주|손주|다음 공부|다음 배움|지금 끝낼 작은 범위|오늘 끝낼 작은 범위|지금 끝낼 범위|오늘 끝낼 범위|지금 다룰 범위|오늘 다룰 범위|오늘 다시 설명해 볼 작은 단서|공부 자산|공부 계획|오늘의 공부|공부 시간|공부 단위|공부법|공부와 배움|배움과 이해|배움의 흐름에서 흐름|배움의 흐름에서 낮게 보이는 흐름|폭발적으로 솟기|도움을 청하는 한마디가 아주 큰 자산|막힌 자료와 설명할 내용|새 공부|새로 시작할 공부|공부보다|배움를|배움가|배움과 이해은|배움과 이해을|배움과 이해이|다음 배움를|지금의 배움가|새 배움를|이어 갈 이해은|이어 갈 이해이|이어 갈 이해을/;
const OVERALL_LIFE_CURRENT_ACTION_RE = /일정, 이동, 돌아올 시간|일정이나 이동|오늘의 나|오늘의 생활|오늘 바로|오늘 실제로|오늘 줄일|오늘 덜어낼|오늘 편해지는|다음 한 주|이번 주에 실제로|바로 적용할|바로 도움이 되는|바로 해 볼|바로 쓸|당장 바꿀|지금 바로|지금 당장|지금의 나에게|지금의 생활|지금의 하루|지금 생활에|지금 할 수 있는|지금 편해지는|지금 몸 상태와 일정|오늘 가장/;
const CAREER_LIFE_GENERIC_WORK_RE = /직업운|직업 흐름|일과 책임|일 흐름|그 시기의 일의 흐름|맡을 책임과 도움받을 범위|먼저 맡을 일과 도움받을 일|경험과 책임의 크기|책임을 맡을 때 필요한 기준|일의 흐름은 무난하지만 조금씩 관리하면 좋아요|일의 흐름은 조심스럽게 살피는 편이 좋아요|일의 흐름은 잘 풀릴 가능성이 보여요|점수보다 먼저 볼 것은 일의 방향|계속 맡을 일과 편히 넘길 일|일의 흐름이 덜 막연|인생 전체의 일의 흐름|인생 전체에서 일의 흐름|일의 흐름이에요|일의 결이에요|작은 약속과 가까운 사람을 차분히 챙긴 경험이 큰 자산|자기 페이스를 지킨 사람이 가장 멀리 가는 흐름|내 흐름에 맞게|맡을 범위와 도움받을 지점|역할의 크기|역할의 경계|책임의 경계|역할 조율|도움받을 곳|회의, 연락, 마감|마감, 사람, 내 컨디션|마감, 역할, 컨디션|지금 가볍게 끝낼|지금 내가 직접 할 일|오늘 끝낼|오늘 직접 할|먼저 처리할 것 하나|바로 처리할 것 하나|큰 역할만|결정의 무게|결재하지 말고|후배의 길잡이가 되는 자리|전 역할의 무게|맡은 역할을 단단히 받쳐|단단한 어깨|어깨가 단단|어깨를 함께 받쳐|다음 자리의 디딤돌|내 책임과|계속 맡을 책임|책임 자리가|역할를|오래 남길 경험과 나눠도 되는 경험|경력의 무게가 덜 막연|성과의 크기보다 어떤 신뢰|오래 쌓인 신뢰와 앞으로 나눌 경험|맡아 온 일이 신뢰로 차곡차곡|꾸준함이 가장 큰 자산|긴 흐름에서는 새 역할과 사람을 만나며 일의 폭|기회가 많아질수록 모든 일을 다 잡으려|일의 방향의 방향|인생 전체의 일의 방향에서 흐름이 낮게|일과 사람 사이의 균형이 큰 자산|현재 일에서의 작은 결정|길게 쥔 신뢰|일의 마무리를 자기 자산|맡은 자리에서 신뢰가|굵직한 자리의 문|도움받는 손이 닿는 자리|부담을 잘 다루면 자리가|첫 자리를 찾아가며|책임이 커지면서 자리도|단단한 자산으로 자리잡는|오래 쌓아 온 결이 후배의 길잡이|한 분야에서 자기 색|자기 색을 입혀|한 자리에서 색을 입혀|일의 흐름을 더 잘 살피기 위한 참고표/;
const CAREER_LIFE_OVERUSED_ROLE_RE = /자리|책임|역할|어깨/g;
const MAX_CAREER_LIFE_ROLE_TERMS_PER_CELL = 12;
const CAREER_YEAR_SHORT_WORK_RE = /일과 책임|회의, 연락, 마감|지금 바로 적용|바로 처리할 것|먼저 처리할 것|오늘 끝낼|오늘 직접 할|오늘은 계속할|오늘은 성과|오늘의 순서|지금 내가 직접|지금 맡은 일|지금 맡은 책임|지금의 선택|지금 필요한 조언|지금 덜 무거워지는 선택|지금 바로 보이는 결과|마감, 역할, 컨디션|마감, 사람, 내 컨디션|마감과 사람, 내 컨디션|마감, 협의할 사람, 내 체력|맡을 일의 크기|직접 할 일과 나눌 일|맡을 일, 미룰 일, 확인받을 일|급한 일, 맡은 일, 확인할 일|큰 역할만|역할 전환|결정의 무게|결재하지 말고|후배의 길잡이|자리·책임|직업 결|한 자리에서|다음 자리|올해 올해|먼저 떠오르는 한 가지|실제 행동|함께 검토할 일을 함께|직접 끝낼 결과와 함께 검토할 일|올해는 결과만큼 과정을 기록해 두세요|함께 검토할 일|당장 보이는 결과|올해 바로 쓸 기준|올해 직업 흐름에서 보통으로 보이는 흐름|올해 직업운|올해 직업 흐름|올해 직업운에서 올해|올해 직업 흐름에서 올해|올해 직업 흐름은 무난하지만 조금씩 관리하면 좋아요|점수보다 먼저 볼 것은 올해 남길 결과의 크기|연말에 설명할 결과|올해 끝에 설명할 결과|남길 결과, 함께 볼 사람, 보류할 제안|12월에 보여 줄 결과물 하나만|피하고 싶은 일보다 올해 먼저 챙길 결과 하나|피하고 싶은 제안보다 올해 먼저 챙길 결과 하나|올해 남길 결과, 함께 볼 사람, 나중에 다시 읽을 기록 중 하나를 정하면 방향이 덜 흔들려요|어깨/;
const CAREER_SHORT_PERIOD_GENERIC_WORK_RE = /이번 주의 직업운|이번 달의 직업운|이번 주의 직업 결|이번 달의 직업 결|이번 주 직업 흐름|이번 달 직업 흐름|이번 주 일과 책임|이번 달 일과 책임|이번 주의 일과 책임|이번 달의 일과 책임/;
const CAREER_YEAR_ROLE_TERM_RE = /책임|역할|어깨/g;
const THIS_YEAR_SHORT_HORIZON_PUBLIC_RE = /오늘은 길게 설득|오늘은 새 장소보다|오늘 바로 연락|오늘 내가 맡을|지금 바로 적용할 수 있는 말|적어보세요/;
const MAX_CAREER_YEAR_ROLE_TERMS_PER_CELL = 6;
const BAD_PUBLIC_PARTICLE_RE = /이번 달 이동 결은 출장·외근의 자리가|올해 이동 결은 출장·해외 자리가|책임 큰 자리에서 자리를|자리를 옮기는 결정 하나|무리한 자리 변경|가족과 자기 자리 사이|출장·이직·이사 자리가|이사·이직 자리가 한 번 크게|출장·해외 자리는 무리|이동과 변화은|이동과 변화을|적어 두는 자리예요|호수처럼 잔잔한|짧고 잔잔한 이동|확인하는 자리를|가족과의 자리가|학업·친구 자리|같은 자리·같은 한 끼|자리를 잡는 시기|함께 쓰는 자리|함께 쓰는 리듬이 자리를|권유받은 자리를|자기 자리에서 누리는|정리와 나눔의 호흡이 가장 자연스러운 자리|정리하고 나누는 자리에서|약속과 컨디션을 한 번 더 확인하면 좋은 기운|오늘 가장 자주 마주치는 부분|도는 자리예요|좋아하는 자리를|익숙한 자리와 새로운 자리가|잠자리 자리가|자기 자리가 단단|한 해 끝의 자기 자리가|나눠 두는 자리가|이어 가는 자리가 평생|자기 자리에서 또렷이|다음 분기의 자리를|한 주 시작에 짧게 적어 두는 자리가|이어 가는 자리가 자기 색|자기 자리가 비어|한 주의 시작 자리에서|같은 자리에 쌓아 두면|마음이 답답한 자리가|자기를 챙기는 자리가|자기 자리가 단단하게|할 일을 작게 나누면|작게 정리할 일부터|다음 10년 자리의 폭|한 자리에서 뿌리내린|다음 세대와의 자리는|자녀와의 결|정돈하는 자리예요|주위에 자리를 만들고|빛깔이 진해지는 자리예요|일과 책임 근거|방향정|친구와의 자리가|친구와의 일상적인 자리를|자기 자리에서 가장 또렷한 건강 지도|자기 자리를 오래|지나온 자리의 실마리|회복의 자리가|받은 자리에 책임|자기 자리의 중심|다음 자리의 디딤돌|작은 흐름을 알아채기 좋은 자리|가족·후배·이웃과 함께 쓰는 리듬이 자리를|자녀·후배·이웃과 함께 쓰는 리듬이 자리를|한 결 가벼워져요|가족과의 자리는|한 끼·한 안부의 작은 온기가 자기 자리|작은 자리 하나가 가족과의 거리|짧은 대화 자리를|흐르는 흐름|한 흐름으로 이어진 흐름|좋은 흐름이에요|단정 없이 흐르는|한 자리가 길게 남는 흐름|관심사 자리를|다음 주의 첫 자리|권유받은 흐름|인연 자리가 넉넉하면|자리가 비어 있던|쌓아 온 흐름은|마음의 흐름을 호수|마음·몸이 [^.!?]*자리 ?잡는|마음과 몸이 [^.!?]*자리 ?잡는|자녀 세대와의 흐름|새 인연이 들어올 자리|인연 한 줄|동료의 자리가 든든하게|도예가가 손에 쥔 흙|큰 무리수 없이 흘러가는 흐름|자연스럽게 자리 잡는 흐름|자리의 중심|첫 자리의 방향|한 자리에서 1년|무리한 자리|무리한 자리를|시작의 중심이|첫 자리에서의 작은 인정|한 자리에서의 마무리|다음 자리를 고를|시작 자리를|자기 기준에 흘러요|새로운 변화를 한꺼번에 받는|디딤돌을 놓는 자리|자기 자리의 빛|짝과 관련한|체감\||기준가|자료은|약속를|범위을|자료이|약속는|조건, 조건|자기 기준가|자기 기준를|사주에 가장 필요한|물\(水\)|쇠\(金\)|인연 자리는|인연운|친구·가족과 어울리는 자리|한참 노는 흐름 위|시험·발표 같은 자리에|정해진 식사 자리|사람과 사람 사이의 따뜻한 자리|호수의 깊이|한 자리에서 천천히 자라나|자기 자리를 만들어 줘요|한 마디의 자리도 자기 자리|관리을|관리이|관리은|관계을|관계이|창의이|창의을|사람에서|실마리을|흐름을 다듬는 흐름|한 학기 한 자리|자기 평생의 단단한 자리|가까운 어른에게 짧게라도 나눠 두는 자리|일상의 작은 자리들이|평생 갈 자산|흐름실|자격 어휘|천천히 차오르는 자리|작은 자리가 평생을|한 점씩 더해 두는 작은 자리가|받쳐 주는 나중에 다시 볼 자료|함께 챙기는 흐름을 자연스럽게 받아들이는 흐름|한 박자 늦추는 자리를|잔잔한 자리에서 가까운|익숙한 자리의 작은 변화|잔잔한 (?:결|흐름)의 이동을 권해 드려요|정리하고 나누는 자리가|여행과 머무름의 흐름이 함께하는 흐름|가까운 자리에서 풍요로운 풍경|마음 편한 자리에서 회복이|말를|기억로|평생 흐름|큰 해예요|힘이 좋아 활동량을 받아 낼 힘|정기 휴식 자리를|다듬는 자리를|누적된 자리가|책임 자리가|한 달이라는 자리|강한 결일수록|누군가의 큰 자리|오늘 한 자리에서는|자리로 모이는 자리|한쪽 어른 자리|산책 한 자리|첫 자리를|평생 한 자리에 머물지 않고 새 길을 두어요|너무 오래 한 자리에만 있으면 무거워져요|푹 빠지는 자리|펼쳐 보는 자리|채워 가는 자리|12월 자리|익숙한 자리에서 작은 발견|버는 자리와 지키는 자리|본가와 자기 자리|본가 자리|모종을 옮겨 심는 자리|자기 호흡이 모이는 자리|새 친구를 만나거나 함께 무언가를 만드는 자리|새로운 도구·이야기·노래를 만나는 자리가|인생 전체의 전체 생활 영역|도움을 받는 자리|받는 자리에서 자기|평생 가족 자리|평생 자리에서|흐름이 고른 흐름|익숙한 자리들이|받쳐 주는 자리가|자기 자신을 위한 자리|가마솥 한 솥|잠 자리를|한 가지 운동·취미를 꾸준히 갈고 닦는 모양|좋아하는 활동에 시간을 들이는 자리|답을 찾는 자리가|재워 주는 자리가|학습 자리|외우던 자리가|새 환경은 [^.!?]*자리가 좋아요|새 자리는 [^.!?]*자리가 좋아요|좋아하는 (?:결|흐름)을 깊게|작은 실천 결로는|사주에서|사주라|사주예요|사주이니|만들어집니다\.|만들어 줍니다\.|지칩니다\.|줄어듭니다\.|얻습니다\.|이어 줍니다\.|자랍니다\.|살아납니다\.|납니다\.|넓어집니다\.|좋아집니다\.|가벼워집니다\.|단순해집니다\.|분명해집니다\.|또렷해집니다\.|쉬워집니다\.|커집니다\.|이어집니다\.|깊어집니다\.|강해집니다\.|[가-힣]+해집니다\.|[가-힣]+워집니다\.|어렵습니다\.|괜찮습니다\.|쉽습니다\.|중요합니다\.|필요합니다\.|[가-힣]+니다\.|큰 관계 말|가족과 가까운 사람을|친구·가족과의 자리|따뜻하게 챙겨 주는 자리|새 친구를 만나는 자리|놀이 자리|그 자리에서 사이가|작은 안부 자리가|새로운 자리가 생긴다면|보호자가 옆에 함께 있는 자리|어른의 어휘|친구·가족의 자리를|인연 자산|자기 흙|그릇이 묵직|친구에게 줄 작은 선물|작은 비용|자기 우선순위|좋아하는 책 열 권 사기|작은 외식|평생 갈 자리가|큰 한 방을 좇는 권유|맡은 역할을 단단히 받쳐|페이스를 한 번 늦추는 자리를|즐기는 자리가 보약|풀어 주는 자리가|한꺼번에 잡고 가는 자리|새 가정의 흐름은 [^.!?]*자리라|같은 자리에 오래 앉아|책상의 자리가|햇볕이 잘 드는 자리를|표현해 보는 자리가|마음 자리를|자리를 키워 가는 흐름|강·약 자리가|한 해의 작은 자리에서|오늘의 작은 자리가|긴 흐름 [가-힣 ]+ 영역|인생 전체에서 [가-힣 ]+ 영역에서|결재하지 말고|후배의 길잡이가 되는 자리|작은 여행·짧은 출장|환기 자리|환기 자리가|마음 편한 자리|잠자리·식사 자리|잠 자리·식사 자리|가까운 사람의 손길|가까운 사람의 손길이|중요한 내용은 한 줄로|확인한 내용과 고친 내용을|표현과 창의에서는 완벽하게 보이려|내 자리를 자주 받쳐 주는|내 자리를 부드럽게 받쳐 주는|긴 설명보다 작은 확인|안부 한마디, 집안일 하나|어느 자리에 무게|한 자리에서 무리하면|어깨에 자리가|자라나는 나무에 가지치기|장기 관점이 등장|재물운은 가족·일·자기 사이에서 흐름|긴 설명보다 오늘|긴 설명보다 서로|콘텐츠 한 자락|가르치며 배우는 자리|40·50대 학습자|학업운은 익힌 것을|자리가 자주 열리는 시기|한 해 끝의 한 자락|오늘 유지할 기준|오늘 바로 줄일 부담|오늘 바로 쓸 수 있는 말|공부와 배움에서는 오늘 확인|실제 하루에 붙여|세 달에 한 번씩씩|오늘 덜 지치는 선택|오늘 편했던 시간대|오늘은 편했던 순간|오늘 다시 볼|오늘 가장 부담|오늘의 점검표|바로 줄일 부담|가족나|부담예요|순서을|역할를|출발 출발|산책 시간가|시간가|받는 결과|결과 호흡|결과 같이|흐름데|결와|따뜻한 차 한 잔의 시간를|따뜻한 차 한 잔의 자리를|마음 편한 사람과 산책을|푹 자는 자리를|평소 습관이 가장 큰 자산|마음을 따뜻하게 챙기는 일이 가장 큰 보약|마음의 짐을 내려놓는 자리가|마음의 속도를 의식적으로 늦추는 자리가|이 시기 사주는|책임이 한꺼번에 닿기 쉬운 자리/;
const BAD_BRIEF_ENDING_RE = /(?:안|편안|편|부|덜|천천|수|하면|흐름)요\.|중요\.|힘이 가요\.|넓어지요\.|고집하지요\./;
const BAD_BRIEF_AWKWARD_RE = /가까운 자리부터|오늘의 이동운은|오늘의 이동 결은|책임 큰 자리에서|미팅·외근의 자리가|외근 자리 사이|외근의 자리에서|이동의 흐름은 새 자리를|새 자리가 좋아|학업운|학업 흐름|출장·해외 자리가|출장·외근의 자리가|외근의 자리가|이사·이직의 자리가|이사·이직 자리가|출장·이직·이사 자리가|여행·체험의 자리가|가까운 여행과 머무름의 자리가|정리와 새 자리|새 자리에서|새 자리가|익숙한 자리에서 한 발짝|가까운 자리의 모임|산책 자리가|움직이는 자리를|길잡이의 자리가|자리를 깊이 자라게|맡은 자리에서 신뢰|굵직한 자리의 문|도움받는 손이 닿는 자리|부담을 잘 다루면 자리가|첫 자리를 찾아가며|책임이 커지면서 자리도|단단한 자산으로 자리잡는|오래 쌓아 온 결이 후배|후배의 길잡이가 되는 자리|맡아 온 일이 신뢰로 차곡차곡|꾸준함이 가장 큰 자산|일의 흐름이에요|일의 결이에요|한 자리에서 색|한 분야에서 자기 색|자기 색이 깊어지고|자기 색을 입혀|한 자리에서 자기 색|자기 색을 한 줄|줄여보세요|한 트랙/;
const STANDARD_LIGHTWEIGHT_PUBLIC_RE = /잘 풀릴 가능성이 보여요|무난하지만 조금씩 관리하면 좋아요|조심스럽게 살피는 편이 좋아요|써먹|다음 공부|다음 배움|돌아올 기준|참고표|바로 쓸 말|가볍게 쓸 말|가볍게 참고할 말|오래 참고할 말|지금 쓸 말|지금 참고할 말|지금 필요한 말|현재 필요한 말|오늘 맞는 말|천천히 볼 말|나중에 볼 말|나중에 다시 볼 말|먼 훗날 다시 볼 말|생활에 붙여|생활에 붙일|생활에 붙이기|생활에 붙기|생활에 붙는|실제 생활에 붙여|해석이 생활에(?!서)|지금 바로 적용할 수 있는 말|마음에 남는 문장이 있다면|마음에 걸리는 말 하나를 실제 행동|부담이 가장 작은 행동 하나|보는 참고예요|현재 아이의 선택|공부와 배움|작게 정한 일이 있어야|해석 전체를 옮기려 하지 말고|확인할 사람·자료·시간|가장 덜 무거운 확인 순서|마음에 남는 문장 하나를 생활 속 행동|생활에 바로 붙이고|오늘은 길게 설득하기보다|보는 말이에요|나누는 말이에요|나누는 표시예요|찾는 표시예요|정리하는 표시예요|나누라는 안내예요|확인하라는 안내예요|보라는 안내예요|살피라는 안내예요|참고하라는 안내예요|찾아보라는 안내예요|정리하라는 안내예요|남기라는 안내예요|[가-힣]+하라는 안내예요|안내에 가까워요|안내일 수 있어요|남기는 안내예요|찾아살펴보세요|속도를 낮추라는 표시로|도움이 될 말을 표시|오래 가져갈 조언|참고할 조언|표시예요|표시 하나|생활에 붙어요|다시 붙을 리듬|꺼내 볼 표현과 더 다듬을 표현이에요\. 꺼내 볼 표현과 더 다듬을 표현|마음에 남는 문장 하나를 실제 행동|오늘은 가장 편한 문장 하나|마음에 남은 문장을 실제 일정|실제 일정이나 대화 하나에 붙여|막힌 자료와 설명할 내용/;
const STANDARD_AUX_AWKWARD_RE = /해외 자리는|가까운 자리부터|시간을 더 장기적인 준비할지|더 장기적인 준비할지|작게 시험한 뒤 시간을|큰 일의 무게를 바로 맡으면|큰 책임을 바로 맡으면|큰 일을 바로 넓히면|줄여보세요|결론을 정해두|결론을 정해 두|줄어드어요|한 발씩 새 자리|올해의 한 트랙|이번 달의 한 트랙|미뤄도 되는 일과 섞|가족·아이|공부·업무 자료|적어보세요|시작 오늘 가능한 범위|오늘 몸과 마음에서 오늘 몸과 마음|오늘 긴장과 회복에서 오늘 가장|오늘 가족과 가까운 관계에서 오늘 내가|인생 전체의 가족과 가까운 관계에서 가족 안에서|덜 무겁게 만들 행동|결정은 가까운 결과|받는 결과|결과 호흡|시간을 가지요|넓어지요|고집하지요|가까운 사람도 부담이 적어야 관계의 좋은 흐름도|다녀온 뒤 다시 붙을 리듬|지금 참고할 기준과 나중에 다시 볼 기준|가볍게 참고할 기준과 나중에 다시 볼 기준|표시만 해 두고|작게 적용|마음에 남는 말은 바로 해내려|이동 근거는 새 자리를|첫 행동|짧고 말하면|두요/;
const EXPERT_MOVEMENT_SHORTCUT_RE = /작은 이동|새 자리·새 거래|새 거래|짧고 잔잔한 이동|잔잔한 이동|회복의 자산/;
const EXPERT_FAMILY_AWKWARD_RE = /받는 결과|흘려 주는 결|보호자 자산|받는 결을/;
const EXPERT_AWKWARD_PUBLIC_RE = /책임 큰 역할|40·50대 이동운|이사·이직·해외 자리가|이사·이직·해외 자리 같은 큰 변화의 자리가|가족과 일 자리|큰 변화의 자리|청년기 자리가|첫 자취·첫 직장·첫 해외 자리가|자리가 곧 결실|연간 이동운|전환 이벤트|연간 우선순위|천이궁의 자리|확장형 이동|기반 점검형 이동|실익 검토|리스크|출장·외근의 자리|책임 큰 자리의|일간 단위 이동 해석|후반기 이동운은|후반기 이동 결은|정리와 새 자리|출장·해외 자리|오래 머문 자리에서 새 자리|가까운 새 자리가|옮긴 자리에서|책임 큰 자리와|자기 자리를 옮기면|가족 자리와|회복 기반로|평생의 기억로|작품·발표 자리가 한 단계 깊어지는 흐름|표현의 흐름으로 맞물리|평생을 통해 자라는 흐름|깊은 정리·예술의 자리가 만들어지는 흐름|깊은 정리·연구의 자리가 만들어지는 흐름|문서 흐름이 차분하게 자리 잡는|자기 자리에 머무는 호흡|곁의 도움을 거절하지 않는 호흡|직업 길이 한 흐름으로 모이는 자리가|흐름이 한층 또렷해져요|평생의 흐름이 한층|흐름이 모이는 흐름|학문·시험의 흐름이 부드럽게 자리 잡는 흐름|가르치고 배우는 자리가 한 흐름|평생을 통해 배움이 결실로 이어지는 흐름|큰 시험·논문·자격증 같은 결정 시기가 한 흐름|흐름의 막힌 자리를 풀어 주는 자리가|모자란 자리를 자연스레 받쳐 주는 호흡|돈의 흐름은 #?정재의 고정 흐름|#?정재의 고정 흐름|#?편재의 변동 흐름|편재의 변동 흐름|약한 자리를 메우는 (?:결|흐름)|자기 자리를 단단히 다지기 좋은 흐름|자리의 정점에 가까워지는 흐름|자리·책임의 무게가 자산이 되는 흐름|직업 자리의 큰 그림이 한 리듬|평생을 통해 정점의 흐름|자산 자리가 한 흐름|자산 흐름이 한 단계 깊어지는 자리가|짧은 외출이 자기 컨디션|가까운 회복 흐름이 다정하게 닿아 주는 흐름|새로운 환경의 .*풀어 주는 자리가|자리를 받쳐 주는 흐름|자기 결에 잘 맞아요|자기 흐름에 잘 맞아요|보호와 학습 기반|책임 자리와|결과 자리가|맡은 자리를 지키는 힘|결과 생산|성과 압박을 무리하게 키우기보다|새 환경·새 일정의 도움 기운|자리의 도움 기운|이동의 도움 기운|자리·인연의 도움 기운|머무름의 도움 기운|삼형의 도움 기운|새 자리·새 사람의 도움 기운|이동의 흐름은 #?역마|함께 살아나는 자리에서|시험·연구 흐름이 부드럽게 자리 잡는 모양|글·문서의 흐름이 부드럽게 자리 잡는 흐름|평생의 자리·책임의 무게|자기 흐름의 평온함|자기 흐름을 단단히 다지기 좋은 흐름|새 거래·이동의 (?:결|흐름)|학습 한 단원|한 단원씩 차분히 매듭|정리할 결이 자연스럽게 모여요|정리할 흐름이 자연스럽게 모여요|정리하기 좋은 흐름이 보여요|생애 학업운|학습 입력|학습 루틴|시험·연구의 기회|차분한 학습 페이스|반복 학습|학업운|학습 산출|학습 속도|성과 생산|학습 수용성|학업의 흐름|실무 학습|짧은 산출|주차별 산출물|이번 주 산출물|밖으로 남기는 산출물|산출물로 이어지는지|안정적 산출|꾸준한 생산성|용신 방향의 산출|월간 산출|산출 속도|문서 결과물의 생산성|표현과 산출 속도|장기 생산성|산출량과 대외 표현|직업운에서 봄과 여름|직업운에서 가을과 겨울|직업운은 외부 반응|식신의 산출|이번 달 직업운은|이번 주는 표현과 창작의 속도가 붙을 수 있습니다|이번 달 표현력은 아이디어가 빠르게 밖으로 나오는 구간입니다|차별화된 메시지를 만듭니다|학습\/문서운|문서 자리는|직업운은 #?정관|직업 흐름은 #?정관|자기 자산이 되는 모양|한 분야의 권위 자리가|자격·계약·발표 흐름이 한 방향으로 마무리되는 자리가|식신의 흐름이 단단하게 자라는 자리|법률기록|평생의 직업운|평생의 직업 결|직업 결을 더 또렷이|직업운을 장기 구조|직업 흐름을 장기 구조|큰 자리를 정면으로 받아 내는 직업운|자기 자리를 만들어 가는 직업운|한 자리에서 길게 자기 색을 키워 가는 직업운|직업 방향의 큰 그림|자기 격에 맞는 직업 방향|문서 장기운|외부에 전달되는 자리|남기는 자리가 결실|정리 자체가 자산이 되는 사주|자격·문서 자리|자격·서류운|평생의 자산이 되는 사주|자격 갱신·전수의 자리가|전문가의 자리에|한 분야의 권위자로 자리잡는|큰 문서 앞에서 흔들리지 않는 자리|자격·서류운|깊은 학습이 함께 가는 자리|외부에 남는 자리가|속도 자체가 무기인 사주|자기 무기가 되어|도움 청하는 한 마디가 가장 큰 자산|가장 큰 자산이 되어 주는 사주|자격·자리가|큰 결단·확장의 자리가|시스템이 가장 큰 자산|큰 자리의 폭|큰 결단의 무대|부담이 자산|천의의 자리|회복의 흐름이 부드럽게 자리 잡는 사주|음양조화도의 평균이 또렷한 사주는|회복 습관이 평생의 무기|일을 분산하는 습관이 평생의 무기|평생의 회복기지|돌봄을 자주 빌리는 자리가 평생|결정이 한꺼번에 몰리는 자리|빠른 강을 잠시 잔잔한 호수에 두는 감각이 평생|자기 사주의/;
const EXPERT_TAG_SUFFIX_JOIN_RE = /#(?:용신|역마|대운궁실|월주)(?:방향|신호|흐름)/;
const EXPERT_TAG_PARTICLE_SPACE_RE = /#[^\s#]+ (?:이|가|은|는|을|를|과|와|에)(?=\s)/;
const ADULT_EXPRESSION_NARROW_CHILD_RE = /가족이나 아이와의 일|아이가 보내는 신호|가족·아이|아이 일정|아이와의 일|아이의 페이스/;

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, evidence?: string): void {
  if (cond) {
    pass += 1;
    console.log(`  PASS ${label}${evidence ? ` (${evidence})` : ''}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${label}${evidence ? ` (${evidence})` : ''}`);
  }
}

function cellRows(tm: any): Array<{ key: string; cell: any }> {
  const rows: Array<{ key: string; cell: any }> = [];
  for (const period of PERIODS) {
    const p = tm?.periods?.[period];
    rows.push({ key: `${period}.overall`, cell: p?.overall });
    for (const category of CATEGORIES) {
      rows.push({ key: `${period}.${category}`, cell: p?.byCategory?.[category] });
    }
    if (period === 'life') {
      for (const [band, scoped] of Object.entries(p?.byAgeBand ?? {})) {
        rows.push({ key: `life.${band}.overall`, cell: (scoped as any)?.overall });
        for (const category of CATEGORIES) {
          rows.push({ key: `life.${band}.${category}`, cell: (scoped as any)?.byCategory?.[category] });
        }
      }
    }
  }
  return rows;
}

function cellForMatrixKey(tm: any, key: string): any {
  const parts = key.split('.');
  if (parts[0] !== 'life') {
    const period = tm?.periods?.[parts[0] ?? ''];
    return parts[1] === 'overall' ? period?.overall : period?.byCategory?.[parts[1] ?? ''];
  }
  if (parts[1] === 'overall') return tm?.periods?.life?.overall;
  const scoped = tm?.periods?.life?.byAgeBand?.[parts[1] ?? ''];
  return parts[2] === 'overall' ? scoped?.overall : scoped?.byCategory?.[parts[2] ?? ''];
}

function paragraphTokens(paragraphs: any[]): any[] {
  return paragraphs.flatMap((paragraph) => Array.isArray(paragraph?.tokens) ? paragraph.tokens : []);
}

function sentenceCount(text: string): number {
  const punctuation = text.match(/[.!?]/g)?.length ?? 0;
  if (punctuation > 0) return punctuation;
  return text.trim().length > 0 ? 1 : 0;
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function standardTexts(rows: Array<{ key: string; cell: any }>): string[] {
  return rows.flatMap(({ cell }) =>
    (cell?.standard?.paragraphs ?? []).map((paragraph: any) => String(paragraph?.plainText ?? '')));
}

function briefTexts(rows: Array<{ key: string; cell: any }>): string[] {
  return rows.flatMap(({ cell }) => [
    cell?.brief?.headline,
    cell?.brief?.hook,
  ].filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => String(entry)));
}

function standardAuxTexts(rows: Array<{ key: string; cell: any }>): string[] {
  return rows.flatMap(({ cell }) => [
    ...(cell?.standard?.livingTips ?? []),
    ...(cell?.standard?.cautions ?? []),
  ].filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => String(entry)));
}

function expertTexts(
  rows: Array<{ key: string; cell: any }>,
  keyFilter: (key: string) => boolean = () => true,
): string[] {
  return rows.flatMap(({ key, cell }) => {
    if (!keyFilter(key)) return [];
    return (cell?.expert?.paragraphs ?? []).map((paragraph: any) => String(paragraph?.plainText ?? ''));
  });
}

function renderTokensForUi(paragraph: any): string {
  const tokens = Array.isArray(paragraph?.tokens) ? paragraph.tokens : [];
  if (!tokens.length) return String(paragraph?.plainText ?? '').trim();
  return tokens.map((token: any) => {
    if (token?.kind === 'tag') return `#${token.label ?? token.tagId ?? ''}`;
    return String(token?.value ?? '');
  }).join('').trim();
}

function expertUiTokenTexts(
  rows: Array<{ key: string; cell: any }>,
  keyFilter: (key: string) => boolean = () => true,
): string[] {
  return rows.flatMap(({ key, cell }) => {
    if (!keyFilter(key)) return [];
    return (cell?.expert?.paragraphs ?? []).map(renderTokensForUi);
  });
}

function careerLifeWorkIssues(rows: Array<{ key: string; cell: any }>): string[] {
  return rows.flatMap(({ key, cell }) => {
    if (!key.startsWith('life.') || !key.endsWith('.career')) return [];
    const text = standardTexts([{ key, cell }]).join('\n');
    const generic = CAREER_LIFE_GENERIC_WORK_RE.test(text);
    const repeatedRoleTerms = countMatches(text, CAREER_LIFE_OVERUSED_ROLE_RE);
    return generic || repeatedRoleTerms > MAX_CAREER_LIFE_ROLE_TERMS_PER_CELL
      ? [`${key}:role=${repeatedRoleTerms}${generic ? ',generic' : ''}:${text.slice(0, 220)}`]
      : [];
  });
}

function careerYearWorkIssues(rows: Array<{ key: string; cell: any }>): string[] {
  return rows.flatMap(({ key, cell }) => {
    if (key !== 'thisYear.career') return [];
    const text = standardTexts([{ key, cell }]).join('\n');
    if (/진로 감각|아이가|아이에게|어른의 직업|관심 분야|흉내 놀이|그림책/.test(text)) return [];
    const generic = CAREER_YEAR_SHORT_WORK_RE.test(text);
    const repeatedRoleTerms = countMatches(text, CAREER_YEAR_ROLE_TERM_RE);
    return generic || repeatedRoleTerms > MAX_CAREER_YEAR_ROLE_TERMS_PER_CELL
      ? [`${key}:role=${repeatedRoleTerms}${generic ? ',generic' : ''}:${text.slice(0, 220)}`]
      : [];
  });
}

function careerShortPeriodWorkIssues(rows: Array<{ key: string; cell: any }>): string[] {
  return rows.flatMap(({ key, cell }) => {
    if (key !== 'thisWeek.career' && key !== 'thisMonth.career') return [];
    const text = standardTexts([{ key, cell }]).join('\n');
    return CAREER_SHORT_PERIOD_GENERIC_WORK_RE.test(text)
      ? [`${key}:generic:${text.slice(0, 220)}`]
      : [];
  });
}

function compactPublicText(text: string): string {
  return text
    .replace(/가족나/g, '가족이나')
    .replace(/[^0-9A-Za-z가-힣]+/g, '');
}

function paragraphIsCoveredByEarlier(candidate: string, earlier: string): boolean {
  const compactCandidate = compactPublicText(candidate);
  if (compactCandidate.length < 42) return false;
  return compactPublicText(earlier).includes(compactCandidate);
}

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) { if (repo) (repo as any).wasmUrl = WASM_PATH; }
await engine.init();

console.log('Tiered standard readable depth contract\n');

const requests = [
  {
    label: 'adult choi',
    request: {
      targetDate: '2026-05-01T00:00:00+09:00',
      birth: { year: 1986, month: 4, day: 19, hour: 5, minute: 45, gender: 'male' as const },
      surname: [{ hangul: '최', hanja: '崔' }],
      givenName: [{ hangul: '성', hanja: '成' }, { hangul: '수', hanja: '秀' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
  },
  {
    label: 'minor kim',
    request: {
      targetDate: '2026-05-01T00:00:00+09:00',
      birth: { year: 2013, month: 7, day: 21, hour: 14, minute: 20, gender: 'female' as const },
      surname: [{ hangul: '김', hanja: '金' }],
      givenName: [{ hangul: '서', hanja: '瑞' }, { hangul: '윤', hanja: '潤' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
  },
  {
    label: 'child oh',
    request: {
      targetDate: '2026-05-01T00:00:00+09:00',
      birth: { year: 2019, month: 5, day: 13, hour: 16, minute: 45, gender: 'female' as const },
      surname: [{ hangul: '오', hanja: '吳' }],
      givenName: [{ hangul: '하', hanja: '河' }, { hangul: '린', hanja: '璘' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
  },
];

const studyDocumentFocusedRequests = [
  {
    label: 'adult cho study-document focus',
    request: {
      targetDate: '2026-05-01T00:00:00+09:00',
      birth: { year: 1984, month: 11, day: 3, hour: 22, minute: 40, gender: 'male' as const },
      surname: [{ hangul: '조', hanja: '趙' }],
      givenName: [{ hangul: '민', hanja: '旻' }, { hangul: '재', hanja: '材' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
  },
];
const STUDY_DOCUMENT_FOCUSED_PERIODS = ['thisMonth', 'thisYear'] as const;

const adultLifeQualityFocusedRequests = [
  {
    label: 'adult cho life-quality focus',
    request: {
      targetDate: '2026-05-01T00:00:00+09:00',
      birth: { year: 1984, month: 11, day: 3, hour: 22, minute: 40, gender: 'male' as const },
      surname: [{ hangul: '조', hanja: '趙' }],
      givenName: [{ hangul: '민', hanja: '旻' }, { hangul: '재', hanja: '材' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
  },
  {
    label: 'adult kim life-quality focus',
    request: {
      targetDate: '2026-05-01T00:00:00+09:00',
      birth: { year: 1971, month: 2, day: 18, hour: 6, minute: 20, gender: 'male' as const },
      surname: [{ hangul: '김', hanja: '金' }],
      givenName: [{ hangul: '민', hanja: '旻' }, { hangul: '준', hanja: '俊' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
  },
  {
    label: 'adult park life-quality focus',
    request: {
      targetDate: '2026-05-01T00:00:00+09:00',
      birth: { year: 1962, month: 12, day: 27, hour: 21, minute: 5, gender: 'female' as const },
      surname: [{ hangul: '박', hanja: '朴' }],
      givenName: [{ hangul: '지', hanja: '智' }, { hangul: '우', hanja: '祐' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
  },
  {
    label: 'senior jung life-quality focus',
    request: {
      targetDate: '2026-05-01T00:00:00+09:00',
      birth: { year: 1954, month: 4, day: 4, hour: 9, minute: 50, gender: 'male' as const },
      surname: [{ hangul: '정', hanja: '鄭' }],
      givenName: [{ hangul: '도', hanja: '度' }, { hangul: '현', hanja: '賢' }],
      options: { precisionConfig: { surfaceTieredMatrix: true } },
    },
  },
];

const ADULT_LIFE_QUALITY_KEYS = [
  'life.10-19.overall',
  'life.10-19.career',
  'life.20-29.movement',
  'life.40-49.career',
  'life.60-69.movement',
  'life.90-99.academic',
  'life.100-109.academic',
  'life.100-109.career',
  'today.career',
  'thisMonth.career',
  'thisYear.career',
  'thisYear.family',
  'thisYear.study_document',
  'thisYear.expression_children',
  'thisYear.movement',
] as const;

for (const { label, request } of requests) {
  const report: any = await engine.getFortuneReport(request);
  const tm = report?.tieredMatrix;
  const rows = cellRows(tm);
  const missingRows = rows.filter(({ cell }) => cell == null).map((row) => row.key);
  check(`${label}: tiered matrix cells are present`, tm?.schemaVersion === 'spring-ts.tiered-matrix.v1' && missingRows.length === 0, missingRows.slice(0, 5).join(','));

  const paragraphViolations = rows
    .filter(({ cell }) => (cell?.standard?.paragraphs?.length ?? 0) < MIN_STANDARD_PARAGRAPHS)
    .map((row) => `${row.key}:${row.cell?.standard?.paragraphs?.length ?? 0}`);
  check(`${label}: standard tier has at least ${MIN_STANDARD_PARAGRAPHS} paragraphs per cell`,
    paragraphViolations.length === 0,
    paragraphViolations.slice(0, 5).join(','));

  const shortParagraphs = rows.flatMap(({ key, cell }) =>
    (cell?.standard?.paragraphs ?? []).map((paragraph: any, idx: number) => ({
      key: `${key}#${idx + 1}`,
      text: String(paragraph?.plainText ?? ''),
      sentences: sentenceCount(String(paragraph?.plainText ?? '')),
    }))).filter((row) => row.sentences < MIN_SENTENCES_PER_PARAGRAPH);
  check(`${label}: standard paragraphs carry multiple sentences`,
    shortParagraphs.length === 0,
    shortParagraphs.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

  const tagLeaks = rows.filter(({ cell }) =>
    paragraphTokens(cell?.standard?.paragraphs ?? []).some((token) => token?.kind === 'tag') ||
      standardTexts([{ key: '', cell }]).some((text) => text.includes('#')));
  check(`${label}: standard tier remains tag-free`,
    tagLeaks.length === 0,
    tagLeaks.slice(0, 5).map((row) => row.key).join(','));

  const bridgeMissing = rows
    .filter(({ cell }) => !standardTexts([{ key: '', cell }]).some((text) => READER_BRIDGE_RE.test(text)))
    .map((row) => row.key);
  check(`${label}: standard tier includes easy reader bridge text`,
    bridgeMissing.length === 0,
    bridgeMissing.slice(0, 5).join(','));

  const scorePacingMissing = rows
    .filter(({ cell }) => !standardTexts([{ key: '', cell }]).some(hasScoreAwareText))
    .map((row) => row.key);
  check(`${label}: standard tier includes score-aware pacing guidance`,
    scorePacingMissing.length === 0,
    scorePacingMissing.slice(0, 5).join(','));

  const repetitiveScoreBridgeHits = standardTexts(rows).filter((text) => REPETITIVE_SCORE_BRIDGE_RE.test(text));
  check(`${label}: standard tier avoids repetitive generic score bridge wording`,
    repetitiveScoreBridgeHits.length <= 2,
    repetitiveScoreBridgeHits.slice(0, 3).join(' | '));

  const periodScopeMissing = rows
    .filter(({ cell }) => !standardTexts([{ key: '', cell }]).some((text) => PERIOD_SCOPE_RE.test(text)))
    .map((row) => row.key);
  check(`${label}: standard tier includes period-specific action scope`,
    periodScopeMissing.length === 0,
    periodScopeMissing.slice(0, 5).join(','));

  const selfCheckMissing = rows
    .filter(({ cell }) => !standardTexts([{ key: '', cell }]).some((text) => SELF_CHECK_RE.test(text)))
    .map((row) => row.key);
  check(`${label}: standard tier includes a simple self-check prompt`,
    selfCheckMissing.length === 0,
    selfCheckMissing.slice(0, 5).join(','));

  const duplicatedGuidance = rows.flatMap(({ key, cell }) => {
    const texts = standardTexts([{ key, cell }]);
    const scoreCount = texts.filter((text) => SCORE_PACING_RE.test(text)).length;
    const periodCount = texts.filter((text) => PERIOD_SCOPE_RE.test(text)).length;
    const selfCheckCount = texts.filter((text) => SELF_CHECK_RE.test(text)).length;
    const closingCount = texts.filter((text) => CLOSING_GUIDANCE_RE.test(text)).length;
    return [
      ...(scoreCount > 1 ? [`${key}:score=${scoreCount}`] : []),
      ...(periodCount > 1 ? [`${key}:period=${periodCount}`] : []),
      ...(selfCheckCount > 1 ? [`${key}:self=${selfCheckCount}`] : []),
      ...(closingCount > 1 ? [`${key}:closing=${closingCount}`] : []),
    ];
  });
  check(`${label}: standard tier avoids duplicated generic guidance`,
    duplicatedGuidance.length === 0,
    duplicatedGuidance.slice(0, 5).join(','));

  const duplicatedParagraphContent = rows.flatMap(({ key, cell }) => {
    const paragraphs = standardTexts([{ key, cell }]);
    const duplicates: string[] = [];
    for (let i = 0; i < paragraphs.length; i += 1) {
      if (paragraphs.slice(0, i).some((earlier) => paragraphIsCoveredByEarlier(paragraphs[i], earlier))) {
        duplicates.push(`${key}#${i + 1}:${paragraphs[i]}`);
      }
    }
    return duplicates;
  });
  check(`${label}: standard tier avoids repeated paragraph content within a cell`,
    duplicatedParagraphContent.length === 0,
    duplicatedParagraphContent.slice(0, 3).join(' | '));


  const overallLifeCurrentActionLeak = rows.flatMap(({ key, cell }) => {
    if (!key.startsWith('life.') || !key.endsWith('.overall')) return [];
    return (cell?.standard?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({ key: key + '#' + (idx + 1), text: String(paragraph?.plainText ?? '') }))
      .filter((row) => OVERALL_LIFE_CURRENT_ACTION_RE.test(row.text));
  });
  check(label + ': overall life copy avoids current-action framing',
    overallLifeCurrentActionLeak.length === 0,
    overallLifeCurrentActionLeak.slice(0, 3).map((row) => row.key + ':' + row.text).join(' | '));

  const lifeShortHorizonLeak = rows.flatMap(({ key, cell }) => {
    if (!key.startsWith('life.')) return [];
    return (cell?.standard?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
      .filter((row) => LIFE_SHORT_HORIZON_RE.test(row.text));
  });
  check(`${label}: life standard text avoids short-horizon action framing`,
    lifeShortHorizonLeak.length === 0,
    lifeShortHorizonLeak.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

  const careerLifeWorkDrift = careerLifeWorkIssues(rows);
  check(`${label}: career life copy avoids generic role repetition`,
    careerLifeWorkDrift.length === 0,
    careerLifeWorkDrift.slice(0, 3).join(' | '));
  const careerYearWorkDrift = careerYearWorkIssues(rows);
  check(`${label}: career thisYear copy stays annual and result-focused`,
    careerYearWorkDrift.length === 0,
    careerYearWorkDrift.slice(0, 3).join(' | '));
  const careerShortPeriodWorkDrift = careerShortPeriodWorkIssues(rows);
  check(`${label}: career thisWeek/thisMonth copy avoids generic job labels`,
    careerShortPeriodWorkDrift.length === 0,
    careerShortPeriodWorkDrift.slice(0, 3).join(' | '));
  const thisYearShortHorizonLeak = rows.flatMap(({ key, cell }) => {
    if (!key.startsWith('thisYear.')) return [];
    return [...standardTexts([{ key, cell }]), ...standardAuxTexts([{ key, cell }])]
      .filter((text) => THIS_YEAR_SHORT_HORIZON_PUBLIC_RE.test(text))
      .map((text) => `${key}:${text}`);
  });
  check(`${label}: thisYear standard copy avoids day-only framing`,
    thisYearShortHorizonLeak.length === 0,
    thisYearShortHorizonLeak.slice(0, 3).join(' | '));

  const badParticleLeak = standardTexts(rows).filter((text) => BAD_PUBLIC_PARTICLE_RE.test(text));
  check(`${label}: standard tier avoids awkward category particles`,
    badParticleLeak.length === 0,
    badParticleLeak.slice(0, 3).join(' | '));

  const badBriefEndingLeak = briefTexts(rows).filter((text) => BAD_BRIEF_ENDING_RE.test(text));
  check(`${label}: brief tier avoids broken Korean endings`,
    badBriefEndingLeak.length === 0,
    badBriefEndingLeak.slice(0, 3).join(' | '));

  const badBriefAwkwardLeak = briefTexts(rows).filter((text) => BAD_BRIEF_AWKWARD_RE.test(text));
  check(`${label}: brief tier avoids awkward career shorthand`,
    badBriefAwkwardLeak.length === 0,
    badBriefAwkwardLeak.slice(0, 3).join(' | '));

  const standardLightweightLeak = standardTexts(rows).filter((text) => STANDARD_LIGHTWEIGHT_PUBLIC_RE.test(text));
  check(`${label}: standard tier avoids leftover lightweight phrasing`,
    standardLightweightLeak.length === 0,
    standardLightweightLeak.slice(0, 3).join(' | '));

  const standardAuxAwkwardLeak = standardAuxTexts(rows).filter((text) => STANDARD_AUX_AWKWARD_RE.test(text));
  check(`${label}: standard tips avoid awkward replacement phrasing`,
    standardAuxAwkwardLeak.length === 0,
    standardAuxAwkwardLeak.slice(0, 3).join(' | '));
  if (!label.includes('minor') && !label.includes('child')) {
    const adultExpressionChildLeak = rows.flatMap(({ key, cell }) => {
      if (!key.endsWith('.expression_children')) return [];
      return [...standardTexts([{ key, cell }]), ...standardAuxTexts([{ key, cell }])]
        .filter((text) => ADULT_EXPRESSION_NARROW_CHILD_RE.test(text))
        .map((text) => `${key}:${text}`);
    });
    check(`${label}: adult expression text avoids child-only framing`,
      adultExpressionChildLeak.length === 0,
      adultExpressionChildLeak.slice(0, 3).join(' | '));
  }

  const expertMovementShortcutLeak = expertTexts(rows, (key) => key.endsWith('.movement')).filter((text) => EXPERT_MOVEMENT_SHORTCUT_RE.test(text));
  check(`${label}: expert tier avoids vague movement shorthand`,
    expertMovementShortcutLeak.length === 0,
    expertMovementShortcutLeak.slice(0, 3).join(' | '));

  const expertFamilyAwkwardLeak = expertTexts(rows, (key) => key.endsWith('.family')).filter((text) => EXPERT_FAMILY_AWKWARD_RE.test(text));
  check(`${label}: family expert avoids awkward receive/share phrasing`,
    expertFamilyAwkwardLeak.length === 0,
    expertFamilyAwkwardLeak.slice(0, 3).join(' | '));

  const expertAwkwardPublicLeak = expertTexts(rows).filter((text) => EXPERT_AWKWARD_PUBLIC_RE.test(text));
  check(`${label}: expert tier avoids awkward public phrasing`,
    expertAwkwardPublicLeak.length === 0,
    expertAwkwardPublicLeak.slice(0, 3).join(' | '));

  const expertTagSuffixJoinLeak = expertUiTokenTexts(rows).filter((text) => EXPERT_TAG_SUFFIX_JOIN_RE.test(text));
  check(`${label}: expert tier token rendering keeps tag suffix spacing`,
    expertTagSuffixJoinLeak.length === 0,
    expertTagSuffixJoinLeak.slice(0, 3).join(' | '));
  const expertTagParticleSpaceLeak = expertUiTokenTexts(rows).filter((text) => EXPERT_TAG_PARTICLE_SPACE_RE.test(text));
  check(`${label}: expert tier token rendering avoids tag-particle spacing`,
    expertTagParticleSpaceLeak.length === 0,
    expertTagParticleSpaceLeak.slice(0, 3).join(' | '));
  const studyDocumentRoleDrift = rows.flatMap(({ key, cell }) => {
    if (!key.endsWith('.study_document')) return [];
    return (cell?.standard?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
      .filter((row) => STUDY_DOCUMENT_ROLE_DRIFT_RE.test(row.text) || STUDY_DOCUMENT_STUDY_LEAK_RE.test(row.text));
  });
  check(`${label}: study-document standard text stays record-focused`,
    studyDocumentRoleDrift.length === 0,
    studyDocumentRoleDrift.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

    const studyDocumentFirstParagraphRepetition = rows.flatMap(({ key, cell }) => {
    if (!key.endsWith('.study_document')) return [];
    const text = String(cell?.standard?.paragraphs?.[0]?.plainText ?? '');
    return STUDY_DOCUMENT_FIRST_PARAGRAPH_REPEAT_RE.test(text) ? [`${key}#1:${text}`] : [];
  });
  check(`${label}: study-document first paragraph avoids role repetition`,
    studyDocumentFirstParagraphRepetition.length === 0,
    studyDocumentFirstParagraphRepetition.slice(0, 3).join(' | '));
const studyDocumentExpertPairingDrift = rows.flatMap(({ key, cell }) => {
    if (!key.endsWith('.study_document')) return [];
    return (cell?.expert?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
      .filter((row) => STUDY_DOCUMENT_EXPERT_PAIRING_DRIFT_RE.test(row.text));
  });
  check(`${label}: study-document expert text pairs with record-focused standard`,
    studyDocumentExpertPairingDrift.length === 0,
    studyDocumentExpertPairingDrift.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

  const academicGenericDrift = rows.flatMap(({ key, cell }) => {
    if (!key.endsWith('.academic')) return [];
    return (cell?.standard?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
      .filter((row) => ACADEMIC_GENERIC_DRIFT_RE.test(row.text));
  });
  check(`${label}: academic standard text avoids generic learning filler`,
    academicGenericDrift.length === 0,
    academicGenericDrift.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

  const packedAcademicParagraphs = rows.flatMap(({ key, cell }) => {
    if (!key.endsWith('.academic')) return [];
    return (cell?.standard?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({
        key: `${key}#${idx + 1}`,
        text: String(paragraph?.plainText ?? ''),
        sentences: sentenceCount(String(paragraph?.plainText ?? '')),
      }))
      .filter((row) => row.text.length > MAX_ACADEMIC_STANDARD_PARAGRAPH_CHARS || row.sentences > MAX_ACADEMIC_STANDARD_SENTENCES);
  });
  check(`${label}: academic standard text avoids overpacked paragraphs`,
    packedAcademicParagraphs.length === 0,
    packedAcademicParagraphs.slice(0, 3).map((row) => `${row.key}:len=${row.text.length},sentences=${row.sentences}:${row.text}`).join(' | '));

  const metaPatchLeak = standardTexts(rows).filter((text) => META_PATCH_RE.test(text));
  check(`${label}: standard tier avoids visible patch wording`,
    metaPatchLeak.length === 0,
    metaPatchLeak.slice(0, 3).join(' | '));

  const expertTermLeak = standardTexts(rows).filter((text) => EXPERT_TERMS_RE.test(text));
  check(`${label}: standard tier avoids raw expert terminology`,
    expertTermLeak.length === 0,
    expertTermLeak.slice(0, 3).join(' | '));

  if (label.includes('minor') || label.includes('child')) {
    const minorAdultLeak = rows.flatMap(({ key, cell }) =>
      (cell?.standard?.paragraphs ?? [])
        .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
        .filter((row) => MINOR_ADULT_RE.test(row.text)));
    check(`${label}: minor standard text avoids adult life-event wording`,
      minorAdultLeak.length === 0,
      minorAdultLeak.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

    const minorFutureLifeCurrentLeaks = rows.flatMap(({ key, cell }) => {
      if (!MINOR_FUTURE_ADULT_LIFE_RE.test(key)) return [];
      return (cell?.standard?.paragraphs ?? [])
        .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
        .filter((row) => MINOR_FUTURE_LIFE_CURRENT_LABEL_RE.test(row.text));
    });
    check(`${label}: adult life-stage cells avoid current-child framing`,
      minorFutureLifeCurrentLeaks.length === 0,
      minorFutureLifeCurrentLeaks.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

    const minorFutureWealthFramingIssues = rows.flatMap(({ key, cell }) => {
      if (!MINOR_FUTURE_ADULT_LIFE_RE.test(key) || !key.endsWith('.wealth')) return [];
      const text = standardTexts([{ key, cell }]).join('\\n');
      const futureCount = countMatches(text, /먼 훗날/g);
      const oldLabelCount = countMatches(text, /돈과 물건 관리/g);
      const oldFraming = MINOR_FUTURE_WEALTH_OLD_FRAMING_RE.test(text);
      return futureCount > 3 || oldLabelCount > 0 || oldFraming
        ? [`${key}:future=${futureCount},label=${oldLabelCount}${oldFraming ? ',old-framing' : ''}`]
        : [];
    });
    check(`${label}: future wealth copy avoids repetitive child-reader framing`,
      minorFutureWealthFramingIssues.length === 0,
      minorFutureWealthFramingIssues.slice(0, 3).join(' | '));

    const minorFutureHorizonRepetition = rows.flatMap(({ key, cell }) => {
      if (!MINOR_FUTURE_ADULT_LIFE_RE.test(key)) return [];
      const text = standardTexts([{ key, cell }]).join('\n');
      const count = countMatches(text, FUTURE_HORIZON_TERM_RE);
      return count > MAX_MINOR_FUTURE_HORIZON_TERMS_PER_STANDARD_CELL
        ? [`${key}:horizon=${count}`]
        : [];
    });
    check(`${label}: future life copy avoids repetitive horizon wording`,
      minorFutureHorizonRepetition.length === 0,
      minorFutureHorizonRepetition.slice(0, 5).join(' | '));

    const minorCurrentStudyDocumentAdultDocLeaks = rows.flatMap(({ key, cell }) => {
      if (!key.endsWith('.study_document')) return [];
      if (MINOR_FUTURE_ADULT_LIFE_RE.test(key)) return [];
      return (cell?.standard?.paragraphs ?? [])
        .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
        .filter((row) => MINOR_CURRENT_STUDY_DOCUMENT_ADULT_DOC_RE.test(row.text));
    });
    check(`${label}: current study-document cells avoid adult document framing`,
      minorCurrentStudyDocumentAdultDocLeaks.length === 0,
      minorCurrentStudyDocumentAdultDocLeaks.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

  }
}

for (const { label, request } of studyDocumentFocusedRequests) {
  const report: any = await engine.getFortuneReport(request);
  const tm = report?.tieredMatrix;
  const rows = STUDY_DOCUMENT_FOCUSED_PERIODS.map((period) => ({
    key: `${period}.study_document`,
    cell: tm?.periods?.[period]?.byCategory?.study_document,
  }));
  const missingRows = rows.filter(({ cell }) => cell == null).map((row) => row.key);
  check(`${label}: focused study-document cells are present`,
    tm?.schemaVersion === 'spring-ts.tiered-matrix.v1' && missingRows.length === 0,
    missingRows.join(','));

  const paragraphViolations = rows
    .filter(({ cell }) => (cell?.standard?.paragraphs?.length ?? 0) < MIN_STANDARD_PARAGRAPHS)
    .map((row) => `${row.key}:${row.cell?.standard?.paragraphs?.length ?? 0}`);
  check(`${label}: focused study-document cells keep paragraph depth`,
    paragraphViolations.length === 0,
    paragraphViolations.join(','));

  const firstParagraphRepetition = rows.flatMap(({ key, cell }) => {
    const text = String(cell?.standard?.paragraphs?.[0]?.plainText ?? '');
    return STUDY_DOCUMENT_FIRST_PARAGRAPH_REPEAT_RE.test(text) ? [`${key}#1:${text}`] : [];
  });
  check(`${label}: focused study-document first paragraph avoids role repetition`,
    firstParagraphRepetition.length === 0,
    firstParagraphRepetition.join(' | '));

  const roleDrift = rows.flatMap(({ key, cell }) =>
    (cell?.standard?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
      .filter((row) => STUDY_DOCUMENT_ROLE_DRIFT_RE.test(row.text) || STUDY_DOCUMENT_STUDY_LEAK_RE.test(row.text)));
  check(`${label}: focused study-document standard text stays record-focused`,
    roleDrift.length === 0,
    roleDrift.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));
}
for (const { label, request } of adultLifeQualityFocusedRequests) {
  const report: any = await engine.getFortuneReport(request);
  const tm = report?.tieredMatrix;
  const rows = ADULT_LIFE_QUALITY_KEYS.map((key) => ({
    key,
    cell: cellForMatrixKey(tm, key),
  }));
  const missingRows = rows.filter(({ cell }) => cell == null).map((row) => row.key);
  check(`${label}: focused quality cells are present`,
    tm?.schemaVersion === 'spring-ts.tiered-matrix.v1' && missingRows.length === 0,
    missingRows.join(','));

  const paragraphViolations = rows
    .filter(({ cell }) => (cell?.standard?.paragraphs?.length ?? 0) < MIN_STANDARD_PARAGRAPHS)
    .map((row) => `${row.key}:${row.cell?.standard?.paragraphs?.length ?? 0}`);
  check(`${label}: focused quality cells keep paragraph depth`,
    paragraphViolations.length === 0,
    paragraphViolations.join(','));

  const scorePacingMissing = rows
    .filter(({ cell }) => !standardTexts([{ key: '', cell }]).some(hasScoreAwareText))
    .map((row) => row.key);
  check(`${label}: focused quality cells include score-aware pacing`,
    scorePacingMissing.length === 0,
    scorePacingMissing.join(','));

  const expertPairingMissing = rows
    .filter(({ cell }) => (cell?.expert?.paragraphs?.length ?? 0) < 2)
    .map((row) => `${row.key}:${row.cell?.expert?.paragraphs?.length ?? 0}`);
  check(`${label}: focused quality cells keep expert pairing context`,
    expertPairingMissing.length === 0,
    expertPairingMissing.join(','));

  const crowdedCareerFirstParagraphs = rows.flatMap(({ key, cell }) => {
    if (!key.endsWith('.career')) return [];
    const text = String(cell?.standard?.paragraphs?.[0]?.plainText ?? '');
    const sentences = sentenceCount(text);
    return text.length > MAX_FOCUSED_CAREER_FIRST_PARAGRAPH_CHARS || sentences > MAX_FOCUSED_CAREER_FIRST_PARAGRAPH_SENTENCES
      ? [`${key}#1:len=${text.length},sentences=${sentences}:${text}`]
      : [];
  });
  check(`${label}: focused career first paragraph stays mobile-readable`,
    crowdedCareerFirstParagraphs.length === 0,
    crowdedCareerFirstParagraphs.slice(0, 3).join(' | '));

  const movementGenericOverload = rows.flatMap(({ key, cell }) => {
    if (!key.startsWith('life.') || !key.endsWith('.movement')) return [];
    const text = standardTexts([{ key, cell }]).join('\n');
    const matches = text.match(MOVEMENT_GENERIC_OVERLOAD_RE) ?? [];
    return matches.length > 2 ? [`${key}:generic=${matches.length}:${matches.slice(0, 4).join(',')}`] : [];
  });
  check(`${label}: focused movement life copy avoids generic repetition`,
    movementGenericOverload.length === 0,
    movementGenericOverload.slice(0, 3).join(' | '));

  const crowdedMovementParagraphs = rows.flatMap(({ key, cell }) => {
    if (!key.startsWith('life.') || !key.endsWith('.movement')) return [];
    return (cell?.standard?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
      .filter((row) => row.text.length > MAX_FOCUSED_MOVEMENT_PARAGRAPH_CHARS || sentenceCount(row.text) > MAX_FOCUSED_MOVEMENT_PARAGRAPH_SENTENCES)
      .map((row) => `${row.key}:len=${row.text.length},sentences=${sentenceCount(row.text)}:${row.text}`);
  });
  check(`${label}: focused movement life paragraphs stay readable`,
    crowdedMovementParagraphs.length === 0,
    crowdedMovementParagraphs.slice(0, 3).join(' | '));

  const academicLightweightActionLeak = rows.flatMap(({ key, cell }) => {
    if (!key.startsWith('life.') || !key.endsWith('.academic')) return [];
    return (cell?.standard?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
      .filter((row) => ACADEMIC_LIGHTWEIGHT_ACTION_RE.test(row.text));
  });
  check(`${label}: focused academic life copy avoids lightweight study phrasing`,
    academicLightweightActionLeak.length === 0,
    academicLightweightActionLeak.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

  const lifeShortHorizonLeak = rows.flatMap(({ key, cell }) => {
    if (!key.startsWith('life.')) return [];
    return (cell?.standard?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
      .filter((row) => LIFE_SHORT_HORIZON_RE.test(row.text));
  });
  check(`${label}: focused life cells avoid short-horizon action framing`,
    lifeShortHorizonLeak.length === 0,
    lifeShortHorizonLeak.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

  const careerLifeWorkDrift = careerLifeWorkIssues(rows);
  check(`${label}: focused career life copy avoids generic role repetition`,
    careerLifeWorkDrift.length === 0,
    careerLifeWorkDrift.slice(0, 3).join(' | '));
  const careerYearWorkDrift = careerYearWorkIssues(rows);
  check(`${label}: focused career thisYear copy stays annual and result-focused`,
    careerYearWorkDrift.length === 0,
    careerYearWorkDrift.slice(0, 3).join(' | '));
  const focusedCareerShortPeriodWorkDrift = careerShortPeriodWorkIssues(rows);
  check(`${label}: focused career thisWeek/thisMonth copy avoids generic job labels`,
    focusedCareerShortPeriodWorkDrift.length === 0,
    focusedCareerShortPeriodWorkDrift.slice(0, 3).join(' | '));
  const focusedThisYearShortHorizonLeak = rows.flatMap(({ key, cell }) => {
    if (!key.startsWith('thisYear.')) return [];
    return [...standardTexts([{ key, cell }]), ...standardAuxTexts([{ key, cell }])]
      .filter((text) => THIS_YEAR_SHORT_HORIZON_PUBLIC_RE.test(text))
      .map((text) => `${key}:${text}`);
  });
  check(`${label}: focused thisYear cells avoid day-only framing`,
    focusedThisYearShortHorizonLeak.length === 0,
    focusedThisYearShortHorizonLeak.slice(0, 3).join(' | '));

  const badParticleLeak = standardTexts(rows).filter((text) => BAD_PUBLIC_PARTICLE_RE.test(text));
  check(`${label}: focused quality cells avoid awkward category particles`,
    badParticleLeak.length === 0,
    badParticleLeak.slice(0, 3).join(' | '));

  const badBriefEndingLeak = briefTexts(rows).filter((text) => BAD_BRIEF_ENDING_RE.test(text));
  check(`${label}: focused brief cells avoid broken Korean endings`,
    badBriefEndingLeak.length === 0,
    badBriefEndingLeak.slice(0, 3).join(' | '));

  const badBriefAwkwardLeak = briefTexts(rows).filter((text) => BAD_BRIEF_AWKWARD_RE.test(text));
  check(`${label}: focused brief cells avoid awkward career shorthand`,
    badBriefAwkwardLeak.length === 0,
    badBriefAwkwardLeak.slice(0, 3).join(' | '));

  const standardLightweightLeak = standardTexts(rows).filter((text) => STANDARD_LIGHTWEIGHT_PUBLIC_RE.test(text));
  check(`${label}: focused standard cells avoid leftover lightweight phrasing`,
    standardLightweightLeak.length === 0,
    standardLightweightLeak.slice(0, 3).join(' | '));

  const standardAuxAwkwardLeak = standardAuxTexts(rows).filter((text) => STANDARD_AUX_AWKWARD_RE.test(text));
  check(`${label}: focused standard tips avoid awkward replacement phrasing`,
    standardAuxAwkwardLeak.length === 0,
    standardAuxAwkwardLeak.slice(0, 3).join(' | '));
  const focusedStudyDocumentRoleDrift = rows.flatMap(({ key, cell }) => {
    if (!key.endsWith('.study_document')) return [];
    return (cell?.standard?.paragraphs ?? [])
      .map((paragraph: any, idx: number) => ({ key: `${key}#${idx + 1}`, text: String(paragraph?.plainText ?? '') }))
      .filter((row) => STUDY_DOCUMENT_ROLE_DRIFT_RE.test(row.text) || STUDY_DOCUMENT_STUDY_LEAK_RE.test(row.text));
  });
  check(`${label}: focused study-document cells stay record-focused`,
    focusedStudyDocumentRoleDrift.length === 0,
    focusedStudyDocumentRoleDrift.slice(0, 3).map((row) => `${row.key}:${row.text}`).join(' | '));

  const focusedAdultExpressionChildLeak = rows.flatMap(({ key, cell }) => {
    if (!key.endsWith('.expression_children')) return [];
    return [...standardTexts([{ key, cell }]), ...standardAuxTexts([{ key, cell }])]
      .filter((text) => ADULT_EXPRESSION_NARROW_CHILD_RE.test(text))
      .map((text) => `${key}:${text}`);
  });
  check(`${label}: focused adult expression cells avoid child-only framing`,
    focusedAdultExpressionChildLeak.length === 0,
    focusedAdultExpressionChildLeak.slice(0, 3).join(' | '));

  const expertMovementShortcutLeak = expertTexts(rows, (key) => key.endsWith('.movement')).filter((text) => EXPERT_MOVEMENT_SHORTCUT_RE.test(text));
  check(`${label}: focused expert cells avoid vague movement shorthand`,
    expertMovementShortcutLeak.length === 0,
    expertMovementShortcutLeak.slice(0, 3).join(' | '));

  const expertFamilyAwkwardLeak = expertTexts(rows, (key) => key.endsWith('.family')).filter((text) => EXPERT_FAMILY_AWKWARD_RE.test(text));
  check(`${label}: family expert avoids awkward receive/share phrasing`,
    expertFamilyAwkwardLeak.length === 0,
    expertFamilyAwkwardLeak.slice(0, 3).join(' | '));

  const expertAwkwardPublicLeak = expertTexts(rows).filter((text) => EXPERT_AWKWARD_PUBLIC_RE.test(text));
  check(`${label}: expert tier avoids awkward public phrasing`,
    expertAwkwardPublicLeak.length === 0,
    expertAwkwardPublicLeak.slice(0, 3).join(' | '));

  const expertTagSuffixJoinLeak = expertUiTokenTexts(rows).filter((text) => EXPERT_TAG_SUFFIX_JOIN_RE.test(text));
  check(`${label}: focused expert token rendering keeps tag suffix spacing`,
    expertTagSuffixJoinLeak.length === 0,
    expertTagSuffixJoinLeak.slice(0, 3).join(' | '));

  const expertTagParticleSpaceLeak = expertUiTokenTexts(rows).filter((text) => EXPERT_TAG_PARTICLE_SPACE_RE.test(text));
  check(`${label}: focused expert token rendering avoids tag-particle spacing`,
    expertTagParticleSpaceLeak.length === 0,
    expertTagParticleSpaceLeak.slice(0, 3).join(' | '));
}
engine.close();
console.log(`\nTiered standard readable depth: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
