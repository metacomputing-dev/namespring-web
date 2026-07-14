import { describe, expect, it } from 'vitest';
import {
  CHEONGAN_RELATION_NOTES,
  JIJI_RELATION_NOTES,
  JIJI_RELATION_OUTCOMES,
  analyzeSaju,
  createBirthInput,
} from './springLegacy.js';
import { RELATION_ORDER } from '../core/branchRelations.js';

describe('관계 타입 ↔ 라벨 테이블 전수 일치 (감사 A3)', () => {
  it('엔진이 방출 가능한 모든 지지 관계 타입에 note/outcome 라벨이 있다', () => {
    for (const type of RELATION_ORDER) {
      expect(JIJI_RELATION_NOTES[type], `JIJI_RELATION_NOTES.${type}`).toBeTruthy();
      expect(JIJI_RELATION_OUTCOMES[type], `JIJI_RELATION_OUTCOMES.${type}`).toBeTruthy();
    }
  });

  it('천간 관계 타입(HAP/CHUNG)에 note 라벨이 있다', () => {
    for (const type of ['HAP', 'CHUNG'] as const) {
      expect(CHEONGAN_RELATION_NOTES[type], `CHEONGAN_RELATION_NOTES.${type}`).toBeTruthy();
    }
  });
});

describe('normalizeLegacyOutput 정직성 (감사 A1/A2/A9/A15d)', () => {
  // 1986-04-19 05:45 남 (핸드북 프리뷰 표준 케이스)
  const output: any = analyzeSaju(createBirthInput({
    birthYear: 1986, birthMonth: 4, birthDay: 19,
    birthHour: 5, birthMinute: 45, gender: 'MALE',
  }));

  it('육합이 나오면 note/outcome이 비어 있지 않다 (전 관계 공통)', () => {
    for (const rel of output.jijiRelations) {
      expect(rel.note, `note for ${rel.type}`).toBeTruthy();
      expect(rel.outcome, `outcome for ${rel.type}`).toBeTruthy();
    }
  });

  it('용신 추천 1위 type이 JOHU가 아니라 실제 산출 방법(EOKBU)이다', () => {
    expect(output.yongshinResult.recommendations[0]?.type).toBe('EOKBU');
  });

  it('득령은 0|1, 득지는 0~1, 득세는 0~7 범위의 실제 판정값이다', () => {
    const s = output.strengthResult.score;
    expect([0, 1]).toContain(s.deukryeong);
    expect(s.deukji).toBeGreaterThanOrEqual(0);
    expect(s.deukji).toBeLessThanOrEqual(1);
    expect(Number.isInteger(s.deukse)).toBe(true);
    expect(s.deukse).toBeGreaterThanOrEqual(0);
    expect(s.deukse).toBeLessThanOrEqual(7);
    // 가짜 매핑 시절의 흔적: deukse가 앞 둘의 단순합이면 안 된다 (정의상 다른 축).
    // (실값에서도 우연히 같을 수는 있으나 스케일이 다르다 — 회귀 감지용 완화 검사)
    expect(s.deukse).not.toBe(output.strengthResult.score.totalSupport);
  });

  it('1986년(비서머타임) 출생의 dstCorrectionMinutes는 0이다', () => {
    expect(output.coreResult.dstCorrectionMinutes).toBe(0);
  });

  it('1988년 7월(서머타임) 출생의 dstCorrectionMinutes는 60이다', () => {
    const dst: any = analyzeSaju(createBirthInput({
      birthYear: 1988, birthMonth: 7, birthDay: 15,
      birthHour: 12, birthMinute: 0, gender: 'FEMALE',
    }));
    expect(dst.coreResult.dstCorrectionMinutes).toBe(60);
  });

  it('1957년 여름(1955~60 서머타임, ICU 표시명 부재 구간)도 60분으로 판정한다', () => {
    const dst: any = analyzeSaju(createBirthInput({
      birthYear: 1957, birthMonth: 7, birthDay: 15,
      birthHour: 12, birthMinute: 0, gender: 'MALE',
    }));
    expect(dst.coreResult.dstCorrectionMinutes).toBe(60);
  });

  it('1954년 1월(표준 자오선 변경 직전)은 서머타임으로 오판하지 않는다', () => {
    const noDst: any = analyzeSaju(createBirthInput({
      birthYear: 1954, birthMonth: 1, birthDay: 15,
      birthHour: 12, birthMinute: 0, gender: 'MALE',
    }));
    expect(noDst.coreResult.dstCorrectionMinutes).toBe(0);
  });

  it('daeunInfo.boundaryMode는 일경계 정책이 아니라 절기 id다', () => {
    expect(output.daeunInfo.boundaryMode).not.toBe('midnight');
    expect(output.daeunInfo.boundaryMode).not.toBe('ziSplit23');
    expect(output.daeunInfo.boundaryMode).toMatch(/^[A-Z_]+$/);
    expect(output.daeunInfo.deltaDays).toBeGreaterThan(0);
    expect(String(output.daeunInfo.formula)).toContain('startAgeYears');
  });
});
