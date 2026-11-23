import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const normalizeNewlines = (text) => text.replace(/\r\n/g, "\n").trimEnd();

const LEGAL_FILES = {
  privacyPl: "src/content/legal/privacy.pl.md",
  privacyEn: "src/content/legal/privacy.en.md",
  termsPl: "src/content/legal/terms.pl.md",
  termsEn: "src/content/legal/terms.en.md",
  docsPrivacyPl: "docs/polityka_prywatnosci_care_my_pet.md",
  docsTermsPl: "docs/regulamin_care_my_pet.md",
};

const content = Object.fromEntries(
  Object.entries(LEGAL_FILES).map(([key, filePath]) => [
    key,
    normalizeNewlines(readFileSync(filePath, "utf8")),
  ]),
);

function extractVersion(markdown, filePath) {
  const match = markdown.match(/^(?:Wersja|Version):\s*([0-9]+\.[0-9]+)\s*$/m);
  assert.ok(match, `Missing version header in ${filePath}`);
  return match[1];
}

function extractEmails(text) {
  return [...new Set(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])];
}

test("docs legal copies stay byte-for-byte in sync with src/content/legal Polish sources", () => {
  assert.equal(
    content.docsPrivacyPl,
    content.privacyPl,
    "docs/polityka_prywatnosci_care_my_pet.md drifted from src/content/legal/privacy.pl.md",
  );
  assert.equal(
    content.docsTermsPl,
    content.termsPl,
    "docs/regulamin_care_my_pet.md drifted from src/content/legal/terms.pl.md",
  );
});

test("legal documents contain no obsolete domains, defunct EU ODR links, localhost URLs, or draft cite tags", () => {
  const forbidden = [
    { label: "Vercel staging domain", pattern: /vercel\.app|care-my-pet-flax/i },
    { label: "localhost address", pattern: /\blocalhost\b|127\.0\.0\.1/i },
    { label: "defunct EU ODR link", pattern: /consumers\/odr/i },
    {
      label: "defunct EU ODR reference",
      pattern: /(?<![\p{L}])ODR(?![\p{L}])/u,
    },
    { label: "draft citation marker", pattern: /\[cite:/i },
  ];

  for (const key of ["privacyPl", "privacyEn", "termsPl", "termsEn"]) {
    for (const rule of forbidden) {
      assert.doesNotMatch(
        content[key],
        rule.pattern,
        `${LEGAL_FILES[key]} contains forbidden ${rule.label}`,
      );
    }
    assert.ok(
      content[key].includes("[caremypet.pl](https://caremypet.pl)"),
      `${LEGAL_FILES[key]} must reference production domain https://caremypet.pl`,
    );
  }
});

test("PL and EN legal documents match versions, keep the #cookies section 8 anchor, and share one contact email with auth UI", () => {
  assert.equal(
    extractVersion(content.privacyPl, LEGAL_FILES.privacyPl),
    extractVersion(content.privacyEn, LEGAL_FILES.privacyEn),
    "Privacy Policy PL and EN versions must match",
  );
  assert.equal(
    extractVersion(content.termsPl, LEGAL_FILES.termsPl),
    extractVersion(content.termsEn, LEGAL_FILES.termsEn),
    "Terms PL and EN versions must match",
  );

  // LegalDocument attaches id="cookies" strictly to an h2 starting with "8. "
  assert.match(content.privacyPl, /^## 8\. Pliki cookies/m);
  assert.match(content.privacyEn, /^## 8\. Cookies/m);

  const authFormSource = readFileSync("src/features/auth/auth-form.tsx", "utf8");
  const authMailtoMatch = authFormSource.match(/href="mailto:([^"?]+)/);
  assert.ok(authMailtoMatch, "Expected pilot contact mailto link in auth-form.tsx");
  const expectedEmail = authMailtoMatch[1];

  for (const key of ["privacyPl", "privacyEn", "termsPl", "termsEn"]) {
    const emails = extractEmails(content[key]);
    assert.deepEqual(
      emails,
      [expectedEmail],
      `${LEGAL_FILES[key]} contact email(s) ${JSON.stringify(emails)} must match auth-form.tsx (${expectedEmail})`,
    );
  }
});
