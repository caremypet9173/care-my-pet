"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  IconAlertCircle,
  IconArrowRight,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconHome,
  IconLock,
  IconMail,
  IconShieldCheck,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { InvitationDetailsResponse } from "./types";

export function AcceptInvitation({
  token,
  initialUserEmail,
}: {
  token: string;
  initialUserEmail?: string | null;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<InvitationDetailsResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status sesji i akceptacji
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(
    initialUserEmail ?? null,
  );
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Tryb autoryzacji: "register" (załóż konto i dołącz) lub "login" (zaloguj się i dołącz)
  const [authMode, setAuthMode] = useState<"register" | "login">("register");

  // Rejestracja
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Logowanie
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchDetails() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const client = createClient();
        const { data, error } = await client.functions.invoke("household", {
          body: { action: "get_invite_details", token },
        });

        if (cancelled) return;
        if (error || !data?.invitation) {
          setErrorMsg(
            pl
              ? "Nie udało się odnaleźć tego zaproszenia. Link mógł wygasnąć lub zostać usunięty."
              : "Could not find this invitation. The link may have expired or been removed.",
          );
        } else {
          const invData = data as InvitationDetailsResponse;
          setDetails(invData);
          setLoginEmail(invData.invitation.email || "");
        }
      } catch {
        if (!cancelled) {
          setErrorMsg(
            pl
              ? "Wystąpił błąd podczas sprawdzania zaproszenia."
              : "An error occurred while checking the invitation.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [token, pl]);

  // Obsługa 1: Bezpośrednia rejestracja i natychmiastowe dołączenie (1 klik)
  async function handleRegisterAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || !details) return;

    if (regPassword.length < 8) {
      setFormError(
        pl
          ? "Hasło musi mieć co najmniej 8 znaków."
          : "Password must be at least 8 characters long.",
      );
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const client = createClient();

      // 1. Wywołanie Edge Function tworzącej konto i dodającej do gospodarstwa
      const { data, error } = await client.functions.invoke("household", {
        body: {
          action: "register_and_accept",
          token,
          password: regPassword,
        },
      });

      if (error || !data?.success) {
        const errKey = data?.error || error?.message || "error";
        if (errKey === "user_already_exists") {
          setAuthMode("login");
          setLoginEmail(details.invitation.email);
          setFormError(
            pl
              ? "Konto z tym adresem e-mail już istnieje. Wpisz hasło poniżej, aby się zalogować i dołączyć."
              : "An account with this email already exists. Enter your password below to log in and join.",
          );
          return;
        } else if (errKey === "invite_expired") {
          setFormError(pl ? "To zaproszenie wygasło." : "This invitation has expired.");
          return;
        }
        setFormError(
          pl
            ? "Nie udało się utworzyć konta. Spróbuj ponownie."
            : "Could not create account. Please try again.",
        );
        return;
      }

      // 2. Zalogowanie nowego użytkownika w bieżącej sesji przeglądarki
      const { error: signInErr } = await client.auth.signInWithPassword({
        email: details.invitation.email,
        password: regPassword,
      });

      if (signInErr) {
        console.error("Sign in after register error:", signInErr);
      }

      setCurrentUserEmail(details.invitation.email);
      setAcceptedSuccess(true);
      window.setTimeout(() => {
        router.push("/app");
        router.refresh();
      }, 1400);
    } catch (err) {
      console.error(err);
      setFormError(
        pl
          ? "Wystąpił błąd podczas rejestracji."
          : "An error occurred during registration.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Obsługa 2: Logowanie istniejącego konta i natychmiastowa akceptacja
  async function handleLoginAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || !details) return;

    const email = loginEmail.trim().toLowerCase();
    if (!email || !loginPassword) {
      setFormError(
        pl ? "Wpisz adres e-mail i hasło." : "Enter email and password.",
      );
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const client = createClient();

      // 1. Zalogowanie użytkownika
      const { data: authData, error: authErr } =
        await client.auth.signInWithPassword({
          email,
          password: loginPassword,
        });

      if (authErr || !authData.session) {
        setFormError(
          pl
            ? "Nieprawidłowy adres e-mail lub hasło."
            : "Invalid email or password.",
        );
        return;
      }

      const userEmail = authData.user.email ?? email;
      setCurrentUserEmail(userEmail);

      // 2. Dołączenie do gospodarstwa
      const { data: acceptData, error: acceptErr } =
        await client.functions.invoke("household", {
          body: { action: "accept_invite", token },
        });

      if (acceptErr || !acceptData?.success) {
        const errKey = acceptData?.error || acceptErr?.message || "error";
        let msg = pl
          ? "Zalogowano, ale nie udało się zaakceptować zaproszenia."
          : "Logged in, but could not accept the invitation.";
        if (errKey === "already_owner") {
          msg = pl
            ? "Jesteś już właścicielem tego gospodarstwa."
            : "You are already the owner of this household.";
        } else if (errKey === "invite_expired") {
          msg = pl ? "To zaproszenie wygasło." : "This invitation has expired.";
        }
        setFormError(msg);
        return;
      }

      setAcceptedSuccess(true);
      window.setTimeout(() => {
        router.push("/app");
        router.refresh();
      }, 1400);
    } catch (err) {
      console.error(err);
      setFormError(
        pl
          ? "Wystąpił błąd podczas logowania."
          : "An error occurred during login.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Obsługa 3: Akceptacja dla już zalogowanego użytkownika
  async function handleAcceptLoggedIn() {
    if (isSubmitting || !details) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("household", {
        body: { action: "accept_invite", token },
      });

      if (error || !data?.success) {
        const errKey = data?.error || error?.message || "error";
        let msg = pl
          ? "Nie udało się zaakceptować zaproszenia."
          : "Could not accept the invitation.";
        if (errKey === "already_owner") {
          msg = pl
            ? "Jesteś już właścicielem tego gospodarstwa."
            : "You are already the owner of this household.";
        } else if (errKey === "invite_expired") {
          msg = pl ? "To zaproszenie wygasło." : "This invitation has expired.";
        } else if (errKey === "invite_accepted") {
          msg = pl
            ? "To zaproszenie zostało już wcześniej zaakceptowane."
            : "This invitation has already been accepted.";
        }
        setFormError(msg);
        return;
      }

      setAcceptedSuccess(true);
      window.setTimeout(() => {
        router.push("/app");
        router.refresh();
      }, 1400);
    } catch {
      setFormError(
        pl
          ? "Wystąpił nieoczekiwany błąd podczas dołączania."
          : "An unexpected error occurred while joining.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Wylogowanie w razie chęci zmiany konta
  async function handleSignOut() {
    const client = createClient();
    await client.auth.signOut();
    setCurrentUserEmail(null);
  }

  if (loading) {
    return (
      <div className="household-invite-card">
        <div className="household-invite-icon is-primary">
          <IconHome size={32} />
        </div>
        <h2>{pl ? "Sprawdzanie zaproszenia…" : "Checking invitation…"}</h2>
        <p>{pl ? "Proszę czekać chwilę." : "Please wait a moment."}</p>
      </div>
    );
  }

  if (errorMsg || !details) {
    return (
      <div className="household-invite-card">
        <div className="household-invite-icon is-error">
          <IconAlertCircle size={32} />
        </div>
        <h2>{pl ? "Problem z zaproszeniem" : "Invitation error"}</h2>
        <p>{errorMsg || (pl ? "Nieprawidłowy link zaproszenia." : "Invalid invitation link.")}</p>
        <Link href="/app" className="history-action-btn is-primary">
          <span>{pl ? "Przejdź do aplikacji" : "Go to app"}</span>
        </Link>
      </div>
    );
  }

  if (acceptedSuccess) {
    return (
      <div className="household-invite-card is-success">
        <div className="household-invite-icon is-success">
          <IconCheck size={36} />
        </div>
        <h2>{pl ? "Witaj w gospodarstwie!" : "Welcome to the household!"}</h2>
        <p>
          {pl
            ? `Pomyślnie dołączono do ${details.household?.nazwa || "gospodarstwa"}. Przenosimy do pupili…`
            : `Successfully joined ${details.household?.nazwa || "household"}. Redirecting…`}
        </p>
      </div>
    );
  }

  const isPending = details.invitation.status === "pending";

  if (!isPending) {
    const statusNote =
      details.invitation.status === "accepted"
        ? pl
          ? "To zaproszenie zostało już zaakceptowane."
          : "This invitation has already been accepted."
        : details.invitation.status === "expired"
          ? pl
            ? "To zaproszenie wygasło."
            : "This invitation has expired."
          : pl
            ? "To zaproszenie zostało anulowane."
            : "This invitation has been cancelled.";

    return (
      <div className="household-invite-card">
        <div className="household-invite-icon">
          <IconAlertCircle size={32} />
        </div>
        <h2>{pl ? "Status zaproszenia" : "Invitation status"}</h2>
        <p>{statusNote}</p>
        <Link href="/app" className="history-action-btn is-primary">
          <span>{pl ? "Przejdź do aplikacji" : "Go to app"}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="household-invite-card">
      <div className="household-invite-icon is-primary">
        <IconUsers size={36} />
      </div>

      <h2>
        {pl ? "Zaproszenie do wspólnej opieki" : "Co-care invitation"}
      </h2>

      <p className="household-invite-subtitle">
        <strong>{details.inviter.email}</strong>{" "}
        {pl ? "zaprasza Cię do gospodarstwa:" : "invites you to household:"}
      </p>

      {/* Box gospodarstwa */}
      <div className="household-invite-box">
        <div className="household-invite-box-header">
          <IconHome size={22} aria-hidden="true" />
          <strong>{details.household?.nazwa || (pl ? "Mój dom" : "My Home")}</strong>
        </div>

        {details.pets.length > 0 && (
          <div className="household-invite-pets-list">
            <span className="household-invite-pets-label">
              {pl ? "Pupile w tym domu:" : "Pets in this home:"}
            </span>
            <div className="household-invite-pets-chips">
              {details.pets.map((p) => (
                <span key={p.id} className="household-invite-pet-chip">
                  <span>{p.gatunek === "cat" ? "🐱" : "🐶"}</span>
                  <strong>{p.imie}</strong>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="household-invite-benefits">
          <div className="household-invite-benefit-row">
            <IconShieldCheck size={16} aria-hidden="true" />
            <span>
              {pl
                ? "Dostęp do kart zdrowia, badań krwi i dokumentacji medycznej"
                : "Access to health records, blood tests, and medical records"}
            </span>
          </div>
          <div className="household-invite-benefit-row">
            <IconShieldCheck size={16} aria-hidden="true" />
            <span>
              {pl
                ? "Wspólny terminarz wizyt, szczepień i przypomnień o lekach"
                : "Shared schedule for visits, vaccinations, and medication reminders"}
            </span>
          </div>
        </div>
      </div>

      {/* Komunikat o błędzie */}
      {formError && (
        <div className="household-invite-feedback is-error" role="alert">
          <div className="household-feedback-header">
            <IconAlertCircle size={16} aria-hidden="true" />
            <span>{formError}</span>
          </div>
        </div>
      )}

      {/* Wariant 1: Użytkownik jest już zalogowany */}
      {currentUserEmail ? (
        <div className="household-invite-actions">
          <div className="household-invite-logged-card">
            <div className="household-invite-logged-info">
              <IconUserCheck size={18} aria-hidden="true" />
              <span>
                {pl ? "Zalogowano jako:" : "Logged in as:"}{" "}
                <strong>{currentUserEmail}</strong>
              </span>
            </div>
            <button
              type="button"
              className="household-invite-switch-link"
              onClick={() => void handleSignOut()}
            >
              {pl ? "Zmień konto" : "Switch account"}
            </button>
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            onClick={() => void handleAcceptLoggedIn()}
          >
            <IconCheck size={18} aria-hidden="true" />
            {isSubmitting
              ? pl
                ? "Dołączanie…"
                : "Joining…"
              : pl
                ? "Dołącz do gospodarstwa"
                : "Join household"}
          </Button>
        </div>
      ) : (
        /* Wariant 2: Użytkownik nie jest zalogowany — szybka rejestracja lub logowanie na miejscu */
        <div className="household-invite-auth-section">
          <div className="household-invite-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "register"}
              className={`household-invite-tab-btn ${authMode === "register" ? "is-active" : ""}`}
              onClick={() => {
                setAuthMode("register");
                setFormError(null);
              }}
            >
              <IconUserPlus size={16} aria-hidden="true" />
              <span>{pl ? "Utwórz hasło i dołącz" : "Create password & join"}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "login"}
              className={`household-invite-tab-btn ${authMode === "login" ? "is-active" : ""}`}
              onClick={() => {
                setAuthMode("login");
                setFormError(null);
              }}
            >
              <IconLock size={16} aria-hidden="true" />
              <span>{pl ? "Mam już konto" : "I already have an account"}</span>
            </button>
          </div>

          {authMode === "register" ? (
            <form onSubmit={handleRegisterAndAccept} className="household-invite-embedded-form">
              <p className="household-invite-field-hint">
                {pl
                  ? "Nie masz jeszcze konta? Wpisz hasło poniżej — Twoje konto zostanie natychmiast założone i dołączone do gospodarstwa (bez dodatkowych kroków)."
                  : "Don't have an account yet? Enter a password below — your account will be created and joined to the household instantly."}
              </p>

              <div className="household-invite-input-group">
                <label htmlFor="invite-reg-email">
                  {pl ? "Twój adres e-mail (z zaproszenia)" : "Your email address (from invite)"}
                </label>
                <div className="household-invite-input-readonly">
                  <IconMail size={16} aria-hidden="true" />
                  <input
                    id="invite-reg-email"
                    type="email"
                    readOnly
                    value={details.invitation.email}
                  />
                  <span className="household-tag">
                    <IconLock size={11} aria-hidden="true" />
                    {pl ? "Zabezpieczony" : "Verified"}
                  </span>
                </div>
              </div>

              <div className="household-invite-input-group">
                <label htmlFor="invite-reg-password">
                  {pl ? "Utwórz hasło do konta" : "Create password"}
                </label>
                <div className="household-invite-input-wrap">
                  <IconLock size={16} aria-hidden="true" />
                  <input
                    id="invite-reg-password"
                    type={showRegPassword ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={128}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder={pl ? "Minimum 8 znaków" : "At least 8 characters"}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="household-invite-eye-btn"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    aria-label={
                      showRegPassword
                        ? pl
                          ? "Ukryj hasło"
                          : "Hide password"
                        : pl
                          ? "Pokaż hasło"
                          : "Show password"
                    }
                  >
                    {showRegPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting || !regPassword}
              >
                <IconUserPlus size={18} aria-hidden="true" />
                {isSubmitting
                  ? pl
                    ? "Tworzenie konta i dołączanie…"
                    : "Creating account & joining…"
                  : pl
                    ? "Załóż konto i dołącz do gospodarstwa"
                    : "Create account & join household"}
              </Button>

              <p className="household-invite-switch-prompt">
                {pl ? "Masz już konto w Care My Pet?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  className="household-invite-text-btn"
                  onClick={() => {
                    setAuthMode("login");
                    setFormError(null);
                  }}
                >
                  {pl ? "Zaloguj się i dołącz →" : "Log in & join →"}
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleLoginAndAccept} className="household-invite-embedded-form">
              <p className="household-invite-field-hint">
                {pl
                  ? "Wpisz hasło do swojego istniejącego konta, aby natychmiast dołączyć do tego gospodarstwa."
                  : "Enter your password for your existing account to join this household immediately."}
              </p>

              <div className="household-invite-input-group">
                <label htmlFor="invite-login-email">
                  {pl ? "Adres e-mail" : "Email address"}
                </label>
                <div className="household-invite-input-wrap">
                  <IconMail size={16} aria-hidden="true" />
                  <input
                    id="invite-login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="household-invite-input-group">
                <label htmlFor="invite-login-password">
                  {pl ? "Hasło" : "Password"}
                </label>
                <div className="household-invite-input-wrap">
                  <IconLock size={16} aria-hidden="true" />
                  <input
                    id="invite-login-password"
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={pl ? "Hasło do konta" : "Account password"}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="household-invite-eye-btn"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    aria-label={
                      showLoginPassword
                        ? pl
                          ? "Ukryj hasło"
                          : "Hide password"
                        : pl
                          ? "Pokaż hasło"
                          : "Show password"
                    }
                  >
                    {showLoginPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting || !loginEmail || !loginPassword}
              >
                <IconCheck size={18} aria-hidden="true" />
                {isSubmitting
                  ? pl
                    ? "Logowanie i dołączanie…"
                    : "Logging in & joining…"
                  : pl
                    ? "Zaloguj się i dołącz do gospodarstwa"
                    : "Log in & join household"}
              </Button>

              <p className="household-invite-switch-prompt">
                {pl ? "Nie masz jeszcze konta?" : "Don't have an account yet?"}{" "}
                <button
                  type="button"
                  className="household-invite-text-btn"
                  onClick={() => {
                    setAuthMode("register");
                    setFormError(null);
                  }}
                >
                  {pl ? "Załóż nowe konto i dołącz →" : "Create new account & join →"}
                </button>
              </p>
            </form>
          )}

          <div className="household-invite-fallback">
            <Link
              href={`/login?returnTo=/zaproszenie/${token}`}
              className="household-invite-fallback-link"
            >
              <span>
                {pl
                  ? "Chcesz zalogować się przez Google lub tradycyjny formularz? Kliknij tutaj"
                  : "Prefer to log in with Google or standard login? Click here"}
              </span>
              <IconArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
