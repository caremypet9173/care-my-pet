const DEFAULT_PRODUCTION_ORIGIN = "https://caremypet.pl";

const BUILTIN_ALLOWED_ORIGINS = [
  "https://caremypet.pl",
  "https://www.caremypet.pl",
  "https://care-my-pet-flax.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function normalizeOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Resolves a safe application origin for links embedded in outbound emails.
 * Only accepts the incoming Origin header if it matches an explicit allowlist
 * (configured via SITE_URL, APP_URL, ALLOWED_ORIGINS, or built-in Care My Pet hosts),
 * preventing Host/Origin phishing injection into invite, recovery, and archive emails.
 */
export function resolveSafeOrigin(req: Request): string {
  const configuredFallback =
    normalizeOrigin(Deno.env.get("SITE_URL")) ??
    normalizeOrigin(Deno.env.get("APP_URL")) ??
    DEFAULT_PRODUCTION_ORIGIN;

  const allowed = new Set<string>(BUILTIN_ALLOWED_ORIGINS);
  allowed.add(configuredFallback);

  const siteUrl = normalizeOrigin(Deno.env.get("SITE_URL"));
  if (siteUrl) allowed.add(siteUrl);

  const appUrl = normalizeOrigin(Deno.env.get("APP_URL"));
  if (appUrl) allowed.add(appUrl);

  const extraOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry));
  for (const extra of extraOrigins) {
    allowed.add(extra);
  }

  const reqOrigin = normalizeOrigin(req.headers.get("origin"));
  if (reqOrigin && allowed.has(reqOrigin)) {
    return reqOrigin;
  }

  return configuredFallback;
}
