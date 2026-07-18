# 신뢰 실행형 계정 역할 프로비저닝 v1

이 절차는 브라우저 API가 아니다. 무료 로컬 사용, 일반 로그인 UI, 관리자
브라우저 화면 어디에도 역할 부여 endpoint를 추가하지 않는다. 운영자가
신뢰된 셸에서 작은 CLI를 실행할 때만 `admin` 또는 `premium_admin`을
부여·회수한다. 모든 Firebase UID는 하나의 내부 계정 역할과 함께 갱신된다.

`premium_system`은 사람/Firebase 계정 역할이 아니다. 서비스 내부 actor와
계정 역할 모델을 분리한다. 기존 사람 계정의 persisted roles 또는 custom
claims에서 `premium_system`이 발견되면 일반 작업은 중단된다. 이 CLI는
마이그레이션을 위한 명시적 `revoke premium_system`만 허용하며 grant는 항상
거절한다. 기준 역할 `user`도 부여·회수할 수 없다.

## 배포 전 준비

1. `AUTH_ROLE_PROVISIONING_HMAC_KEY`에 독립적으로 생성한 32~256 UTF-8 byte
   값을 설정한다. auth audit, rate limit, sync, cron, Toss, content, premium
   및 Firebase credential과 재사용하면 중앙 secret separation gate가 실행
   전에 실패한다.
2. Firestore rules와 indexes를 배포한다. `authRoleProvisioningReceiptsV1`의
   `deleteAfter` TTL을 실제 프로젝트에서 확인한다. 완료 receipt의 보존 기간은
   365일이다. unresolved receipt는 자동 삭제하지 않는다.
3. Firebase Admin credential을 trusted workstation/CI secret store에서만
   제공한다. 셸 history와 CI 로그에 Firebase UID나 operator reference를 남기지
   않으려면 아래 임시 환경 변수를 사용하고 실행 직후 지운다.

## 실행

PowerShell 예시다. request ID는 같은 작업의 dry-run, apply, 장애 재실행에서
절대 바꾸지 않는다.

```powershell
$env:AUTH_ROLE_PROVISIONING_REQUEST_ID = "role_request_v1_$([guid]::NewGuid().ToString('N'))"
$env:AUTH_ROLE_PROVISIONING_TARGET_FIREBASE_UID = "<target Firebase UID>"
$env:AUTH_ROLE_PROVISIONING_OPERATOR_REF = "<non-PII operator reference>"

# 기본은 read-only dry-run이다.
npm run auth:role -- --operation grant --role admin

# target/operator HMAC, before/after roles, stage만 검토한 뒤 명시적으로 적용한다.
npm run auth:role -- --operation grant --role admin --confirm APPLY
```

회수는 `--operation revoke`를 사용한다. 잘못 들어간 시스템 역할을 정리할 때만
다음 emergency migration을 실행한다.

```powershell
npm run auth:role -- --operation revoke --role premium_system
npm run auth:role -- --operation revoke --role premium_system --confirm APPLY
```

종료 후 raw 입력을 지운다.

```powershell
Remove-Item Env:AUTH_ROLE_PROVISIONING_REQUEST_ID -ErrorAction SilentlyContinue
Remove-Item Env:AUTH_ROLE_PROVISIONING_TARGET_FIREBASE_UID -ErrorAction SilentlyContinue
Remove-Item Env:AUTH_ROLE_PROVISIONING_OPERATOR_REF -ErrorAction SilentlyContinue
```

## 순서와 장애 복구

- grant: 모든 UID의 기존 custom claims를 보존한 채 역할을 추가하고 readback
  검증 → 모든 refresh token 회수 → persisted account role을 마지막에 추가한다.
  중간 실패 시 dual authorization 때문에 권한이 유효해지지 않는다.
- revoke: persisted account role을 먼저 제거 → 모든 UID custom claims 제거와
  readback 검증 → 모든 refresh token 회수 순서다. 중간 실패해도 권한은 즉시
  fail-closed다.
- 부분 실패는 같은 request ID, target, operator, operation, role로 다시 실행한다.
  다른 material로 request ID를 재사용하면 거절된다. target별 durable anchor와
  fenced lease가 동시 실행 및 충돌 작업을 막는다. 프로세스 강제 종료로 lease가
  남으면 최대 2분 뒤 같은 request ID로 takeover한다.
- 다른 request ID가 pending anchor에 막히면 새 작업으로 우회하지 않는다. 원래
  request ID로 복구·완료한 뒤 진행한다.

CLI의 stdout/receipt에는 raw Firebase UID, 내부 user ID, operator reference,
session ID, token, custom claims가 포함되지 않는다. HMAC pseudonym, request ID,
operation/role, before/after roles, stage/status, TTL timestamp만 남는다. Firebase
오류도 raw upstream message 대신 안정적인 오류 코드로 축약된다.

## 검증 체크리스트

- dry-run 전후 Firestore/Firebase에 쓰기가 없는지 확인
- apply 후 모든 연결 UID의 claims와 token revocation 확인
- 새 ID token으로 persisted role과 claim의 교집합만 유효한지 확인
- receipt TTL 정책이 365일인지 확인
- `test/backend/admin-api-contract.test.ts`의 브라우저 관리자 route inventory에
  역할 provisioning route가 추가되지 않았는지 확인
