"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCheck,
  IconKey,
  IconMail,
  IconQrcode,
  IconShieldLock,
} from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function RecoveryPortal() {
  const locale = useLocale() === "en" ? "en" : "pl";
  const pl = locale === "pl";

  const [ownerEmail, setOwnerEmail] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [prefilledFromQr, setPrefilledFromQr] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedInfo, setSubmittedInfo] = useState<{
    householdName: string;
    targetEmailMasked: string;
    expiresAt: string;
  } | null>(null);

  // Odczytaj parametry z fragmentu #owner=...&key=... po zeskanowaniu kodu QR
  // i natychmiast wyczyść fragment URL z paska adresu przeglądarki.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawHash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : "";
    const rawSearch = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : "";
    if (!rawHash && !rawSearch) return;

    const hashParams = new URLSearchParams(rawHash);
    const searchParams = new URLSearchParams(rawSearch);
    const qrOwner = (hashParams.get("owner") || searchParams.get("owner") || "").trim();
    const qrKey = (hashParams.get("key") || "")
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, "");

    if (!qrOwner && !qrKey) return;

    if (rawHash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (qrOwner) setOwnerEmail(qrOwner);
      if (qrKey) {
        setRecoveryKey(qrKey);
        setPrefilledFromQr(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleKeyChange(raw: string) {
    const cleaned = raw.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setRecoveryKey(cleaned);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("household-recovery", {
        body: {
          action: "initiate",
          owner_email: ownerEmail.trim(),
          recovery_key: recoveryKey.trim(),
          target_email: targetEmail.trim(),
          locale,
        },
      });

      if (error || !data?.ok) {
        const code = data?.error;
        if (code === "rate_limited") {
          setErrorMsg(
            pl
              ? "Zbyt wiele nieudanych prób dla tego adresu właściciela. Odczekaj 15 minut przed kolejną próbą."
              : "Too many failed attempts for this owner email. Please wait 15 minutes.",
          );
        } else if (code === "invalid_email") {
          setErrorMsg(
            pl
              ? "Sprawdź poprawność podanych adresów e-mail."
              : "Please check both email addresses.",
          );
        } else if (code === "invalid_key_format") {
          setErrorMsg(
            pl
              ? "Nieprawidłowy format klucza odzyskania (oczekiwany wzór CMP-XXXX-XXXX-XXXX-XXXX-XXXX)."
              : "Invalid recovery key format (expected CMP-XXXX-XXXX-XXXX-XXXX-XXXX).",
          );
        } else if (code === "email_send_failed") {
          setErrorMsg(
            pl
              ? "Klucz został zweryfikowany, ale nie udało się wysłać e-maila potwierdzającego. Spróbuj ponownie."
              : "Key verified, but confirmation email failed to send. Please try again.",
          );
        } else {
          setErrorMsg(
            pl
              ? "Nie znaleziono pasującego aktywnego klucza odzyskania dla podanego adresu e-mail właściciela."
              : "No active recovery key matched that owner email and key.",
          );
        }
        return;
      }

      setSubmittedInfo({
        householdName: String(data.household_name ?? ""),
        targetEmailMasked: String(data.target_email_masked ?? targetEmail),
        expiresAt: String(data.expires_at ?? ""),
      });
    } catch {
      setErrorMsg(
        pl
          ? "Błąd połączenia z serwerem. Spróbuj ponownie."
          : "Network error. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submittedInfo) {
    const formattedExpiry = submittedInfo.expiresAt
      ? new Intl.DateTimeFormat(pl ? "pl-PL" : "en-GB", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Europe/Warsaw",
        }).format(new Date(submittedInfo.expiresAt))
      : "";

    return (
      <section className="recovery-portal-card">
        <div className="recovery-portal-badge is-success">
          <IconCheck size={20} aria-hidden="true" />
          <span>{pl ? "Wysłano link potwierdzający" : "Confirmation link sent"}</span>
        </div>

        <h1>
          {pl
            ? `Sprawdź skrzynkę ${submittedInfo.targetEmailMasked}`
            : `Check ${submittedInfo.targetEmailMasked}`}
        </h1>
        <p className="recovery-portal-lead">
          {pl
            ? `Zweryfikowaliśmy klucz odzyskania dla domostwa „${submittedInfo.householdName}”. Wysłaliśmy link potwierdzający (ważny przez 24 godziny${formattedExpiry ? `, do ${formattedExpiry}` : ""}) na wskazany nowy adres e-mail.`
            : `Your recovery key for "${submittedInfo.householdName}" was verified. We sent a 24-hour confirmation link to your target email address.`}
        </p>

        <div className="recovery-inline-alert">
          <IconShieldLock size={18} aria-hidden="true" />
          <span>
            {pl
              ? "Ze względów bezpieczeństwa wysłaliśmy również ostrzeżenie na dotychczasowy adres właściciela oraz adres pomocniczy. Przekazanie własności nastąpi dopiero po kliknięciu linku z wiadomości."
              : "A security alert was also sent to the previous owner and backup email. Ownership transfers only after clicking the link."}
          </span>
        </div>

        <div className="recovery-portal-actions">
          <Link href="/login" className="btn btn-secondary">
            <IconArrowLeft size={16} aria-hidden="true" />
            {pl ? "Powrót do logowania" : "Back to sign in"}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="recovery-portal-card">
      <div className="recovery-portal-badge">
        <IconKey size={20} aria-hidden="true" />
        <span>
          {pl ? "Odzyskiwanie dostępu do domostwa" : "Household access recovery"}
        </span>
      </div>

      <h1>
        {pl
          ? "Przejmij lub odzyskaj domostwo jednorazowym kluczem"
          : "Recover household access with a one-time key"}
      </h1>
      <p className="recovery-portal-lead">
        {pl
          ? "Formularz nie wymaga logowania na utracone konto. Podaj adres e-mail obecnego właściciela, jednorazowy klucz odzyskania oraz swój aktualny adres e-mail, na który prześlemy link finalizujący przekazanie."
          : "No access to the lost account is required. Enter the current owner's email, the one-time recovery key, and the target email where we should send the confirmation link."}
      </p>

      {prefilledFromQr && (
        <div className="recovery-inline-alert is-success" role="status">
          <IconQrcode size={18} aria-hidden="true" />
          <span>
            {pl
              ? "Wczytano dane z kodu QR karty odzyskania. Wpisz poniżej swój docelowy adres e-mail, aby odebrać link potwierdzający."
              : "Recovery card details loaded from QR code. Enter your target email below to receive the confirmation link."}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="recovery-portal-form">
        <label className="recovery-field">
          <span>
            <IconMail size={15} aria-hidden="true" />
            {pl ? "E-mail dotychczasowego właściciela domostwa" : "Current owner's email"}
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={pl ? "np. opiekun@domena.pl" : "owner@example.com"}
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
          />
        </label>

        <label className="recovery-field">
          <span>
            <IconKey size={15} aria-hidden="true" />
            {pl ? "Jednorazowy klucz odzyskania" : "One-time recovery key"}
          </span>
          <input
            type="text"
            required
            spellCheck={false}
            autoCapitalize="characters"
            placeholder="CMP-XXXX-XXXX-XXXX-XXXX-XXXX"
            value={recoveryKey}
            onChange={(e) => handleKeyChange(e.target.value)}
            className="recovery-key-input"
          />
        </label>

        <label className="recovery-field">
          <span>
            <IconMail size={15} aria-hidden="true" />
            {pl
              ? "Docelowy e-mail do przejęcia własności (Twoja skrzynka)"
              : "Target email address to receive ownership link"}
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            placeholder={pl ? "twoj.nowy@adres.pl" : "your.email@example.com"}
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
          />
          <small>
            {pl
              ? "Możesz podać adres istniejącego konta Care My Pet albo zupełnie nowy adres e-mail (założysz konto jednym kliknięciem z linku)."
              : "You can use an existing Care My Pet account email or a brand-new address."}
          </small>
        </label>

        {errorMsg && (
          <div className="recovery-inline-alert is-error" role="alert">
            <IconAlertCircle size={18} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="recovery-portal-actions">
          <Button type="submit" disabled={isSubmitting}>
            <IconKey size={16} aria-hidden="true" />
            {isSubmitting
              ? pl
                ? "Weryfikacja klucza..."
                : "Verifying key..."
              : pl
                ? "Zweryfikuj klucz i wyślij link"
                : "Verify key & send link"}
          </Button>
          <Link href="/login" className="recovery-back-link">
            <IconArrowLeft size={15} aria-hidden="true" />
            {pl ? "Wróć do logowania" : "Back to sign in"}
          </Link>
        </div>
      </form>
    </section>
  );
}
