# 이름 통합 보고서 — UI/UX 시제품

`기획안/07-이름통합보고서-작명앱-콘텐츠-기획안.md`의 8섹션 IA를 화면으로 확인하기 위한 껍데기(shell)입니다.
엔진·앱 코드와 완전히 분리되어 있으며, 목업 데이터로만 동작합니다.

## 실행

빌드가 필요 없습니다. 두 가지 방법 중 하나로 열면 됩니다.

```bash
# 1) 파일을 브라우저로 바로 열기 (더블클릭)
prototype/name-report/index.html

# 2) 로컬 서버 (권장 — 모바일 기기 테스트 시)
npx serve prototype/name-report
```

인터넷 연결이 필요합니다(Tailwind·Pretendard·Iconify CDN, SRI 고정).

## 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 사용자 정보 입력 — 3단계 스테퍼(이름 → 태어난 순간 → 확인). 글자별 한자 선택 창, "시간을 몰라요", 고급 옵션 접힘 |
| `report.html` | 이름 통합 보고서 — 기획안 07의 8섹션 + 평문/전문가 토글 |
| `assets/mock-data.js` | 목업 케이스 2종. 문장은 name-evidence 파이프라인의 실제 조립 리포트에서 가져옴 |
| `assets/hanja-data.js` | 실제 `hanja.db`에서 추출한 인명용 한자 4,849자(음 432개) — 뜻·원획·자원오행·성씨 여부 |
| `assets/vendor/` | Tailwind·Iconify 로컬 사본 (CDN CORS 문제 회피) |

## 목업 케이스

| 케이스 | 이름 작용 | 확인 포인트 |
|---|---|---|
| 천민아 | boost_strong | 정면 보강 서사, 공유 CTA |
| 천야장 | adverse | 낙인 없는 아쉬움 서사, 추천 유도 CTA |

- 입력 폼에서 이름을 `민아` / `야장`으로 제출하면 각 케이스로 연결됩니다. 그 외 이름은 천민아 케이스로 대체 표시(상단 배지 고지).
- 보고서 우하단 **검수용 케이스 전환** 버튼으로 즉시 전환할 수 있습니다.
- "시간을 몰라요" 체크 후 제출하면 보고서 상단에 신뢰도 고지 배지가 붙습니다.

## 주의

- 천야장의 사격 획수는 데모 값입니다(등급은 실제 리포트 기준). 실제 수치는 엔진 연결 시 대체됩니다.
- 이름 통계(인기 순위 등)는 예시 수치입니다.
- 디자인은 Supanova 디자인 스킬(taste + soft + output) 규칙을 따랐습니다: Pretendard, Iconify Solar, `word-break: keep-all`, Double-Bezel 카드, `cubic-bezier(0.16,1,0.3,1)` 모션, IntersectionObserver 리빌.
