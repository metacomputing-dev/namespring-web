import type { BirthInfo } from '../types.js';
import {
  KOREA_REGION_COORDINATES,
  type RegionCoordinate,
} from '../region-coordinates.js';

export type BirthLocationFailureCode =
  | 'BIRTH_LOCATION_INVALID'
  | 'BIRTH_LOCATION_PARTIAL'
  | 'BIRTH_LOCATION_REQUIRED'
  | 'BIRTH_LOCATION_UNRESOLVED'
  | 'BIRTH_LOCATION_CONFLICT'
  | 'BIRTH_LOCATION_TIMEZONE_MISMATCH';

export interface BirthLocationDefaults {
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly regionCode: string;
}

export interface ResolvedBirthLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
  readonly regionCode: string | null;
  readonly source: 'explicit' | 'region' | 'timezone' | 'default';
}

export type BirthLocationResolution =
  | { readonly ok: true; readonly value: ResolvedBirthLocation }
  | { readonly ok: false; readonly reasonCode: BirthLocationFailureCode };

export interface BirthLocationPolicy {
  /** Physical longitude is required when longitude correction is active. */
  readonly requireLongitude: boolean;
  /**
   * Explicit solar/longitude correction must never borrow the configured
   * Seoul compatibility default. A named supported region or an atomic
   * latitude/longitude/timezone tuple is required.
   */
  readonly requireExplicitLocation?: boolean;
}

function normalizeRegionToken(value: string): string {
  return value
    .replace(/\s+/g, '')
    .toLowerCase()
    .replace(/[.,()_/-]/g, '');
}

const REGION_ALIAS_ENTRIES = KOREA_REGION_COORDINATES
  .flatMap((region) => [region.code, ...region.aliases].map((alias) => ({
    alias: normalizeRegionToken(alias),
    region,
  })))
  .filter((entry) => entry.alias.length > 0)
  .sort((left, right) => right.alias.length - left.alias.length);

function findRegionCoordinates(text: string): RegionCoordinate[] {
  const normalized = normalizeRegionToken(text);
  if (!normalized) return [];

  const byCode = new Map<string, RegionCoordinate>();
  for (const entry of REGION_ALIAS_ENTRIES) {
    if (normalized === entry.alias || normalized.includes(entry.alias)) {
      byCode.set(entry.region.code, entry.region);
    }
  }
  return [...byCode.values()];
}

function locationTextCandidates(birth: BirthInfo): string[] {
  // Use only the documented location fields. A person's name must never be
  // interpreted as a city merely because it contains a region alias.
  return [birth.region, birth.city, birth.birthPlace]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasExplicitValue(value: unknown): boolean {
  return value !== undefined;
}

function finiteCoordinate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function failure(reasonCode: BirthLocationFailureCode): BirthLocationResolution {
  return { ok: false, reasonCode };
}

// A supported region label is a request for the registry's canonical tuple,
// not a geocoding claim. When callers also provide coordinates, accept only
// insignificant numeric rounding drift. Arbitrary GPS coordinates remain
// supported as an atomic coordinate/timezone tuple without a region label.
const SUPPORTED_REGION_COORDINATE_TOLERANCE_DEGREES = 1e-4;

/** Shared output guard for region-tagged resolved tuples. */
export function supportedRegionLocationMatches(
  regionCode: string,
  latitude: number,
  longitude: number,
  timezone: string,
): boolean {
  const region = KOREA_REGION_COORDINATES.find((entry) => entry.code === regionCode);
  if (!region || timezone !== region.timezone) return false;
  return Math.abs(latitude - region.latitude)
      <= SUPPORTED_REGION_COORDINATE_TOLERANCE_DEGREES
    && Math.abs(longitude - region.longitude)
      <= SUPPORTED_REGION_COORDINATE_TOLERANCE_DEGREES;
}

/**
 * Resolves an atomic birth-time location tuple.
 *
 * Partial overseas input is never completed with Seoul defaults. The one
 * compatibility exception is an explicit default timezone (`Asia/Seoul` in
 * production), which is equivalent to omitting location entirely.
 */
export function resolveBirthLocation(
  birth: BirthInfo,
  defaults: BirthLocationDefaults,
  policy: BirthLocationPolicy,
): BirthLocationResolution {
  const latitudeProvided = hasExplicitValue(birth.latitude);
  const longitudeProvided = hasExplicitValue(birth.longitude);
  const timezoneProvided = hasExplicitValue(birth.timezone);
  const latitude = finiteCoordinate(birth.latitude);
  const longitude = finiteCoordinate(birth.longitude);
  const timezone = typeof birth.timezone === 'string' && birth.timezone.trim()
    ? birth.timezone.trim()
    : null;

  if ((latitudeProvided && latitude == null) || (longitudeProvided && longitude == null)) {
    return failure('BIRTH_LOCATION_INVALID');
  }
  if (timezoneProvided && !timezone) return failure('BIRTH_LOCATION_INVALID');
  if (latitude != null && (latitude < -90 || latitude > 90)) {
    return failure('BIRTH_LOCATION_INVALID');
  }
  if (longitude != null && (longitude < -180 || longitude > 180)) {
    return failure('BIRTH_LOCATION_INVALID');
  }
  if (latitudeProvided !== longitudeProvided) {
    return failure('BIRTH_LOCATION_PARTIAL');
  }

  const locationTexts = locationTextCandidates(birth);
  const regionsByCode = new Map<string, RegionCoordinate>();
  for (const locationText of locationTexts) {
    for (const matchedRegion of findRegionCoordinates(locationText)) {
      regionsByCode.set(matchedRegion.code, matchedRegion);
    }
  }
  if (regionsByCode.size > 1) return failure('BIRTH_LOCATION_CONFLICT');
  const region = regionsByCode.values().next().value as RegionCoordinate | undefined;

  if (latitude != null && longitude != null) {
    // Explicit coordinates are an atomic global tuple. Never borrow a
    // timezone from a region label because that can silently mix an overseas
    // coordinate with Asia/Seoul.
    if (!timezone) return failure('BIRTH_LOCATION_PARTIAL');
    if (region && timezone !== region.timezone) {
      return failure('BIRTH_LOCATION_TIMEZONE_MISMATCH');
    }
    if (region && !supportedRegionLocationMatches(
      region.code,
      latitude,
      longitude,
      timezone,
    )) {
      return failure('BIRTH_LOCATION_CONFLICT');
    }
    return {
      ok: true,
      value: {
        latitude,
        longitude,
        timezone,
        regionCode: region?.code ?? null,
        source: 'explicit',
      },
    };
  }

  if (region) {
    if (timezone && timezone !== region.timezone) {
      return failure('BIRTH_LOCATION_TIMEZONE_MISMATCH');
    }
    return {
      ok: true,
      value: {
        latitude: region.latitude,
        longitude: region.longitude,
        timezone: region.timezone,
        regionCode: region.code,
        source: 'region',
      },
    };
  }

  if (locationTexts.length > 0) return failure('BIRTH_LOCATION_UNRESOLVED');

  if (timezone && timezone !== defaults.timezone) {
    if (policy.requireLongitude) return failure('BIRTH_LOCATION_PARTIAL');
    if (policy.requireExplicitLocation) return failure('BIRTH_LOCATION_REQUIRED');
    return {
      ok: true,
      value: {
        latitude: defaults.latitude,
        longitude: defaults.longitude,
        timezone,
        regionCode: null,
        source: 'timezone',
      },
    };
  }

  if (policy.requireExplicitLocation) return failure('BIRTH_LOCATION_REQUIRED');

  return {
    ok: true,
    value: {
      latitude: defaults.latitude,
      longitude: defaults.longitude,
      timezone: defaults.timezone,
      regionCode: defaults.regionCode,
      source: 'default',
    },
  };
}
