export const MAX_NOTIFY_EMAILS: number;
export const MAX_NOTIFY_EMAIL_LENGTH: number;

export function isValidNotifyEmail(email: string): boolean;
export function splitNotifyEmailDraft(draft: string): string[];
export function parseNotifyEmailsInput(
  raw: unknown,
):
  | { ok: true; emails: string[] }
  | { ok: false; error: "invalid_email" | "too_many_emails"; invalidValue?: string };
