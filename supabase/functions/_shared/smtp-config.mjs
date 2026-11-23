export const DEFAULT_SMTP_HOST = "smtp.gmail.com";
export const DEFAULT_SMTP_PORT = 465;
export const DEFAULT_SMTP_USER = "caremypet9173@gmail.com";
export const DEFAULT_SMTP_SENDER_NAME = "Care My Pet";

const SIMPLE_EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const HEADER_CONTROL_CHARS = /[\r\n]/;

/**
 * Strips CR/LF characters and outer whitespace from header-safe strings.
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizeHeaderValue(raw) {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Extracts a bare email address from either `user@example.com` or `"Name" <user@example.com>`.
 * Returns null if the input does not contain a valid email address or contains CR/LF characters.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function extractEmailAddress(raw) {
  if (typeof raw !== "string") return null;
  if (HEADER_CONTROL_CHARS.test(raw)) return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const angleMatch = trimmed.match(/<([^<>]+)>/);
  const candidate = (angleMatch ? angleMatch[1] : trimmed).trim();

  if (!SIMPLE_EMAIL_PATTERN.test(candidate)) {
    return null;
  }
  return candidate;
}

/**
 * Parses and validates SMTP_PORT. Empty values fall back to DEFAULT_SMTP_PORT (465).
 * @param {string | undefined} raw
 * @param {number} [fallback]
 * @returns {number}
 */
export function parseSmtpPort(raw, fallback = DEFAULT_SMTP_PORT) {
  if (raw === undefined || raw === null) return fallback;
  const trimmed = String(raw).trim();
  if (!trimmed) return fallback;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid SMTP_PORT value: "${trimmed}"`);
  }
  const port = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`SMTP_PORT out of range (1-65535): "${trimmed}"`);
  }
  return port;
}

/**
 * Parses SMTP_SECURE. When omitted, defaults to `port === 465` (SMTPS on 465, STARTTLS on 587/etc.).
 * @param {string | undefined} raw
 * @param {number} port
 * @returns {boolean}
 */
export function parseSmtpSecure(raw, port) {
  if (raw === undefined || raw === null) return port === 465;
  const trimmed = String(raw).trim().toLowerCase();
  if (!trimmed) return port === 465;
  if (trimmed === "true" || trimmed === "1" || trimmed === "yes") return true;
  if (trimmed === "false" || trimmed === "0" || trimmed === "no") return false;
  throw new Error(`Invalid SMTP_SECURE value: "${raw}"`);
}

/**
 * Formats the RFC 5322 `From` header and returns both the full header and extracted email.
 * @param {string | undefined} rawFrom
 * @param {string | undefined} rawSenderName
 * @param {string | null} fallbackEmail
 * @returns {{ from: string, fromEmail: string }}
 */
export function formatSmtpFrom(rawFrom, rawSenderName, fallbackEmail) {
  const senderName = (
    sanitizeHeaderValue(rawSenderName) || DEFAULT_SMTP_SENDER_NAME
  ).replace(/["\\]/g, "");

  if (typeof rawFrom === "string" && rawFrom.trim()) {
    if (HEADER_CONTROL_CHARS.test(rawFrom)) {
      throw new Error("Invalid SMTP_FROM value: control characters are not allowed");
    }
    const trimmedFrom = rawFrom.trim();
    const extracted = extractEmailAddress(trimmedFrom);
    if (!extracted) {
      throw new Error(`Invalid SMTP_FROM email address: "${trimmedFrom}"`);
    }
    if (trimmedFrom.includes("<") && trimmedFrom.includes(">")) {
      return { from: trimmedFrom, fromEmail: extracted };
    }
    return {
      from: senderName ? `"${senderName}" <${extracted}>` : extracted,
      fromEmail: extracted,
    };
  }

  if (fallbackEmail) {
    const extractedFallback = extractEmailAddress(fallbackEmail);
    if (extractedFallback) {
      return {
        from: senderName
          ? `"${senderName}" <${extractedFallback}>`
          : extractedFallback,
        fromEmail: extractedFallback,
      };
    }
  }

  throw new Error(
    "SMTP_FROM is required when SMTP_USER is not an email address",
  );
}

/**
 * Resolves and validates SMTP configuration from environment variables.
 * Keeps backward compatibility with the pilot Gmail setup when only SMTP_PASS
 * (and optionally SMTP_USER) is provided.
 *
 * @param {(key: string) => string | undefined} getEnv
 * @returns {
 *   | {
 *       ok: true;
 *       config: {
 *         host: string;
 *         port: number;
 *         secure: boolean;
 *         user: string;
 *         pass: string;
 *         from: string;
 *         fromEmail: string;
 *       };
 *     }
 *   | { ok: false; reason: string }
 * }
 */
export function resolveSmtpConfig(getEnv) {
  const rawPass = getEnv("SMTP_PASS");
  const pass = typeof rawPass === "string" ? rawPass.trim() : "";
  if (!pass) {
    return { ok: false, reason: "Missing SMTP_PASS secret" };
  }

  const rawHost = getEnv("SMTP_HOST");
  if (typeof rawHost === "string" && HEADER_CONTROL_CHARS.test(rawHost)) {
    return {
      ok: false,
      reason: "Invalid SMTP_HOST value: control characters are not allowed",
    };
  }
  const host = (typeof rawHost === "string" ? rawHost.trim() : "") || DEFAULT_SMTP_HOST;
  if (/\s/.test(host)) {
    return { ok: false, reason: `Invalid SMTP_HOST value: "${host}"` };
  }

  let port;
  let secure;
  try {
    port = parseSmtpPort(getEnv("SMTP_PORT"));
    secure = parseSmtpSecure(getEnv("SMTP_SECURE"), port);
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Invalid SMTP port/secure config",
    };
  }

  const rawUser = getEnv("SMTP_USER");
  if (typeof rawUser === "string" && HEADER_CONTROL_CHARS.test(rawUser)) {
    return {
      ok: false,
      reason: "Invalid SMTP_USER value: control characters are not allowed",
    };
  }
  const explicitUser = typeof rawUser === "string" ? rawUser.trim() : "";
  const user =
    explicitUser || (host === DEFAULT_SMTP_HOST ? DEFAULT_SMTP_USER : "");

  if (!user) {
    return {
      ok: false,
      reason: "Missing SMTP_USER secret for custom SMTP_HOST",
    };
  }

  let from;
  let fromEmail;
  try {
    const formatted = formatSmtpFrom(
      getEnv("SMTP_FROM"),
      getEnv("SMTP_SENDER_NAME"),
      extractEmailAddress(user),
    );
    from = formatted.from;
    fromEmail = formatted.fromEmail;
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Invalid SMTP_FROM config",
    };
  }

  return {
    ok: true,
    config: {
      host,
      port,
      secure,
      user,
      pass,
      from,
      fromEmail,
    },
  };
}

/**
 * Resolves the default admin notification recipient (e.g. waitlist digest / VAPID contact).
 * Avoids using non-email SMTP usernames such as "resend" or AWS IAM keys as an email address.
 * @param {(key: string) => string | undefined} getEnv
 * @returns {string}
 */
export function resolveAdminNotifyEmail(getEnv) {
  return (
    extractEmailAddress(getEnv("WAITLIST_NOTIFY_EMAIL")) ||
    extractEmailAddress(getEnv("SMTP_FROM")) ||
    extractEmailAddress(getEnv("SMTP_USER")) ||
    DEFAULT_SMTP_USER
  );
}
