"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeMedicationSchedule } from "./projection";
import type { MedicationLog, MedicationSchedule } from "./types";

export type MedicationLogRealtimeEvent =
  | { type: "UPSERT"; log: MedicationLog }
  | { type: "DELETE"; id: string };

export type MedicationScheduleRealtimeEvent =
  | { type: "INSERT"; schedule: MedicationSchedule }
  | { type: "UPDATE"; schedule: MedicationSchedule }
  | { type: "DELETE"; id: string };

type Subscriber = {
  onLog?: (event: MedicationLogRealtimeEvent) => void;
  onSchedule?: (event: MedicationScheduleRealtimeEvent) => void;
  refresh: () => void;
};

type ScopeEntry = {
  subscribers: Set<Subscriber>;
  cleanupChannel: () => void;
};

const scopeRegistry = new Map<string, ScopeEntry>();

const REFRESH_DEBOUNCE_MS = 400;
const FOCUS_REFRESH_COOLDOWN_MS = 30_000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let lastFocusRefreshAt = 0;
let visibilityListenersAttached = false;

function scheduleSharedRefresh() {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    for (const entry of scopeRegistry.values()) {
      for (const sub of entry.subscribers) {
        sub.refresh();
        return; // One router.refresh() refreshes the entire Next.js route tree
      }
    }
  }, REFRESH_DEBOUNCE_MS);
}

function handleVisibilityOrFocus() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return;
  }
  const now = Date.now();
  if (now - lastFocusRefreshAt < FOCUS_REFRESH_COOLDOWN_MS) {
    return;
  }
  lastFocusRefreshAt = now;
  scheduleSharedRefresh();
}

function syncVisibilityListeners() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const hasSubscribers = scopeRegistry.size > 0;
  if (hasSubscribers && !visibilityListenersAttached) {
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    visibilityListenersAttached = true;
  } else if (!hasSubscribers && visibilityListenersAttached) {
    document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    window.removeEventListener("focus", handleVisibilityOrFocus);
    visibilityListenersAttached = false;
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }
}

function ensureScopeChannel(scopeKey: string, petId?: string): ScopeEntry {
  const existing = scopeRegistry.get(scopeKey);
  if (existing) return existing;

  const subscribers = new Set<Subscriber>();
  let cancelled = false;
  const client = createClient();
  let channel: ReturnType<typeof client.channel> | null = null;

  async function init() {
    try {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (session?.access_token) {
        await client.realtime.setAuth(session.access_token);
      }
    } catch (err) {
      console.warn("[Realtime meds] auth initialization warning:", err);
    }

    if (cancelled) return;

    const petFilter = petId ? `pet_id=eq.${petId}` : undefined;
    channel = client
      .channel(`realtime-meds-shared-${petId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_logs",
          ...(petFilter ? { filter: petFilter } : {}),
        },
        (payload: {
          eventType: string;
          new: Record<string, unknown>;
          old: Record<string, unknown>;
        }) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const log = payload.new as unknown as MedicationLog;
            for (const sub of subscribers) {
              sub.onLog?.({ type: "UPSERT", log });
            }
            scheduleSharedRefresh();
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string })?.id;
            if (deletedId) {
              for (const sub of subscribers) {
                sub.onLog?.({ type: "DELETE", id: deletedId });
              }
              scheduleSharedRefresh();
            }
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_schedules",
          ...(petFilter ? { filter: petFilter } : {}),
        },
        (payload: {
          eventType: string;
          new: Record<string, unknown>;
          old: Record<string, unknown>;
        }) => {
          if (payload.eventType === "INSERT") {
            const schedule = normalizeMedicationSchedule(
              payload.new as unknown as MedicationSchedule,
            );
            for (const sub of subscribers) {
              sub.onSchedule?.({ type: "INSERT", schedule });
            }
            scheduleSharedRefresh();
          } else if (payload.eventType === "UPDATE") {
            const schedule = normalizeMedicationSchedule(
              payload.new as unknown as MedicationSchedule,
            );
            for (const sub of subscribers) {
              sub.onSchedule?.({ type: "UPDATE", schedule });
            }
            scheduleSharedRefresh();
          } else if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string })?.id;
            if (deletedId) {
              for (const sub of subscribers) {
                sub.onSchedule?.({ type: "DELETE", id: deletedId });
              }
              scheduleSharedRefresh();
            }
          }
        },
      )
      .subscribe((status: string, err?: Error) => {
        if (process.env.NODE_ENV !== "production") {
          if (status === "SUBSCRIBED") {
            console.log(`[Realtime shared] Subscribed for ${scopeKey}`);
          } else if (status === "CHANNEL_ERROR") {
            console.error(`[Realtime shared] Channel error for ${scopeKey}:`, err);
          }
        }
      });
  }

  void init();

  const entry: ScopeEntry = {
    subscribers,
    cleanupChannel: () => {
      cancelled = true;
      if (channel) {
        void client.removeChannel(channel);
        channel = null;
      }
    },
  };
  scopeRegistry.set(scopeKey, entry);
  syncVisibilityListeners();
  return entry;
}

/**
 * Shared Realtime subscription & visibility refresh hook for medication_logs
 * and medication_schedules. Multiple components mounted for the same petId
 * share a single Supabase Realtime channel, a single debounced router.refresh(),
 * and a 30s focus/visibility refresh cooldown.
 */
export function useMedicationRealtime(options: {
  petId?: string;
  onLog?: (event: MedicationLogRealtimeEvent) => void;
  onSchedule?: (event: MedicationScheduleRealtimeEvent) => void;
}) {
  const router = useRouter();
  const onLogRef = useRef(options.onLog);
  const onScheduleRef = useRef(options.onSchedule);
  const routerRef = useRef(router);

  useEffect(() => {
    onLogRef.current = options.onLog;
    onScheduleRef.current = options.onSchedule;
    routerRef.current = router;
  });

  useEffect(() => {
    const scopeKey = options.petId ? `pet:${options.petId}` : "all";
    const entry = ensureScopeChannel(scopeKey, options.petId);
    const subscriber: Subscriber = {
      onLog: (event) => onLogRef.current?.(event),
      onSchedule: (event) => onScheduleRef.current?.(event),
      refresh: () => routerRef.current.refresh(),
    };
    entry.subscribers.add(subscriber);

    return () => {
      entry.subscribers.delete(subscriber);
      if (entry.subscribers.size === 0) {
        entry.cleanupChannel();
        scopeRegistry.delete(scopeKey);
        syncVisibilityListeners();
      }
    };
  }, [options.petId]);
}
