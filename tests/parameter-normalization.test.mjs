import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeReferenceRatio,
  convertMeasurementValue,
  groupReportsByDate,
  normalizeUnit,
  resolveParameterIdentity,
} from '../src/features/medical/parameter-normalization.ts';

test('merges Polish and English parameter synonyms while keeping % and absolute counts distinct', () => {
  const creaPl = resolveParameterIdentity({ name: 'Kreatynina', unit: 'mg/dl' }, 'pl');
  const creaEn = resolveParameterIdentity({ name: 'Creatinine', unit: 'µmol/L' }, 'pl');
  assert.equal(creaPl.key, 'creatinine');
  assert.equal(creaEn.key, 'creatinine');
  assert.equal(creaPl.displayName, 'Kreatynina');

  const ureaPl = resolveParameterIdentity({ name: 'Mocznik', unit: 'mg/dl' }, 'pl');
  const ureaEn = resolveParameterIdentity({ name: 'Urea', unit: 'mmol/L' }, 'pl');
  assert.equal(ureaPl.key, 'urea');
  assert.equal(ureaEn.key, 'urea');

  const bun = resolveParameterIdentity({ name: 'BUN', unit: 'mg/dl' }, 'pl');
  assert.notEqual(bun.key, 'urea');

  const neuPct = resolveParameterIdentity({ name: 'Neutrofile', unit: '%' }, 'pl');
  const neuAbs = resolveParameterIdentity({ name: 'NEU', unit: '10^9/L' }, 'pl');
  assert.equal(neuPct.key, 'neu:pct');
  assert.equal(neuAbs.key, 'neu:abs');
});

test('distinguishes G/L vs g/L and converts compatible veterinary lab units', () => {
  assert.equal(normalizeUnit('G/L'), '10^9/l');
  assert.equal(normalizeUnit('g/L'), 'g/l');
  assert.equal(normalizeUnit('10^3/µL'), '10^9/l');
  assert.equal(normalizeUnit('10^6/µL'), '10^12/l');
  assert.equal(normalizeUnit('x10^12/LL'), '10^12/l');
  assert.equal(normalizeUnit('×10¹²/L'), '10^12/l');
  assert.equal(normalizeUnit('x10^9/LL'), '10^9/l');

  const creaMgDl = convertMeasurementValue(707.2, 'µmol/L', 'mg/dl', 'creatinine');
  assert.ok(creaMgDl !== null && Math.abs(creaMgDl - 8.0) < 0.01);

  const ureaMgDl = convertMeasurementValue(41.05, 'mmol/L', 'mg/dl', 'urea');
  assert.ok(ureaMgDl !== null && Math.abs(ureaMgDl - 246.546) < 0.1);

  const hgbGdL = convertMeasurementValue(131, 'g/L', 'g/dl', 'mass_conc');
  assert.ok(hgbGdL !== null && Math.abs(hgbGdL - 13.1) < 0.001);

  const hctPct = convertMeasurementValue(0.426, 'L/L', '%', 'fraction_pct');
  assert.ok(hctPct !== null && Math.abs(hctPct - 42.6) < 0.001);

  assert.equal(convertMeasurementValue(10, 'U/L', 'mg/dl', 'creatinine'), null);
});

test('computes normalized ratio against cell reference range', () => {
  assert.equal(computeReferenceRatio({ value: '1.5', reference: '1.0 - 2.0' }), 0.5);
  assert.equal(computeReferenceRatio({ value: '<0.2', reference: '0 - 0.5' }), null);
});

test('merges all same-day lab reports into a single date column preserving report order', () => {
  const reports = [
    { id: 'bio-09', test_date: '2026-11-09' },
    { id: 'morph-09', test_date: '2026-11-09' },
    { id: 'lab-04', test_date: '2026-11-04' },
  ];

  const grouped = groupReportsByDate(reports, (r) => r.test_date);

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].testDate, '2026-11-09');
  assert.deepEqual(
    grouped[0].items.map((r) => r.id),
    ['bio-09', 'morph-09'],
  );
  assert.deepEqual(
    grouped[1].items.map((r) => r.id),
    ['lab-04'],
  );
});
