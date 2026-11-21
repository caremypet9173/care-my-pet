export const FEEDBACK_CATEGORIES = ["bug", "suggestion", "ux"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = [
  "new",
  "triaged",
  "planned",
  "resolved",
  "wontfix",
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const ALLOWED_SCREENSHOT_MIMES = [
  "image/webp",
  "image/jpeg",
  "image/png",
] as const;
export type ScreenshotMime = (typeof ALLOWED_SCREENSHOT_MIMES)[number];

export const MAX_FEEDBACK_SCREENSHOT_BYTES = 2 * 1024 * 1024; // 2 MB

const CATEGORY_SET = new Set<string>(FEEDBACK_CATEGORIES);
const DEVICE_SET = new Set<string>(["mobile", "tablet", "desktop"]);
const MIME_SET = new Set<string>(ALLOWED_SCREENSHOT_MIMES);
const TAB_RE = /^[a-z0-9_-]{1,40}$/i;
const VIEWPORT_RE = /^\d{2,5}x\d{2,5}$/;
const UUID_SEGMENT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const UUID_INLINE_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const URL_INLINE_RE = /https?:\/\/\S+/gi;
const TOKEN_PARENT_SEGMENTS = new Set(["shared", "archive", "invite"]);
const SCREENSHOT_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webp|jpg|png)$/i;

function scrubString(input: string, maxLen = 120): string {
  return input
    .replace(EMAIL_RE, "[email]")
    .replace(UUID_INLINE_RE, "[id]")
    .replace(URL_INLINE_RE, "[url]")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function normalizeRoute(rawPath: string): {
  routeTemplate: string;
  locale: "pl" | "en";
} {
  const withoutQuery = rawPath.split("?")[0]?.split("#")[0] ?? "/";
  const rawSegments = withoutQuery
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  let locale: "pl" | "en" = "pl";
  let segments = rawSegments;
  if (rawSegments[0] === "pl" || rawSegments[0] === "en") {
    locale = rawSegments[0];
    segments = rawSegments.slice(1);
  }

  const normalized: string[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i] ?? "";
    const prev = i > 0 ? segments[i - 1] : "";
    const prev2 = i > 1 ? segments[i - 2] : "";
    if (UUID_SEGMENT_RE.test(seg)) {
      normalized.push("[id]");
    } else if (
      TOKEN_PARENT_SEGMENTS.has(prev) ||
      (prev2 === "recover" && prev === "confirm")
    ) {
      normalized.push("[token]");
    } else if (/^[a-z0-9_-]{1,40}$/i.test(seg)) {
      normalized.push(seg.toLowerCase());
    } else {
      normalized.push("[param]");
    }
  }

  return {
    routeTemplate:
      normalized.length === 0 ? "/" : `/${normalized.join("/")}`.slice(0, 160),
    locale,
  };
}

export interface SanitizedBreadcrumb {
  at: string;
  type: string;
  name: string;
  route: string;
}

export interface SanitizedClientError {
  at: string;
  source: string;
  route: string;
  error_name: string;
  msg: string;
}

export interface SanitizedFeedbackPayload {
  category: FeedbackCategory;
  message: string;
  route_template: string;
  active_tab: string;
  locale: "pl" | "en";
  device_class: "mobile" | "tablet" | "desktop";
  is_pwa: boolean;
  viewport: string;
  user_agent: string;
  breadcrumbs: SanitizedBreadcrumb[];
  recent_errors: SanitizedClientError[];
  screenshot_path: string | null;
  screenshot_mime: ScreenshotMime | null;
}

export interface FeedbackListItem {
  id: string;
  category: FeedbackCategory;
  message: string;
  route_template: string;
  active_tab: string;
  status: FeedbackStatus;
  has_screenshot: boolean;
  created_at: string;
}

function sanitizeIso(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(trimmed)) {
    return "";
  }
  return trimmed.slice(0, 32);
}

function sanitizeBreadcrumbs(raw: unknown): SanitizedBreadcrumb[] {
  if (!Array.isArray(raw)) return [];
  const out: SanitizedBreadcrumb[] = [];
  for (const item of raw.slice(-12)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const type = scrubString(String(rec.type ?? ""), 24).toLowerCase();
    const name = scrubString(String(rec.name ?? ""), 80).toLowerCase();
    const route = normalizeRoute(String(rec.route ?? "/")).routeTemplate;
    if (!type || !name) continue;
    out.push({
      at: sanitizeIso(rec.at),
      type,
      name,
      route,
    });
  }
  return out;
}

function sanitizeRecentErrors(raw: unknown): SanitizedClientError[] {
  if (!Array.isArray(raw)) return [];
  const out: SanitizedClientError[] = [];
  for (const item of raw.slice(-5)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const source = scrubString(String(rec.source ?? ""), 40).toLowerCase();
    const errorName = scrubString(String(rec.error_name ?? "Error"), 40);
    const msg = scrubString(String(rec.msg ?? ""), 120);
    const route = normalizeRoute(String(rec.route ?? "/")).routeTemplate;
    if (!source) continue;
    out.push({
      at: sanitizeIso(rec.at),
      source,
      route,
      error_name: errorName || "Error",
      msg,
    });
  }
  return out;
}

export function sanitizeFeedbackPayload(
  input: unknown,
  fallbackUserAgent = "",
): SanitizedFeedbackPayload | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;

  const category = typeof raw.category === "string" ? raw.category.trim() : "";
  if (!CATEGORY_SET.has(category)) return null;

  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  if (message.length < 3 || message.length > 4000) return null;

  const rawPathname =
    typeof raw.pathname === "string" && raw.pathname.trim()
      ? raw.pathname.trim()
      : typeof raw.route_template === "string"
        ? raw.route_template.trim()
        : "/";
  const normalizedRoute = normalizeRoute(rawPathname);

  const locale: "pl" | "en" =
    raw.locale === "en"
      ? "en"
      : raw.locale === "pl"
        ? "pl"
        : normalizedRoute.locale;

  const rawTab = typeof raw.active_tab === "string" ? raw.active_tab.trim() : "";
  const active_tab = TAB_RE.test(rawTab) ? rawTab.toLowerCase() : "";

  const rawDevice =
    typeof raw.device_class === "string" ? raw.device_class.trim() : "desktop";
  const device_class: "mobile" | "tablet" | "desktop" = DEVICE_SET.has(rawDevice)
    ? (rawDevice as "mobile" | "tablet" | "desktop")
    : "desktop";

  const rawViewport =
    typeof raw.viewport === "string" ? raw.viewport.trim() : "";
  const viewport = VIEWPORT_RE.test(rawViewport) ? rawViewport : "";

  const rawUa =
    typeof raw.user_agent === "string" && raw.user_agent.trim()
      ? raw.user_agent
      : fallbackUserAgent;
  const user_agent = rawUa.replace(/[\r\n\t]+/g, " ").trim().slice(0, 300);

  let screenshot_path: string | null = null;
  let screenshot_mime: ScreenshotMime | null = null;
  if (typeof raw.screenshot_path === "string" && raw.screenshot_path.trim()) {
    const candidatePath = raw.screenshot_path.trim();
    const candidateMime =
      typeof raw.screenshot_mime === "string" ? raw.screenshot_mime.trim() : "";
    if (!SCREENSHOT_PATH_RE.test(candidatePath) || !MIME_SET.has(candidateMime)) {
      return null;
    }
    screenshot_path = candidatePath;
    screenshot_mime = candidateMime as ScreenshotMime;
  }

  return {
    category: category as FeedbackCategory,
    message,
    route_template: normalizedRoute.routeTemplate,
    active_tab,
    locale,
    device_class,
    is_pwa: raw.is_pwa === true,
    viewport,
    user_agent,
    breadcrumbs: sanitizeBreadcrumbs(raw.breadcrumbs),
    recent_errors: sanitizeRecentErrors(raw.recent_errors),
    screenshot_path,
    screenshot_mime,
  };
}
