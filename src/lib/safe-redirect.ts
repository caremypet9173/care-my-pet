/**
 * Validates that a redirect target is a strictly relative, same-origin path.
 * Blocks protocol-relative URLs ("//evil.com"), backslash bypasses ("/\evil.com"),
 * embedded schemes ("https://", "javascript:"), and control characters ("\r", "\n").
 */
export function sanitizeRelativePath(
  raw: string | null | undefined,
  fallback = "/app",
): string {
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed || !trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (/[\r\n\t\\]/.test(trimmed)) return fallback;
  // Strip any leading locale prefix (/pl/ or /en/) so localized routers don't double-prefix
  const withoutLocale = trimmed.replace(/^\/(?:pl|en)(?=\/|$)/, "") || "/";
  if (withoutLocale.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(withoutLocale.slice(1))) {
    return fallback;
  }
  return withoutLocale;
}
