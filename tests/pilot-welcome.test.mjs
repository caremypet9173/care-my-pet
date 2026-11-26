import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_APP_ORIGIN,
  buildPilotWelcomeEmailContent,
  normalizePilotWelcomeEmails,
  resolveAppOrigin,
} from "../supabase/functions/_shared/pilot-welcome.mjs";

test("resolveAppOrigin prefers valid SITE_URL / APP_URL origins and falls back safely", () => {
  assert.equal(
    resolveAppOrigin("https://caremypet.pl/some/path/", undefined),
    "https://caremypet.pl",
  );
  assert.equal(
    resolveAppOrigin("", "https://preview.caremypet.pl/"),
    "https://preview.caremypet.pl",
  );
  assert.equal(
    resolveAppOrigin("javascript:alert(1)", "not-a-url"),
    DEFAULT_APP_ORIGIN,
  );
  assert.equal(
    resolveAppOrigin("https://caremypet.pl\r\nEvil: header", undefined),
    DEFAULT_APP_ORIGIN,
  );
});

test("normalizePilotWelcomeEmails normalizes, deduplicates, filters invalid and enforces batch cap", () => {
  const result = normalizePilotWelcomeEmails(
    [
      "  Brombs@O2.pl ",
      "brombs@o2.pl",
      "konioglowie@gmail.com",
      "not-an-email",
      "evil@example.com\r\nBcc:x@y.pl",
      "",
      "third@example.com",
    ],
    2,
  );

  assert.deepEqual(result.valid, ["brombs@o2.pl", "konioglowie@gmail.com"]);
  assert.deepEqual(result.invalid, [
    "not-an-email",
    "evil@example.com Bcc:x@y.pl",
  ]);
  assert.equal(result.truncated, true);
});

test("normalizePilotWelcomeEmails accepts a single string input", () => {
  const result = normalizePilotWelcomeEmails("Tester@Example.com");
  assert.deepEqual(result, {
    valid: ["tester@example.com"],
    invalid: [],
    truncated: false,
  });
});

test("buildPilotWelcomeEmailContent builds PL and EN cards with safe escaping and localized register URL", () => {
  const pl = buildPilotWelcomeEmailContent({
    email: "Brombs@o2.pl",
    locale: "pl",
    appOrigin: "https://caremypet.pl/",
  });

  assert.equal(pl.registerUrl, "https://caremypet.pl/pl/register");
  assert.equal(pl.card.locale, "pl");
  assert.equal(pl.card.cta.url, "https://caremypet.pl/pl/register");
  assert.match(pl.subject, /pilotażu/i);
  assert.ok(pl.card.paragraphs[0].includes("<strong>brombs@o2.pl</strong>"));

  const en = buildPilotWelcomeEmailContent({
    email: "user+tag@example.com",
    locale: "en",
    appOrigin: "https://caremypet.pl",
  });

  assert.equal(en.registerUrl, "https://caremypet.pl/en/register");
  assert.equal(en.card.locale, "en");
  assert.equal(en.card.cta.url, "https://caremypet.pl/en/register");
  assert.match(en.subject, /closed pilot/i);
  assert.ok(en.card.paragraphs[0].includes("<strong>user+tag@example.com</strong>"));
});
