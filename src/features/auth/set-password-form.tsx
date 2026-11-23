"use client";

import { useState, useRef, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { authMessages } from "./messages";
import "@/styles/auth.css";
import {
  IconEye,
  IconEyeOff,
  IconArrowRight,
  IconShieldCheck,
  IconAlertCircle,
} from "@tabler/icons-react";

export function SetPasswordForm() {
  const locale = useLocale();
  const router = useRouter();
  const t = authMessages[locale];
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messageRef = useRef<HTMLDivElement>(null);

  function showError(msg: string) {
    setError(msg);
    requestAnimationFrame(() => messageRef.current?.focus());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 12) {
      showError(t.hint);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        showError(t.failed);
      } else {
        router.replace("/app");
        router.refresh();
      }
    } catch {
      showError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-content set-password-box">
      <div className="auth-form-heading">
        <div style={{ display: "inline-flex", alignItems: "center", gap: ".5rem", marginBottom: ".5rem", color: "#164d34" }}>
          <IconShieldCheck size={28} aria-hidden="true" />
        </div>
        <h1>{t.setPassword}</h1>
        <p>{t.setPasswordIntro}</p>
      </div>

      {error ? (
        <div
          className="auth-message auth-alert is-error"
          role="alert"
          tabIndex={-1}
          ref={messageRef}
        >
          <div className="auth-alert-icon" aria-hidden="true">
            <IconAlertCircle size={22} />
          </div>
          <div className="auth-alert-body">
            <strong>{locale === "pl" ? "Uwaga" : "Notice"}</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <form onSubmit={submit} className="auth-form">
        <label htmlFor="set-password">{t.password}</label>
        <div className="auth-password">
          <input
            id="set-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            aria-describedby="set-password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
          <button
            type="button"
            aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <IconEyeOff size={18} aria-hidden="true" /> : <IconEye size={18} aria-hidden="true" />}
          </button>
        </div>
        <small id="set-password-hint">{t.hint}</small>

        <Button type="submit" loading={busy}>
          {t.savePassword}
          <IconArrowRight size={16} aria-hidden="true" />
        </Button>
      </form>

      <div style={{ marginTop: "1rem", textAlign: "center" }}>
        <button
          type="button"
          onClick={() => {
            router.replace("/app");
            router.refresh();
          }}
          style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: ".8125rem", cursor: "pointer", textDecoration: "underline" }}
        >
          {t.skipPassword} →
        </button>
      </div>
    </div>
  );
}
