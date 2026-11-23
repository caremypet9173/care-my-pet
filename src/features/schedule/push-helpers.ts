export interface PushEnvironment {
  isStandalone: boolean;
  isAndroid: boolean;
  isIos: boolean;
}

export interface PushSyncState {
  endpoint: string;
  fingerprint: string;
  householdId: string | null;
  syncedAt: number;
}

export interface PushGuidance {
  kind: "info" | "warning";
  text: string;
}

export const PUSH_SYNC_STORAGE_KEY = "caremypet_push_sync_v1";
export const PUSH_SYNC_TTL_MS = 24 * 60 * 60 * 1000;

export function detectPushEnvironment(input?: {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  isStandalone?: boolean;
}): PushEnvironment {
  if (input) {
    const ua = input.userAgent ?? "";
    const platform = input.platform ?? "";
    const maxTouchPoints = input.maxTouchPoints ?? 0;
    const isAndroid = /android/i.test(ua);
    const isIos =
      !isAndroid &&
      (/iphone|ipad|ipod/i.test(ua) ||
        (platform === "MacIntel" && maxTouchPoints > 1));
    return {
      isStandalone: Boolean(input.isStandalone),
      isAndroid,
      isIos,
    };
  }

  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { isStandalone: false, isAndroid: false, isIos: false };
  }

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isAndroid = /android/i.test(ua);
  const isIos =
    !isAndroid &&
    (/iphone|ipad|ipod/i.test(ua) ||
      (platform === "MacIntel" && maxTouchPoints > 1));
  const isStandalone =
    Boolean(window.matchMedia?.("(display-mode: standalone)")?.matches) ||
    Boolean((navigator as { standalone?: boolean }).standalone);

  return { isStandalone, isAndroid, isIos };
}

export function buildPushFingerprint(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  householdId: string | null;
}): string {
  return `${input.endpoint}|${input.p256dh}|${input.auth}|${input.householdId ?? ""}`;
}

export function parsePushSyncState(raw: string | null): PushSyncState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PushSyncState> | null;
    if (
      !parsed ||
      typeof parsed.endpoint !== "string" ||
      !parsed.endpoint ||
      typeof parsed.fingerprint !== "string" ||
      !parsed.fingerprint ||
      typeof parsed.syncedAt !== "number" ||
      !Number.isFinite(parsed.syncedAt)
    ) {
      return null;
    }
    return {
      endpoint: parsed.endpoint,
      fingerprint: parsed.fingerprint,
      householdId:
        typeof parsed.householdId === "string" && parsed.householdId
          ? parsed.householdId
          : null,
      syncedAt: parsed.syncedAt,
    };
  } catch {
    return null;
  }
}

export function shouldSyncPushSubscription(input: {
  prev: PushSyncState | null;
  nextEndpoint: string;
  nextFingerprint: string;
  nowMs: number;
  force?: boolean;
}): { shouldSync: boolean; staleEndpoint: string | null } {
  const { prev, nextEndpoint, nextFingerprint, nowMs, force = false } = input;
  const staleEndpoint =
    prev?.endpoint && prev.endpoint !== nextEndpoint ? prev.endpoint : null;

  if (force || !prev) {
    return { shouldSync: true, staleEndpoint };
  }
  if (prev.fingerprint !== nextFingerprint) {
    return { shouldSync: true, staleEndpoint };
  }
  if (nowMs - prev.syncedAt >= PUSH_SYNC_TTL_MS) {
    return { shouldSync: true, staleEndpoint };
  }
  return { shouldSync: false, staleEndpoint: null };
}

export function getPushGuidance(input: {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  env: PushEnvironment;
  locale: "pl" | "en";
}): PushGuidance | null {
  const { supported, permission, subscribed, env, locale } = input;
  const pl = locale === "pl";

  if (!supported) {
    if (env.isIos && !env.isStandalone) {
      return {
        kind: "info",
        text: pl
          ? "Na iPhonie/iPadzie powiadomienia Push działają po dodaniu aplikacji do ekranu początkowego: w Safari kliknij Udostępnij → Do ekranu początkowego, a potem otwórz Care My Pet z nowej ikony."
          : "On iPhone/iPad, Push notifications work after installing to your Home Screen: in Safari tap Share → Add to Home Screen, then open Care My Pet from the new icon.",
      };
    }
    return null;
  }

  if (permission === "denied") {
    if (env.isAndroid && env.isStandalone) {
      return {
        kind: "warning",
        text: pl
          ? "Powiadomienia są wyłączone w ustawieniach aplikacji na telefonie. Przytrzymaj ikonę Care My Pet na ekranie głównym → Informacje o aplikacji → Powiadomienia → włącz, a następnie wróć tutaj (status odświeży się automatycznie)."
          : "Notifications are disabled in Android app settings. Long-press the Care My Pet icon on your Home Screen → App info → Notifications → enable, then return here (status refreshes automatically).",
      };
    }
    if (env.isAndroid) {
      return {
        kind: "warning",
        text: pl
          ? "Powiadomienia są zablokowane. W Chrome kliknij ikonę ustawień obok adresu strony → Uprawnienia → Powiadomienia → Zezwalaj (jeśli masz zainstalowaną aplikację Care My Pet, włącz je w Informacjach o aplikacji → Powiadomienia)."
          : "Notifications are blocked. In Chrome tap the site settings icon next to the address bar → Permissions → Notifications → Allow (if Care My Pet is installed as an app, enable them in App info → Notifications).",
      };
    }
    if (env.isIos && env.isStandalone) {
      return {
        kind: "warning",
        text: pl
          ? "Powiadomienia są wyłączone w systemie iOS. Otwórz Ustawienia → Powiadomienia → Care My Pet, zezwól na powiadomienia i wróć tutaj."
          : "Notifications are disabled in iOS Settings. Open Settings → Notifications → Care My Pet, allow notifications, and return here.",
      };
    }
    return {
      kind: "warning",
      text: pl
        ? "Powiadomienia są zablokowane w przeglądarce. Kliknij ikonę ustawień obok adresu strony → Powiadomienia → Zezwalaj, a potem wróć lub odśwież stronę."
        : "Notifications are blocked in your browser. Click the site settings icon next to the address bar → Notifications → Allow, then return or reload.",
    };
  }

  if (subscribed) {
    if (env.isAndroid) {
      return {
        kind: "info",
        text: pl
          ? "Wskazówka (Android): aby telefon nie uśpił powiadomień przy dłuższych przerwach między wizytami, przytrzymaj ikonę aplikacji → Informacje o aplikacji → wyłącz „Wstrzymaj aktywność aplikacji, jeśli jest nieużywana” (i ustaw Bateria → Nieograniczone). Kliknij „Wyślij testowy Push” i zablokuj ekran, aby sprawdzić działanie."
          : "Android tip: to prevent your phone from pausing notifications between infrequent visits, long-press the app icon → App info → disable “Pause app activity if unused” (and set Battery → Unrestricted). Tap “Send test Push” and lock your screen to verify delivery.",
      };
    }
    return {
      kind: "info",
      text: pl
        ? "Wskazówka: kliknij „Wyślij testowy Push” (na telefonie przy zablokowanym ekranie), aby zweryfikować dostarczanie. Dla terminów odległych o kilka miesięcy warto zostawić też aktywne przypomnienia e-mail poniżej."
        : "Tip: tap “Send test Push” (with your phone screen locked) to verify delivery. For dates several months away, keeping email reminders enabled below is recommended as a backup.",
    };
  }

  return null;
}
