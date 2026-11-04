import { createClient } from "@/lib/supabase/client";

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

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  endpoint?: string;
}

export async function getDevicePushStatus(): Promise<PushStatus> {
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
    };
  } catch {
    return {
      supported: true,
      permission,
      subscribed: false,
    };
  }
}

export async function subscribeToPush(householdId?: string | null): Promise<{ ok: boolean; error?: string }> {
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "unauthenticated" };
    }

    let targetHouseholdId = householdId ?? null;
    if (!targetHouseholdId) {
      const { data: member } = await supabase
        .from("household_member")
        .select("household_id")
        .limit(1)
        .maybeSingle();
      targetHouseholdId = member?.household_id ?? null;
    }

    const { error: dbError } = await supabase.from("pet_push_subscription").upsert(
      {
        user_id: user.id,
        household_id: targetHouseholdId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent.slice(0, 300),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "user_id,endpoint" }
    );

    if (dbError) {
      console.error("[PWA Push] Failed to save subscription in Supabase:", dbError);
      return { ok: false, error: dbError.message };
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

export async function unsubscribeFromPush(): Promise<{ ok: boolean; error?: string }> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();

    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();

      const supabase = createClient();
      await supabase
        .from("pet_push_subscription")
        .delete()
        .eq("endpoint", endpoint);
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unsubscribe_failed",
    };
  }
}
