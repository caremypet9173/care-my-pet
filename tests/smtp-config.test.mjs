import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SMTP_HOST,
  DEFAULT_SMTP_PORT,
  DEFAULT_SMTP_USER,
  extractEmailAddress,
  formatSmtpFrom,
  parseSmtpPort,
  parseSmtpSecure,
  resolveAdminNotifyEmail,
  resolveSmtpConfig,
} from "../supabase/functions/_shared/smtp-config.mjs";

function makeEnv(values) {
  return (key) => values[key];
}

test("resolveSmtpConfig keeps backward-compatible Gmail fallback when only SMTP_PASS is set", () => {
  const result = resolveSmtpConfig(makeEnv({ SMTP_PASS: "app-secret" }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.config, {
    host: DEFAULT_SMTP_HOST,
    port: DEFAULT_SMTP_PORT,
    secure: true,
    user: DEFAULT_SMTP_USER,
    pass: "app-secret",
    from: `"Care My Pet" <${DEFAULT_SMTP_USER}>`,
    fromEmail: DEFAULT_SMTP_USER,
  });
});

test("resolveSmtpConfig supports custom domain SMTP where user is an email (e.g. nazwa.pl)", () => {
  const result = resolveSmtpConfig(
    makeEnv({
      SMTP_HOST: "poczta.nazwa.pl",
      SMTP_PORT: "465",
      SMTP_USER: "powiadomienia@caremypet.pl",
      SMTP_PASS: "mailbox-pass",
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.config, {
    host: "poczta.nazwa.pl",
    port: 465,
    secure: true,
    user: "powiadomienia@caremypet.pl",
    pass: "mailbox-pass",
    from: '"Care My Pet" <powiadomienia@caremypet.pl>',
    fromEmail: "powiadomienia@caremypet.pl",
  });
});

test("resolveSmtpConfig supports Resend/AWS SES where SMTP_USER is not an email and port 587 defaults to STARTTLS", () => {
  const resend = resolveSmtpConfig(
    makeEnv({
      SMTP_HOST: "smtp.resend.com",
      SMTP_PORT: "465",
      SMTP_USER: "resend",
      SMTP_PASS: "re_test_key",
      SMTP_FROM: "noreply@caremypet.pl",
    }),
  );
  assert.equal(resend.ok, true);
  if (!resend.ok) return;
  assert.equal(resend.config.secure, true);
  assert.equal(resend.config.user, "resend");
  assert.equal(resend.config.from, '"Care My Pet" <noreply@caremypet.pl>');
  assert.equal(resend.config.fromEmail, "noreply@caremypet.pl");

  const ses = resolveSmtpConfig(
    makeEnv({
      SMTP_HOST: "email-smtp.eu-central-1.amazonaws.com",
      SMTP_PORT: "587",
      SMTP_USER: "AKIAEXAMPLEKEY",
      SMTP_PASS: "ses-pass",
      SMTP_FROM: '"Care My Pet Team" <noreply@caremypet.pl>',
    }),
  );
  assert.equal(ses.ok, true);
  if (!ses.ok) return;
  assert.equal(ses.config.port, 587);
  assert.equal(ses.config.secure, false);
  assert.equal(ses.config.from, '"Care My Pet Team" <noreply@caremypet.pl>');
  assert.equal(ses.config.fromEmail, "noreply@caremypet.pl");
});

test("resolveSmtpConfig respects explicit SMTP_SECURE override and custom SMTP_SENDER_NAME", () => {
  const result = resolveSmtpConfig(
    makeEnv({
      SMTP_HOST: "smtp.example.pl",
      SMTP_PORT: "2465",
      SMTP_SECURE: "true",
      SMTP_USER: "mailer",
      SMTP_PASS: "secret",
      SMTP_FROM: "noreply@example.pl",
      SMTP_SENDER_NAME: "Care My Pet Pilot",
    }),
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.config.port, 2465);
  assert.equal(result.config.secure, true);
  assert.equal(result.config.from, '"Care My Pet Pilot" <noreply@example.pl>');
});

test("resolveSmtpConfig rejects missing credentials, mismatched custom host without user, and non-email user without SMTP_FROM", () => {
  const noPass = resolveSmtpConfig(makeEnv({}));
  assert.equal(noPass.ok, false);

  const customHostNoUser = resolveSmtpConfig(
    makeEnv({ SMTP_HOST: "smtp.resend.com", SMTP_PASS: "secret" }),
  );
  assert.equal(customHostNoUser.ok, false);
  if (!customHostNoUser.ok) {
    assert.match(customHostNoUser.reason, /SMTP_USER/);
  }

  const nonEmailUserNoFrom = resolveSmtpConfig(
    makeEnv({
      SMTP_HOST: "smtp.resend.com",
      SMTP_USER: "resend",
      SMTP_PASS: "secret",
    }),
  );
  assert.equal(nonEmailUserNoFrom.ok, false);
  if (!nonEmailUserNoFrom.ok) {
    assert.match(nonEmailUserNoFrom.reason, /SMTP_FROM/);
  }
});

test("resolveSmtpConfig rejects invalid ports, secure flags, and CR/LF header injection", () => {
  assert.throws(() => parseSmtpPort("abc"));
  assert.throws(() => parseSmtpPort("0"));
  assert.throws(() => parseSmtpPort("70000"));
  assert.equal(parseSmtpPort(undefined), 465);
  assert.equal(parseSmtpPort("587"), 587);

  assert.equal(parseSmtpSecure(undefined, 465), true);
  assert.equal(parseSmtpSecure(undefined, 587), false);
  assert.equal(parseSmtpSecure("false", 465), false);
  assert.equal(parseSmtpSecure("true", 587), true);
  assert.throws(() => parseSmtpSecure("maybe", 587));

  const badHost = resolveSmtpConfig(
    makeEnv({ SMTP_HOST: "smtp.example.pl\r\nBcc:evil@x.pl", SMTP_PASS: "x", SMTP_USER: "a@b.pl" }),
  );
  assert.equal(badHost.ok, false);

  const badFrom = resolveSmtpConfig(
    makeEnv({
      SMTP_HOST: "smtp.resend.com",
      SMTP_USER: "resend",
      SMTP_PASS: "x",
      SMTP_FROM: "noreply@caremypet.pl\r\nBcc: evil@example.com",
    }),
  );
  assert.equal(badFrom.ok, false);

  const sanitizedName = formatSmtpFrom(
    "noreply@caremypet.pl",
    'Care "My"\r\nPet',
    null,
  );
  assert.equal(sanitizedName.from, '"Care My Pet" <noreply@caremypet.pl>');
  assert.equal(extractEmailAddress("not-an-email"), null);
});

test("resolveAdminNotifyEmail prioritizes WAITLIST_NOTIFY_EMAIL and ignores non-email SMTP_USER", () => {
  assert.equal(
    resolveAdminNotifyEmail(
      makeEnv({
        WAITLIST_NOTIFY_EMAIL: "wojtek@caremypet.pl",
        SMTP_FROM: "noreply@caremypet.pl",
        SMTP_USER: "resend",
      }),
    ),
    "wojtek@caremypet.pl",
  );

  assert.equal(
    resolveAdminNotifyEmail(
      makeEnv({
        SMTP_FROM: '"Care My Pet" <noreply@caremypet.pl>',
        SMTP_USER: "resend",
      }),
    ),
    "noreply@caremypet.pl",
  );

  assert.equal(
    resolveAdminNotifyEmail(makeEnv({ SMTP_USER: "resend" })),
    DEFAULT_SMTP_USER,
  );
});
