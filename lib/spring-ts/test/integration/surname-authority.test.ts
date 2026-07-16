import assert from 'node:assert/strict';

import {
  NameEntryResolutionError,
  resolveNameEntries,
  type NameEntryRepository,
} from '../../src/name-entry-resolver.js';
import {
  surnameAuthorityCounts,
  verifySurnameAuthority,
} from '../../src/surname-authority.js';
import type { NameCharInput } from '../../src/types.js';

const compounds = [
  { hangul: '남궁', hanja: '南宮' },
  { hangul: '사공', hanja: '司空' },
  { hangul: '서문', hanja: '西門' },
  { hangul: '선우', hanja: '鮮于' },
  { hangul: '제갈', hanja: '諸葛' },
  { hangul: '황보', hanja: '皇甫' },
] as const;

function surnameInputs(hangul: string, hanja?: string): NameCharInput[] {
  const hangulCharacters = Array.from(hangul);
  const hanjaCharacters = hanja === undefined ? [] : Array.from(hanja);
  return hangulCharacters.map((character, index) => ({
    hangul: character,
    ...(hanja === undefined ? {} : { hanja: hanjaCharacters[index] }),
  }));
}

function fakeEntry(hangul: string, hanja: string, id: number): any {
  return {
    id,
    hangul,
    hanja,
    onset: '',
    nucleus: '',
    strokes: 1,
    stroke_element: 'Wood',
    resource_element: 'Water',
    meaning: 'verified test row',
    radical: '',
    is_surname: false,
  };
}

function repositoryFor(
  entries: readonly any[],
  calls?: { count: number },
): NameEntryRepository {
  return {
    findByHanja: async (hanja) => {
      if (calls) calls.count += 1;
      return entries.find((entry) => entry.hanja === hanja) ?? null;
    },
    findByHangul: async (hangul) => {
      if (calls) calls.count += 1;
      return entries.filter((entry) => entry.hangul === hangul);
    },
  };
}

assert.deepEqual(surnameAuthorityCounts(), {
  singleRows: 314,
  singleReadings: 181,
  compoundRows: 6,
});

for (const compound of compounds) {
  const pure = verifySurnameAuthority(surnameInputs(compound.hangul));
  assert.equal(pure.ok, true, compound.hangul + ' pure-Hangul tuple must be registered');
  if (pure.ok) {
    assert.equal(pure.authority.kind, 'compound');
    assert.equal(pure.authority.hanja.join(''), compound.hanja);
  }

  const explicit = verifySurnameAuthority(surnameInputs(compound.hangul, compound.hanja));
  assert.equal(explicit.ok, true, compound.hangul + ' explicit tuple must be registered');

  const entries = Array.from(compound.hangul).map((hangul, index) =>
    fakeEntry(hangul, Array.from(compound.hanja)[index], index + 1));
  const resolved = await resolveNameEntries(
    surnameInputs(compound.hangul),
    repositoryFor(entries),
    { isSurname: true },
  );
  assert.equal(resolved.map((entry) => entry.hanja).join(''), compound.hanja);
  assert.ok(
    resolved.every((entry) => entry.is_surname === true),
    'tuple authority, not a component flag, must establish compound-surname eligibility',
  );

  const noCalls = { count: 0 };
  const fallbacks = await resolveNameEntries(
    surnameInputs(compound.hangul),
    repositoryFor([], noCalls),
    { isSurname: true, forceHangulOnly: true },
  );
  assert.equal(fallbacks.map((entry) => entry.hangul).join(''), compound.hangul);
  assert.ok(fallbacks.every((entry) => entry.hanja === '' && entry.is_surname === true));
  assert.equal(noCalls.count, 0, 'verified pure-Hangul fallback must not query the repository');
}

const rejected = [
  {
    label: 'Cartesian single-surname combination',
    input: surnameInputs('김박'),
    reason: 'unverified_compound_surname',
  },
  {
    label: 'reversed registered compound',
    input: surnameInputs('궁남'),
    reason: 'unverified_compound_surname',
  },
  {
    label: 'wrong explicit compound Hanja',
    input: surnameInputs('남궁', '南空'),
    reason: 'unverified_compound_surname',
  },
  {
    label: 'partial explicit compound Hanja',
    input: [
      { hangul: '남', hanja: '南' },
      { hangul: '궁' },
    ],
    reason: 'partial_compound_surname_hanja',
  },
  {
    label: 'unsupported compound reading',
    input: surnameInputs('독고'),
    reason: 'unverified_compound_surname',
  },
  {
    label: 'unsupported compound reading two',
    input: surnameInputs('동방'),
    reason: 'unverified_compound_surname',
  },
  {
    label: 'mismatched registered single Hanja',
    input: surnameInputs('김', '崔'),
    reason: 'unverified_single_surname',
  },
] as const;

for (const fixture of rejected) {
  assert.deepEqual(
    verifySurnameAuthority(fixture.input),
    { ok: false, reason: fixture.reason },
    fixture.label,
  );
}

const invalidForceCalls = { count: 0 };
await assert.rejects(
  resolveNameEntries(
    surnameInputs('김박'),
    repositoryFor([], invalidForceCalls),
    { isSurname: true, forceHangulOnly: true },
  ),
  (error: unknown) => {
    assert.ok(error instanceof NameEntryResolutionError);
    assert.equal(error.reason, 'unverified_compound_surname');
    assert.equal(error.message.includes('김'), false);
    assert.equal(error.message.includes('박'), false);
    return true;
  },
);
assert.equal(invalidForceCalls.count, 0, 'forceHangulOnly must not bypass tuple authority');

await assert.rejects(
  resolveNameEntries(
    surnameInputs('남궁'),
    repositoryFor([]),
    { isSurname: true },
  ),
  (error: unknown) => {
    assert.ok(error instanceof NameEntryResolutionError);
    assert.equal(error.reason, 'explicit_hanja_not_found');
    return true;
  },
  'a registered tuple with missing exact DB rows must fail closed',
);

await assert.rejects(
  resolveNameEntries(
    surnameInputs('류'),
    repositoryFor([]),
    { isSurname: true },
  ),
  (error: unknown) => {
    assert.ok(error instanceof NameEntryResolutionError);
    assert.equal(error.reason, 'ambiguous_surname_hanja');
    return true;
  },
  'a registered single reading with multiple Hanja must require explicit Hanja',
);

console.log('Surname authority: PASS');