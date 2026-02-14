export type GenderOption = "female" | "male" | "none";
export type NameTargetType = "last" | "first";
export type KoreanConstraintKind = "empty" | "syllable" | "chosung" | "jungsung" | "invalid";

export interface BirthDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface HanjaOption {
  id?: number;
  hangul: string;
  hanja: string;
  meaning: string;
  strokes: number;
  strokeCount?: number;
  resourceElement?: string;
  resource_element?: string;
  isSurname?: boolean;
}

export interface ModalTarget {
  type: NameTargetType;
  index: number;
  char: string;
}

export interface AnalysisCategory {
  frame: string;
  score: number;
  status: string;
  arrangement: string;
}

export interface AnalysisCandidate {
  lastNameHangul: string;
  firstNameHangul: string;
  lastNameHanja: string;
  firstNameHanja: string;
  totalScore: number;
  interpretation: string;
  categories: AnalysisCategory[];
  provider: string;
}

export interface AnalysisResult {
  candidates: AnalysisCandidate[];
  totalCount: number;
  provider: string;
}

export interface CandidateSearchResult extends AnalysisResult {
  query: string;
  truncated: boolean;
  offset: number;
  limit: number;
}

export interface AnalyzeRequest {
  lastNameHangul: string;
  firstNameHangul: string;
  lastNameHanja: string;
  firstNameHanja: string;
  birthDateTime: BirthDateTime;
  gender: GenderOption;
  includeSaju: boolean;
}

export interface GivenNameConstraint {
  korean: string;
  hanja: string;
}

export interface CandidateSearchRequest {
  surnameHangul: string;
  surnameHanja: string;
  constraints: readonly GivenNameConstraint[];
  birthDateTime?: BirthDateTime;
  gender: GenderOption;
  includeSaju: boolean;
  limit: number;
  offset: number;
}
