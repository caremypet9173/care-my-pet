"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  flushTelemetry,
  trackClientError,
  trackPageView,
} from "@/lib/telemetry";

/**
 * Lightweight first-party telemetry observer mounted once in PrivateLayout.
 * Tracks normalized page transitions and unexpected client runtime errors
 * without external scripts or tracking cookies.
 */
export function AppTelemetryTracker() {
  const pathname = usePathname();
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (lastTrackedPathRef.current === pathname) return;
    lastTrackedPathRef.current = pathname;
    trackPageView(pathname);
  }, [pathname]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushTelemetry(true);
      }
    }

    function handlePageHide() {
      flushTelemetry(true);
    }

    function handleWindowError(event: ErrorEvent) {
      trackClientError("window_error", event.error ?? event.message);
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      trackClientError("unhandled_rejection", event.reason);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
      flushTelemetry(true);
    };
  }, []);

  return null;
}
