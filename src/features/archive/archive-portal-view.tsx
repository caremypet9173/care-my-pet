"use client";

import { useId, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconAlertTriangle,
  IconClock,
  IconDownload,
  IconFileText,
  IconHeartHandshake,
  IconLock,
  IconPhoto,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { PetIcon } from "@/features/pets/pet-icon";
import type { Locale } from "@/i18n/types";
import { downloadPetArchivePdf } from "./archive-pdf";
import { archiveMessages } from "./messages";
import type { ArchiveMetaPayload, PetArchivePayload } from "./types";

function formatExpiry(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatMimeLabel(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/png") return "PNG";
  if (mime === "image/jpeg") return "JPEG";
  return mime;
}

export function ArchivePortalView({
  token,
  initialMeta,
}: {
  token: string;
  initialMeta: ArchiveMetaPayload;
}) {
  const locale = ((useLocale() as Locale) === "en" ? "en" : "pl") as "pl" | "en";
  const t = archiveMessages[locale].portal;
  const codeId = useId();

  const [code, setCode] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [gateError, setGateError] = useState("");
  const [lockedUntil, setLockedUntil] = useState<string | null>(
    initialMeta.status === "locked" ? initialMeta.locked_until : null,
  );
  const [payload, setPayload] = useState<PetArchivePayload | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [portalError, setPortalError] = useState("");

  async function callArchiveApi(body: Record<string, unknown>) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !anonKey) {
      throw new Error("Missing Supabase config");
    }
    const res = await fetch(`${supabaseUrl}/functions/v1/pet-archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, json };
  }

  async function handleUnlock(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (unlocking) return;
    const clean = code.trim();
    if (!clean) {
      setGateError(t.invalidCode);
      return;
    }

    setUnlocking(true);
    setGateError("");
    setPortalError("");

    try {
      const { ok, status, json } = await callArchiveApi({
        action: "unlock",
        token,
        code: clean,
      });

      if (!ok) {
        if (status === 429 || json?.error === "locked") {
          setLockedUntil(
            typeof json?.locked_until === "string" ? json.locked_until : null,
          );
          setGateError(t.lockedBody);
          return;
        }
        if (json?.error === "expired") {
          setGateError(t.expiredBody);
          return;
        }
        if (json?.error === "revoked") {
          setGateError(t.revokedBody);
          return;
        }
        if (status === 401 && typeof json?.remaining_attempts === "number") {
          setGateError(`${t.invalidCode} ${t.attemptsLeft} ${json.remaining_attempts}`);
          return;
        }
        setGateError(t.invalidCode);
        return;
      }

      setLockedUntil(null);
      setPayload(json as PetArchivePayload);
    } catch {
      setGateError(t.invalidCode);
    } finally {
      setUnlocking(false);
    }
  }

  async function handleDownloadPdf() {
    if (!payload || generatingPdf) return;
    setGeneratingPdf(true);
    setPortalError("");
    try {
      await downloadPetArchivePdf(payload, locale);
      void callArchiveApi({
        action: "track_pdf_download",
        token,
        session_token: payload.session_token,
      }).catch(() => undefined);
    } catch {
      setPortalError(t.pdfError);
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleDownloadAttachment(sourcePath: string) {
    if (!payload || downloadingPath) return;
    setDownloadingPath(sourcePath);
    setPortalError("");
    try {
      const { ok, status, json } = await callArchiveApi({
        action: "get_document_url",
        token,
        session_token: payload.session_token,
        source_path: sourcePath,
      });

      if (status === 401 || json?.error === "session_expired") {
        setPayload(null);
        setGateError(t.sessionExpired);
        return;
      }

      if (!ok || typeof json?.signed_url !== "string") {
        setPortalError(t.fileError);
        return;
      }

      const a = document.createElement("a");
      a.href = json.signed_url;
      a.rel = "noopener noreferrer";
      if (typeof json.file_name === "string") {
        a.download = json.file_name;
      }
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setPortalError(t.fileError);
    } finally {
      setDownloadingPath(null);
    }
  }

  if (!payload) {
    return (
      <section className="pet-panel archive-gate-card">
        <span className="archive-gate-icon" aria-hidden="true">
          {lockedUntil ? <IconAlertTriangle size={28} /> : <IconLock size={28} />}
        </span>
        <span className="pets-eyebrow">{t.eyebrow}</span>
        <h1>{lockedUntil ? t.lockedTitle : `${t.gateTitle}`}</h1>
        <p className="archive-gate-pet-name">{initialMeta.pet_name}</p>
        <p className="archive-gate-desc">
          {lockedUntil ? (
            <>
              {t.lockedBody}{" "}
              <strong>({formatExpiry(lockedUntil, locale)})</strong>
            </>
          ) : (
            <>
              {t.gateDescription}{" "}
              {initialMeta.recipient_hint ? (
                <strong>{initialMeta.recipient_hint}</strong>
              ) : null}
              .
            </>
          )}
        </p>

        <form className="archive-gate-form" onSubmit={handleUnlock}>
          <label htmlFor={codeId}>{t.codeLabel}</label>
          <input
            id={codeId}
            type="text"
            autoComplete="one-time-code"
            className="archive-code-input"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setGateError("");
            }}
            placeholder={t.codePlaceholder}
            maxLength={16}
            required
          />
          {gateError && (
            <p className="weight-dialog-error" role="alert">
              {gateError}
            </p>
          )}
          <Button type="submit" disabled={unlocking}>
            <IconLock size={16} aria-hidden="true" />
            {unlocking ? t.unlocking : t.unlockButton}
          </Button>
        </form>

        <p className="archive-gate-expiry">
          <IconClock size={14} aria-hidden="true" />
          <span>
            {t.validUntil} {formatExpiry(initialMeta.expires_at, locale)}
          </span>
        </p>
      </section>
    );
  }

  const { pet } = payload;
  const measurementCount =
    payload.weights.length +
    payload.vital_measurements.length +
    payload.fluid_therapies.length;

  return (
    <div className="archive-portal-stack">
      <div className="shared-vet-banner">
        <div className="shared-vet-banner-left">
          <IconLock size={20} aria-hidden="true" />
          <div>
            <strong>
              {t.eyebrow}: {pet.imie}
              {payload.archive.label ? ` (${payload.archive.label})` : ""}
            </strong>
            <span>
              {t.validUntil} {formatExpiry(payload.archive.expires_at, locale)}
            </span>
          </div>
        </div>
      </div>

      <section className="pet-panel archive-hero-summary">
        <div className="archive-hero-identity">
          <div className="archive-hero-avatar">
            <PetIcon species={pet.gatunek} src={pet.avatar_url} name={pet.imie} />
          </div>
          <div className="archive-hero-details">
            <h1>{pet.imie}</h1>
            <p>
              {pet.gatunek === "cat" ? (locale === "pl" ? "Kot" : "Cat") : locale === "pl" ? "Pies" : "Dog"}
              {pet.rasa ? ` · ${pet.rasa}` : ""}
              {pet.data_urodzenia ? ` · ${pet.data_urodzenia}` : ""}
            </p>
            {pet.archived_at && (
              <p className="archive-hero-status">
                {pet.archive_reason === "deceased" && (
                  <IconHeartHandshake size={15} aria-hidden="true" />
                )}
                <span>
                  {pet.archive_reason === "deceased"
                    ? locale === "pl"
                      ? `W pamięci${pet.closed_on ? ` · ${pet.closed_on}` : ""}`
                      : `In memory${pet.closed_on ? ` · ${pet.closed_on}` : ""}`
                    : locale === "pl"
                      ? "Kartoteka zamknięta"
                      : "Record closed"}
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="archive-stats-grid">
          <div>
            <strong>{payload.reports.length}</strong>
            <span>{t.stats.reports}</span>
          </div>
          <div>
            <strong>{payload.health_events.length}</strong>
            <span>{t.stats.events}</span>
          </div>
          <div>
            <strong>{measurementCount}</strong>
            <span>{t.stats.measurements}</span>
          </div>
          <div>
            <strong>{payload.attachments.length}</strong>
            <span>{t.stats.attachments}</span>
          </div>
        </div>
      </section>

      {portalError && (
        <p className="weight-dialog-error" role="alert">
          {portalError}
        </p>
      )}

      <section className="pet-panel archive-pdf-card">
        <div className="archive-pdf-copy">
          <span className="archive-pdf-icon" aria-hidden="true">
            <IconFileText size={26} />
          </span>
          <div>
            <h2>{t.downloadPdf}</h2>
            <p>{t.pdfHint}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={generatingPdf}
          onClick={() => void handleDownloadPdf()}
        >
          <IconDownload size={18} aria-hidden="true" />
          {generatingPdf ? t.generatingPdf : t.downloadPdf}
        </Button>
      </section>

      <section className="pet-panel archive-attachments-card">
        <h2>{t.attachmentsTitle}</h2>
        {payload.attachments.length === 0 ? (
          <p className="share-muted">{t.attachmentsEmpty}</p>
        ) : (
          <ul className="archive-files-list">
            {payload.attachments.map((att) => {
              const isBusy = downloadingPath === att.source_path;
              const isImage = att.source_mime.startsWith("image/");
              return (
                <li key={att.source_path} className="archive-file-row">
                  <div className="archive-file-info">
                    <span className="archive-file-icon" aria-hidden="true">
                      {isImage ? <IconPhoto size={20} /> : <IconFileText size={20} />}
                    </span>
                    <div className="archive-file-meta">
                      <strong>{att.title || att.source_name}</strong>
                      <small>
                        {att.date} · {att.source_name} ·{" "}
                        {formatMimeLabel(att.source_mime)}
                      </small>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={Boolean(downloadingPath)}
                    onClick={() => void handleDownloadAttachment(att.source_path)}
                  >
                    <IconDownload size={16} aria-hidden="true" />
                    <span>{isBusy ? t.downloadingFile : t.downloadFile}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
