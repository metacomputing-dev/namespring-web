import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';

function limitLength(value, max) {
  return Array.from(value).slice(0, max).join('');
}

function extractCompletedHangul(value) {
  return Array.from(value).filter((char) => /[가-힣]/.test(char)).join('');
}

function validateSurname(value) {
  return /^[가-힣]{1,2}$/.test(value);
}

function validateGivenName(value) {
  return /^[가-힣]{1,4}$/.test(value);
}

const HANGUL_ONSETS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const HANGUL_NUCLEI = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const KOREAN_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_PICKER_COMPACT_STYLE = {
  '--rdp-day-height': '38px',
  '--rdp-day-width': '38px',
  '--rdp-day_button-height': '34px',
  '--rdp-day_button-width': '34px',
  '--rdp-nav-height': '2.1rem',
  '--rdp-nav_button-height': '1.9rem',
  '--rdp-nav_button-width': '1.9rem',
  '--rdp-weekday-padding': '0.2rem 0',
};

function decomposeHangulSyllable(char) {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) {
    return { onset: '', nucleus: '' };
  }

  const onsetIndex = Math.floor(code / 588);
  const nucleusIndex = Math.floor((code % 588) / 28);
  return {
    onset: HANGUL_ONSETS[onsetIndex] ?? '',
    nucleus: HANGUL_NUCLEI[nucleusIndex] ?? '',
  };
}

function isValidBirthTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function isValidBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function formatCalendarTypeLabel(isSolarCalendar) {
  return isSolarCalendar === false ? '음력' : '양력';
}

function formatBirthDateTimeForDisplay(isoDate, time, isBirthTimeUnknown, isSolarCalendar) {
  const calendarTypeLabel = formatCalendarTypeLabel(isSolarCalendar);
  if (!isoDate) return `${isBirthTimeUnknown ? 'YYYY.MM.DD' : 'YYYY.MM.DD HH:mm'} ${calendarTypeLabel}`;
  if (isBirthTimeUnknown) return `${isoDate.replace(/-/g, '.')} (시각 미상) ${calendarTypeLabel}`;
  const normalizedTime = isValidBirthTime(time) ? time : 'HH:mm';
  return `${isoDate.replace(/-/g, '.')} ${normalizedTime} ${calendarTypeLabel}`;
}

function formatTwoDigits(value) {
  return String(value).padStart(2, '0');
}

function formatDateToIso(date) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${formatTwoDigits(date.getMonth() + 1)}-${formatTwoDigits(date.getDate())}`;
}

function toPickerDateValue(isoDate, time) {
  if (!isValidBirthDate(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const [hour, minute] = isValidBirthTime(time) ? time.split(':').map(Number) : [12, 0];
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function isMobileViewport() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(max-width: 767px)').matches;
}

function toEntryHangulChar(entry) {
  return Array.from(extractCompletedHangul(String(entry?.hangul ?? '')))[0] ?? '';
}

function normalizeHangulInputText(value, maxLength) {
  return limitLength(extractCompletedHangul(String(value ?? '')), maxLength);
}

function toHangulInput(entries, maxLength) {
  if (!Array.isArray(entries)) return '';
  const text = entries.map((entry) => toEntryHangulChar(entry)).join('');
  return limitLength(text, maxLength);
}

function toSelectedEntries(entries, inputText) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  return Array.from(extractCompletedHangul(inputText)).map((char, index) => {
    const entry = safeEntries[index];
    const hanja = String(entry?.hanja ?? '').trim();
    if (!hanja) return null;
    return {
      ...entry,
      hangul: char,
      hanja,
    };
  });
}

function formatBirthDateForInput(birthDateTime) {
  const year = Number(birthDateTime?.year);
  const month = Number(birthDateTime?.month);
  const day = Number(birthDateTime?.day);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return '';
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatBirthTimeForInput(birthDateTime) {
  const hour = Number(birthDateTime?.hour);
  const minute = Number(birthDateTime?.minute);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return '12:00';
  const formatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return isValidBirthTime(formatted) ? formatted : '12:00';
}

function normalizeGender(value) {
  return value === 'female' || value === 'male' ? value : '';
}

function hasHanjaData(entries) {
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => String(entry?.hanja ?? '').trim().length > 0);
}

function toNativeKoreanEntries(hangulText, isSurname) {
  return Array.from(hangulText).map((char, index) => {
    const { onset, nucleus } = decomposeHangulSyllable(char);
    return {
      id: index + 1,
      hangul: char,
      hanja: '',
      onset,
      nucleus,
      strokes: 0,
      stroke_element: '',
      resource_element: '',
      meaning: '',
      radical: '',
      is_surname: Boolean(isSurname),
    };
  });
}

function buildInitialFormState(initialUserInfo) {
  const surnameEntries = Array.isArray(initialUserInfo?.lastName) ? initialUserInfo.lastName : [];
  const givenNameEntries = Array.isArray(initialUserInfo?.firstName) ? initialUserInfo.firstName : [];
  const surnameInput = toHangulInput(surnameEntries, 2)
    || normalizeHangulInputText(initialUserInfo?.lastNameText, 2);
  const givenNameInput = toHangulInput(givenNameEntries, 4)
    || normalizeHangulInputText(initialUserInfo?.firstNameText, 4);
  const hasNativeKoreanNameFlag = typeof initialUserInfo?.isNativeKoreanName === 'boolean';
  const isNativeKoreanName = hasNativeKoreanNameFlag
    ? Boolean(initialUserInfo?.isNativeKoreanName)
    : (!hasHanjaData(givenNameEntries) && givenNameInput.length > 0);

  return {
    surnameInput,
    givenNameInput,
    birthDate: formatBirthDateForInput(initialUserInfo?.birthDateTime),
    birthTime: formatBirthTimeForInput(initialUserInfo?.birthDateTime),
    isSolarCalendar: initialUserInfo?.isSolarCalendar !== false,
    isBirthTimeUnknown: Boolean(initialUserInfo?.isBirthTimeUnknown),
    gender: normalizeGender(initialUserInfo?.gender),
    isNativeKoreanName,
    selectedSurnameEntries: toSelectedEntries(surnameEntries, surnameInput),
    selectedGivenNameEntries: toSelectedEntries(givenNameEntries, givenNameInput),
  };
}

function InputForm({
  hanjaRepo,
  isDbReady,
  onAnalyze,
  onEnter,
  initialUserInfo = null,
  submitLabel = '시작하기',
}) {
  const initialFormState = useMemo(() => buildInitialFormState(initialUserInfo), [initialUserInfo]);
  const [surnameInput, setSurnameInput] = useState(initialFormState.surnameInput);
  const [givenNameInput, setGivenNameInput] = useState(initialFormState.givenNameInput);
  const [birthDate, setBirthDate] = useState(initialFormState.birthDate);
  const [birthTime, setBirthTime] = useState(initialFormState.birthTime);
  const [isSolarCalendar, setIsSolarCalendar] = useState(initialFormState.isSolarCalendar);
  const [isBirthTimeUnknown, setIsBirthTimeUnknown] = useState(initialFormState.isBirthTimeUnknown);
  const [gender, setGender] = useState(initialFormState.gender);
  const [isNativeKoreanName, setIsNativeKoreanName] = useState(initialFormState.isNativeKoreanName);

  const [selectedSurnameEntries, setSelectedSurnameEntries] = useState(initialFormState.selectedSurnameEntries);
  const [selectedGivenNameEntries, setSelectedGivenNameEntries] = useState(initialFormState.selectedGivenNameEntries);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalTarget, setModalTarget] = useState({ type: 'last', index: 0, char: '' });
  const [hanjaOptions, setHanjaOptions] = useState([]);
  const [hanjaSearchKeyword, setHanjaSearchKeyword] = useState('');
  const [isBirthPickerOpen, setIsBirthPickerOpen] = useState(false);
  const [isBirthPickerVisible, setIsBirthPickerVisible] = useState(false);
  const [draftBirthDate, setDraftBirthDate] = useState(null);
  const [draftBirthMonth, setDraftBirthMonth] = useState(null);
  const [draftBirthYear, setDraftBirthYear] = useState('');
  const [draftBirthHour, setDraftBirthHour] = useState(12);
  const [draftBirthMinute, setDraftBirthMinute] = useState(0);
  const [isBirthYearStepDone, setIsBirthYearStepDone] = useState(false);
  const [isBirthDateStepDone, setIsBirthDateStepDone] = useState(false);
  const nameStepRef = useRef(null);
  const birthStepRef = useRef(null);
  const genderStepRef = useRef(null);
  const submitStepRef = useRef(null);
  const hasAutoScrollInitializedRef = useRef(false);
  const prevStepVisibilityRef = useRef({
    isNameTextValid: false,
    isNameSelectionDone: false,
    isBirthDateTimeValid: false,
    isGenderDone: false,
  });

  const surnameHangul = extractCompletedHangul(surnameInput);
  const givenNameHangul = extractCompletedHangul(givenNameInput);

  const isSurnameValid = validateSurname(surnameHangul);
  const isGivenNameValid = validateGivenName(givenNameHangul);
  const isNameTextValid = isSurnameValid && isGivenNameValid;
  const isBirthDateValid = isValidBirthDate(birthDate);
  const isBirthTimeValid = isBirthTimeUnknown || isValidBirthTime(birthTime);
  const isBirthDateTimeValid = isBirthDateValid && isBirthTimeValid;
  const isGenderDone = gender !== '';
  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, value) => value), []);
  const minuteOptions = useMemo(() => [0, 10, 20, 30, 40, 50], []);
  const selectableYears = useMemo(() => {
    const startYear = 1900;
    const endYear = new Date().getFullYear();
    return Array.from({ length: endYear - startYear + 1 }, (_, index) => endYear - index);
  }, []);

  useEffect(() => {
    setSurnameInput(initialFormState.surnameInput);
    setGivenNameInput(initialFormState.givenNameInput);
    setBirthDate(initialFormState.birthDate);
    setBirthTime(initialFormState.birthTime);
    setIsSolarCalendar(initialFormState.isSolarCalendar);
    setIsBirthTimeUnknown(initialFormState.isBirthTimeUnknown);
    setGender(initialFormState.gender);
    setIsNativeKoreanName(initialFormState.isNativeKoreanName);
    setSelectedSurnameEntries(initialFormState.selectedSurnameEntries);
    setSelectedGivenNameEntries(initialFormState.selectedGivenNameEntries);
  }, [initialFormState]);

  useEffect(() => {
    setSelectedSurnameEntries((prev) => new Array(surnameHangul.length).fill(null).map((_, i) => prev[i] || null));
  }, [surnameHangul]);

  useEffect(() => {
    setSelectedGivenNameEntries((prev) => new Array(givenNameHangul.length).fill(null).map((_, i) => prev[i] || null));
  }, [givenNameHangul]);

  const isSurnameSelectionDone =
    selectedSurnameEntries.length === surnameHangul.length
    && !selectedSurnameEntries.includes(null);
  const isGivenNameSelectionDone =
    isNativeKoreanName
    || (
      selectedGivenNameEntries.length === givenNameHangul.length
      && !selectedGivenNameEntries.includes(null)
    );
  const isNameSelectionDone = isNameTextValid && isSurnameSelectionDone && isGivenNameSelectionDone;

  useEffect(() => {
    const current = {
      isNameTextValid,
      isNameSelectionDone,
      isBirthDateTimeValid,
      isGenderDone,
    };

    if (!hasAutoScrollInitializedRef.current) {
      hasAutoScrollInitializedRef.current = true;
      prevStepVisibilityRef.current = current;
      return;
    }

    const previous = prevStepVisibilityRef.current;
    prevStepVisibilityRef.current = current;
    if (!isMobileViewport()) return;

    let target = null;
    if (current.isGenderDone && !previous.isGenderDone) {
      target = submitStepRef.current;
    } else if (current.isBirthDateTimeValid && !previous.isBirthDateTimeValid) {
      target = genderStepRef.current;
    } else if (current.isNameSelectionDone && !previous.isNameSelectionDone) {
      target = birthStepRef.current;
    } else if (current.isNameTextValid && !previous.isNameTextValid) {
      target = nameStepRef.current;
    }

    if (!target) return;
    window.setTimeout(() => {
      target?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    }, 140);
  }, [isBirthDateTimeValid, isGenderDone, isNameSelectionDone, isNameTextValid]);

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

  const openBirthPicker = () => {
    const base = toPickerDateValue(birthDate, birthTime) ?? new Date();
    setDraftBirthDate(new Date(base.getFullYear(), base.getMonth(), base.getDate()));
    setDraftBirthMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setDraftBirthYear('');
    setDraftBirthHour(base.getHours());
    setDraftBirthMinute(Math.floor(base.getMinutes() / 10) * 10);
    setIsBirthYearStepDone(false);
    setIsBirthDateStepDone(false);
    setIsBirthPickerOpen(true);
    window.setTimeout(() => setIsBirthPickerVisible(true), 10);
  };

  const closeBirthPicker = () => {
    setIsBirthPickerVisible(false);
    window.setTimeout(() => setIsBirthPickerOpen(false), 220);
  };

  const applyBirthPicker = () => {
    if (!(draftBirthDate instanceof Date) || Number.isNaN(draftBirthDate.getTime())) {
      alert('생년월일을 선택해 주세요.');
      return;
    }

    setBirthDate(formatDateToIso(draftBirthDate));
    if (!isBirthTimeUnknown) {
      setBirthTime(`${formatTwoDigits(draftBirthHour)}:${formatTwoDigits(draftBirthMinute)}`);
    }
    closeBirthPicker();
  };

  const handleDraftBirthYearChange = (value) => {
    const nextYear = Number(value);
    if (!Number.isInteger(nextYear)) return;

    const baseDate = draftBirthDate ?? draftBirthMonth ?? new Date();
    const month = baseDate.getMonth();
    setDraftBirthYear(String(nextYear));
    setDraftBirthMonth(new Date(nextYear, month, 1));
    setDraftBirthDate(null);
    setIsBirthYearStepDone(true);
    setIsBirthDateStepDone(false);
  };

  const handleNativeKoreanNameToggle = (checked) => {
    setIsNativeKoreanName(checked);
    if (!checked) return;

    setSelectedGivenNameEntries(new Array(givenNameHangul.length).fill(null));
    setHanjaOptions([]);
    setHanjaSearchKeyword('');
    if (isModalOpen) {
      closeModal();
    }
  };

  const handleBirthTimeUnknownToggle = (checked) => {
    setIsBirthTimeUnknown(checked);
    if (!isValidBirthTime(birthTime)) {
      setBirthTime('12:00');
    }
  };

  const searchHanja = async (char, type, index) => {
    if (!isDbReady) return;
    if (isNativeKoreanName && type === 'first') return;
    const results = type === 'last'
      ? await hanjaRepo.findSurnamesByHangul(char)
      : await hanjaRepo.findByHangul(char);

    setHanjaOptions(results);
    setHanjaSearchKeyword('');
    setModalTarget({ type, index, char });
    openModal();
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
    if (!isBirthDateTimeValid || !isNameSelectionDone || !isGenderDone) {
      alert('모든 입력을 순서대로 완료해 주세요.');
      return;
    }

    const [year, month, day] = birthDate.split('-').map(Number);
    const [parsedHour, parsedMinute] = birthTime.split(':').map(Number);
    const hour = isBirthTimeUnknown ? 12 : parsedHour;
    const minute = isBirthTimeUnknown ? 0 : parsedMinute;
    const lastNameEntries = selectedSurnameEntries;
    const firstNameEntries = isNativeKoreanName
      ? toNativeKoreanEntries(givenNameHangul, false)
      : selectedGivenNameEntries;
    const payload = {
      lastName: lastNameEntries,
      firstName: firstNameEntries,
      lastNameText: surnameHangul,
      firstNameText: givenNameHangul,
      birthDateTime: { year, month, day, hour, minute },
      gender,
      isNativeKoreanName,
      isSolarCalendar,
      isBirthTimeUnknown,
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
          <h3 className="text-base font-black text-[var(--ns-accent-text)]">당신의 이름을 알려주세요.</h3>

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

          {isNameTextValid && (
            <div ref={nameStepRef} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {surnameHangul.length >= 1 && isSurnameValid && (
                  <div className={`animate-in fade-in duration-200 ${isNativeKoreanName ? 'md:col-span-3' : 'md:col-span-1'}`}>
                    <p className="text-[11px] font-black text-[var(--ns-muted)] mb-2">성 한자 고르기</p>
                    <div className="flex gap-2 min-h-[84px]">
                      {surnameHangul.split('').map((char, i) => (
                        <button
                          key={`${char}-${i}`}
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

                {!isNativeKoreanName && givenNameHangul.length >= 1 && isGivenNameValid && (
                  <div className="animate-in fade-in duration-200 md:col-span-2">
                    <p className="text-[11px] font-black text-[var(--ns-muted)] mb-2">이름 한자 고르기</p>
                    <div className="grid grid-cols-2 gap-2 min-h-[84px]">
                      {givenNameHangul.split('').map((char, i) => (
                        <button
                          key={`${char}-${i}`}
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

              <label className="flex items-center justify-center gap-2 text-xs font-black text-[var(--ns-muted)] select-none">
                <input
                  type="checkbox"
                  checked={isNativeKoreanName}
                  onChange={(e) => handleNativeKoreanNameToggle(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--ns-border)] accent-[var(--ns-primary)]"
                />
                순우리말
              </label>
            </div>
          )}
        </section>

        {isNameSelectionDone && (
          <section ref={birthStepRef} className="space-y-4 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-3xl p-6 animate-in fade-in duration-300">
            <h3 className="text-base font-black text-[var(--ns-accent-text)]">{`${surnameHangul}${givenNameHangul}`}님이 언제 태어났는지 알고싶어요.</h3>
            <label className="text-[11px] font-black text-[var(--ns-muted)] block">생년월일시분</label>
            <div className="space-y-3">
              <button
                type="button"
                onClick={openBirthPicker}
                className="w-full p-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-2xl font-bold text-left text-[var(--ns-text)] flex items-center justify-between"
              >
                <span>{formatBirthDateTimeForDisplay(birthDate, birthTime, isBirthTimeUnknown, isSolarCalendar)}</span>
                <span className="text-xs font-black text-[var(--ns-muted)]">선택</span>
              </button>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-black text-[var(--ns-muted)] select-none">
                  <input
                    type="checkbox"
                    checked={isSolarCalendar}
                    onChange={(e) => setIsSolarCalendar(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--ns-border)] accent-[var(--ns-primary)]"
                  />
                  양력
                </label>
                <label className="flex items-center gap-2 text-xs font-black text-[var(--ns-muted)] select-none">
                  <input
                    type="checkbox"
                    checked={isBirthTimeUnknown}
                    onChange={(e) => handleBirthTimeUnknownToggle(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--ns-border)] accent-[var(--ns-primary)]"
                  />
                  태어난 시각을 몰라요
                </label>
              </div>
            </div>
            <p className="text-[11px] font-semibold text-[var(--ns-muted)]">
              {formatBirthDateTimeForDisplay(birthDate, birthTime, isBirthTimeUnknown, isSolarCalendar)}
            </p>
          </section>
        )}

        {isBirthDateTimeValid && (
          <section ref={genderStepRef} className="bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-3xl p-6 animate-in fade-in duration-300">
            <h3 className="text-base font-black text-[var(--ns-accent-text)] mb-3">성별은요?</h3>
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
            ref={submitStepRef}
            onClick={handleSubmit}
            disabled={!isDbReady}
            className="w-full py-6 bg-[var(--ns-primary)] text-[var(--ns-accent-text)] rounded-[2rem] font-black text-lg hover:brightness-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed animate-in fade-in duration-300"
          >
            {submitLabel}
          </button>
        )}
      </div>

      {isBirthPickerOpen && (
        <div
          className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 z-50 transition-colors duration-200 ${isBirthPickerVisible ? 'bg-black/35' : 'bg-black/0'}`}
          onClick={closeBirthPicker}
        >
          <div
            className={`bg-[var(--ns-surface)] rounded-[2rem] w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl border border-[var(--ns-border)] transition-all duration-200 ${isBirthPickerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[var(--ns-surface-soft)] border-b border-[var(--ns-border)] flex justify-between items-center">
              <h3 className="font-black text-[var(--ns-text)] tracking-tight">생년월일시분 선택</h3>
              <button onClick={closeBirthPicker} className="text-[var(--ns-muted)] hover:text-[var(--ns-primary)] text-2xl font-bold">&times;</button>
            </div>

            <div className="px-4 py-3 space-y-3">
              <div className="mx-auto w-full max-w-[266px] space-y-3">
                <div className="space-y-1 animate-in fade-in duration-150">
                  <label className="text-[11px] font-black text-[var(--ns-muted)] block">년도 선택</label>
                  <select
                    value={draftBirthYear}
                    onChange={(event) => handleDraftBirthYearChange(event.target.value)}
                    className="w-full px-3 py-2 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-xl text-sm font-bold text-[var(--ns-text)]"
                  >
                    <option value="" disabled>
                      년도 선택
                    </option>
                    {selectableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}년
                      </option>
                    ))}
                  </select>
                </div>

                {isBirthYearStepDone && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <p className="text-[11px] font-black text-[var(--ns-muted)]">월/일 선택</p>
                    <DayPicker
                      mode="single"
                      showOutsideDays
                      fixedWeeks
                      selected={draftBirthDate ?? undefined}
                      month={draftBirthMonth ?? draftBirthDate ?? new Date()}
                      onMonthChange={(month) => setDraftBirthMonth(new Date(month.getFullYear(), month.getMonth(), 1))}
                      onSelect={(date) => {
                        if (!date) return;
                        setDraftBirthDate(date);
                        setDraftBirthMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                        setIsBirthDateStepDone(true);
                      }}
                      defaultMonth={draftBirthMonth ?? draftBirthDate ?? new Date()}
                      formatters={{
                        formatCaption: (month) => `${month.getFullYear()}년 ${month.getMonth() + 1}월`,
                        formatWeekdayName: (date) => KOREAN_WEEKDAY_LABELS[date.getDay()],
                      }}
                      className="mx-auto text-[13px]"
                      style={DAY_PICKER_COMPACT_STYLE}
                      styles={{
                        root: { margin: '0 auto' },
                        months: { margin: '0 auto' },
                        month: { margin: '0 auto' },
                        month_grid: { margin: '0 auto' },
                        month_caption: { fontSize: '1.02rem' },
                        weekday: { fontSize: '0.76rem' },
                        day_button: { fontSize: '1rem', fontWeight: 600 },
                      }}
                    />
                  </div>
                )}

                {isBirthYearStepDone && isBirthDateStepDone && !isBirthTimeUnknown && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <p className="text-[11px] font-black text-[var(--ns-muted)]">시/분 선택</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-0.5">
                        <span className="text-[11px] font-black text-[var(--ns-muted)] block">시</span>
                        <select
                          value={draftBirthHour}
                          onChange={(event) => setDraftBirthHour(Number(event.target.value))}
                          className="w-full px-3 py-2.5 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-xl text-sm font-bold text-[var(--ns-text)]"
                        >
                          {hourOptions.map((hour) => (
                            <option key={hour} value={hour}>
                              {formatTwoDigits(hour)}시
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[11px] font-black text-[var(--ns-muted)] block">분</span>
                        <select
                          value={draftBirthMinute}
                          onChange={(event) => setDraftBirthMinute(Number(event.target.value))}
                          className="w-full px-3 py-2.5 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-xl text-sm font-bold text-[var(--ns-text)]"
                        >
                          {minuteOptions.map((minute) => (
                            <option key={minute} value={minute}>
                              {formatTwoDigits(minute)}분
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={closeBirthPicker}
                  className="py-2.5 rounded-2xl font-black text-sm border bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] border-[var(--ns-border)]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={applyBirthPicker}
                  disabled={!isBirthYearStepDone || !isBirthDateStepDone}
                  className="py-2.5 rounded-2xl font-black text-sm border bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-colors duration-200 ${isModalVisible ? 'bg-black/35' : 'bg-black/0'}`}>
          <div className={`bg-[var(--ns-surface)] rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-[var(--ns-border)] transition-all duration-200 ${isModalVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <div className="p-6 bg-[var(--ns-surface-soft)] border-b border-[var(--ns-border)] flex justify-between items-center">
              <h3 className="font-black text-[var(--ns-text)] tracking-tight">'{modalTarget.char}' 한자 고르기</h3>
              <button onClick={closeModal} className="text-[var(--ns-muted)] hover:text-[var(--ns-primary)] text-2xl font-bold">&times;</button>
            </div>

            <div className="px-4 pt-4">
              <input
                type="text"
                value={hanjaSearchKeyword}
                onChange={(e) => setHanjaSearchKeyword(e.target.value)}
                placeholder="한글로 뜻 검색"
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
                <button key={idx} onClick={() => handleSelectHanja(item)} className="w-full flex items-center justify-between p-4 hover:bg-[var(--ns-primary)] rounded-2xl transition-all group border border-transparent hover:text-[var(--ns-accent-text)]">
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
