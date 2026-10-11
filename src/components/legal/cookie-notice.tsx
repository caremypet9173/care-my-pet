"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

const storageKey = "care-my-pet:cookie-notice:v1";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function isAcknowledged() {
  try {
    return window.localStorage.getItem(storageKey) === "acknowledged";
  } catch {
    return false;
  }
}

export function CookieNotice() {
  const t = useTranslations("copy");
  const acknowledged = useSyncExternalStore(subscribe, isAcknowledged, () => true);
  const [dismissed, setDismissed] = useState(false);

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "acknowledged");
    } catch {
      // Closing still works when browser storage is unavailable.
    }
    setDismissed(true);
  }

  if (acknowledged || dismissed) return null;

  return (
    <aside className="cookie-notice" aria-labelledby="cookie-notice-title">
      <div>
        <h2 id="cookie-notice-title">{t("cookieNoticeTitle")}</h2>
        <p>{t("cookieNoticeBody")}</p>
      </div>
      <div className="cookie-notice-actions">
        <Link href="/prywatnosc#cookies">{t("cookieNoticeDetails")}</Link>
        <Button onClick={dismiss} size="sm">{t("cookieNoticeDismiss")}</Button>
      </div>
    </aside>
  );
}
