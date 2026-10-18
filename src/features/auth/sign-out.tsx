"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { authMessages } from "./messages";
import { useRouter } from "@/i18n/navigation";

export function SignOut() {
  const locale = useLocale();
  const router = useRouter();
  const t = authMessages[locale];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function signOut() {
    setBusy(true);
    setError(false);
    try {
      const { error } = await createClient().auth.signOut({ scope: "local" });
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch { setError(true); setBusy(false); }
  }
  return <><Button onClick={signOut} loading={busy}>{t.signOut}</Button>{error ? <p role="alert">{t.failed}</p> : null}</>;
}
