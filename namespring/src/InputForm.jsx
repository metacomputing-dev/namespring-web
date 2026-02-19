import React, { useEffect, useMemo, useState } from 'react';
import { buildHangulPseudoEntry } from '@seed/utils/hangul-name-entry';

function limitLength(value, max) {
  return Array.from(value).slice(0, max).join('');
}

function extractCompletedHangul(value) {
  return Array.from(value)
    .filter((char) => /[\uAC00-\uD7A3]/.test(char))
    .join('');
}

function validateSurname(value) {
  return /^[\uAC00-\uD7A3]{1,2}$/.test(value);
}

function validateGivenName(value) {
  return /^[\uAC00-\uD7A3]{1,4}$/.test(value);
}

function toOptionalInt(value, min, max) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function isOptionalIntValid(value, min, max) {
  return value === '' || toOptionalInt(value, min, max) !== null;
}

function formatBirthPartsForDisplay({ year, month, day, hour, minute }) {
  const y = year || 'YYYY';
  const m = month || 'MM';
  const d = day || 'DD';
  const h = hour || 'HH';
  const mm = minute || 'mm';
  return `${y}.${m}.${d} ${h}:${mm}`;
}

function toHangulEntries(hangulText, selectedEntries, options = {}) {
  const chars = Array.from(hangulText);
  return chars.map((char, index) => {
    const selected = selectedEntries[index];
    if (!options.forceHangulOnly && selected && typeof selected === 'object') {
      return selected;
    }

    return buildHangulPseudoEntry(char, {
      hanja: options.hanja ?? '',
      isSurname: options.isSurname ?? false,
    });
  });
}

function hasSelectedHanjaForAllChars(hangulText, selectedEntries) {
  const chars = Array.from(hangulText);
  if (!chars.length) return false;

  return chars.every((_, index) => {
    const selected = selectedEntries[index];
    if (!selected || typeof selected !== 'object') return false;
    return String(selected.hanja ?? '').trim().length > 0;
  });
}

function InputForm({ hanjaRepo, isDbReady, onAnalyze, onEnter, submitLabel = '시작하기' }) {
  const [surnameInput, setSurnameInput] = useState('');
  const [givenNameInput, setGivenNameInput] = useState('');

  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthHour, setBirthHour] = useState('');
  const [birthMinute, setBirthMinute] = useState('');
  const [calendarType, setCalendarType] = useState('solar');

  const [gender, setGender] = useState('');

  const [pureHangulNameMode, setPureHangulNameMode] = useState('auto');

  const [selectedSurnameEntries, setSelectedSurnameEntries] = useState([]);
  const [selectedGivenNameEntries, setSelectedGivenNameEntries] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState({ type: 'last', index: 0, char: '' });
  const [hanjaOptions, setHanjaOptions] = useState([]);
  const [hanjaSearchKeyword, setHanjaSearchKeyword] = useState('');

  const surnameHangul = extractCompletedHangul(surnameInput);
  const givenNameHangul = extractCompletedHangul(givenNameInput);

  const isSurnameValid = validateSurname(surnameHangul);
  const isGivenNameValid = validateGivenName(givenNameHangul);
  const isNameTextValid = isSurnameValid && isGivenNameValid;
  const requiresFullHanjaSelection = pureHangulNameMode === 'off';
  const hasCompleteSurnameHanja = hasSelectedHanjaForAllChars(surnameHangul, selectedSurnameEntries);
  const hasCompleteGivenNameHanja = hasSelectedHanjaForAllChars(givenNameHangul, selectedGivenNameEntries);
  const isHanjaSelectionDone = !requiresFullHanjaSelection || (hasCompleteSurnameHanja && hasCompleteGivenNameHanja);
  const isNameSelectionDone = isNameTextValid && isHanjaSelectionDone;

  const isBirthInputValid =
    isOptionalIntValid(birthYear, 1, 9999)
    && isOptionalIntValid(birthMonth, 1, 12)
    && isOptionalIntValid(birthDay, 1, 31)
    && isOptionalIntValid(birthHour, 0, 23)
    && isOptionalIntValid(birthMinute, 0, 59);

  const isGenderDone = gender === 'female' || gender === 'male';

  const isPureHangulMode = pureHangulNameMode === 'on';

  useEffect(() => {
    setSelectedSurnameEntries((prev) => new Array(surnameHangul.length).fill(null).map((_, i) => prev[i] || null));
  }, [surnameHangul]);

  useEffect(() => {
    setSelectedGivenNameEntries((prev) => new Array(givenNameHangul.length).fill(null).map((_, i) => prev[i] || null));
  }, [givenNameHangul]);

  const filteredHanjaOptions = useMemo(() => {
    const keyword = hanjaSearchKeyword.trim();
    if (!keyword) return hanjaOptions;
    return hanjaOptions.filter((item) => {
      const source = `${item.hangul ?? ''} ${item.meaning ?? ''}`;
      return source.includes(keyword);
    });
  }, [hanjaOptions, hanjaSearchKeyword]);

  const openModal = () => {
    setIsModalOpen(true);
    window.setTimeout(() => setIsModalVisible(true), 10);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    window.setTimeout(() => setIsModalOpen(false), 220);
  };

  const searchHanja = async (char, type, index) => {
    if (!isDbReady) return;

    try {
      const results = type === 'last'
        ? await hanjaRepo.findSurnamesByHangul(char)
        : await hanjaRepo.findByHangul(char);

      setHanjaOptions(results);
      setHanjaSearchKeyword('');
      setModalTarget({ type, index, char });
      openModal();
    } catch {
      setHanjaOptions([]);
      setHanjaSearchKeyword('');
      setModalTarget({ type, index, char });
      openModal();
    }
  };

  const handleSelectHanja = (entry) => {
    if (modalTarget.type === 'last') {
      const next = [...selectedSurnameEntries];
      next[modalTarget.index] = entry;
      setSelectedSurnameEntries(next);
    } else {
      const next = [...selectedGivenNameEntries];
      next[modalTarget.index] = entry;
      setSelectedGivenNameEntries(next);
    }
    closeModal();
  };

  const handleSubmit = () => {
    if (!isNameSelectionDone || !isBirthInputValid || !isGenderDone) {
      alert('필수 입력값을 확인해 주세요.');
      return;
    }

    const year = toOptionalInt(birthYear, 1, 9999);
    const month = toOptionalInt(birthMonth, 1, 12);
    const day = toOptionalInt(birthDay, 1, 31);
    const hour = toOptionalInt(birthHour, 0, 23);
    const minute = toOptionalInt(birthMinute, 0, 59);

    const surnameEntries = toHangulEntries(surnameHangul, selectedSurnameEntries, {
      forceHangulOnly: isPureHangulMode,
      isSurname: true,
      hanja: '',
    });

    const givenNameEntries = toHangulEntries(givenNameHangul, selectedGivenNameEntries, {
      forceHangulOnly: isPureHangulMode,
      isSurname: false,
      hanja: '',
    });

    const payload = {
      lastName: surnameEntries,
      firstName: givenNameEntries,
      birthDateTime: {
        year,
        month,
        day,
        hour,
        minute,
        calendarType,
      },
      gender,
      options: {
        pureHangulNameMode,
      },
    };

    if (onEnter) {
      onEnter(payload);
      return;
    }
    if (onAnalyze) {
      onAnalyze(payload);
    }
  };

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-500">
        <section className="space-y-6 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-3xl p-6">
          <h3 className="text-base font-black text-[var(--ns-accent-text)]">이름 입력</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="text-[11px] font-black text-[var(--ns-muted)] mb-2 block">성</label>
              <input
                type="text"
                value={surnameInput}
                onChange={(e) => setSurnameInput(limitLength(e.target.value.replace(/\s/g, ''), 2))}
                className="w-full p-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl text-2xl font-black text-center text-[var(--ns-text)]"
                maxLength={2}
                placeholder="성"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[11px] font-black text-[var(--ns-muted)] mb-2 block">이름</label>
              <input
                type="text"
                value={givenNameInput}
                onChange={(e) => setGivenNameInput(limitLength(e.target.value.replace(/\s/g, ''), 4))}
                className="w-full p-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl text-2xl font-black text-center tracking-widest text-[var(--ns-text)]"
                maxLength={4}
                placeholder="이름"
              />
            </div>
          </div>

          <p className="text-[11px] font-semibold text-[var(--ns-muted)]">
            한자 선택은 선택사항입니다. 선택하지 않으면 순한글 기준으로 계산합니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {surnameHangul.length >= 1 && isSurnameValid && (
              <div className="animate-in fade-in duration-200 md:col-span-1">
                <p className="text-[11px] font-black text-[var(--ns-muted)] mb-2">성 한자 선택(선택)</p>
                <div className="flex gap-2 min-h-[84px]">
                  {surnameHangul.split('').map((char, i) => (
                    <button
                      key={`${char}-${i}`}
                      type="button"
                      onClick={() => searchHanja(char, 'last', i)}
                      className="flex-1 border-2 border-dashed border-[var(--ns-border)] rounded-2xl flex flex-col items-center justify-center hover:border-[var(--ns-primary)] bg-[var(--ns-surface)]"
                    >
                      {selectedSurnameEntries[i]
                        ? <span className="text-2xl font-serif font-black text-[var(--ns-text)]">{selectedSurnameEntries[i].hanja}</span>
                        : <span className="text-[10px] font-black text-[var(--ns-muted)]">한자 고르기</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {givenNameHangul.length >= 1 && isGivenNameValid && (
              <div className="animate-in fade-in duration-200 md:col-span-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)] mb-2">이름 한자 선택(선택)</p>
                <div className="grid grid-cols-2 gap-2 min-h-[84px]">
                  {givenNameHangul.split('').map((char, i) => (
                    <button
                      key={`${char}-${i}`}
                      type="button"
                      onClick={() => searchHanja(char, 'first', i)}
                      className="h-20 border-2 border-dashed border-[var(--ns-border)] rounded-2xl flex items-center justify-center hover:border-[var(--ns-primary)] bg-[var(--ns-surface)]"
                    >
                      {selectedGivenNameEntries[i]
                        ? <span className="text-3xl font-serif font-black text-[var(--ns-text)]">{selectedGivenNameEntries[i].hanja}</span>
                        : <span className="text-[10px] font-black text-[var(--ns-muted)]">한자 고르기</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {isNameSelectionDone && (
          <section className="space-y-4 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-3xl p-6 animate-in fade-in duration-300">
            <h3 className="text-base font-black text-[var(--ns-accent-text)]">생년월일시분 (부분 입력 가능)</h3>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-[11px] font-black text-[var(--ns-muted)] mb-1 block">년</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={birthYear}
                  onChange={(e) => setBirthYear(String(e.target.value).slice(0, 4))}
                  className={`w-full p-3 bg-[var(--ns-surface)] border rounded-2xl font-bold text-[var(--ns-text)] ${isOptionalIntValid(birthYear, 1, 9999) ? 'border-[var(--ns-border)]' : 'border-rose-300'}`}
                  placeholder="YYYY"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-[var(--ns-muted)] mb-1 block">월</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(String(e.target.value).slice(0, 2))}
                  className={`w-full p-3 bg-[var(--ns-surface)] border rounded-2xl font-bold text-[var(--ns-text)] ${isOptionalIntValid(birthMonth, 1, 12) ? 'border-[var(--ns-border)]' : 'border-rose-300'}`}
                  placeholder="MM"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-[var(--ns-muted)] mb-1 block">일</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={birthDay}
                  onChange={(e) => setBirthDay(String(e.target.value).slice(0, 2))}
                  className={`w-full p-3 bg-[var(--ns-surface)] border rounded-2xl font-bold text-[var(--ns-text)] ${isOptionalIntValid(birthDay, 1, 31) ? 'border-[var(--ns-border)]' : 'border-rose-300'}`}
                  placeholder="DD"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-[var(--ns-muted)] mb-1 block">시</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={birthHour}
                  onChange={(e) => setBirthHour(String(e.target.value).slice(0, 2))}
                  className={`w-full p-3 bg-[var(--ns-surface)] border rounded-2xl font-bold text-[var(--ns-text)] ${isOptionalIntValid(birthHour, 0, 23) ? 'border-[var(--ns-border)]' : 'border-rose-300'}`}
                  placeholder="HH"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-[var(--ns-muted)] mb-1 block">분</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={birthMinute}
                  onChange={(e) => setBirthMinute(String(e.target.value).slice(0, 2))}
                  className={`w-full p-3 bg-[var(--ns-surface)] border rounded-2xl font-bold text-[var(--ns-text)] ${isOptionalIntValid(birthMinute, 0, 59) ? 'border-[var(--ns-border)]' : 'border-rose-300'}`}
                  placeholder="mm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-3 space-y-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">달력 기준</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCalendarType('solar')}
                    className={`py-2 rounded-xl text-xs font-black border ${calendarType === 'solar' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
                  >
                    양력
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarType('lunar')}
                    className={`py-2 rounded-xl text-xs font-black border ${calendarType === 'lunar' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
                  >
                    음력
                  </button>
                </div>
                <p className="text-[11px] font-semibold text-[var(--ns-muted)]">윤달은 자동 처리됩니다.</p>
              </div>

              <div className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-3 space-y-2">
                <p className="text-[11px] font-black text-[var(--ns-muted)]">이름 옵션</p>
                <select
                  value={pureHangulNameMode}
                  onChange={(e) => setPureHangulNameMode(e.target.value)}
                  className="w-full p-2 rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] text-xs font-bold text-[var(--ns-text)]"
                >
                  <option value="auto">자동</option>
                  <option value="on">순한글 ON</option>
                  <option value="off">순한글 OFF</option>
                </select>
                {pureHangulNameMode === 'off' ? (
                  <p className="text-[11px] font-semibold text-[var(--ns-muted)]">
                    순한글 OFF에서는 성/이름 한자를 모두 선택해야 진행됩니다.
                  </p>
                ) : (
                  <p className="text-[11px] font-semibold text-[var(--ns-muted)]">
                    순한글 ON에서는 한자 값이 없어도 진행 가능합니다.
                  </p>
                )}
              </div>
            </div>

            <p className="text-[11px] font-semibold text-[var(--ns-muted)]">
              {formatBirthPartsForDisplay({
                year: birthYear,
                month: birthMonth,
                day: birthDay,
                hour: birthHour,
                minute: birthMinute,
              })}
            </p>
          </section>
        )}

        {isNameSelectionDone && (
          <section className="bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-3xl p-6 animate-in fade-in duration-300">
            <h3 className="text-base font-black text-[var(--ns-accent-text)] mb-3">성별</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`py-3 rounded-2xl font-black text-sm border ${gender === 'female' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                여성
              </button>
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`py-3 rounded-2xl font-black text-sm border ${gender === 'male' ? 'bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)]' : 'bg-[var(--ns-surface)] text-[var(--ns-muted)] border-[var(--ns-border)]'}`}
              >
                남성
              </button>
            </div>
          </section>
        )}

        {isGenderDone && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isDbReady}
            className="w-full py-6 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-[2rem] font-black text-lg hover:brightness-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed animate-in fade-in duration-300"
          >
            {submitLabel}
          </button>
        )}
      </div>

      {isModalOpen && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-colors duration-200 ${isModalVisible ? 'bg-black/35' : 'bg-black/0'}`}>
          <div className={`bg-[var(--ns-surface)] rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-[var(--ns-border)] transition-all duration-200 ${isModalVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <div className="p-6 bg-[var(--ns-surface-soft)] border-b border-[var(--ns-border)] flex justify-between items-center">
              <h3 className="font-black text-[var(--ns-text)] tracking-tight">'{modalTarget.char}' 한자 고르기</h3>
              <button type="button" onClick={closeModal} className="text-[var(--ns-muted)] hover:text-[var(--ns-primary)] text-2xl font-bold">&times;</button>
            </div>

            <div className="px-4 pt-4">
              <input
                type="text"
                value={hanjaSearchKeyword}
                onChange={(e) => setHanjaSearchKeyword(e.target.value)}
                placeholder="의미로 검색"
                className="w-full p-3 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-xl text-sm font-semibold text-[var(--ns-text)]"
              />
            </div>

            <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2">
              {filteredHanjaOptions.length === 0 && (
                <div className="p-6 text-center text-sm font-semibold text-[var(--ns-muted)]">
                  검색 결과가 없습니다.
                </div>
              )}
              {filteredHanjaOptions.map((item, idx) => (
                <button
                  key={`${item?.id ?? 'row'}-${idx}`}
                  type="button"
                  onClick={() => handleSelectHanja(item)}
                  className="w-full flex items-center justify-between p-4 hover:bg-[var(--ns-primary)] rounded-2xl transition-all group border border-transparent hover:text-[var(--ns-accent-text)]"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-4xl font-serif font-black text-[var(--ns-text)] group-hover:text-[var(--ns-accent-text)]">{item.hanja}</span>
                    <div className="text-left">
                      <p className="text-sm font-black text-[var(--ns-text)] group-hover:text-[var(--ns-accent-text)]">{item.meaning}</p>
                      <p className="text-[10px] opacity-70 font-bold">{item.strokes}획 · {item.hangul}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default InputForm;


