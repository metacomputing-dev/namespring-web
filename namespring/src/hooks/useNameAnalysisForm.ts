import { useCallback, useEffect, useMemo, useState } from "react";
import { SeedClientService } from "../services/seedClientService";
import {
  buildSearchQuery,
  classifyKoreanConstraint,
  sanitizeHangulName,
  sanitizeHanjaConstraint,
  sanitizeKoreanConstraint,
} from "../utils/naming-query";
import type {
  AnalysisResult,
  BirthDateTime,
  CandidateSearchResult,
  GenderOption,
  GivenNameConstraint,
  HanjaOption,
  KoreanConstraintKind,
  ModalTarget,
  NameTargetType,
} from "../types";

const EMPTY_MODAL_TARGET: ModalTarget = Object.freeze({
  type: "last",
  index: 0,
  char: "",
});

const DEFAULT_SURNAME_HANGUL = "\uAE40";
const DEFAULT_GIVEN_HANGUL = "\uC11C\uC724";

const DEFAULT_SURNAME_ENTRY: HanjaOption = Object.freeze({
  hangul: "\uAE40",
  hanja: "\u91D1",
  meaning: "surname Kim",
  strokes: 8,
  resourceElement: "\u91D1",
  isSurname: true,
});

const DEFAULT_FIRST_NAME_ENTRIES: readonly HanjaOption[] = Object.freeze([
  {
    hangul: "\uC11C",
    hanja: "\u897F",
    meaning: "west",
    strokes: 6,
    resourceElement: "\u91D1",
  },
  {
    hangul: "\uC724",
    hanja: "\u73A7",
    meaning: "jade-like shine",
    strokes: 9,
    resourceElement: "\u571F",
  },
]);

const DEFAULT_DB_STATUS = "Initializing Seed DB for browser runtime...";
const DEFAULT_GENERATOR_LIMIT = 30;

function createEmptyGivenConstraints(): GivenNameConstraint[] {
  return Array.from({ length: 4 }, () => ({ korean: "", hanja: "" }));
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

function toSelectedEntries(entries: Array<HanjaOption | null>): HanjaOption[] {
  return entries.filter((entry): entry is HanjaOption => entry !== null);
}

function toJoinedHanja(entries: Array<HanjaOption | null>): string {
  return toSelectedEntries(entries)
    .map((entry) => entry.hanja)
    .join("");
}

function normalizeLimit(value: number): number {
  const rounded = Math.trunc(value);
  if (!Number.isFinite(rounded) || rounded <= 0) {
    return DEFAULT_GENERATOR_LIMIT;
  }
  return Math.min(200, rounded);
}

function normalizeOffset(value: number): number {
  const rounded = Math.trunc(value);
  if (!Number.isFinite(rounded) || rounded < 0) {
    return 0;
  }
  return rounded;
}

type NameAnalysisFormState = {
  isDbLoading: boolean;
  isDbReady: boolean;
  dbStatusMessage: string | null;
  birthDate: string;
  birthTime: string;
  gender: GenderOption;
  includeSaju: boolean;
  surnameHangul: string;
  analyzeGivenHangul: string;
  selectedSurnameEntries: Array<HanjaOption | null>;
  selectedAnalyzeGivenEntries: Array<HanjaOption | null>;
  isModalOpen: boolean;
  modalTarget: ModalTarget;
  hanjaOptions: HanjaOption[];
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  analysisError: string | null;
  generatorLength: 1 | 2 | 3 | 4;
  generatorConstraints: GivenNameConstraint[];
  generatorLimit: number;
  generatorOffset: number;
  isSearchingCandidates: boolean;
  candidateResult: CandidateSearchResult | null;
  candidateError: string | null;
};

export function useNameAnalysisForm() {
  const seedService = useMemo(() => new SeedClientService(), []);

  const [isDbLoading, setIsDbLoading] = useState(true);
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbStatusMessage, setDbStatusMessage] = useState<string | null>(DEFAULT_DB_STATUS);

  const [birthDate, setBirthDateState] = useState("1995-09-21");
  const [birthTime, setBirthTimeState] = useState("09:30");
  const [gender, setGenderState] = useState<GenderOption>("female");
  const [includeSaju, setIncludeSajuState] = useState(false);

  const [surnameHangul, setSurnameHangulState] = useState(DEFAULT_SURNAME_HANGUL);
  const [analyzeGivenHangul, setAnalyzeGivenHangulState] = useState(DEFAULT_GIVEN_HANGUL);
  const [selectedSurnameEntries, setSelectedSurnameEntries] = useState<Array<HanjaOption | null>>([
    { ...DEFAULT_SURNAME_ENTRY },
  ]);
  const [selectedAnalyzeGivenEntries, setSelectedAnalyzeGivenEntries] = useState<Array<HanjaOption | null>>(
    DEFAULT_FIRST_NAME_ENTRIES.map((entry) => ({ ...entry })),
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState<ModalTarget>(EMPTY_MODAL_TARGET);
  const [hanjaOptions, setHanjaOptions] = useState<HanjaOption[]>([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const [generatorLength, setGeneratorLengthState] = useState<1 | 2 | 3 | 4>(2);
  const [generatorConstraints, setGeneratorConstraints] = useState<GivenNameConstraint[]>(createEmptyGivenConstraints());
  const [generatorLimit, setGeneratorLimitState] = useState(DEFAULT_GENERATOR_LIMIT);
  const [generatorOffset, setGeneratorOffsetState] = useState(0);
  const [isSearchingCandidates, setIsSearchingCandidates] = useState(false);
  const [candidateResult, setCandidateResult] = useState<CandidateSearchResult | null>(null);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    const initialize = async () => {
      setIsDbLoading(true);
      setIsDbReady(false);
      setDbStatusMessage(DEFAULT_DB_STATUS);
      try {
        await seedService.initialize();
        if (!canceled) {
          setIsDbReady(true);
          setDbStatusMessage(null);
        }
      } catch (error) {
        if (!canceled) {
          setIsDbReady(false);
          setDbStatusMessage(toErrorMessage(error, "Failed to initialize Seed database."));
        }
      } finally {
        if (!canceled) {
          setIsDbLoading(false);
        }
      }
    };

    void initialize();
    return () => {
      canceled = true;
    };
  }, [seedService]);

  const clearAnalyzeOutput = useCallback(() => {
    setAnalysisResult(null);
    setAnalysisError(null);
  }, []);

  const clearSearchOutput = useCallback(() => {
    setCandidateResult(null);
    setCandidateError(null);
  }, []);

  const setSurnameHangul = useCallback(
    (value: string) => {
      const next = sanitizeHangulName(value, 2);
      setSurnameHangulState(next);
      setSelectedSurnameEntries((previous) => syncEntriesByHangul(next, previous));
      clearAnalyzeOutput();
      clearSearchOutput();
    },
    [clearAnalyzeOutput, clearSearchOutput],
  );

  const setAnalyzeGivenHangul = useCallback(
    (value: string) => {
      const next = sanitizeHangulName(value, 4);
      setAnalyzeGivenHangulState(next);
      setSelectedAnalyzeGivenEntries((previous) => syncEntriesByHangul(next, previous));
      clearAnalyzeOutput();
    },
    [clearAnalyzeOutput],
  );

  const setBirthDate = useCallback(
    (value: string) => {
      setBirthDateState(value);
      clearAnalyzeOutput();
      clearSearchOutput();
    },
    [clearAnalyzeOutput, clearSearchOutput],
  );

  const setBirthTime = useCallback(
    (value: string) => {
      setBirthTimeState(value);
      clearAnalyzeOutput();
      clearSearchOutput();
    },
    [clearAnalyzeOutput, clearSearchOutput],
  );

  const setGender = useCallback(
    (value: GenderOption) => {
      setGenderState(value);
      clearAnalyzeOutput();
      clearSearchOutput();
    },
    [clearAnalyzeOutput, clearSearchOutput],
  );

  const setIncludeSaju = useCallback(
    (value: boolean) => {
      setIncludeSajuState(value);
      clearAnalyzeOutput();
      clearSearchOutput();
    },
    [clearAnalyzeOutput, clearSearchOutput],
  );

  const setGeneratorLength = useCallback(
    (length: 1 | 2 | 3 | 4) => {
      setGeneratorLengthState(length);
      clearSearchOutput();
    },
    [clearSearchOutput],
  );

  const setGeneratorLimit = useCallback(
    (value: number) => {
      setGeneratorLimitState(normalizeLimit(value));
      clearSearchOutput();
    },
    [clearSearchOutput],
  );

  const setGeneratorOffset = useCallback(
    (value: number) => {
      setGeneratorOffsetState(normalizeOffset(value));
      clearSearchOutput();
    },
    [clearSearchOutput],
  );

  const setConstraintKorean = useCallback(
    (index: number, value: string) => {
      if (index < 0 || index >= 4) {
        return;
      }
      setGeneratorConstraints((previous) => {
        const next = [...previous];
        const current = next[index] ?? { korean: "", hanja: "" };
        next[index] = {
          ...current,
          korean: sanitizeKoreanConstraint(value),
        };
        return next;
      });
      clearSearchOutput();
    },
    [clearSearchOutput],
  );

  const setConstraintHanja = useCallback(
    (index: number, value: string) => {
      if (index < 0 || index >= 4) {
        return;
      }
      setGeneratorConstraints((previous) => {
        const next = [...previous];
        const current = next[index] ?? { korean: "", hanja: "" };
        next[index] = {
          ...current,
          hanja: sanitizeHanjaConstraint(value),
        };
        return next;
      });
      clearSearchOutput();
    },
    [clearSearchOutput],
  );

  const resetGeneratorConstraints = useCallback(() => {
    setGeneratorConstraints(createEmptyGivenConstraints());
    clearSearchOutput();
  }, [clearSearchOutput]);

  const openHanjaModal = useCallback(
    async (char: string, type: NameTargetType, index: number) => {
      if (!char || !isDbReady) {
        return;
      }
      try {
        const options = await seedService.findHanjaByHangul(char, type === "last");
        setIsModalOpen(true);
        setModalTarget({ type, index, char });
        setHanjaOptions(options);
      } catch (error) {
        setDbStatusMessage(toErrorMessage(error, "Failed to load Hanja candidates."));
      }
    },
    [isDbReady, seedService],
  );

  const closeHanjaModal = useCallback(() => {
    setIsModalOpen(false);
    setModalTarget(EMPTY_MODAL_TARGET);
    setHanjaOptions([]);
  }, []);

  const handleSelectHanja = useCallback(
    (entry: HanjaOption) => {
      if (modalTarget.type === "last") {
        setSelectedSurnameEntries((previous) =>
          previous.map((current, index) => (index === modalTarget.index ? entry : current)),
        );
      } else {
        setSelectedAnalyzeGivenEntries((previous) =>
          previous.map((current, index) => (index === modalTarget.index ? entry : current)),
        );
      }

      closeHanjaModal();
      clearAnalyzeOutput();
      clearSearchOutput();
    },
    [closeHanjaModal, clearAnalyzeOutput, clearSearchOutput, modalTarget.index, modalTarget.type],
  );

  const surnameEntryCount = Array.from(surnameHangul).length;
  const analyzeGivenEntryCount = Array.from(analyzeGivenHangul).length;

  const surnameSelectionComplete =
    surnameEntryCount > 0 &&
    selectedSurnameEntries.length === surnameEntryCount &&
    hasAllEntriesSelected(selectedSurnameEntries);

  const analyzeGivenSelectionComplete =
    analyzeGivenEntryCount > 0 &&
    selectedAnalyzeGivenEntries.length === analyzeGivenEntryCount &&
    hasAllEntriesSelected(selectedAnalyzeGivenEntries);

  const isProfileComplete = Boolean(birthDate && birthTime && gender);
  const canAnalyze = isDbReady && isProfileComplete && surnameSelectionComplete && analyzeGivenSelectionComplete;

  const currentStep = analysisResult
    ? 4
    : !isProfileComplete
      ? 1
      : !surnameSelectionComplete || analyzeGivenEntryCount === 0
        ? 2
        : !analyzeGivenSelectionComplete
          ? 3
          : 4;

  const ctaBlockReason = !isDbReady
    ? "Seed DB is not ready yet."
    : !isProfileComplete
      ? "Step 1: Fill birth date, time, and gender."
      : surnameEntryCount === 0
        ? "Step 2: Enter surname Hangul first."
        : analyzeGivenEntryCount === 0
          ? "Step 2: Enter given name Hangul."
          : !surnameSelectionComplete || !analyzeGivenSelectionComplete
            ? "Step 3: Pick one Hanja for every Hangul character."
            : null;

  const analyzeName = useCallback(async () => {
    if (!canAnalyze) {
      setAnalysisError(ctaBlockReason ?? "Name analysis preconditions are not satisfied.");
      return;
    }

    const birthDateTime = parseBirthDateTime(birthDate, birthTime);
    if (!birthDateTime) {
      setAnalysisError("Birth date/time is invalid.");
      return;
    }

    const lastNameHanja = toJoinedHanja(selectedSurnameEntries);
    const firstNameHanja = toJoinedHanja(selectedAnalyzeGivenEntries);
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await seedService.analyze({
        lastNameHangul: surnameHangul,
        firstNameHangul: analyzeGivenHangul,
        lastNameHanja,
        firstNameHanja,
        birthDateTime,
        gender,
        includeSaju,
      });

      if (!result.candidates[0]) {
        setAnalysisResult(null);
        setAnalysisError("No analysis result was returned.");
        return;
      }

      setAnalysisResult(result);
      setAnalysisError(null);
    } catch (error) {
      setAnalysisResult(null);
      setAnalysisError(toErrorMessage(error, "Failed to analyze this name combination."));
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    analyzeGivenHangul,
    birthDate,
    birthTime,
    canAnalyze,
    ctaBlockReason,
    gender,
    includeSaju,
    seedService,
    selectedAnalyzeGivenEntries,
    selectedSurnameEntries,
    surnameHangul,
  ]);

  const visibleGeneratorConstraints = useMemo(
    () => generatorConstraints.slice(0, generatorLength),
    [generatorConstraints, generatorLength],
  );

  const generatorQueryPreview = useMemo(() => {
    if (!surnameSelectionComplete) {
      return null;
    }
    try {
      return buildSearchQuery({
        surnameHangul,
        surnameHanja: toJoinedHanja(selectedSurnameEntries),
        constraints: visibleGeneratorConstraints,
      });
    } catch {
      return null;
    }
  }, [selectedSurnameEntries, surnameHangul, surnameSelectionComplete, visibleGeneratorConstraints]);

  const getConstraintKind = useCallback(
    (index: number): KoreanConstraintKind => {
      const constraint = generatorConstraints[index];
      return classifyKoreanConstraint(constraint?.korean ?? "");
    },
    [generatorConstraints],
  );

  const searchCandidates = useCallback(async () => {
    if (!isDbReady) {
      setCandidateError("Seed database is still loading. Please wait.");
      return;
    }
    if (!surnameSelectionComplete) {
      setCandidateError("Surname Hangul/Hanja must be fully selected.");
      return;
    }

    const birthDateTime = parseBirthDateTime(birthDate, birthTime);
    if (!birthDateTime) {
      setCandidateError("Birth date/time is invalid.");
      return;
    }

    const constraints = generatorConstraints.slice(0, generatorLength);
    setIsSearchingCandidates(true);
    setCandidateError(null);

    try {
      const result = await seedService.searchCandidates({
        surnameHangul,
        surnameHanja: toJoinedHanja(selectedSurnameEntries),
        constraints,
        birthDateTime,
        gender,
        includeSaju,
        limit: normalizeLimit(generatorLimit),
        offset: normalizeOffset(generatorOffset),
      });
      setCandidateResult(result);
      setCandidateError(null);
    } catch (error) {
      setCandidateResult(null);
      setCandidateError(toErrorMessage(error, "Failed to search candidate names."));
    } finally {
      setIsSearchingCandidates(false);
    }
  }, [
    birthDate,
    birthTime,
    gender,
    generatorConstraints,
    generatorLength,
    generatorLimit,
    generatorOffset,
    includeSaju,
    isDbReady,
    seedService,
    selectedSurnameEntries,
    surnameHangul,
    surnameSelectionComplete,
  ]);

  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null);
    setAnalysisError(null);
  }, []);

  const state: NameAnalysisFormState = {
    isDbLoading,
    isDbReady,
    dbStatusMessage,
    birthDate,
    birthTime,
    gender,
    includeSaju,
    surnameHangul,
    analyzeGivenHangul,
    selectedSurnameEntries,
    selectedAnalyzeGivenEntries,
    isModalOpen,
    modalTarget,
    hanjaOptions,
    isAnalyzing,
    analysisResult,
    analysisError,
    generatorLength,
    generatorConstraints,
    generatorLimit,
    generatorOffset,
    isSearchingCandidates,
    candidateResult,
    candidateError,
  };

  return {
    ...state,
    isProfileComplete,
    isNameInputComplete: surnameEntryCount > 0 && analyzeGivenEntryCount > 0,
    isHanjaSelectionComplete: surnameSelectionComplete && analyzeGivenSelectionComplete,
    canAnalyze,
    ctaBlockReason,
    currentStep,
    visibleGeneratorConstraints,
    generatorQueryPreview,
    setSurnameHangul,
    setAnalyzeGivenHangul,
    setBirthDate,
    setBirthTime,
    setGender,
    setIncludeSaju,
    setGeneratorLength,
    setGeneratorLimit,
    setGeneratorOffset,
    setConstraintKorean,
    setConstraintHanja,
    getConstraintKind,
    resetGeneratorConstraints,
    openHanjaModal,
    closeHanjaModal,
    handleSelectHanja,
    analyzeName,
    searchCandidates,
    clearAnalysis,
    clearSearchOutput,
  };
}
