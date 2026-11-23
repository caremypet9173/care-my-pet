// Shared pure validation for schedule notification emails (Deno + Node + Next.js).

export const MAX_NOTIFY_EMAILS = 5;
export const MAX_NOTIFY_EMAIL_LENGTH = 160;

const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

export function isValidNotifyEmail(email) {
  if (typeof email !== "string") return false;
  const clean = email.trim().toLowerCase();
  if (!clean || clean.length > MAX_NOTIFY_EMAIL_LENGTH) return false;
  if (clean.includes("..")) return false;
  return EMAIL_RE.test(clean);
}

export function splitNotifyEmailDraft(draft) {
  if (typeof draft !== "string") return [];
  return draft
    .split(/[\s,;]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function parseNotifyEmailsInput(raw) {
  if (raw == null) {
    return { ok: true, emails: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "invalid_email" };
  }

  const emails = [];
  const seen = new Set();

  for (const entry of raw) {
    if (typeof entry !== "string") {
      return { ok: false, error: "invalid_email" };
    }
    const clean = entry.trim().toLowerCase();
    if (!clean) continue;
    if (!isValidNotifyEmail(clean)) {
      return { ok: false, error: "invalid_email", invalidValue: clean };
    }
    if (!seen.has(clean)) {
      if (emails.length >= MAX_NOTIFY_EMAILS) {
        return { ok: false, error: "too_many_emails" };
      }
      seen.add(clean);
      emails.push(clean);
    }
  }

  return { ok: true, emails };
}
