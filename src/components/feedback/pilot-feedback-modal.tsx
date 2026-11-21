"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconBug,
  IconBulb,
  IconCamera,
  IconCheck,
  IconCompass,
  IconHistory,
  IconMapPin,
  IconPhotoUp,
  IconSend,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  trackAction,
  type TelemetryBreadcrumb,
  type TelemetryRecentError,
} from "@/lib/telemetry";
import type {
  FeedbackCategory,
  FeedbackListItem,
  FeedbackStatus,
  ScreenshotMime,
} from "@/lib/feedback-shared";
import type { TelemetryDeviceClass } from "@/lib/telemetry-shared";
import {
  captureViewportScreenshot,
  prepareUserScreenshotFile,
  type CapturedScreenshot,
} from "./screenshot-capture";

export interface FeedbackContextSnapshot {
  pathname: string;
  routeTemplate: string;
  activeTab: string;
  deviceClass: TelemetryDeviceClass;
  isPwa: boolean;
  viewport: string;
  breadcrumbs: TelemetryBreadcrumb[];
  recentErrors: TelemetryRecentError[];
}

const MIME_TO_EXT: Record<ScreenshotMime, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const STATUS_LABELS: Record<FeedbackStatus, { pl: string; en: string }> = {
  new: { pl: "Nowe", en: "New" },
  triaged: { pl: "W analizie", en: "In review" },
  planned: { pl: "Zaplanowane", en: "Planned" },
  resolved: { pl: "Poprawione", en: "Resolved" },
  wontfix: { pl: "Zamknięte", en: "Closed" },
};

const CATEGORY_LABELS: Record<FeedbackCategory, { pl: string; en: string }> = {
  suggestion: { pl: "Sugestia", en: "Suggestion" },
  bug: { pl: "Błąd", en: "Bug" },
  ux: { pl: "Ergonomia / UX", en: "UX / Usability" },
};

export function PilotFeedbackModal({
  context,
  initialScreenshot,
  onClose,
}: {
  context: FeedbackContextSnapshot;
  initialScreenshot: CapturedScreenshot | null;
  onClose: () => void;
}) {
  const locale = useLocale();
  const pl = locale === "pl";

  const [tab, setTab] = useState<"new" | "mine">("new");
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<CapturedScreenshot | null>(
    initialScreenshot,
  );
  const [includeScreenshot, setIncludeScreenshot] = useState(
    Boolean(initialScreenshot),
  );
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const [myItems, setMyItems] = useState<FeedbackListItem[] | null>(null);
  const [loadingMine, setLoadingMine] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const screenshotUrlRef = useRef<string | null>(initialScreenshot?.previewUrl ?? null);

  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, submitting]);

  useEffect(() => {
    const prev = screenshotUrlRef.current;
    const next = screenshot?.previewUrl ?? null;
    if (prev && prev !== next) {
      URL.revokeObjectURL(prev);
    }
    screenshotUrlRef.current = next;
  }, [screenshot]);

  useEffect(
    () => () => {
      if (screenshotUrlRef.current) {
        URL.revokeObjectURL(screenshotUrlRef.current);
      }
    },
    [],
  );

  async function loadMyFeedback() {
    setLoadingMine(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("load_failed");
      const data = (await res.json()) as { items?: FeedbackListItem[] };
      setMyItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setMyItems([]);
    } finally {
      setLoadingMine(false);
    }
  }

  function handleOpenHistoryTab() {
    setTab("mine");
    if (myItems === null && !loadingMine) {
      void loadMyFeedback();
    }
  }

  async function handleRetakeScreenshot() {
    if (capturing || submitting) return;
    setCapturing(true);
    setError("");
    try {
      const next = await captureViewportScreenshot();
      if (!next) {
        setError(
          pl
            ? "Nie udało się wykonać automatycznego zrzutu. Możesz wkleić własny (Ctrl+V) lub wybrać plik."
            : "Could not capture the screen automatically. You can paste one (Ctrl+V) or upload an image.",
        );
        return;
      }
      setScreenshot(next);
      setIncludeScreenshot(true);
    } finally {
      setCapturing(false);
    }
  }

  async function handleFileSelect(file?: File | null, source: "upload" | "paste" = "upload") {
    if (!file) return;
    setError("");
    const prepared = await prepareUserScreenshotFile(file, source);
    if (!prepared) {
      setError(
        pl
          ? "Nie udało się przetworzyć obrazka. Wybierz plik PNG, JPG lub WebP do 2 MB."
          : "Could not process the image. Choose a PNG, JPG or WebP file under 2 MB.",
      );
      return;
    }
    setScreenshot(prepared);
    setIncludeScreenshot(true);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const pastedFile = item.getAsFile();
        if (pastedFile) {
          event.preventDefault();
          void handleFileSelect(pastedFile, "paste");
          return;
        }
      }
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      setError(
        pl
          ? "Napisz chociaż kilka słów o sugestii lub napotkanym problemie."
          : "Please enter at least a few words describing your suggestion or issue.",
      );
      textareaRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError("");
    let uploadedPath: string | null = null;
    let uploadedMime: ScreenshotMime | null = null;

    try {
      const client = createClient();

      if (includeScreenshot && screenshot) {
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user) throw new Error("unauthorized");

        const ext = MIME_TO_EXT[screenshot.mime];
        const candidatePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await client.storage
          .from("pilot-feedback")
          .upload(candidatePath, screenshot.blob, {
            contentType: screenshot.mime,
            upsert: false,
            cacheControl: "3600",
          });
        if (upErr) {
          throw new Error("screenshot_upload_failed");
        }
        uploadedPath = candidatePath;
        uploadedMime = screenshot.mime;
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: trimmed,
          pathname: context.pathname,
          active_tab: context.activeTab,
          locale: pl ? "pl" : "en",
          device_class: context.deviceClass,
          is_pwa: context.isPwa,
          viewport: context.viewport,
          breadcrumbs: context.breadcrumbs,
          recent_errors: context.recentErrors,
          screenshot_path: uploadedPath,
          screenshot_mime: uploadedMime,
        }),
      });

      const body = (await res.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;

      if (!res.ok || !body?.id) {
        if (uploadedPath) {
          await client.storage.from("pilot-feedback").remove([uploadedPath]).catch(() => null);
        }
        if (res.status === 429 || body?.error === "daily_limit") {
          setError(
            pl
              ? "Osiągnięto dzienny limit 10 zgłoszeń. Dziękujemy — wróć jutro!"
              : "Daily limit of 10 submissions reached. Thank you — please try again tomorrow!",
          );
          return;
        }
        throw new Error(body?.error ?? "save_failed");
      }

      setSubmittedId(body.id);
      setMyItems(null); // invalidate list cache so next view fetches fresh item
      trackAction("pilot_feedback_submitted", {
        category,
        has_screenshot: Boolean(uploadedPath),
      });
    } catch {
      setError(
        pl
          ? "Nie udało się wysłać zgłoszenia. Twoja treść nie zniknęła — spróbuj ponownie."
          : "Could not send feedback. Your text is still here — please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetForAnother() {
    setSubmittedId(null);
    setMessage("");
    setError("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const formatShortDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  return (
    <div
      className="pilot-feedback-backdrop"
      data-feedback-ignore="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pilot-feedback-title"
      onPaste={handlePaste}
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="pilot-feedback-dialog">
        <header className="pilot-feedback-header">
          <div className="pilot-feedback-brand">
            {/* Local static brand mascot icon (128x128) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/feedback-mascot.png"
              alt=""
              width={40}
              height={40}
              className="pilot-feedback-header-mascot"
              aria-hidden="true"
            />
            <div>
              <h2 id="pilot-feedback-title">
                {pl ? "Sugestia lub błąd" : "Feedback or issue"}
              </h2>
              <p>
                {pl
                  ? "Pomóż nam ulepszyć Care My Pet podczas pilotażu"
                  : "Help us improve Care My Pet during the pilot"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pilot-feedback-close"
            aria-label={pl ? "Zamknij" : "Close"}
            disabled={submitting}
            onClick={onClose}
          >
            <IconX size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="pilot-feedback-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "new"}
            onClick={() => setTab("new")}
          >
            <IconBulb size={15} aria-hidden="true" />
            {pl ? "Nowe zgłoszenie" : "New report"}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mine"}
            onClick={handleOpenHistoryTab}
          >
            <IconHistory size={15} aria-hidden="true" />
            {pl ? "Moje zgłoszenia" : "My submissions"}
          </button>
        </div>

        <div className="pilot-feedback-body">
          {tab === "mine" ? (
            <div className="pilot-feedback-history">
              {loadingMine ? (
                <p className="pilot-feedback-muted">
                  {pl ? "Wczytywanie zgłoszeń…" : "Loading submissions…"}
                </p>
              ) : !myItems || myItems.length === 0 ? (
                <p className="pilot-feedback-muted">
                  {pl
                    ? "Nie wysłałeś jeszcze żadnych sugestii ani błędów."
                    : "You haven't submitted any suggestions or bug reports yet."}
                </p>
              ) : (
                <ul>
                  {myItems.map((item) => (
                    <li key={item.id} className="pilot-feedback-history-item">
                      <div className="pilot-feedback-history-head">
                        <span className={`pilot-feedback-cat is-${item.category}`}>
                          {pl
                            ? CATEGORY_LABELS[item.category].pl
                            : CATEGORY_LABELS[item.category].en}
                        </span>
                        <span className={`pilot-feedback-status is-${item.status}`}>
                          {pl
                            ? STATUS_LABELS[item.status].pl
                            : STATUS_LABELS[item.status].en}
                        </span>
                        <small>{formatShortDate(item.created_at)}</small>
                      </div>
                      <p className="pilot-feedback-history-msg">{item.message}</p>
                      <small className="pilot-feedback-history-route">
                        {item.route_template}
                        {item.active_tab ? ` · ${item.active_tab}` : ""}
                        {item.has_screenshot
                          ? pl
                            ? " · ze zrzutem ekranu"
                            : " · with screenshot"
                          : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : submittedId ? (
            <div className="pilot-feedback-success" role="status">
              <div className="pilot-feedback-success-icon">
                <IconCheck size={24} aria-hidden="true" />
              </div>
              <h3>{pl ? "Dziękujemy za zgłoszenie!" : "Thank you for your feedback!"}</h3>
              <p>
                {pl
                  ? "Twoja wiadomość została zapisana wraz z kontekstem ekranu i trafi do naszej kolejki przeglądu."
                  : "Your message has been saved with screen context and queued for review."}
              </p>
              <div className="pilot-feedback-success-actions">
                <Button variant="secondary" size="sm" onClick={resetForAnother}>
                  {pl ? "Wyślij kolejne" : "Send another"}
                </Button>
                <Button size="sm" onClick={onClose}>
                  {pl ? "Wróć do aplikacji" : "Back to app"}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="pilot-feedback-form">
              <div className="pilot-feedback-context">
                <IconMapPin size={14} aria-hidden="true" />
                <span>
                  {pl ? "Lokalizacja:" : "Location:"}{" "}
                  <code>{context.routeTemplate}</code>
                  {context.activeTab ? (
                    <>
                      {" · "}
                      {pl ? "zakładka" : "tab"}: <code>{context.activeTab}</code>
                    </>
                  ) : null}
                </span>
              </div>

              <fieldset className="pilot-feedback-categories">
                <legend className="sr-only">
                  {pl ? "Rodzaj zgłoszenia" : "Submission category"}
                </legend>
                {(
                  [
                    {
                      id: "suggestion" as const,
                      icon: IconBulb,
                      label: pl ? "Sugestia" : "Suggestion",
                      hint: pl ? "Pomysł na ulepszenie" : "Improvement idea",
                    },
                    {
                      id: "bug" as const,
                      icon: IconBug,
                      label: pl ? "Błąd" : "Bug",
                      hint: pl ? "Coś nie działa" : "Something broke",
                    },
                    {
                      id: "ux" as const,
                      icon: IconCompass,
                      label: pl ? "Ergonomia" : "UX",
                      hint: pl ? "Coś było niejasne" : "Confusing flow",
                    },
                  ] as const
                ).map(({ id, icon: Icon, label, hint }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={category === id}
                    className={`pilot-feedback-cat-btn${category === id ? " is-active" : ""}`}
                    onClick={() => setCategory(id)}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                  </button>
                ))}
              </fieldset>

              <label className="pilot-feedback-field">
                <span>
                  {category === "bug"
                    ? pl
                      ? "Co się stało i co próbowałeś zrobić?"
                      : "What happened and what were you trying to do?"
                    : category === "ux"
                      ? pl
                        ? "Co było niejasne lub niewygodne na tym ekranie?"
                        : "What felt confusing or awkward on this screen?"
                      : pl
                        ? "Jaki masz pomysł lub sugestię?"
                        : "What is your idea or suggestion?"}
                </span>
                <textarea
                  ref={textareaRef}
                  rows={4}
                  maxLength={4000}
                  required
                  value={message}
                  disabled={submitting}
                  placeholder={
                    pl
                      ? "Opisz krótko swoimi słowami… (możesz też wkleić zrzut ekranu skrótem Ctrl+V)"
                      : "Describe briefly in your own words… (you can also paste a screenshot with Ctrl+V)"
                  }
                  onChange={(e) => setMessage(e.target.value)}
                />
              </label>

              <div className="pilot-feedback-screenshot-box">
                <div className="pilot-feedback-screenshot-head">
                  <label className="pilot-feedback-checkbox">
                    <input
                      type="checkbox"
                      checked={includeScreenshot && Boolean(screenshot)}
                      disabled={!screenshot || submitting}
                      onChange={(e) => setIncludeScreenshot(e.target.checked)}
                    />
                    <span>
                      {pl
                        ? "Dołącz zrzut bieżącego ekranu (opcjonalnie)"
                        : "Attach current screen capture (optional)"}
                    </span>
                  </label>
                  <div className="pilot-feedback-screenshot-tools">
                    <button
                      type="button"
                      className="pilot-feedback-tool-btn"
                      disabled={capturing || submitting}
                      onClick={() => void handleRetakeScreenshot()}
                    >
                      <IconCamera size={14} aria-hidden="true" />
                      {capturing
                        ? pl
                          ? "Chwila…"
                          : "Capturing…"
                        : pl
                          ? "Zrób ponownie"
                          : "Retake"}
                    </button>
                    <button
                      type="button"
                      className="pilot-feedback-tool-btn"
                      disabled={submitting}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <IconPhotoUp size={14} aria-hidden="true" />
                      {pl ? "Wybierz plik" : "Upload"}
                    </button>
                    {screenshot && (
                      <button
                        type="button"
                        className="pilot-feedback-tool-btn is-danger"
                        disabled={submitting}
                        aria-label={pl ? "Usuń zrzut" : "Remove screenshot"}
                        onClick={() => {
                          setScreenshot(null);
                          setIncludeScreenshot(false);
                        }}
                      >
                        <IconTrash size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    void handleFileSelect(e.target.files?.[0], "upload");
                    e.target.value = "";
                  }}
                />

                {screenshot && includeScreenshot ? (
                  <div className="pilot-feedback-preview">
                    {/* Local blob preview URL */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshot.previewUrl}
                      alt={pl ? "Podgląd zrzutu ekranu" : "Screenshot preview"}
                    />
                  </div>
                ) : (
                  <p className="pilot-feedback-muted">
                    {screenshot
                      ? pl
                        ? "Zrzut ekranu odznaczony — nie zostanie wysłany."
                        : "Screenshot unchecked — it will not be sent."
                      : pl
                        ? "Brak zrzutu ekranu. Możesz kliknąć „Zrób ponownie”, wkleić obrazek (Ctrl+V) lub wysłać samo zgłoszenie."
                        : "No screenshot attached. Click Retake, paste an image (Ctrl+V), or submit without one."}
                  </p>
                )}

                <small className="pilot-feedback-privacy">
                  {pl
                    ? "Zrzut jest prywatny, widoczny wyłącznie przy analizie pilotażu i usuwany po 90 dniach. Jeśli na podglądzie widać prywatne dane, odznacz zrzut."
                    : "Screenshots are private, used only for pilot review, and purged after 90 days. Uncheck if sensitive data is visible."}
                </small>
              </div>

              {error && (
                <p role="alert" className="pilot-feedback-error">
                  {error}
                </p>
              )}

              <footer className="pilot-feedback-footer">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={onClose}
                >
                  {pl ? "Anuluj" : "Cancel"}
                </Button>
                <Button type="submit" size="sm" loading={submitting}>
                  <IconSend size={15} aria-hidden="true" />
                  {pl ? "Wyślij zgłoszenie" : "Send feedback"}
                </Button>
              </footer>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
