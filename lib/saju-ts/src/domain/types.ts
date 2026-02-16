import { Gender } from './Gender.js';

export interface BirthInput {
  readonly birthYear: number;
  readonly birthMonth: number;
  readonly birthDay: number;
  readonly birthHour: number;
  readonly birthMinute: number;
  readonly gender: Gender;
  readonly timezone: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly name?: string;
}

export function createBirthInput(params: {
  birthYear: number;
  birthMonth: number;
  birthDay: number;
  birthHour: number;
  birthMinute: number;
  gender: Gender;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  name?: string;
}): BirthInput {
  return {
    birthYear: params.birthYear,
    birthMonth: params.birthMonth,
    birthDay: params.birthDay,
    birthHour: params.birthHour,
    birthMinute: params.birthMinute,
    gender: params.gender,
    timezone: params.timezone ?? 'Asia/Seoul',
    latitude: params.latitude ?? 37.5665,
    longitude: params.longitude ?? 126.978,
    name: params.name,
  };
}

export interface AnalysisTraceStep {
  readonly key: string;
  readonly summary: string;
  readonly evidence: readonly string[];
  readonly citations: readonly string[];
  readonly reasoning: readonly string[];
  readonly confidence: number | null;
}

