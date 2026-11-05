import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import {
  computePageChunks,
  inspectPdf,
  slicePdfPages,
} from '../src/features/medical/pdf-page-utils.ts';

async function createSamplePdf(pageCount) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage();
  }
  const bytes = await doc.save();
  return new File([bytes], 'sample.pdf', { type: 'application/pdf' });
}

test('computePageChunks creates correct single chunk for <= 20 pages', () => {
  const chunks = computePageChunks(16, 20);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].start, 1);
  assert.equal(chunks[0].end, 16);
  assert.equal(chunks[0].pageCount, 16);
  assert.equal(chunks[0].label, 'Wszystkie strony (1–16)');
});

test('computePageChunks creates sequential chunks for > 20 pages', () => {
  const chunks = computePageChunks(35, 20);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].start, 1);
  assert.equal(chunks[0].end, 20);
  assert.equal(chunks[0].pageCount, 20);
  assert.equal(chunks[0].label, 'Część 1 (strony 1–20)');

  assert.equal(chunks[1].start, 21);
  assert.equal(chunks[1].end, 35);
  assert.equal(chunks[1].pageCount, 15);
  assert.equal(chunks[1].label, 'Część 2 (strony 21–35)');
});

test('inspectPdf counts pages accurately', async () => {
  const pdfFile = await createSamplePdf(7);
  const info = await inspectPdf(pdfFile);
  assert.equal(info.pageCount, 7);
  assert.equal(info.name, 'sample.pdf');
});

test('slicePdfPages returns identical file if full range requested', async () => {
  const pdfFile = await createSamplePdf(10);
  const result = await slicePdfPages(pdfFile, 1, 10);
  assert.equal(result, pdfFile);
});

test('slicePdfPages cuts sub-range of pages', async () => {
  const pdfFile = await createSamplePdf(16);
  const sliced = await slicePdfPages(pdfFile, 3, 7);
  const info = await inspectPdf(sliced);
  assert.equal(info.pageCount, 5);
  assert.equal(sliced.name, 'sample_strony_3-7.pdf');
});

test('slicePdfPages rejects ranges exceeding MAX_DISCHARGE_PAGES or bounds', async () => {
  const pdfFile = await createSamplePdf(15);
  await assert.rejects(
    () => slicePdfPages(pdfFile, 1, 25),
    /Maksymalny dopuszczalny limit/
  );
  await assert.rejects(
    () => slicePdfPages(pdfFile, 0, 5),
    /Początkowa strona nie może być mniejsza niż 1/
  );
  await assert.rejects(
    () => slicePdfPages(pdfFile, 5, 2),
    /Strona końcowa nie może być mniejsza/
  );
  await assert.rejects(
    () => slicePdfPages(pdfFile, 10, 18),
    /przekracza liczbę stron/
  );
});
