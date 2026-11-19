"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { authMessages } from "./messages";
import { useRouter } from "@/i18n/navigation";

async function clearClientSessionCaches() {
  try {
    const secureFlag =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `care_active_household_id=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
  } catch {
    // Ignore cookie errors in restricted environments
  }

  try {
    if (typeof window !== "undefined" && "caches" in window) {
      const names = await window.caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("caremypet-public-") ||
              name.startsWith("caremypet-v"),
          )
          .map((name) => window.caches.delete(name)),
      );
    }
  } catch {
    // Ignore Cache Storage errors in private/restricted browsers
  }
}

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
      await clearClientSessionCaches();
      router.replace("/login");
      router.refresh();
    } catch { setError(true); setBusy(false); }
  }
  return <><Button onClick={signOut} loading={busy}>{t.signOut}</Button>{error ? <p role="alert">{t.failed}</p> : null}</>;
}
