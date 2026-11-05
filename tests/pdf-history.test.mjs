import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPdfImportHistory,
  recordPdfImport,
  getSuggestedNextRange,
} from '../src/features/medical/pdf-history.ts';

// Simple mock for localStorage in Node test runner
const storage = new Map();
globalThis.window = {};
globalThis.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

beforeEach(() => {
  storage.clear();
});

test('getSuggestedNextRange returns initial 1..20 for fresh file', () => {
  const range = getSuggestedNextRange(35, null, 20);
  assert.equal(range.start, 1);
  assert.equal(range.end, 20);
  assert.equal(range.hasUnimported, true);
});

test('recordPdfImport saves range and getSuggestedNextRange suggests remaining pages', () => {
  const petId = 'pet-123';
  const sha256 = 'abc12345';
  recordPdfImport(petId, sha256, 'wypis.pdf', 1, 20);

  const history = getPdfImportHistory(petId, sha256);
  assert.ok(history);
  assert.equal(history.fileName, 'wypis.pdf');
  assert.equal(history.allImportedPages.length, 20);
  assert.equal(history.importedRanges.length, 1);

  const nextRange = getSuggestedNextRange(35, history, 20);
  assert.equal(nextRange.start, 21);
  assert.equal(nextRange.end, 35);
  assert.equal(nextRange.hasUnimported, true);
});

test('getSuggestedNextRange detects when all pages are already imported', () => {
  const petId = 'pet-123';
  const sha256 = 'abc12345';
  recordPdfImport(petId, sha256, 'wypis.pdf', 1, 15);

  const history = getPdfImportHistory(petId, sha256);
  const nextRange = getSuggestedNextRange(15, history, 20);
  assert.equal(nextRange.hasUnimported, false);
});
