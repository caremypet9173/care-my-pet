"use client";

import "@/styles/feedback.css";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useLocale } from "next-intl";
import {
  detectDeviceClass,
  detectIsPwa,
  getTelemetryDiagnosticsSnapshot,
} from "@/lib/telemetry";
import { normalizeRouteTemplate } from "@/lib/telemetry-shared";
import {
  captureViewportScreenshot,
  type CapturedScreenshot,
} from "./screenshot-capture";
import type { FeedbackContextSnapshot } from "./pilot-feedback-modal";

const PilotFeedbackModal = dynamic(
  () => import("./pilot-feedback-modal").then((m) => m.PilotFeedbackModal),
  { ssr: false },
);

export function PilotFeedbackWidget() {
  const locale = useLocale();
  const pl = locale === "pl";
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [context, setContext] = useState<FeedbackContextSnapshot | null>(null);
  const [initialScreenshot, setInitialScreenshot] =
    useState<CapturedScreenshot | null>(null);

  async function handleOpen() {
    if (preparing || open) return;
    setPreparing(true);
    try {
      const pathname = window.location.pathname;
      const search = new URLSearchParams(window.location.search);
      const selectedTabEl = document.querySelector<HTMLElement>(
        '.household-record-tabs [role="tab"][aria-selected="true"]',
      );
      const tabFromDom = selectedTabEl?.id
        ? ({
            "record-tab-0": "summary",
            "record-tab-4": "weight",
            "record-tab-1": "history",
            "record-tab-2": "results",
            "record-tab-3": "documents",
            "record-tab-5": "assistant",
          }[selectedTabEl.id] ?? "")
        : "";
      const activeTab = (tabFromDom || search.get("tab") || "").slice(0, 40);
      const { routeTemplate } = normalizeRouteTemplate(pathname);
      const diag = getTelemetryDiagnosticsSnapshot();
      const snapshot: FeedbackContextSnapshot = {
        pathname,
        routeTemplate,
        activeTab,
        deviceClass: detectDeviceClass(),
        isPwa: detectIsPwa(),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        breadcrumbs: diag.breadcrumbs,
        recentErrors: diag.recentErrors,
      };

      // Capture the visible screen BEFORE mounting the modal so the dialog never obscures the view.
      const shot = await captureViewportScreenshot();
      setContext(snapshot);
      setInitialScreenshot(shot);
      setOpen(true);
    } finally {
      setPreparing(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setInitialScreenshot(null);
  }

  return (
    <>
      <button
        type="button"
        data-feedback-ignore="true"
        className="pilot-feedback-fab"
        aria-label={pl ? "Zgłoś sugestię lub błąd" : "Send feedback or report a bug"}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={preparing}
        onClick={() => void handleOpen()}
      >
        <span className="pilot-feedback-fab-avatar" aria-hidden="true">
          {/* Cached local static brand mascot (128x128 PNG) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/feedback-mascot.png"
            alt=""
            width={34}
            height={34}
            loading="lazy"
            decoding="async"
          />
        </span>
        <span className="pilot-feedback-fab-label">
          <span className="pilot-feedback-fab-label-full">
            {preparing
              ? pl
                ? "Chwila…"
                : "Opening…"
              : pl
                ? "Sugestia / Błąd"
                : "Feedback"}
          </span>
          <span className="pilot-feedback-fab-label-short">
            {preparing ? "…" : pl ? "Sugestia" : "Feedback"}
          </span>
        </span>
      </button>

      {open && context && (
        <PilotFeedbackModal
          context={context}
          initialScreenshot={initialScreenshot}
          onClose={handleClose}
        />
      )}
    </>
  );
}
