"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";

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
    // Navigation only: private data access remains verified on the server.
    // INITIAL_SESSION and later events keep public pages and sign-out in sync.
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return <Link href={signedIn ? "/app" : "/login"} className={className} onClick={onClick}>
    <span className={labelClassName}>{t(signedIn ? "myAccount" : "signIn100")}</span>
    {children}
  </Link>;
}
