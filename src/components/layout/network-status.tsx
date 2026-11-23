"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { IconWifi, IconWifiOff } from "@tabler/icons-react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  return true;
}

export function NetworkStatus() {
  const locale = useLocale();
  const pl = locale === "pl";
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isOffline = !isOnline;

  const [showRestored, setShowRestored] = useState(false);
  const prevOnline = useRef(true);

  useEffect(() => {
    if (!prevOnline.current && isOnline) {
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3500);
      return () => clearTimeout(timer);
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  if (!isOffline && !showRestored) {
    return null;
  }

  const isWarning = isOffline;

  return (
    <div
      role={isWarning ? "alert" : "status"}
      aria-live={isWarning ? "assertive" : "polite"}
      style={{
        position: "fixed",
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "inline-flex",
        alignItems: "center",
        gap: "0.625rem",
        padding: "0.625rem 1.125rem",
        borderRadius: "9999px",
        fontSize: "0.8125rem",
        fontWeight: 600,
        boxShadow: "var(--shadow-floating)",
        backgroundColor: isWarning
          ? "var(--color-danger-surface)"
          : "var(--color-success-surface)",
        border: `1px solid ${
          isWarning
            ? "var(--color-danger-border)"
            : "var(--color-success-border)"
        }`,
        color: isWarning ? "var(--color-danger)" : "var(--color-success)",
        transition: "all 0.25s ease-in-out",
        maxWidth: "calc(100vw - 2rem)",
        textAlign: "center",
      }}
    >
      {isWarning ? (
        <>
          <IconWifiOff size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>
            {pl
              ? "Brak połączenia z siecią. Zmiany mogą nie zostać zapisane."
              : "No internet connection. Changes may not be saved."}
          </span>
        </>
      ) : (
        <>
          <IconWifi size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>{pl ? "Połączenie przywrócone" : "Connection restored"}</span>
        </>
      )}
    </div>
  );
}
