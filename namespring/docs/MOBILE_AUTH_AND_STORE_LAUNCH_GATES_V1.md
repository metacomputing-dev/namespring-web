# 모바일 인증·스토어 출시 게이트 v1

- 계약 ID: `namespring.mobile-auth-store-gates.v1`
- 기준일: 2026-07-19
- 목적: 로그인 공급자가 늘어나도 하나의 내부 사용자 ID, 무료 로컬 경계,
  계정 삭제 및 권한 모델이 흔들리지 않게 한다.

## 제품 원칙

1. 사주·성명학·통합 분석, 작명 후보 탐색, 입력 기억과 로컬 즐겨찾기는
   로그인 없이 기기에서 동작한다.
2. 계정은 동기화, 결제, 구매 복원, 여러 기기 즐겨찾기처럼 계정이 실제로
   필요한 순간에만 제안한다.
3. 모든 공급자는 Firebase principal에서 검증한 뒤 서버 내부 UUIDv4 계정으로
   수렴한다. 이메일 문자열이나 전화번호가 같다는 이유만으로 계정을 합치지
   않는다.
4. 브라우저는 Firebase ID token을 장기 보관하지 않는다. 서버 교환 뒤
   `__Host-namespring_session` HttpOnly 쿠키를 사용하고, 모든 변경 요청은 정확한
   Origin과 double-submit CSRF 검증을 거친다.
5. 관리 역할은 계정 저장소와 현재 Firebase custom claim에 동시에 있어야만
   유효하다. 일반 브라우저용 역할 부여 API는 두지 않는다.

## 출시 순서

| 단계 | 공급자 | 상태 | 출시 전 필수 증거 |
|---|---|---|---|
| 1 | Google | 우선 | 웹·Android·iOS redirect/번들 ID, 계정 연결 충돌, 탈퇴 후 재로그인 검증 |
| 1 | Kakao OIDC | 우선 | Firebase Authentication with Identity Platform, 정확한 issuer/client 설정, 플랫폼별 redirect, 탈퇴·연결해제 검증 |
| 1 | 이메일 링크 | 우선 | 허용 도메인, 링크 만료·재사용·다른 기기 복귀, 계정 열거 방지 문구 검증 |
| iOS 후속 | Apple | revocation adapter 부재, hard-disabled | Sign in with Apple 설정, private-email relay, 서버측 credential 보관·토큰 철회·알림·계정 삭제 리허설 |
| 후속 | 전화번호 | step-up 전용 후보 | SIM-swap·비용·abuse rate limit·복구 정책 검토 전 로그인 공급자로 활성화 금지 |
| 후속 | Facebook/기타 OIDC | 비활성 | 공급자별 console, issuer/audience, 연결·철회·탈퇴 정책 검토 |

`AUTH_ENABLED_PROVIDERS`는 실제로 검증을 마친 공급자만 포함한다. 공급자 console을
켰다는 사실만으로 서버 allowlist에 넣지 않는다. Kakao 같은 일반 OIDC 공급자는
Firebase Authentication with Identity Platform이 필요하며, 권장 auth-code 흐름의
client secret은 클라이언트 번들에 들어가면 안 된다.
Kakao를 켤 때는 Firebase console의 정확한 provider ID를
`AUTH_KAKAO_FIREBASE_PROVIDER_ID`에도 고정한다. 서버는 이름에 `kakao`가 포함됐다는
이유로 공급자를 추정하지 않는다. 후속 일반 OIDC도
`AUTH_GENERIC_OIDC_FIREBASE_PROVIDER_IDS`의 정확한 ID allowlist만 받으며, 기존
binding이 있는 상태에서 ID를 바꾸려면 쓰기 동결 마이그레이션이 선행되어야 한다.

현재 코드는 `AUTH_ENABLED_PROVIDERS`에 `apple`을 넣어도 명시적으로 거부한다.
`GET /api/auth/policy`도 Apple을 `providerReady`가 아니라
`disabledUntilLifecycleAdapter`로 노출한다. Apple-only 계정은 동기화·결제 복구의
primary provider로 보지 않는다. Apple 세션 생성·연결·연결해제는 서버가 인증
credential을 안전하게 보관·철회하고 credential-revoked 알림을 처리하는 adapter를
갖출 때까지 실패 폐쇄한다.

## 앱스토어·플레이스토어 경계

- Apple은 계정 기반 기능이 핵심이 아닌 앱이 로그인 없이 사용 가능해야 한다는
  원칙과, 계정을 만들 수 있으면 앱 안에서 삭제할 수 있어야 한다는 원칙을 둔다.
  또한 기본 계정에 제3자·소셜 로그인을 쓰는 앱은 심사 지침의 동등 로그인 선택지
  조건을 충족해야 한다. 따라서 iOS 출시에는 Apple 로그인을 함께 준비하고,
  Apple 토큰 철회가 끝나기 전에는 해당 공급자를 활성화하지 않는다.
- Google Play는 앱 안에서 계정을 만들 수 있으면 앱 안 삭제 경로와 앱 밖에서
  접근 가능한 삭제 요청 웹 링크를 모두 요구한다. 무료 기능이 무로그인이어도
  일부 기능에 계정 생성이 있으면 이 요구가 적용된다.
- 법률·환불·조세 의무로 일부 결제 기록을 보존할 때는 계정과 연결되는 불필요한
  데이터를 제거하고, 보존 대상·기간·이유를 개인정보 처리방침과 삭제 화면에
  명확히 알린다.

### 디지털 보고서 결제 채널

`이야기 완성하기`는 앱 안에서 소비하는 디지털 콘텐츠다. 모바일 웹/PWA에서는
Toss 웹 결제를 사용할 수 있지만, App Store 또는 Google Play로 배포한 네이티브
앱 안에서 판매할 때는 원칙적으로 각 스토어의 인앱 결제 정책을 따라야 한다.
대한민국 등 일부 지역의 외부·대체 결제 프로그램은 자동 예외가 아니며, 별도
등록·entitlement·표시·거래 보고 조건을 모두 충족한 경우에만 적용한다.

따라서 권리 모델은 `Toss 결제 = 권리`로 만들지 않는다. 서버의 canonical product,
내부 사용자 UUID, report binding, content activation, entitlement가 중심이고,
Toss web·Apple StoreKit·Google Play Billing은 각각 검증 가능한 구매 증거를 그
권리에 연결하는 공급자 adapter다. 현재 구현된 Toss 경로는 **웹 채널 전용**으로
간주한다. 네이티브 앱 구매 버튼을 켜기 전에는 다음이 추가로 필요하다.

- Apple: StoreKit 거래 검증, App Store Server Notifications V2, 환불·철회,
  구매 복원과 sandbox/TestFlight 증거
- Google Play: Play Billing 거래 검증·acknowledgement, Real-time Developer
  Notifications, 환불·철회, 구매 복원과 license tester 증거
- 모든 채널: 동일 provider transaction의 전역 멱등성, 계정/상품/environment
  바인딩, 서버 검증 전 entitlement 금지, 공급자 상태가 애매할 때 실패 폐쇄

현재 백엔드의 `POST /api/auth/delete`는 앱 안 삭제의 서버 경계다. 신규 FE는 계정
설정에서 이를 숨기지 않고 제공해야 한다. 공개 웹 삭제 요청 경로, 스토어 등록용
URL, 공급자별 토큰 철회 증거는 배포 자산이므로 실제 staging/production 설정과
함께 별도 출시 게이트로 확인한다.

## 관리자 역할 운영

Firebase 공식 계약상 custom claim은 신뢰된 서버 환경에서 Admin SDK로만 설정한다.
claim은 새 ID token이 발급될 때 반영되므로 역할 변경 뒤 모든 관련 Firebase UID의
refresh token을 철회하고 재로그인을 요구한다.

역할 부여는 다음 순서로 실패 폐쇄한다.

1. 대상 내부 계정과 연결된 Firebase UID 집합, 현재 저장 역할, 현재 claims를 읽고
   작업 계획과 idempotency request ID를 만든다.
2. **부여**는 모든 UID의 claims를 먼저 갱신하고 token을 철회한 뒤 마지막에 저장
   계정 역할을 갱신한다. 중간 실패 시 claims만으로는 권한을 얻지 못한다.
3. **회수**는 저장 계정 역할을 먼저 제거한 뒤 UID claims를 제거하고 token을
   철회한다. 중간 실패해도 서버의 이중 검증이 즉시 접근을 막는다.
4. 원시 UID, 이메일, provider subject를 일반 로그에 남기지 않는다. 작업자,
   대상, 전후 역할, request ID는 전용 키로 가명화한 감사 receipt에 남긴다.
5. 두 명이 승인해야 하는 최고 권한 부여, 긴급 회수, 부분 실패 재개 절차를
   staging에서 리허설하기 전에는 운영 역할을 셀프서비스화하지 않는다.

## 출시 차단 체크리스트

- [ ] 선택한 공급자별 실제 기기 로그인·로그아웃·재로그인·연결·충돌 복구
- [ ] 익명 로컬 상태에서 계정 전환 뒤 즐겨찾기 동기화의 명시적 동의
- [ ] 앱 안 계정 삭제 및 외부 웹 삭제 요청 경로
- [ ] 삭제 중 결제 lease, 환불, 법정 보존 자료의 실패 폐쇄 리허설
- [ ] Apple 활성화 전 credential 안전 보관·provider token 철회·revoked 알림·private-email relay adapter
- [ ] 관리자 역할 부여·회수의 이중 검증, 세션 철회, 감사 receipt
- [ ] Firebase rules/indexes/TTL, exact allowed origins, secret separation 배포
- [ ] Toss sandbox와 Firebase staging에서 계정 삭제 전후 구매 복원·환불
- [ ] 네이티브 판매 시 Apple/Google 구매 검증·서버 알림·복원·환불 adapter
- [ ] 스토어 개인정보·Data safety·보존 설명이 실제 코드 동작과 일치

## 공식 근거

- Firebase custom claims:
  <https://firebase.google.com/docs/auth/admin/custom-claims>
- Firebase OIDC web authentication:
  <https://firebase.google.com/docs/auth/web/openid-connect>
- Apple App Review Guidelines:
  <https://developer.apple.com/app-store/review/guidelines/>
- Apple account deletion/token revocation:
  <https://developer.apple.com/documentation/technotes/tn3194-handling-account-deletions-and-revoking-tokens-for-sign-in-with-apple>
- Firebase Apple web token revocation:
  <https://firebase.google.com/docs/auth/web/apple#token_revocation>
- Google Play account deletion requirements:
  <https://support.google.com/googleplay/android-developer/answer/13327111>
- Apple In-App Purchase:
  <https://developer.apple.com/in-app-purchase/>
- Apple App Store Server Notifications:
  <https://developer.apple.com/documentation/AppStoreServerNotifications>
- Google Play payments policy:
  <https://support.google.com/googleplay/android-developer/answer/9858738>
- Google Play Billing:
  <https://developer.android.com/google/play/billing>
