import { describe, expect, it } from 'vitest';
import {
  analyzeSaju,
  createBirthInput,
  dstMinutesAtUtcMs,
  parseOffsetToken,
  resolveOffsetMinutes,
} from './springLegacy.js';

const TZ = 'Asia/Seoul';

/**
 * 한국 표준시 변천·서머타임 픽스처 (감사 B10).
 *
 * 목적: Intl(ICU tzdata) 해석을 고정 픽스처로 회귀 검증 — 런타임 tzdata가
 * Asia/Seoul 역사 오프셋을 잃으면(small-icu·구식 tzdata) 침묵 +09:00 오류가
 * 나는 것을 여기서 잡는다.
 *
 * 정본: IANA tzdb asia — Rule ROK(1948-51/1955-60/1987-88 = DST 12구간),
 * Zone Asia/Seoul(LMT 8:27:52 → 1908-04-01 +8:30 → 1912-01-01 +9
 * → 1954-03-21 +8:30 → 1961-08-10 +9). 검증 기준 tzdata 2025b.
 * (감사 보고서의 '14구간' 표기는 tzdata 기준 12구간이 정본.)
 *
 * 설계 원칙:
 * - DST 구간은 "한가운데(7/15 정오)" 표본만 사용 — 1948~60 시작/종료일은
 *   tzdata pre-1970 best-effort 영역이라 릴리스 간 일 단위 드리프트 가능.
 * - 자오선 4전환(1908/1912/1954/1961)은 역사적으로 확정 날짜이므로 전후
 *   ±1일 정오 표본 사용.
 * - 1987/88(관보 확정, 드리프트 없음)만 일 단위 정밀 표본 포함.
 * - 전환 당일의 갭(spring-forward)·중복(fall-back) 시간대는 픽스처 금지.
 * - 1948-60 DST 종료 Rule은 `24:00`(익일 00:00) 표기 — 한국 문헌과 종료
 *   "날짜"가 하루 어긋나 보일 수 있으나 중앙 표본이라 테스트엔 무관.
 */
interface TzFixture {
  label: string;
  y: number; m: number; d: number; h: number; min: number;
  offset: number; // resolveOffsetMinutes 기대값(분)
  dst: number;    // dstMinutesAtUtcMs 기대값(분)
}

const FIXTURES: TzFixture[] = [
  // ── LMT·자오선 전환 (전후 ±1일 + 구간 내부) ─────────────────────────
  { label: 'LMT 구간 내부(1907)',            y: 1907, m: 6,  d: 15, h: 12, min: 0, offset: 508, dst: 0 },
  { label: 'LMT 마지막 날(1908-03-31)',      y: 1908, m: 3,  d: 31, h: 12, min: 0, offset: 508, dst: 0 },
  { label: '+8:30 개시 직후(1908-04-02)',    y: 1908, m: 4,  d: 2,  h: 12, min: 0, offset: 510, dst: 0 },
  { label: '+8:30 1기 내부(1911)',           y: 1911, m: 6,  d: 15, h: 12, min: 0, offset: 510, dst: 0 },
  { label: '+8:30 1기 마지막 날(1911-12-31)', y: 1911, m: 12, d: 31, h: 12, min: 0, offset: 510, dst: 0 },
  { label: '+9 개시 직후(1912-01-02)',       y: 1912, m: 1,  d: 2,  h: 12, min: 0, offset: 540, dst: 0 },
  { label: '+9 1기 내부(1930)',              y: 1930, m: 6,  d: 15, h: 12, min: 0, offset: 540, dst: 0 },
  { label: '+9 마지막 날(1954-03-20)',       y: 1954, m: 3,  d: 20, h: 12, min: 0, offset: 540, dst: 0 },
  { label: '+8:30 복귀 직후(1954-03-22)',    y: 1954, m: 3,  d: 22, h: 12, min: 0, offset: 510, dst: 0 },
  { label: '+8:30 2기 마지막 날(1961-08-09)', y: 1961, m: 8,  d: 9,  h: 12, min: 0, offset: 510, dst: 0 },
  { label: '+9 복귀 직후(1961-08-11)',       y: 1961, m: 8,  d: 11, h: 12, min: 0, offset: 540, dst: 0 },
  { label: '현대(2000)',                     y: 2000, m: 7,  d: 15, h: 12, min: 0, offset: 540, dst: 0 },

  // ── DST 12구간 한가운데 (+9→+10: 600 / +8:30→+9:30: 570) ──────────
  { label: 'DST 1948 중앙', y: 1948, m: 7, d: 15, h: 12, min: 0, offset: 600, dst: 60 },
  { label: 'DST 1949 중앙', y: 1949, m: 7, d: 15, h: 12, min: 0, offset: 600, dst: 60 },
  { label: 'DST 1950 중앙', y: 1950, m: 7, d: 15, h: 12, min: 0, offset: 600, dst: 60 },
  { label: 'DST 1951 중앙', y: 1951, m: 7, d: 15, h: 12, min: 0, offset: 600, dst: 60 },
  { label: 'DST 1955 중앙', y: 1955, m: 7, d: 15, h: 12, min: 0, offset: 570, dst: 60 },
  { label: 'DST 1956 중앙', y: 1956, m: 7, d: 15, h: 12, min: 0, offset: 570, dst: 60 },
  { label: 'DST 1957 중앙', y: 1957, m: 7, d: 15, h: 12, min: 0, offset: 570, dst: 60 },
  { label: 'DST 1958 중앙', y: 1958, m: 7, d: 15, h: 12, min: 0, offset: 570, dst: 60 },
  { label: 'DST 1959 중앙', y: 1959, m: 7, d: 15, h: 12, min: 0, offset: 570, dst: 60 },
  { label: 'DST 1960 중앙', y: 1960, m: 7, d: 15, h: 12, min: 0, offset: 570, dst: 60 },
  { label: 'DST 1987 중앙', y: 1987, m: 7, d: 15, h: 12, min: 0, offset: 600, dst: 60 },
  { label: 'DST 1988 중앙', y: 1988, m: 7, d: 15, h: 12, min: 0, offset: 600, dst: 60 },

  // ── 무DST 이웃 연도 (같은 7/15 정오 — DST 구간과 1:1 대조) ─────────
  { label: '무DST 1947 여름', y: 1947, m: 7, d: 15, h: 12, min: 0, offset: 540, dst: 0 },
  { label: '무DST 1952 여름', y: 1952, m: 7, d: 15, h: 12, min: 0, offset: 540, dst: 0 },
  { label: '무DST 1953 여름', y: 1953, m: 7, d: 15, h: 12, min: 0, offset: 540, dst: 0 },
  { label: '무DST 1954 여름(+8:30 주의)', y: 1954, m: 7, d: 15, h: 12, min: 0, offset: 510, dst: 0 },
  { label: '무DST 1961 여름(+8:30 주의)', y: 1961, m: 7, d: 15, h: 12, min: 0, offset: 510, dst: 0 },
  { label: '무DST 1986 여름', y: 1986, m: 7, d: 15, h: 12, min: 0, offset: 540, dst: 0 },
  { label: '무DST 1989 여름', y: 1989, m: 7, d: 15, h: 12, min: 0, offset: 540, dst: 0 },

  // ── 1987/88 일 단위 정밀 (관보 확정 — 드리프트 없음) ────────────────
  { label: 'DST 1987 개시 첫 시간대(5/10 03:30 KDT)', y: 1987, m: 5,  d: 10, h: 3,  min: 30, offset: 600, dst: 60 },
  { label: 'DST 1988 해제일 오전(10/9 12:00 KST)',    y: 1988, m: 10, d: 9,  h: 12, min: 0,  offset: 540, dst: 0 },
];

// 프로덕션 동일 경로(normalizeLegacyOutput의 dst 산출)로 UTC ms 유도
function birthUtcMs(f: TzFixture, offset: number): number {
  return Date.UTC(f.y, f.m - 1, f.d, f.h, f.min, 0) - offset * 60_000;
}

const icuHasSeoulHistory = (() => {
  try {
    return resolveOffsetMinutes(TZ, { y: 1988, m: 7, d: 15, h: 12, min: 0 }) === 600;
  } catch {
    return false;
  }
})();

describe('한국 표준시 변천·서머타임 픽스처 (감사 B10)', () => {
  // 카나리아: 여기가 깨지면 런타임 tzdata가 역사 오프셋을 모른다는 뜻이고
  // 엔진은 침묵 +09:00으로 오답을 낸다. skip이 아니라 실패가 맞다 (B10의 존재 이유).
  it(`런타임 ICU가 Asia/Seoul 역사 tzdata를 포함한다 (node ${process.version}, icu ${process.versions.icu ?? '?'}, tz ${(process.versions as any).tz ?? '?'})`, () => {
    expect(icuHasSeoulHistory).toBe(true);
  });

  // 카나리아 실패 시 33건의 중복 실패로 로그가 오염되는 것만 방지 (환경 면죄부 아님)
  describe.skipIf(!icuHasSeoulHistory)('오프셋·DST 판정 테이블 (tzdata 2025b 기준 실측 고정)', () => {
    for (const f of FIXTURES) {
      it(`${f.label}: offset=${f.offset}분, dst=${f.dst}분`, () => {
        const off = resolveOffsetMinutes(TZ, { y: f.y, m: f.m, d: f.d, h: f.h, min: f.min });
        expect(off, 'resolveOffsetMinutes').toBe(f.offset);
        expect(dstMinutesAtUtcMs(birthUtcMs(f, off), TZ), 'dstMinutesAtUtcMs').toBe(f.dst);
      });
    }
  });

  describe.skipIf(!icuHasSeoulHistory)('analyzeSaju 경유 배선 (기존 springLegacy.test.ts 4건 미커버 구간)', () => {
    it('1948년 7월(+9→+10, ICU 표시명 부재 구간) 출생의 dstCorrectionMinutes는 60이다', () => {
      const out: any = analyzeSaju(createBirthInput({
        birthYear: 1948, birthMonth: 7, birthDay: 15,
        birthHour: 12, birthMinute: 0, gender: 'MALE',
      }));
      expect(out.coreResult.dstCorrectionMinutes).toBe(60);
    });
  });

  describe('parseOffsetToken 단독 회귀 (감사 A15a — Intl 무관, 항상 실행)', () => {
    it('초 성분 LMT 토큰 GMT+8:27:52 → 508분(507.867 반올림)', () => {
      expect(parseOffsetToken('GMT+8:27:52')).toBe(508);
    });
    it('일반 토큰: GMT+09:00→540, GMT+9:30→570, GMT→0, 비토큰→null', () => {
      expect(parseOffsetToken('GMT+09:00')).toBe(540);
      expect(parseOffsetToken('GMT+9:30')).toBe(570);
      expect(parseOffsetToken('GMT')).toBe(0);
      expect(parseOffsetToken('KST')).toBeNull();
    });
  });
});
