export const TELEMETRY_EVENT_TYPES = [
  "page_view",
  "tab_view",
  "action",
  "flow",
  "client_error",
] as const;

export type TelemetryEventType = (typeof TELEMETRY_EVENT_TYPES)[number];

export const TELEMETRY_DEVICE_CLASSES = [
  "mobile",
  "tablet",
  "desktop",
] as const;

export type TelemetryDeviceClass = (typeof TELEMETRY_DEVICE_CLASSES)[number];

export type TelemetryLocale = "pl" | "en";

export type TelemetryMetaValue = string | number | boolean;
export type TelemetryMeta = Record<string, TelemetryMetaValue>;

export interface TelemetryEventPayload {
  event_type: TelemetryEventType;
  route_template: string;
  name: string;
  locale: TelemetryLocale;
  device_class: TelemetryDeviceClass;
  is_pwa: boolean;
  meta: TelemetryMeta;
}

const EVENT_TYPE_SET = new Set<string>(TELEMETRY_EVENT_TYPES);
const DEVICE_CLASS_SET = new Set<string>(TELEMETRY_DEVICE_CLASSES);

const UUID_SEGMENT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_NAME_RE = /^[a-z0-9_.:/-]{1,80}$/;
const SAFE_META_KEY_RE = /^[a-z0-9_]{1,32}$/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const UUID_INLINE_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const URL_INLINE_RE = /https?:\/\/\S+/gi;

const TOKEN_PARENT_SEGMENTS = new Set(["shared", "archive", "invite"]);

export function normalizeRouteTemplate(rawPath: string): {
  routeTemplate: string;
  routeName: string;
  locale: TelemetryLocale;
} {
  const withoutQuery = rawPath.split("?")[0]?.split("#")[0] ?? "/";
  const rawSegments = withoutQuery
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  let locale: TelemetryLocale = "pl";
  let segments = rawSegments;
  if (rawSegments[0] === "pl" || rawSegments[0] === "en") {
    locale = rawSegments[0];
    segments = rawSegments.slice(1);
  }

  const normalized: string[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const prev = normalized[i - 1];
    const prevPrev = normalized[i - 2];

    if (UUID_SEGMENT_RE.test(seg)) {
      normalized.push("[id]");
    } else if (
      (prev && TOKEN_PARENT_SEGMENTS.has(prev)) ||
      (prevPrev === "recover" && prev === "confirm")
    ) {
      normalized.push("[token]");
    } else if (/^\d+$/.test(seg)) {
      normalized.push("[n]");
    } else {
      normalized.push(seg.toLowerCase().slice(0, 40));
    }
  }

  const routeTemplate =
    normalized.length > 0 ? `/${normalized.join("/")}`.slice(0, 120) : "/";

  const routeName = mapRouteTemplateToName(routeTemplate);
  return { routeTemplate, routeName, locale };
}

function mapRouteTemplateToName(routeTemplate: string): string {
  switch (routeTemplate) {
    case "/":
      return "home";
    case "/app":
      return "dashboard";
    case "/app/household":
      return "household";
    case "/app/set-password":
      return "set_password";
    case "/app/pets/new":
      return "pet_new";
    case "/app/pets/[id]":
      return "pet_record";
    case "/app/pets/[id]/edit":
      return "pet_edit";
    case "/app/pets/[id]/results/new":
      return "result_new";
    case "/app/pets/[id]/fluid-therapy/new":
      return "fluid_new";
    case "/app/pets/[id]/fluid-therapy/[id]/edit":
      return "fluid_edit";
    case "/shared/[token]":
      return "shared_record";
    case "/archive/[token]":
      return "archive_portal";
    case "/invite/[token]":
      return "invite_accept";
    case "/recover":
    case "/recover/confirm/[token]":
      return "recovery";
    case "/login":
      return "login";
    case "/register":
      return "register";
    default:
      return routeTemplate.startsWith("/demo/") ? "demo" : "other";
  }
}

export function scrubTelemetryString(input: string, maxLen = 64): string {
  return input
    .replace(EMAIL_RE, "[email]")
    .replace(UUID_INLINE_RE, "[id]")
    .replace(URL_INLINE_RE, "[url]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function sanitizeTelemetryMeta(
  rawMeta?: Record<string, unknown> | null,
): TelemetryMeta {
  if (!rawMeta || typeof rawMeta !== "object" || Array.isArray(rawMeta)) {
    return {};
  }

  const clean: TelemetryMeta = {};
  let keysAdded = 0;

  for (const [key, value] of Object.entries(rawMeta)) {
    if (keysAdded >= 8) break;
    if (!SAFE_META_KEY_RE.test(key)) continue;

    if (typeof value === "boolean") {
      clean[key] = value;
      keysAdded += 1;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      clean[key] = Math.round(value * 1000) / 1000;
      keysAdded += 1;
    } else if (typeof value === "string") {
      const scrubbed = scrubTelemetryString(value, 64);
      if (scrubbed) {
        clean[key] = scrubbed;
        keysAdded += 1;
      }
    }
  }

  // Hard ceiling matching DB CHECK (octet_length <= 512)
  if (JSON.stringify(clean).length > 480) {
    return {};
  }

  return clean;
}

export function sanitizeTelemetryEvent(
  raw: unknown,
): TelemetryEventPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const eventType = typeof item.event_type === "string" ? item.event_type : "";
  if (!EVENT_TYPE_SET.has(eventType)) {
    return null;
  }

  const rawRoute =
    typeof item.route_template === "string" ? item.route_template : "";
  if (!rawRoute.startsWith("/")) {
    return null;
  }
  const { routeTemplate, locale: inferredLocale } =
    normalizeRouteTemplate(rawRoute);

  const rawName =
    typeof item.name === "string" ? item.name.trim().toLowerCase() : "";
  if (!SAFE_NAME_RE.test(rawName)) {
    return null;
  }

  const locale: TelemetryLocale =
    item.locale === "en"
      ? "en"
      : item.locale === "pl"
        ? "pl"
        : inferredLocale;

  const deviceClass: TelemetryDeviceClass =
    typeof item.device_class === "string" &&
    DEVICE_CLASS_SET.has(item.device_class)
      ? (item.device_class as TelemetryDeviceClass)
      : "desktop";

  const isPwa = Boolean(item.is_pwa);
  const meta = sanitizeTelemetryMeta(
    item.meta as Record<string, unknown> | undefined,
  );

  return {
    event_type: eventType as TelemetryEventType,
    route_template: routeTemplate,
    name: rawName,
    locale,
    device_class: deviceClass,
    is_pwa: isPwa,
    meta,
  };
}
