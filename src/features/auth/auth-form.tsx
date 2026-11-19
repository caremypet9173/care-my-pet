"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { authMessages } from "./messages";
import { authDesignMessages } from "./design-messages";
import {
  IconBrandApple,
  IconEye,
  IconEyeOff,
  IconArrowRight,
  IconShieldLock,
  IconAlertCircle,
  IconInfoCircle,
} from "@tabler/icons-react";

export function AuthForm({ mode, configured, initialError }: {
  mode: "login" | "register"; configured: boolean; initialError?: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = authMessages[locale];
  const d = authDesignMessages[locale];
  const pl = locale === "pl";
  const [showPassword, setShowPassword] = useState(false);
  const register = mode === "register";
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [error, setError] = useState(
    initialError === "callback"
      ? t.callback
      : initialError === "confirmation"
        ? t.confirmation
        : initialError === "pilot_restricted"
          ? t.pilotRestricted
          : ""
  );
  const messageRef = useRef<HTMLDivElement>(null);
  const returnTo = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("returnTo")
    : null;
  const returnToSuffix = returnTo && returnTo.startsWith("/") ? `?returnTo=${encodeURIComponent(returnTo)}` : "";

  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => messageRef.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get("email") ?? "").trim().toLowerCase();

    setBusy(true);
    setError("");

    try {
      const supabase = createClient();

      if (register) {
        // 1. Sprawdź czy adres e-mail kwalifikuje się do pilotażu
        const { data: check, error: checkError } = await supabase.rpc("check_pilot_access", { p_email: email });
        if (checkError) {
          showError(t.failed);
          setBusy(false);
          return;
        }

        if (check?.eligible === false) {
          showError(t.pilotRestricted);
          setBusy(false);
          return;
        }

        if (check?.has_account === true) {
          showError(t.alreadyRegistered);
          setBusy(false);
          return;
        }

        // 2. Wyślij bezpieczny link rejestracyjny / aktywacyjny
        const callbackUrl = `${window.location.origin}/${locale}/auth/confirm?next=${encodeURIComponent("/app/ustaw-haslo")}`;
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: callbackUrl,
            shouldCreateUser: true,
          },
        });

        if (otpError) {
          showError(otpError.status === 429 ? t.rateLimit : t.failed);
        } else {
          setSentEmail(email);
          setSent(true);
        }
      } else {
        // Logowanie hasłem
        const password = String(fields.get("password") ?? "");
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) {
          showError(result.error.status === 429 ? t.rateLimit : t.credentials);
        } else if (result.data.session) {
          router.replace(returnTo && returnTo.startsWith("/") ? returnTo : "/app");
          router.refresh();
        }
      }
    } catch {
      showError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const callbackUrl = returnTo && returnTo.startsWith("/")
        ? `${window.location.origin}/${locale}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`
        : `${window.location.origin}/${locale}/auth/callback`;
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url) {
        showError(t.failed);
        setBusy(false);
      } else {
        window.location.assign(data.url);
      }
    } catch {
      showError(t.failed);
      setBusy(false);
    }
  }

  return (
    <div className="auth-content">
      <nav className="auth-mode-switch" aria-label={d.modes}>
        <Link href={`/login${returnToSuffix}`} aria-current={!register ? "page" : undefined}>
          {t.login}
        </Link>
        <Link href={`/register${returnToSuffix}`} aria-current={register ? "page" : undefined}>
          {t.register}
        </Link>
      </nav>

      <div className="auth-form-heading">
        <h1>{sent ? t.checkEmail : register ? t.register : d.welcome}</h1>
        <p>
          {sent
            ? pl
              ? `Wysłaliśmy link aktywacyjny na adres ${sentEmail}. Otwórz go w swojej skrzynce (sprawdź też folder spam), aby ustalić hasło i wejść do aplikacji.`
              : `We sent an activation link to ${sentEmail}. Open it in your inbox (check spam folder too) to set your password and access the app.`
            : register
              ? pl
                ? "Podaj adres e-mail, aby otrzymać bezpieczny link rejestracyjny do pilotażu."
                : "Enter your email to receive a secure pilot registration link."
              : d.loginIntro}
        </p>
      </div>

      {!configured ? <p role="status">{t.unavailable}</p> : null}
      {error ? (
        <div
          className={`auth-message auth-alert ${
            error === t.pilotRestricted
              ? "is-pilot"
              : error === t.alreadyRegistered
                ? "is-info"
                : "is-error"
          }`}
          role="alert"
          tabIndex={-1}
          ref={messageRef}
        >
          <div className="auth-alert-icon" aria-hidden="true">
            {error === t.pilotRestricted ? (
              <IconShieldLock size={22} />
            ) : error === t.alreadyRegistered ? (
              <IconInfoCircle size={22} />
            ) : (
              <IconAlertCircle size={22} />
            )}
          </div>
          <div className="auth-alert-body">
            {error === t.pilotRestricted ? (
              <>
                <strong>
                  {pl
                    ? "Zamknięty pilotaż — dostęp na zaproszenie"
                    : "Closed Pilot — Invite Only"}
                </strong>
                <p>{error}</p>
                <a
                  href="mailto:caremypet9173@gmail.com?subject=CareMyPet%20-%20Pro%C5%9Bba%20o%20dost%C4%99p%20do%20pilota%C5%BCu"
                  className="auth-alert-action"
                >
                  {pl
                    ? "Napisz do nas, aby dołączyć do testów →"
                    : "Contact us to join the pilot →"}
                </a>
              </>
            ) : error === t.alreadyRegistered ? (
              <>
                <strong>{pl ? "To konto już istnieje" : "Account already exists"}</strong>
                <p>{error}</p>
                <Link
                  href={`/login${returnToSuffix}`}
                  className="auth-alert-action"
                >
                  {pl ? "Przejdź do logowania →" : "Go to sign in →"}
                </Link>
              </>
            ) : (
              <>
                <strong>{pl ? "Nie udało się wykonać akcji" : "Action failed"}</strong>
                <p>{error}</p>
              </>
            )}
          </div>
        </div>
      ) : null}

      {!sent ? (
        <>
          <div className="auth-social">
            <Button variant="secondary" onClick={google} disabled={!configured || busy}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              {t.google}
            </Button>
            <Button className="auth-apple" disabled aria-describedby="apple-unavailable">
              <IconBrandApple size={18} aria-hidden="true" />
              {d.apple}
            </Button>
            <small id="apple-unavailable">{d.unavailable}</small>
          </div>

          <p className="auth-divider">{t.or}</p>

          <form onSubmit={submit} className="auth-form">
            <label htmlFor="email">{t.email}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              disabled={busy}
              placeholder={pl ? "np. twoj.email@gmail.com" : "e.g. your.email@example.com"}
            />

            {!register && (
              <>
                <label htmlFor="password">{t.password}</label>
                <div className="auth-password">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    minLength={1}
                    maxLength={128}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? d.hide : d.show}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <IconEyeOff size={18} aria-hidden="true" /> : <IconEye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </>
            )}

            <Button type="submit" loading={busy} disabled={!configured}>
              {register ? t.pilotSendLink : t.login}
              <IconArrowRight size={16} aria-hidden="true" />
            </Button>
          </form>

          <p className="auth-legal">
            {t.legal} <Link href="/regulamin">{t.terms}</Link> {t.and} <Link href="/prywatnosc">{t.privacy}</Link>.
          </p>
        </>
      ) : null}

      <p>
        {register ? t.hasAccount : t.noAccount}{" "}
        <Link href={register ? `/login${returnToSuffix}` : `/register${returnToSuffix}`}>
          {register ? t.login : t.register}
        </Link>
      </p>
      {!register && (
        <p className="auth-recovery-link">
          <Link href="/odzyskaj">
            {locale === "pl"
              ? "Utracono dostęp do konta lub e-maila? Odzyskaj domostwo kluczem →"
              : "Lost access to account or email? Recover household with key →"}
          </Link>
        </p>
      )}
    </div>
  );
}
