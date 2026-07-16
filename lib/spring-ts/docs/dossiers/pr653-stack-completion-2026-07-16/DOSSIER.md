# PR #653 25개 스택 종결 dossier

> 상태: backend incremental merge 완료 준비
>
> 주의: 이 문서는 외부 명리 인증 또는 상용 release 승인서가 아니다.
>
> 작성일: 2026-07-16
>
> Stack 24 baseline: `5076f855192b1e1d06f836f781cd5e3182cc7684`
>
> Stack 25 runtime freeze: `6db3462deb2ffa89a9fb7299af3d3860fba4ed77`
>
> Stack 25 PR: #678

## 결론

기존 단일 WIP PR #653의 backend 변경은 25개 exact-parent 스택으로 분해해
순서대로 셀프 리뷰·수정·검증했다. Stack 01~24는 `main`에 병합됐고, Stack 25는
위 runtime freeze에서 전체 로컬 release suite와 default-change 검증을 통과했다.
`namespring/` frontend source diff는 0이다.

이번 종결은 유지보수성과 fail-closed 계약을 단계적으로 `main`에 전달할 수 있다는
판정이다. 테스트 통과는 회귀 부재의 증거이지 전문가급 명리 정확도 인증이 아니다.

## 스택 병합·검토 범위

- Stack 01~24: PR #654~#677을 exact-parent 순서로 `main`에 병합.
- Stack 25: PR #678에서 Saju package, Seed 공개 입력·오류, Spring PUA 경계를 종결.
- 원래 PR #653은 누적 변경의 추적용 기록이며 최종 merge 단위로 사용하지 않는다.
- 기존 Stack 25 계보 보존용 ancestry commit은 runtime freeze와 분리한다.
- 최종 PR head 및 `main` merge commit은 GitHub PR #678 기록을 정본으로 삼는다.

## Stack 25 변경 계약

### saju-ts 배포 계약

- build 전에 stale `dist`를 제거한다.
- JSON school asset을 build 산출물로 byte-identical 복사하고 누락 시 fail closed한다.
- 실제 `npm pack` tarball의 파일 allowlist를 검사해 stale·임의 파일 유입을 차단한다.
- 격리된 소비자에서 오프라인 설치, bare import, `createEngine`, preset load를 검증한다.
- JSON import attributes를 사용하는 현재 구현에 맞춰 Node 최소 버전을 `>=20.10.0`으로 고정한다.

### seed-ts 공개 입력·오류 계약

- 공개 오류에서 원본 `received`를 제거하고 동결된 `receivedSummary`만 제공한다.
- 빈 질의, 잘못된 enum·범위·limit를 SQLite/null/빈 결과로 흘리지 않고
  `REPOSITORY_QUERY_INVALID` 비재시도형 오류로 거부한다.
- 성 2자, 이름 4자, 뜻 512 code point, 부수 32 code point 상한을 적용한다.
- Energy shape와 점수·빈도 입력의 비유한값·범위 이탈을 fail closed한다.
- package·lock·README의 Node 최소 버전을 `>=20`으로 맞춘다.
- 정상 입력의 기존 산술 결과는 characterization test로 고정한다.

### spring-ts PUA 이름 해석 경계

- 일반 `Script=Han` 문자는 Seed Hanja repository 경로만 사용한다.
- PUA는 활성 전체 권위 pool에 실제 존재하고 요청 독음과 일치할 때만 허용한다.
- 잘못된 독음, 권위 pool 미가용, 임의 PUA 문자는 fail closed한다.
- 성씨 권위 실패는 repository lookup 전에 차단한다.

## 기본 동작 및 API 영향

### 명리 기본 판정

`origin/main`의 Stack 24 merge와 runtime freeze를 비교한 결과:

- canonical fixture 17/17 `UNCHANGED`
- `reviewRequired=0`, `regression=0`, `exactDiffCount=0`
- default-mode regression 0 diffs
- approval status `NOT_REQUIRED`
- impact fingerprint
  `sha256:8fdad9fac501e27fd99152ffc79a029f09c76828f917bb2a93baa322e059c9fd`
- exact-diff fingerprint
  `sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`

### snapshot에 잡히지 않는 공개 API 변화

다음은 명리 snapshot 무변과 별개의 의도적 fail-closed 변경이다.

- Seed 오류의 raw `received` 제거 및 `receivedSummary` 도입.
- 빈 문자열·잘못된 enum·범위·limit가 null·빈 배열·저수준 오류 대신 공개 query 오류가 됨.
- 성·이름·뜻·부수의 명시적 길이 상한 도입.
- Energy 및 score 입력의 비유한값·범위 이탈 거부.
- 최소 Node 버전: Seed `>=20`, Saju `>=20.10.0`.

소비자는 raw 입력을 오류 객체에서 읽지 말고 자체 request context를 사용해야 하며,
`REPOSITORY_QUERY_INVALID`를 수정 후 재요청해야 하는 client error로 처리해야 한다.

## 검증 증거

### saju-ts

- `npm run verify:release`: 62 files / 600 tests 통과.
- KASI 절기 24/24, `saju_master` 3/3, source·school 검증 통과.
- package contract 3/3: clean build, asset copy, 실제 tarball·격리 소비자 검증.

### seed-ts

- `npm test`: 전체 통과.
- sync contract 13/13, scoring 3/3, repository lifecycle 42/42, package 5/5.
- DB manifest 16 assets, NameStat 50,194 rows, DB·WASM·runtime URL·fourframe 계약 통과.
- 검증한 WASM snapshot과 실행 bytes가 분리되지 않도록 하는 TOCTOU 회귀 테스트 유지.

### spring-ts

- `npm run test:saju-engine-release`: 종료 코드 0.
- canonical snapshot 17/17, gyeokguk candidate 261, boundary 867,
  manseryeok oracle 453/453, compatibility 208 등 전체 release chain 통과.
- name resolver, surname authority, name input contract와 PUA 경계 테스트 통과.
- no-AI release scope, quality-gate contract, external-signoff fail-closed 테스트 통과.

### default-change 및 regression

- `node tools/measure_default_change.mjs --baseline origin/main --branch HEAD --json`
  결과 `UNCHANGED`, 17/17 동일.
- `node tools/measure_regression.mjs --baseline origin/main --branch HEAD`
  결과 0 diffs, PASS.

## 원격 CI 상태

GitHub Actions는 계정 billing lock 때문에 runner 배정 전에 종료되는 상태다.
관찰된 job은 `runner_id=0`, `steps=[]`이며 원격 Actions 성공 이력이 아니다.
따라서 위 증거는 로컬 exact commit 검증이다. PR #678의 Vercel 및 GitHub check 기록은
별도로 확인하되 Actions 실패를 코드 실패 또는 원격 성공으로 오표기하지 않는다.

## 남은 한계와 인증 경계

- 독립 명리 전문가의 exact-commit signoff가 없다.
- complete-D1 objective fixture는 0건이다. 각 fixture에는 7개 권위 truth field가 필요하다.
- 종격 authority 20건은 모두 pillar-only이고 birth-based eligible 사례는 0건이다.
- Spring은 여전히 `private: true` 내부 source module이며 독립 공개 package 계약 대상이 아니다.
- 복성 권위는 현재 공식 최소 6종을 다루며, 한자 없는 독음 181개 중 85개는 후보가 모호하다.
- 실제 배포 브라우저, 모바일 메모리, Linux case-sensitive filesystem smoke test가 없다.
- canonical snapshot의 후보 생성이 직렬로 약 120초 걸리는 성능 부채가 있다.
- 정책 계수와 일부 격국·조후·신살 판정은 authority holdout 및 전문가 재가 전 provisional이다.

## 후속 상용화 개선 우선순위

1. 후보 생성에 계산 예산·top-K 경계를 도입하고 benchmark로 정확도·지연·메모리를 함께 고정.
2. complete-D1 authority corpus와 birth-based 종격 사례를 독립 출처·전문가 판결로 확충.
3. 배포 브라우저·모바일·Linux package smoke test를 자동화.
4. backend hotspot을 책임 단위로 분해하되 characterization과 default-change gate를 유지.
5. 공개 API migration guide와 Spring 독립 package 경계를 제품 요구에 맞춰 결정.

## 재현 명령

    cd lib/saju-ts
    npm run verify:release

    cd ../seed-ts
    npm test

    cd ../spring-ts
    npm run test:saju-engine-release
    node tools/measure_default_change.mjs --baseline origin/main --branch HEAD --json
    node tools/measure_regression.mjs --baseline origin/main --branch HEAD

재현은 runtime freeze 또는 그 tree를 그대로 보존한 Stack 25 head에서 수행한다.
