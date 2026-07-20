import { useState } from 'react';
import { KOREA_REGION_PRIMARY_ALIASES } from '@spring/region-coordinates';
import { HanjaPickerModal, type HanjaChoice } from './HanjaPicker';
import type { ProfileNameChar, V3Profile } from '../model/profile';

/**
 * 사람 한 명의 이름·출생 정보를 받는 폼. 처음 화면의 입력 규칙과 동일하며,
 * 궁합처럼 여러 사람을 받아야 하는 화면에서 재사용한다.
 */

interface PickerTarget {
  part: 'surname' | 'givenName';
  index: number;
  hangul: string;
}

function toChars(value: string): string[] {
  return Array.from(value.trim()).filter(ch => /[가-힣]/.test(ch));
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function daysInMonth(
  year: number,
  month: number,
  calendarType: 'solar' | 'lunar',
): number {
  // 음력 달은 29일 또는 30일 — 그레고리력 달 길이와 무관하게 30일까지 허용한다.
  if (calendarType === 'lunar') return 30;
  return new Date(year, month, 0).getDate();
}

/** 연·월·달력 기준이 바뀌어도 일(day)이 그 달의 범위를 벗어나지 않게 자른다. */
function clampDay(
  day: number,
  year: number,
  month: number,
  calendarType: 'solar' | 'lunar',
): number {
  const max = daysInMonth(year, month, calendarType);
  return Number.isFinite(max) && max >= 1 ? Math.min(day, max) : day;
}

export default function PersonForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: V3Profile | null;
  submitLabel: string;
  onSubmit: (profile: V3Profile) => void;
}) {
  const saved = initial ?? null;

  const [surnameText, setSurnameText] = useState(saved?.surname.map(c => c.hangul).join('') ?? '');
  const [givenText, setGivenText] = useState(saved?.givenName.map(c => c.hangul).join('') ?? '');
  const [hanjaByChar, setHanjaByChar] = useState<Record<string, HanjaChoice>>(() => {
    if (!saved) return {};
    const seed: Record<string, HanjaChoice> = {};
    const feed = (part: 'surname' | 'givenName', chars: ProfileNameChar[]) => {
      chars.forEach((c, index) => {
        if (c.hanja) {
          seed[`${part}:${index}:${c.hangul}`] = {
            hanja: c.hanja,
            meaning: c.meaning ?? '',
            strokes: 0,
          };
        }
      });
    };
    feed('surname', saved.surname);
    feed('givenName', saved.givenName);
    return seed;
  });
  const [pureHangul, setPureHangul] = useState(saved?.pureHangul ?? false);
  const [picker, setPicker] = useState<PickerTarget | null>(null);

  const [year, setYear] = useState(saved?.birth.year ?? 1995);
  const [month, setMonth] = useState(saved?.birth.month ?? 6);
  const [day, setDay] = useState(saved?.birth.day ?? 15);
  const [calendarType, setCalendarType] = useState<'solar' | 'lunar'>(
    saved?.birth.calendarType ?? 'solar',
  );
  const [isLeapMonth, setIsLeapMonth] = useState(saved?.birth.isLeapMonth ?? false);
  const [timeUnknown, setTimeUnknown] = useState(saved ? saved.birth.hour === null : false);
  const [hour, setHour] = useState(saved?.birth.hour ?? 12);
  const [minute, setMinute] = useState(saved?.birth.minute ?? 0);
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>(
    saved?.birth.gender ?? 'neutral',
  );
  const [trueSolarTime, setTrueSolarTime] = useState(saved?.birth.trueSolarTime ?? false);
  const [yaza, setYaza] = useState(saved?.birth.yaza ?? false);
  const [region, setRegion] = useState<string>(saved?.birth.region ?? '');

  const surnameChars = toChars(surnameText).slice(0, 2);
  const givenChars = toChars(givenText).slice(0, 4);
  const nameReady = surnameChars.length >= 1 && givenChars.length >= 1;
  const slotKey = (part: string, index: number, ch: string) => `${part}:${index}:${ch}`;
  // 성씨 한자는 순우리말 이름이어도 항상 필요하다 — 수리·자원오행 계산의 재료라서다.
  const hanjaComplete = [
    ...surnameChars.map((ch, i) => slotKey('surname', i, ch)),
    ...(pureHangul ? [] : givenChars.map((ch, i) => slotKey('givenName', i, ch))),
  ].every(key => hanjaByChar[key]);

  const canSubmit = nameReady && hanjaComplete && year >= 1900 && year <= 2035;

  function charSlot(part: 'surname' | 'givenName', index: number, hangul: string) {
    const choice = hanjaByChar[slotKey(part, index, hangul)];
    return (
      <button
        key={`${part}-${index}`}
        type="button"
        className={`v3-char-slot${choice ? ' v3-char-slot--filled' : ''}`}
        onClick={() => setPicker({ part, index, hangul })}
        aria-label={`'${hangul}' 한자 고르기`}
      >
        <span className="v3-char-glyph">{choice ? choice.hanja : hangul}</span>
        <span className="v3-hint">
          {choice ? choice.meaning.split(',')[0] || choice.hanja : '한자 고르기'}
        </span>
      </button>
    );
  }

  function submit() {
    const buildChars = (part: 'surname' | 'givenName', chars: string[]): ProfileNameChar[] =>
      chars.map((hangul, index) => {
        const choice = hanjaByChar[slotKey(part, index, hangul)];
        // 순우리말 면제는 이름자에만 적용 — 성씨 한자는 항상 실어 보낸다.
        const skipHanja = pureHangul && part === 'givenName';
        return skipHanja || !choice
          ? { hangul }
          : { hangul, hanja: choice.hanja, meaning: choice.meaning };
      });
    onSubmit({
      surname: buildChars('surname', surnameChars),
      givenName: buildChars('givenName', givenChars),
      pureHangul,
      birth: {
        year,
        month,
        day: clampDay(day, year, month, calendarType),
        hour: timeUnknown ? null : hour,
        minute: timeUnknown ? null : minute,
        calendarType,
        isLeapMonth: calendarType === 'lunar' ? isLeapMonth : false,
        gender,
        trueSolarTime,
        yaza,
        region: region || null,
      },
    });
  }

  return (
    <div>
      <div className="v3-form-row">
        <div className="v3-field">
          <label className="v3-label">성</label>
          <input
            className="v3-input"
            placeholder="예: 김"
            value={surnameText}
            onChange={event => setSurnameText(event.target.value)}
            maxLength={2}
          />
        </div>
        <div className="v3-field" style={{ flex: '2 1 10rem' }}>
          <label className="v3-label">이름</label>
          <input
            className="v3-input"
            placeholder="예: 봄"
            value={givenText}
            onChange={event => setGivenText(event.target.value)}
            maxLength={4}
          />
        </div>
      </div>

      {nameReady ? (
        <div style={{ marginTop: '0.8rem' }}>
          <p className="v3-label" style={{ margin: '0 0 0.45rem' }}>
            {pureHangul ? '성씨 한자를 골라 주세요' : '글자마다 한자를 골라 주세요'}
          </p>
          <div className="v3-char-slots">
            {surnameChars.map((ch, i) => charSlot('surname', i, ch))}
            {pureHangul ? null : givenChars.map((ch, i) => charSlot('givenName', i, ch))}
          </div>
        </div>
      ) : null}
      {nameReady ? (
        <label className="v3-check" style={{ marginTop: '0.7rem' }}>
          <input
            type="checkbox"
            checked={pureHangul}
            onChange={event => setPureHangul(event.target.checked)}
          />
          이름은 한자가 없는 순우리말이에요 (성씨 한자는 골라 주세요)
        </label>
      ) : null}

      <div className="v3-form-row" style={{ marginTop: '0.8rem' }}>
        <div className="v3-field">
          <label className="v3-label">연도</label>
          <input
            className="v3-input"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2035}
            value={year}
            onChange={event => {
              const nextYear = Number(event.target.value);
              setYear(nextYear);
              setDay(current => clampDay(current, nextYear, month, calendarType));
            }}
          />
        </div>
        <div className="v3-field">
          <label className="v3-label">월</label>
          <select
            className="v3-select"
            value={month}
            onChange={event => {
              const nextMonth = Number(event.target.value);
              setMonth(nextMonth);
              setDay(current => clampDay(current, year, nextMonth, calendarType));
            }}
          >
            {MONTHS.map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </div>
        <div className="v3-field">
          <label className="v3-label">일</label>
          <select
            className="v3-select"
            value={clampDay(day, year, month, calendarType)}
            onChange={event => setDay(Number(event.target.value))}
          >
            {Array.from({ length: daysInMonth(year, month, calendarType) }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}일</option>
            ))}
          </select>
        </div>
      </div>

      <div className="v3-form-row" style={{ marginTop: '0.8rem', alignItems: 'center' }}>
        <div className="v3-segment" role="group" aria-label="달력 기준">
          <button
            type="button"
            aria-pressed={calendarType === 'solar'}
            onClick={() => {
              setCalendarType('solar');
              // 음력 30일 상태로 양력 전환 시에도 상태가 그 달 범위를 벗어나지 않게 한다.
              setDay(current => clampDay(current, year, month, 'solar'));
            }}
          >
            양력
          </button>
          <button
            type="button"
            aria-pressed={calendarType === 'lunar'}
            onClick={() => setCalendarType('lunar')}
          >
            음력
          </button>
        </div>
        {calendarType === 'lunar' ? (
          <label className="v3-check">
            <input
              type="checkbox"
              checked={isLeapMonth}
              onChange={event => setIsLeapMonth(event.target.checked)}
            />
            윤달이에요
          </label>
        ) : null}
      </div>

      <div className="v3-form-row" style={{ marginTop: '0.8rem', alignItems: 'flex-end' }}>
        <div className="v3-field">
          <label className="v3-label">태어난 시각</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              className="v3-select"
              aria-label="시"
              value={hour}
              disabled={timeUnknown}
              onChange={event => setHour(Number(event.target.value))}
            >
              {HOURS.map(h => (
                <option key={h} value={h}>{h}시</option>
              ))}
            </select>
            <select
              className="v3-select"
              aria-label="분"
              value={minute}
              disabled={timeUnknown}
              onChange={event => setMinute(Number(event.target.value))}
            >
              {MINUTES.map(m => (
                <option key={m} value={m}>{m}분</option>
              ))}
            </select>
          </div>
        </div>
        <label className="v3-check" style={{ paddingBottom: '0.7rem' }}>
          <input
            type="checkbox"
            checked={timeUnknown}
            onChange={event => setTimeUnknown(event.target.checked)}
          />
          태어난 시각을 몰라요
        </label>
      </div>

      <div className="v3-segment" role="group" aria-label="성별" style={{ marginTop: '0.8rem' }}>
        <button type="button" aria-pressed={gender === 'female'} onClick={() => setGender('female')}>
          여성
        </button>
        <button type="button" aria-pressed={gender === 'male'} onClick={() => setGender('male')}>
          남성
        </button>
        <button type="button" aria-pressed={gender === 'neutral'} onClick={() => setGender('neutral')}>
          선택하지 않음
        </button>
      </div>

      <details style={{ marginTop: '0.8rem' }}>
        <summary className="v3-hint" style={{ cursor: 'pointer' }}>
          시간 계산을 더 정밀하게 (진태양시·야자시·출생 지역)
        </summary>
        <div className="v3-form-row" style={{ marginTop: '0.7rem', alignItems: 'center' }}>
          <label className="v3-check">
            <input
              type="checkbox"
              checked={trueSolarTime}
              onChange={event => setTrueSolarTime(event.target.checked)}
            />
            진태양시 보정
          </label>
          <label className="v3-check">
            <input
              type="checkbox"
              checked={yaza}
              onChange={event => setYaza(event.target.checked)}
            />
            야자시 적용
          </label>
          <div className="v3-field" style={{ minWidth: '9rem' }}>
            <label className="v3-label">출생 지역</label>
            <select
              className="v3-select"
              value={region}
              onChange={event => setRegion(event.target.value)}
            >
              <option value="">선택 안 함</option>
              {KOREA_REGION_PRIMARY_ALIASES.map((name: string) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
      </details>

      <div style={{ marginTop: '0.9rem' }}>
        <button
          type="button"
          className="v3-button v3-button--wide"
          disabled={!canSubmit}
          onClick={submit}
        >
          {submitLabel}
        </button>
        {nameReady && !hanjaComplete ? (
          <p className="v3-hint" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            성씨 한자를 골라 주세요. 이름은 한자를 고르거나 순우리말로 표시할 수 있어요.
          </p>
        ) : null}
      </div>

      {picker ? (
        <HanjaPickerModal
          hangul={picker.hangul}
          isSurname={picker.part === 'surname'}
          onClose={() => setPicker(null)}
          onSelect={choice => {
            setHanjaByChar(prev => ({
              ...prev,
              [slotKey(picker.part, picker.index, picker.hangul)]: choice,
            }));
            setPicker(null);
          }}
        />
      ) : null}
    </div>
  );
}
