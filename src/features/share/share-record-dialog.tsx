"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import QRCode from "qrcode";
import {
  IconBan,
  IconCheck,
  IconClock,
  IconCopy,
  IconExternalLink,
  IconEye,
  IconPlus,
  IconQrcode,
  IconShare,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { PetShareLink, PetShareOpenLog, ShareTtlHours } from "./types";

export function ShareRecordButton({
  petId,
  petName,
}: {
  petId: string;
  petName: string;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        <IconQrcode size={16} aria-hidden="true" />
        <span>
          {pl ? "Udostępnij weterynarzowi" : "Share with vet"}
        </span>
      </Button>

      {open && (
        <ShareRecordDialog
          petId={petId}
          petName={petName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function isLinkActive(link: PetShareLink): boolean {
  if (link.revoked_at) return false;
  return new Date(link.expires_at).getTime() > Date.now();
}

function ShareRecordDialog({
  petId,
  petName,
  onClose,
}: {
  petId: string;
  petName: string;
  onClose: () => void;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [ttlHours, setTtlHours] = useState<ShareTtlHours>(24);
  const [label, setLabel] = useState("");
  const [links, setLinks] = useState<PetShareLink[]>([]);
  const [openLogs, setOpenLogs] = useState<PetShareOpenLog[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const node = dialogRef.current;
    if (node && !node.open) node.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const client = createClient();
        const { data, error: fnErr } = await client.functions.invoke(
          "pet-share",
          {
            body: { action: "list", pet_id: petId },
          },
        );
        if (!active) return;
        if (fnErr || !data) {
          setError(
            pl
              ? "Nie udało się pobrać listy udostępnień."
              : "Could not load share links.",
          );
          return;
        }
        const fetchedLinks = (data.links ?? []) as PetShareLink[];
        setLinks(fetchedLinks);
        setOpenLogs((data.open_logs ?? []) as PetShareOpenLog[]);
        const firstActive = fetchedLinks.find((l) => isLinkActive(l));
        if (firstActive) setSelectedLinkId(firstActive.id);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [petId, pl]);

  function buildShareUrl(token: string): string {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/${locale}/udostepnione/${token}`;
  }

  const selectedLink =
    links.find((l) => l.id === selectedLinkId) ??
    links.find((l) => isLinkActive(l)) ??
    null;

  useEffect(() => {
    let cancelled = false;
    async function renderQr() {
      if (!selectedLink) {
        setQrSvg("");
        return;
      }
      const url = buildShareUrl(selectedLink.token);
      try {
        const svg = await QRCode.toString(url, {
          type: "svg",
          margin: 1,
          width: 200,
          color: {
            dark: "#164d34",
            light: "#ffffff",
          },
        });
        if (!cancelled) setQrSvg(svg);
      } catch {
        if (!cancelled) setQrSvg("");
      }
    }
    void renderQr();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLink?.token, locale]);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const client = createClient();
      const { data, error: fnErr } = await client.functions.invoke("pet-share", {
        body: {
          action: "create",
          pet_id: petId,
          ttl_hours: ttlHours,
          label: label.trim(),
        },
      });
      if (fnErr || !data?.link) {
        setError(
          pl
            ? "Nie udało się utworzyć linku udostępniania."
            : "Could not create share link.",
        );
        return;
      }
      const created = data.link as PetShareLink;
      setLinks((prev) => [created, ...prev]);
      setSelectedLinkId(created.id);
      setLabel("");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(linkId: string) {
    if (revokingId) return;
    setRevokingId(linkId);
    setError("");
    try {
      const client = createClient();
      const { data, error: fnErr } = await client.functions.invoke("pet-share", {
        body: {
          action: "revoke",
          pet_id: petId,
          link_id: linkId,
        },
      });
      if (fnErr || !data?.link) {
        setError(
          pl
            ? "Nie udało się unieważnić linku."
            : "Could not revoke share link.",
        );
        return;
      }
      const updated = data.link as PetShareLink;
      setLinks((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l)),
      );
    } finally {
      setRevokingId(null);
    }
  }

  async function handleCopy(link: PetShareLink) {
    const url = buildShareUrl(link.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(link.id);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === link.id ? null : curr));
      }, 2200);
    } catch {
      // ignore
    }
  }

  const formatDateTime = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));

  const ttlOptions: { value: ShareTtlHours; label: string }[] = [
    { value: 1, label: pl ? "1 godzina" : "1 hour" },
    { value: 24, label: pl ? "24 godziny (domyślnie)" : "24 hours (default)" },
    { value: 168, label: pl ? "7 dni" : "7 days" },
  ];

  return (
    <dialog
      ref={dialogRef}
      className="weight-dialog history-dialog share-dialog"
      aria-labelledby="share-dialog-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="share-dialog-body">
        <header>
          <span className="weight-dialog-icon" aria-hidden="true">
            <IconShare size={22} />
          </span>
          <div>
            <h2 id="share-dialog-title">
              {pl
                ? `Udostępnij kartotekę — ${petName}`
                : `Share medical record — ${petName}`}
            </h2>
            <p>
              {pl
                ? "Wygeneruj tymczasowy link lub kod QR tylko do odczytu (bez zakładania konta przez lekarza weterynarii)."
                : "Generate a temporary read-only link or QR code for your veterinarian (no account required)."}
            </p>
          </div>
          <button
            type="button"
            className="weight-dialog-close"
            onClick={onClose}
            aria-label={pl ? "Zamknij" : "Close"}
          >
            <IconX size={18} aria-hidden="true" />
          </button>
        </header>

        <section className="share-create-box">
          <div className="share-create-row">
            <div className="share-field">
              <label htmlFor="share-ttl">
                {pl ? "Czas ważności linku" : "Link validity"}
              </label>
              <select
                id="share-ttl"
                value={ttlHours}
                onChange={(e) =>
                  setTtlHours(Number(e.target.value) as ShareTtlHours)
                }
                className="schedule-select"
              >
                {ttlOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="share-field is-grow">
              <label htmlFor="share-label">
                {pl
                  ? "Notatka / dla kogo (opcjonalnie)"
                  : "Note / recipient (optional)"}
              </label>
              <input
                id="share-label"
                type="text"
                maxLength={120}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={
                  pl
                    ? "Np. Wizyta dr Kowalski — VetCardia"
                    : "E.g. Dr. Smith consultation"
                }
              />
            </div>

            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              <IconPlus size={16} aria-hidden="true" />
              <span>
                {creating
                  ? pl
                    ? "Tworzenie…"
                    : "Creating…"
                  : pl
                    ? "Utwórz link i kod QR"
                    : "Create link & QR"}
              </span>
            </Button>
          </div>
        </section>

        {error && (
          <p role="alert" className="weight-dialog-error">
            {error}
          </p>
        )}

        {selectedLink && isLinkActive(selectedLink) && (
          <section className="share-active-showcase">
            <div
              className="share-qr-frame"
              aria-label={pl ? "Kod QR do kartoteki" : "Record QR code"}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="share-active-details">
              <span className="share-badge is-active">
                {pl ? "Aktywny link tylko do odczytu" : "Active read-only link"}
              </span>
              <strong>
                {selectedLink.label ||
                  (pl
                    ? `Kartoteka ${petName} (${selectedLink.ttl_hours}h)`
                    : `${petName}'s record (${selectedLink.ttl_hours}h)`)}
              </strong>
              <p className="share-expiry-note">
                <IconClock size={14} aria-hidden="true" />
                <span>
                  {pl ? "Wygasa: " : "Expires: "}
                  <strong>{formatDateTime(selectedLink.expires_at)}</strong>
                </span>
              </p>

              <div className="share-url-bar">
                <input
                  type="text"
                  readOnly
                  value={buildShareUrl(selectedLink.token)}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={pl ? "Adres linku" : "Share URL"}
                />
                <button
                  type="button"
                  className="history-action-btn is-primary"
                  onClick={() => void handleCopy(selectedLink)}
                >
                  {copiedId === selectedLink.id ? (
                    <>
                      <IconCheck size={15} aria-hidden="true" />
                      <span>{pl ? "Skopiowano!" : "Copied!"}</span>
                    </>
                  ) : (
                    <>
                      <IconCopy size={15} aria-hidden="true" />
                      <span>{pl ? "Kopiuj link" : "Copy link"}</span>
                    </>
                  )}
                </button>
                <a
                  href={buildShareUrl(selectedLink.token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="history-action-btn"
                >
                  <IconExternalLink size={15} aria-hidden="true" />
                  <span>{pl ? "Podgląd" : "Preview"}</span>
                </a>
              </div>
            </div>
          </section>
        )}

        <section className="share-history-section">
          <h3>
            {pl
              ? "Wygenerowane linki i historia otwarć"
              : "Generated links and open history"}
          </h3>

          {loading ? (
            <p className="share-muted">
              {pl ? "Ładowanie historii linków…" : "Loading share links…"}
            </p>
          ) : links.length === 0 ? (
            <p className="share-muted">
              {pl
                ? "Nie wygenerowano jeszcze żadnego linku dla tego pupila."
                : "No share links generated for this pet yet."}
            </p>
          ) : (
            <ul className="share-links-list">
              {links.map((link) => {
                const active = isLinkActive(link);
                const linkLogs = openLogs.filter(
                  (log) => log.share_link_id === link.id,
                );
                return (
                  <li
                    key={link.id}
                    className={`share-link-item${selectedLink?.id === link.id ? " is-selected" : ""}${!active ? " is-inactive" : ""}`}
                  >
                    <div className="share-link-main">
                      <div className="share-link-info">
                        <div className="share-link-title-row">
                          <span
                            className={`share-badge ${active ? "is-active" : link.revoked_at ? "is-revoked" : "is-expired"}`}
                          >
                            {active
                              ? pl
                                ? "Aktywny"
                                : "Active"
                              : link.revoked_at
                                ? pl
                                  ? "Unieważniony"
                                  : "Revoked"
                                : pl
                                  ? "Wygasł"
                                  : "Expired"}
                          </span>
                          <strong>
                            {link.label ||
                              (pl
                                ? `Udostępnienie (${link.ttl_hours}h)`
                                : `Share link (${link.ttl_hours}h)`)}
                          </strong>
                          <span className="share-open-counter">
                            <IconEye size={13} aria-hidden="true" />
                            <span>
                              {pl
                                ? `Otwarcia: ${link.open_count}`
                                : `Opens: ${link.open_count}`}
                            </span>
                          </span>
                        </div>
                        <small>
                          {pl ? "Utworzono: " : "Created: "}
                          {formatDateTime(link.created_at)} ·{" "}
                          {link.revoked_at
                            ? `${pl ? "Unieważniono: " : "Revoked: "}${formatDateTime(link.revoked_at)}`
                            : `${pl ? "Wygasa: " : "Expires: "}${formatDateTime(link.expires_at)}`}
                        </small>
                      </div>

                      <div className="share-link-actions">
                        {active && (
                          <>
                            <button
                              type="button"
                              className="schedule-mini-btn"
                              onClick={() => setSelectedLinkId(link.id)}
                            >
                              <IconQrcode size={14} aria-hidden="true" />
                              <span>{pl ? "Kod QR" : "QR Code"}</span>
                            </button>
                            <button
                              type="button"
                              className="schedule-mini-btn"
                              onClick={() => void handleCopy(link)}
                            >
                              <IconCopy size={14} aria-hidden="true" />
                              <span>
                                {copiedId === link.id
                                  ? pl
                                    ? "Skopiowano"
                                    : "Copied"
                                  : pl
                                    ? "Kopiuj"
                                    : "Copy"}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="schedule-mini-btn is-danger"
                              disabled={revokingId === link.id}
                              onClick={() => void handleRevoke(link.id)}
                            >
                              <IconBan size={14} aria-hidden="true" />
                              <span>
                                {pl ? "Unieważnij" : "Revoke"}
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {linkLogs.length > 0 && (
                      <div className="share-open-logs">
                        <span>
                          {pl ? "Ostatnie otwarcia:" : "Recent opens:"}
                        </span>
                        <ul>
                          {linkLogs.slice(0, 4).map((log) => (
                            <li key={log.id}>
                              {formatDateTime(log.opened_at)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
