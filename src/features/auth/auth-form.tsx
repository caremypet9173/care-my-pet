"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { authMessages } from "./messages";

export function AuthForm({ mode, configured, initialError }: {
  mode: "login" | "register"; configured: boolean; initialError?: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = authMessages[locale];
  const register = mode === "register";
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(initialError === "callback" ? t.callback : initialError === "confirmation" ? t.confirmation : "");
  const messageRef = useRef<HTMLParagraphElement>(null);
  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => messageRef.current?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const email = String(fields.get("email") ?? "").trim();
    const password = String(fields.get("password") ?? "");
    if (register && password !== fields.get("repeat")) return showError(t.mismatch);
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const result = register
        ? await supabase.auth.signUp({ email, password, options: {
          emailRedirectTo: `${window.location.origin}/${locale}/auth/confirm`,
        } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) {
        showError(result.error.status === 429 ? t.rateLimit : register ? t.failed : t.credentials);
      } else if (result.data.session) {
        router.replace("/app");
        router.refresh();
      } else {
        form.reset();
        setSent(true);
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
      const { data, error } = await createClient().auth.signInWithOAuth({
        provider: "google", options: {
          redirectTo: `${window.location.origin}/${locale}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url) { showError(t.failed); setBusy(false); }
      else window.location.assign(data.url);
    } catch { showError(t.failed); setBusy(false); }
  }
  return <div className="auth-content">
    <h1>{sent ? t.checkEmail : t[mode]}</h1>
    <p>{sent ? t.sent : t.intro}</p>
    {!configured ? <p role="status">{t.unavailable}</p> : null}
    {error ? <p className="auth-message" role="alert" tabIndex={-1} ref={messageRef}>{error}</p> : null}
    {!sent ? <>
      <Button variant="secondary" onClick={google} disabled={!configured || busy}>{t.google}</Button>
      <p className="auth-divider">{t.or}</p>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="email">{t.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy} />
        <label htmlFor="password">{t.password}</label>
        <input id="password" name="password" type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 12 : 1} maxLength={128} aria-describedby={register ? "password-hint" : undefined} disabled={busy} />
        {register ? <>
          <small id="password-hint">{t.hint}</small>
          <label htmlFor="repeat">{t.repeat}</label>
          <input id="repeat" name="repeat" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} />
        </> : null}
        <Button type="submit" loading={busy} disabled={!configured}>{t[mode]}</Button>
      </form>
      <p className="auth-legal">{t.legal} <Link href="/regulamin">{t.terms}</Link> {t.and} <Link href="/prywatnosc">{t.privacy}</Link>.</p>
    </> : null}
    <p>{register ? t.hasAccount : t.noAccount} <Link href={register ? "/login" : "/register"}>{register ? t.login : t.register}</Link></p>
  </div>;
}
