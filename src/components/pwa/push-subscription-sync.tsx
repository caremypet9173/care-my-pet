"use client";

import { useEffect } from "react";
import { syncExistingPushSubscription } from "@/features/schedule/push-subscription";

export function PushSubscriptionSync({
  householdId,
}: {
  householdId: string | null;
}) {
  useEffect(() => {
    void syncExistingPushSubscription(householdId);

    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const handleSwMessage = (event: MessageEvent) => {
      const payload = event.data as
        | { type?: unknown; oldEndpoint?: unknown }
        | null
        | undefined;
      if (payload?.type !== "CMP_PUSH_SUBSCRIPTION_CHANGED") {
        return;
      }
      const oldEndpoint =
        typeof payload.oldEndpoint === "string" ? payload.oldEndpoint : null;
      void syncExistingPushSubscription(householdId, {
        force: true,
        oldEndpoint,
      });
    };

    navigator.serviceWorker.addEventListener("message", handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, [householdId]);

  return null;
}
