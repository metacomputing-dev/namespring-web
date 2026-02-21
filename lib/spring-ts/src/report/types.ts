/**
 * types.ts — 사주+성명학 통합 보고서 타입 정의
 *
 * 이 파일은 통합 보고서 생성에 사용되는 모든 타입을 정의합니다.
 * 각 섹션 생성기는 이 타입들을 참조하여 보고서 조각을 만듭니다.
 */

// ─────────────────────────────────────────────────────────────────────────────
//  1. 입력 타입
// ─────────────────────────────────────────────────────────────────────────────

import type { SajuSummary, SpringReport, NamingReport, SajuReport } from '../types.js';

/** 통합 보고서 생성에 필요한 모든 입력 데이터 */
export interface ReportInput {
  /** 사주 분석 결과 (SajuReport 또는 SajuSummary) */
  readonly saju: SajuSummary;
  /** 성명학 분석 결과 (NamingReport) — 선택적 */
  readonly naming?: NamingReport | null;
  /** 통합 보고서 (SpringReport) — 선택적 */
  readonly spring?: SpringReport | null;
  /** 대상자 이름 (한글) */
  readonly name?: string;
  /** 대상자 성별 */
  readonly gender?: 'male' | 'female' | 'neutral';
  /** 생년월일시 정보 */
  readonly birthInfo?: {
    readonly year?: number | null;
    readonly month?: number | null;
    readonly day?: number | null;
    readonly hour?: number | null;
    readonly minute?: number | null;
  };
  /** 오늘 날짜 (일운 산출용) */
  readonly today?: Date;
  /** 보고서 옵션 */
  readonly options?: ReportOptions;
}

/** 보고서 생성 옵션 */
export interface ReportOptions {
  /** 포함할 섹션 (기본: 전체) */
  readonly includeSections?: ReportSectionId[];
  /** 제외할 섹션 */
  readonly excludeSections?: ReportSectionId[];
  /** 문장 다양성 시드 (동일 시드 → 동일 결과) */
  readonly variationSeed?: number;
  /** 상세도 레벨 */
  readonly detailLevel?: 'brief' | 'normal' | 'detailed';
  /** 대운 표시 개수 */
  readonly daeunCount?: number;
  /** 세운 표시 범위 (전후 년수) */
  readonly saeunRange?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. 출력 타입
// ─────────────────────────────────────────────────────────────────────────────

/** 보고서 섹션 ID */
export type ReportSectionId =
  | 'pillars'           // 사주 원국표
  | 'dayMaster'         // 일간 분석
  | 'hiddenStems'       // 지장간 분석
  | 'elements'          // 오행 분포
  | 'deficiency'        // 과다/결핍 진단
  | 'tongguan'          // 통관 분석
  | 'climate'           // 조후 분석
  | 'tenGods'           // 십성 분석
  | 'lifeStages'        // 12운성
  | 'strength'          // 신강/신약
  | 'gyeokguk'          // 격국
  | 'yongshin'          // 용신 체계
  | 'yongshinLife'      // 용신 생활 가이드
  | 'stemRelations'     // 천간 관계
  | 'branchRelations'   // 지지 관계
  | 'shinsalGood'       // 길신
  | 'shinsalBad'        // 흉살
  | 'daeun'             // 대운
  | 'saeun'             // 세운
  | 'monthlyFortune'    // 월운/일운
  | 'nameElement'       // 이름 오행 분석
  | 'fourFrame'         // 수리 사격 분석
  | 'nameHarmony'       // 이름-사주 조화
  | 'summary'           // 종합 요약
  | 'actionPlan'        // 실행 계획
  | 'health'            // 건강 조언
  | 'career'            // 진로/직업
  | 'relationships'     // 대인관계
  | 'luckItems'         // 개운 아이템
  | 'yearlyFortune'     // 세운 (연운)
  | 'dailyFortune'      // 일운
  | 'weeklyFortune'     // 주운 (7일)
  | 'nameBasic'         // 이름 기본 정보
  | 'nameComparison'    // 이름 비교 매트릭스
  | 'sajuNameSynergy'   // 사주-이름 시너지
  | 'elementLifestyle'; // 오행별 생활 가이드

/** 보고서 하나의 섹션 */
export interface ReportSection {
  /** 섹션 ID */
  readonly id: ReportSectionId;
  /** 섹션 제목 */
  readonly title: string;
  /** 섹션 부제목 (선택) */
  readonly subtitle?: string;
  /** 본문 단락 배열 */
  readonly paragraphs: ReportParagraph[];
  /** 데이터 테이블 (선택) */
  readonly tables?: ReportTable[];
  /** 시각화 데이터 (선택) */
  readonly charts?: ReportChart[];
  /** 핵심 수치/키워드 (선택) */
  readonly highlights?: ReportHighlight[];
  /** 하위 섹션 (선택) */
  readonly subsections?: ReportSubsection[];
}

/** 보고서 하위 섹션 */
export interface ReportSubsection {
  readonly title: string;
  readonly paragraphs: ReportParagraph[];
  readonly tables?: ReportTable[];
  readonly charts?: ReportChart[];
  readonly highlights?: ReportHighlight[];
}

/** 단락 하나 */
export interface ReportParagraph {
  /** 단락 유형 */
  readonly type: 'narrative' | 'tip' | 'warning' | 'quote' | 'emphasis';
  /** 본문 텍스트 */
  readonly text: string;
  /** 관련 오행 (스타일링용) */
  readonly element?: ElementCode;
  /** 긍정/부정/중립 톤 */
  readonly tone?: 'positive' | 'negative' | 'neutral' | 'encouraging';
}

/** 데이터 테이블 */
export interface ReportTable {
  readonly title?: string;
  readonly headers: string[];
  readonly rows: string[][];
}

/** 시각화 데이터 */
export interface ReportChart {
  readonly type: 'radar' | 'bar' | 'gauge' | 'timeline' | 'donut' | 'line';
  readonly title?: string;
  readonly data: Record<string, number | string>;
  readonly meta?: Record<string, unknown>;
}

/** 핵심 하이라이트 */
export interface ReportHighlight {
  readonly label: string;
  readonly value: string;
  readonly element?: ElementCode;
  readonly sentiment?: 'good' | 'caution' | 'neutral';
}

/** 통합 보고서 전체 */
export interface IntegratedReport {
  /** 보고서 메타 정보 */
  readonly meta: ReportMeta;
  /** 보고서 서문 */
  readonly introduction: ReportParagraph[];
  /** 각 섹션 */
  readonly sections: ReportSection[];
  /** 보고서 맺음말 */
  readonly conclusion: ReportParagraph[];
}

/** 보고서 메타데이터 */
export interface ReportMeta {
  readonly version: string;
  readonly generatedAt: string;
  readonly targetName?: string;
  readonly targetGender?: string;
  readonly engineVersion?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. 오행 및 기본 코드 타입
// ─────────────────────────────────────────────────────────────────────────────

/** 오행 코드 */
export type ElementCode = 'WOOD' | 'FIRE' | 'EARTH' | 'METAL' | 'WATER';

/** 음양 코드 */
export type YinYangCode = 'YANG' | 'YIN';

/** 천간 코드 */
export type StemCode =
  | 'GAP' | 'EUL' | 'BYEONG' | 'JEONG' | 'MU'
  | 'GI' | 'GYEONG' | 'SIN' | 'IM' | 'GYE';

/** 지지 코드 */
export type BranchCode =
  | 'JA' | 'CHUK' | 'IN' | 'MYO' | 'JIN' | 'SA'
  | 'O' | 'MI' | 'SIN_BRANCH' | 'YU' | 'SUL' | 'HAE';

/** 십성 코드 */
export type TenGodCode =
  | 'BI_GYEON' | 'GEOB_JAE' | 'SIK_SHIN' | 'SANG_GWAN'
  | 'PYEON_JAE' | 'JEONG_JAE' | 'PYEON_GWAN' | 'JEONG_GWAN'
  | 'PYEON_IN' | 'JEONG_IN';

/** 12운성 코드 */
export type LifeStageCode =
  | 'JANGSEONG' | 'MOKYOK' | 'GWANDAE' | 'GEONROK' | 'JEWANG'
  | 'SWOE' | 'BYEONG' | 'SA' | 'MYO' | 'JEOL' | 'TAE' | 'YANG';

/** 신강도 분류 */
export type StrengthLevel = 'EXTREME_STRONG' | 'STRONG' | 'BALANCED' | 'WEAK' | 'EXTREME_WEAK';

/** 신살 유형 */
export type ShinsalType = 'auspicious' | 'inauspicious' | 'neutral';

/** 용신 부합도 등급 */
export type YongshinMatchGrade = 5 | 4 | 3 | 2 | 1;

// ─────────────────────────────────────────────────────────────────────────────
//  4. 섹션 생성 함수 시그니처
// ─────────────────────────────────────────────────────────────────────────────

/** 각 섹션 생성기의 공통 시그니처 */
export type SectionGenerator = (input: ReportInput) => ReportSection | null;

/** 복수 섹션 생성기 (한 모듈이 여러 섹션을 생성할 수 있음) */
export type MultiSectionGenerator = (input: ReportInput) => ReportSection[];

// ─────────────────────────────────────────────────────────────────────────────
//  5. 문장 템플릿 관련 타입
// ─────────────────────────────────────────────────────────────────────────────

/** 조건부 문장 템플릿 */
export interface ConditionalTemplate {
  /** 이 템플릿이 적용되기 위한 조건 */
  readonly condition: (input: ReportInput) => boolean;
  /** 템플릿 문장 배열 (랜덤 선택) */
  readonly templates: string[];
  /** 가중치 (높을수록 자주 선택) */
  readonly weight?: number;
}

/** 변수 치환이 가능한 템플릿 */
export interface ParameterizedTemplate {
  /** 템플릿 문자열 ({{변수명}} 형식의 플레이스홀더 포함) */
  readonly template: string;
  /** 매개변수 이름 목록 */
  readonly params: string[];
}

/** 문맥 기반 문장 풀 */
export interface ContextualSentencePool {
  /** 풀 식별자 */
  readonly id: string;
  /** 조건별 템플릿 그룹 */
  readonly groups: ConditionalTemplate[];
  /** 기본 템플릿 (조건 불일치 시 폴백) */
  readonly fallback: string[];
}
