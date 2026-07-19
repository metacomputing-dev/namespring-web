# 앱 로컬 엔진·유료 서버 계약 V1

## 가장 중요한 실행 경계

이 문서에서 `spring-ts`는 서버 API가 아니라 브라우저·모바일 앱 안에서 실행되는 계산 엔진이다. 무료 기능은 설치된 엔진 자산만으로 기기 안에서 끝나야 한다. 사용자가 유료 결과를 요청하기 전에는 생년월일, 이름, 후보, 무료 분석 결과를 원격 서버에 보내지 않는다.

| 실행 위치 | 허용 기능 | 네트워크 원칙 |
| --- | --- | --- |
| 모바일·브라우저 로컬 `SpringEngine` | 출생정보 정규화, 사주, 성명학, 작명 후보, 후보 비교, 사주×이름 통합, 무료 보고서, 한자 검색, 홈 요약 | 엔진 자산을 앱에 적재한 뒤 분석 중 API 호출 없음 |
| 유료 서버 | 상품 카탈로그, 유료 등록·재계산, 결제, 권한, 유료 본문 | 사용자가 유료 전환을 명시한 뒤에만 호출 |

신규 `getReportDelivery()` 경로는 `/generated-packed/`를 가져오지 않고 로컬 authored article만 사용한다. 캐시가 먼저 데워졌는지에 따라서도 결과가 달라지지 않는다. 향후 생성 번들을 무료 경로에 추가할 때도 앱 패키지·로컬 DB·서비스워커 자산으로 제공해야 하며 분석 시 원격 API 의존성을 만들면 안 된다. 기존 화면 호환용 `getFortuneReport()` 경로는 별도 유지되므로, 새 프론트엔드는 출시 전에 이 로컬 전용 계약으로 이행해야 한다.

## 설계 원칙

- 공개 DTO는 카드·탭 같은 UI 모양이 아니라 사실, 해석, 가용성, 의미 기반 이동 대상을 표현한다.
- URL, 컴포넌트 배치, 시각화 방식은 프론트엔드가 소유한다.
- 생성 프롬프트 태그, 번들 `caseId`, 게이트 내부 필드, 선택 seed는 공개 DTO 밖에 둔다.
- 신규 요청·응답은 `schemaVersion`, 정확한 필드 허용 목록, 크기 제한, 참조 무결성 검사를 가진다.
- 사주 원국은 출생정보로만 정해지고 이름 때문에 바뀌지 않는다.
- 이름은 성명학 사실과 `고정 사주 원국 × 해당 이름` 상호작용만 바꾼다.
- 무료 로컬 판정은 구매 권한이나 서버 사실이 아니다. 유료 서버는 입력 원본으로 독립 재계산한다.

기존 `getFortuneReport()` 응답 모양은 현재 프론트엔드 호환을 위해 유지한다. 신규 프론트엔드는 작은 버전 계약을 필요한 시점에만 호출한다.

`ReportDeliveryV1`은 현재 기존 화면이 소비하는 운영 계약이 아니라 신규 V2
프론트엔드와 함께 검토 중인 사전 출시 경계다. 이번 cutover에서
`time_correction` fact/block이 엄격한 허용 목록에 추가되므로, V2 배포 전에
기존 실험 캐시와 fixture를 폐기하고 생산자·소비자를 같은 빌드로 함께
올려야 한다. 이미 배포된 별도 소비자가 발견되면 V1 응답을 조용히 확장하지
말고 새 schemaVersion 또는 명시적 capability negotiation으로 분리한다.
기존 `getFortuneReport()` 소비자에는 이 변경이 전파되지 않는다.

## 계약 지도

| 계약 | 실행 위치와 책임 | 상태 |
| --- | --- | --- |
| `CandidateSearchResponseV1` | 로컬 후보 순서, 안정적 `candidateId`, 다음 보고서 입력 | 구현됨 |
| `ReportDeliveryV1` | 로컬 통합·사주·성명학의 사실·해석·선택 범위 | 구현됨 |
| `PremiumReportRegistrationRequestV1` | 유료 전환 시 원본 입력을 서버에 등록 | 계약·서버 구현됨, 외부 staging gate 남음 |
| `ServiceCatalogV1` | 유료 진입 시 서버 권위 상품·가격·콘텐츠 버전 | 계약·서버 구현됨, 외부 staging gate 남음 |
| `ReportEntitlementV1` | 서버가 결제·승인 뒤 발급하는 보고서별 권한 | 계약·서버 구현됨, 외부 staging gate 남음 |
| `PremiumReportDeliveryV1` | 서버가 권한 검증 뒤 반환하는 유료 본문 | 계약·서버 구현됨, 외부 staging gate 남음 |
| `LocalAnalysisContextV1` | 한 로컬 엔진 세션의 출생·정책·선택 이름 스냅샷 | 로컬 구현·검증됨 |
| `LocalHomeSummaryV1` | 계산을 지연하는 홈 상태·메뉴·최근 로컬 참조 | 로컬 구현·검증됨 |
| `LocalBirthPreviewV1` | 입력 수정 시 전체 보고서 전의 저비용 영향 확인 | 로컬 구현·검증됨 |
| `LocalHanjaLookupV1` | 패키지된 한자 DB의 검색·필터·페이지네이션 | 로컬 구현·검증됨 |
| `LocalShareExportV1` | 서버 업로드 없는 가림 처리 이미지·텍스트 공유 | 로컬 구현·검증됨 |

하나의 거대한 앱 JSON으로 합치지 않는다. 홈, 후보 목록, 기간 탭, 유료 본문은 계산 시점과 수명이 다르다. 계약을 분리하면 모바일 초기 연산량·메모리를 줄이고 한 기능 실패가 전체 화면 실패로 번지는 것을 막는다.

## 무료: 작명 후보에서 통합 분석까지

```text
로컬 출생정보 스냅샷
  -> SpringEngine.getCandidateSearch()      사주 + 성명학으로 작명 후보 평가
  -> 후보 선택(candidateId + 성/이름 글자 경계가 보존된 reportInput)
  -> SpringEngine.getReportDelivery()       사주 + 성명학 + 결합 분석
  -> 무료 ReportDeliveryV1                 유료 티저만, 유료 본문 없음
```

이 과정에는 서버 등록이나 결제가 없다. `candidateId`와 `analysisId`는 로컬 상관관계 값이지 인증 토큰이 아니다.

### 후보 검색과 페이지네이션

`candidateId`는 NFC 정규화한 `surnameHangul`, `surnameHanja`, `givenHangul`, `givenHanja`의 명시적 경계로 만든다. 점수, 순위, 인기도, 문구는 개선으로 바뀔 수 있으므로 ID 재료가 아니다. 따라서 복성·한 글자 이름의 문자열 결합 충돌을 피하면서도 동일한 이름 정체성은 동일하게 가리킨다. 비밀키 없는 가명값이므로 로그·URL·결제 권한으로 사용하지 않는다.

추천 순서와 `rank`는 로컬 `SpringEngine`이 확정하고 UI는 재정렬하지 않는다. 첫 페이지 계산 결과는 엔진 세션 안의 제한된 LRU 스냅샷에 보관한다.

자동 추천과 명시 이름 분석의 길이 계약은 서로 다르다.

- 신규 `getCandidateSearch()` 자동 추천은 현재 품질을 보증할 수 있는 이름 1~2자만 허용한다.
- 3~4자 자동 추천 요청은 사주 계산·DB 조회·후보 생성 전에 `UNSUPPORTED_RECOMMENDATION_NAME_LENGTH`로 실패한다.
- 사용자가 이미 정한 3~4자 이름은 `getReportDelivery()`, `getNamingReport()`, `getSpringReport()`에서 계속 정상 분석할 수 있다.
- 기존 `getNameCandidateSummaries()`의 동작과 출력은 호환을 위해 변경하지 않는다. 새 화면은 3~4자 자동 추천 우회 경로로 이 API를 사용하면 안 된다.
- 3~4자 자동 추천은 실명 자연스러움, 음운·어휘 품질, 통계 미존재 처리에 대한 독립 품질 게이트가 마련된 뒤 별도 계약 버전에서만 연다.

명시 이름의 정체성은 글자 단위로 일관돼야 한다. 모든 글자의 `hanja`를 생략하면 순한글 이름이고, 모든 글자에 실제 한자를 넣으면 한자 이름이다. 한 글자에만 한자를 넣는 부분 한자 입력은 `PARTIAL_HANJA_IDENTITY`, `pureHangulNameMode: 'on'`과 실제 한자를 함께 보내면 `PURE_HANGUL_MODE_CONFLICT`, `pureHangulNameMode: 'off'`인데 이름 전체가 순한글이면 `PURE_HANGUL_MODE_DISABLED`로 엔진 초기화 전에 실패한다. 이 세 이유는 유료 등록 계약에서도 그대로 유지하므로 UI는 입력을 잃지 않고 정확한 수정 안내를 할 수 있다.

- 첫 페이지가 반환한 `query.queryId`를 다음 모든 페이지에 그대로 사용한다.
- `offset > 0`인데 `queryId`가 없으면 실패한다.
- `queryId`는 다른 출생·이름·옵션 요청에 재사용할 수 없다.
- 엔진 `close()` 또는 LRU 축출 뒤에는 명시적으로 다시 검색한다.
- 최대 500개만 탐색 가능하며 더 많은 결과가 있으면 `truncated: true`로 알린다.
- 페이지를 넘길 때 후보를 다시 전부 채점하지 않고 같은 스냅샷을 자른다.

### 무료 보고서

`ReportDeliveryRequestV1`에는 로컬 출생 스냅샷과 선택 후보의 `candidateId`, `surname`, `givenName`을 함께 넣는다. 엔진은 글자 경계를 포함한 후보 ID를 다시 계산해 불일치하면 실패한다.

사주 원국은 모든 후보에서 동일하다. 후보마다 달라지는 것은 성명학 사실과 이름이 고정 원국의 보완·주의 요소에 어떻게 관계하는지다. 직접 오행 일치 수와 정본 `safetyProfile`은 별개 근거로 보존하고, 과도한 보강·상충 위험이 있거나 안전 근거가 없으면 결합 결과와 유료 티저를 제한한다.

한 `SpringEngine` 세션의 `analysisId`와 `sliceKey`로 기간·깊이별 조각을 안전하게 합칠 수 있다. `sliceKey`에는 surface, depth, 요청 기간, 카테고리, 생애 선택이 모두 들어간다. 이 ID는 앱 재시작을 넘는 영속 ID가 아니며 유료 서버가 그대로 신뢰해서는 안 된다.

`ReportDeliveryV1.provenance`는 선언된 tracked build-input source set의
`sha256:` manifest digest와 ruleset/data digest를 담는다. 이는 배포 산출물의
동일 입력 집합을 식별할 뿐 명리 판단의 정확성·문헌 권위·특정 실행의
재현성을 증명하지 않으며 `correctnessAuthority`는 항상 `false`다. 로컬 지연
조각은 같은 엔진 세션과 같은 provenance 안에서만 합친다. 정확한 포함·비범위와
모바일 bundle 경계는 `ENGINE_BUILD_MANIFEST_V1.md`를 따른다.

무료 DTO에는 `premiumContent`, 유료 본문, `paid`, `isUnlocked`, `entitlementId`, `deliveryId`를 넣지 않는다. 유료 제안은 `requires_server_entitlement` 티저와 상품 ID만 가진다.

## 유료: 이때부터만 서버 통신

```text
사용자가 유료 결과 진입을 명시
  -> 서버 ServiceCatalogV1 조회
  -> PremiumReportRegistrationRequestV1 전송
  -> 서버가 사주 + 성명학 + 결합 분석을 원본 입력으로 재계산
  -> 서버가 영속 analysisId/reportId/candidateId/contentVersion 발급
  -> 서버 카탈로그 가격으로 결제 생성·확인
  -> 서버가 소유자 결합 ReportEntitlementV1 발급
  -> 모든 바인딩과 근거 참조 검증
  -> 별도 PremiumReportDeliveryV1 반환
```

유료 등록 요청은 서버 통신이 시작되는 유일한 무료→유료 handoff다. 원본 `birth`, 글자 경계가 보존된 `surname`/`givenName`, `targetDate`, 허용된 분석 옵션을 보낸다. `localAnalysisId`는 추적용일 뿐이고, 서버는 로컬 점수·순위·사주·성명학·결합 판정을 신뢰하지 않는다. 서버가 같은 엔진·규칙·데이터로 재계산하고 새 영속 ID를 발급한다. 후보 ID도 분리된 성·이름 원본에서 다시 계산한다. 페이지 offset·queryId는 분석 정체성에 포함하지 않는다.

현재 출시 서버는 Google, Kakao OIDC, 이메일 링크 중 하나 이상의 primary provider가 연결된 인증 계정만 유료 등록·결제·전달의 소유자로 허용한다. 로그인하지 않은 사용자는 무료 로컬 기능을 그대로 쓰지만, 익명 세션은 유료 소유권으로 승격되지 않는다. Apple은 토큰 보관·철회와 credential-revoked 통지 수명주기 adapter가 구현·검증되기 전까지 환경변수만으로 활성화할 수 없는 실패 폐쇄 공급자다.

유료 소유자 v2는 canonical 내부 UUIDv4를 도메인·버전 분리 SHA-256으로 변환한 안정 식별자다. 운영 키에 의존하지 않으므로 감사·암호화 키를 회전해도 저장소 인덱스, 결제, entitlement, 환불, 내보내기, 삭제의 소유권이 바뀌지 않는다. 기존 keyed v1 소유자는 런타임에서 암묵적으로 연결하지 않으며, premium write를 동결한 명시적 오프라인 마이그레이션과 전수 검증이 끝나기 전에는 실패 폐쇄한다. 감사 actor/session은 소유자 키와 분리된 전용 키링의 key-addressed HMAC 가명만 저장하고 원본 ID는 저장하지 않는다.

서버는 다음 바인딩을 하나의 불변 값으로 저장한다.

```text
reportId + analysisId + candidateId + productId + contentVersion
```

가격은 유료 진입 시 `ServiceCatalogV1`에서 읽는다. 홈 화면이 카탈로그를 미리 가져오면 “무료는 서버를 거치지 않는다”는 원칙을 깨므로, 결제·유료 티저 진입 전에는 조회하지 않는다. 회의안의 1,000원은 서버 카탈로그 레코드로 배포하되 타입·엔진 상수로 고정하지 않는다. 결제 생성·확인도 클라이언트 금액이 아니라 같은 서버 카탈로그 버전으로 검증한다.

현재 출시 경로의 `ReportEntitlementV1`은 `requireAccountOwner`가 확인한 인증 계정과 위 바인딩 전체에 묶인다. 타입에 남아 있는 `anonymous_session` 소유자 표현은 미래 계약 호환용일 뿐 현재 유료 서버의 허용 경로가 아니다. 요청 ID를 아는 것, 브라우저의 `isUnlocked`, `sessionStorage`, URL 파라미터는 권한 증거가 아니다. 환불·철회·만료·결제 대기와 충돌 replay는 실패 폐쇄한다. 동일 바인딩 재요청만 멱등 재열람을 허용한다.

유료 등록의 `requestId`도 인증 소유자 범위에서 멱등 처리한다. 서버 저장소는 `(owner.kind, owner.subjectId, requestId)`를 원자적으로 예약하고 전체 정규 입력의 SHA-256을 보관한다. 같은 입력의 재시도만 같은 보고서를 반환하고, 생년월일·이름·옵션·로컬 상관 ID 중 하나라도 달라진 재사용은 새 보고서·결제·권한을 만들지 않고 거부한다. `evaluatePremiumReportRegistrationReplayV1()`, downstream report-binding 검증, Firestore 트랜잭션 저장소와 `/api/v1/premium/*` 핸들러가 이 경계를 구현한다. 실제 배포 환경의 트랜잭션 경쟁·재시도는 staging에서 별도로 검증해야 한다.

유료 본문은 별도 `PremiumReportDeliveryV1`에만 존재한다. 서버는 활성 entitlement의 정확한 바인딩·시간·소유자를 검증하고, 모든 본문 섹션에 하나 이상의 `evidenceRefs`를 요구하며 각 참조가 서버 재계산 결과의 허용된 사실·해석 ID인지 확인한 뒤 전달한다. 근거가 0개인 유료 결과는 유효하지 않다. 무료·유료 타입, 엔드포인트, 저장소, 캐시 키를 분리한다.

현재 저장소에는 이 유료 경계의 타입·검증뿐 아니라 서버 재계산, 카탈로그, 등록, checkout, Toss 확인·webhook·환불 어댑터, entitlement, 전달, 관리자 복구, 암호화 Firestore 영속화 엔드포인트가 구현되어 있다. 다만 실제 Firebase/Toss 프로젝트 설정, 배포된 Firestore 규칙·인덱스·TTL, 결제 sandbox E2E, 브라우저 checkout, 키 회전·lease 복구 훈련과 전문가 승인 콘텐츠 seed는 저장소 코드만으로 증명되지 않는다. 이 외부 staging gate를 통과하기 전에는 출시 승인으로 간주하지 않는다.

## 3개 보고서의 역할

### 통합

결론 우선의 쉬운 허브다. 사주와 이름을 하나의 임의 점수로 합치지 않고 보완·혼합·주의·직접 일치 없음과 안전 근거를 함께 설명한다. 사주·이름 오행은 각각 100%로 정규화해 비교하고 상세 근거는 의미 기반 링크로 각 전용 면에 연결한다.

### 사주

출생 기반 원국, 일간, 신강약, 격국, 용신 근거와 기간 흐름을 사실·해석으로 나눈다. `today`, `thisWeek`, `thisMonth`, `thisYear`는 요청한 기간·카테고리만 계산한다. 생애 흐름은 달력 탭과 별도 의미 단위다.

### 성명학

글자 뜻·소리·오행·수리 사격 등 이름 고유 근거를 중심으로 한다. 사격의 원형이정은 생애 프레임이지 이름만으로 만든 오늘·이번 주 운세가 아니다. 독립된 검증 방법이 없으므로 이름 단독 달력 운세는 만들지 않고 `NAMING_CALENDAR_METHOD_NOT_ESTABLISHED`로 명시한다.

현재 81수리 authored 원문에는 특정 질병, 부부 갈등, 특정 연령의 사건을 실제 개인에게 일어날 일처럼 단정하는 문장이 섞여 있다. 구조화된 획수·사격·오행 사실은 로컬 개발과 UI 연결에 사용할 수 있지만, 이 원문은 외부 성명학 전문가가 버전·검토자·실제 달력 검토일·불변 검토 증거의 `sha256:`을 승인하기 전에는 `ReportDeliveryV1`에 넣지 않는다. `config/engine.json`의 `reportDeliveryContentGates.fourFrameAuthoredInterpretation`은 기본적으로 `blocked_pending_external_expert_review`이며, 차단 중에는 성명학 surface가 `CONTENT_EXPERT_REVIEW_REQUIRED`를 반환하고 four-frame `interpretationRef`를 생략한다. 상태 문자열 하나만 `approved`로 바꿔서는 열리지 않는다. 원본 DB를 대량 수정해 문제를 숨기거나 단순 문자열 필터로 승인 상태를 우회하지 않는다.

또한 2026-07-19 고정 deterministic 표본 100건(1960~2010년, 남녀 교차)에서 유료 진입에 필요한 natal evidence `ready`는 0건이었고, `SAJU_JUDGMENT_LOW_CONFIDENCE` 100건, `YONGSHIN_CONSENSUS_CONFLICT` 95건이었다. 이 수치는 정확도 결론이나 모집단 추정치가 아니라 현재 유료 CTA가 사실상 닫혀 있음을 발견한 smoke evidence다. 권위 사례와 독립 전문가 검토로 판정 축을 개선하고 동일 표본 및 별도 홀드아웃에서 `ready`가 실제로 나타나는지 확인하기 전에는 threshold를 낮추거나 conflict를 무시해 유료 제안을 열지 않는다.

## 홈과 다른 무료 메뉴의 로컬 계약

### `LocalAnalysisContextV1`

앱 전체가 같은 사람과 정책을 참조하는 로컬 불변 스냅샷이다. 정규화된 출생시각, 달력·윤달·지역·시간대 정책, 입력 불확실성, 성별, 선택 이름/후보 참조, 로컬 엔진 provenance를 가진다. 개인정보를 ID에 인코딩하지 않는다. 문맥이 바뀌면 새 로컬 `analysisId`를 만들고 기존 유료 바인딩을 재사용하지 않는다.

### `LocalHomeSummaryV1`

홈 진입 때문에 전체 보고서나 서버 카탈로그를 계산·조회하지 않는다. 로컬 입력 완료 상태, 최근 로컬 후보·보고서 참조, 사용 가능한 무료 메뉴, 유료 진입 의미 대상만 제공한다. 상품명·가격은 유료 진입 뒤 서버 카탈로그에서 가져온다.

현재 capability에는 `integrated_report`, `saju_report`, `naming_report`가 각각 `ReportDeliveryV1` surface와 기본 depth 힌트를 갖고 들어가며 모두 `local_device`에서 실행된다. `premium_story_entry`는 `report.story-completion.v1` 상품 ID만 노출하고, 실행 위치를 `server_after_explicit_intent`, 카탈로그 상태를 `not_prefetched`로 고정한다. URL·가격·결제·권한은 홈 DTO에 넣지 않는다.

오행 그래프의 하나의 수치가 필요하다면 길흉 점수가 아니라 계산식과 의미가 공개된 균등도 지표로 분리한다. 정규화 Shannon evenness 같은 값은 분포의 고른 정도를 설명하는 수학 지표일 뿐 명리학적 우수성 점수가 아님을 명시한다.

### `LocalBirthPreviewV1`

출생정보 수정 중 매 타이핑마다 전체 사주·성명학·기간 보고서를 만들지 않는다. 정규화 결과, 적용 정책, 기둥·경계 변화, 시간 미상 불확실성, 전체 재분석 필요 여부만 로컬에서 계산한다. 성별을 임의 기본값으로 고정하지 않는다.

### `LocalHanjaLookupV1`

패키지된 한자 DB를 로컬에서 읽고 검색 문자열, 독음, 법적 사용 가능 필터, 안정적 문자 ID, 뜻, 획수, 자원오행, 법적 상태, 변체자 관계, 출처·데이터 버전을 제공한다. 정렬과 페이지네이션은 `SpringEngine`이 소유하고 UI는 전체 DB를 복제해 다시 정렬하지 않는다. 데이터 업데이트는 앱 자산 버전 업데이트로 처리한다.

### `LocalShareExportV1`

무료 공유를 위해 서버에 개인정보를 업로드하거나 출생정보·이름을 URL에 넣지 않는다. 로컬에서 사용자가 고른 필드만 남긴 텍스트·이미지 스냅샷을 만들고 Web Share 또는 OS 공유 시트로 전달한다. 만료 링크·교차 기기 복원 같은 서버 공유는 무료 원칙과 충돌하므로 별도 동의가 있는 유료/서버 기능으로만 설계한다.

## 성능·안정성 기준

신규 FE는 무료 `SpringEngine` 계산을 UI 메인 스레드에서 직접 실행하지 않고 장수 Dedicated Worker 또는 동등한 네이티브 background runtime에서 실행해야 한다. 최초 사주·통합·후보 계산은 데스크톱 특성 측정에서도 프레임 예산을 크게 넘으므로 이 규칙은 권장이 아니라 출시 계약이다. 홈에서는 계산 DB·사주·기사·생성 번들을 미리 열지 않고, 사용자가 해당 흐름에 진입할 의도를 보인 뒤 필요한 자산만 준비한다. 세부 lifecycle, LRU, 취소, 측정 계약은 [모바일 로컬 계산 성능 계약 V1](./MOBILE_LOCAL_PERFORMANCE_CONTRACT_V1.md)을 따른다.

홈/LCP는 `@spring/experience/local-device-entry`에서 출생 미리보기와 정적
capability만 import한다. 호환용 `@spring` 루트 및
`@spring/experience/local-menu`는 초기 화면에서 금지하며, 분석·한자 검색 진입 뒤
Worker 쪽에서만 지연 로드한다. 이 경계는 transitive static graph의 raw/gzip 예산과
SpringEngine·SQL·저장소·saju 구현 입력 0개를 실제 esbuild metafile로 검사한다.

- 기본 후보 페이지는 20개, 한 요청 최대 100개, 한 세션 탐색 상한은 500개다.
- 첫 후보 페이지에서만 bounded top-N을 계산하고 다음 페이지는 세션 스냅샷을 사용한다.
- 기간 탭은 선택 기간·카테고리만 계산한다. 초기 화면에서 네 기간과 모든 카테고리를 만들지 않는다.
- 엔진 진입점, delivery builder, 기간 기사 registry는 동적 import 경계로 나눈다. 이름 전용 호출은 기간 기사 팩을 로드하지 않는다.
- 후보 카드에서는 무거운 전체 `SpringReport` 대신 `CandidateSearchResponseV1`을 사용한다.
- 신규 무료 delivery는 원격 생성 번들을 preload/fetch하지 않는다. 해당 import·network 경계를 테스트로 고정한다.
- 향후 mock 콘텐츠를 로컬에서 쓸 때는 사람 축이 URL에 들어가는 legacy `/generated-packed/<category>/<packKey>`를 신규 FE가 사용하지 않는다. [로컬 생성 콘텐츠 경계 V2](./GENERATED_LOCAL_CONTENT_V2.md)의 category+period shard 또는 동일 산출물의 앱/IndexedDB import를 사용한다.
- 공개 요청은 크기·깊이·정확한 필드 허용 목록을 검사하고 응답은 최대 바이트, ID 중복, 참조 무결성, coverage 일치를 검사한다.
- 점수를 조용히 clamp하지 않는다. 상류 오류는 계약 오류 또는 명시적 `limited`로 처리한다.
- 배포 manifest digest는 포함된 규칙·데이터 산출물의 정체성만 증명한다. 누락 범위를 가짜 버전으로 채우거나 정확성·권위 증명으로 표시하지 않는다.
- 무료 로컬 캐시와 유료 서버 캐시는 물리적으로 분리한다.

2026-07-18 고정 fixture의 `npm run bench:report-delivery` 측정에서 통합 today 6개 카테고리 응답은 약 10.23 KiB, 기존 full tiered 응답은 약 1,692.24 KiB로 선택 응답이 약 0.60%였다. 같은 엔진에서 통합 반복 계산은 데스크톱 Node 기준 약 46 ms였다. 사주 timeline의 첫 호출은 `tsx` 개발 런타임의 동적 모듈 컴파일까지 포함해 약 856 ms였지만, 모듈을 읽은 뒤 같은 요청은 약 45 ms였다. 이 값들은 모바일 SLA가 아니며 첫 호출 비용과 계산 비용을 구분하기 위한 특성치다. 실제 Vite 프로덕션 빌드에서 delivery builder는 약 27.30 KiB(raw)/9.63 KiB(gzip), timeline 코드는 약 51.92 KiB(raw)/16.97 KiB(gzip)였고 기사·용어집은 개별 lazy shard로 분리됐다. 혼합 기간 fixture가 실제로 읽은 기사 원본은 전체의 약 5.38%였다. 새 FE는 입력 중/유휴 시 이 작은 timeline chunk를 선행 로드하되 개인정보나 계산 결과를 전송하지 않아야 한다. 바이트·동적 import·무네트워크 회귀를 자동 검사하고 실제 저사양 Android/iOS 성능 예산은 기기 측정으로 별도 확정한다.

## 이행 순서

1. 기존 프론트엔드가 쓰는 응답은 유지하고 신규 로컬 계약을 병행한다.
2. 신규 통합 화면부터 `ReportDeliveryV1`과 선택 기간 지연 계산을 사용한다.
3. 사주·성명학 화면을 같은 사실 ID와 의미 기반 링크로 연결한다.
4. 구현된 홈·출생 미리보기·한자 검색·공유 로컬 계약을 신규 화면에 연결한다.
5. 유료 진입 시 primary-provider 계정으로 전환한 뒤에만 서버 카탈로그와 등록 API를 호출한다.
6. 구현된 서버 재계산·등록·결제·entitlement·전달 경로를 Firebase/Toss staging에서 경쟁·재시도·환불·복구까지 검증한다.
7. 전문가 승인 콘텐츠와 외부 운영 gate가 모두 통과된 뒤 `PremiumReportDeliveryV1` 브라우저 흐름을 활성화한다.
8. 관측 기간 뒤 구형 계약 사용이 사라진 것을 확인하고 호환 경로를 폐기한다.

프론트엔드가 신규 계약을 채택하기 전까지 기존 출력은 유지한다. 다만 신규 결제 권한은 처음부터 서버 바인딩으로 구현하고 브라우저 잠금 플래그를 임시 권한으로 확대하지 않는다.
