import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPdfImportHistory,
  recordPdfImport,
  recordPdfImportPages,
  getSuggestedNextRange,
  getSuggestedNextPages,
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

test('getSuggestedNextRange returns initial 1..10 for fresh file', () => {
  const range = getSuggestedNextRange(16, null, 10);
  assert.equal(range.start, 1);
  assert.equal(range.end, 10);
  assert.equal(range.hasUnimported, true);
});

test('recordPdfImport saves range and getSuggestedNextRange suggests remaining pages', () => {
  const petId = 'pet-123';
  const sha256 = 'abc12345';
  recordPdfImport(petId, sha256, 'wypis.pdf', 1, 10);

  const history = getPdfImportHistory(petId, sha256);
  assert.ok(history);
  assert.equal(history.fileName, 'wypis.pdf');
  assert.equal(history.allImportedPages.length, 10);
  assert.equal(history.importedRanges.length, 1);

  const nextRange = getSuggestedNextRange(16, history, 10);
  assert.equal(nextRange.start, 11);
  assert.equal(nextRange.end, 16);
  assert.equal(nextRange.hasUnimported, true);
});

test('getSuggestedNextRange detects when all pages are already imported', () => {
  const petId = 'pet-123';
  const sha256 = 'abc12345';
  recordPdfImport(petId, sha256, 'wypis.pdf', 1, 15);

  const history = getPdfImportHistory(petId, sha256);
  const nextRange = getSuggestedNextRange(15, history, 10);
  assert.equal(nextRange.hasUnimported, false);
});

test('recordPdfImportPages saves arbitrary pages and getSuggestedNextPages suggests next unimported', () => {
  const petId = 'pet-456';
  const sha256 = 'xyz999';
  recordPdfImportPages(petId, sha256, 'wypis-manius.pdf', [1, 2, 3, 4, 5]);

  const history = getPdfImportHistory(petId, sha256);
  assert.ok(history);
  assert.deepEqual(history.allImportedPages, [1, 2, 3, 4, 5]);

  const next = getSuggestedNextPages(16, history, 10);
  assert.equal(next.hasUnimported, true);
  // Next 10 unimported pages should be 6..15
  assert.deepEqual(next.pages, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

  // Record second batch
  recordPdfImportPages(petId, sha256, 'wypis-manius.pdf', [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  const history2 = getPdfImportHistory(petId, sha256);
  assert.equal(history2.allImportedPages.length, 15);

  const next2 = getSuggestedNextPages(16, history2, 10);
  assert.equal(next2.hasUnimported, true);
  assert.deepEqual(next2.pages, [16]);

  // Record third batch (final page 16)
  recordPdfImportPages(petId, sha256, 'wypis-manius.pdf', [16]);
  const history3 = getPdfImportHistory(petId, sha256);
  assert.equal(history3.allImportedPages.length, 16);

  // When all pages are imported, suggested pages should be empty (prevent duplicate import)
  const next3 = getSuggestedNextPages(16, history3, 10);
  assert.equal(next3.hasUnimported, false);
  assert.deepEqual(next3.pages, []);
});
