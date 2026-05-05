import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SpringEngine } from '../../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPRING_TS_ROOT = path.resolve(__dirname, '../..');
const NAMESPRING_DATA = path.resolve(SPRING_TS_ROOT, '../../namespring/public/data');
const WASM_PATH = path.resolve(SPRING_TS_ROOT, 'node_modules/sql.js/dist/sql-wasm.wasm');
const OUT_DIR = __dirname;
const TARGET_DATE = '2026-05-05T00:00:00+09:00';
const GENERATED_AT = new Date().toISOString();

const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, options?: any) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : '';
  if (urlStr.startsWith('/data/')) {
    const filePath = path.join(NAMESPRING_DATA, urlStr.replace('/data/', ''));
    if (!fs.existsSync(filePath)) return new Response(null, { status: 404 });
    return new Response(fs.readFileSync(filePath), { status: 200 });
  }
  if (urlStr.includes('sql-wasm.wasm') || urlStr.startsWith('https://sql.js.org/') || urlStr === WASM_PATH) {
    return new Response(fs.readFileSync(WASM_PATH), { status: 200 });
  }
  if (originalFetch) return originalFetch(url, options);
  throw new Error(`fetch unavailable for ${urlStr}`);
};

type EngineCall =
  | 'getFortuneReport'
  | 'getSpringReport'
  | 'getSajuReport'
  | 'getNameCandidateSummaries';

type Sample = {
  readonly id: string;
  readonly fileName: string;
  readonly description: string;
  readonly call: EngineCall;
  readonly request: any;
};

const choiSeongsooBirth = {
  year: 1986,
  month: 4,
  day: 19,
  hour: 5,
  minute: 45,
  gender: 'male' as const,
  calendarType: 'solar' as const,
  region: '서울',
  birthPlace: '서울',
};

const choiSeongsooName = {
  surname: [{ hangul: '최', hanja: '崔' }],
  givenName: [
    { hangul: '성', hanja: '成' },
    { hangul: '수', hanja: '秀' },
  ],
};

const fullTimePolicy = {
  sajuTimePolicy: {
    yaza: 'on' as const,
    yazaMode: '23:00' as const,
    trueSolarTime: 'on' as const,
    longitudeCorrection: 'on' as const,
  },
};

const tieredPrecision = {
  precisionConfig: {
    surfaceTieredMatrix: true,
  },
};

const namingVectorPrecision = {
  precisionConfig: {
    surfaceNamingScoreVector: true,
    surfaceNameTrend: true,
    surfacePhoneticEvidence: true,
  },
};

const samples: Sample[] = [
  // ── Carry-over fixtures (shape parity with 2026-05-04 set) ────────────
  {
    id: 'choi-seongsoo-current-fortune',
    fileName: '01-choi-seongsoo-current-fortune.json',
    description: 'NameSpring 호환 getFortuneReport 요청: precisionConfig 없이 야자시, 진태양시, 경도 보정을 모두 적용한 케이스.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: choiSeongsooBirth,
      ...choiSeongsooName,
      options: fullTimePolicy,
    },
  },
  {
    id: 'choi-seongsoo-tiered-fortune',
    fileName: '02-choi-seongsoo-tiered-fortune.json',
    description: '같은 입력에 precisionConfig.surfaceTieredMatrix=true 를 켠 점진 공개 출력 케이스. Phase 3 wording polish 반영.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: choiSeongsooBirth,
      ...choiSeongsooName,
      options: {
        ...fullTimePolicy,
        precisionConfig: { ...tieredPrecision.precisionConfig },
      },
    },
  },
  {
    id: 'choi-seongsoo-spring-report-vector',
    fileName: '03-choi-seongsoo-spring-report-vector.json',
    description: '이름 점수 벡터, 유행, 발음 근거를 opt-in으로 포함한 통합 SpringReport 케이스.',
    call: 'getSpringReport',
    request: {
      birth: choiSeongsooBirth,
      ...choiSeongsooName,
      mode: 'evaluate' as const,
      options: {
        ...fullTimePolicy,
        precisionConfig: { ...namingVectorPrecision.precisionConfig },
      },
    },
  },
  {
    id: 'kim-seoyun-young-female-tiered',
    fileName: '04-kim-seoyun-young-female-tiered.json',
    description: '어린 여성 입력에서 tiered 운세 매트릭스를 켠 케이스.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 2013,
        month: 7,
        day: 21,
        hour: 14,
        minute: 20,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '부산',
        birthPlace: '부산',
      },
      surname: [{ hangul: '김', hanja: '金' }],
      givenName: [
        { hangul: '서', hanja: '瑞' },
        { hangul: '윤', hanja: '潤' },
      ],
      options: tieredPrecision,
    },
  },
  {
    id: 'park-minji-late-night-female-tiered',
    fileName: '05-park-minji-late-night-female-tiered.json',
    description: '성인 여성 늦은 밤 출생 입력에 야자시, 진태양시, 경도 보정과 tiered 매트릭스를 적용한 케이스.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1992,
        month: 11,
        day: 3,
        hour: 23,
        minute: 20,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '대구',
        birthPlace: '대구',
      },
      surname: [{ hangul: '박', hanja: '朴' }],
      givenName: [
        { hangul: '민', hanja: '敏' },
        { hangul: '지', hanja: '智' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: { ...tieredPrecision.precisionConfig },
      },
    },
  },
  {
    id: 'lee-hajun-unknown-hour-neutral-tiered',
    fileName: '06-lee-hajun-unknown-hour-neutral-tiered.json',
    description: '출생 시각 미상, 중립 성별 입력에서 불확실성 안내와 tiered 매트릭스를 확인하는 케이스.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 2001,
        month: 1,
        day: 15,
        hour: null,
        minute: null,
        gender: 'neutral' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '이', hanja: '李' }],
      givenName: [
        { hangul: '하', hanja: '河' },
        { hangul: '준', hanja: '俊' },
      ],
      options: {
        precisionConfig: { ...tieredPrecision.precisionConfig },
      },
    },
  },
  {
    id: 'choi-seongsoo-candidate-summaries',
    fileName: '07-choi-seongsoo-candidate-summaries.json',
    description: 'UI 추천 목록 렌더링용 샘플: 점수 벡터와 공개 표시 안전 후보 필터를 함께 확인하는 케이스.',
    call: 'getNameCandidateSummaries',
    request: {
      birth: choiSeongsooBirth,
      surname: choiSeongsooName.surname,
      givenNameLength: 2,
      mode: 'recommend' as const,
      options: {
        limit: 5,
        ...fullTimePolicy,
        precisionConfig: { ...namingVectorPrecision.precisionConfig },
      },
    },
  },

  // ── Phase 3 new fixtures ──────────────────────────────────────────────
  {
    id: 'kim-jiwon-strong-jeonggwan-gyeokguk-tiered',
    fileName: '08-kim-jiwon-strong-jeonggwan-gyeokguk-tiered.json',
    description: '입력 의도: 정관격 계열의 강한 격국이 또렷이 잡히기 쉬운 입력. 최종 gyeokguk 판정은 엔진이 결정한다.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1990,
        month: 9,
        day: 15,
        hour: 11,
        minute: 30,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '김', hanja: '金' }],
      givenName: [
        { hangul: '지', hanja: '智' },
        { hangul: '원', hanja: '圓' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: { ...tieredPrecision.precisionConfig },
      },
    },
  },
  {
    id: 'kim-seongsu-special-format-candidate-tiered',
    fileName: '09-kim-seongsu-special-format-candidate-tiered.json',
    description: '입력 의도: 외격 후보(화기격 계열) 고전 사례. precisionConfig 로 tieredMatrix 만 결합. 외격 판정은 엔진이 결정한다.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1958,
        month: 7,
        day: 11,
        hour: 13,
        minute: 0,
        gender: 'male' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '김', hanja: '金' }],
      givenName: [
        { hangul: '성', hanja: '成' },
        { hangul: '수', hanja: '秀' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: { ...tieredPrecision.precisionConfig },
      },
    },
  },
  {
    id: 'choi-yaza-boundary-male-tiered',
    fileName: '10-choi-yaza-boundary-male-tiered.json',
    description: '야자시 경계 23:30 출생. yaza=on, yazaMode=23:00 으로 다음 날로 이월하는 경계 케이스.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1995,
        month: 6,
        day: 10,
        hour: 23,
        minute: 30,
        gender: 'male' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '최', hanja: '崔' }],
      givenName: [
        { hangul: '준', hanja: '俊' },
        { hangul: '호', hanja: '豪' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: { ...tieredPrecision.precisionConfig },
      },
    },
  },
  {
    id: 'park-jeolgi-boundary-female-tiered',
    fileName: '11-park-jeolgi-boundary-female-tiered.json',
    description: '입추(立秋) 절기 경계 직후 출생. fortuneCascadeMode=jie_based 로 경계 정밀 계산을 활성화하고 tieredMatrix 와 결합한 케이스.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1988,
        month: 8,
        day: 8,
        hour: 6,
        minute: 0,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '박', hanja: '朴' }],
      givenName: [
        { hangul: '주', hanja: '珠' },
        { hangul: '희', hanja: '蜚' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
          fortuneCascadeMode: 'jie_based',
        },
      },
    },
  },
  {
    id: 'jeong-extreme-strong-continuous-tiered',
    fileName: '12-jeong-extreme-strong-continuous-tiered.json',
    description: '입력 의도: 지지에서 일간이 강하게 받쳐지는 신강 지향 입력. strengthMode=continuous 로 4-tier 강도 곡선과 결합한 tiered 샘플. 최종 강도 분류는 엔진이 결정한다.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1980,
        month: 3,
        day: 12,
        hour: 9,
        minute: 0,
        gender: 'male' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '정', hanja: '鄴' }],
      givenName: [
        { hangul: '태', hanja: '太' },
        { hangul: '호', hanja: '豪' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
          strengthMode: 'continuous',
        },
      },
    },
  },
  {
    id: 'oh-extreme-weak-continuous-tiered',
    fileName: '13-oh-extreme-weak-continuous-tiered.json',
    description: '입력 의도: 지지가 일간을 극도로 소모하는 신약 지향 입력. strengthMode=continuous 로 4-tier 강도 곡선과 결합한 tiered 샘플. 최종 강도 분류는 엔진이 결정한다.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1972,
        month: 11,
        day: 28,
        hour: 4,
        minute: 30,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '오', hanja: '吳' }],
      givenName: [
        { hangul: '숙', hanja: '淑' },
        { hangul: '영', hanja: '玲' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
          strengthMode: 'continuous',
        },
      },
    },
  },
  {
    id: 'choi-palace-naeum-surface-tiered',
    fileName: '14-choi-palace-naeum-surface-tiered.json',
    description: '12궁 / 60갑자 surface ON 시나리오 (declared opt-in). saju-ts 측 데이터 포트 이전이면 surfacePalace/surfaceNaeum 이 추가 출력을 내지 않으며, 계약상 opt-in 시그니처만 노출한다. tieredMatrix 는 정상 출력.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: choiSeongsooBirth,
      ...choiSeongsooName,
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
          surfacePalace: true,
          surfaceNaeum: true,
        },
      },
    },
  },
  {
    id: 'choi-consensus-aware-yongshin-tiered',
    fileName: '15-choi-consensus-aware-yongshin-tiered.json',
    description: 'yongshinMode=consensus_aware 활성 시나리오. 독립 명리 방법이 엇갈리는 사주에서 consensus scoreboard 를 블렌딩한 posture 및 per-axis 근거를 tieredMatrix 와 함께 노출하는 케이스.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: choiSeongsooBirth,
      ...choiSeongsooName,
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
          yongshinMode: 'consensus_aware',
        },
      },
    },
  },

  // ── Phase 5 P5-A5 new fixtures (15 → 22) ─────────────────────────────
  {
    id: 'choi-senior-male-tiered',
    fileName: '16-choi-senior-male-tiered.json',
    description: '70+ 시니어 남성 (1948 출생) — life-stage 후반 narrative 가 활성화되는 fallback 경계. 노년 audience 의 prose 적합도와 tieredMatrix 후반기 흐름을 함께 노출하는 케이스.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1948,
        month: 3,
        day: 15,
        hour: 7,
        minute: 30,
        gender: 'male' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '최', hanja: '崔' }],
      givenName: [
        { hangul: '병', hanja: '炳' },
        { hangul: '호', hanja: '浩' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: { ...tieredPrecision.precisionConfig },
      },
    },
  },
  {
    id: 'kim-senior-female-tiered',
    fileName: '17-kim-senior-female-tiered.json',
    description: '70+ 시니어 여성 (1950 출생) — 노년 여성 audience 흐름. life-stage 후반 narrative 와 tieredMatrix 의 conservative tone 매칭을 점검하는 케이스.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1950,
        month: 8,
        day: 20,
        hour: 14,
        minute: 0,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '김', hanja: '金' }],
      givenName: [
        { hangul: '순', hanja: '順' },
        { hangul: '자', hanja: '子' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: { ...tieredPrecision.precisionConfig },
      },
    },
  },
  {
    id: 'lee-child-male-tiered',
    fileName: '18-lee-child-male-tiered.json',
    description: '0-9 세 어린 남아 (2020 출생) — child fallback narrative 활성화 케이스. 어린 audience 안전 보장 (성인 metaphor 회피) 과 tieredMatrix 의 가벼운 톤을 점검하는 fixture.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 2020,
        month: 6,
        day: 10,
        hour: 10,
        minute: 15,
        gender: 'male' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '이', hanja: '李' }],
      givenName: [
        { hangul: '도', hanja: '道' },
        { hangul: '윤', hanja: '潤' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: { ...tieredPrecision.precisionConfig },
      },
    },
  },
  {
    id: 'gyeokguk-conflict-jeonggwan-vs-bigyeop-tiered',
    fileName: '19-gyeokguk-conflict-jeonggwan-vs-bigyeop-tiered.json',
    description: '격국 충돌 case 1: 정관 후보와 비견(겁재) 후보가 같이 잡히기 쉬운 입력. gyeokgukSelectionRule=jungki_transparent 로 월지 중기 투간 룰을 활성화하여 후보 ranking 의 elasticity 를 노출하는 케이스. 최종 격국 판정은 엔진이 결정한다.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1985,
        month: 5,
        day: 25,
        hour: 8,
        minute: 45,
        gender: 'male' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '한', hanja: '韓' }],
      givenName: [
        { hangul: '재', hanja: '在' },
        { hangul: '우', hanja: '宇' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
          gyeokgukSelectionRule: 'jungki_transparent',
        },
      },
    },
  },
  {
    id: 'gyeokguk-conflict-consensus-aware-tiered',
    fileName: '20-gyeokguk-conflict-consensus-aware-tiered.json',
    description: '격국 충돌 case 2: 신강/신약 경계 + 격국 후보 다중 + yongshinMode=consensus_aware 활성. 독립 명리 방법(억부/조후/격국/통관/병약/식상유통) 이 엇갈리는 chart 에서 consensus 보드와 격국 흔들림이 함께 노출되는 케이스.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1973,
        month: 12,
        day: 17,
        hour: 16,
        minute: 30,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '윤', hanja: '尹' }],
      givenName: [
        { hangul: '소', hanja: '昭' },
        { hangul: '연', hanja: '燕' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
          yongshinMode: 'consensus_aware',
          gyeokgukSelectionRule: 'jungki_transparent',
        },
      },
    },
  },
  {
    id: 'multi-axis-evaluator-enabled-tiered',
    fileName: '21-multi-axis-evaluator-enabled-tiered.json',
    description: 'precisionConfig.evaluatorMode=multi_axis 활성 시나리오. axisStrength 가 ≥2 축을 공급할 때 다축 가중 (yongshin/gyeokguk/strength/chengbai/johu/fortuneHierarchy/rectification) 으로 sajuPriority 를 계산하는 PR-K-9 경계. 단일축 default 와의 비교 base 로 사용한다.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: choiSeongsooBirth,
      ...choiSeongsooName,
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
          evaluatorMode: 'multi_axis',
        },
      },
    },
  },
  {
    id: 'low-confidence-yongshin-tiered',
    fileName: '22-low-confidence-yongshin-tiered.json',
    description: '용신 신뢰도 낮은 case (consensus 충돌 + 다중 후보). yongshinMode=consensus_aware + chengbai_strict 결합으로 conflict 가 격국 페널티 곡선까지 영향을 주는 elasticity 를 노출. tieredMatrix 의 명시적 신호 fixture 로 활용한다.',
    call: 'getFortuneReport',
    request: {
      targetDate: TARGET_DATE,
      birth: {
        year: 1991,
        month: 2,
        day: 4,
        hour: 18,
        minute: 0,
        gender: 'female' as const,
        calendarType: 'solar' as const,
        region: '서울',
        birthPlace: '서울',
      },
      surname: [{ hangul: '강', hanja: '姜' }],
      givenName: [
        { hangul: '하', hanja: '夏' },
        { hangul: '람', hanja: '嵐' },
      ],
      options: {
        ...fullTimePolicy,
        precisionConfig: {
          ...tieredPrecision.precisionConfig,
          yongshinMode: 'consensus_aware',
          gyeokgukMode: 'chengbai_strict',
        },
      },
    },
  },
];

function jsonStable(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function payloadSummary(payload: any): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    topLevelKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
  };
  if (payload?.tieredMatrix) {
    summary.tieredMatrix = {
      schemaVersion: payload.tieredMatrix.schemaVersion,
      periods: Object.keys(payload.tieredMatrix.periods ?? {}),
      glossaryEntryCount: Object.keys(payload.tieredMatrix.glossary?.entries ?? {}).length,
      usedGlossaryCount: payload.tieredMatrix.glossary?.usedInThisReport?.length ?? null,
    };
  } else {
    summary.tieredMatrix = null;
  }
  if (payload?.meta) {
    summary.meta = payload.meta;
  }
  if (payload?.saju?.summary?.timeCorrection) {
    summary.timeCorrection = payload.saju.summary.timeCorrection;
  }
  if (payload?.sajuReport?.summary?.timeCorrection) {
    summary.timeCorrection = payload.sajuReport.summary.timeCorrection;
  }
  if (Array.isArray(payload)) {
    summary.itemCount = payload.length;
    summary.firstItemKeys = payload[0] ? Object.keys(payload[0]) : [];
  }
  return summary;
}

const engine = new SpringEngine();
const repos: any[] = [(engine as any).hanjaRepo, (engine as any).fourFrameRepo];
for (const repo of repos) {
  if (repo) repo.wasmUrl = WASM_PATH;
}
await engine.init();

const indexRows: Array<Record<string, unknown>> = [];

for (const sample of samples) {
  const method = (engine as any)[sample.call];
  if (typeof method !== 'function') throw new Error(`missing engine method: ${sample.call}`);
  const payload = await method.call(engine, sample.request);
  const envelope = {
    generatedAt: GENERATED_AT,
    targetDate: TARGET_DATE,
    sampleId: sample.id,
    description: sample.description,
    call: sample.call,
    request: sample.request,
    payload,
  };
  const outPath = path.join(OUT_DIR, sample.fileName);
  fs.writeFileSync(outPath, jsonStable(envelope), 'utf-8');
  indexRows.push({
    sampleId: sample.id,
    fileName: sample.fileName,
    description: sample.description,
    call: sample.call,
    request: sample.request,
    outputBytes: fs.statSync(outPath).size,
    payloadSummary: payloadSummary(payload),
  });
}

fs.writeFileSync(
  path.join(OUT_DIR, 'index.json'),
  jsonStable({
    generatedAt: GENERATED_AT,
    targetDate: TARGET_DATE,
    outputDirectory: OUT_DIR,
    sampleCount: samples.length,
    samples: indexRows,
  }),
  'utf-8',
);

engine.close();
console.log(`Wrote ${samples.length} sample JSON outputs to ${OUT_DIR}`);
