import { SibiUnseong } from '../domain/SibiUnseong.js';
import { Sipseong } from '../domain/Sipseong.js';
import rawLuckNarrativeThemes from './data/luckNarrativeThemes.json';

export interface SipseongUnTheme {
  readonly sipseong: Sipseong;
  readonly themeName: string;
  readonly themeDescription: string;
  readonly favorableAspects: readonly string[];
  readonly cautionPoints: readonly string[];
  readonly lifeDomain: string;
}

export interface UnseongEnergyTheme {
  readonly sibiUnseong: SibiUnseong;
  readonly energyLevel: string;
  readonly description: string;
  readonly actionAdvice: string;
}

interface LuckNarrativeThemesData {
  readonly sipseongThemes: readonly (readonly [string, SipseongUnTheme])[];
  readonly unseongThemes: readonly (readonly [string, UnseongEnergyTheme])[];
}

const LUCK_NARRATIVE_THEMES = rawLuckNarrativeThemes as unknown as LuckNarrativeThemesData;
const SIPSEONG_SET: ReadonlySet<Sipseong> = new Set(Object.values(Sipseong));
const SIBI_UNSEONG_SET: ReadonlySet<SibiUnseong> = new Set(Object.values(SibiUnseong));

function toSipseong(raw: string): Sipseong {
  if (SIPSEONG_SET.has(raw as Sipseong)) return raw as Sipseong;
  throw new Error(`Invalid Sipseong in LuckNarrativeThemes: ${raw}`);
}

function toSibiUnseong(raw: string): SibiUnseong {
  if (SIBI_UNSEONG_SET.has(raw as SibiUnseong)) return raw as SibiUnseong;
  throw new Error(`Invalid SibiUnseong in LuckNarrativeThemes: ${raw}`);
}

export const SIPSEONG_UN_THEMES: ReadonlyMap<Sipseong, SipseongUnTheme> = new Map(
  LUCK_NARRATIVE_THEMES.sipseongThemes.map(([sipseong, theme]) => {
    const parsed = toSipseong(sipseong);
    return [parsed, { ...theme, sipseong: parsed }] as const;
  }),
);

export const UNSEONG_ENERGY_THEMES: ReadonlyMap<SibiUnseong, UnseongEnergyTheme> = new Map(
  LUCK_NARRATIVE_THEMES.unseongThemes.map(([sibiUnseong, theme]) => {
    const parsed = toSibiUnseong(sibiUnseong);
    return [parsed, { ...theme, sibiUnseong: parsed }] as const;
  }),
);
