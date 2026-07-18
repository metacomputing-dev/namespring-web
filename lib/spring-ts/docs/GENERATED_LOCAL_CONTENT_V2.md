# 로컬 생성 콘텐츠 경계 V2

## 왜 새 경계가 필요한가

기존 브라우저 호환 경로는 한 사람의 `strength.gyeokgukFamily.nameEffect.gender`를 파일명으로 만든 `/generated-packed/<category>/<packKey>.json`을 요청한다. 본문을 로컬에서 해석하더라도 이 URL은 CDN, 프록시, 브라우저 네트워크 로그에 신강약·격국군·이름 보완 방향·성별 축을 함께 남길 수 있다. 따라서 이 경로는 기존 FE 호환 전용이며 신규 FE의 로컬 mock 콘텐츠 경계로 사용하지 않는다.

V2 빌드 도구는 URL을 다음 형태로 제한한다.

```text
generated-local-v2/manifest.json
generated-local-v2/<category>/<period>.json
```

`audience`, `band`, `strength`, `gyeokgukFamily`, `nameEffect`, `gender`는 category+period shard 내부의 `classId`에만 존재한다. 같은 category+period 화면을 연 모든 사용자는 같은 URL을 요청하므로 CDN 요청 로그만으로 개인의 해당 축을 구분할 수 없다. category와 period 자체는 이용 메뉴를 드러낼 수 있으므로 CDN 로그 최소화·보존기간·접근권한은 별도로 관리한다.

## 현재 상태와 권위

이 도구는 향후 신규 FE/Worker/IndexedDB 연동을 위한 backend build-tool 준비물이다. 기존 registry, 기존 FE, `/generated-packed/`를 변경하지 않는다. 산출 manifest는 항상 다음을 고정한다.

- `contentStatus: development_mock_replace_before_release`
- `releaseAuthority: false`
- `qualityGateAuthority: false`
- `privacyBoundary.selectionIndependentUrl: true`
- `privacyBoundary.legacyPersonAxisUrlsForbidden: true`

즉 현재 21,060개 JSON이 개발 중 실제 데이터처럼 유용하더라도, 이 포장은 사람 검수·출시 승인을 대신하지 않는다. 정식 corpus는 검토 완료 뒤 별도 버전 계약으로 교체한다.

## 생성과 검증

55 MiB 산출물은 커밋하지 않는다. 원하는 임시/배포 준비 디렉터리를 명시해 생성한다.

```bash
npm run pack:generated-local-v2 -- --out <output-directory>
npm run validate:generated-local-v2 -- --validate <output-directory>
npm run test:generated-local-v2-pack
# 현재 21,060건까지 전수 재확인할 때만 수동 실행(CI 기본은 작은 fixture)
FULL_GENERATED_LOCAL_V2_AUDIT=1 npm run test:generated-local-v2-pack
```

도구는 기본적으로 `data/generated`를 읽고, 함께 있는 `data/generation/manifest/index.json`의 전체·카테고리별 개수와 대조한다. 각 원본의 파일명, 8개 class 축, article identity, `caseAxes`, 필수 본문 배열을 검증한다. 입력 순서와 JSON 객체 키 순서에 무관한 canonical JSON, corpus SHA-256, shard SHA-256/bytes/count를 만들며 임시 디렉터리에서 전수 재검증한 뒤 원자적으로 설치한다. 원본 한 파일은 1 MiB, category+period 출력 shard는 실제 inventory에 여유를 둔 4 MiB에서 실패 폐쇄한다. 기존 출력 교체에는 `--replace`를 명시해야 한다.

### 2026-07-19 실제 corpus 전수 확인

현재 `data/generated` 21,060건을 임시 디렉터리에 실제로 빌드하고 별도 validation pass까지 수행했다. generation manifest의 전체·11개 카테고리별 개수와 모두 일치했고, 55개 category+period shard, manifest 포함 55,601,511 bytes가 생성됐다. 가장 큰 파일은 `family/life.json` 1,908,113 bytes, 가장 작은 파일은 `wealth/today.json` 604,987 bytes였으며 4 MiB 상한 안이다. CLI 프로세스 전체 wall time은 build 7.862초, 독립 validate 2.734초였고, 같은 최종 코드의 opt-in test에서 측정 구간만 보면 build 5.837초, validate 1.500초(전수 test 7.372초)였다. canonical corpus digest는 `sha256:d5350fd0ef11108fa4a372a9785f5de53e035073d80aa82381bad455032be364`였다. 임시 55 MiB 산출물은 확인 직후 삭제했고 저장소에는 도구·fixture test·문서만 남겼다. 이 수치는 압축 전 Node 특성치이며 모바일 parse/heap SLA가 아니다.

## 신규 FE 연결 원칙

1. 앱/Worker는 `manifest.json`을 한 번 읽고 사용자가 선택한 category+period shard만 지연 로드한다.
2. 선택한 사람의 `classId` 계산과 shard 내부 조회는 기기 안에서만 수행한다. classId, 이름, 출생정보를 URL·query string·헤더·telemetry에 넣지 않는다.
3. 웹은 Cache Storage/IndexedDB에 digest 기준으로 보관하고, 네이티브 앱은 같은 디렉터리를 설치 자산으로 포함할 수 있다.
4. category+period shard는 기존 person pack보다 크므로 홈에서 전부 preload하지 않는다. 실제 압축 전송량과 최소 지원 기기 parse/heap을 측정한 뒤 한 번에 활성화할 카테고리 수를 확정한다.
5. shard 부재·digest 불일치·parse 실패는 base article 또는 명시적 unavailable로 처리하고, 다른 개인 축을 중립값으로 조용히 대체하지 않는다.

이 구조는 URL 축 노출을 제거하지만 콘텐츠 자체의 암호화를 뜻하지 않는다. 정적 mock 문구는 공개 자산으로 간주하며, 사용자 입력·유료 본문·권한 정보는 이 corpus에 절대 넣지 않는다.
