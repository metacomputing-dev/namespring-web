import { useCallback, useEffect, useMemo, useReducer } from "react";
import { SeedClientService } from "../services/seedClientService";
import type {
  AnalysisResult,
  BirthDateTime,
  GenderOption,
  HanjaOption,
  ModalTarget,
  NameTargetType,
} from "../types";

const EMPTY_MODAL_TARGET: ModalTarget = Object.freeze({
  type: "last",
  index: 0,
  char: "",
});

const DEFAULT_SURNAME_ENTRY: HanjaOption = Object.freeze({
  hangul: "김",
  hanja: "金",
  meaning: "Surname Kim",
  strokes: 8,
  resourceElement: "金",
  isSurname: true,
});

const DEFAULT_FIRST_NAME_ENTRIES: readonly HanjaOption[] = Object.freeze([
  {
    hangul: "서",
    hanja: "西",
    meaning: "west",
    strokes: 6,
    resourceElement: "金",
  },
  {
    hangul: "윤",
    hanja: "玧",
    meaning: "gem-like glow",
    strokes: 9,
    resourceElement: "土",
  },
]);

const HANGUL_ONLY_PATTERN = /[^\uAC00-\uD7A3]/g;
const DEFAULT_DB_STATUS = "Initializing Seed DB for browser runtime...";

type FormState = {
  isDbLoading: boolean;
  isDbReady: boolean;
  dbStatusMessage: string | null;
  lastNameHangul: string;
  firstNameHangul: string;
  birthDate: string;
  birthTime: string;
  gender: GenderOption;
  includeSaju: boolean;
  selectedSurnameEntries: Array<HanjaOption | null>;
  selectedFirstNameEntries: Array<HanjaOption | null>;
  isModalOpen: boolean;
  modalTarget: ModalTarget;
  hanjaOptions: HanjaOption[];
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  analysisError: string | null;
};

type FormAction =
  | { type: "DB_INIT_START" }
  | { type: "DB_INIT_SUCCESS" }
  | { type: "DB_INIT_FAILURE"; message: string }
  | { type: "SET_LAST_NAME"; value: string }
  | { type: "SET_FIRST_NAME"; value: string }
  | { type: "SET_BIRTH_DATE"; value: string }
  | { type: "SET_BIRTH_TIME"; value: string }
  | { type: "SET_GENDER"; value: GenderOption }
  | { type: "SET_INCLUDE_SAJU"; value: boolean }
  | { type: "OPEN_MODAL"; target: ModalTarget; options: HanjaOption[] }
  | { type: "CLOSE_MODAL" }
  | { type: "SELECT_ENTRY"; entry: HanjaOption }
  | { type: "ANALYZE_START" }
  | { type: "ANALYZE_SUCCESS"; result: AnalysisResult }
  | { type: "ANALYZE_FAILURE"; message: string }
  | { type: "CLEAR_ANALYSIS" };

const initialState: FormState = {
  isDbLoading: true,
  isDbReady: false,
  dbStatusMessage: DEFAULT_DB_STATUS,
  lastNameHangul: "김",
  firstNameHangul: "서윤",
  birthDate: "1995-09-21",
  birthTime: "09:30",
  gender: "female",
  includeSaju: false,
  selectedSurnameEntries: [{ ...DEFAULT_SURNAME_ENTRY }],
  selectedFirstNameEntries: DEFAULT_FIRST_NAME_ENTRIES.map((entry) => ({ ...entry })),
  isModalOpen: false,
  modalTarget: EMPTY_MODAL_TARGET,
  hanjaOptions: [],
  isAnalyzing: false,
  analysisResult: null,
  analysisError: null,
};

function sanitizeHangul(value: string, maxLength: number): string {
  return Array.from(value.replace(HANGUL_ONLY_PATTERN, ""))
    .slice(0, maxLength)
    .join("");
}

function syncEntriesByHangul(
  nextHangul: string,
  previousEntries: Array<HanjaOption | null>,
): Array<HanjaOption | null> {
  return Array.from(nextHangul).map((char, index) => {
    const previous = previousEntries[index];
    if (previous && previous.hangul === char) {
      return previous;
    }
    return null;
  });
}

function hasAllEntriesSelected(entries: Array<HanjaOption | null>): boolean {
  return entries.length > 0 && entries.every((entry) => entry !== null);
}

function parseBirthDateTime(date: string, time: string): BirthDateTime | null {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if ([year, month, day, hour, minute].some((value) => !Number.isFinite(value))) {
    return null;
  }
  return { year, month, day, hour, minute };
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "DB_INIT_START":
      return {
        ...state,
        isDbLoading: true,
        dbStatusMessage: DEFAULT_DB_STATUS,
      };

    case "DB_INIT_SUCCESS":
      return {
        ...state,
        isDbLoading: false,
        isDbReady: true,
        dbStatusMessage: null,
      };

    case "DB_INIT_FAILURE":
      return {
        ...state,
        isDbLoading: false,
        isDbReady: false,
        dbStatusMessage: action.message,
      };

    case "SET_LAST_NAME": {
      const value = sanitizeHangul(action.value, 2);
      return {
        ...state,
        lastNameHangul: value,
        selectedSurnameEntries: syncEntriesByHangul(value, state.selectedSurnameEntries),
        analysisResult: null,
        analysisError: null,
      };
    }

    case "SET_FIRST_NAME": {
      const value = sanitizeHangul(action.value, 4);
      return {
        ...state,
        firstNameHangul: value,
        selectedFirstNameEntries: syncEntriesByHangul(value, state.selectedFirstNameEntries),
        analysisResult: null,
        analysisError: null,
      };
    }

    case "SET_BIRTH_DATE":
      return {
        ...state,
        birthDate: action.value,
        analysisResult: null,
        analysisError: null,
      };

    case "SET_BIRTH_TIME":
      return {
        ...state,
        birthTime: action.value,
        analysisResult: null,
        analysisError: null,
      };

    case "SET_GENDER":
      return {
        ...state,
        gender: action.value,
        analysisResult: null,
        analysisError: null,
      };

    case "SET_INCLUDE_SAJU":
      return {
        ...state,
        includeSaju: action.value,
        analysisResult: null,
        analysisError: null,
      };

    case "OPEN_MODAL":
      return {
        ...state,
        isModalOpen: true,
        modalTarget: action.target,
        hanjaOptions: action.options,
      };

    case "CLOSE_MODAL":
      return {
        ...state,
        isModalOpen: false,
        modalTarget: EMPTY_MODAL_TARGET,
        hanjaOptions: [],
      };

    case "SELECT_ENTRY":
      if (state.modalTarget.type === "last") {
        return {
          ...state,
          selectedSurnameEntries: state.selectedSurnameEntries.map((entry, index) =>
            index === state.modalTarget.index ? action.entry : entry,
          ),
          isModalOpen: false,
          modalTarget: EMPTY_MODAL_TARGET,
          hanjaOptions: [],
          analysisResult: null,
          analysisError: null,
        };
      }

      return {
        ...state,
        selectedFirstNameEntries: state.selectedFirstNameEntries.map((entry, index) =>
          index === state.modalTarget.index ? action.entry : entry,
        ),
        isModalOpen: false,
        modalTarget: EMPTY_MODAL_TARGET,
        hanjaOptions: [],
        analysisResult: null,
        analysisError: null,
      };

    case "ANALYZE_START":
      return {
        ...state,
        isAnalyzing: true,
        analysisError: null,
      };

    case "ANALYZE_SUCCESS":
      return {
        ...state,
        isAnalyzing: false,
        analysisResult: action.result,
        analysisError: null,
      };

    case "ANALYZE_FAILURE":
      return {
        ...state,
        isAnalyzing: false,
        analysisResult: null,
        analysisError: action.message,
      };

    case "CLEAR_ANALYSIS":
      return {
        ...state,
        analysisResult: null,
        analysisError: null,
      };

    default:
      return state;
  }
}

export function useNameAnalysisForm() {
  const [state, dispatch] = useReducer(formReducer, initialState);
  const seedService = useMemo(() => new SeedClientService(), []);

  useEffect(() => {
    let canceled = false;

    const initialize = async () => {
      dispatch({ type: "DB_INIT_START" });
      try {
        await seedService.initialize();
        if (!canceled) {
          dispatch({ type: "DB_INIT_SUCCESS" });
        }
      } catch (error) {
        if (!canceled) {
          dispatch({
            type: "DB_INIT_FAILURE",
            message: toErrorMessage(error, "Failed to initialize Seed database in browser runtime."),
          });
        }
      }
    };

    void initialize();

    return () => {
      canceled = true;
    };
  }, [seedService]);

  const openHanjaModal = useCallback(
    async (char: string, type: NameTargetType, index: number) => {
      if (!char || !state.isDbReady) {
        return;
      }

      try {
        const options = await seedService.findHanjaByHangul(char, type === "last");
        dispatch({
          type: "OPEN_MODAL",
          target: { type, index, char },
          options,
        });
      } catch (error) {
        dispatch({
          type: "DB_INIT_FAILURE",
          message: toErrorMessage(error, "Failed to load Hanja candidates."),
        });
      }
    },
    [seedService, state.isDbReady],
  );

  const closeHanjaModal = useCallback(() => {
    dispatch({ type: "CLOSE_MODAL" });
  }, []);

  const handleSelectHanja = useCallback((entry: HanjaOption) => {
    dispatch({ type: "SELECT_ENTRY", entry });
  }, []);

  const analyzeName = useCallback(async () => {
    if (!state.isDbReady) {
      dispatch({
        type: "ANALYZE_FAILURE",
        message: "Seed database is still loading. Please wait a moment.",
      });
      return;
    }

    const surnameComplete = hasAllEntriesSelected(state.selectedSurnameEntries);
    const firstNameComplete = hasAllEntriesSelected(state.selectedFirstNameEntries);
    if (!surnameComplete || !firstNameComplete) {
      dispatch({
        type: "ANALYZE_FAILURE",
        message: "Select one Hanja for every Hangul character before analysis.",
      });
      return;
    }

    const birthDateTime = parseBirthDateTime(state.birthDate, state.birthTime);
    if (!birthDateTime) {
      dispatch({
        type: "ANALYZE_FAILURE",
        message: "Birth date/time is invalid.",
      });
      return;
    }

    const selectedSurnameEntries = state.selectedSurnameEntries.filter(
      (entry): entry is HanjaOption => entry !== null,
    );
    const selectedFirstNameEntries = state.selectedFirstNameEntries.filter(
      (entry): entry is HanjaOption => entry !== null,
    );

    dispatch({ type: "ANALYZE_START" });
    try {
      const result = await seedService.analyze({
        lastNameHangul: state.lastNameHangul,
        firstNameHangul: state.firstNameHangul,
        lastNameHanja: selectedSurnameEntries.map((entry) => entry.hanja).join(""),
        firstNameHanja: selectedFirstNameEntries.map((entry) => entry.hanja).join(""),
        birthDateTime,
        gender: state.gender,
        includeSaju: state.includeSaju,
      });

      if (!result.candidates[0]) {
        dispatch({
          type: "ANALYZE_FAILURE",
          message: "No analysis result was returned.",
        });
        return;
      }

      dispatch({ type: "ANALYZE_SUCCESS", result });
    } catch (error) {
      dispatch({
        type: "ANALYZE_FAILURE",
        message: toErrorMessage(error, "Failed to analyze this name combination."),
      });
    }
  }, [
    seedService,
    state.birthDate,
    state.birthTime,
    state.firstNameHangul,
    state.gender,
    state.includeSaju,
    state.isDbReady,
    state.lastNameHangul,
    state.selectedFirstNameEntries,
    state.selectedSurnameEntries,
  ]);

  const isProfileComplete = Boolean(state.birthDate && state.birthTime && state.gender);
  const isNameInputComplete =
    Array.from(state.lastNameHangul).length > 0 && Array.from(state.firstNameHangul).length > 0;
  const isHanjaSelectionComplete =
    hasAllEntriesSelected(state.selectedSurnameEntries) &&
    hasAllEntriesSelected(state.selectedFirstNameEntries);

  const canAnalyze = state.isDbReady && isProfileComplete && isNameInputComplete && isHanjaSelectionComplete;

  const ctaBlockReason = !state.isDbReady
    ? "Seed DB is not ready yet."
    : !isProfileComplete
      ? "Step 1: Fill birth date, time, and gender."
      : !isNameInputComplete
        ? "Step 2: Enter surname and given name in Hangul."
        : !isHanjaSelectionComplete
          ? "Step 3: Pick one Hanja for each character."
          : null;

  const currentStep = state.analysisResult
    ? 4
    : !isProfileComplete
      ? 1
      : !isNameInputComplete
        ? 2
        : !isHanjaSelectionComplete
          ? 3
          : 4;

  const setLastNameHangul = useCallback((value: string) => {
    dispatch({ type: "SET_LAST_NAME", value });
  }, []);

  const setFirstNameHangul = useCallback((value: string) => {
    dispatch({ type: "SET_FIRST_NAME", value });
  }, []);

  const setBirthDate = useCallback((value: string) => {
    dispatch({ type: "SET_BIRTH_DATE", value });
  }, []);

  const setBirthTime = useCallback((value: string) => {
    dispatch({ type: "SET_BIRTH_TIME", value });
  }, []);

  const setGender = useCallback((value: GenderOption) => {
    dispatch({ type: "SET_GENDER", value });
  }, []);

  const setIncludeSaju = useCallback((value: boolean) => {
    dispatch({ type: "SET_INCLUDE_SAJU", value });
  }, []);

  const clearAnalysis = useCallback(() => {
    dispatch({ type: "CLEAR_ANALYSIS" });
  }, []);

  return {
    ...state,
    isProfileComplete,
    isNameInputComplete,
    isHanjaSelectionComplete,
    canAnalyze,
    ctaBlockReason,
    currentStep,
    setLastNameHangul,
    setFirstNameHangul,
    setBirthDate,
    setBirthTime,
    setGender,
    setIncludeSaju,
    openHanjaModal,
    closeHanjaModal,
    handleSelectHanja,
    analyzeName,
    clearAnalysis,
  };
}
