import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import {
  PUSH_SYNC_STORAGE_KEY,
  buildPushFingerprint,
  detectPushEnvironment,
  parsePushSyncState,
  shouldSyncPushSubscription,
  type PushEnvironment,
  type PushSyncState,
} from "./push-helpers";

export { detectPushEnvironment, getPushGuidance, type PushEnvironment, type PushGuidance } from "./push-helpers";

function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function readSyncState(): PushSyncState | null {
  try {
    return parsePushSyncState(window.localStorage.getItem(PUSH_SYNC_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeSyncState(state: PushSyncState): void {
  try {
    window.localStorage.setItem(PUSH_SYNC_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors (e.g. strict Safari Private / WebView)
  }
}

function clearSyncState(): void {
  try {
    window.localStorage.removeItem(PUSH_SYNC_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  endpoint?: string;
  env: PushEnvironment;
}

export async function getDevicePushStatus(): Promise<PushStatus> {
  const env = detectPushEnvironment();
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return {
      supported: false,
      permission: "default",
      subscribed: false,
      env,
    };
  }

  const permission = Notification.permission;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return {
      supported: true,
      permission,
      subscribed: Boolean(sub),
      endpoint: sub?.endpoint,
      env,
    };
  } catch {
    return {
      supported: true,
      permission,
      subscribed: false,
      env,
    };
  }
}

export async function subscribeToPush(
  householdId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const status = await getDevicePushStatus();
  if (!status.supported) {
    return { ok: false, error: "not_supported" };
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    return { ok: false, error: "missing_vapid_key" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, error: "permission_denied" };
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
      });
    }

    const subJson = sub.toJSON();
    const endpoint = subJson.endpoint;
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return { ok: false, error: "invalid_subscription_keys" };
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "unauthenticated" };
    }

    const prevSync = readSyncState();
    const { data, error: fnError } = await supabase.functions.invoke(
      "schedule-notifications",
      {
        body: {
          action: "register_push",
          household_id: householdId ?? null,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 300),
        },
      },
    );

    if (fnError || !data?.ok) {
      console.error("[PWA Push] Failed to save subscription via Edge Function:", fnError ?? data);
      return { ok: false, error: fnError?.message || data?.error || "save_failed" };
    }

    const effectiveHouseholdId =
      typeof data.household_id === "string" ? data.household_id : (householdId ?? null);
    writeSyncState({
      endpoint,
      fingerprint: buildPushFingerprint({
        endpoint,
        p256dh,
        auth,
        householdId: effectiveHouseholdId,
      }),
      householdId: effectiveHouseholdId,
      syncedAt: Date.now(),
    });

    if (prevSync?.endpoint && prevSync.endpoint !== endpoint) {
      await supabase.functions
        .invoke("schedule-notifications", {
          body: { action: "unregister_push", endpoint: prevSync.endpoint },
        })
        .catch(() => undefined);
    }

    return { ok: true };
  } catch (err) {
    console.error("[PWA Push] Subscription error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown_error",
    };
  }
}

export async function syncExistingPushSubscription(
  activeHouseholdId?: string | null,
  options?: { force?: boolean; oldEndpoint?: string | null },
): Promise<{ synced: boolean }> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return { synced: false };
  }

  if (!getSupabaseConfig()) {
    return { synced: false };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      return { synced: false };
    }

    const subJson = sub.toJSON();
    const endpoint = subJson.endpoint;
    const p256dh = subJson.keys?.p256dh;
    const auth = subJson.keys?.auth;
    if (!endpoint || !p256dh || !auth) {
      return { synced: false };
    }

    const prev = readSyncState();
    const targetHouseholdId = prev?.householdId ?? activeHouseholdId ?? null;
    const fingerprint = buildPushFingerprint({
      endpoint,
      p256dh,
      auth,
      householdId: targetHouseholdId,
    });

    const { shouldSync, staleEndpoint } = shouldSyncPushSubscription({
      prev,
      nextEndpoint: endpoint,
      nextFingerprint: fingerprint,
      nowMs: Date.now(),
      force: options?.force,
    });

    if (!shouldSync) {
      return { synced: false };
    }

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user || session.user.is_anonymous) {
      return { synced: false };
    }

    const { data, error: fnError } = await supabase.functions.invoke(
      "schedule-notifications",
      {
        body: {
          action: "register_push",
          household_id: targetHouseholdId,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 300),
        },
      },
    );

    if (fnError || !data?.ok) {
      return { synced: false };
    }

    const effectiveHouseholdId =
      typeof data.household_id === "string" ? data.household_id : targetHouseholdId;
    writeSyncState({
      endpoint,
      fingerprint: buildPushFingerprint({
        endpoint,
        p256dh,
        auth,
        householdId: effectiveHouseholdId,
      }),
      householdId: effectiveHouseholdId,
      syncedAt: Date.now(),
    });

    const endpointToRemove =
      options?.oldEndpoint && options.oldEndpoint !== endpoint
        ? options.oldEndpoint
        : staleEndpoint;

    if (endpointToRemove) {
      await supabase.functions
        .invoke("schedule-notifications", {
          body: { action: "unregister_push", endpoint: endpointToRemove },
        })
        .catch(() => undefined);
    }

    return { synced: true };
  } catch {
    return { synced: false };
  }
}

export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      const supabase = createClient();
      await supabase.functions.invoke("schedule-notifications", {
        body: {
          action: "unregister_push",
          endpoint,
        },
      });
    }

    clearSyncState();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unsubscribe_failed",
    };
  }
}
