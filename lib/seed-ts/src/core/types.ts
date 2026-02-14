export type Gender = "MALE" | "FEMALE" | "NONE" | "male" | "female" | "none";

export type Element = "木" | "火" | "土" | "金" | "水";
export type Polarity = "陰" | "陽";
export type Char = string;
export type HangulChar = Char;
export type HanjaChar = Char;
export type Sound = string;

export interface Energy {
  element: Element;
  polarity: Polarity;
}

export type LuckyLevel = "최상운수" | "상운수" | "양운수" | "흉운수" | "최흉운수" | "미정";

export type Status = "POSITIVE" | "NEUTRAL" | "NEGATIVE";

export type Frame =
  | "SEONGMYEONGHAK"
  | "SAGYEOK_SURI"
  | "SAGYEOK_OHAENG"
  | "HOEKSU_OHAENG"
  | "HOEKSU_EUMYANG"
  | "BALEUM_OHAENG"
  | "BALEUM_EUMYANG"
  | "SAJU_JAWON_BALANCE"
  | "STATISTICS"
  | "JAWON_OHAENG"
  | "EUMYANG";

export interface FourFrame {
  won: number;
  hyeong: number;
  i: number;
  jeong: number;
}

export interface BirthInfo {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface NameInput {
  lastNameHangul: HangulChar;
  lastNameHanja: HanjaChar;
  firstNameHangul: HangulChar;
  firstNameHanja: HanjaChar;
}

export interface EvaluateRequest {
  query?: string;
  name?: NameInput;
  birth?: BirthInfo;
  gender?: Gender;
  includeSaju?: boolean;
  latitude?: number;
  longitude?: number;
}

export interface AnalyzeSelectionRequest {
  name: NameInput;
  birth?: BirthInfo;
  gender?: Gender;
  includeSaju?: boolean;
}

export interface SearchRequest {
  query: string;
  birth?: BirthInfo;
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  gender?: Gender;
  includeSaju?: boolean;
  latitude?: number;
  longitude?: number;
  limit?: number;
  offset?: number;
}

export type SearchCandidatesRequest = SearchRequest;

export interface FrameInsight {
  frame: Frame;
  score: number;
  isPassed: boolean;
  status: Status;
  arrangement: string;
  details: Record<string, unknown>;
}

export interface Interpretation {
  score: number;
  isPassed: boolean;
  status: Status;
  categories: FrameInsight[];
}

export interface SeedResponse {
  name: NameInput;
  interpretation: Interpretation;
  categoryMap: Record<Frame, FrameInsight>;
  statistics: NameStatistics | null;
}

export interface SearchResult {
  query: string;
  totalCount: number;
  responses: SeedResponse[];
  truncated: boolean;
}

export interface AnalyzeSelectionResult {
  response: SeedResponse;
}

export interface HanjaLookupOptions {
  surname?: boolean;
}

export interface HanjaEntry {
  hangul: HangulChar;
  hanja: HanjaChar;
  meaning: string;
  strokeCount: number;
  strokeElement: Element;
  rootElement: Element;
  pronunciationElement: Element;
  pronunciationPolarityBit: 0 | 1;
  strokePolarityBit: 0 | 1;
  radical: string;
  isSurname: boolean;
}

export interface NameStatistics {
  similarNames: string[];
  totalRankByYear: Record<number, number>;
  maleRankByYear: Record<number, number>;
  totalBirthByYear: Record<number, number>;
  maleBirthByYear: Record<number, number>;
  hanjaCombinations: string[];
}

export interface NameBlock {
  korean: HangulChar;
  hanja: HanjaChar;
  hangul?: HangulChar;
}

export interface NameQuery {
  surnameBlocks: NameBlock[];
  nameBlocks: NameBlock[];
}

export interface NameCombination {
  korean: HangulChar;
  hanja: HanjaChar;
  hangul?: HangulChar;
}

export interface ResolvedName {
  surname: HanjaEntry[];
  given: HanjaEntry[];
}

export interface HanjaRepository {
  getHanjaInfo(korean: string, hanja: string, isSurname: boolean): HanjaEntry;
  getHanjaStrokeCount(korean: string, hanja: string, isSurname: boolean): number;
  getSurnamePairs(surname: string, surnameHanja: string): Array<{ korean: string; hanja: string }>;
  isSurname(korean: string, hanja: string): boolean;
  findNameByHangul(hangul: string): readonly HanjaEntry[];
  findSurnameByHangul?(hangul: string): readonly HanjaEntry[];
  findNameByHanja(hanja: string): readonly HanjaEntry[];
  findNameByChosung?(chosung: string): readonly HanjaEntry[];
  findNameByJungsung?(jungsung: string): readonly HanjaEntry[];
}

export interface StatsRepository {
  findByName(nameHangul: string): NameStatistics | null;
  findNameCombinations(blocks: NameBlock[], strokeKeys?: ReadonlySet<string>): NameCombination[];
}

export interface SqliteOptions {
  path?: string;
  useFor?: "all";
}

export interface SeedOptions {
  dataRoot?: string;
  includeSaju?: boolean;
  sqlite?: SqliteOptions;
  sajuBaseDistribution?: Partial<Record<Element, number>>;
}
