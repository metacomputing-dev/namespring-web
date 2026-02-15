declare module "@metaintelligence/saju" {
  export type Gender = "MALE" | "FEMALE";
  export type Ohaeng = "WOOD" | "FIRE" | "EARTH" | "METAL" | "WATER";

  export interface SajuPillar {
    cheongan: string;
    jiji: string;
  }

  export interface SajuAnalysis {
    pillars: Record<"year" | "month" | "day" | "hour", SajuPillar>;
    ohaengDistribution?: Partial<Record<Ohaeng, number>>;
    [key: string]: unknown;
  }

  export interface BirthInput {
    [key: string]: unknown;
  }

  export const CHEONGAN_INFO: Record<string, { hangul: string; hanja: string }>;
  export const JIJI_INFO: Record<string, { hangul: string; hanja: string }>;

  export function createBirthInput(input: Record<string, unknown>): BirthInput;
  export function analyzeSaju(input: BirthInput): SajuAnalysis;
}
