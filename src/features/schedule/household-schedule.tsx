"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  IconBan,
  IconBell,
  IconCalendarEvent,
  IconCalendarMonth,
  IconCalendarWeek,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconFlask,
  IconList,
  IconMailForward,
  IconNotes,
  IconPencil,
  IconPill,
  IconPlus,
  IconSearch,
  IconStethoscope,
  IconTrash,
  IconVaccine,
  IconX,
} from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Pet } from "@/features/pets/types";
import type { HealthEvent } from "@/features/history/types";
import type {
  CalendarReportSummary,
  HouseholdNotificationSettings,
  ScheduleItem,
} from "./types";
import dynamic from "next/dynamic";
import type { CompleteTarget } from "./schedule-dialog";

const ScheduleDialog = dynamic(
  () => import("./schedule-dialog").then((m) => m.ScheduleDialog),
  { ssr: false },
);
const ScheduleCompleteDialog = dynamic(
  () => import("./schedule-dialog").then((m) => m.ScheduleCompleteDialog),
  { ssr: false },
);
const MedicationDialog = dynamic(
  () =>
    import("@/features/medications/medication-dialog").then(
      (m) => m.MedicationDialog,
    ),
  { ssr: false },
);
const SkipDoseDialog = dynamic(
  () =>
    import("@/features/medications/skip-dose-dialog").then(
      (m) => m.SkipDoseDialog,
    ),
  { ssr: false },
);
import {
  normalizeMedicationSchedule,
  projectMedicationDoses,
} from "@/features/medications/projection";
import type {
  MedicationLog,
  MedicationSchedule,
  ProjectedMedicationDose,
} from "@/features/medications/types";

import {
  type FilterCategory,
  type ViewMode,
  type DisplayLayout,
  type UnifiedScheduleEntry,
  foldText,
  buildSearchHaystack,
  buildMonthGrid,
} from "./calendar-utils";
import { CalendarMonthView } from "./views/calendar-month-view";
import { CalendarWeekView } from "./views/calendar-week-view";
import { CalendarDayView } from "./views/calendar-day-view";
import { CalendarAgendaView } from "./views/calendar-agenda-view";
import { FutureDoseDialog } from "./future-dose-dialog";

function formatMonthHeading(ym: string, locale: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

export function HouseholdSchedule({
  pets,
  initialScheduleItems,
  initialHealthEvents,
  initialReports = [],
  initialMedicationSchedules = [],
  initialMedicationLogs = [],
  initialNotificationSettings,
  fixedPetId,
  memberNames = {},
  currentUserId,
}: {
  pets: Pick<Pet, "id" | "imie">[];
  initialScheduleItems: ScheduleItem[];
  initialHealthEvents: HealthEvent[];
  initialReports?: CalendarReportSummary[];
  initialMedicationSchedules?: MedicationSchedule[];
  initialMedicationLogs?: MedicationLog[];
  initialNotificationSettings?: HouseholdNotificationSettings;
  fixedPetId?: string;
  memberNames?: Record<string, string>;
  currentUserId?: string;
}) {
  const locale = useLocale();
  const pl = locale === "pl";
  const router = useRouter();

  const todayIso = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Warsaw",
      }).format(new Date()),
    [],
  );

  const [prevScheduleItems, setPrevScheduleItems] =
    useState<ScheduleItem[]>(initialScheduleItems);
  const [scheduleItems, setScheduleItems] =
    useState<ScheduleItem[]>(initialScheduleItems);
  if (initialScheduleItems !== prevScheduleItems) {
    setPrevScheduleItems(initialScheduleItems);
    setScheduleItems(initialScheduleItems);
  }

  const [prevHealthEvents, setPrevHealthEvents] =
    useState<HealthEvent[]>(initialHealthEvents);
  const [healthEvents, setHealthEvents] =
    useState<HealthEvent[]>(initialHealthEvents);
  if (initialHealthEvents !== prevHealthEvents) {
    setPrevHealthEvents(initialHealthEvents);
    setHealthEvents(initialHealthEvents);
  }

  const [reports] = useState<CalendarReportSummary[]>(initialReports);

  const [prevMedicationSchedules, setPrevMedicationSchedules] =
    useState<MedicationSchedule[]>(initialMedicationSchedules);
  const [medicationSchedules, setMedicationSchedules] =
    useState<MedicationSchedule[]>(initialMedicationSchedules);
  if (initialMedicationSchedules !== prevMedicationSchedules) {
    setPrevMedicationSchedules(initialMedicationSchedules);
    setMedicationSchedules(initialMedicationSchedules);
  }

  const [prevMedicationLogs, setPrevMedicationLogs] =
    useState<MedicationLog[]>(initialMedicationLogs);
  const [medicationLogs, setMedicationLogs] =
    useState<MedicationLog[]>(initialMedicationLogs);
  if (initialMedicationLogs !== prevMedicationLogs) {
    setPrevMedicationLogs(initialMedicationLogs);
    setMedicationLogs(initialMedicationLogs);
  }
  const [medicationDialogOpen, setMedicationDialogOpen] = useState(false);
  const [editingMedicationSchedule, setEditingMedicationSchedule] =
    useState<MedicationSchedule | null>(null);
  const [medicationDefaultDate, setMedicationDefaultDate] = useState<
    string | undefined
  >(undefined);
  const [futureDoseNotice, setFutureDoseNotice] =
    useState<ProjectedMedicationDose | null>(null);
  const [skipDoseTarget, setSkipDoseTarget] =
    useState<ProjectedMedicationDose | null>(null);
  const [isSavingSkip, setIsSavingSkip] = useState(false);

  const [displayLayout, setDisplayLayout] = useState<DisplayLayout>("month");
  const [previousLayout, setPreviousLayout] = useState<DisplayLayout>("month");
  const [petFilter, setPetFilter] = useState<string>(fixedPetId ?? "all");
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [expandedNotesKey, setExpandedNotesKey] = useState<string | null>(null);

  const [monthCursor, setMonthCursor] = useState<{
    year: number;
    month: number;
  }>(() => {
    const plannedDates = [
      ...initialScheduleItems
        .filter((it) => it.status === "planned")
        .map((it) => it.scheduled_date),
      ...initialHealthEvents
        .filter((ev) => ev.next_due_date !== null)
        .map((ev) => ev.next_due_date!),
    ].sort();
    const currentYm = todayIso.slice(0, 7);
    const hasCurrentMonth = plannedDates.some((d) => d.startsWith(currentYm));
    const targetIso = hasCurrentMonth
      ? todayIso
      : (plannedDates.find((d) => d >= todayIso) ??
        plannedDates[0] ??
        todayIso);
    const [y, m] = targetIso.split("-").map(Number);
    return { year: y, month: m - 1 };
  });
  const [selectedDayIso, setSelectedDayIso] = useState<string>(() => {
    const plannedDates = [
      ...initialScheduleItems
        .filter((it) => it.status === "planned")
        .map((it) => it.scheduled_date),
      ...initialHealthEvents
        .filter((ev) => ev.next_due_date !== null)
        .map((ev) => ev.next_due_date!),
    ].sort();
    return (
      plannedDates.find((d) => d >= todayIso) ?? plannedDates[0] ?? todayIso
    );
  });
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedKey || displayLayout !== "agenda") return;
    const timer = window.setTimeout(() => {
      const el = document.getElementById(`schedule-entry-${highlightedKey}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const clearTimer = window.setTimeout(() => {
      setHighlightedKey(null);
    }, 3200);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightedKey, displayLayout]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDefaultDate, setDialogDefaultDate] = useState<
    string | undefined
  >(undefined);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [completingTarget, setCompletingTarget] =
    useState<CompleteTarget | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [miniPickerOpen, setMiniPickerOpen] = useState(false);
  const [prevMiniPickerOpen, setPrevMiniPickerOpen] = useState(false);
  const miniPickerRef = useRef<HTMLDivElement>(null);
  const [miniMonthCursor, setMiniMonthCursor] = useState<{
    year: number;
    month: number;
  }>(() => monthCursor);

  if (miniPickerOpen !== prevMiniPickerOpen) {
    setPrevMiniPickerOpen(miniPickerOpen);
    if (miniPickerOpen) {
      setMiniMonthCursor(monthCursor);
    }
  }

  useEffect(() => {
    if (!miniPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        miniPickerRef.current &&
        !miniPickerRef.current.contains(e.target as Node)
      ) {
        setMiniPickerOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMiniPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [miniPickerOpen]);

  // Subskrypcja Supabase Realtime do synchronizacji ewidencji dawek i harmonogramow miedzy domownikami
  useEffect(() => {
    let isCancelled = false;
    const client = createClient();
    let channel: ReturnType<typeof client.channel> | null = null;

    async function initSubscription() {
      try {
        const {
          data: { session },
        } = await client.auth.getSession();
        if (session?.access_token) {
          await client.realtime.setAuth(session.access_token);
        }
      } catch (err) {
        console.warn("[Realtime schedule] auth initialization warning:", err);
      }

      if (isCancelled) return;

      const petFilter = fixedPetId ? `pet_id=eq.${fixedPetId}` : undefined;
      channel = client
        .channel(`realtime-schedule-${fixedPetId || "all"}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "medication_logs",
            ...(petFilter ? { filter: petFilter } : {}),
          },
          (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
            if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
              const incoming = payload.new as unknown as MedicationLog;
              setMedicationLogs((prev) => {
                const filtered = prev.filter(
                  (l) =>
                    l.id !== incoming.id &&
                    !(
                      l.schedule_id === incoming.schedule_id &&
                      l.dose_date === incoming.dose_date &&
                      l.scheduled_time === incoming.scheduled_time
                    ),
                );
                return [incoming, ...filtered];
              });
              router.refresh();
            } else if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as { id?: string })?.id;
              if (deletedId) {
                setMedicationLogs((prev) => prev.filter((l) => l.id !== deletedId));
                router.refresh();
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
          (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
            if (payload.eventType === "INSERT") {
              const incoming = normalizeMedicationSchedule(payload.new as unknown as MedicationSchedule);
              setMedicationSchedules((prev) => {
                if (prev.some((s) => s.id === incoming.id)) {
                  return prev.map((s) => (s.id === incoming.id ? incoming : s));
                }
                return [incoming, ...prev];
              });
              router.refresh();
            } else if (payload.eventType === "UPDATE") {
              const incoming = normalizeMedicationSchedule(payload.new as unknown as MedicationSchedule);
              setMedicationSchedules((prev) =>
                prev.map((s) => (s.id === incoming.id ? incoming : s)),
              );
              router.refresh();
            } else if (payload.eventType === "DELETE") {
              const deletedId = (payload.old as { id?: string })?.id;
              if (deletedId) {
                setMedicationSchedules((prev) =>
                  prev.filter((s) => s.id !== deletedId),
                );
                router.refresh();
              }
            }
          },
        )
        .subscribe((status: string, err?: Error) => {
          if (process.env.NODE_ENV !== "production") {
            if (status === "SUBSCRIBED") {
              console.log(`[Realtime schedule] Subscribed for ${fixedPetId || "all"}`);
            } else if (status === "CHANNEL_ERROR") {
              console.error(`[Realtime schedule] Channel error for ${fixedPetId || "all"}:`, err);
            }
          }
        });
    }

    void initSubscription();

    return () => {
      isCancelled = true;
      if (channel) {
        void client.removeChannel(channel);
      }
    };
  }, [fixedPetId, router]);

  // Automatyczne odświeżenie danych po powrocie do uśpionej karty/odblokowaniu ekranu telefonu
  useEffect(() => {
    function handleVisibility() {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        router.refresh();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [router]);

  const [notifSettings, setNotifSettings] =
    useState<HouseholdNotificationSettings>(() => ({
      email_enabled: initialNotificationSettings?.email_enabled ?? true,
      notify_7_days_before:
        initialNotificationSettings?.notify_7_days_before ?? true,
      notify_1_day_before:
        initialNotificationSettings?.notify_1_day_before ?? true,
      notify_day_of: initialNotificationSettings?.notify_day_of ?? false,
      custom_email: initialNotificationSettings?.custom_email ?? "",
    }));
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifTesting, setNotifTesting] = useState(false);
  const [notifFeedback, setNotifFeedback] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);

  const petMap = useMemo(
    () => new Map(pets.map((p) => [p.id, p.imie])),
    [pets],
  );

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(iso));

  const formatShortDay = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(iso));

  const monthTitle = useMemo(() => {
    const d = new Date(Date.UTC(monthCursor.year, monthCursor.month, 1));
    const raw = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [monthCursor, locale]);

  const dayTitle = useMemo(() => {
    const [dy = 2026, dm = 1, dd = 1] = selectedDayIso.split("-").map(Number);
    const dayDate = new Date(Date.UTC(dy, dm - 1, dd));
    const raw = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(dayDate);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [selectedDayIso, locale]);

  const weekDays = useMemo(() => {
    const [y = 2026, m = 1, d = 1] = selectedDayIso.split("-").map(Number);
    const cur = new Date(Date.UTC(y, m - 1, d));
    const dayOfWeek = (cur.getUTCDay() + 6) % 7;
    const monday = new Date(Date.UTC(y, m - 1, d - dayOfWeek));
    const days: {
      iso: string;
      date: Date;
      dayNum: number;
      weekdayName: string;
      weekdayFull: string;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(
        Date.UTC(
          monday.getUTCFullYear(),
          monday.getUTCMonth(),
          monday.getUTCDate() + i,
        ),
      );
      const iso = day.toISOString().slice(0, 10);
      days.push({
        iso,
        date: day,
        dayNum: day.getUTCDate(),
        weekdayName: new Intl.DateTimeFormat(locale, {
          weekday: "short",
          timeZone: "UTC",
        }).format(day),
        weekdayFull: new Intl.DateTimeFormat(locale, {
          weekday: "long",
          timeZone: "UTC",
        }).format(day),
        isToday: iso === todayIso,
        isSelected: iso === selectedDayIso,
      });
    }
    return days;
  }, [selectedDayIso, locale, todayIso]);

  const weekTitle = useMemo(() => {
    if (weekDays.length < 7) return "";
    const start = weekDays[0].date;
    const end = weekDays[6].date;
    const startDay = start.getUTCDate();
    const endDay = end.getUTCDate();
    const startMonth = new Intl.DateTimeFormat(locale, {
      month: "short",
      timeZone: "UTC",
    }).format(start);
    const endMonth = new Intl.DateTimeFormat(locale, {
      month: "short",
      timeZone: "UTC",
    }).format(end);
    const startYear = start.getUTCFullYear();
    const endYear = end.getUTCFullYear();

    if (startYear !== endYear) {
      return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
    }
    if (start.getUTCMonth() !== end.getUTCMonth()) {
      return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${startYear}`;
    }
    return `${startDay} – ${endDay} ${startMonth} ${startYear}`;
  }, [weekDays, locale]);

  const activeHeadingTitle = useMemo(() => {
    if (displayLayout === "day") {
      return dayTitle;
    }
    if (displayLayout === "week") {
      return weekTitle;
    }
    return monthTitle;
  }, [displayLayout, dayTitle, weekTitle, monthTitle]);

  const miniMonthTitle = useMemo(() => {
    const d = new Date(Date.UTC(miniMonthCursor.year, miniMonthCursor.month, 1));
    const raw = new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [miniMonthCursor, locale]);

  const miniMonthCells = useMemo(
    () => buildMonthGrid(miniMonthCursor.year, miniMonthCursor.month),
    [miniMonthCursor],
  );

  const activeWeekIsoSet = useMemo(() => {
    return new Set(weekDays.map((d) => d.iso));
  }, [weekDays]);

  function shiftMiniMonth(delta: number) {
    setMiniMonthCursor((prev) => {
      let nextM = prev.month + delta;
      let nextY = prev.year;
      if (nextM < 0) {
        nextM = 11;
        nextY -= 1;
      } else if (nextM > 11) {
        nextM = 0;
        nextY += 1;
      }
      return { year: nextY, month: nextM };
    });
  }

  const weekdayLabels = useMemo(
    () =>
      pl
        ? ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    [pl],
  );

  async function handleRecordDose(
    dose: ProjectedMedicationDose,
    status: "taken" | "skipped" = "taken",
    notes: string = "",
  ): Promise<boolean> {
    if (dose.dose_date > todayIso) {
      setFutureDoseNotice(dose);
      return false;
    }

    setBusyKey(dose.key);
    const previousLogs = medicationLogs;
    const previousSchedules = medicationSchedules;
    const matchingSchedule = medicationSchedules.find((s) => s.id === dose.schedule_id);

    const optimisticLogId = `temp-${Date.now()}`;
    const optimisticLog: MedicationLog = {
      id: optimisticLogId,
      schedule_id: dose.schedule_id,
      pet_id: dose.pet_id,
      household_id: matchingSchedule?.household_id || "",
      dose_date: dose.dose_date,
      scheduled_time: dose.scheduled_time || "",
      administered_at: new Date().toISOString(),
      status,
      administered_by: currentUserId || null,
      notes,
      revision: 1,
      created_by: currentUserId || "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Natychmiastowa optymistyczna zmiana w interfejsie kalendarza (0ms)
    setMedicationLogs((prev) => {
      const filtered = prev.filter(
        (l) =>
          !(
            l.schedule_id === dose.schedule_id &&
            l.dose_date === dose.dose_date &&
            (l.scheduled_time === dose.scheduled_time ||
              (!l.scheduled_time && !dose.scheduled_time))
          ),
      );
      return [optimisticLog, ...filtered];
    });

    if (status === "taken" && !dose.is_completed) {
      setMedicationSchedules((prev) =>
        prev.map((s) =>
          s.id === dose.schedule_id && s.stock_quantity != null
            ? { ...s, stock_quantity: Math.max(0, s.stock_quantity - 1) }
            : s,
        ),
      );
    } else if (status === "skipped" && dose.is_completed) {
      setMedicationSchedules((prev) =>
        prev.map((s) =>
          s.id === dose.schedule_id && s.stock_quantity != null
            ? { ...s, stock_quantity: s.stock_quantity + 1 }
            : s,
        ),
      );
    }

    // 2. Asynchroniczny zapis na serwerze
    try {
      const client = createClient();
      let savedLog: MedicationLog | null = null;
      try {
        const { data: fnData, error: fnError } = await client.functions.invoke(
          "pet-medications",
          {
            body: {
              action: "record_dose",
              pet_id: dose.pet_id,
              schedule_id: dose.schedule_id,
              dose_date: dose.dose_date,
              scheduled_time: dose.scheduled_time,
              status,
              notes,
            },
          },
        );
        if (!fnError && fnData?.log) {
          savedLog = fnData.log as MedicationLog;
        }
      } catch {
        // Fallback do RPC
      }

      if (!savedLog) {
        const { data: rpcData, error: rpcError } = await client.rpc(
          "record_medication_dose",
          {
            p_schedule_id: dose.schedule_id,
            p_pet_id: dose.pet_id,
            p_dose_date: dose.dose_date,
            p_scheduled_time: dose.scheduled_time || "",
            p_status: status,
            p_notes: notes,
          },
        );
        if (rpcError) {
          console.error("RPC record_medication_dose error:", rpcError);
        } else if (rpcData) {
          savedLog = rpcData as MedicationLog;
        }
      }

      if (savedLog) {
        setMedicationLogs((prev) =>
          prev.map((l) => (l.id === optimisticLogId ? savedLog! : l)),
        );
        return true;
      } else {
        // Rollback w przypadku błędu
        setMedicationLogs(previousLogs);
        setMedicationSchedules(previousSchedules);
        alert(
          pl
            ? "Nie udało się zapisać statusu dawki leku. Zmiana została wycofana."
            : "Failed to record medication dose. Change was rolled back.",
        );
        return false;
      }
    } catch (e) {
      console.error("Error recording dose:", e);
      setMedicationLogs(previousLogs);
      setMedicationSchedules(previousSchedules);
      alert(
        pl
          ? "Wystąpił błąd podczas zapisywania statusu dawki. Zmiana została wycofana."
          : "An error occurred while saving dose. Change was rolled back.",
      );
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteDoseLog(logId: string) {
    setBusyKey(`log-${logId}`);
    const previousLogs = medicationLogs;
    const previousSchedules = medicationSchedules;

    // 1. Natychmiastowe optymistyczne cofnięcie wpisu (0ms)
    const deletedLog = medicationLogs.find((l) => l.id === logId);
    if (deletedLog && deletedLog.status === "taken" && deletedLog.schedule_id) {
      setMedicationSchedules((prev) =>
        prev.map((s) =>
          s.id === deletedLog.schedule_id && s.stock_quantity != null
            ? { ...s, stock_quantity: s.stock_quantity + 1 }
            : s,
        ),
      );
    }
    setMedicationLogs((prev) => prev.filter((l) => l.id !== logId));

    try {
      const client = createClient();
      let deleted = false;
      try {
        const { data: fnData, error: fnError } = await client.functions.invoke(
          "pet-medications",
          {
            body: {
              action: "delete_dose_log",
              pet_id: fixedPetId || pets[0]?.id,
              log_id: logId,
            },
          },
        );
        if (!fnError && fnData?.deleted) deleted = true;
      } catch {
        // Fallback do RPC
      }

      if (!deleted) {
        const { error: rpcError } = await client.rpc("delete_medication_dose_log", {
          p_log_id: logId,
        });
        if (!rpcError) deleted = true;
        else console.error("RPC delete_medication_dose_log error:", rpcError);
      }

      if (!deleted) {
        // Rollback
        setMedicationLogs(previousLogs);
        setMedicationSchedules(previousSchedules);
        alert(
          pl
            ? "Nie udało się cofnąć zatwierdzenia dawki. Zmiana została wycofana."
            : "Failed to undo dose confirmation. Change was rolled back.",
        );
      }
    } catch (e) {
      console.error("Error deleting dose log:", e);
      setMedicationLogs(previousLogs);
      setMedicationSchedules(previousSchedules);
      alert(
        pl
          ? "Wystąpił błąd podczas cofania zatwierdzenia. Zmiana została wycofana."
          : "An error occurred while undoing confirmation. Change was rolled back.",
      );
    } finally {
      setBusyKey(null);
    }
  }

  const projectedDoses = useMemo(() => {
    const startYear = monthCursor.year - 1;
    const endYear = monthCursor.year + 1;
    const rangeStart = `${startYear}-01-01`;
    const rangeEnd = `${endYear}-12-31`;

    return projectMedicationDoses({
      schedules: medicationSchedules,
      logs: medicationLogs,
      rangeStart,
      rangeEnd,
    });
  }, [medicationSchedules, medicationLogs, monthCursor]);

  const allEntries = useMemo<UnifiedScheduleEntry[]>(() => {
    const linkedHistoryIds = new Set(
      scheduleItems
        .filter((it) => it.status === "completed" && it.completed_event_id)
        .map((it) => it.completed_event_id!),
    );

    const manualEntries: UnifiedScheduleEntry[] = scheduleItems.map((it) => ({
      kind: "schedule_item",
      key: `sched-${it.id}`,
      petId: it.pet_id,
      category: it.category,
      title: it.title,
      date: it.scheduled_date,
      time: it.scheduled_time,
      clinic: it.clinic,
      doctor: it.doctor,
      prepNotes: it.prep_notes,
      status: it.status,
      item: it,
    }));

    const dueEntries: UnifiedScheduleEntry[] = healthEvents
      .filter((ev) => ev.next_due_date !== null)
      .map((ev) => ({
        kind: "due_event",
        key: `due-${ev.id}`,
        petId: ev.pet_id,
        category: ev.category,
        title: ev.title,
        date: ev.next_due_date!,
        time: "",
        clinic: ev.clinic,
        doctor: ev.doctor,
        batchOrProduct: ev.batch_or_product,
        lastEventDate: ev.event_date,
        status: "planned",
        event: ev,
      }));

    const historyActualEntries: UnifiedScheduleEntry[] = healthEvents
      .filter((ev) => !linkedHistoryIds.has(ev.id))
      .map((ev) => ({
        kind: "history_event",
        key: `hist-${ev.id}`,
        petId: ev.pet_id,
        category: ev.category,
        title: ev.title,
        date: ev.event_date,
        time: "",
        clinic: ev.clinic,
        doctor: ev.doctor,
        batchOrProduct: ev.batch_or_product,
        description: ev.description,
        status: "completed",
        event: ev,
      }));

    const reportEntries: UnifiedScheduleEntry[] = reports.map((rep) => ({
      kind: "medical_report",
      key: `rep-${rep.id}`,
      petId: rep.pet_id,
      category: "lab",
      title: rep.title,
      date: rep.test_date,
      time: "",
      clinic: rep.laboratory,
      doctor: rep.doctor,
      status: "completed",
      report: rep,
    }));

    const medicationEntries: UnifiedScheduleEntry[] = projectedDoses.map((dose) => ({
      kind: "medication_dose",
      key: dose.key,
      petId: dose.pet_id,
      category: "prevention",
      title: dose.dosage ? `${dose.name} (${dose.dosage})` : dose.name,
      date: dose.dose_date,
      time: dose.scheduled_time,
      clinic: "",
      doctor: "",
      prepNotes: dose.instructions,
      status: dose.log?.status === "skipped" ? "skipped" : dose.is_completed ? "completed" : "planned",
      dosage: dose.dosage,
      scheduleType: dose.schedule_type,
      instructions: dose.instructions,
      dose,
    }));

    return [
      ...manualEntries,
      ...dueEntries,
      ...historyActualEntries,
      ...reportEntries,
      ...medicationEntries,
    ].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time || "99:99").localeCompare(b.time || "99:99"),
    );
  }, [scheduleItems, healthEvents, reports, projectedDoses]);

  const queryTokens = useMemo(() => {
    const folded = foldText(searchQuery.trim());
    return folded ? folded.split(/\s+/).filter(Boolean) : [];
  }, [searchQuery]);

  const baseFilteredEntries = useMemo(() => {
    return allEntries.filter((entry) => {
      if (fixedPetId && entry.petId !== fixedPetId) return false;
      if (!fixedPetId && petFilter !== "all" && entry.petId !== petFilter) {
        return false;
      }
      if (categoryFilter !== "all" && entry.category !== categoryFilter) {
        return false;
      }
      if (queryTokens.length > 0) {
        const haystack = buildSearchHaystack(
          entry,
          petMap.get(entry.petId) ?? "",
        );
        for (const token of queryTokens) {
          if (!haystack.includes(token)) return false;
        }
      }
      return true;
    });
  }, [allEntries, fixedPetId, petFilter, categoryFilter, queryTokens, petMap]);

  const filteredListEntries = useMemo(() => {
    return baseFilteredEntries.filter((entry) =>
      viewMode === "upcoming"
        ? entry.status === "planned"
        : entry.status !== "planned",
    );
  }, [baseFilteredEntries, viewMode]);

  const groupedByMonth = useMemo(() => {
    const groups: { ym: string; label: string; items: UnifiedScheduleEntry[] }[] = [];
    for (const entry of filteredListEntries) {
      const ym = entry.date.slice(0, 7);
      const last = groups[groups.length - 1];
      if (!last || last.ym !== ym) {
        groups.push({
          ym,
          label: formatMonthHeading(ym, locale),
          items: [entry],
        });
      } else {
        last.items.push(entry);
      }
    }
    return groups;
  }, [filteredListEntries, locale]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, UnifiedScheduleEntry[]>();
    for (const entry of baseFilteredEntries) {
      if (entry.status === "cancelled") continue;
      const list = map.get(entry.date);
      if (list) list.push(entry);
      else map.set(entry.date, [entry]);
    }
    return map;
  }, [baseFilteredEntries]);

  const monthCells = useMemo(
    () => buildMonthGrid(monthCursor.year, monthCursor.month),
    [monthCursor],
  );

  const selectedDayEntries = useMemo(
    () => entriesByDate.get(selectedDayIso) ?? [],
    [entriesByDate, selectedDayIso],
  );

  const activeCount = useMemo(
    () =>
      allEntries.filter(
        (e) =>
          e.status === "planned" && (!fixedPetId || e.petId === fixedPetId),
      ).length,
    [allEntries, fixedPetId],
  );

  const archiveCount = useMemo(
    () =>
      allEntries.filter(
        (e) =>
          e.status !== "planned" && (!fixedPetId || e.petId === fixedPetId),
      ).length,
    [allEntries, fixedPetId],
  );

  function shiftMonth(delta: number) {
    setMonthCursor((prev) => {
      const next = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      const nextY = next.getUTCFullYear();
      const nextM = next.getUTCMonth();
      const newYm = `${nextY}-${String(nextM + 1).padStart(2, "0")}`;
      if (!selectedDayIso.startsWith(newYm)) {
        setSelectedDayIso(`${newYm}-01`);
      }
      return { year: nextY, month: nextM };
    });
  }

  function shiftWeek(delta: number) {
    const [y, m, d] = selectedDayIso.split("-").map(Number);
    const cur = new Date(Date.UTC(y, m - 1, d));
    cur.setUTCDate(cur.getUTCDate() + delta * 7);
    const newIso = cur.toISOString().slice(0, 10);
    setSelectedDayIso(newIso);
    setMonthCursor({
      year: cur.getUTCFullYear(),
      month: cur.getUTCMonth(),
    });
  }

  function shiftDay(delta: number) {
    const [y, m, d] = selectedDayIso.split("-").map(Number);
    const cur = new Date(Date.UTC(y, m - 1, d));
    cur.setUTCDate(cur.getUTCDate() + delta);
    const newIso = cur.toISOString().slice(0, 10);
    setSelectedDayIso(newIso);
    setMonthCursor({
      year: cur.getUTCFullYear(),
      month: cur.getUTCMonth(),
    });
  }

  function handleNavigate(delta: number) {
    if (displayLayout === "day") {
      shiftDay(delta);
    } else if (displayLayout === "week") {
      shiftWeek(delta);
    } else {
      shiftMonth(delta);
    }
  }

  function jumpToToday() {
    const [y, m] = todayIso.split("-").map(Number);
    setMonthCursor({ year: y, month: m - 1 });
    setSelectedDayIso(todayIso);
  }

  function openNewDialogForDate(dateIso?: string) {
    setEditingItem(null);
    setDialogDefaultDate(dateIso);
    setDialogOpen(true);
  }

  function goToDayView(iso: string) {
    if (displayLayout !== "day") {
      setPreviousLayout(displayLayout);
    }
    setSelectedDayIso(iso);
    const [y, m] = iso.split("-").map(Number);
    if (y && m) {
      setMonthCursor({ year: y, month: m - 1 });
    }
    setDisplayLayout("day");
  }

  async function handleStatusChange(
    item: ScheduleItem,
    nextStatus: "planned" | "cancelled",
  ) {
    if (busyKey) return;
    setBusyKey(`sched-${item.id}`);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke("pet-schedule", {
        body: {
          action: "status",
          id: item.id,
          pet_id: item.pet_id,
          revision: item.revision,
          status: nextStatus,
        },
      });
      if (!error && data?.item) {
        const updated = data.item as ScheduleItem;
        setScheduleItems((prev) =>
          prev.map((row) => (row.id === updated.id ? updated : row)),
        );
        router.refresh();
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(item: ScheduleItem) {
    if (busyKey) return;
    setBusyKey(`sched-${item.id}`);
    try {
      const client = createClient();
      const { error } = await client.functions.invoke("pet-schedule", {
        body: {
          action: "delete",
          id: item.id,
          pet_id: item.pet_id,
          revision: item.revision,
        },
      });
      if (!error) {
        setScheduleItems((prev) => prev.filter((row) => row.id !== item.id));
        router.refresh();
      }
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSaveNotifications() {
    if (notifSaving) return;
    setNotifSaving(true);
    setNotifFeedback(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke(
        "schedule-notifications",
        {
          body: {
            action: "save_settings",
            ...notifSettings,
          },
        },
      );
      if (error || !data?.settings) {
        setNotifFeedback({
          type: "error",
          text: pl
            ? "Nie udało się zapisać ustawień powiadomień."
            : "Could not save notification settings.",
        });
        return;
      }
      setNotifFeedback({
        type: "ok",
        text: pl
          ? "Ustawienia powiadomień e-mail zostały zapisane."
          : "Email notification settings saved.",
      });
    } finally {
      setNotifSaving(false);
    }
  }

  async function handleSendTestDigest() {
    if (notifTesting) return;
    setNotifTesting(true);
    setNotifFeedback(null);
    try {
      const client = createClient();
      const { data, error } = await client.functions.invoke(
        "schedule-notifications",
        {
          body: {
            action: "send_test",
            recipient_email: notifSettings.custom_email.trim() || undefined,
          },
        },
      );
      if (error || !data?.sent) {
        setNotifFeedback({
          type: "error",
          text: pl
            ? "Nie udało się wysłać wiadomości testowej. Sprawdź adres e-mail."
            : "Could not send test email. Please verify the address.",
        });
        return;
      }
      setNotifFeedback({
        type: "ok",
        text: pl
          ? `Wysłano podsumowanie testowe na adres ${data.recipient} (${data.items_count} poz.).`
          : `Test digest sent to ${data.recipient} (${data.items_count} items).`,
      });
    } finally {
      setNotifTesting(false);
    }
  }

  const categoryButtons: { id: FilterCategory; label: string }[] = [
    { id: "all", label: pl ? "Wszystkie" : "All" },
    { id: "visit", label: pl ? "Wizyty" : "Visits" },
    { id: "vaccination", label: pl ? "Szczepienia" : "Vaccinations" },
    { id: "prevention", label: pl ? "Profilaktyka i leki" : "Prevention & meds" },
    { id: "lab", label: pl ? "Wyniki badań" : "Lab results" },
  ];

  function renderCompactRow(entry: UnifiedScheduleEntry) {
    const petName = petMap.get(entry.petId) ?? "";
    const isOverdue = entry.status === "planned" && entry.date < todayIso;
    const isToday = entry.status === "planned" && entry.date === todayIso;
    const EvIcon =
      entry.category === "vaccination"
        ? IconVaccine
        : entry.category === "prevention"
          ? IconPill
          : entry.category === "lab"
            ? IconFlask
            : IconStethoscope;
    const categoryLabel =
      entry.kind === "medication_dose"
        ? pl
          ? "Lek"
          : "Medication"
        : entry.category === "vaccination"
          ? pl
            ? "Szczepienie"
            : "Vaccination"
          : entry.category === "prevention"
            ? pl
              ? "Profilaktyka"
              : "Prevention"
            : entry.category === "lab"
              ? pl
                ? "Wynik badania"
                : "Lab result"
              : pl
                ? "Wizyta"
                : "Visit";

    const isBusy = busyKey === entry.key;
    const hasNotes =
      (entry.kind === "schedule_item" && entry.prepNotes.trim().length > 0) ||
      (entry.kind === "history_event" && entry.description.trim().length > 0) ||
      (entry.kind === "medication_dose" && entry.instructions.trim().length > 0);
    const notesOpen = expandedNotesKey === entry.key || highlightedKey === entry.key;

    const metaParts: string[] = [];
    if (entry.clinic) metaParts.push(entry.clinic);
    if (entry.doctor) metaParts.push(entry.doctor);
    if (
      (entry.kind === "due_event" || entry.kind === "history_event") &&
      entry.batchOrProduct
    ) {
      metaParts.push(entry.batchOrProduct);
    }
    if (entry.kind === "medication_dose") {
      const scheduleLabel =
        entry.scheduleType === "one_off"
          ? pl ? "Doraźnie" : "One-off"
          : entry.scheduleType === "daily"
            ? pl ? "Codziennie" : "Daily"
            : pl ? "Cyklicznie" : "Interval";
      metaParts.push(scheduleLabel);
      if (entry.dosage) metaParts.push(entry.dosage);
    }

    return (
      <li
        id={`schedule-entry-${entry.key}`}
        key={entry.key}
        className={`schedule-compact-row${isOverdue ? " is-overdue" : ""}${entry.status !== "planned" ? " is-archived" : ""}${highlightedKey === entry.key ? " is-highlighted" : ""}`}
      >
        <div className="schedule-compact-main">
          <span
            className={`schedule-compact-date${isOverdue ? " is-overdue" : isToday ? " is-today" : ""}`}
            title={formatDate(entry.date)}
          >
            <IconClock size={13} aria-hidden="true" />
            <time dateTime={entry.date}>{formatShortDay(entry.date)}</time>
            {entry.time ? <small>{entry.time}</small> : null}
          </span>

          <span
            className={`schedule-compact-icon is-${entry.category}`}
            aria-hidden="true"
          >
            <EvIcon size={16} />
          </span>

          <div className="schedule-compact-info">
            <div className="schedule-compact-title-line">
              <strong>{entry.title}</strong>
              {petName && !fixedPetId && (
                <Link
                  href={`/app/zwierzeta/${entry.petId}`}
                  className="household-tag schedule-pet-tag"
                >
                  {petName}
                </Link>
              )}
              <span className="household-tag">{categoryLabel}</span>
              {entry.status === "completed" && (
                <span className="schedule-status-badge is-completed">
                  {pl ? "Wykonano" : "Done"}
                </span>
              )}
              {entry.status === "cancelled" && (
                <span className="schedule-status-badge is-cancelled">
                  {pl ? "Odwołano" : "Cancelled"}
                </span>
              )}
              {entry.status === "skipped" && (
                <span className="schedule-status-badge is-cancelled border-amber-300 bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                  {pl ? "Pominięto" : "Skipped"}
                </span>
              )}
              {metaParts.length > 0 && (
                <span className="schedule-compact-meta">
                  · {metaParts.join(" · ")}
                </span>
              )}
            </div>
          </div>

          <div className="schedule-compact-actions">
            {hasNotes && (
              <button
                type="button"
                className={`schedule-mini-btn${notesOpen ? " is-active" : ""}`}
                onClick={() =>
                  setExpandedNotesKey((prev) =>
                    prev === entry.key ? null : entry.key,
                  )
                }
                title={
                  pl
                    ? "Pokaż / ukryj notatki przedwizytowe"
                    : "Toggle pre-visit notes"
                }
              >
                <IconNotes size={14} aria-hidden="true" />
                <span>{pl ? "Notatka" : "Notes"}</span>
              </button>
            )}

            {(entry.kind === "schedule_item" || entry.kind === "due_event") &&
              entry.status === "planned" && (
                <button
                  type="button"
                  className="schedule-mini-btn is-primary"
                  disabled={isBusy}
                  onClick={() =>
                    setCompletingTarget({
                      sourceKind: entry.kind,
                      sourceId:
                        entry.kind === "schedule_item"
                          ? entry.item.id
                          : entry.event.id,
                      petId: entry.petId,
                      petName: petName || (pl ? "Pupil" : "Pet"),
                      category: entry.category,
                      title: entry.title,
                      clinic: entry.clinic,
                      doctor: entry.doctor,
                      batchOrProduct:
                        entry.kind === "due_event" ? entry.batchOrProduct : "",
                      prepNotes:
                        entry.kind === "schedule_item" ? entry.prepNotes : "",
                    })
                  }
                >
                  <IconCheck size={14} aria-hidden="true" />
                  <span>{pl ? "Wykonane" : "Done"}</span>
                </button>
              )}

            {entry.kind === "schedule_item" && (
              <>
                {entry.status === "planned" && (
                  <>
                    <button
                      type="button"
                      className="schedule-mini-btn"
                      disabled={isBusy}
                      title={pl ? "Edytuj" : "Edit"}
                      aria-label={pl ? "Edytuj" : "Edit"}
                      onClick={() => {
                        setEditingItem(entry.item);
                        setDialogDefaultDate(undefined);
                        setDialogOpen(true);
                      }}
                    >
                      <IconPencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="schedule-mini-btn"
                      disabled={isBusy}
                      title={pl ? "Odwołaj termin" : "Cancel item"}
                      aria-label={pl ? "Odwołaj termin" : "Cancel item"}
                      onClick={() =>
                        void handleStatusChange(entry.item, "cancelled")
                      }
                    >
                      <IconBan size={14} aria-hidden="true" />
                    </button>
                  </>
                )}

                {entry.status === "cancelled" && (
                  <button
                    type="button"
                    className="schedule-mini-btn"
                    disabled={isBusy}
                    onClick={() =>
                      void handleStatusChange(entry.item, "planned")
                    }
                  >
                    <span>{pl ? "Przywróć" : "Restore"}</span>
                  </button>
                )}

                <button
                  type="button"
                  className="schedule-mini-btn is-danger"
                  disabled={isBusy}
                  title={pl ? "Usuń" : "Delete"}
                  aria-label={pl ? "Usuń" : "Delete"}
                  onClick={() => void handleDelete(entry.item)}
                >
                  <IconTrash size={14} aria-hidden="true" />
                </button>
              </>
            )}

            {entry.kind === "medication_dose" && (
              <>
                {entry.status === "planned" ? (
                  entry.dose.dose_date > todayIso ? (
                    <button
                      type="button"
                      className="schedule-mini-btn border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100 font-medium cursor-pointer"
                      onClick={() => setFutureDoseNotice(entry.dose)}
                      title={
                        pl
                          ? `Dawka zaplanowana na ${entry.dose.dose_date}. Kliknij, aby dowiedzieć się więcej.`
                          : `Scheduled for ${entry.dose.dose_date}. Click for details.`
                      }
                    >
                      <IconClock size={14} aria-hidden="true" />
                      <span>{pl ? "Oczekuje" : "Upcoming"}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="schedule-mini-btn is-primary font-medium"
                        disabled={isBusy}
                        onClick={() => void handleRecordDose(entry.dose, "taken")}
                        title={pl ? "Zatwierdź podanie leku" : "Confirm medication dose"}
                      >
                        <IconCheck size={14} aria-hidden="true" />
                        <span>{pl ? "Zatwierdź" : "Confirm"}</span>
                      </button>
                      <button
                        type="button"
                        className="schedule-mini-btn border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-medium cursor-pointer"
                        disabled={isBusy}
                        onClick={() => setSkipDoseTarget(entry.dose)}
                        title={pl ? "Oznacz dawkę jako pominiętą" : "Mark dose as skipped"}
                      >
                        <IconBan size={14} aria-hidden="true" />
                        <span>{pl ? "Pomiń" : "Skip"}</span>
                      </button>
                    </>
                  )
                ) : entry.status === "skipped" ? (
                  <>
                    <button
                      type="button"
                      className="schedule-mini-btn is-primary font-medium"
                      disabled={isBusy}
                      onClick={() => void handleRecordDose(entry.dose, "taken")}
                      title={pl ? "Zmień na podano" : "Mark as taken"}
                    >
                      <IconCheck size={14} aria-hidden="true" />
                      <span>{pl ? "Podano" : "Taken"}</span>
                    </button>
                    {entry.dose.log && (
                      <button
                        type="button"
                        className="schedule-mini-btn"
                        disabled={isBusy}
                        onClick={() => void handleDeleteDoseLog(entry.dose.log!.id)}
                        title={pl ? "Cofnij pominięcie" : "Undo skip"}
                      >
                        <IconBan size={14} aria-hidden="true" />
                        <span>{pl ? "Cofnij" : "Undo"}</span>
                      </button>
                    )}
                  </>
                ) : (
                  entry.dose.log && (
                    <button
                      type="button"
                      className="schedule-mini-btn"
                      disabled={isBusy}
                      onClick={() => void handleDeleteDoseLog(entry.dose.log!.id)}
                      title={pl ? "Cofnij zatwierdzenie dawki" : "Undo dose confirmation"}
                    >
                      <IconBan size={14} aria-hidden="true" />
                      <span>{pl ? "Cofnij" : "Undo"}</span>
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="schedule-mini-btn"
                  disabled={isBusy}
                  onClick={() => {
                    const found = medicationSchedules.find(
                      (s) => s.id === entry.dose.schedule_id,
                    );
                    if (found) {
                      setEditingMedicationSchedule(found);
                      setMedicationDialogOpen(true);
                    }
                  }}
                  title={pl ? "Edytuj harmonogram tego leku" : "Edit medication schedule"}
                >
                  <IconPencil size={13} aria-hidden="true" />
                  <span>{pl ? "Harmonogram" : "Schedule"}</span>
                </button>
              </>
            )}

            {(entry.kind === "due_event" || entry.kind === "history_event") && (
              <Link
                href={`/app/zwierzeta/${entry.petId}?tab=history`}
                className="schedule-mini-btn"
                title={pl ? "Zobacz w historii zdrowia" : "View in health history"}
              >
                <span>{pl ? "Historia →" : "History →"}</span>
              </Link>
            )}

            {entry.kind === "medical_report" && (
              <Link
                href={`/app/zwierzeta/${entry.petId}?tab=results&report=${entry.report.id}`}
                className="schedule-mini-btn is-primary"
                title={pl ? "Otwórz wyniki badania" : "Open lab report"}
              >
                <span>{pl ? "Wyniki →" : "Report →"}</span>
              </Link>
            )}
          </div>
        </div>

        {hasNotes && notesOpen && (
          <div className="schedule-compact-notes">
            <IconNotes size={14} aria-hidden="true" />
            <p>
              {entry.kind === "schedule_item"
                ? entry.prepNotes
                : entry.kind === "history_event"
                  ? entry.description
                  : entry.kind === "medication_dose"
                    ? entry.instructions
                    : ""}
            </p>
          </div>
        )}
      </li>
    );
  }

  const viewButtons: {
    id: DisplayLayout;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  }[] = [
    { id: "month", label: pl ? "Miesiąc" : "Month", icon: IconCalendarMonth },
    { id: "week", label: pl ? "Tydzień" : "Week", icon: IconCalendarWeek },
    { id: "day", label: pl ? "Dzień" : "Day", icon: IconCalendarEvent },
    { id: "agenda", label: pl ? "Agenda" : "Agenda", icon: IconList },
  ];

  function renderDayDetailCard(entry: UnifiedScheduleEntry) {
    const petName = petMap.get(entry.petId);
    const isOverdue = entry.status === "planned" && entry.date < todayIso;
    const isBusy = busyKey !== null;

    const EvIcon =
      entry.category === "vaccination"
        ? IconVaccine
        : entry.category === "prevention"
          ? IconPill
          : entry.category === "lab"
            ? IconFlask
            : IconStethoscope;

    const categoryLabel =
      entry.kind === "medication_dose"
        ? pl ? "Lek / dawka" : "Medication dose"
        : entry.category === "vaccination"
          ? pl ? "Szczepienie" : "Vaccination"
          : entry.category === "prevention"
            ? pl ? "Profilaktyka" : "Prevention"
            : entry.category === "lab"
              ? pl ? "Badania i wyniki" : "Lab results"
              : pl ? "Wizyta weterynaryjna" : "Vet visit";

    const hasNotes =
      (entry.kind === "schedule_item" && Boolean(entry.prepNotes?.trim())) ||
      (entry.kind === "history_event" && Boolean(entry.description?.trim())) ||
      (entry.kind === "medication_dose" && Boolean(entry.instructions?.trim()));

    return (
      <li
        key={entry.key}
        className={`schedule-day-card is-${entry.category}${isOverdue ? " is-overdue" : ""}${entry.status === "completed" ? " is-completed" : ""}${entry.status === "skipped" ? " is-skipped" : ""}`}
      >
        <div className="schedule-day-card-time-col">
          <span className="schedule-day-card-time">
            {entry.time ? (
              entry.time
            ) : (
              <IconClock size={16} aria-hidden="true" />
            )}
          </span>
          <span
            className={`schedule-day-card-icon is-${entry.category}`}
            aria-hidden="true"
          >
            <EvIcon size={20} />
          </span>
        </div>

        <div className="schedule-day-card-content">
          <div className="schedule-day-card-header">
            <div className="schedule-day-card-tags">
              {petName && !fixedPetId && (
                <Link
                  href={`/app/zwierzeta/${entry.petId}`}
                  className="household-tag schedule-pet-tag"
                >
                  {petName}
                </Link>
              )}
              <span className="household-tag">{categoryLabel}</span>
              {entry.status === "completed" && (
                <span className="schedule-status-badge is-completed">
                  {pl ? "Wykonano" : "Done"}
                </span>
              )}
              {entry.status === "cancelled" && (
                <span className="schedule-status-badge is-cancelled">
                  {pl ? "Odwołano" : "Cancelled"}
                </span>
              )}
              {entry.status === "skipped" && (
                <span className="schedule-status-badge is-cancelled border-amber-300 bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                  {pl ? "Pominięto" : "Skipped"}
                </span>
              )}
              {isOverdue && (
                <span className="schedule-status-badge is-overdue">
                  {pl ? "Zaległe" : "Overdue"}
                </span>
              )}
            </div>
            <h4 className="schedule-day-card-title">{entry.title}</h4>
          </div>

          {(entry.clinic || entry.doctor) && (
            <div className="schedule-day-card-meta">
              {entry.clinic && <span>📍 {entry.clinic}</span>}
              {entry.doctor && <span>🩺 {entry.doctor}</span>}
              {entry.kind === "due_event" && entry.batchOrProduct && (
                <span>🏷️ {entry.batchOrProduct}</span>
              )}
            </div>
          )}

          {entry.kind === "medication_dose" && (
            <div className="schedule-day-card-meta">
              <span>
                💊 {entry.scheduleType === "one_off"
                  ? pl ? "Wariant: jednorazowe (doraźne)" : "Variant: one-off"
                  : entry.scheduleType === "daily"
                    ? pl ? "Wariant: stałe, codzienne" : "Variant: daily"
                    : pl ? "Wariant: cykliczne (interwał)" : "Variant: interval"}
              </span>
              {entry.dosage && <span>🏷️ {entry.dosage}</span>}
              {entry.status === "completed" && entry.dose.log && (
                <span className="text-teal-700 font-medium">
                  ✓ {pl ? "Zatwierdzono podanie" : "Administered"} (
                  {new Intl.DateTimeFormat(locale, {
                    timeStyle: "short",
                    dateStyle: "short",
                    timeZone: "Europe/Warsaw",
                  }).format(new Date(entry.dose.log.administered_at))}
                  {` · ${
                    entry.dose.log.administered_by
                      ? entry.dose.log.administered_by === currentUserId
                        ? pl
                          ? "Ciebie"
                          : "You"
                        : memberNames[entry.dose.log.administered_by] ||
                          (pl ? "domownika" : "member")
                      : pl
                        ? "domownika"
                        : "member"
                  }`}
                  )
                </span>
              )}
              {entry.status === "skipped" && entry.dose.log && (
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  ⊘ {pl ? "Pominięto dawkę" : "Dose skipped"} (
                  {new Intl.DateTimeFormat(locale, {
                    timeStyle: "short",
                    timeZone: "Europe/Warsaw",
                  }).format(new Date(entry.dose.log.administered_at))}
                  {` · ${
                    entry.dose.log.administered_by
                      ? entry.dose.log.administered_by === currentUserId
                        ? pl
                          ? "Ciebie"
                          : "You"
                        : memberNames[entry.dose.log.administered_by] ||
                          (pl ? "domownika" : "member")
                      : pl
                        ? "domownika"
                        : "member"
                  }`}
                  )
                  {entry.dose.log.notes ? `: ${entry.dose.log.notes}` : ""}
                </span>
              )}
            </div>
          )}

          {hasNotes && (
            <div className="schedule-day-card-notes">
              <IconNotes size={16} aria-hidden="true" />
              <div>
                <strong>
                  {entry.kind === "schedule_item"
                    ? pl
                      ? "Notatki przedwizytowe dla opiekuna:"
                      : "Pre-visit notes:"
                    : entry.kind === "history_event"
                      ? pl
                        ? "Opis i zalecenia:"
                        : "Description & recommendations:"
                      : pl
                        ? "Wskazówki podania leku dla opiekuna:"
                        : "Medication administration instructions:"}
                </strong>
                <p>
                  {entry.kind === "schedule_item"
                    ? entry.prepNotes
                    : entry.kind === "history_event"
                      ? entry.description
                      : entry.kind === "medication_dose"
                        ? entry.instructions
                        : ""}
                </p>
              </div>
            </div>
          )}

          {entry.kind === "medical_report" && (
            <div className="schedule-day-card-lab-info">
              <IconFlask size={16} aria-hidden="true" />
              <div>
                <strong>
                  {pl
                    ? "Wynik badania laboratoryjnego"
                    : "Laboratory test report"}
                </strong>
                <p>
                  {pl
                    ? "Wyniki badania zostały dołączone do karty pupila. Możesz sprawdzić przeanalizowane parametry i pliki źródłowe."
                    : "Test results are attached to the pet profile. You can view parsed parameters and source files."}
                </p>
              </div>
            </div>
          )}

          <div className="schedule-day-card-actions">
            {(entry.kind === "schedule_item" || entry.kind === "due_event") &&
              entry.status === "planned" && (
                <button
                  type="button"
                  className="history-action-btn is-primary"
                  disabled={isBusy}
                  onClick={() =>
                    setCompletingTarget({
                      sourceKind: entry.kind,
                      sourceId:
                        entry.kind === "schedule_item"
                          ? entry.item.id
                          : entry.event.id,
                      petId: entry.petId,
                      petName: petName || (pl ? "Pupil" : "Pet"),
                      category: entry.category,
                      title: entry.title,
                      clinic: entry.clinic,
                      doctor: entry.doctor,
                      batchOrProduct:
                        entry.kind === "due_event" ? entry.batchOrProduct : "",
                      prepNotes:
                        entry.kind === "schedule_item" ? entry.prepNotes : "",
                    })
                  }
                >
                  <IconCheck size={15} aria-hidden="true" />
                  <span>{pl ? "Oznacz jako wykonane" : "Mark as done"}</span>
                </button>
              )}

            {entry.kind === "schedule_item" && entry.status === "planned" && (
              <>
                <button
                  type="button"
                  className="schedule-mini-btn"
                  disabled={isBusy}
                  onClick={() => {
                    setEditingItem(entry.item);
                    setDialogDefaultDate(undefined);
                    setDialogOpen(true);
                  }}
                >
                  <IconPencil size={14} aria-hidden="true" />
                  <span>{pl ? "Edytuj" : "Edit"}</span>
                </button>
                <button
                  type="button"
                  className="schedule-mini-btn"
                  disabled={isBusy}
                  onClick={() => void handleStatusChange(entry.item, "cancelled")}
                >
                  <IconBan size={14} aria-hidden="true" />
                  <span>{pl ? "Odwołaj" : "Cancel"}</span>
                </button>
                <button
                  type="button"
                  className="schedule-mini-btn is-danger"
                  disabled={isBusy}
                  onClick={() => void handleDelete(entry.item)}
                >
                  <IconTrash size={14} aria-hidden="true" />
                  <span>{pl ? "Usuń" : "Delete"}</span>
                </button>
              </>
            )}

            {entry.kind === "medical_report" && (
              <Link
                href={`/app/zwierzeta/${entry.petId}?tab=results&report=${entry.report.id}`}
                className="history-action-btn is-primary"
              >
                <IconFlask size={15} aria-hidden="true" />
                <span>
                  {pl ? "Otwórz wyniki badania →" : "Open lab report →"}
                </span>
              </Link>
            )}

            {entry.kind === "medication_dose" && (
              <>
                {entry.status === "planned" ? (
                  entry.dose.dose_date > todayIso ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="history-action-btn border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-medium cursor-pointer"
                        onClick={() => setFutureDoseNotice(entry.dose)}
                        title={
                          pl
                            ? `Dawka zaplanowana na ${entry.dose.dose_date}. Kliknij, aby dowiedzieć się więcej.`
                            : `Scheduled for ${entry.dose.dose_date}. Click for details.`
                        }
                      >
                        <IconClock size={16} aria-hidden="true" />
                        <span>{pl ? "Oczekuje na termin" : "Upcoming dose"}</span>
                      </button>
                      <span className="text-xs text-amber-700 dark:text-amber-400 font-normal">
                        {pl
                          ? "(podanie odblokuje się w wyznaczonym dniu)"
                          : "(unlocks on scheduled day)"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="history-action-btn is-primary font-medium"
                        disabled={isBusy}
                        onClick={() => void handleRecordDose(entry.dose, "taken")}
                        title={pl ? "Zatwierdź podanie leku" : "Confirm medication dose"}
                      >
                        <IconCheck size={16} aria-hidden="true" />
                        <span>{pl ? "Zatwierdź podanie" : "Confirm dose"}</span>
                      </button>
                      <button
                        type="button"
                        className="history-action-btn border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-medium cursor-pointer"
                        disabled={isBusy}
                        onClick={() => setSkipDoseTarget(entry.dose)}
                        title={pl ? "Oznacz tę dawkę jako pominiętą" : "Mark dose as skipped"}
                      >
                        <IconBan size={16} aria-hidden="true" />
                        <span>{pl ? "Pomiń dawkę" : "Skip dose"}</span>
                      </button>
                    </div>
                  )
                ) : entry.status === "skipped" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="history-action-btn is-primary font-medium"
                      disabled={isBusy}
                      onClick={() => void handleRecordDose(entry.dose, "taken")}
                      title={pl ? "Zmień na podano" : "Mark as taken"}
                    >
                      <IconCheck size={16} aria-hidden="true" />
                      <span>{pl ? "Jednak podano" : "Mark as taken"}</span>
                    </button>
                    {entry.dose.log && (
                      <button
                        type="button"
                        className="history-action-btn"
                        disabled={isBusy}
                        onClick={() => void handleDeleteDoseLog(entry.dose.log!.id)}
                        title={pl ? "Cofnij pominięcie" : "Undo skip"}
                      >
                        <IconBan size={15} aria-hidden="true" />
                        <span>{pl ? "Cofnij pominięcie" : "Undo skip"}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  entry.dose.log && (
                    <button
                      type="button"
                      className="history-action-btn"
                      disabled={isBusy}
                      onClick={() => void handleDeleteDoseLog(entry.dose.log!.id)}
                      title={pl ? "Cofnij zatwierdzenie dawki" : "Undo dose confirmation"}
                    >
                      <IconBan size={15} aria-hidden="true" />
                      <span>{pl ? "Cofnij zatwierdzenie" : "Undo confirmation"}</span>
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="history-action-btn"
                  disabled={isBusy}
                  onClick={() => {
                    const found = medicationSchedules.find(
                      (s) => s.id === entry.dose.schedule_id,
                    );
                    if (found) {
                      setEditingMedicationSchedule(found);
                      setMedicationDialogOpen(true);
                    }
                  }}
                  title={pl ? "Edytuj harmonogram tego leku" : "Edit medication schedule"}
                >
                  <IconPencil size={15} aria-hidden="true" />
                  <span>{pl ? "Edytuj harmonogram" : "Edit schedule"}</span>
                </button>
              </>
            )}

            {(entry.kind === "due_event" || entry.kind === "history_event") && (
              <Link
                href={`/app/zwierzeta/${entry.petId}?tab=history`}
                className="history-action-btn"
              >
                <span>
                  {pl
                    ? "Karta w historii zdrowia →"
                    : "View in health history →"}
                </span>
              </Link>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <section className="household-calendar" id="terminarz">
      <div className="household-section-heading schedule-heading">
        <div>
          <h2>
            {fixedPetId
              ? pl
                ? `Terminarz i przypomnienia — ${petMap.get(fixedPetId) ?? ""}`
                : `Schedule and reminders — ${petMap.get(fixedPetId) ?? ""}`
              : pl
                ? "Wspólny terminarz i przypomnienia domowe"
                : "Shared calendar and household reminders"}
          </h2>
          <p>
            {pl
              ? "Zaplanowane wizyty z notatkami przedwizytowymi oraz automatyczne terminy przypomnień z historii zdrowia."
              : "Scheduled visits with pre-visit notes and automatic due dates from health history."}
          </p>
        </div>

        <div className="schedule-heading-actions">
          <button
            type="button"
            className={`schedule-notif-toggle-btn${notificationsOpen ? " is-active" : ""}`}
            onClick={() => setNotificationsOpen((prev) => !prev)}
            title={
              pl
                ? "Ustawienia powiadomień e-mail"
                : "Email notification settings"
            }
          >
            <IconBell size={16} aria-hidden="true" />
            <span>{pl ? "Powiadomienia" : "Notifications"}</span>
          </button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setEditingMedicationSchedule(null);
              setMedicationDefaultDate(
                displayLayout !== "agenda" ? selectedDayIso : undefined,
              );
              setMedicationDialogOpen(true);
            }}
          >
            <IconPill size={16} aria-hidden="true" />
            {pl ? "Zaplanuj lek" : "Schedule medication"}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() =>
              openNewDialogForDate(
                displayLayout !== "agenda" ? selectedDayIso : undefined,
              )
            }
          >
            <IconPlus size={16} aria-hidden="true" />
            {pl ? "Zaplanuj termin" : "Schedule item"}
          </Button>
        </div>
      </div>

      {notificationsOpen && (
        <div className="schedule-notifications-panel">
          <div className="schedule-notifications-header">
            <div>
              <strong>
                {pl
                  ? "Automatyczne przypomnienia e-mail"
                  : "Automatic email reminders"}
              </strong>
              <p>
                {pl
                  ? "Codziennie rano sprawdzamy nadchodzące wizyty oraz terminy szczepień i wysyłamy zestawienie na Twój adres e-mail."
                  : "Every morning we check upcoming visits and vaccination due dates and email you a summary."}
              </p>
            </div>
            <button
              type="button"
              className="schedule-mini-btn"
              onClick={() => setNotificationsOpen(false)}
              aria-label={pl ? "Zamknij" : "Close"}
            >
              <IconX size={14} aria-hidden="true" />
            </button>
          </div>

          <div className="schedule-notifications-controls">
            <label className="schedule-notif-check">
              <input
                type="checkbox"
                checked={notifSettings.email_enabled}
                onChange={(e) =>
                  setNotifSettings((prev) => ({
                    ...prev,
                    email_enabled: e.target.checked,
                  }))
                }
              />
              <span>
                {pl ? "Włącz powiadomienia e-mail" : "Enable email reminders"}
              </span>
            </label>

            <label className="schedule-notif-check">
              <input
                type="checkbox"
                disabled={!notifSettings.email_enabled}
                checked={notifSettings.notify_7_days_before}
                onChange={(e) =>
                  setNotifSettings((prev) => ({
                    ...prev,
                    notify_7_days_before: e.target.checked,
                  }))
                }
              />
              <span>{pl ? "7 dni przed terminem" : "7 days before"}</span>
            </label>

            <label className="schedule-notif-check">
              <input
                type="checkbox"
                disabled={!notifSettings.email_enabled}
                checked={notifSettings.notify_1_day_before}
                onChange={(e) =>
                  setNotifSettings((prev) => ({
                    ...prev,
                    notify_1_day_before: e.target.checked,
                  }))
                }
              />
              <span>{pl ? "1 dzień przed (jutro)" : "1 day before"}</span>
            </label>

            <label className="schedule-notif-check">
              <input
                type="checkbox"
                disabled={!notifSettings.email_enabled}
                checked={notifSettings.notify_day_of}
                onChange={(e) =>
                  setNotifSettings((prev) => ({
                    ...prev,
                    notify_day_of: e.target.checked,
                  }))
                }
              />
              <span>{pl ? "W dniu terminu rano" : "On the day of"}</span>
            </label>
          </div>

          <div className="schedule-notifications-footer">
            <div className="schedule-notif-email-field">
              <label htmlFor="schedule-notif-custom-email">
                {pl
                  ? "Adres odbiorcy (zostaw puste, aby użyć adresu konta):"
                  : "Recipient email (leave blank to use account email):"}
              </label>
              <input
                id="schedule-notif-custom-email"
                type="email"
                value={notifSettings.custom_email}
                onChange={(e) =>
                  setNotifSettings((prev) => ({
                    ...prev,
                    custom_email: e.target.value,
                  }))
                }
                placeholder={
                  pl ? "Domyślnie: e-mail właściciela konta" : "Default: account email"
                }
              />
            </div>

            <div className="schedule-notif-actions">
              <button
                type="button"
                className="history-action-btn"
                disabled={notifTesting || notifSaving}
                onClick={() => void handleSendTestDigest()}
              >
                <IconMailForward size={15} aria-hidden="true" />
                <span>
                  {notifTesting
                    ? pl
                      ? "Wysyłanie…"
                      : "Sending…"
                    : pl
                      ? "Wyślij test na e-mail"
                      : "Send test email"}
                </span>
              </button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={notifSaving || notifTesting}
                onClick={() => void handleSaveNotifications()}
              >
                {notifSaving
                  ? pl
                    ? "Zapisywanie…"
                    : "Saving…"
                  : pl
                    ? "Zapisz ustawienia"
                    : "Save settings"}
              </Button>
            </div>
          </div>

          {notifFeedback && (
            <p
              className={`schedule-notif-feedback is-${notifFeedback.type}`}
              role="status"
            >
              {notifFeedback.text}
            </p>
          )}
        </div>
      )}

      {/* Google Calendar Controls Toolbar */}
      <div className="schedule-gcal-toolbar">
        <div className="schedule-gcal-nav-left">
          <button
            type="button"
            className={`schedule-today-btn${selectedDayIso === todayIso ? " is-current" : ""}`}
            onClick={jumpToToday}
            title={
              pl
                ? `Przejdź do dzisiaj (${formatShortDay(todayIso)})`
                : `Jump to today (${formatShortDay(todayIso)})`
            }
          >
            {pl ? "Dzisiaj" : "Today"}
          </button>

          <div className="schedule-gcal-arrows">
            <button
              type="button"
              className="schedule-nav-arrow-btn"
              onClick={() => handleNavigate(-1)}
              aria-label={pl ? "Poprzedni okres" : "Previous period"}
              title={pl ? "Poprzedni okres" : "Previous period"}
            >
              <IconChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="schedule-nav-arrow-btn"
              onClick={() => handleNavigate(1)}
              aria-label={pl ? "Następny okres" : "Next period"}
              title={pl ? "Następny okres" : "Next period"}
            >
              <IconChevronRight size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="schedule-gcal-title-wrapper" ref={miniPickerRef}>
            <button
              type="button"
              className={`schedule-gcal-title-btn${miniPickerOpen ? " is-open" : ""}`}
              onClick={() => setMiniPickerOpen((prev) => !prev)}
              aria-expanded={miniPickerOpen}
              aria-haspopup="dialog"
              title={
                pl
                  ? "Kliknij, aby otworzyć mały kalendarz nawigacyjny"
                  : "Click to open navigation calendar"
              }
            >
              <h3 className="schedule-gcal-title">{activeHeadingTitle}</h3>
              <IconChevronDown
                size={18}
                aria-hidden="true"
                className={`schedule-gcal-title-chevron${miniPickerOpen ? " is-open" : ""}`}
              />
            </button>

            {displayLayout === "day" && selectedDayIso === todayIso && (
              <span className="schedule-gcal-today-badge">
                {pl ? "Dzisiaj" : "Today"}
              </span>
            )}

            {miniPickerOpen && (
              <div
                className="schedule-mini-picker-popover"
                role="dialog"
                aria-label={pl ? "Mały kalendarz nawigacyjny" : "Mini navigation calendar"}
              >
                <div className="schedule-mini-picker-header">
                  <strong className="schedule-mini-picker-title">
                    {miniMonthTitle}
                  </strong>
                  <div className="schedule-mini-picker-arrows">
                    <button
                      type="button"
                      className="schedule-mini-nav-btn"
                      onClick={() => shiftMiniMonth(-1)}
                      aria-label={pl ? "Poprzedni miesiąc" : "Previous month"}
                      title={pl ? "Poprzedni miesiąc" : "Previous month"}
                    >
                      <IconChevronLeft size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="schedule-mini-nav-btn"
                      onClick={() => shiftMiniMonth(1)}
                      aria-label={pl ? "Następny miesiąc" : "Next month"}
                      title={pl ? "Następny miesiąc" : "Next month"}
                    >
                      <IconChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="schedule-mini-picker-grid">
                  {weekdayLabels.map((label) => (
                    <div key={label} className="schedule-mini-weekday">
                      {label.slice(0, 2)}
                    </div>
                  ))}

                  {miniMonthCells.map((cell) => {
                    const isSelected = cell.iso === selectedDayIso;
                    const isToday = cell.iso === todayIso;
                    const isInWeek =
                      displayLayout === "week" &&
                      activeWeekIsoSet.has(cell.iso);
                    const hasEvents =
                      (entriesByDate.get(cell.iso)?.length ?? 0) > 0;

                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        className={`schedule-mini-cell${!cell.inCurrentMonth ? " is-outside" : ""}${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}${isInWeek ? " is-in-week" : ""}`}
                        onClick={() => {
                          setSelectedDayIso(cell.iso);
                          const [y, m] = cell.iso.split("-").map(Number);
                          if (y && m) {
                            setMonthCursor({ year: y, month: m - 1 });
                          }
                          setMiniPickerOpen(false);
                        }}
                        title={`${formatDate(cell.iso)}${hasEvents ? (pl ? " (zaplanowane pozycje)" : " (items scheduled)") : ""}`}
                      >
                        <span className="schedule-mini-cell-num">
                          {cell.dayNumber}
                        </span>
                        {hasEvents && (
                          <span
                            className="schedule-mini-cell-dot"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="schedule-mini-picker-footer">
                  <button
                    type="button"
                    className="schedule-mini-quick-btn"
                    onClick={() => {
                      jumpToToday();
                      setMiniPickerOpen(false);
                    }}
                  >
                    {pl ? "Idź do dzisiaj" : "Jump to today"}
                  </button>
                  <button
                    type="button"
                    className="schedule-mini-quick-btn is-close"
                    onClick={() => setMiniPickerOpen(false)}
                  >
                    {pl ? "Zamknij" : "Close"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="schedule-gcal-nav-right">
          <div
            className="schedule-layout-toggle"
            role="group"
            aria-label={pl ? "Widok terminarza" : "Schedule view"}
          >
            {viewButtons.map((btn) => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.id}
                  type="button"
                  className={`schedule-layout-btn${displayLayout === btn.id ? " is-active" : ""}`}
                  onClick={() => setDisplayLayout(btn.id)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="schedule-toolbar">
        <div className="schedule-filter-pills" role="group">
          {categoryButtons.map((btn) => (
            <button
              key={btn.id}
              type="button"
              className={`schedule-filter-pill${categoryFilter === btn.id ? " is-active" : ""}`}
              onClick={() => setCategoryFilter(btn.id)}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="schedule-toolbar-right">
          <div className="schedule-search-box">
            <IconSearch size={15} aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                pl
                  ? "Szukaj: np. Styczeń 2026, 14:30, wtorek, USG…"
                  : "Search: e.g. January 2026, 14:30, Tuesday, ultrasound…"
              }
              aria-label={
                pl ? "Szukaj w terminarzu" : "Search schedule"
              }
            />
            {searchQuery && (
              <button
                type="button"
                className="schedule-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label={pl ? "Wyczyść wyszukiwanie" : "Clear search"}
              >
                <IconX size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {!fixedPetId && pets.length > 1 && (
            <select
              aria-label={pl ? "Filtruj po pupilu" : "Filter by pet"}
              value={petFilter}
              onChange={(e) => setPetFilter(e.target.value)}
              className="schedule-pet-filter"
            >
              <option value="all">
                {pl ? "Wszystkie zwierzęta" : "All pets"}
              </option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.imie}
                </option>
              ))}
            </select>
          )}

          {displayLayout === "agenda" && archiveCount > 0 && (
            <div className="schedule-view-switch" role="group">
              <button
                type="button"
                className={`schedule-filter-pill${viewMode === "upcoming" ? " is-active" : ""}`}
                onClick={() => setViewMode("upcoming")}
              >
                {pl
                  ? `Nadchodzące (${activeCount})`
                  : `Upcoming (${activeCount})`}
              </button>
              <button
                type="button"
                className={`schedule-filter-pill${viewMode === "archive" ? " is-active" : ""}`}
                onClick={() => setViewMode("archive")}
              >
                {pl
                  ? `Zakończone (${archiveCount})`
                  : `Completed (${archiveCount})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {displayLayout === "month" && (
        <CalendarMonthView
          weekdayLabels={weekdayLabels}
          monthCells={monthCells}
          entriesByDate={entriesByDate}
          todayIso={todayIso}
          selectedDayIso={selectedDayIso}
          selectedDayEntries={selectedDayEntries}
          petMap={petMap}
          fixedPetId={fixedPetId}
          pl={pl}
          goToDayView={goToDayView}
          openNewDialogForDate={openNewDialogForDate}
          setSelectedDayIso={setSelectedDayIso}
          setDisplayLayout={setDisplayLayout}
          onAddMedication={(iso) => {
            setEditingMedicationSchedule(null);
            setMedicationDefaultDate(iso);
            setMedicationDialogOpen(true);
          }}
          formatDate={formatDate}
          renderCompactRow={renderCompactRow}
        />
      )}
      {displayLayout === "week" && (
        <CalendarWeekView
          weekDays={weekDays}
          entriesByDate={entriesByDate}
          todayIso={todayIso}
          selectedDayIso={selectedDayIso}
          petMap={petMap}
          fixedPetId={fixedPetId}
          pl={pl}
          busyKey={busyKey}
          goToDayView={goToDayView}
          setSelectedDayIso={setSelectedDayIso}
          openNewDialogForDate={openNewDialogForDate}
          onCompleteTarget={setCompletingTarget}
          onEditItem={(item) => {
            setEditingItem(item);
            setDialogDefaultDate(undefined);
            setDialogOpen(true);
          }}
        />
      )}
      {displayLayout === "day" && (
        <CalendarDayView
          previousLayout={previousLayout}
          pl={pl}
          dayTitle={dayTitle}
          selectedDayIso={selectedDayIso}
          todayIso={todayIso}
          selectedDayEntries={selectedDayEntries}
          setDisplayLayout={setDisplayLayout}
          onAddMedication={(iso) => {
            setEditingMedicationSchedule(null);
            setMedicationDefaultDate(iso);
            setMedicationDialogOpen(true);
          }}
          openNewDialogForDate={openNewDialogForDate}
          formatDate={formatDate}
          renderDayDetailCard={renderDayDetailCard}
        />
      )}
      {displayLayout === "agenda" && (
        <CalendarAgendaView
          groupedByMonth={groupedByMonth}
          searchQuery={searchQuery}
          viewMode={viewMode}
          pl={pl}
          collapsedMonths={collapsedMonths}
          setCollapsedMonths={setCollapsedMonths}
          renderCompactRow={renderCompactRow}
        />
      )}

      {dialogOpen && (
        <ScheduleDialog
          pets={pets}
          defaultPetId={
            fixedPetId ?? (petFilter !== "all" ? petFilter : pets[0]?.id)
          }
          defaultDate={dialogDefaultDate}
          item={editingItem}
          defaultCategory={
            categoryFilter === "all" || categoryFilter === "lab"
              ? "visit"
              : categoryFilter
          }
          onClose={() => {
            setDialogOpen(false);
            setEditingItem(null);
            setDialogDefaultDate(undefined);
          }}
          onOpenMedicationSchedule={(pId, date) => {
            setDialogOpen(false);
            setEditingItem(null);
            setEditingMedicationSchedule(null);
            setMedicationDefaultDate(date || dialogDefaultDate);
            setMedicationDialogOpen(true);
          }}
          onSave={(saved) => {
            setScheduleItems((prev) => {
              const exists = prev.some((row) => row.id === saved.id);
              return exists
                ? prev.map((row) => (row.id === saved.id ? saved : row))
                : [...prev, saved];
            });
            setSelectedDayIso(saved.scheduled_date);
            const [y, m] = saved.scheduled_date.split("-").map(Number);
            if (y && m) setMonthCursor({ year: y, month: m - 1 });
            setDialogOpen(false);
            setEditingItem(null);
            setDialogDefaultDate(undefined);
            router.refresh();
          }}
        />
      )}

      {completingTarget && (
        <ScheduleCompleteDialog
          target={completingTarget}
          onClose={() => setCompletingTarget(null)}
          onCompleted={({
            createdEvent,
            updatedScheduleItem,
            clearedDueEventId,
          }) => {
            if (updatedScheduleItem) {
              setScheduleItems((prev) =>
                prev.map((row) =>
                  row.id === updatedScheduleItem.id ? updatedScheduleItem : row,
                ),
              );
            }
            setHealthEvents((prev) => {
              const next = clearedDueEventId
                ? prev.map((ev) =>
                    ev.id === clearedDueEventId
                      ? { ...ev, next_due_date: null }
                      : ev,
                  )
                : prev;
              return [createdEvent, ...next];
            });
            setCompletingTarget(null);
            router.refresh();
          }}
        />
      )}

      {medicationDialogOpen && (
        <MedicationDialog
          pets={pets}
          defaultPetId={fixedPetId}
          defaultDate={medicationDefaultDate}
          schedule={editingMedicationSchedule}
          onClose={() => {
            setMedicationDialogOpen(false);
            setEditingMedicationSchedule(null);
            setMedicationDefaultDate(undefined);
          }}
          onSave={(saved) => {
            setMedicationSchedules((prev) => {
              const exists = prev.some((row) => row.id === saved.id);
              return exists
                ? prev.map((row) => (row.id === saved.id ? saved : row))
                : [...prev, saved];
            });
            setSelectedDayIso(saved.start_date);
            const [y, m] = saved.start_date.split("-").map(Number);
            if (y && m) setMonthCursor({ year: y, month: m - 1 });
            setMedicationDialogOpen(false);
            setEditingMedicationSchedule(null);
            setMedicationDefaultDate(undefined);
            router.refresh();
          }}
          onDelete={(id) => {
            setMedicationSchedules((prev) => prev.filter((row) => row.id !== id));
            setMedicationDialogOpen(false);
            setEditingMedicationSchedule(null);
            setMedicationDefaultDate(undefined);
            router.refresh();
          }}
        />
      )}
      {futureDoseNotice && (
        <FutureDoseDialog
          dose={futureDoseNotice}
          petName={petMap.get(futureDoseNotice.pet_id)}
          onClose={() => setFutureDoseNotice(null)}
        />
      )}
      {skipDoseTarget && (
        <SkipDoseDialog
          dose={skipDoseTarget}
          petName={petMap.get(skipDoseTarget.pet_id)}
          isSaving={isSavingSkip}
          onClose={() => setSkipDoseTarget(null)}
          onConfirm={async (notes) => {
            setIsSavingSkip(true);
            try {
              const success = await handleRecordDose(
                skipDoseTarget,
                "skipped",
                notes,
              );
              if (success) {
                setSkipDoseTarget(null);
              }
            } finally {
              setIsSavingSkip(false);
            }
          }}
        />
      )}
    </section>
  );
}
