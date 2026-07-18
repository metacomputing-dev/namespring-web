# 모바일 로컬 계산 성능 계약 V1

## 결론

신규 프론트엔드의 무료 사주·성명학·작명·통합 계산은 서버가 아니라 기기 안에서 끝난다. 그러나 `SpringEngine`을 브라우저 UI 메인 스레드에서 직접 실행해서는 안 된다. 최초 사주 모듈 해석과 후보 풀 계산은 데스크톱 Node 특성 측정에서도 한 프레임 예산을 크게 넘었다. 따라서 프로덕션 신규 FE는 다음 구조를 출시 필수조건으로 사용한다.

```text
UI main thread
  -> requestId가 있는 작은 DTO
  -> 장수 Dedicated Worker 또는 동등한 네이티브 background runtime
       -> SpringEngine 1개
       -> Hanja/Fourframe/NameStat 로컬 자산
       -> getCandidateSearch() / getReportDelivery()
  <- requestId + 공개 응답 DTO
```

Worker를 사용할 수 없는 환경에서는 UI 스레드에서 조용히 무거운 계산을 실행하지 않는다. 지원 불가 또는 제한 모드를 명시적으로 보여주고 입력값을 보존한 채 복구할 수 있어야 한다. 이 요구는 무료 계산을 서버로 우회해도 된다는 뜻이 아니다.

## 필수 런타임 규칙

- 하나의 활성 로컬 프로필에는 장수 Worker와 `SpringEngine` 인스턴스 하나를 둔다. 후보 첫 페이지와 다음 페이지가 같은 세션 스냅샷을 사용하도록 Worker를 페이지마다 재생성하지 않는다.
- 모든 메시지에 UI가 만든 단조 증가 `requestId`를 붙인다. 새 요청 뒤 늦게 도착한 응답은 UI가 폐기한다. `queryId`는 엔진 후보 스냅샷 전용이며 URL, 쿠키, 분석 영속 ID 또는 유료 권한으로 사용하지 않는다.
- `close()`는 Worker 종료, 로컬 프로필 변경, 로그아웃 후 개인 로컬 상태 삭제, 전체 데이터 초기화에서 호출한다. 탭 전환이나 단일 요청 무시를 위해 매번 호출하지 않는다. `close()`는 진행 중 operation과 4개 LRU 후보 스냅샷, 이름 통계 캐시, 저장소 자원을 함께 무효화한다.
- 계산 중 UI 취소는 우선 stale-response 폐기로 처리한다. 즉시 메모리 폐기가 필요할 때만 Worker 자체를 종료하고 새 Worker를 만든다.
- 후보 필터는 128개, 후보의 무거운 평가 구간은 16개마다 `scheduler.yield()` 또는 timer turn으로 양보한다. 이 양보는 점수, 정렬, `rank`, `candidateId`, 의미 결과를 바꾸지 않으며 Worker 내부 취소·메시지 처리 지연을 제한하기 위한 것이다.
- Worker 메시지와 로그에는 생년월일, 이름, 한자, 원문 보고서를 남기지 않는다. 성능 telemetry가 필요하면 구간명, 익명 버전, 소요시간, 바이트, 성공/오류 코드만 수집하고 별도 동의를 적용한다.

## 로딩·선행 준비 경계

신규 FE의 홈/LCP 코드는 Vite alias의 경량 공개 진입점만 사용한다.

```ts
import {
  LOCAL_HOME_CAPABILITIES_V1,
  buildLocalBirthPreviewV1,
} from '@spring/experience/local-device-entry';
```

`@spring` 루트와 `@spring/experience/local-menu`는 기존 소비자 호환 및 사용자가
분석·한자 검색에 진입한 뒤의 지연 로딩용이다. 이 두 경로를 홈/LCP에서 import하면
bundler의 shared chunk 최적화 때문에 `SpringEngine` 또는 SQL 저장소 그래프가 초기
정적 그래프에 다시 합쳐질 수 있으므로 금지한다. 자동 경계 테스트는 entry output뿐
아니라 모든 transitive static import를 재귀 추적하고, 사용자 의도 뒤에만 실행되는
literal dynamic import chunk는 초기 그래프에서 명시적으로 제외한다. 현재 예산은
minified initial static graph 48 KiB raw / 16 KiB gzip 이하이며 엔진·SQL·Hanja·
Fourframe·NameStat 저장소와 saju 구현 입력은 0개다.

| 사용자 상태 | 허용되는 준비 | 금지되는 준비 |
| --- | --- | --- |
| 홈 | `LocalHomeSummaryV1`, 작은 Worker bootstrap의 유휴 다운로드 | Hanja/Fourframe/NameStat DB 열기, 사주 계산, 모든 기간 기사, 원격 생성 번들 |
| 사주 화면 진입 의도 | Worker 생성과 사주 코드 chunk 로드 | 가짜 생년월일로 예비 계산, 서버 전송 |
| 이름·작명 화면 진입 의도 | Worker 생성, Hanja/Fourframe 초기화; NameStat은 실제 후보 검색 시 lazy load | 홈에서 3개 DB 선적재, 후보 전수 사전 계산 |
| 통합 화면 진입 의도 | 선택한 surface와 기간·카테고리만 계산 | 네 기간 전체, life/대운 전체, unselected 기사·용어집 |
| 유료 진입 명시 | 서버 카탈로그·등록·결제·권한 API | 무료 탐색 중 유료 본문·권한·개인 분석 선요청 |

개발 mock 생성 콘텐츠를 연결할 때도 개인의 강약·격국·이름효과·성별이 정적 asset URL에 들어가면 로컬 우선의 개인정보 경계가 깨진다. 신규 FE는 `GENERATED_LOCAL_CONTENT_V2.md`의 category+period URL만 사용하고, 해당 shard 내부 class 선택을 Worker에서 수행한다. shard가 기존 person pack보다 크므로 선택한 category+period만 읽고 홈·초기 통합 화면에서 55 MiB corpus 전체를 preload하지 않는다.

현재 공개 API에는 사용자 데이터 없이 사주 모듈만 준비하는 전용 메서드가 없다. 따라서 가짜 요청을 만들어 prewarm하지 않는다. 신규 FE는 먼저 Worker 분리로 UI 정지를 제거한다. 추후 `prepare(capabilities)` 같은 명시적이고 취소 가능한 API를 추가할 때에만 route intent 뒤 idle prewarm을 허용한다.

## 후보 검색의 시간·메모리 상한

- 자동 작명은 현재 1~2음절만 허용한다. 3~4음절 자동 추천은 DB 조회와 후보 생성 전에 실패하며, 사용자가 확정한 3~4음절 이름의 분석은 별도 경로로 지원한다.
- 첫 페이지는 결정론적 전체 순서를 한 번 계산하고 최대 500개 요약만 보관한다. 응답 페이지 기본값은 20개, 요청 상한은 100개다.
- 엔진은 후보 검색 스냅샷을 최대 4개만 LRU로 보관한다. 따라서 보관 가능한 요약의 이론상 상한은 엔진당 2,000개다.
- 다음 페이지는 동일 `queryId`의 스냅샷을 slice하며 저장소 조회나 재채점을 수행하지 않는다. `close()` 또는 LRU 축출 뒤에는 명시적으로 첫 페이지를 다시 요청한다.
- 501번째 후보는 look-ahead로 `truncated` 판단에만 쓰고 탐색 가능한 목록에는 보관하지 않는다.

## 측정 방법과 해석

```bash
npm run bench:mobile-local-contracts
```

`tools/bench-mobile-local-contracts.ts`는 네트워크를 금지하고 각 cold 표본을 별도 Node 프로세스에서 실행한다. warm 표본은 같은 엔진·모듈·DB를 재사용한다. delivery 3종, 1·2음절 후보 첫 페이지, 두 후보의 반복 pagination을 측정하며 다음 값을 기록한다.

- median/p95 wall time
- JSON 응답 바이트
- 명시적 GC 뒤 retained heap delta와 sampling peak
- 1ms timer의 최대 지연과 event-loop active time
- 실제 로컬 asset read 바이트와 repository operation 횟수
- volatile ID·시각을 제외한 semantic digest

시간과 heap 수치는 개발 호스트의 특성치이며 CI 합격선이나 모바일 SLA가 아니다. 머신 부하와 `tsx` 개발 로더 영향을 받는다. CI에서는 출력 바이트, 페이지 개수, digest 결정성, warm·pagination asset read 0회, pagination repository operation 0회, exact shard/import 경계처럼 안정적인 조건만 검사한다.

### 2026-07-19 기준 특성치

Windows x64, Node 22.18.0, i9-12900K, 128 GiB 호스트에서 cold 5회와 warm 9회를 측정했다. cold는 매 표본마다 새 프로세스를 사용하되 측정 구간은 benchmark bootstrap 이후 첫 API 호출부터다. `p95`는 표본 수가 작으므로 용량 산정용 상한이 아니라 비교 참고치다.

| 시나리오 | 상태 | median / p95 ms | median retained KiB | median sampled peak KiB | median max timer delay ms | payload KiB |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 이름 보고서 | cold | 128.86 / 133.49 | 1,467.16 | 7,371.16 | 54.54 | 21.83 |
| 이름 보고서 | warm | 11.98 / 14.08 | 125.35 | 2,889.96 | 8.63 | 21.83 |
| 사주 보고서 | cold | 900.08 / 914.78 | 6,735.16 | 22,543.70 | 676.74 | 6.27 |
| 사주 보고서 | warm | 42.32 / 56.45 | 194.03 | 3,098.21 | 38.54 | 6.27 |
| 통합 보고서 | cold | 1,183.80 / 1,202.15 | 17,543.75 | 35,332.05 | 685.48 | 10.23 |
| 통합 보고서 | warm | 59.72 / 67.33 | 337.25 | 4,220.27 | 54.14 | 10.23 |
| 1음절 후보 첫 페이지 | cold | 1,141.60 / 1,186.12 | 16,816.58 | 41,329.15 | 676.55 | 9.19 |
| 1음절 후보 첫 페이지 | warm | 173.57 / 190.35 | 241.99 | 7,913.84 | 151.67 | 9.19 |
| 2음절 후보 첫 페이지 | cold | 1,281.48 / 1,372.90 | 17,025.63 | 37,706.27 | 647.52 | 10.01 |
| 2음절 후보 첫 페이지 | warm | 395.86 / 425.29 | 296.05 | 16,978.47 | 155.14 | 10.01 |
| 1음절 pagination | cold | 1.14 / 1.20 | 42.25 | 143.52 | 11.23 | 1.31 |
| 1음절 pagination | warm | 0.92 / 1.27 | 23.95 | 129.82 | 12.85 | 1.31 |
| 2음절 pagination | cold | 1.15 / 1.30 | 33.13 | 145.30 | 11.27 | 1.35 |
| 2음절 pagination | warm | 0.87 / 1.30 | 27.50 | 136.11 | 12.75 | 1.35 |

최초 이름 보고서는 Hanja 376,832 bytes와 Fourframe 802,816 bytes를 읽었다. 최초 통합·후보 계산은 여기에 NameStat 310,611 bytes를 더 읽었다. 사주 전용 계산은 이름 DB를 읽지 않았다. 모든 warm 표본의 asset read는 0회였고 pagination은 asset read와 repository operation 모두 0회였다. 1음절 후보 cold는 NameStat 45건, 2음절은 618건을 조회했지만 warm 반복에서는 엔진 캐시로 NameStat repository 호출이 0회였다. 모든 반복과 독립 cold 프로세스에서 volatile ID·시각을 제외한 semantic digest가 같았다.

가장 중요한 관찰은 cold 사주·통합의 약 0.65~0.69초 timer 지연과 warm 후보 첫 페이지의 약 0.15초 timer 지연이다. 고성능 데스크톱의 값조차 UI 프레임 예산을 크게 넘으므로 미측정 모바일에서 메인 스레드 실행을 허용할 근거가 없다. Worker 분리는 출시 필수이며, yield 지점은 Worker 내부의 취소 응답성을 보완할 뿐 메인 스레드 직접 실행을 정당화하지 않는다.

## 출시 전 실기기 게이트

Node 특성 측정은 Worker 필요성을 드러내지만 실제 모바일 승인을 대신하지 않는다. 최소 지원 Android 저메모리 기기와 iOS 기기에서 프로덕션 번들로 다음을 별도 확정해야 한다.

1. 홈 LCP 동안 계산 DB와 사주·기사 chunk가 로드되지 않는지 확인한다.
2. Worker 최초 사주, 이름, 통합, 1·2음절 후보의 median/p95와 peak memory를 기록한다.
3. 빠른 연속 입력, route 이탈, Worker 종료, 프로필 변경에서 stale 응답과 개인정보 잔존이 없는지 확인한다.
4. 첫 페이지와 모든 pagination의 `candidateId`, `rank`, semantic digest가 데스크톱 fixture와 같은지 확인한다.
5. 메모리 압박·백그라운드 복귀 뒤 Worker 재생성과 명시적 재검색 UX를 확인한다.

실기기 예산은 이 자료를 얻은 뒤 제품 지원 기기 기준으로 별도 버전 관리한다. 측정 전 임의의 벽시계 수치를 CI에 고정하지 않는다.

## 확인된 상류 release blocker

2026-07-19 `npm run test:integration`은 `test:naming-score-vector`의 committed snapshot 불일치에서 중단됐다. 현재 브랜치와 clean detached `origin/main`(`bbca1dc26`)에서 실제 계산 JSON을 각각 독립 생성해 비교한 결과 SHA-256이 모두 `54f366e58fe76c7d6c33d57cddc0bf82f502711156d7eed5a134693fe4b70703`으로 정확히 같았다. 즉 신규 delivery·후보·성능 변경이 만든 회귀가 아니라 이미 `main`에 존재하는 stale baseline이다.

기준 파일은 갱신하지 않았다. 법적 한자 점수, 위험도, 사주 적합도와 최종 점수가 함께 달라진 상태이므로 전문가·권위 검토 없이 snapshot을 새 출력에 맞추면 안 된다. 이 gate가 명시적으로 판정되기 전에는 전체 통합 suite를 green으로 보고하거나 신규 백엔드 PR을 release-ready로 간주하지 않는다. 나머지 suite는 실패 지점 다음부터 별도로 계속 실행해 추가 회귀를 확인한다.
