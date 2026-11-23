"use client";

import "@/styles/recovery.css";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconDownload,
  IconKey,
  IconMailForward,
  IconShieldLock,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface GeneratedKeyPayload {
  recovery_key: string;
  recovery_key_hint: string;
  recovery_key_set_at: string;
  sent_to_recovery_email?: boolean;
  owner_email?: string | null;
}

export function RecoveryKeyDialog({
  open,
  onClose,
  householdId,
  householdName,
  ownerEmail,
  recoveryEmail,
  hasExistingKey,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  householdId?: string;
  householdName: string;
  ownerEmail: string;
  recoveryEmail?: string | null;
  hasExistingKey: boolean;
  onGenerated?: (payload: GeneratedKeyPayload) => void;
}) {
  const locale = useLocale() === "en" ? "en" : "pl";
  const pl = locale === "pl";
  const router = useRouter();

  const [sendToBackup, setSendToBackup] = useState(Boolean(recoveryEmail));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedKeyPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      if (!el.open) {
        el.showModal();
      }
    } else if (el.open) {
      el.close();
    }
  }, [open]);

  if (!open) return null;

  async function handleGenerate() {
    if (isGenerating) return;
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("household", {
        body: {
          action: "generate_recovery_key",
          household_id: householdId,
          send_to_recovery_email: sendToBackup && Boolean(recoveryEmail),
          locale,
        },
      });

      if (error || !data?.recovery_key) {
        setErrorMsg(
          data?.error === "owner_required_to_rotate"
            ? pl
              ? "Istniejący klucz odzyskania może unieważnić tylko właściciel domostwa."
              : "Only the household owner can rotate an existing recovery key."
            : pl
              ? "Nie udało się wygenerować klucza odzyskania. Spróbuj ponownie."
              : "Could not generate a recovery key. Please try again.",
        );
        return;
      }

      const payload: GeneratedKeyPayload = {
        recovery_key: String(data.recovery_key),
        recovery_key_hint: String(data.recovery_key_hint ?? ""),
        recovery_key_set_at: String(
          data.recovery_key_set_at ?? new Date().toISOString(),
        ),
        sent_to_recovery_email: Boolean(data.sent_to_recovery_email),
        owner_email:
          typeof data.owner_email === "string" ? data.owner_email : null,
      };
      setGenerated(payload);
      setAcknowledged(false);
      setCopied(false);
      onGenerated?.(payload);
    } catch {
      setErrorMsg(
        pl
          ? "Błąd połączenia z serwerem podczas generowania klucza."
          : "Network error while generating the recovery key.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopy() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.recovery_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback ignorowany
    }
  }

  async function handleDownloadPdf() {
    if (!generated || isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    setErrorMsg(null);
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://caremypet.pl";
      const { buildRecoveryKeyPdf } = await import("./recovery-key-pdf");
      const pdfBytes = await buildRecoveryKeyPdf({
        householdName: householdName || (pl ? "Mój dom" : "My home"),
        ownerEmail: generated.owner_email || ownerEmail || "",
        recoveryEmail: recoveryEmail ?? null,
        recoveryKey: generated.recovery_key,
        keyHint: generated.recovery_key_hint,
        createdAtIso: generated.recovery_key_set_at,
        recoveryUrl: `${origin}/${locale}/recover`,
        locale,
      });

      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: "application/pdf",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const slug = (householdName || "domostwo")
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "");
      a.download = `caremypet-klucz-odzyskania-${slug || "domostwo"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg(
        pl
          ? "Nie udało się utworzyć karty PDF. Zapisz klucz ręcznie lub skopiuj do schowka."
          : "Could not create the PDF card. Copy or write down the key manually.",
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  function handleDismiss() {
    const didGenerate = Boolean(generated);
    setGenerated(null);
    setAcknowledged(false);
    setErrorMsg(null);
    onClose();
    if (didGenerate) {
      router.refresh();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="recovery-dialog-native"
      aria-labelledby="recovery-key-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!generated && !isGenerating) {
          handleDismiss();
        }
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && !generated && !isGenerating) {
          handleDismiss();
        }
      }}
    >
      <div className="recovery-dialog-panel recovery-key-dialog">
        <div className="recovery-dialog-head">
          <div className="recovery-dialog-title-wrap">
            <span className="recovery-dialog-icon" aria-hidden="true">
              <IconKey size={20} />
            </span>
            <div>
              <h2 id="recovery-key-dialog-title">
                {generated
                  ? pl
                    ? "Twój nowy klucz odzyskania"
                    : "Your new recovery key"
                  : hasExistingKey
                    ? pl
                      ? "Wygeneruj nowy klucz odzyskania"
                      : "Generate a new recovery key"
                    : pl
                      ? "Wygeneruj klucz odzyskania dostępu"
                      : "Generate emergency recovery key"}
              </h2>
              <p className="recovery-dialog-subtitle">{householdName}</p>
            </div>
          </div>
          {!generated && (
            <button
              type="button"
              className="recovery-dialog-close"
              onClick={handleDismiss}
              aria-label={pl ? "Zamknij okno" : "Close dialog"}
            >
              <IconX size={18} />
            </button>
          )}
        </div>

        {!generated ? (
          <div className="recovery-dialog-body">
            <p className="recovery-dialog-desc">
              {pl
                ? "Jednorazowy klucz odzyskania (wzorzec Apple Legacy Contact) chroni kartoteki przed trwałym zablokowaniem, gdy właściciel straci dostęp do konta lub skrzynki e-mail."
                : "A one-time recovery key protects this household's records if the owner permanently loses access to their account or email inbox."}
            </p>

            {hasExistingKey ? (
              <div className="recovery-inline-alert is-warning">
                <IconAlertTriangle size={18} aria-hidden="true" />
                <span>
                  {pl
                    ? "Wygenerowanie nowego klucza natychmiast unieważni poprzedni klucz oraz wszystkie oczekujące prośby o odzyskanie dostępu."
                    : "Generating a new key immediately revokes the previous key and any pending recovery requests."}
                </span>
              </div>
            ) : (
              <div className="recovery-inline-alert">
                <IconShieldLock size={18} aria-hidden="true" />
                <span>
                  {pl
                    ? "Po zapisaniu klucza natychmiast odblokujesz pełne dodawanie i edycję kartotek pupili."
                    : "Once saved, full pet and medical record editing is unlocked right away."}
                </span>
              </div>
            )}

            <ul className="recovery-bullet-list">
              <li>
                {pl
                  ? "Klucz pokazujemy tylko raz — serwis przechowuje wyłącznie bezpieczny skrót kryptograficzny."
                  : "The key is displayed only once — the server stores only a cryptographic hash."}
              </li>
              <li>
                {pl
                  ? "Po jednorazowym użyciu klucz wygasa, a domostwo wraca do trybu tylko do odczytu do czasu ustawienia kolejnego klucza."
                  : "After single use, the key is consumed and the household returns to read-only until rotated."}
              </li>
              <li>
                {pl
                  ? "Możesz pobrać gotową kartę A4 w formacie PDF do druku lub przekazania zaufanej osobie."
                  : "You can download a printable A4 PDF card to store safely or hand to a trusted contact."}
              </li>
            </ul>

            {recoveryEmail && (
              <label className="recovery-checkbox-row">
                <input
                  type="checkbox"
                  checked={sendToBackup}
                  onChange={(e) => setSendToBackup(e.target.checked)}
                />
                <span>
                  {pl
                    ? `Wyślij kopię klucza również na e-mail pomocniczy: ${recoveryEmail}`
                    : `Also send a copy to backup email: ${recoveryEmail}`}
                </span>
              </label>
            )}

            {errorMsg && (
              <div className="recovery-inline-alert is-error" role="alert">
                <IconAlertTriangle size={18} aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="recovery-dialog-actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleDismiss}
                disabled={isGenerating}
              >
                {pl ? "Anuluj" : "Cancel"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                <IconKey size={16} aria-hidden="true" />
                {isGenerating
                  ? pl
                    ? "Generowanie..."
                    : "Generating..."
                  : hasExistingKey
                    ? pl
                      ? "Rotuj klucz odzyskania"
                      : "Rotate recovery key"
                    : pl
                      ? "Generuj klucz i odblokuj"
                      : "Generate key & unlock"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="recovery-dialog-body">
            <div className="recovery-secret-box">
              <span className="recovery-secret-label">
                {pl ? "Jednorazowy klucz odzyskania:" : "One-time recovery key:"}
              </span>
              <code className="recovery-secret-code" data-testid="generated-recovery-key">
                {generated.recovery_key}
              </code>
              <div className="recovery-secret-actions">
                <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
                  {copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
                  {copied
                    ? pl
                      ? "Skopiowano!"
                      : "Copied!"
                    : pl
                      ? "Kopiuj klucz"
                      : "Copy key"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={isDownloadingPdf}
                >
                  <IconDownload size={15} />
                  {isDownloadingPdf
                    ? pl
                      ? "Tworzenie PDF..."
                      : "Creating PDF..."
                    : pl
                      ? "Pobierz kartę PDF"
                      : "Download PDF card"}
                </Button>
              </div>
            </div>

            {generated.sent_to_recovery_email && recoveryEmail && (
              <div className="recovery-inline-alert is-success">
                <IconMailForward size={18} aria-hidden="true" />
                <span>
                  {pl
                    ? `Kopia klucza została wysłana również na adres pomocniczy: ${recoveryEmail}.`
                    : `A copy was also sent to your backup email: ${recoveryEmail}.`}
                </span>
              </div>
            )}

            <label className="recovery-checkbox-row recovery-ack-row">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
              />
              <span>
                {pl
                  ? "Zapisałem(am) klucz w bezpiecznym miejscu (PDF, wydruk lub sejf haseł) i rozumiem, że nie można go wyświetlić ponownie."
                  : "I have saved this key securely (PDF, print, or password manager) and understand it cannot be shown again."}
              </span>
            </label>

            {errorMsg && (
              <div className="recovery-inline-alert is-error" role="alert">
                <IconAlertTriangle size={18} aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="recovery-dialog-actions">
              <Button
                type="button"
                size="sm"
                onClick={handleDismiss}
                disabled={!acknowledged}
              >
                <IconCheck size={16} aria-hidden="true" />
                {pl ? "Gotowe — przejdź dalej" : "Done — continue"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

export { HouseholdRecoveryBanner } from "./recovery-banner";
