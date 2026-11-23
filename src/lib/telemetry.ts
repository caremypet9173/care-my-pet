"use client";

import {
  normalizeRouteTemplate,
  sanitizeTelemetryMeta,
  scrubTelemetryString,
  type TelemetryDeviceClass,
  type TelemetryEventPayload,
  type TelemetryEventType,
} from "./telemetry-shared";

const ENDPOINT = "/api/telemetry";
const FLUSH_INTERVAL_MS = 4000;
const MAX_BATCH_SIZE = 10;
const MAX_QUEUE_SIZE = 20;
const MAX_BREADCRUMBS = 12;
const MAX_RECENT_ERRORS = 5;

export interface TelemetryBreadcrumb {
  at: string;
  type: TelemetryEventType;
  name: string;
  route: string;
}

export interface TelemetryRecentError {
  at: string;
  source: string;
  route: string;
  error_name: string;
  msg: string;
}

const queue: TelemetryEventPayload[] = [];
const recentBreadcrumbs: TelemetryBreadcrumb[] = [];
const recentErrors: TelemetryRecentError[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let errorCountThisPage = 0;
const MAX_ERRORS_PER_PAGE = 5;

export function detectDeviceClass(): TelemetryDeviceClass {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 768) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

export function detectIsPwa(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true
    );
  } catch {
    return false;
  }
}

export function getTelemetryDiagnosticsSnapshot(): {
  breadcrumbs: TelemetryBreadcrumb[];
  recentErrors: TelemetryRecentError[];
} {
  return {
    breadcrumbs: recentBreadcrumbs.slice(),
    recentErrors: recentErrors.slice(),
  };
}

export function flushTelemetry(useBeacon = false): void {
  if (typeof window === "undefined" || queue.length === 0) return;

  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const batch = queue.splice(0, MAX_QUEUE_SIZE);
  const body = JSON.stringify({ events: batch });

  try {
    if (useBeacon && typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) {
        return;
      }
    }

    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {
      // Telemetry is strictly best-effort and never interrupts UX.
    });
  } catch {
    // Ignore transport failures.
  }
}

function scheduleFlush(): void {
  if (queue.length >= MAX_BATCH_SIZE) {
    flushTelemetry(false);
    return;
  }
  if (flushTimer === null) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushTelemetry(false);
    }, FLUSH_INTERVAL_MS);
  }
}

export function trackEvent(params: {
  type: TelemetryEventType;
  name: string;
  meta?: Record<string, unknown>;
  pathname?: string;
}): void {
  if (typeof window === "undefined") return;

  try {
    const rawPath = params.pathname ?? window.location.pathname;
    const { routeTemplate, locale } = normalizeRouteTemplate(rawPath);
    const cleanName = params.name.trim().toLowerCase().slice(0, 80);
    if (!cleanName) return;

    if (queue.length >= MAX_QUEUE_SIZE) {
      queue.shift();
    }

    const meta = sanitizeTelemetryMeta(params.meta);

    if (recentBreadcrumbs.length >= MAX_BREADCRUMBS) {
      recentBreadcrumbs.shift();
    }
    recentBreadcrumbs.push({
      at: new Date().toISOString(),
      type: params.type,
      name: cleanName,
      route: routeTemplate,
    });

    if (params.type === "client_error") {
      if (recentErrors.length >= MAX_RECENT_ERRORS) {
        recentErrors.shift();
      }
      recentErrors.push({
        at: new Date().toISOString(),
        source: cleanName,
        route: routeTemplate,
        error_name: typeof meta.error_name === "string" ? meta.error_name : "Error",
        msg: typeof meta.msg === "string" ? meta.msg : "",
      });
    }

    queue.push({
      event_type: params.type,
      route_template: routeTemplate,
      name: cleanName,
      locale,
      device_class: detectDeviceClass(),
      is_pwa: detectIsPwa(),
      meta,
    });

    scheduleFlush();
  } catch {
    // Never throw from telemetry helpers.
  }
}

export function trackPageView(pathname?: string): void {
  if (typeof window === "undefined") return;
  const rawPath = pathname ?? window.location.pathname;
  const { routeName } = normalizeRouteTemplate(rawPath);
  trackEvent({
    type: "page_view",
    name: routeName,
    pathname: rawPath,
  });
}

export function trackTabView(
  tabName: string,
  meta?: Record<string, unknown>,
): void {
  trackEvent({
    type: "tab_view",
    name: tabName,
    meta,
  });
}

export function trackAction(
  actionName: string,
  meta?: Record<string, unknown>,
): void {
  trackEvent({
    type: "action",
    name: actionName,
    meta,
  });
}

export function trackFlow(
  flowName: string,
  meta?: Record<string, unknown>,
): void {
  trackEvent({
    type: "flow",
    name: flowName,
    meta,
  });
}

export function trackClientError(
  source: "error_boundary" | "window_error" | "unhandled_rejection",
  errorLike: unknown,
  extraMeta?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  if (errorCountThisPage >= MAX_ERRORS_PER_PAGE) return;

  const rawMessage =
    errorLike instanceof Error
      ? errorLike.message
      : typeof errorLike === "string"
        ? errorLike
        : "";

  // Ignore benign Chromium ResizeObserver warnings
  if (/ResizeObserver loop/i.test(rawMessage)) {
    return;
  }

  errorCountThisPage += 1;

  const errorName =
    errorLike instanceof Error && errorLike.name
      ? scrubTelemetryString(errorLike.name, 40)
      : "Error";
  const digest =
    errorLike &&
    typeof errorLike === "object" &&
    "digest" in errorLike &&
    typeof (errorLike as { digest?: unknown }).digest === "string"
      ? scrubTelemetryString((errorLike as { digest: string }).digest, 40)
      : undefined;

  trackEvent({
    type: "client_error",
    name: source,
    meta: {
      error_name: errorName,
      ...(digest ? { digest } : {}),
      ...(rawMessage ? { msg: scrubTelemetryString(rawMessage, 64) } : {}),
      ...extraMeta,
    },
  });

  // Flush errors promptly so diagnostics aren't lost on crash/reload
  flushTelemetry(true);
}
