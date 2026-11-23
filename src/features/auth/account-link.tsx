"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getSupabaseConfig } from "@/lib/supabase/config";

function hasSupabaseAuthCookie(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)sb-[^=;]+-auth-token/.test(document.cookie);
}

export function AccountLink({ initialSignedIn = false, className, labelClassName, onClick, children }: {
  initialSignedIn?: boolean;
  className?: string;
  labelClassName?: string;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations("copy");
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  useEffect(() => {
    if (!getSupabaseConfig()) return;
    // Avoid loading the full ~237 KB Supabase SDK on public pages for anonymous visitors.
    if (!initialSignedIn && !hasSupabaseAuthCookie()) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void import("@/lib/supabase/client").then(({ createClient }) => {
      if (cancelled) return;
      const { data } = createClient().auth.onAuthStateChange((_event, session) => {
        setSignedIn(Boolean(session));
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [initialSignedIn]);
  return <Link href={signedIn ? "/app" : "/login"} className={className} onClick={onClick}>
    <span className={labelClassName}>{t(signedIn ? "myAccount" : "signIn100")}</span>
    {children}
  </Link>;
}
