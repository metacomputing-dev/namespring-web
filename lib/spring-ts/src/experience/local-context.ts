import { findNameIdentityModeConflictV1 } from '../name-identity-contract.js';
import { assertNameCharacterSyntax } from '../name-entry-resolver.js';
import { snapshotCandidateSearchRequestV1 } from '../public-request-snapshot.js';
import {
  AnalysisOptionsContractError,
  assertAnalysisOptionsContractV1,
} from '../report/analysis-options-validation.js';
import {
  LOCAL_ANALYSIS_CONTEXT_SCHEMA_V1,
  LOCAL_CONTEXT_ID_PATTERN_V1,
  type LocalAnalysisContextInputV1,
  type LocalAnalysisContextV1,
  type LocalAnalysisNameCharacterV1,
  type LocalBirthInputV1,
} from './local-menu-types.js';
import { assertLocalBirthInputV1 } from './local-birth-preview.js';
import {
  assertLocalDataObject,
  failLocalMenu,
  freezeLocalOwned,
  isOneHangul,
  isOneUnicodeScalar,
  randomLocalOpaqueId,
} from './local-menu-primitives.js';

function normalizeNameCharacters(
  value: unknown,
  role: 'surname' | 'givenName',
  max: number,
): readonly LocalAnalysisNameCharacterV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) failLocalMenu('INVALID_NAME');
  const normalized: LocalAnalysisNameCharacterV1[] = [];
  for (const raw of value) {
    assertLocalDataObject(raw, ['hangul', 'hanja'], 'INVALID_NAME');
    if (!isOneHangul(raw.hangul)) failLocalMenu('INVALID_NAME');
    if (raw.hanja !== undefined
      && (typeof raw.hanja !== 'string'
        || raw.hanja !== raw.hanja.trim()
        || raw.hanja !== raw.hanja.normalize('NFC')
        || (raw.hanja.length > 0
          && raw.hanja !== raw.hangul
          && !isOneUnicodeScalar(raw.hanja)))) {
      failLocalMenu('INVALID_NAME');
    }
    const hanja = typeof raw.hanja === 'string' ? raw.hanja : '';
    normalized.push(Object.freeze({
      hangul: raw.hangul,
      ...(hanja && hanja !== raw.hangul ? { hanja } : {}),
    }));
  }
  try {
    assertNameCharacterSyntax(normalized, { role });
  } catch {
    failLocalMenu('INVALID_NAME');
  }
  return Object.freeze(normalized);
}

function validateOptions(value: unknown, birthYear: number): void {
  try {
    assertAnalysisOptionsContractV1(value, birthYear, {
      allowRemoteLunarConversion: false,
    });
  } catch (error) {
    if (error instanceof AnalysisOptionsContractError
      && error.kind === 'REMOTE_FORBIDDEN') {
      failLocalMenu('REMOTE_COMPUTATION_FORBIDDEN');
    }
    if (error instanceof AnalysisOptionsContractError) failLocalMenu('INVALID_OPTIONS');
    throw error;
  }
}

function assertContextInput(value: unknown): {
  readonly birth: LocalBirthInputV1;
  readonly surname: readonly LocalAnalysisNameCharacterV1[];
  readonly givenName?: readonly LocalAnalysisNameCharacterV1[];
  readonly options?: LocalAnalysisContextInputV1['options'];
} {
  assertLocalDataObject(value, ['birth', 'surname', 'givenName', 'options']);
  assertLocalBirthInputV1(value.birth);
  const surname = normalizeNameCharacters(value.surname, 'surname', 2);
  const givenName = value.givenName === undefined
    ? undefined
    : normalizeNameCharacters(value.givenName, 'givenName', 4);
  if (value.options !== undefined) validateOptions(value.options, value.birth.year);
  const pureHangulNameMode = value.options === undefined
    ? undefined
    : (value.options as Record<string, unknown>).pureHangulNameMode;
  const surnameConflict = findNameIdentityModeConflictV1(surname, {
    role: 'surname',
    pureHangulNameMode,
  });
  if (surnameConflict) failLocalMenu(surnameConflict);
  if (givenName) {
    const givenNameConflict = findNameIdentityModeConflictV1(givenName, {
      role: 'givenName',
      pureHangulNameMode,
    });
    if (givenNameConflict) failLocalMenu(givenNameConflict);
  }
  return {
    birth: value.birth,
    surname,
    ...(givenName ? { givenName } : {}),
    ...(value.options !== undefined
      ? { options: value.options as LocalAnalysisContextInputV1['options'] }
      : {}),
  };
}

export function createLocalAnalysisContextV1(
  input: LocalAnalysisContextInputV1,
): LocalAnalysisContextV1 {
  const snapshot = snapshotCandidateSearchRequestV1(
    input as unknown as Parameters<typeof snapshotCandidateSearchRequestV1>[0],
  ) as unknown as LocalAnalysisContextInputV1;
  const validated = assertContextInput(snapshot);
  const context: LocalAnalysisContextV1 = {
    schemaVersion: LOCAL_ANALYSIS_CONTEXT_SCHEMA_V1,
    contextId: randomLocalOpaqueId('local_context_v1_'),
    scope: 'device_session',
    computation: 'local_only',
    birth: validated.birth,
    name: {
      surname: validated.surname,
      ...(validated.givenName ? { givenName: validated.givenName } : {}),
    },
    ...(validated.options ? { options: validated.options } : {}),
    privacy: {
      containsPersonalData: true,
      urlEmbedding: 'forbidden',
      serverTransfer: 'premium_registration_only',
    },
  };
  assertLocalAnalysisContextV1(context);
  return freezeLocalOwned(context);
}

export function assertLocalAnalysisContextV1(
  value: unknown,
): asserts value is LocalAnalysisContextV1 {
  assertLocalDataObject(value, [
    'schemaVersion', 'contextId', 'scope', 'computation', 'birth', 'name', 'options', 'privacy',
  ]);
  if (value.schemaVersion !== LOCAL_ANALYSIS_CONTEXT_SCHEMA_V1
    || !LOCAL_CONTEXT_ID_PATTERN_V1.test(String(value.contextId ?? ''))
    || value.scope !== 'device_session'
    || value.computation !== 'local_only') {
    failLocalMenu('CONTRACT_INVALID');
  }
  assertLocalBirthInputV1(value.birth);
  assertLocalDataObject(value.name, ['surname', 'givenName'], 'CONTRACT_INVALID');
  const surname = normalizeNameCharacters(value.name.surname, 'surname', 2);
  const givenName = value.name.givenName === undefined
    ? undefined
    : normalizeNameCharacters(value.name.givenName, 'givenName', 4);
  if (value.options !== undefined) validateOptions(value.options, value.birth.year);
  const pureHangulNameMode = value.options === undefined
    ? undefined
    : (value.options as Record<string, unknown>).pureHangulNameMode;
  const surnameConflict = findNameIdentityModeConflictV1(surname, {
    role: 'surname',
    pureHangulNameMode,
  });
  if (surnameConflict) failLocalMenu(surnameConflict);
  if (givenName) {
    const givenNameConflict = findNameIdentityModeConflictV1(givenName, {
      role: 'givenName',
      pureHangulNameMode,
    });
    if (givenNameConflict) failLocalMenu(givenNameConflict);
  }
  assertLocalDataObject(value.privacy, [
    'containsPersonalData', 'urlEmbedding', 'serverTransfer',
  ], 'CONTRACT_INVALID');
  if (value.privacy.containsPersonalData !== true
    || value.privacy.urlEmbedding !== 'forbidden'
    || value.privacy.serverTransfer !== 'premium_registration_only') {
    failLocalMenu('CONTRACT_INVALID');
  }
}
