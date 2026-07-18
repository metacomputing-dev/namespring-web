# 신규 제품 백엔드 V2 인수인계

이 문서는 신규 프론트엔드가 백엔드 구현을 임의로 추측하지 않고, 무료 로컬
서비스와 계정·유료 서버 기능을 한 제품으로 연결하기 위한 기준이다. 기존
프론트엔드는 계속 동작하게 두되 신규 화면은 아래 경계를 따른다.

## 한 문장 제품 계약

로그인 전에도 사주·성명학·작명·통합 분석은 기기 안에서 완전하게 동작하고,
사용자가 즐겨찾기 동기화 또는 유료 결과를 명시적으로 선택한 시점부터만 계정과
서버가 개입한다.

## 실행 위치와 개인정보 경계

| 기능 | 실행·저장 위치 | 네트워크 |
| --- | --- | --- |
| 출생정보 입력 기억, 선택 이름, 최근 무료 결과 | 앱의 IndexedDB 또는 네이티브 보안 저장소 | 없음 |
| 사주 원국·기간 운세·성명학·사주×이름 통합 | Dedicated Worker 안의 `SpringEngine` | 없음 |
| 작명 후보·한자 검색·무료 공유 | 로컬 엔진과 패키지 자산 | 없음 |
| 로컬 즐겨찾기 | IndexedDB; 사용자가 동의하면 클라이언트 암호화 후 동기화 | 동의 전 없음 |
| 로그인 세션·CSRF | Secure/HttpOnly `__Host-` 쿠키 | 계정 전환 뒤 |
| 상품 가격·유료 등록·결제·권한·유료 본문 | 인증된 서버 API와 Firestore | 명시적 유료 진입 뒤 |
| 콘텐츠 검수·활성화·로컬 자산 export | 관리자 서버 API | 운영·빌드 과정만 |

여기서 `없음`은 개인 입력이나 계산 결과를 보내는 런타임 API 요청이 0이라는 뜻이다.
웹 앱의 JS·Wasm·검수된 정적 JSON 같은 설치 자산은 최초 설치 또는 캐시 갱신 때
정적 호스팅에서 내려받을 수 있으며, 그 URL에는 개인화 축이나 사용자 입력을 넣지 않는다.

생년월일·출생시각·이름을 쿠키, URL, 분석 ID에 넣지 않는다. “한 번 입력한 값
기억하기”는 쿠키가 아니라 로컬 데이터베이스가 담당한다. 쿠키는 세션과 CSRF에만
쓰며, 이 구분은 브라우저 용량뿐 아니라 로그·리퍼러·서버 전송을 피하기 위한
개인정보 계약이다.

## 보고서 정보 구조

### 통합 화면

첫 화면은 쉬운 결론 우선 허브다. 하나의 불투명한 종합 점수로 사주와 이름을
섞지 않는다. 다음을 짧게 보여 주고 상세 근거는 의미 기반 링크로 연결한다.

- 고정된 출생 원국과 현재 이름의 관계 한 줄 요약
- 사주 오행 분포와 이름 오행 분포를 분리한 비교
- 보완, 혼합, 주의 또는 직접 일치 없음의 근거
- 오늘·이번 주·이번 달·올해 중 현재 선택한 기간과 6개 카테고리
- 사주 상세, 성명학 상세, 유료 이야기 완성하기로 가는 semantic target

### 사주 화면

출생정보만으로 정해지는 원국, 일간, 신강약, 격국, 용신 후보와 기간 흐름을
전문가 수준까지 보여 준다. 이름을 바꿔도 사주 원국과 출생 기반 사실 ID는 바뀌지
않는다. 근거가 부족하거나 판단이 보류된 항목은 `limited` 또는 `unavailable`을
그대로 렌더링하고, UI가 임의로 낙관적 상태로 승격하지 않는다.

### 성명학 화면

글자 뜻·소리·자원오행·수리 사격과 이름 고유 근거가 중심이다. 원형이정은 생애
프레임으로 설명한다. 검증된 독립 방법이 없는 이름 단독 일일·주간 운세는 만들지
않으며 `NAMING_CALENDAR_METHOD_NOT_ESTABLISHED`를 정확히 안내한다. 출생 원국과
연결된 내용은 “이 이름이 고정 원국과 어떻게 상호작용하는가”로만 표현한다.
순한글 이름에는 한자·사격수리 placeholder 점수나 한자 획수를 만들지 않고 한글
방법 근거와 `METHOD_SCOPE_LIMITED`만 표시한다. 기존 81수리 authored 상세문구는
질병·부부관계·특정 연령 사건을 단정하는 표현이 확인되었으므로 외부 성명학
전문가의 검토자·유효기간·불변 증거 digest가 갖춰지기 전에는
`CONTENT_EXPERT_REVIEW_REQUIRED`로 자동 노출을 차단한다.

## 로컬 프론트엔드 연결 순서

1. 홈의 LCP 정적 그래프는 정확히 `@spring/experience/local-device-entry`만 import한다.
   `@spring` 루트와 `@spring/experience/local-menu`는 초기 그래프에서 금지하고,
   `SpringEngine`, 한자 DB, 이름 통계, 생성 콘텐츠는 사용자 의도 뒤 Worker에서만
   동적 로딩한다. `buildLocalHomeSummaryV1`도 출생 입력 확정 뒤의 원국 계산이지 LCP
   구성요소가 아니다.
2. 출생 입력을 로컬 스키마로 정규화하고 `LocalBirthPreviewV1`로 경계·불확실성을
   확인한다. 입력 확정 뒤 `LocalAnalysisContextV1`을 만든다.
3. 사용자가 기능에 진입할 때 장수 Dedicated Worker를 시작한다. 메인 스레드에서
   엔진 계산을 직접 실행하지 않는다.
4. 기존 이름은 `getReportDelivery()`로 분석한다. 작명은
   `getCandidateSearch()`의 엔진 순서를 유지하고 후보의 `reportInput`을 다음
   무료 통합 분석에 그대로 전달한다.
5. 보고서 탭은 요청한 surface·기간·category 조각만 계산한다. 서로 다른 엔진
   세션, provenance 또는 `sliceKey`의 조각을 합치지 않는다.
6. 무료 상태 복원은 IndexedDB adapter를 사용한다. 엔진 버전·provenance가
   바뀌면 저장된 계산 결과를 권위값으로 재사용하지 않고 재계산한다.
7. 공유는 `LocalShareExportV1`의 가림 처리 결과만 사용한다. 원본 입력을 URL이나
   서버 공유 링크로 바꾸지 않는다.

자동 작명은 현재 1~2글자 이름만 허용한다. 이미 정해진 3~4글자 이름 분석은
지원하지만, 3~4글자 자동 추천은 별도 전문가 품질 게이트 전까지 실패 폐쇄한다.

## 개발용 생성 JSON 교체 경계

현재 대량 JSON은 엄격한 기존 게이트를 통과한 개발용 production-like fixture로
취급할 수 있다. 신규 FE는 이 데이터를 실제 화면에서 충분히 사용하되, 다음
adapter 경계를 지킨다.

```text
ReportContentSource
  ├─ DevelopmentGeneratedJsonAdapter
  └─ ReviewedLocalAssetAdapter
```

- 신규 런타임은 사람 축이 URL에 드러나는 legacy pack URL을 사용하지 않는다.
- category+period shard 또는 같은 산출물을 import한 로컬 SQLite/IndexedDB를 읽는다.
- mock 여부, source digest, schema version을 adapter 바깥에서 잃지 않는다.
- 기존 JSON을 업로드했다는 이유만으로 production 활성 콘텐츠가 되지 않는다.
- 최종 사람 검수와 서로 다른 검토자·승인자의 승인 뒤 export한 자산만
  `ReviewedLocalAssetAdapter`로 교체한다.
- UI는 동일한 의미 DTO만 소비하므로 일괄 교체 때 화면 코드를 다시 쓰지 않는다.

## 계정 전환과 동기화

기본 상태는 `anonymous_local`이며 서버 익명 계정을 선제 생성하지 않는다.
즐겨찾기 동기화, 결제 또는 구매 복원 버튼에서만 계정 전환을 제안한다.

1. `GET /api/auth/policy`로 배포가 검증한 공급자만 표시한다.
2. Firebase에서 공급자 인증 또는 동일 UID credential link를 완료한다.
3. `GET /api/auth/csrf` 뒤 `POST /api/auth/session`으로 ID token을 짧게 교환한다.
4. 브라우저는 이후 HttpOnly 세션 쿠키를 사용하고 ID token을 장기 저장하지 않는다.
5. `POST /api/v1/sync/consent`에서 사용자가 선택한 범위만 동의받는다.
6. `GET /api/v1/sync/snapshot`의 AAD context로 즐겨찾기를 클라이언트에서
   암호화하고 `POST /api/v1/sync/delta`로 동기화한다.

Google·Kakao OIDC·이메일 링크는 모두 서버 내부 UUIDv4 하나로 수렴한다. 이메일
문자열이나 전화번호가 같다는 이유로 계정을 합치지 않는다. Apple은 credential
철회·revoked 통지 adapter가 검증되기 전까지 설정값으로도 활성화할 수 없다.
전화번호는 향후 step-up 후보이고, Facebook·기타 OIDC도 공급자별 검증 전에는
비활성이다.

## 후보에서 유료 결과까지

현재 deterministic 출생 100건 점검에서는 원국 근거가 모두 `limited`,
`SAJU_JUDGMENT_LOW_CONFIDENCE`가 100건, `YONGSHIN_CONSENSUS_CONFLICT`가 95건이었다.
따라서 아래 흐름은 계약상 준비되어 있어도 실제 유료 CTA/offer는 신뢰도 게이트가
해제되기 전까지 열리지 않는다. 수치 임계값을 낮춰 결제를 먼저 여는 방식은 금지하며,
권위 자료·교차검증·외부 명리 전문가 승인으로 원인을 해소해야 한다.

```text
로컬 후보 선택
  -> 로컬 무료 통합 분석
  -> 명시적 유료 진입
  -> 서버 카탈로그 조회
  -> 원본 입력으로 서버 재계산·등록
  -> 활성 콘텐츠와 정확한 report binding 고정
  -> 인증 계정 소유 checkout
  -> 결제 공급자 확인
  -> entitlement 발급
  -> 근거 참조가 검증된 유료 본문 전달
```

서버는 로컬 점수, `analysisId`, `candidateId`를 권위값으로 신뢰하지 않는다. 원본
출생·이름 글자 경계를 다시 검증하고 사주·성명학·결합을 재계산한다. 권한은 다음
불변 바인딩 전체에 묶인다.

```text
owner + reportId + analysisId + candidateId + productId + contentVersion
```

결제 완료 UI, URL 파라미터, 브라우저 `isUnlocked`는 권한 증거가 아니다. 서버가
공급자 결제와 정확한 바인딩을 확인하고 entitlement를 원자적으로 커밋한 뒤에만
유료 본문을 전달한다. 동일 요청 재시도는 멱등이고, 같은 ID를 다른 입력에 쓰면
충돌로 거부한다. 환불·철회·만료는 전달 권한을 실패 폐쇄한다.

기존 `/api/payments/create|confirm|fail`은 인증되지 않은 이전 흐름을 다시 열지
않도록 `410 LEGACY_PAYMENT_FLOW_RETIRED` tombstone으로 유지한다. 신규 FE는 오직
`/api/v1/premium/*`를 사용한다.

## 관리자와 콘텐츠 운영

대량 JSON을 production DB로 옮기는 것은 단순 import가 아니라 다음 수명주기다.

```text
validate_only -> draft -> human review -> different-admin approval -> active
                                                        -> local asset export
```

모든 관리자 API는 저장 계정 역할과 Firebase custom claim의 교집합, 정확한 Origin,
CSRF, rate limit을 요구한다. 브라우저에서 역할을 부여하는 API는 없다. export는
고정 catalog revision, bounded page/byte cap, ordered digest, finalization receipt를
사용하며 부분 staging은 공개되지 않는다. 무료 앱은 이 관리자 API를 런타임에
호출하지 않고 빌드된 로컬 자산만 읽는다.

## 오류·가용성 렌더링 규칙

- `ready`, `limited`, `unavailable`을 화면 문구로 덮어쓰지 않는다.
- `reasonCodes`는 고객 안내와 진단용이며 임의 문자열 추론을 하지 않는다.
- 사실, 해석, 근거 참조를 분리해 렌더링한다.
- 유료 티저가 있어도 무료 DTO 안에 유료 본문이나 잠금 해제 상태를 넣지 않는다.
- 서버 일시 실패는 무료 로컬 기능을 막지 않는다.
- 작업 취소·화면 이동·새 입력에는 worker request ID와 최신 context를 확인해 늦게
  도착한 이전 계산 결과를 폐기한다.

## PR 이후 신규 FE의 최소 완료 기준

- 저사양 모바일 크기의 홈에서 엔진·DB chunk 선로드가 0임을 번들 그래프로 검증
- 무료 사주·성명학·작명·통합·한자 검색 중 API 요청 0을 E2E로 검증
- 새로고침·뒤로가기·다중 탭·오프라인에서 로컬 입력과 후보 선택 복원
- 계정 승격 후 중복 내부 계정 없이 로컬 즐겨찾기 동기화
- 결제 성공, 중복 confirm, provider timeout, 환불, entitlement 철회 흐름
- 계정 연결·해제·전체 세션 철회·삭제 pending 및 복구 UI
- unavailable/limited, 부분 한자, 순한글 모드 충돌, 시간 미상, 달력 경계 안내
- 320px부터 데스크톱까지 접근성, 키보드, 스크린리더, 모션 감소, 느린 네트워크
- mock 콘텐츠와 최종 reviewed asset의 adapter 교체 회귀

## 저장소 내 상세 계약

- 로컬 엔진·보고서·유료 handoff:
  [`APP_BACKEND_CONTRACTS_V1.md`](../../lib/spring-ts/docs/APP_BACKEND_CONTRACTS_V1.md)
- 모바일 계산 성능:
  [`MOBILE_LOCAL_PERFORMANCE_CONTRACT_V1.md`](../../lib/spring-ts/docs/MOBILE_LOCAL_PERFORMANCE_CONTRACT_V1.md)
- 생성 콘텐츠 로컬 shard:
  [`GENERATED_LOCAL_CONTENT_V2.md`](../../lib/spring-ts/docs/GENERATED_LOCAL_CONTENT_V2.md)
- 인증·스토어 출시 게이트:
  [`MOBILE_AUTH_AND_STORE_LAUNCH_GATES_V1.md`](./MOBILE_AUTH_AND_STORE_LAUNCH_GATES_V1.md)
- 배포와 외부 검증:
  [`DEPLOYMENT_BACKEND.md`](../DEPLOYMENT_BACKEND.md)
- 도메인별 운영 절차:
  [`auth`](../api/auth/README.md),
  [`sync`](../api/v1/sync/OPERATIONS.md),
  [`premium`](../api/v1/premium/OPERATIONS.md),
  [`content`](../api/v1/content/OPERATIONS.md)

이 구현과 로컬 테스트는 외부 Firebase/Toss 프로젝트, 실제 앱스토어 설정,
production TTL·index·cron 배포, 한국어 명리·성명학 전문가 승인까지 증명하지
않는다. 해당 항목은 출시를 차단하는 운영 증거로 별도 유지한다.
