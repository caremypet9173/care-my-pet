"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { IconDeviceMobile, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaProvider() {
  const locale = useLocale();
  const pl = locale === "pl";

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    let attachedLoadListener = false;
    const registerSw = () => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });
    };

    // 1. Register Service Worker (browser handles update checks via /sw.js Cache-Control)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (document.readyState === "complete") {
        registerSw();
      } else {
        attachedLoadListener = true;
        window.addEventListener("load", registerSw, { once: true });
      }
    }

    const cleanupLoad = () => {
      if (attachedLoadListener) {
        window.removeEventListener("load", registerSw);
      }
    };

    // 2. Check if already installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);

    if (isStandalone) {
      return cleanupLoad;
    }

    // Check dismissal cookie/timestamp
    try {
      const dismissedAt = localStorage.getItem("caremypet_pwa_dismissed");
      if (dismissedAt) {
        const pastDays = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (pastDays < 7) {
          return cleanupLoad; // Don't show if dismissed within past 7 days
        }
      }
    } catch {
      // Ignore blocked browser storage (e.g. strict Safari Private / WebView)
    }

    // 3. Listen for BeforeInstallPrompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      cleanupLoad();
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    setShowBanner(false);
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem("caremypet_pwa_dismissed", String(Date.now()));
    } catch {
      // Ignore storage errors
    }
  };

  if (!showBanner || !installPrompt) {
    return null;
  }

  return (
    <aside
      aria-label={pl ? "Instalacja aplikacji" : "App installation"}
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1rem",
        zIndex: 9998,
        display: "flex",
        alignItems: "center",
        gap: "0.875rem",
        padding: "0.75rem 1rem",
        borderRadius: "var(--radius-panel)",
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-floating)",
        maxWidth: "min(26rem, calc(100vw - 2rem))",
        fontSize: "0.8125rem",
      }}
    >
      <div
        style={{
          width: "2.5rem",
          height: "2.5rem",
          borderRadius: "0.75rem",
          backgroundColor: "var(--color-success-surface)",
          color: "var(--color-primary)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <IconDeviceMobile size={22} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", color: "var(--color-text)", fontSize: "0.875rem" }}>
          {pl ? "Zainstaluj Care My Pet" : "Install Care My Pet"}
        </strong>
        <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
          {pl
            ? "Szybki dostęp z ekranu telefonu i tryb offline."
            : "Fast home screen access and offline view."}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <Button size="sm" variant="primary" onClick={handleInstallClick}>
          {pl ? "Zainstaluj" : "Install"}
        </Button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={pl ? "Zamknij" : "Close"}
          style={{
            background: "transparent",
            border: 0,
            cursor: "pointer",
            color: "var(--color-text-muted)",
            padding: "0.25rem",
            display: "grid",
            placeItems: "center",
          }}
        >
          <IconX size={16} />
        </button>
      </div>
    </aside>
  );
}
