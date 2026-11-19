import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import {
  RECOVERY_ALPHABET,
  RECOVERY_KEY_LENGTH,
  constantTimeEqualHex,
  escapeHtml,
  formatRecoveryKey,
  formatRecoveryKeyHint,
  generateRecoveryKey,
  generateSaltHex,
  generateSecureToken,
  hashRecoveryKey,
  isValidEmail,
  isValidRecoveryKeyFormat,
  maskEmail,
  normalizeEmail,
  normalizeRecoveryKey,
  verifyRecoveryKey,
} from "../supabase/functions/_shared/recovery-crypto.mjs";
import {
  buildRecoveryKeyPdfWithAssets,
  buildRecoveryQrUrl,
} from "../src/features/household/recovery-key-pdf.ts";

const regularFontBytes = new Uint8Array(
  readFileSync("public/fonts/Inter-Regular.ttf"),
);
const boldFontBytes = new Uint8Array(
  readFileSync("public/fonts/Inter-Bold.ttf"),
);
const logoPngBytes = new Uint8Array(readFileSync("public/brand/icon-192.png"));

test("generateRecoveryKey produces formatted CMP key of expected length and safe alphabet", () => {
  const key = generateRecoveryKey();
  assert.match(key, /^CMP(-[A-Z2-9]{4}){5}$/);
  const normalized = normalizeRecoveryKey(key);
  assert.equal(normalized.length, RECOVERY_KEY_LENGTH);
  for (const ch of normalized) {
    assert.ok(RECOVERY_ALPHABET.includes(ch), `Unexpected char ${ch}`);
    assert.ok(!"0O1I".includes(ch), `Ambiguous char ${ch} must not appear`);
  }
  assert.equal(isValidRecoveryKeyFormat(key), true);
  assert.equal(formatRecoveryKeyHint(key), `CMP-...${normalized.slice(-4)}`);
});

test("normalizeRecoveryKey accepts lowercase, spaces, hyphens, and bare 20-char keys", () => {
  const generated = generateRecoveryKey();
  const bare = generated.slice(4); // XXXX-XXXX-XXXX-XXXX-XXXX
  const messy = `  cmp ${bare.toLowerCase().replace(/-/g, " ")}  `;

  assert.equal(normalizeRecoveryKey(generated), normalizeRecoveryKey(bare));
  assert.equal(normalizeRecoveryKey(messy), normalizeRecoveryKey(generated));
  assert.equal(formatRecoveryKey(bare.toLowerCase()), generated);
  assert.equal(isValidRecoveryKeyFormat(bare), true);
  assert.equal(isValidRecoveryKeyFormat("CMP-TOO-SHORT"), false);
});

test("hashRecoveryKey and verifyRecoveryKey validate PBKDF2 SHA-256 digests", async () => {
  const key = generateRecoveryKey();
  const salt = generateSaltHex();
  const hash = await hashRecoveryKey(key, salt);

  assert.equal(salt.length, 32);
  assert.equal(hash.length, 64);

  assert.equal(await verifyRecoveryKey(key, salt, hash), true);
  assert.equal(
    await verifyRecoveryKey(key.slice(4).toLowerCase(), salt, hash),
    true,
  );

  // Zmiana jednego znaku musi odrzucić weryfikację
  const mutated =
    key.slice(0, -1) + (key.endsWith("2") ? "3" : "2");
  assert.equal(await verifyRecoveryKey(mutated, salt, hash), false);
  assert.equal(await verifyRecoveryKey("INVALID", salt, hash), false);
});

test("email normalization, masking, token, and constantTimeEqualHex behave safely", () => {
  assert.equal(normalizeEmail("  Jan.Kowalski@Example.PL "), "jan.kowalski@example.pl");
  assert.equal(isValidEmail("jan@example.pl"), true);
  assert.equal(isValidEmail("bad-email"), false);
  assert.equal(maskEmail("anna.nowak@poczta.pl"), "an***@poczta.pl");
  assert.equal(maskEmail("a@b.pl"), "a***@b.pl");

  const token = generateSecureToken();
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);

  assert.equal(constantTimeEqualHex("abcd", "abcd"), true);
  assert.equal(constantTimeEqualHex("abcd", "abce"), false);
  assert.equal(constantTimeEqualHex("abcd", "abc"), false);
  assert.equal(constantTimeEqualHex("", ""), false);

  assert.equal(
    escapeHtml(`<script>"alert('x')" &`),
    "&lt;script&gt;&quot;alert(&#39;x&#39;)&quot; &amp;",
  );
});

test("buildRecoveryQrUrl puts owner and key strictly inside URL hash fragment", () => {
  const url = buildRecoveryQrUrl({
    recoveryUrl: "https://caremypet.app/pl/odzyskaj",
    ownerEmail: "owner+pet@example.pl",
    recoveryKey: "CMP-AAAA-BBBB-CCCC-DDDD-EEEE",
  });
  const parsed = new URL(url);
  assert.equal(parsed.origin + parsed.pathname, "https://caremypet.app/pl/odzyskaj");
  assert.equal(parsed.search, "");
  const hashParams = new URLSearchParams(parsed.hash.slice(1));
  assert.equal(hashParams.get("owner"), "owner+pet@example.pl");
  assert.equal(hashParams.get("key"), "CMP-AAAA-BBBB-CCCC-DDDD-EEEE");
});

test("buildRecoveryKeyPdfWithAssets renders a 1-page A4 PDF with Polish diacritics and QR code", async () => {
  const key = generateRecoveryKey();
  const bytes = await buildRecoveryKeyPdfWithAssets(
    {
      householdName: "Dom Żółwia i Psa Śnieżka 🐾",
      ownerEmail: "wlasciciel+test@domena.pl",
      recoveryEmail: "zaufana.osoba@domena.pl",
      recoveryKey: key,
      keyHint: formatRecoveryKeyHint(key),
      createdAtIso: "2026-11-18T14:00:00.000Z",
      recoveryUrl: "https://caremypet.app/pl/odzyskaj",
      locale: "pl",
    },
    {
      regular: regularFontBytes,
      bold: boldFontBytes,
      logoPng: logoPngBytes,
    },
  );

  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 5000);
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assert.equal(header, "%PDF-");

  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 1);
  const page = parsed.getPage(0);
  const { width, height } = page.getSize();
  assert.ok(Math.abs(width - 595.28) < 1);
  assert.ok(Math.abs(height - 841.89) < 1);
});
