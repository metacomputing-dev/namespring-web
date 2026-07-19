# 궁합 관련 변경 요약 — feature/fe-v3 브랜치 (2026-07-19 기준)

이 브랜치에서 두 사람 궁합 기능과 관련해 바뀐 것의 전모. 아래 항목 대부분은 이 시점 기준 워킹트리의 신규 파일(untracked)이며, delivery 계층 수정 2건은 기존 파일 수정이다.

## 1. 엔진: spring-ts 궁합 모듈 신설 (`lib/spring-ts/src/report/compatibility/`)

- `types.ts` — 공개 계약 `spring-ts.couple-compatibility.v1`: 사람별 ReportDeliveryV1 두 벌 입력, facts(11종 쌍 검출) / axes(13축) / sections(integrated·saju·name) / context(짝 맥락) / provenance(가중치 공개).
- `relation-tables.ts` — 간지 쌍 조회 표: 천간합 5·천간충 4·지지육합 6(오미합 합화 유보)·삼합/방합 반합(왕지 필수)·충·형(자형 별도)·해·파·원진·귀문, 십성 판정, 발음오행 초성 배속(주류: ㅇㅎ=토).
- `context.ts` — 관계·나이 맥락 파생: 프레이밍 4종(couple/companion/guardian/kids) 결정 규칙, 미성년 포함 시 couple 금지, anchorDate 기준 결정론 나이 계산, 동갑·띠동갑·네 살 차 삼합·여섯 살 차 충 속설의 실제 년지 관계 대조 읽기.
- `copy-bundles.ts` — 카피 번들 레지스트리: 상황 id 21종 × 프레이밍 4종 격자, `resolveBundle` 폴백(프레임 전용 → default), 지지 쌍 카피 합성기 `renderBranchPairCopy`, 한글 조사 도우미.
- `build-couple-compatibility.ts` — 순수 빌더: 검출·점수 담당(문장은 번들에 위임), 도메인 55/30/15 가중 합산, 가용 축 재정규화, 흉 겹침 40% 부기, couple 한정 배우자성 보너스.
- `index.ts` — 배럴 export.
- 테스트 `test/integration/couple-compatibility.test.ts` (717줄) — 관계 테이블 고전 통설 대조, 합성 fixture 빌더 통합 검증, 동일 입력 결정론 검증.

## 2. FE: v3 궁합 화면·모델 신설 (`namespring/src/v3/`)

- `engine/compatibility.ts` — 글루: 사람별 delivery 캐시 재사용 + 궁합 Promise 캐시(관계 선택 포함 키, 실패 시 키 축출), `COMPAT_SURFACES`(integrated+saju+naming), `isSamePerson`.
- `model/compat.ts` — 슬롯 2개(sessionStorage `namespring_v3_compat_a/b`)와 관계 선택(`namespring_v3_compat_rel`, 구버전 평문 문자열 정규화 승격).
- `model/people.ts` — 사람 보관함(localStorage `namespring_v3_people`, 최대 50, 내용 키 중복 방지, 호칭은 배지 전용).
- `model/saved-compat.ts` — 저장된 궁합(localStorage `namespring_v3_saved_compat`, A↔B 순서 무관 짝 키, 점수·등급 스냅샷, 관계 복원).
- `model/relationship-catalog.ts` — 관계 프리셋 29종(카테고리·톤·검색 키워드) + 직접 입력 카테고리 추정.
- `screens/CompatibilityScreen.tsx` — 통합 궁합: 슬롯 선택, 관계 검색 콤보박스, 두 사람 나란히 보기, 통합 요약, 상세 링크, 오행 견주기 — 통합 보고서와 같은 뼈대. (축 카드·대운 겹쳐 보기는 상세와 중복이라 상세로 일원화.)
- `screens/CompatibilityNameScreen.tsx` / `CompatibilitySajuScreen.tsx` — 이름간·사주간 상세(슬롯 이어받기, 결측 시 통합 화면으로 리다이렉트, 사주 화면은 대운 겹쳐 보기·여덟 기둥 교차 신호 브라우저 포함).
- `screens/IntegratedScreen.tsx` — 궁합 화면과의 대칭을 위해 '한눈에 보기' 카드 신설: naming 표면을 함께 요청해 엔진 metric(이름 종합/한글/한자/사격수리/발음 점수)을 궁합 요약 카드와 같은 시각 언어로 모으고, 사주는 점수 없이 결론(기운 세기·짙은/옅은 기운·용신+신뢰도)으로 읽는 2열 균형 구성. `not_a_combined_balance_score` 계약대로 이름↔사주 합산 점수는 만들지 않고 그 사실을 카드에 고지. 풍경 카드 바로 아래에는 궁합의 '두 사람의 자리'에 대응하는 '나의 자리' 카드(띠·절기 계절·일간·시각 유무의 결정론적 자리말) 추가. '이름과 사주, 나란히 보기' 섹션은 궁합과 같은 '더 자세히 읽기'로 개명하고 카드도 같은 모양새(점수/일간 머리값 + 한 줄 요약 + 하단 와이드 버튼)로 통일. 이후 '한눈에 보기'를 궁합 사람 카드 판(일간·일지·반기는 기운 행 + 카드 안 아래 풍경)으로 바꿔 맨 위로 올리고, 점수 요약은 '통합으로 읽기'로 오행 견주기 바로 위에 배치 — 두 메뉴의 섹션 열이 완전히 1:1로 마주 본다.
- `screens/compat/shared.tsx` — 세 화면 공유 조각(데이터 훅, 카드류, 프레임별 일지 호칭, 보관 별표, 유료·꼬리 대칭 구조).
- `screens/compat/PersonSceneryPair.tsx` — 사람별 풍경 그림.
- `ui/PersonForm.tsx` — 상대 직접 입력 폼(신규).
- `ui/ProfileSetupForm.tsx` — 구 '처음' 화면의 본인 입력 폼을 추출한 재사용 컴포넌트. 통합 보고서가 프로필이 없을 때(리다이렉트 대신) 인라인으로 품고, '다른 정보로 바꾸기'로 다시 열 수 있다. 처음 화면도 같은 폼을 쓴다.
- 선택 구역 접힘: 통합·궁합 모두 선택이 끝나 결과가 보이면 입력/선택 구역을 한 줄 요약(이름·관계 + 바꾸기 버튼)으로 접는다. `useDelivery`에 `redirectWhenMissing`/`reloadKey` 옵션과 'missing' 상태 추가.
- 통합 보고서의 접힌 who-row에 '보관함에서 불러오기' 버튼 추가(보관된 사람이 있을 때만): 누르면 사람 목록(본명+호칭 배지+생일)이 펼쳐지고, 고르면 그 사람을 보고서 주인공으로 삼아(saveProfile+캐시 비움+reloadKey) 재계산한다. 궁합의 슬롯 '보관함에서 고르기'와 같은 재사용 흐름.
- `app.tsx` 라우팅 추가, `v3.css` 스타일(콤보·비교 막대·신호 칩·별표 등), `IntegratedScreen`·`FavoritesScreen`·`AccountScreen` 진입 동선 연결.

## 3. delivery 계층 수정: 자형(自刑) fail-closed 버그 수정

**버그**: 원국에 자형(辰辰·午午·酉酉·亥亥)이 있는 사주는 `natal_relations` fact의 지지 배열이 같은 글자 두 개가 되는데, `build-report-delivery.ts`와 `validation.ts`의 지지 중복 검사(unique)가 이를 계약 위반으로 보고 `JIJI_RELATION_BRANCH_INVALID`를 던졌다. 계약이 fail-closed라 **해당 사주는 delivery 생성 자체가 실패**했고, 개인 보고서는 물론 그 delivery를 재사용하는 궁합도 통째로 막혔다.

**수정** (기존 파일 2건 수정):

- `src/report/delivery/build-report-delivery.ts` — `natalRelationsFact`에서 관계 타입이 `JA_HYEONG` 또는 `'자형'`이면 지지 중복 검사를 면제 (자형은 같은 지지 두 글자가 본질).
- `src/report/delivery/validation.ts` — `strictFact`의 지지 배열 검증에서 `unique: relation.type !== 'JA_HYEONG' && relation.type !== '자형'`으로 동일 면제. 어댑터 계층에 따라 타입이 원시 코드 또는 한글 라벨로 오는 두 경우를 모두 처리.
- `test/integration/report-delivery-v1.test.ts` — 회귀 커버 추가.

참고로 궁합 모듈 자체의 자형 판정(`lookupBranchPair`)은 처음부터 `a === b && BRANCH_JAHYEONG.has(a)`로 쌍 조회에 맞게 설계돼 이 버그와 무관하다 — 버그는 사람별 delivery 생성 단계에 있었다.

## 4. 방법론 판결 (이 브랜치에서 확정)

- 축 가중치: 사주 55 / 이름 30 / 교차 15, 사주 내 일지 26% > 일간 20% > 용신 15% > 오행 12% > 십성 10% > 신강약 7% > 음양·띠 5%.
- 등급 구간 80/65/50/38 (실무 관행).
- 오미합 합화 유보, 반합 왕지 규칙, 발음오행 주류 배속 채택(훈민정음 해례 배속은 소수파로 기록), 자원오행 대 자원오행 상생상극 불채택(교차 축 한정), 수리 합산 불채택(나란히 읽기), 흉 겹침 이중 감점 금지, 배우자성 보너스 couple 프레임 한정.

세부 근거와 확장 가이드는 같은 디렉터리의 `README.md`가 정본이다.
