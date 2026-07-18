# 관리자·운영 UI 백엔드 계약 v1

- 계약 ID: `namespring.backend-admin-api.v1`
- 기준일: 2026-07-19
- 범위: 신규 관리자/운영 FE가 호출할 수 있는 현재 서버 API
- 비범위: 일반 사용자 무료 로컬 계산, 관리자 역할 부여, Firestore 직접 접근, 내부 cron

## 준비도 판정

현재 백엔드는 **콘텐츠 승인·배포 UI**와 **이미 식별자를 알고 있는 운영 건의 재시도·정산·환불·회수 UI**에는 FE-safe하다. 모든 브라우저 관리자 경로는 서버 세션, 허용 Origin, CSRF, 서버 권한 검증, 요청 크기 제한, rate limit을 거친다.

다만 다음 대시보드는 아직 만들면 안 된다.

- 동기화 사용자/개별 보존 후보 목록과 상세 조회

Auth lifecycle과 Premium은 식별정보·결제 비밀을 제거한 bounded metadata 목록/상세 조회를 제공하고, sync retention은 사용자 식별자 없이 bounded aggregate 상태만 제공한다. 운영 FE가 Firestore를 직접 읽거나, 정산·환불 API를 조회 API처럼 호출하면 안 된다. sync 개별 대시보드가 필요해질 때 별도 PR에서 필드 최소화, cursor, 최대 응답 바이트, 감사 로그를 갖춘 metadata-only endpoint를 설계한다.

## 브라우저 공통 프로토콜

1. `GET /api/auth/current`를 `credentials: "include"`로 호출한다. `authenticated: true`일 때 반환되는 `roles`는 메뉴 표시용 힌트일 뿐이고 최종 권한 판정은 항상 서버가 한다.
2. `GET /api/auth/csrf`에서 `csrfToken`을 받고 **메모리에만** 둔다. localStorage, 로그, 분석 이벤트에 저장하지 않는다.
3. 아래 관리자 API는 모두 `POST`, `Content-Type: application/json`, `credentials: "include"`, `X-CSRF-Token: <csrfToken>`으로 호출한다. 요청 `Origin`은 `AUTH_ALLOWED_ORIGINS`/`PUBLIC_APP_ORIGIN`의 정확한 origin과 일치해야 한다.
4. 세션은 `__Host-namespring_session` HttpOnly/Secure/SameSite=Lax 쿠키다. CSRF 쿠키는 `__Host-namespring_csrf` HttpOnly/Secure/SameSite=Strict이고 헤더 값과 constant-time 비교된다.
5. 성공/오류 응답은 `Cache-Control: no-store`다. 오류는 `{ "error": { "code": string, "message": string } }` 형태다. FE는 문구가 아니라 `code`를 분기 기준으로 사용한다.

대표 상태 코드는 400(계약 위반), 401(세션 없음/만료), 403(Origin·CSRF·권한), 404(알려진 ID가 없음), 409(상태/리비전/공급자 불일치), 413(요청 한도), 429(rate limit), 500/503(내부·의존 서비스 또는 저장 데이터가 안전 응답 계약을 위반함)이다. 202는 실패가 아니라 후속 재시도·조정이 남은 상태다.

## 권한 모델

특권 역할은 계정 저장소의 역할과 현재 Firebase custom claim에 **동시에** 있어야 유효하다. 한쪽만 있으면 403이다. `admin`, `premium_admin`, `premium_system`은 서로 독립이며 상속 관계가 없다.

| 역할 | 브라우저 UI 용도 | 허용 영역 |
|---|---|---|
| `admin` | 운영자 | 계정 유지보수, 콘텐츠 lifecycle/export, sync retention, legacy 환불 |
| `premium_admin` | 프리미엄 운영자 | 프리미엄 콘텐츠 활성/폐기, 주문 reconcile/refund, 권리 revoke |
| `premium_system` | 브라우저 UI에서 사용 금지 | 내부 cron·서비스 진입점에서만 자동 복구 수행 |

역할을 부여·수정하는 공개 API는 없다. FE는 역할 관리 화면을 만들지 않는다.

## 기능 매트릭스

| 영역 | list/get | retry | reconcile | refund | revoke | export |
|---|---:|---:|---:|---:|---:|---:|
| Auth 유지보수 | metadata-only list/get 지원 | discovery의 request ID로 retry | - | - | - | - |
| Content lifecycle | 지원 | requestId idempotency | - | - | retire/rollback | bounded export 지원 |
| Sync retention | 집계 상태만 지원, 개별 목록 미지원 | sweep 재호출만 | - | - | expired data 삭제 | - |
| Premium | metadata-only 주문·권리·복구 목록/상세 지원 | lease batch 재호출 | discovery에서 확인한 order와 별도 수신 payment ID | discovery order ID | discovery entitlement ID | 미지원 |
| Legacy payment | 미지원 | 202일 때 동일 order 재조정 | 환불 경로 내부에서 수행 | 알려진 order ID만 | - | - |

## Auth·sync·legacy endpoint

모두 `admin` 역할이다. 기본 JSON 요청 한도는 64 KiB다.

| Endpoint | 요청 | 성공 | rate limit/주체 | FE 주의 |
|---|---|---|---|---|
| `/api/auth/admin/list-lifecycle-jobs` | `{ kind?, status?, limit?, cursor? }` exact, 최대 8 KiB, limit 1-20 | 200, 최대 20개/64 KiB | 120/5분/user 공유 | `snapshotAt`에 고정된 signed opaque cursor; metadata-only |
| `/api/auth/admin/get-lifecycle-job` | `{ kind, requestId }` exact, 최대 8 KiB | 200 단일 metadata | 120/5분/user 공유 | kind와 request ID prefix가 일치해야 함 |
| `/api/auth/admin/retry-deletion` | `{ deletionRequestId }` exact | 200 완료, 202 pending | 20/시간/session | discovery request ID로 진입. 응답에는 내부 user/session ID가 없음 |
| `/api/auth/admin/retry-unlink` | `{ unlinkRequestId }` exact | 200 완료, 202 pending | 30/시간/session | discovery request ID로 진입 |
| `/api/v1/sync/admin/retention-status` | exact `{}`, 최대 2 KiB | 200 bounded aggregate | 30/5분/user | cap 100 + `hasMore`; 사용자/문서 ID·ciphertext·claim token 없음 |
| `/api/v1/sync/admin/retention-sweep` | `{ limit?: number }`, 정수 1-80 | 200 집계값만 | 4/시간/user | 사용자/즐겨찾기 값은 반환하지 않음 |
| `/api/admin/refund` | `{ orderId, reason? }` exact, 최대 4 KiB | 200 terminal, 202 follow-up | 30/시간/user | legacy 전용. 202일 때 수동 이중 환불 금지 |

Auth lifecycle discovery 응답은 `requestId`, `kind`, `status`, `stage`, `attemptCount`, bounded timestamps와 sanitized failure code만 포함한다. internal user ID, Firebase UID, provider subject, binding digest, raw error, claim token은 repository projection과 응답 복사 경계에서 모두 제거된다. 목록은 불변인 `requestedAt/requestId` 역순으로 `snapshotAt` 이전에 생성된 작업 집합을 고정하며 cursor는 필터까지 HMAC 서명되어 변조·필터 간 재사용이 거절된다. 상태 필터는 각 페이지 조회 시점의 상태이므로 장시간 열린 운영 화면은 첫 페이지부터 새로 고친다. 성공한 list와 성공/404 get은 응답 전에 fail-closed audit을 남긴다. 감사 레코드에도 운영자와 request ID는 HMAC만 저장되고 원문은 남지 않는다.

`retention-status`는 `expiresAt`만 최대 101개 projection하여 `candidateCount`를 100에서 자르고 `hasMore`를 계산한다. `oldestDueAt`과 최근 maintenance start/finish 전이(`heartbeatAt`), lease 만료 시각, 최근 완료 outcome/aggregate만 반환한다. 이 조회는 transaction·lease claim·write를 수행하지 않으며 sweep와 동시에 호출되면 즉시 낡을 수 있는 운영 snapshot이다. 내부 user/document ID, 즐겨찾기/설정, 암호문, active run ID, fence, claim token, raw exception은 계약상 반환 금지다.

## Content lifecycle endpoint

모두 `admin` 역할이다. lifecycle 전이와 사람 검수 순서는 `api/v1/content/OPERATIONS.md`를 따른다. `list.limit`은 1-10의 **상한**이며, 실제 응답은 1,250,000 UTF-8 bytes를 넘기기 전에 조기 분할될 수 있다. 반드시 반환된 `nextCursor`를 사용한다.

| Endpoint | 요청/한도 | 성공 | rate 그룹 |
|---|---|---|---|
| `/api/v1/content/admin/list` | `ListContentArtifactsRequestV1`, 64 KiB | 200, 최대 1,250,000 bytes | read 120/5분/user |
| `/api/v1/content/admin/get` | `GetContentArtifactRequestV1`, 64 KiB | 200 단일 artifact | read 120/5분/user |
| `/api/v1/content/admin/stage-batch` | `StageContentBatchRequestV1`, 최대 50개/1 MiB | 200 validate, 201 draft 등록 | bulk 20/5분/user |
| `/api/v1/content/admin/register` | `RegisterContentArtifactRequestV1`, 768 KiB | 201 | bulk 20/5분/user |
| `/api/v1/content/admin/review` | `ReviewContentArtifactRequestV1`, 64 KiB | 200 | mutation 60/5분/user |
| `/api/v1/content/admin/approve` | `ApproveContentArtifactRequestV1`, 64 KiB | 200 | mutation 60/5분/user |
| `/api/v1/content/admin/activate` | `ActivateContentArtifactRequestV1`, 64 KiB | 200 | mutation 60/5분/user |
| `/api/v1/content/admin/retire` | `RetireContentArtifactRequestV1`, 64 KiB | 200 | mutation 60/5분/user |
| `/api/v1/content/admin/rollback` | `RollbackContentArtifactRequestV1`, 64 KiB | 200 | mutation 60/5분/user |
| `/api/v1/content/admin/export-local-manifest` | exact `{}`, 2 KiB | 201, 24시간 owner-bound session | start 4/시간/user, 300초 |
| `/api/v1/content/admin/export-local-bundle` | exact `{}`, 2 KiB | 201, 위 endpoint의 deprecated alias | start 한도 공유 |
| `/api/v1/content/admin/export-local-page` | `LocalContentExportPageRequestV1`, 64 KiB | 200, metadata chunk 최대 100개/응답 1,500,000 bytes | global 1,200/시간/user + 600/시간/user+exportId |
| `/api/v1/content/admin/finalize-local-export` | `FinalizeLocalContentExportRequestV1`, 64 KiB | 200 receipt | global 40/시간/user + 20/시간/user+exportId |

목록의 artifact payload와 export page는 큰 데이터다. 모바일 운영 UI는 최초 `limit: 3`을 권장하고, 본문은 `get` 진입 후 렌더링한다. export 데이터는 브라우저 상태/localStorage에 장기 보관하지 말고 빌드 도구가 digest를 검증하며 소비한다. 2,500개를 넘는 active local catalog는 서버 환경의 명시적 운영 gate와 25,000개 이하 상한 없이는 full metadata read 전에 503으로 닫힌다. 페이지는 snapshot 생성 관리자에게 HMAC 결속되고, 100개 metadata chunk 안에서도 1.5 MiB에 닿으면 offset cursor로 조기 분할된다.

## Premium endpoint

모든 요청은 exact object다. 별도 표시가 없으면 요청 한도 64 KiB, 공통 `premium.mutation` 한도 120/5분/user다. 서비스 계층이 route 권한을 다시 검증한다.

| Endpoint | 역할 | 요청/한도 | 성공/주의 |
|---|---|---|---|
| `/api/v1/premium/admin/discovery/list` | `premium_admin` | `{ resource: "orders" \| "entitlements" \| "payment_recovery", limit?: 1-20, cursor? }`, 4 KiB | 200 metadata page, 최대 128 KiB, opaque stable cursor, 별도 60/5분/user |
| `/api/v1/premium/admin/discovery/get` | `premium_admin` | `{ resource, id }`, 4 KiB | 200 metadata item. 원천/projection 불일치·누락은 503 fail-closed |
| `/api/v1/premium/admin/reconcile` | `premium_admin` | `{ orderId, paymentKey }` | 200 order. paymentKey/내부 기록을 로그·브라우저 저장소에 남기지 않음 |
| `/api/v1/premium/admin/reconcile-leases` | `premium_admin` | `{ limit?: number }`, 정수 1-3, 2 KiB | 200 aggregate, 별도 12/5분/user |
| `/api/v1/premium/admin/refund` | `premium_admin` | `{ orderId, reason }` | 200 result. 자동 중복 제출 금지 |
| `/api/v1/premium/admin/revoke` | `premium_admin` | `{ entitlementId, reason }` | 200 entitlement |
| `/api/v1/premium/admin/content/review` | `premium_admin` | `{ reviewRequestId, notesDigest, artifact }`, 512 KiB | 200 opaque sealed-review receipt view; client `humanReview` is forbidden |
| `/api/v1/premium/admin/content/review-template` | `premium_admin` | `{ reviewRequestId, notesDigest, sampleReportId, template }`, 512 KiB | 200 opaque sealed-review receipt view |
| `/api/v1/premium/admin/content/activate` | `premium_admin` | `{ activationRequestId, reviewReceiptId, artifact }`, 512 KiB | 200 artifact; receipt is consumed transactionally by a distinct principal |
| `/api/v1/premium/admin/content/activate-template` | `premium_admin` | `{ sampleReportId, activationRequestId, reviewReceiptId, template }`, 512 KiB | 200 template; exact retry only |
| `/api/v1/premium/admin/content/retire` | `premium_admin` | `{ reportId, activation, reason }` | 200 `{ retired: true }` |

운영 FE는 `premium_system` 전용 모드를 제공하지 않는다. Discovery projection에는 내부 user ID·owner UID/안정 pseudonym·candidateId·analysisId·전체 binding·paymentKey/provider token·원문 provider state/error·생년월일·이름·암호문·claim token이 없다. 허용 필드는 운영용 order/entitlement/report ID, 상태, productId/contentVersion, 금액·통화·provider, bounded timestamp/due뿐이다. 목록 cursor는 생성/수정하지 말고 그대로 전달한다. 배포 전 `PREMIUM_ADMIN_DISCOVERY_CUTOVER_STATE`를 `prelaunch_empty_v1_verified` 또는 검증된 backfill 상태로 명시하지 않으면 조회는 503이다.

## 브라우저 호출 금지 endpoint

다음 경로는 `CRON_SECRET`을 사용하는 서버 간 유지보수 경계다. 관리자 쿠키/CSRF 경로가 아니며 FE bundle, network client, UI 문서에 secret을 넣으면 안 된다.

- `GET /api/internal/maintenance/auth`
- `GET /api/internal/maintenance/sync`
- `GET /api/internal/maintenance/premium`
- `GET /api/internal/maintenance/premium-expiry`

## FE 구현 체크리스트

- 권한 없는 메뉴는 숨기되, 403을 최종 권한 판정으로 처리한다.
- mutation 버튼은 처리 중 비활성화하고 동일 클릭 중복을 막는다.
- 202를 성공 완료처럼 표시하지 않고 `pending/reconciliation required` 상태로 남긴다.
- CSRF token, paymentKey, 내부 user/session ID, 전체 응답을 localStorage·analytics·오류 수집 payload에 남기지 않는다.
- cursor는 opaque 값처럼 취급하고 임의 생성·수정하지 않는다.
- 409는 최신 상태 재확인 후 사용자가 다시 판단하게 하며 무조건 자동 재시도하지 않는다.
- 429는 화면 단위 backoff를 적용한다. 서로 다른 관리자 endpoint의 rate 그룹이 공유될 수 있다.
- Firestore client SDK로 관리자 collection을 직접 읽지 않는다.
