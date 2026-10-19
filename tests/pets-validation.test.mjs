import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePet } from '../supabase/functions/pets/validation.mjs';
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
