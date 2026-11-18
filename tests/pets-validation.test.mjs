import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePet,
  validateArchivePet,
  MAX_ARCHIVE_NOTE_LENGTH,
} from '../supabase/functions/pets/validation.mjs';
const base = { imie: ' Luna ', gatunek: 'cat', plec: 'unknown', kastracja: null, identyfikacja: 'unknown' };
test('approximate birthdate requires a date and avatar must be a storage key', () => {
  assert.equal(validatePet({...base,data_urodzenia_przyblizona:true}).ok,false);
  assert.equal(validatePet({...base,data_urodzenia:'2020-01-01',data_urodzenia_przyblizona:true}).ok,true);
  assert.equal(validatePet({...base,avatar_path:'https://example.com/pic.jpg'}).ok,false);
  assert.equal(validatePet({...base,avatar_path:'../other.jpg'}).ok,false);
  assert.equal(validatePet({...base,avatar_path:'10000000-0000-4000-8000-000000000001/10000000-0000-4000-8000-000000000002.jpg'}).ok,true);
});
test('normalizes fields and strips spoofed ownership', () => {
  const result = validatePet({ ...base, gospodarstwo_id: 'other', created_by: 'other', extra: true });
  assert.equal(result.ok, true);
  assert.equal(result.value.imie, 'Luna');
  assert.equal(result.value.gospodarstwo_id, undefined);
  assert.equal(result.value.created_by, undefined);
});
test('rejects invalid dates, including calendar overflow and future dates', () => {
  for (const date of ['2025-02-29', '2024-02-30', '1899-12-31', '2027-01-01', '2020-1-1']) {
    assert.deepEqual(validatePet({ ...base, data_urodzenia: date }, '2026-10-18'), { ok: false, field: 'data_urodzenia' });
  }
  assert.equal(validatePet({ ...base, data_urodzenia: '2024-02-29' }).ok, true);
});
test('identification requires an appropriate number', () => {
  for (const number of ['', '123', '12345678901234x']) assert.equal(validatePet({ ...base, identyfikacja: 'chip', numer_id: number }).ok, false);
  assert.equal(validatePet({ ...base, identyfikacja: 'chip', numer_id: '123456789012345' }).ok, true);
  assert.equal(validatePet({ ...base, identyfikacja: 'tattoo' }).ok, false);
  assert.equal(validatePet({ ...base, numer_id: 'stale' }).value.numer_id, null);
});
test('rejects malformed input and length overflow', () => {
  for (const input of [null, [], 'cat', { ...base, imie: ' ' }, { ...base, imie: 'a'.repeat(81) }, { ...base, gatunek: 'bird' }, { ...base, notatki: 'a'.repeat(4001) }, { ...base, kastracja: 'false' }]) {
    assert.equal(validatePet(input).ok, false);
  }
});
test('normalizes and validates pet tags', () => {
  assert.deepEqual(validatePet(base).value.tagi, []);
  const res = validatePet({ ...base, tagi: ['  nerkowiec ', 'Onkologiczna', 'onkologiczna', '   ', 'stres  u   weta'] });
  assert.equal(res.ok, true);
  assert.deepEqual(res.value.tagi, ['nerkowiec', 'Onkologiczna', 'stres u weta']);
  for (const badTags of ['nerkowiec', [123], ['a'.repeat(41)], Array.from({ length: 9 }, (_, i) => `tag-${i}`)]) {
    assert.deepEqual(validatePet({ ...base, tagi: badTags }), { ok: false, field: 'tagi' });
  }
});
test('validates pet archiving reason, departure date, and optional note', () => {
  assert.deepEqual(
    validateArchivePet(
      { archive_reason: 'deceased', closed_on: '2026-11-10', archive_note: '  Żegnaj kochany.  ' },
      '2026-11-17',
      '2015-05-01',
    ),
    {
      ok: true,
      value: { archive_reason: 'deceased', closed_on: '2026-11-10', archive_note: 'Żegnaj kochany.' },
    },
  );
  // Strips closed_on when reason is not deceased and normalizes blank note
  assert.deepEqual(
    validateArchivePet(
      { archive_reason: 'rehomed', closed_on: '2026-11-10', archive_note: '   ' },
      '2026-11-17',
      '2015-05-01',
    ),
    {
      ok: true,
      value: { archive_reason: 'rehomed', closed_on: null, archive_note: null },
    },
  );
  // Deceased without optional date
  assert.deepEqual(
    validateArchivePet({ archive_reason: 'deceased', closed_on: '', archive_note: null }, '2026-11-17', '2015-05-01'),
    {
      ok: true,
      value: { archive_reason: 'deceased', closed_on: null, archive_note: null },
    },
  );
  // Invalid closed_on (before birthdate, future, calendar overflow, malformed)
  for (const badDate of ['2015-04-30', '2026-11-18', '2025-02-29', '1899-12-31', '2026/11/10']) {
    assert.deepEqual(
      validateArchivePet(
        { archive_reason: 'deceased', closed_on: badDate },
        '2026-11-17',
        '2015-05-01',
      ),
      { ok: false, field: 'closed_on' },
    );
  }
  assert.deepEqual(validateArchivePet({ archive_reason: 'deleted' }), { ok: false, field: 'archive_reason' });
  assert.deepEqual(
    validateArchivePet({ archive_reason: 'other', archive_note: 'x'.repeat(MAX_ARCHIVE_NOTE_LENGTH + 1) }),
    { ok: false, field: 'archive_note' },
  );
});
