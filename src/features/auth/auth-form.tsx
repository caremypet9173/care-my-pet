"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { authMessages } from "./messages";
import { authDesignMessages } from "./design-messages";
import { IconBrandApple, IconEye, IconEyeOff, IconArrowRight } from "@tabler/icons-react";

export function AuthForm({ mode, configured, initialError }: {
  mode: "login" | "register"; configured: boolean; initialError?: string;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = authMessages[locale];
  const d = authDesignMessages[locale];
  const [showPassword, setShowPassword] = useState(false);
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
    <nav className="auth-mode-switch" aria-label={d.modes}><Link href="/login" aria-current={!register ? "page" : undefined}>{t.login}</Link><Link href="/register" aria-current={register ? "page" : undefined}>{t.register}</Link></nav>
    <div className="auth-form-heading"><h1>{sent ? t.checkEmail : register ? t.register : d.welcome}</h1>
    <p>{sent ? t.sent : register ? d.registerIntro : d.loginIntro}</p></div>
    {!configured ? <p role="status">{t.unavailable}</p> : null}
    {error ? <p className="auth-message" role="alert" tabIndex={-1} ref={messageRef}>{error}</p> : null}
    {!sent ? <>
      <div className="auth-social"><Button variant="secondary" onClick={google} disabled={!configured || busy}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>{t.google}</Button>
      <Button className="auth-apple" disabled aria-describedby="apple-unavailable"><IconBrandApple size={18} aria-hidden="true" />{d.apple}</Button><small id="apple-unavailable">{d.unavailable}</small></div>
      <p className="auth-divider">{t.or}</p>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="email">{t.email}</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy} />
        <label htmlFor="password">{t.password}</label>
        <div className="auth-password"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} required minLength={register ? 12 : 1} maxLength={128} aria-describedby={register ? "password-hint" : undefined} disabled={busy} /><button type="button" aria-label={showPassword ? d.hide : d.show} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <IconEyeOff size={18} aria-hidden="true" /> : <IconEye size={18} aria-hidden="true" />}</button></div>
        {register ? <>
          <small id="password-hint">{t.hint}</small>
          <label htmlFor="repeat">{t.repeat}</label>
          <input id="repeat" name="repeat" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} />
        </> : null}
        <Button type="submit" loading={busy} disabled={!configured}>{t[mode]}<IconArrowRight size={16} aria-hidden="true" /></Button>
      </form>
      <p className="auth-legal">{t.legal} <Link href="/regulamin">{t.terms}</Link> {t.and} <Link href="/prywatnosc">{t.privacy}</Link>.</p>
    </> : null}
    <p>{register ? t.hasAccount : t.noAccount} <Link href={register ? "/login" : "/register"}>{register ? t.login : t.register}</Link></p>
  </div>;
}
