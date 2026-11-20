"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import {
  IconArchive,
  IconBan,
  IconCheck,
  IconClock,
  IconCopy,
  IconExternalLink,
  IconFileAnalytics,
  IconLock,
  IconMail,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/i18n/types";
import { archiveMessages } from "./messages";
import type { PetArchiveLink } from "./types";

function getArchiveLinkState(
  link: PetArchiveLink,
): "active" | "revoked" | "expired" | "locked" {
  if (link.revoked_at) return "revoked";
  const now = Date.now();
  if (new Date(link.expires_at).getTime() <= now) return "expired";
  if (link.locked_until && new Date(link.locked_until).getTime() > now) {
    return "locked";
  }
  return "active";
}

export function ArchiveLinkButton({
  petId,
  petName,
}: {
  petId: string;
  petName: string;
}) {
  const locale = (useLocale() as Locale) ?? "pl";
  const t = archiveMessages[locale] ?? archiveMessages.pl;
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        <IconArchive size={16} aria-hidden="true" />
        <span>{t.buttonLabel}</span>
      </Button>

      {open && (
        <ArchiveLinkDialog
          petId={petId}
          petName={petName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ArchiveLinkDialog({
  petId,
  petName,
  onClose,
}: {
  petId: string;
  petName: string;
  onClose: () => void;
}) {
  const locale = (useLocale() as Locale) ?? "pl";
  const t = archiveMessages[locale] ?? archiveMessages.pl;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailId = useId();
  const labelId = useId();

  const [links, setLinks] = useState<PetArchiveLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [label, setLabel] = useState("");
  const [sending, setSending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sentNotice, setSentNotice] = useState<{
    email: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    const node = dialogRef.current;
    if (node && !node.open) node.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    async function loadLinks() {
      try {
        const client = createClient();
        const { data, error: fnErr } = await client.functions.invoke(
          "pet-archive",
          {
            body: { action: "list", pet_id: petId },
          },
        );
        if (!active) return;
        if (fnErr || !data) {
          setError(t.errors.load_failed);
          return;
        }
        setLinks((data.links ?? []) as PetArchiveLink[]);
      } catch {
        if (active) setError(t.errors.load_failed);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadLinks();
    return () => {
      active = false;
    };
  }, [petId, t.errors.load_failed]);

  function buildArchiveUrl(token: string): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/${locale}/archive/${token}`;
  }

  function mapErrorMessage(code?: string): string {
    if (code && code in t.errors) {
      return t.errors[code as keyof typeof t.errors];
    }
    return t.errors.generic;
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setError("");
    setSentNotice(null);

    const trimmedEmail = recipientEmail.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setError(t.errors.invalid_email);
      return;
    }

    setSending(true);
    try {
      const client = createClient();
      const { data, error: fnErr } = await client.functions.invoke(
        "pet-archive",
        {
          body: {
            action: "create",
            pet_id: petId,
            recipient_email: trimmedEmail,
            label: label.trim(),
            locale,
          },
        },
      );

      if (fnErr) {
        const res = fnErr.context;
        const body =
          res instanceof Response ? await res.json().catch(() => null) : null;
        setError(mapErrorMessage(body?.error));
        return;
      }

      if (!data?.link) {
        setError(t.errors.generic);
        return;
      }

      const created = data.link as PetArchiveLink;
      setLinks((prev) => [created, ...prev]);
      setRecipientEmail("");
      setLabel("");
      setSentNotice({
        email: created.recipient_email,
        url: buildArchiveUrl(created.token),
      });
    } catch {
      setError(t.errors.generic);
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(linkId: string) {
    if (revokingId) return;
    setRevokingId(linkId);
    setError("");
    try {
      const client = createClient();
      const { data, error: fnErr } = await client.functions.invoke(
        "pet-archive",
        {
          body: { action: "revoke", pet_id: petId, link_id: linkId },
        },
      );
      if (fnErr || !data?.link) {
        setError(t.errors.generic);
        return;
      }
      const updated = data.link as PetArchiveLink;
      setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    } catch {
      setError(t.errors.generic);
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopy(url: string, key: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(key);
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === key ? null : cur));
      }, 2200);
    } catch {
      // Fallback pominięty przy zablokowanym schowku
    }
  }

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  return (
    <dialog
      ref={dialogRef}
      className="weight-dialog history-dialog share-dialog"
      onCancel={(e) => {
        e.preventDefault();
        if (!sending) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && !sending) onClose();
      }}
    >
      <div className="share-dialog-body">
        <header>
          <span className="weight-dialog-icon" aria-hidden="true">
            <IconArchive size={22} />
          </span>
          <div>
            <h2>
              {t.dialogTitle}: {petName}
            </h2>
            <p>{t.dialogSubtitle}</p>
          </div>
          <button
            type="button"
            className="weight-dialog-close"
            onClick={onClose}
            disabled={sending}
            aria-label="Zamknij"
          >
            <IconX size={18} />
          </button>
        </header>

        <form className="share-create-box archive-create-form" onSubmit={handleCreate}>
          <div className="share-create-row">
            <div className="share-field is-grow">
              <label htmlFor={emailId}>
                <IconMail size={13} aria-hidden="true" /> {t.emailLabel}
              </label>
              <input
                id={emailId}
                type="email"
                required
                maxLength={254}
                value={recipientEmail}
                onChange={(e) => {
                  setRecipientEmail(e.target.value);
                  setError("");
                }}
                placeholder={t.emailPlaceholder}
              />
            </div>

            <div className="share-field is-grow">
              <label htmlFor={labelId}>{t.labelField}</label>
              <input
                id={labelId}
                type="text"
                maxLength={120}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t.labelPlaceholder}
              />
            </div>

            <Button type="submit" disabled={sending}>
              <IconSend size={16} aria-hidden="true" />
              {sending ? t.sending : t.sendButton}
            </Button>
          </div>

          <p className="archive-validity-note">
            <IconLock size={14} aria-hidden="true" />
            <span>{t.validityNote}</span>
          </p>
        </form>

        {error && (
          <p role="alert" className="weight-dialog-error">
            {error}
          </p>
        )}

        {sentNotice && (
          <section className="archive-sent-banner" aria-live="polite">
            <div className="archive-sent-copy">
              <strong>
                <IconCheck size={16} aria-hidden="true" /> {t.sentSuccess}
              </strong>
              <span>{sentNotice.email}</span>
            </div>
            <div className="share-url-bar">
              <input type="text" readOnly value={sentNotice.url} aria-label={t.copyLink} />
              <button
                type="button"
                className="history-action-btn is-primary"
                onClick={() => void handleCopy(sentNotice.url, "sent")}
              >
                {copiedId === "sent" ? (
                  <>
                    <IconCheck size={15} aria-hidden="true" />
                    <span>{t.copied}</span>
                  </>
                ) : (
                  <>
                    <IconCopy size={15} aria-hidden="true" />
                    <span>{t.copyLink}</span>
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        <section className="share-history-section">
          <h3>{t.historyTitle}</h3>
          {loading ? (
            <p className="share-muted">{t.loading}</p>
          ) : links.length === 0 ? (
            <p className="share-muted">{t.emptyLinks}</p>
          ) : (
            <ul className="share-links-list">
              {links.map((link) => {
                const state = getArchiveLinkState(link);
                const url = buildArchiveUrl(link.token);
                const badgeClass =
                  state === "active"
                    ? "is-active"
                    : state === "revoked"
                      ? "is-revoked"
                      : "is-expired";
                const badgeLabel =
                  state === "active"
                    ? t.statusActive
                    : state === "revoked"
                      ? t.statusRevoked
                      : state === "locked"
                        ? t.statusLocked
                        : t.statusExpired;

                return (
                  <li
                    key={link.id}
                    className={`share-link-item${state !== "active" ? " is-inactive" : ""}`}
                  >
                    <div className="share-link-main">
                      <div className="share-link-info">
                        <div className="share-link-title-row">
                          <span className={`share-badge ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                          <strong>{link.recipient_email}</strong>
                          {link.label && <small>({link.label})</small>}
                        </div>
                        <small>
                          <IconClock size={12} aria-hidden="true" />{" "}
                          {t.expiresAt} {formatDateTime(link.expires_at)}
                        </small>
                        <small className="archive-counters-row">
                          <IconFileAnalytics size={12} aria-hidden="true" />{" "}
                          {t.unlockedCount} {link.unlocked_count} · {t.pdfCount}{" "}
                          {link.pdf_download_count} · {t.fileCount}{" "}
                          {link.file_download_count}
                        </small>
                      </div>

                      <div className="share-link-actions">
                        {state === "active" && (
                          <>
                            <button
                              type="button"
                              className="history-action-btn"
                              onClick={() => void handleCopy(url, link.id)}
                            >
                              {copiedId === link.id ? (
                                <>
                                  <IconCheck size={14} aria-hidden="true" />
                                  <span>{t.copied}</span>
                                </>
                              ) : (
                                <>
                                  <IconCopy size={14} aria-hidden="true" />
                                  <span>{t.copyLink}</span>
                                </>
                              )}
                            </button>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="history-action-btn"
                            >
                              <IconExternalLink size={14} aria-hidden="true" />
                              <span>{t.openLink}</span>
                            </a>
                            <button
                              type="button"
                              className="history-action-btn is-danger"
                              disabled={revokingId === link.id}
                              onClick={() => void handleRevoke(link.id)}
                            >
                              <IconBan size={14} aria-hidden="true" />
                              <span>
                                {revokingId === link.id ? t.revoking : t.revokeButton}
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </dialog>
  );
}
