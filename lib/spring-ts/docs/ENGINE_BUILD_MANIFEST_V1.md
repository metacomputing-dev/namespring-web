# Engine build-input manifest V1

`namespring.engine-build-input-manifest.v1`은 `ReportDeliveryV1`를 만드는
추적 가능한 build input의 **artifact identity**다. 이 digest는 명리 판단의
정확성, 전통 문헌의 권위, 특정 요청의 실행 재현성 또는 전문가 검수를
증명하지 않는다.

## 산출물

- 전체 manifest: `manifests/engine-build-input-manifest.v1.json`
- 모바일 런타임 상수: `src/engine-build-identity.generated.ts`
- 생성·검사 도구: `tools/engine-build-manifest.mjs`

```bash
npm run generate:engine-manifest
npm run check:engine-manifest
npm run test:engine-manifest
```

도구는 경로를 POSIX repository-relative 형식으로 정렬하고 각 파일의 raw
bytes에 SHA-256을 계산한다. category별 digest와 aggregate digest는 domain,
category, path, byte length, file digest를 NUL/LF로 구분해 다시 SHA-256한다.
시각이나 Git commit ID는 입력하지 않으므로 같은 파일 집합은 같은 결과를
낸다. `--check`는 전체 JSON과 compact TypeScript 상수가 정확히 일치하지
않으면 실패한다. `test:saju-engine-release`는 긴 회귀 묶음보다 먼저
`test:engine-manifest`를 실행해 stale manifest를 fail-fast한다. 일반
`test:report-delivery`는 로컬 반복 개발 때 전체 입력을 재해시하지 않는다.

## 선언된 범위

Manifest의 `scope.declarations`가 기계 판독 가능한 정본이다. 현재 범위는
다음을 포함한다.

- `spring-ts`, `saju-ts`, `seed-ts`의 runtime TypeScript source. 테스트와
  seed DB 생성 전용 utility는 제외한다.
- 세 패키지의 `package.json`/`package-lock.json` dependency resolution input과
  runtime build를 좌우하는 기본/빌드용 `tsconfig`.
- Spring scoring/config preset JSON과 saju school pack JSON.
- `ReportDeliveryV1`가 lazy-load하는 article 및 glossary shard 전체.
- 이름 추세·Unihan·인명용 한자·성씨·고전 어휘 등 runtime static data.
- `hanja.db`, `fourframe.db`, name-stat summary, sql.js WASM의 실제 bytes.

Source 범위는 보수적 superset이므로 특정 요청에서 실행되지 않는 파일의
변경도 digest를 회전시킬 수 있다. 이것은 누락 위험을 낮추기 위한 의도된
trade-off다.

## 의도적 비범위

- `data/generated/**`: 기존 FortuneReport용 legacy pack이며
  `ReportDeliveryV1` import/bundle boundary가 접근을 금지한다.
- `dist/**`: source-controlled build input이 아닌 compiler output이다.
- 사용자 입력, 현재 시각, Node/브라우저 구현, 환경 변수, 원격 KASI 응답,
  네트워크 응답: manifest는 실행 transcript가 아니다.
- 품질 gate 통과, 인간 전문가 검수, 명리학적 옳음: 별도 품질 계약이다.

새 runtime loader나 asset 경로를 추가할 때는 이 범위를 함께 확장해야 한다.
비범위가 필요한 경우에는 import/bundle boundary로 실제 비접근성을 증명하고
manifest 문서에 이유를 남긴다.

## Delivery provenance

`ReportDeliveryV1.provenance`는 다음을 노출한다.

- `artifactIdentity.digest`: 전체 선언 범위 digest.
- `versions.ruleset`: runtime code와 rule input을 합친 보수적 digest.
- `versions.data`: 선언된 runtime data digest.
- `artifactIdentity.authority = build-time-artifact-identity-only`.
- `artifactIdentity.correctnessAuthority = false`.

Validator는 현재 compact 상수와 정확히 같은 digest만 허용한다. 런타임은
파일별 record를 담은 전체 manifest나 Node hashing code를 import하지 않고
1 KiB 이하의 상수만 읽는다. 따라서 모바일 보고서 생성 때문에 대형 asset을
추가로 해시하거나 file list를 초기 bundle에 넣지 않는다.

## Paid server asset gate

Paid server adapter는 engine 생성 시 다음 실제 파일을 module cold-start당
경로별 한 번 SHA-256 검증한다.

- `namespring/public/data/hanja.db`
- `namespring/public/data/fourframe.db`
- `lib/spring-ts/data/name-stat/name-stat-summary.v1.bin`
- `lib/seed-ts/assets/sql-wasm-1.14.1.wasm`

환경 변수나 함수 인자로 다른 경로를 지정해도 canonical digest와 byte-for-byte
동일해야 한다. 경로만 존재하고 bytes가 다르면 engine을 만들기 전에
fail-closed한다. Repository 자체의 DB schema/hash 검증도 그대로 남아 있어
초기 검사 이후 파일 교체와 TOCTOU에 대한 두 번째 방어선 역할을 한다.
