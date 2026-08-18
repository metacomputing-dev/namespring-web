import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { KOREA_REGION_PRIMARY_ALIASES } from '@spring/region-coordinates';
import { analyzeSaju } from '@spring/saju-adapter';
import { SegmentedControl } from './components/ui/SegmentedControl.jsx';
import { ToggleSwitch } from './components/ui/ToggleSwitch.jsx';
import { InfoList } from './components/report/ReportPrimitives';

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
const DEFAULT_BIRTH_REGION_LABEL = '서울';
const BIRTH_REGION_OPTIONS = Array.from(
  new Set([
    DEFAULT_BIRTH_REGION_LABEL,
    ...(Array.isArray(KOREA_REGION_PRIMARY_ALIASES) ? KOREA_REGION_PRIMARY_ALIASES : []),
  ]),
).filter((item) => typeof item === 'string' && item.trim().length > 0);

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

function toBirthDateTimeParts(isoDate, time, isBirthTimeUnknown) {
  if (!isValidBirthDate(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  if (isBirthTimeUnknown) {
    return { year, month, day, hour: 12, minute: 0 };
  }
  if (!isValidBirthTime(time)) return null;
  const [hour, minute] = time.split(':').map(Number);
  return { year, month, day, hour, minute };
}

function isValidCorrectedBirthDateTimeParts(parts) {
  if (!parts) return false;
  const isoDate = `${String(parts.year).padStart(4, '0')}-${formatTwoDigits(parts.month)}-${formatTwoDigits(parts.day)}`;
  const isoTime = `${formatTwoDigits(parts.hour)}:${formatTwoDigits(parts.minute)}`;
  return isValidBirthDate(isoDate) && isValidBirthTime(isoTime);
}

function formatBirthDateTimePartsForDisplay(parts, isSolarCalendar) {
  if (!isValidCorrectedBirthDateTimeParts(parts)) {
    return formatBirthDateTimeForDisplay('', '', false, isSolarCalendar);
  }
  const isoDate = `${String(parts.year).padStart(4, '0')}-${formatTwoDigits(parts.month)}-${formatTwoDigits(parts.day)}`;
  const isoTime = `${formatTwoDigits(parts.hour)}:${formatTwoDigits(parts.minute)}`;
  return formatBirthDateTimeForDisplay(isoDate, isoTime, false, isSolarCalendar);
}

function formatTwoDigits(value) {
  return String(value).padStart(2, '0');
}

function clampMinute(value) {
  return Math.max(0, Math.min(59, Number(value) || 0));
}

const WHEEL_ITEM_HEIGHT = 34;
const WHEEL_VISIBLE_ROWS = 3;
const WHEEL_VIEWPORT_HEIGHT = WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ROWS;
const WHEEL_SPACER_HEIGHT = (WHEEL_VIEWPORT_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

function clampWheelIndex(value, maxIndex) {
  return Math.max(0, Math.min(maxIndex, Number(value) || 0));
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

function normalizeBirthRegionOption(value) {
  const text = String(value ?? '').trim();
  return BIRTH_REGION_OPTIONS.includes(text) ? text : DEFAULT_BIRTH_REGION_LABEL;
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
    useYajasiAdjustment: Boolean(initialUserInfo?.useYajasiAdjustment),
    useTrueSolarTimeAdjustment: Boolean(initialUserInfo?.useTrueSolarTimeAdjustment),
    useBirthLongitudeAdjustment: initialUserInfo?.useBirthLongitudeAdjustment !== false,
    birthLongitudeOption: normalizeBirthRegionOption(initialUserInfo?.birthLongitudeOption),
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
  onProgressChange = null,
}) {
  const initialFormState = useMemo(() => buildInitialFormState(initialUserInfo), [initialUserInfo]);
  const [surnameInput, setSurnameInput] = useState(initialFormState.surnameInput);
  const [givenNameInput, setGivenNameInput] = useState(initialFormState.givenNameInput);
  const [birthDate, setBirthDate] = useState(initialFormState.birthDate);
  const [birthTime, setBirthTime] = useState(initialFormState.birthTime);
  const [isSolarCalendar, setIsSolarCalendar] = useState(initialFormState.isSolarCalendar);
  const [isBirthTimeUnknown, setIsBirthTimeUnknown] = useState(initialFormState.isBirthTimeUnknown);
  const [gender, setGender] = useState(initialFormState.gender);
  const [useYajasiAdjustment, setUseYajasiAdjustment] = useState(initialFormState.useYajasiAdjustment);
  const [useTrueSolarTimeAdjustment, setUseTrueSolarTimeAdjustment] = useState(initialFormState.useTrueSolarTimeAdjustment);
  const [useBirthLongitudeAdjustment, setUseBirthLongitudeAdjustment] = useState(initialFormState.useBirthLongitudeAdjustment);
  const [birthLongitudeOption, setBirthLongitudeOption] = useState(initialFormState.birthLongitudeOption);
  const [isNativeKoreanName, setIsNativeKoreanName] = useState(initialFormState.isNativeKoreanName);
  const [correctedBirthDateTimeParts, setCorrectedBirthDateTimeParts] = useState(() => (
    toBirthDateTimeParts(
      initialFormState.birthDate,
      initialFormState.birthTime,
      initialFormState.isBirthTimeUnknown,
    )
  ));
  const [isCorrectionPreviewLoading, setIsCorrectionPreviewLoading] = useState(false);

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
  const [draftBirthYearPreview, setDraftBirthYearPreview] = useState('');
  const [draftBirthHour, setDraftBirthHour] = useState(12);
  const [draftBirthMinute, setDraftBirthMinute] = useState(0);
  const [isBirthYearStepDone, setIsBirthYearStepDone] = useState(false);
  const [isBirthDateStepDone, setIsBirthDateStepDone] = useState(false);
  const [step, setStep] = useState(0);
  const yearWheelRef = useRef(null);
  const hourWheelRef = useRef(null);
  const minuteWheelRef = useRef(null);
  const yearWheelTimerRef = useRef(null);
  const yearCommitTimerRef = useRef(null);
  const hourWheelTimerRef = useRef(null);
  const minuteWheelTimerRef = useRef(null);
  const correctionRequestIdRef = useRef(0);
  const yearWheelSyncRef = useRef(false);

  const surnameHangul = extractCompletedHangul(surnameInput);
  const givenNameHangul = extractCompletedHangul(givenNameInput);

  const isSurnameValid = validateSurname(surnameHangul);
  const isGivenNameValid = validateGivenName(givenNameHangul);
  const isNameTextValid = isSurnameValid && isGivenNameValid;
  const isBirthDateValid = isValidBirthDate(birthDate);
  const isBirthTimeValid = isBirthTimeUnknown || isValidBirthTime(birthTime);
  const isBirthDateTimeValid = isBirthDateValid && isBirthTimeValid;
  const isGenderDone = gender !== '';
  const correctedBirthDateTimeLabel = useMemo(() => {
    if (isBirthTimeUnknown) {
      return formatBirthDateTimeForDisplay(birthDate, birthTime, true, isSolarCalendar);
    }
    const fallback = toBirthDateTimeParts(birthDate, birthTime, false);
    return formatBirthDateTimePartsForDisplay(correctedBirthDateTimeParts ?? fallback, isSolarCalendar);
  }, [birthDate, birthTime, correctedBirthDateTimeParts, isBirthTimeUnknown, isSolarCalendar]);
  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, value) => value), []);
  const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, value) => value), []);
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
    setUseYajasiAdjustment(initialFormState.useYajasiAdjustment);
    setUseTrueSolarTimeAdjustment(initialFormState.useTrueSolarTimeAdjustment);
    setUseBirthLongitudeAdjustment(initialFormState.useBirthLongitudeAdjustment);
    setBirthLongitudeOption(initialFormState.birthLongitudeOption);
    setIsNativeKoreanName(initialFormState.isNativeKoreanName);
    setCorrectedBirthDateTimeParts(
      toBirthDateTimeParts(
        initialFormState.birthDate,
        initialFormState.birthTime,
        initialFormState.isBirthTimeUnknown,
      ),
    );
    setIsCorrectionPreviewLoading(false);
    correctionRequestIdRef.current += 1;
    setSelectedSurnameEntries(initialFormState.selectedSurnameEntries);
    setSelectedGivenNameEntries(initialFormState.selectedGivenNameEntries);
  }, [initialFormState]);

  useEffect(() => {
    setSelectedSurnameEntries((prev) => new Array(surnameHangul.length).fill(null).map((_, i) => prev[i] || null));
  }, [surnameHangul]);

  useEffect(() => {
    setSelectedGivenNameEntries((prev) => new Array(givenNameHangul.length).fill(null).map((_, i) => prev[i] || null));
  }, [givenNameHangul]);

  useEffect(() => {
    return () => {
      if (yearWheelTimerRef.current) window.clearTimeout(yearWheelTimerRef.current);
      if (yearCommitTimerRef.current) window.clearTimeout(yearCommitTimerRef.current);
      if (hourWheelTimerRef.current) window.clearTimeout(hourWheelTimerRef.current);
      if (minuteWheelTimerRef.current) window.clearTimeout(minuteWheelTimerRef.current);
    };
  }, []);

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

  const goToStep = (nextStep) => {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (typeof onProgressChange !== 'function') return;
    onProgressChange({
      step,
      isNameSelectionDone,
      isBirthDateTimeValid,
      isGenderDone,
    });
  }, [onProgressChange, step, isNameSelectionDone, isBirthDateTimeValid, isGenderDone]);

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
    const existing = toPickerDateValue(birthDate, birthTime);
    const base = existing ?? new Date();
    const hasExistingBirthDate = Boolean(existing);
    const initialYear = hasExistingBirthDate ? base.getFullYear() : new Date().getFullYear();
    setDraftBirthDate(new Date(base.getFullYear(), base.getMonth(), base.getDate()));
    setDraftBirthMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setDraftBirthYear(String(initialYear));
    setDraftBirthYearPreview(String(initialYear));
    setDraftBirthHour(base.getHours());
    const normalizedMinute = clampMinute(base.getMinutes());
    setDraftBirthMinute(normalizedMinute);
    setIsBirthYearStepDone(hasExistingBirthDate);
    setIsBirthDateStepDone(hasExistingBirthDate);
    setIsBirthPickerOpen(true);
    window.setTimeout(() => setIsBirthPickerVisible(true), 10);
  };

  const closeBirthPicker = () => {
    if (yearCommitTimerRef.current) {
      window.clearTimeout(yearCommitTimerRef.current);
      yearCommitTimerRef.current = null;
    }
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

  const handleDraftBirthYearSelect = (yearValue) => {
    const nextYear = Number(yearValue);
    if (!Number.isInteger(nextYear)) return;
    if (String(nextYear) === draftBirthYear) return;

    const baseDate = draftBirthDate ?? draftBirthMonth ?? new Date();
    const month = baseDate.getMonth();
    setDraftBirthYear(String(nextYear));
    setDraftBirthYearPreview(String(nextYear));
    setDraftBirthMonth(new Date(nextYear, month, 1));
    setDraftBirthDate(null);
    setIsBirthYearStepDone(true);
    setIsBirthDateStepDone(false);
  };

  const scheduleDraftBirthYearCommit = (yearValue) => {
    if (yearCommitTimerRef.current) {
      window.clearTimeout(yearCommitTimerRef.current);
    }

    yearCommitTimerRef.current = window.setTimeout(() => {
      handleDraftBirthYearSelect(yearValue);
      yearCommitTimerRef.current = null;
    }, 500);
  };

  useEffect(() => {
    if (!isBirthPickerOpen) return;
    const selectedYear = Number(draftBirthYear);
    if (!Number.isInteger(selectedYear)) return;
    const selectedIndex = selectableYears.indexOf(selectedYear);
    if (selectedIndex < 0) return;

    yearWheelSyncRef.current = true;
    const timer = window.setTimeout(() => {
      yearWheelRef.current?.scrollTo({ top: selectedIndex * WHEEL_ITEM_HEIGHT, behavior: 'auto' });
      window.setTimeout(() => {
        yearWheelSyncRef.current = false;
      }, 120);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isBirthPickerOpen, draftBirthYear, selectableYears]);

  const handleYearWheelScroll = () => {
    if (yearWheelSyncRef.current) return;
    const wheel = yearWheelRef.current;
    if (!wheel) return;

    const selectedIndex = clampWheelIndex(
      Math.round(wheel.scrollTop / WHEEL_ITEM_HEIGHT),
      Math.max(0, selectableYears.length - 1),
    );
    const nextYear = selectableYears[selectedIndex];
    if (String(nextYear) !== draftBirthYearPreview) {
      setDraftBirthYearPreview(String(nextYear));
    }
    scheduleDraftBirthYearCommit(nextYear);

    if (yearWheelTimerRef.current) window.clearTimeout(yearWheelTimerRef.current);
    yearWheelTimerRef.current = window.setTimeout(() => {
      wheel.scrollTo({ top: selectedIndex * WHEEL_ITEM_HEIGHT, behavior: 'smooth' });
    }, 90);
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

  useEffect(() => {
    if (!isBirthDateTimeValid || isBirthTimeUnknown) {
      correctionRequestIdRef.current += 1;
      setIsCorrectionPreviewLoading(false);
      setCorrectedBirthDateTimeParts(toBirthDateTimeParts(birthDate, birthTime, isBirthTimeUnknown));
      return;
    }

    const baseParts = toBirthDateTimeParts(birthDate, birthTime, false);
    if (!baseParts) {
      correctionRequestIdRef.current += 1;
      setIsCorrectionPreviewLoading(false);
      setCorrectedBirthDateTimeParts(null);
      return;
    }

    const requestId = correctionRequestIdRef.current + 1;
    correctionRequestIdRef.current = requestId;
    setIsCorrectionPreviewLoading(true);

    const runCorrectionPreview = async () => {
      try {
        const summary = await analyzeSaju(
          {
            year: baseParts.year,
            month: baseParts.month,
            day: baseParts.day,
            hour: baseParts.hour,
            minute: baseParts.minute,
            gender: 'male',
            calendarType: isSolarCalendar ? 'solar' : 'lunar',
            region: useBirthLongitudeAdjustment ? birthLongitudeOption : undefined,
            birthPlace: useBirthLongitudeAdjustment ? birthLongitudeOption : undefined,
          },
          {
            sajuTimePolicy: {
              yaza: useYajasiAdjustment ? 'on' : 'off',
              trueSolarTime: useTrueSolarTimeAdjustment ? 'on' : 'off',
              longitudeCorrection: useBirthLongitudeAdjustment ? 'on' : 'off',
            },
          },
        );

        if (correctionRequestIdRef.current !== requestId) return;

        const timeCorrection = summary?.timeCorrection;
        const nextParts = {
          year: Number(timeCorrection?.adjustedYear),
          month: Number(timeCorrection?.adjustedMonth),
          day: Number(timeCorrection?.adjustedDay),
          hour: Number(timeCorrection?.adjustedHour),
          minute: Number(timeCorrection?.adjustedMinute),
        };

        if (isValidCorrectedBirthDateTimeParts(nextParts)) {
          setCorrectedBirthDateTimeParts(nextParts);
        } else {
          setCorrectedBirthDateTimeParts(baseParts);
        }
      } catch {
        if (correctionRequestIdRef.current !== requestId) return;
        setCorrectedBirthDateTimeParts(baseParts);
      } finally {
        if (correctionRequestIdRef.current === requestId) {
          setIsCorrectionPreviewLoading(false);
        }
      }
    };

    runCorrectionPreview();
  }, [
    birthDate,
    birthTime,
    birthLongitudeOption,
    isBirthDateTimeValid,
    isBirthTimeUnknown,
    isSolarCalendar,
    useBirthLongitudeAdjustment,
    useTrueSolarTimeAdjustment,
    useYajasiAdjustment,
  ]);

  useEffect(() => {
    if (!isBirthPickerOpen || !isBirthYearStepDone || !isBirthDateStepDone || isBirthTimeUnknown) return;
    const timer = window.setTimeout(() => {
      const hourWheel = hourWheelRef.current;
      const minuteWheel = minuteWheelRef.current;
      if (hourWheel) hourWheel.scrollTo({ top: draftBirthHour * WHEEL_ITEM_HEIGHT, behavior: 'auto' });
      if (minuteWheel) minuteWheel.scrollTo({ top: draftBirthMinute * WHEEL_ITEM_HEIGHT, behavior: 'auto' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isBirthPickerOpen, isBirthYearStepDone, isBirthDateStepDone, isBirthTimeUnknown, draftBirthHour, draftBirthMinute]);

  const handleHourWheelScroll = () => {
    const wheel = hourWheelRef.current;
    if (!wheel) return;

    if (hourWheelTimerRef.current) window.clearTimeout(hourWheelTimerRef.current);
    hourWheelTimerRef.current = window.setTimeout(() => {
      const settledHour = clampWheelIndex(Math.round(wheel.scrollTop / WHEEL_ITEM_HEIGHT), 23);
      wheel.scrollTo({ top: settledHour * WHEEL_ITEM_HEIGHT, behavior: 'auto' });
      setDraftBirthHour((prev) => (prev === settledHour ? prev : settledHour));
    }, 120);
  };

  const handleMinuteWheelScroll = () => {
    const wheel = minuteWheelRef.current;
    if (!wheel) return;

    if (minuteWheelTimerRef.current) window.clearTimeout(minuteWheelTimerRef.current);
    minuteWheelTimerRef.current = window.setTimeout(() => {
      const settledMinute = clampMinute(Math.round(wheel.scrollTop / WHEEL_ITEM_HEIGHT));
      wheel.scrollTo({ top: settledMinute * WHEEL_ITEM_HEIGHT, behavior: 'auto' });
      setDraftBirthMinute((prev) => (prev === settledMinute ? prev : settledMinute));
    }, 120);
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
      useYajasiAdjustment,
      useTrueSolarTimeAdjustment,
      useBirthLongitudeAdjustment,
      birthLongitudeOption: useBirthLongitudeAdjustment ? birthLongitudeOption : '',
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
      <div className="ns-section-stack animate-in fade-in duration-500">
        {step === 0 ? (
          <fieldset className="space-y-5">
            <legend className="text-lg font-bold tracking-tight text-[var(--ns-text)]">누구의 이름인가요?</legend>
            <p className="text-sm text-[var(--ns-muted)]">한글을 적으면 어울리는 한자 후보를 보여 드려요. 한자를 몰라도 괜찮아요.</p>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--color-ink-2)]">성</label>
              <input
                type="text"
                value={surnameInput}
                onChange={(e) => setSurnameInput(limitLength(e.target.value.replace(/\s/g, ''), 2))}
                className="ns-field"
                maxLength={2}
                placeholder="예: 김"
              />
              {isSurnameValid ? (
                <div className="mt-2.5 flex flex-wrap gap-2" aria-label="성 한자 선택">
                  {surnameHangul.split('').map((char, i) => (
                    <button
                      key={`${char}-${i}`}
                      type="button"
                      onClick={() => searchHanja(char, 'last', i)}
                      className={`ns-pick-chip ${selectedSurnameEntries[i] ? 'ns-pick-chip--filled' : 'ns-pick-chip--empty'}`}
                    >
                      {selectedSurnameEntries[i]
                        ? <><span className="font-serif text-lg">{selectedSurnameEntries[i].hanja}</span>{char}</>
                        : `${char} 한자 고르기`}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--color-ink-2)]">
                이름 <span className="font-normal text-[var(--ns-muted)]">(한 글자~네 글자)</span>
              </label>
              <input
                type="text"
                value={givenNameInput}
                onChange={(e) => setGivenNameInput(limitLength(e.target.value.replace(/\s/g, ''), 4))}
                className="ns-field"
                maxLength={4}
                placeholder="예: 민아"
              />
              {!isNativeKoreanName && isGivenNameValid ? (
                <div className="mt-2.5 flex flex-wrap gap-2" aria-label="이름 한자 선택">
                  {givenNameHangul.split('').map((char, i) => (
                    <button
                      key={`${char}-${i}`}
                      type="button"
                      onClick={() => searchHanja(char, 'first', i)}
                      className={`ns-pick-chip ${selectedGivenNameEntries[i] ? 'ns-pick-chip--filled' : 'ns-pick-chip--empty'}`}
                    >
                      {selectedGivenNameEntries[i]
                        ? <><span className="font-serif text-lg">{selectedGivenNameEntries[i].hanja}</span>{char}</>
                        : `${char} 한자 고르기`}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--ns-muted)] select-none">
              <ToggleSwitch
                checked={isNativeKoreanName}
                onChange={handleNativeKoreanNameToggle}
              />
              순우리말 이름이에요
            </label>

            <p className="rounded-2xl bg-[var(--color-accent-quiet)] px-4 py-3 text-xs leading-relaxed text-[var(--color-accent)]">
              순한글 이름도 분석할 수 있어요. 한자를 고르지 않으면 소리와 획수 중심으로 풀어 드려요.
            </p>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => goToStep(1)}
                disabled={!isNameSelectionDone}
                className="ns-cta-pill ns-cta-pill--ghost disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음, 태어난 순간
                <span className="ns-cta-pill__puck" aria-hidden="true">→</span>
              </button>
            </div>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset className="space-y-5">
            <legend className="text-lg font-bold tracking-tight text-[var(--ns-text)]">태어난 순간을 알려 주세요</legend>
            <p className="text-sm text-[var(--ns-muted)]">사주라는 과녁을 세우는 데 쓰여요. 시간을 몰라도 진행할 수 있어요.</p>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--color-ink-2)]">생년월일시분</label>
              <button
                type="button"
                onClick={openBirthPicker}
                className="ns-field flex items-center justify-between gap-3 text-left font-bold"
              >
                <span>{formatBirthDateTimeForDisplay(birthDate, birthTime, isBirthTimeUnknown, isSolarCalendar)}</span>
                <span className="text-xs font-black text-[var(--ns-muted)]">선택</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                name="calendarType"
                value={isSolarCalendar ? 'solar' : 'lunar'}
                options={[
                  { value: 'solar', label: '양력' },
                  { value: 'lunar', label: '음력' },
                ]}
                onChange={(value) => setIsSolarCalendar(value === 'solar')}
              />
              <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-[var(--ns-muted)] select-none">
                <ToggleSwitch
                  checked={isBirthTimeUnknown}
                  onChange={handleBirthTimeUnknownToggle}
                />
                시간을 몰라요
              </label>
            </div>

            {isBirthTimeUnknown ? (
              <p className="rounded-2xl bg-[var(--color-warn-bg)] px-4 py-3 text-xs leading-relaxed text-[var(--color-warn)]">
                시간 없이도 보고서를 만들 수 있어요. 다만 사주 쪽 판정 몇 가지는 참고 수준으로 표시돼요.
              </p>
            ) : null}

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-[var(--color-ink-2)]">성별</span>
              <SegmentedControl
                name="gender"
                className="ns-seg--stretch w-full"
                value={gender}
                options={[
                  { value: 'female', label: '여성' },
                  { value: 'male', label: '남성' },
                ]}
                onChange={setGender}
              />
            </div>

            {!isBirthTimeUnknown ? (
              <details className="rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-[var(--color-ink-2)]">
                  세밀하게 맞추기 <span className="font-normal text-[var(--ns-muted)]">(출생지·시간 보정)</span>
                </summary>
                <div className="mt-4 space-y-4 border-t border-[var(--ns-border)] pt-4">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink-2)] select-none">
                      <ToggleSwitch
                        checked={useBirthLongitudeAdjustment}
                        onChange={(checked) => {
                          setUseBirthLongitudeAdjustment(checked);
                          if (checked && !birthLongitudeOption) {
                            setBirthLongitudeOption(DEFAULT_BIRTH_REGION_LABEL);
                          }
                        }}
                      />
                      태어난 지역으로 보정
                    </label>
                    {useBirthLongitudeAdjustment && (
                      <select
                        value={birthLongitudeOption}
                        onChange={(e) => setBirthLongitudeOption(e.target.value)}
                        className="ml-auto min-w-[92px] rounded-2xl border border-[var(--ns-border)] bg-[var(--ns-surface)] p-2 text-xs font-semibold text-[var(--ns-text)]"
                      >
                        {BIRTH_REGION_OPTIONS.map((regionLabel) => (
                          <option key={`birth-region-${regionLabel}`} value={regionLabel}>
                            {regionLabel}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <label className="flex items-start justify-between gap-3 text-sm select-none">
                    <span>
                      <b className="font-semibold text-[var(--color-ink-2)]">진태양시 보정</b>
                      <br />
                      <span className="text-xs text-[var(--ns-muted)]">태어난 지역의 실제 태양 시각으로 맞춰요</span>
                    </span>
                    <ToggleSwitch
                      className="mt-1"
                      checked={useTrueSolarTimeAdjustment}
                      onChange={setUseTrueSolarTimeAdjustment}
                    />
                  </label>

                  <label className="flex items-start justify-between gap-3 text-sm select-none">
                    <span>
                      <b className="font-semibold text-[var(--color-ink-2)]">야자시로 다루기</b>
                      <br />
                      <span className="text-xs text-[var(--ns-muted)]">밤 11시대 출생을 다음 날 자시로 보는 방식이에요</span>
                    </span>
                    <ToggleSwitch
                      className="mt-1"
                      checked={useYajasiAdjustment}
                      onChange={setUseYajasiAdjustment}
                    />
                  </label>

                  <div>
                    <p className="text-2xs font-black text-[var(--ns-muted)]">보정된 생년월일시분</p>
                    <p className="mt-1 text-2xs font-semibold text-[var(--ns-muted)]">
                      {isCorrectionPreviewLoading ? '보정 계산 중...' : correctedBirthDateTimeLabel}
                    </p>
                  </div>
                </div>
              </details>
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => goToStep(0)}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold text-[var(--ns-muted)] transition-colors hover:text-[var(--ns-text)]"
              >
                ← 이전
              </button>
              <button
                type="button"
                onClick={() => goToStep(2)}
                disabled={!isBirthDateTimeValid || !isGenderDone}
                className="ns-cta-pill ns-cta-pill--ghost disabled:opacity-50 disabled:cursor-not-allowed"
              >
                마지막 확인
                <span className="ns-cta-pill__puck" aria-hidden="true">→</span>
              </button>
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset className="space-y-5">
            <legend className="text-lg font-bold tracking-tight text-[var(--ns-text)]">이대로 만들까요?</legend>
            <p className="text-sm text-[var(--ns-muted)]">입력한 내용을 한 번만 확인해 주세요. 언제든 돌아와 고칠 수 있어요.</p>

            <InfoList
              items={[
                {
                  label: '이름',
                  value: `${surnameHangul}${givenNameHangul}${isNativeKoreanName
                    ? ' (순우리말)'
                    : ` (${[...selectedSurnameEntries, ...selectedGivenNameEntries]
                      .map((entry) => String(entry?.hanja ?? '')).join('')})`}`,
                },
                {
                  label: '태어난 순간',
                  value: formatBirthDateTimeForDisplay(birthDate, birthTime, isBirthTimeUnknown, isSolarCalendar),
                },
                { label: '성별', value: gender === 'female' ? '여성' : '남성' },
                {
                  label: '보정 옵션',
                  value: isBirthTimeUnknown
                    ? '시각 미상 (시주 제외)'
                    : [
                      useTrueSolarTimeAdjustment ? '진태양시' : null,
                      useBirthLongitudeAdjustment ? `경도(${birthLongitudeOption})` : null,
                      useYajasiAdjustment ? '야자시' : null,
                    ].filter(Boolean).join(' · ') || '없음',
                },
              ]}
            />

            <p className="rounded-2xl bg-[var(--color-accent-quiet)] px-4 py-3 text-xs leading-relaxed text-[var(--color-accent)]">
              입력한 정보는 보고서를 만드는 데만 쓰여요. 판정 근거는 보고서 맨 아래에서 전부 확인할 수 있어요.
            </p>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 py-3 text-sm font-semibold text-[var(--ns-muted)] transition-colors hover:text-[var(--ns-text)]"
              >
                ← 이전
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isDbReady}
                className="ns-cta-pill ns-cta-pill--primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitLabel}
                <span className="ns-cta-pill__puck" aria-hidden="true">→</span>
              </button>
            </div>
          </fieldset>
        ) : null}
      </div>

      {isBirthPickerOpen && (
        <div
          className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 z-50 transition-colors duration-200 ${isBirthPickerVisible ? 'bg-black/35' : 'bg-black/0'}`}
          onClick={closeBirthPicker}
        >
          <div
            className={`bg-[var(--ns-surface)] rounded-[2rem] w-full max-w-md max-h-[92vh] overflow-y-auto shadow-2xl border border-[var(--ns-border)] transition-all duration-200 ${isBirthPickerVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-3 py-2.5 md:px-5 md:py-4 bg-[var(--ns-surface-soft)] border-b border-[var(--ns-border)] flex justify-between items-center">
              <h3 className="font-black text-[var(--ns-text)] tracking-tight">생년월일시분 선택</h3>
              <button onClick={closeBirthPicker} className="text-[var(--ns-muted)] hover:text-[var(--ns-primary)] text-2xl font-bold">&times;</button>
            </div>

            <div className="px-2.5 py-2 md:px-4 md:py-3 space-y-2 md:space-y-3">
              <div className="mx-auto w-full max-w-[220px] md:max-w-[266px] space-y-2 md:space-y-3">
                <div className="space-y-1 animate-in fade-in duration-150">
                  <label className="text-[11px] font-black text-[var(--ns-muted)] block">년도 선택</label>
                  <div className="relative rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] overflow-hidden">
                    <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 h-[34px] rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)]/55" />
                    <div
                      ref={yearWheelRef}
                      onScroll={handleYearWheelScroll}
                      className="ns-wheel-scroll relative z-10 overflow-y-auto"
                      style={{ height: `${WHEEL_VIEWPORT_HEIGHT}px` }}
                    >
                      <div style={{ height: `${WHEEL_SPACER_HEIGHT}px` }} />
                      {selectableYears.map((year) => (
                        <button
                          key={`year-wheel-${year}`}
                          type="button"
                          onClick={() => {
                            if (yearCommitTimerRef.current) {
                              window.clearTimeout(yearCommitTimerRef.current);
                              yearCommitTimerRef.current = null;
                            }
                            setDraftBirthYearPreview(String(year));
                            handleDraftBirthYearSelect(year);
                            const index = selectableYears.indexOf(year);
                            if (index >= 0) {
                              yearWheelRef.current?.scrollTo({ top: index * WHEEL_ITEM_HEIGHT, behavior: 'smooth' });
                            }
                          }}
                          className={`w-full text-center font-black text-sm ${String(year) === draftBirthYearPreview ? 'text-[var(--ns-accent-text)]' : 'text-[var(--ns-muted)]'}`}
                          style={{ height: `${WHEEL_ITEM_HEIGHT}px` }}
                        >
                          {year}년
                        </button>
                      ))}
                      <div style={{ height: `${WHEEL_SPACER_HEIGHT}px` }} />
                    </div>
                  </div>
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
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                      <label className="block min-w-0 space-y-0.5">
                        <span className="text-[11px] font-black text-[var(--ns-muted)] block">시</span>
                        <div className="relative rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] overflow-hidden">
                          <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 h-[34px] rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)]/55" />
                          <div
                            ref={hourWheelRef}
                            onScroll={handleHourWheelScroll}
                            className="ns-wheel-scroll relative z-10 overflow-y-auto"
                            style={{ height: `${WHEEL_VIEWPORT_HEIGHT}px` }}
                          >
                            <div style={{ height: `${WHEEL_SPACER_HEIGHT}px` }} />
                            {hourOptions.map((hour) => (
                              <button
                                key={`hour-wheel-${hour}`}
                                type="button"
                                onClick={() => {
                                  setDraftBirthHour(hour);
                                  hourWheelRef.current?.scrollTo({ top: hour * WHEEL_ITEM_HEIGHT, behavior: 'smooth' });
                                }}
                                className={`w-full text-center font-black text-sm ${hour === draftBirthHour ? 'text-[var(--ns-accent-text)]' : 'text-[var(--ns-muted)]'}`}
                                style={{ height: `${WHEEL_ITEM_HEIGHT}px` }}
                              >
                                {formatTwoDigits(hour)}시
                              </button>
                            ))}
                            <div style={{ height: `${WHEEL_SPACER_HEIGHT}px` }} />
                          </div>
                        </div>
                      </label>
                      <label className="block min-w-0 space-y-0.5">
                        <span className="text-[11px] font-black text-[var(--ns-muted)] block">분</span>
                        <div className="relative rounded-xl border border-[var(--ns-border)] bg-[var(--ns-surface-soft)] overflow-hidden">
                          <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 h-[34px] rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)]/55" />
                          <div
                            ref={minuteWheelRef}
                            onScroll={handleMinuteWheelScroll}
                            className="ns-wheel-scroll relative z-10 overflow-y-auto"
                            style={{ height: `${WHEEL_VIEWPORT_HEIGHT}px` }}
                          >
                            <div style={{ height: `${WHEEL_SPACER_HEIGHT}px` }} />
                            {minuteOptions.map((minute) => (
                              <button
                                key={`minute-wheel-${minute}`}
                                type="button"
                                onClick={() => {
                                  setDraftBirthMinute(minute);
                                  minuteWheelRef.current?.scrollTo({ top: minute * WHEEL_ITEM_HEIGHT, behavior: 'smooth' });
                                }}
                                className={`w-full text-center font-black text-sm ${minute === draftBirthMinute ? 'text-[var(--ns-accent-text)]' : 'text-[var(--ns-muted)]'}`}
                                style={{ height: `${WHEEL_ITEM_HEIGHT}px` }}
                              >
                                {formatTwoDigits(minute)}분
                              </button>
                            ))}
                            <div style={{ height: `${WHEEL_SPACER_HEIGHT}px` }} />
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                <button
                  type="button"
                  onClick={closeBirthPicker}
                  className="py-2 md:py-2.5 rounded-2xl font-black text-sm border bg-[var(--ns-surface-soft)] text-[var(--ns-muted)] border-[var(--ns-border)]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={applyBirthPicker}
                  disabled={!isBirthYearStepDone || !isBirthDateStepDone}
                  className="py-2 md:py-2.5 rounded-2xl font-black text-sm border bg-[var(--ns-primary)] text-[var(--ns-accent-text)] border-[var(--ns-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 z-50 transition-colors duration-200 ${isModalVisible ? 'bg-black/35' : 'bg-black/0'}`}>
          <div className={`bg-[var(--ns-surface)] rounded-[2rem] md:rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-[var(--ns-border)] transition-all duration-200 ${isModalVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <div className="p-3 md:p-6 bg-[var(--ns-surface-soft)] border-b border-[var(--ns-border)] flex justify-between items-center">
              <h3 className="font-black text-[var(--ns-text)] tracking-tight">'{modalTarget.char}' 한자 고르기</h3>
              <button onClick={closeModal} className="text-[var(--ns-muted)] hover:text-[var(--ns-primary)] text-2xl font-bold">&times;</button>
            </div>

            <div className="px-2.5 pt-2.5 md:px-4 md:pt-4">
              <input
                type="text"
                value={hanjaSearchKeyword}
                onChange={(e) => setHanjaSearchKeyword(e.target.value)}
                placeholder="한글로 뜻 검색"
                className="w-full p-2.5 md:p-3 bg-[var(--ns-surface-soft)] border border-[var(--ns-border)] rounded-xl text-sm font-semibold text-[var(--ns-text)]"
              />
            </div>

            <div className="p-2.5 md:p-4 max-h-[50vh] overflow-y-auto space-y-1.5 md:space-y-2">
              {filteredHanjaOptions.length === 0 && (
                <div className="p-3 md:p-6 text-center text-sm font-semibold text-[var(--ns-muted)]">
                  검색 결과가 없습니다.
                </div>
              )}
              {filteredHanjaOptions.map((item, idx) => (
                <button key={idx} onClick={() => handleSelectHanja(item)} className="w-full flex items-center justify-between p-2.5 md:p-4 hover:bg-[var(--ns-primary)] rounded-xl md:rounded-2xl transition-all group border border-transparent hover:text-[var(--ns-accent-text)]">
                  <div className="flex items-center gap-2 md:gap-4">
                    <span className="text-3xl md:text-4xl font-serif font-black text-[var(--ns-text)] group-hover:text-[var(--ns-accent-text)]">{item.hanja}</span>
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
