"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  IconAlertCircle,
  IconArrowRight,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconHome,
  IconLock,
  IconShieldLock,
  IconUserCheck,
  IconUserPlus,
} from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { switchActiveHousehold } from "./actions";

interface RecoveryClaimResponse {
  claim: {
    status: "pending" | "confirmed" | "revoked" | "expired";
    household_id: string;
    household_name: string;
    target_email: string;
    expires_at: string;
    confirmed_at: string | null;
    revoked_at: string | null;
    created_at: string;
  };
  target_has_account: boolean;
  pets: Array<{ id: string; imie: string; gatunek: "cat" | "dog" }>;
}

export function RecoveryConfirmView({
  token,
  initialUserEmail,
}: {
  token: string;
  initialUserEmail?: string | null;
}) {
  const locale = useLocale() === "en" ? "en" : "pl";
  const pl = locale === "pl";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<RecoveryClaimResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(
    initialUserEmail ?? null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmedSuccess, setConfirmedSuccess] = useState(false);

  const [authMode, setAuthMode] = useState<"register" | "login">("register");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const client = createClient();
        const { data, error } = await client.functions.invoke(
          "household-recovery",
          { body: { action: "get_claim", token } },
        );

        if (cancelled) return;
        if (error || !data?.claim) {
          setErrorMsg(
            pl
              ? "Nie znaleziono zgłoszenia odzyskania dostępu lub link jest nieprawidłowy."
              : "Recovery request not found or link is invalid.",
          );
          return;
        }

        const typed = data as RecoveryClaimResponse;
        setDetails(typed);
        if (typed.target_has_account) {
          setAuthMode("login");
        }
      } catch {
        if (!cancelled) {
          setErrorMsg(
            pl
              ? "Wystąpił błąd podczas sprawdzania linku odzyskania."
              : "Failed to verify the recovery link.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, pl]);

  async function finishAndRedirect(householdId: string) {
    setConfirmedSuccess(true);
    await switchActiveHousehold(householdId);
    setTimeout(() => {
      router.push("/app/gospodarstwo");
      router.refresh();
    }, 1200);
  }

  async function handleConfirmWithCurrentSession() {
    if (!details || isSubmitting) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke(
        "household-recovery",
        {
          body: { action: "confirm_claim", token, locale },
        },
      );

      if (error || !data?.ok) {
        if (data?.error === "email_mismatch") {
          setFormError(
            pl
              ? `Zalogowane konto (${currentUserEmail}) nie odpowiada docelowemu adresowi e-mail (${details.claim.target_email}). Zaloguj się na właściwy adres.`
              : `Signed-in account (${currentUserEmail}) does not match ${details.claim.target_email}.`,
          );
        } else {
          setFormError(
            pl
              ? "Nie udało się sfinalizować przekazania własności. Sprawdź ważność linku."
              : "Could not complete ownership transfer.",
          );
        }
        return;
      }

      await finishAndRedirect(String(data.household_id || details.claim.household_id));
    } catch {
      setFormError(
        pl ? "Błąd połączenia z serwerem." : "Network error.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegisterAndConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!details || isSubmitting) return;
    if (regPassword.length < 12) {
      setFormError(
        pl
          ? "Hasło musi mieć co najmniej 12 znaków."
          : "Password must be at least 12 characters.",
      );
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke(
        "household-recovery",
        {
          body: {
            action: "register_and_confirm",
            token,
            password: regPassword,
            locale,
          },
        },
      );

      if (error || !data?.ok) {
        if (data?.error === "account_exists") {
          setAuthMode("login");
          setFormError(
            pl
              ? "Konto dla tego adresu już istnieje. Zaloguj się poniżej, aby dokończyć przejęcie."
              : "An account for this email already exists. Sign in below to confirm.",
          );
        } else {
          setFormError(
            pl
              ? "Nie udało się utworzyć konta i przejąć domostwa."
              : "Could not create account and transfer ownership.",
          );
        }
        return;
      }

      // Automatyczne logowanie na nowo utworzone konto
      const { error: signInErr } = await client.auth.signInWithPassword({
        email: details.claim.target_email,
        password: regPassword,
      });

      if (signInErr) {
        router.push("/login");
        return;
      }

      setCurrentUserEmail(details.claim.target_email);
      await finishAndRedirect(String(data.household_id || details.claim.household_id));
    } catch {
      setFormError(pl ? "Błąd połączenia z serwerem." : "Network error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLoginAndConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!details || isSubmitting) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const client = createClient();
      const { data: signInData, error: signInErr } =
        await client.auth.signInWithPassword({
          email: details.claim.target_email,
          password: loginPassword,
        });

      if (signInErr || !signInData?.user) {
        setFormError(
          pl
            ? "Nieprawidłowe hasło dla tego adresu e-mail."
            : "Invalid password for this email address.",
        );
        return;
      }

      setCurrentUserEmail(signInData.user.email ?? details.claim.target_email);

      const { data, error } = await client.functions.invoke(
        "household-recovery",
        {
          body: { action: "confirm_claim", token, locale },
        },
      );

      if (error || !data?.ok) {
        setFormError(
          pl
            ? "Zalogowano, ale nie udało się dokończyć przejęcia domostwa."
            : "Signed in, but could not complete the ownership transfer.",
        );
        return;
      }

      await finishAndRedirect(String(data.household_id || details.claim.household_id));
    } catch {
      setFormError(pl ? "Błąd połączenia z serwerem." : "Network error.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    const client = createClient();
    await client.auth.signOut();
    setCurrentUserEmail(null);
    router.refresh();
  }

  if (loading) {
    return (
      <section className="recovery-portal-card">
        <p>{pl ? "Sprawdzanie zgłoszenia odzyskania dostępu..." : "Verifying recovery request..."}</p>
      </section>
    );
  }

  if (errorMsg || !details) {
    return (
      <section className="recovery-portal-card">
        <div className="recovery-inline-alert is-error">
          <IconAlertCircle size={18} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
        <div className="recovery-portal-actions">
          <Link href="/odzyskaj" className="btn btn-secondary">
            {pl ? "Rozpocznij od nowa" : "Start again"}
          </Link>
        </div>
      </section>
    );
  }

  if (confirmedSuccess || details.claim.status === "confirmed") {
    return (
      <section className="recovery-portal-card">
        <div className="recovery-portal-badge is-success">
          <IconCheck size={20} aria-hidden="true" />
          <span>{pl ? "Przekazano własność domostwa" : "Household ownership transferred"}</span>
        </div>
        <h1>
          {pl
            ? `Jesteś teraz właścicielem „${details.claim.household_name}”`
            : `You now own "${details.claim.household_name}"`}
        </h1>
        <p className="recovery-portal-lead">
          {pl
            ? "Poprzedni jednorazowy klucz odzyskania został zużyty, a poprzedni właściciel utracił dostęp. Aby odblokować edycję kartotek, wygeneruj teraz nowy klucz odzyskania w ustawieniach domostwa."
            : "The one-time recovery key has been consumed and the previous owner removed. Generate a new recovery key in household settings to unlock edits."}
        </p>
        <div className="recovery-portal-actions">
          <Link href="/app/gospodarstwo" className="btn btn-primary">
            <IconArrowRight size={16} aria-hidden="true" />
            {pl ? "Przejdź do ustawień domostwa" : "Open household settings"}
          </Link>
        </div>
      </section>
    );
  }

  if (details.claim.status !== "pending") {
    return (
      <section className="recovery-portal-card">
        <div className="recovery-inline-alert is-error">
          <IconAlertCircle size={18} aria-hidden="true" />
          <span>
            {details.claim.status === "revoked"
              ? pl
                ? "Ten link odzyskania został unieważniony przez obecnego właściciela."
                : "This recovery link was revoked by the current owner."
              : pl
                ? "Link odzyskania wygasł (ważność wynosiła 24 godziny)."
                : "This recovery link has expired."}
          </span>
        </div>
        <div className="recovery-portal-actions">
          <Link href="/odzyskaj" className="btn btn-secondary">
            {pl ? "Wróć do formularza odzyskania" : "Back to recovery form"}
          </Link>
        </div>
      </section>
    );
  }

  const normalizedTarget = details.claim.target_email.toLowerCase();
  const normalizedCurrent = currentUserEmail?.toLowerCase() ?? "";
  const isMatchingSignedInUser = Boolean(normalizedCurrent && normalizedCurrent === normalizedTarget);
  const returnToPath = `/${locale}/odzyskaj/potwierdz/${token}`;

  return (
    <section className="recovery-portal-card">
      <div className="recovery-portal-badge">
        <IconHome size={18} aria-hidden="true" />
        <span>{details.claim.household_name}</span>
      </div>

      <h1>
        {pl
          ? "Potwierdź przejęcie domostwa"
          : "Confirm household ownership transfer"}
      </h1>
      <p className="recovery-portal-lead">
        {pl
          ? `Docelowy adres przejmujący: ${details.claim.target_email}. Po zatwierdzeniu klucz odzyskania zostanie trwale zużyty, a poprzedni właściciel utraci dostęp.`
          : `Target email: ${details.claim.target_email}. Confirming consumes the recovery key and removes the previous owner.`}
      </p>

      {details.pets.length > 0 && (
        <div className="recovery-pets-summary">
          <strong>{pl ? "Pupile w domostwie:" : "Pets in this household:"}</strong>{" "}
          {details.pets.map((p) => p.imie).join(", ")}
        </div>
      )}

      {isMatchingSignedInUser ? (
        <div className="recovery-confirm-box">
          <div className="recovery-inline-alert">
            <IconUserCheck size={18} aria-hidden="true" />
            <span>
              {pl
                ? `Jesteś zalogowany jako ${currentUserEmail}. Kliknij poniżej, aby sfinalizować przejęcie.`
                : `Signed in as ${currentUserEmail}. Click below to complete the transfer.`}
            </span>
          </div>

          {formError && (
            <div className="recovery-inline-alert is-error" role="alert">
              <IconAlertCircle size={18} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <div className="recovery-portal-actions">
            <Button
              type="button"
              onClick={handleConfirmWithCurrentSession}
              disabled={isSubmitting}
            >
              <IconShieldLock size={16} aria-hidden="true" />
              {isSubmitting
                ? pl
                  ? "Przekazywanie własności..."
                  : "Transferring ownership..."
                : pl
                  ? "Potwierdzam i przejmuję domostwo"
                  : "Confirm & take ownership"}
            </Button>
          </div>
        </div>
      ) : currentUserEmail ? (
        <div className="recovery-confirm-box">
          <div className="recovery-inline-alert is-warning">
            <IconAlertCircle size={18} aria-hidden="true" />
            <span>
              {pl
                ? `Jesteś aktualnie zalogowany jako ${currentUserEmail}, ale link dotyczy adresu ${details.claim.target_email}. Wyloguj się, aby zalogować lub utworzyć konto dla docelowego adresu.`
                : `You are signed in as ${currentUserEmail}, but this link belongs to ${details.claim.target_email}.`}
            </span>
          </div>
          <div className="recovery-portal-actions">
            <Button type="button" variant="secondary" onClick={handleSignOut}>
              {pl ? "Wyloguj się i kontynuuj" : "Sign out & continue"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="recovery-auth-tabs-wrap">
          <div className="recovery-auth-tabs">
            <button
              type="button"
              className={authMode === "register" ? "is-active" : ""}
              onClick={() => {
                setAuthMode("register");
                setFormError(null);
              }}
            >
              <IconUserPlus size={16} aria-hidden="true" />
              {pl ? "Utwórz nowe konto" : "Create new account"}
            </button>
            <button
              type="button"
              className={authMode === "login" ? "is-active" : ""}
              onClick={() => {
                setAuthMode("login");
                setFormError(null);
              }}
            >
              <IconLock size={16} aria-hidden="true" />
              {pl ? "Mam już konto — zaloguj" : "Already have an account"}
            </button>
          </div>

          {authMode === "register" ? (
            <form onSubmit={handleRegisterAndConfirm} className="recovery-portal-form">
              <div className="recovery-readonly-email">
                <span>{pl ? "Adres nowego konta:" : "New account email:"}</span>
                <strong>{details.claim.target_email}</strong>
              </div>

              <label className="recovery-field">
                <span>{pl ? "Ustaw hasło (min. 12 znaków)" : "Set password (min. 12 chars)"}</span>
                <div className="recovery-password-wrap">
                  <input
                    type={showRegPassword ? "text" : "password"}
                    required
                    minLength={12}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="recovery-eye-btn"
                    onClick={() => setShowRegPassword((v) => !v)}
                    aria-label={pl ? "Pokaż/ukryj hasło" : "Toggle password visibility"}
                  >
                    {showRegPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </label>

              {formError && (
                <div className="recovery-inline-alert is-error" role="alert">
                  <IconAlertCircle size={18} aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}

              <Button type="submit" disabled={isSubmitting}>
                <IconShieldLock size={16} aria-hidden="true" />
                {isSubmitting
                  ? pl
                    ? "Tworzenie konta i przejmowanie..."
                    : "Creating account..."
                  : pl
                    ? "Załóż konto i przejmij domostwo"
                    : "Create account & take ownership"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLoginAndConfirm} className="recovery-portal-form">
              <div className="recovery-readonly-email">
                <span>{pl ? "Konto:" : "Account:"}</span>
                <strong>{details.claim.target_email}</strong>
              </div>

              <label className="recovery-field">
                <span>{pl ? "Hasło do konta" : "Account password"}</span>
                <div className="recovery-password-wrap">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="recovery-eye-btn"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    aria-label={pl ? "Pokaż/ukryj hasło" : "Toggle password visibility"}
                  >
                    {showLoginPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </label>

              {formError && (
                <div className="recovery-inline-alert is-error" role="alert">
                  <IconAlertCircle size={18} aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="recovery-portal-actions">
                <Button type="submit" disabled={isSubmitting}>
                  <IconShieldLock size={16} aria-hidden="true" />
                  {isSubmitting
                    ? pl
                      ? "Logowanie i przejmowanie..."
                      : "Signing in..."
                    : pl
                      ? "Zaloguj i przejmij domostwo"
                      : "Sign in & take ownership"}
                </Button>
                <a
                  href={`/${locale}/login?returnTo=${encodeURIComponent(returnToPath)}`}
                  className="recovery-back-link"
                >
                  {pl ? "Zaloguj przez Google / stronę logowania" : "Sign in via Google / login page"}
                </a>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
