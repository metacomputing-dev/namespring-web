import { useMemo, useState } from 'react';
import { KOREA_REGION_PRIMARY_ALIASES } from '@spring/region-coordinates';
import { HanjaPickerModal, type HanjaChoice } from './HanjaPicker';
import {
  loadOriginalProfile,
  saveProfile,
  type ProfileNameChar,
  type V3Profile,
} from '../model/profile';
import { savePerson } from '../model/people';
import { clearDeliveryCache } from '../engine/client';

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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 본인 프로필 입력 폼 (구 '처음' 화면의 본체). 저장된 프로필이 있으면 그 값으로
 * 미리 채워서 고치는 흐름으로도 쓴다. 저장이 끝나면 onDone을 호출하고, 화면
 * 이동·갱신은 호출 쪽이 정한다.
 */
export default function ProfileSetupForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  /** 있으면 '그대로 두기' 버튼을 그린다 — 이미 보고서가 있는 상태에서 고치다 마는 경우. */
  onCancel?: () => void;
}) {
  const saved = useMemo(loadOriginalProfile, []);

  const [surnameText, setSurnameText] = useState(saved?.surname.map(c => c.hangul).join('') ?? '');
  const [givenText, setGivenText] = useState(saved?.givenName.map(c => c.hangul).join('') ?? '');
  const [hanjaByChar, setHanjaByChar] = useState<Record<string, HanjaChoice>>(() => {
    // 저장된 프로필을 고칠 때 이미 고른 한자(특히 성씨)를 다시 고르게 하지 않는다.
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
  const [alsoKeep, setAlsoKeep] = useState(false);

  const surnameChars = toChars(surnameText).slice(0, 2);
  const givenChars = toChars(givenText).slice(0, 4);
  const nameReady = surnameChars.length >= 1 && givenChars.length >= 1;
  const slotKey = (part: string, index: number, ch: string) => `${part}:${index}:${ch}`;
  // 성씨 한자는 순우리말 이름이어도 항상 필요하다 — 작명(사격수리)의 재료라서다.
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
        <span className="v3-hint">{choice ? choice.meaning.split(',')[0] : '한자 고르기'}</span>
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
    const profile: V3Profile = {
      surname: buildChars('surname', surnameChars),
      givenName: buildChars('givenName', givenChars),
      pureHangul,
      birth: {
        year,
        month,
        day,
        hour: timeUnknown ? null : hour,
        minute: timeUnknown ? null : minute,
        calendarType,
        isLeapMonth: calendarType === 'lunar' ? isLeapMonth : false,
        gender,
        trueSolarTime,
        yaza,
        region: region || null,
      },
    };
    saveProfile(profile);
    // 담아 두기를 켜면 이 이름을 보관함(담아 둔 이름)에도 넣어 나중에 바로 불러온다.
    if (alsoKeep) savePerson(profile);
    clearDeliveryCache();
    onDone();
  }

  return (
    <div>
      <section className="v3-card">
        <h2 className="v3-section-title" style={{ fontSize: '1.2rem' }}>
          어떤 이름인가요?
        </h2>
        <div className="v3-form-row" style={{ marginTop: '0.8rem' }}>
          <div className="v3-field">
            <label className="v3-label" htmlFor="v3-surname">성</label>
            <input
              id="v3-surname"
              className="v3-input"
              placeholder="예: 김"
              value={surnameText}
              onChange={event => setSurnameText(event.target.value)}
              maxLength={2}
            />
          </div>
          <div className="v3-field" style={{ flex: '2 1 14rem' }}>
            <label className="v3-label" htmlFor="v3-given">이름</label>
            <input
              id="v3-given"
              className="v3-input"
              placeholder="예: 봄"
              value={givenText}
              onChange={event => setGivenText(event.target.value)}
              maxLength={4}
            />
          </div>
        </div>
        {nameReady ? (
          <div style={{ marginTop: '0.9rem' }}>
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
          <label className="v3-check" style={{ marginTop: '0.8rem' }}>
            <input
              type="checkbox"
              checked={pureHangul}
              onChange={event => setPureHangul(event.target.checked)}
            />
            이름은 한자가 없는 순우리말이에요 (성씨 한자는 골라 주세요)
          </label>
        ) : null}
      </section>

      {nameReady ? (
        <section className="v3-card" style={{ marginTop: 'var(--space-sm)' }}>
          <h2 className="v3-section-title" style={{ fontSize: '1.2rem' }}>
            언제 태어났나요?
          </h2>
          <div className="v3-form-row" style={{ marginTop: '0.8rem' }}>
            <div className="v3-field">
              <label className="v3-label" htmlFor="v3-year">연도</label>
              <input
                id="v3-year"
                className="v3-input"
                type="number"
                inputMode="numeric"
                min={1900}
                max={2035}
                value={year}
                onChange={event => setYear(Number(event.target.value))}
              />
            </div>
            <div className="v3-field">
              <label className="v3-label" htmlFor="v3-month">월</label>
              <select
                id="v3-month"
                className="v3-select"
                value={month}
                onChange={event => setMonth(Number(event.target.value))}
              >
                {MONTHS.map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
            <div className="v3-field">
              <label className="v3-label" htmlFor="v3-day">일</label>
              <select
                id="v3-day"
                className="v3-select"
                value={Math.min(day, daysInMonth(year, month))}
                onChange={event => setDay(Number(event.target.value))}
              >
                {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map(d => (
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
                onClick={() => setCalendarType('solar')}
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
          <div className="v3-form-row" style={{ marginTop: '0.9rem', alignItems: 'flex-end' }}>
            <div className="v3-field">
              <label className="v3-label" htmlFor="v3-hour">태어난 시각</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  id="v3-hour"
                  className="v3-select"
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
          <details style={{ marginTop: '0.9rem' }}>
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
                <label className="v3-label" htmlFor="v3-region">출생 지역</label>
                <select
                  id="v3-region"
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
            <p className="v3-hint" style={{ marginTop: '0.5rem' }}>
              출생 지역을 고르면 그 지역의 경도로 시각을 보정해요.
            </p>
          </details>
        </section>
      ) : null}

      {nameReady ? (
        <section className="v3-card" style={{ marginTop: 'var(--space-sm)' }}>
          <h2 className="v3-section-title" style={{ fontSize: '1.2rem' }}>
            성별을 알려주시겠어요?
          </h2>
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
        </section>
      ) : null}

      {nameReady ? (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <label className="v3-check" style={{ marginBottom: '0.7rem' }}>
            <input
              type="checkbox"
              checked={alsoKeep}
              onChange={event => setAlsoKeep(event.target.checked)}
            />
            이 이름을 보관함(담아 둔 이름)에도 담아 두기
          </label>
          <button type="button" className="v3-button v3-button--wide" disabled={!canSubmit} onClick={submit}>
            {givenChars.length > 0
              ? `${surnameChars.join('')}${givenChars.join('')} 이야기 시작하기`
              : '이야기 시작하기'}
          </button>
          {!hanjaComplete ? (
            <p className="v3-hint" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              성씨 한자를 골라 주세요. 이름은 한자를 고르거나 순우리말로 표시할 수 있어요.
            </p>
          ) : null}
        </div>
      ) : null}

      {onCancel ? (
        <div style={{ marginTop: '0.6rem' }}>
          <button type="button" className="v3-button v3-button--ghost v3-button--wide" onClick={onCancel}>
            지금 정보 그대로 두기
          </button>
        </div>
      ) : null}

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
