"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
  IconBan,
  IconCalendar,
  IconCalendarMonth,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconList,
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
import type { ScheduleCategory, ScheduleItem } from "./types";
import {
  ScheduleCompleteDialog,
  ScheduleDialog,
  type CompleteTarget,
} from "./schedule-dialog";

type FilterCategory = "all" | ScheduleCategory;
type ViewMode = "upcoming" | "archive";
type DisplayLayout = "list" | "month";

type UnifiedScheduleEntry =
  | {
      kind: "schedule_item";
      key: string;
      petId: string;
      category: ScheduleCategory;
      title: string;
      date: string;
      time: string;
      clinic: string;
      doctor: string;
      prepNotes: string;
      status: "planned" | "completed" | "cancelled";
      item: ScheduleItem;
    }
  | {
      kind: "due_event";
      key: string;
      petId: string;
      category: ScheduleCategory;
      title: string;
      date: string;
      time: string;
      clinic: string;
      doctor: string;
      batchOrProduct: string;
      lastEventDate: string;
      status: "planned";
      event: HealthEvent;
    };

const PL_MONTH_ALIASES: Record<string, string> = {
  "01": "styczen stycznia sty january jan",
  "02": "luty lutego lut february feb",
  "03": "marzec marca mar march",
  "04": "kwiecien kwietnia kwi april apr",
  "05": "maj maja may",
  "06": "czerwiec czerwca cze june jun",
  "07": "lipiec lipca lip july jul",
  "08": "sierpien sierpnia sie august aug",
  "09": "wrzesien wrzesnia wrz september sep",
  "10": "pazdziernik pazdziernika paz october oct",
  "11": "listopad listopada lis november nov",
  "12": "grudzien grudnia gru december dec",
};

function foldText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

function buildSearchHaystack(
  entry: UnifiedScheduleEntry,
  petName: string,
): string {
  const [y = "", m = "", d = ""] = entry.date.split("-");
  const monthAliases = PL_MONTH_ALIASES[m] ?? "";
  const categoryAliases =
    entry.category === "vaccination"
      ? "szczepienie szczepienia vaccination vaccine"
      : entry.category === "prevention"
        ? "profilaktyka odrobaczanie kleszcze leki lek prevention medication"
        : "wizyta kontrola badanie visit checkup";

  const extra =
    entry.kind === "schedule_item"
      ? entry.prepNotes
      : `${entry.batchOrProduct} ${entry.lastEventDate}`;

  return foldText(
    [
      entry.title,
      petName,
      entry.clinic,
      entry.doctor,
      entry.date,
      `${d}.${m}.${y}`,
      `${d}/${m}/${y}`,
      `${m}.${y}`,
      y,
      monthAliases,
      categoryAliases,
      extra,
    ].join(" "),
  );
}

function buildMonthGrid(year: number, monthIndex: number) {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const startOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const startDate = new Date(Date.UTC(year, monthIndex, 1 - startOffset));

  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const cells: {
    iso: string;
    dayNumber: number;
    inCurrentMonth: boolean;
  }[] = [];

  for (let i = 0; i < totalCells; i++) {
    const d = new Date(
      Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate() + i,
      ),
    );
    const iso = d.toISOString().slice(0, 10);
    cells.push({
      iso,
      dayNumber: d.getUTCDate(),
      inCurrentMonth: d.getUTCMonth() === monthIndex,
    });
  }

  return cells;
}

export function HouseholdSchedule({
  pets,
  initialScheduleItems,
  initialHealthEvents,
  fixedPetId,
}: {
  pets: Pick<Pet, "id" | "imie">[];
  initialScheduleItems: ScheduleItem[];
  initialHealthEvents: HealthEvent[];
  fixedPetId?: string;
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

  const [scheduleItems, setScheduleItems] =
    useState<ScheduleItem[]>(initialScheduleItems);
  const [healthEvents, setHealthEvents] =
    useState<HealthEvent[]>(initialHealthEvents);

  const [displayLayout, setDisplayLayout] = useState<DisplayLayout>("list");
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
    if (!highlightedKey || displayLayout !== "list") return;
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

  const formatMonthHeading = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    if (!y || !m) return ym;
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, 1)));
  };

  const monthTitle = useMemo(() => {
    const d = new Date(Date.UTC(monthCursor.year, monthCursor.month, 1));
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  }, [monthCursor, locale]);

  const weekdayLabels = useMemo(
    () =>
      pl
        ? ["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"]
        : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    [pl],
  );

  const allEntries = useMemo<UnifiedScheduleEntry[]>(() => {
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

    return [...manualEntries, ...dueEntries].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time || "99:99").localeCompare(b.time || "99:99"),
    );
  }, [scheduleItems, healthEvents]);

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
          label: formatMonthHeading(ym),
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
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
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

  function focusEntryInList(entry: UnifiedScheduleEntry) {
    const ym = entry.date.slice(0, 7);
    setCollapsedMonths((prev) => ({ ...prev, [ym]: false }));
    setSearchQuery("");
    setViewMode(entry.status === "planned" ? "upcoming" : "archive");
    setDisplayLayout("list");
    setHighlightedKey(entry.key);
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

  const categoryButtons: { id: FilterCategory; label: string }[] = [
    { id: "all", label: pl ? "Wszystkie" : "All" },
    { id: "visit", label: pl ? "Wizyty" : "Visits" },
    { id: "vaccination", label: pl ? "Szczepienia" : "Vaccinations" },
    { id: "prevention", label: pl ? "Profilaktyka i leki" : "Prevention & meds" },
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
          : IconStethoscope;
    const categoryLabel =
      entry.category === "vaccination"
        ? pl
          ? "Szczepienie"
          : "Vaccination"
        : entry.category === "prevention"
          ? pl
            ? "Profilaktyka"
            : "Prevention"
          : pl
            ? "Wizyta"
            : "Visit";

    const isBusy = busyKey === entry.key;
    const hasNotes = entry.kind === "schedule_item" && entry.prepNotes.trim().length > 0;
    const notesOpen = expandedNotesKey === entry.key || highlightedKey === entry.key;

    const metaParts: string[] = [];
    if (entry.clinic) metaParts.push(entry.clinic);
    if (entry.doctor) metaParts.push(entry.doctor);
    if (entry.kind === "due_event" && entry.batchOrProduct) {
      metaParts.push(entry.batchOrProduct);
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

            {entry.status === "planned" && (
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

            {entry.kind === "due_event" && (
              <Link
                href={`/app/zwierzeta/${entry.petId}?tab=history`}
                className="schedule-mini-btn"
                title={pl ? "Zobacz źródło w historii zdrowia" : "View in history"}
              >
                <span>{pl ? "Historia →" : "History →"}</span>
              </Link>
            )}
          </div>
        </div>

        {hasNotes && notesOpen && entry.kind === "schedule_item" && (
          <div className="schedule-compact-notes">
            <IconNotes size={14} aria-hidden="true" />
            <p>{entry.prepNotes}</p>
          </div>
        )}
      </li>
    );
  }

  return (
    <section className="household-calendar">
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
          <div
            className="schedule-layout-toggle"
            role="group"
            aria-label={pl ? "Widok terminarza" : "Schedule view"}
          >
            <button
              type="button"
              className={`schedule-layout-btn${displayLayout === "list" ? " is-active" : ""}`}
              onClick={() => setDisplayLayout("list")}
            >
              <IconList size={16} aria-hidden="true" />
              <span>{pl ? "Lista" : "List"}</span>
            </button>
            <button
              type="button"
              className={`schedule-layout-btn${displayLayout === "month" ? " is-active" : ""}`}
              onClick={() => setDisplayLayout("month")}
            >
              <IconCalendarMonth size={16} aria-hidden="true" />
              <span>{pl ? "Kalendarz" : "Calendar"}</span>
            </button>
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() =>
              openNewDialogForDate(
                displayLayout === "month" ? selectedDayIso : undefined,
              )
            }
          >
            <IconPlus size={16} aria-hidden="true" />
            {pl ? "Zaplanuj termin" : "Schedule item"}
          </Button>
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
                  ? "Szukaj: np. Styczeń 2026, USG, szczepienie…"
                  : "Search: e.g. January 2026, ultrasound, rabies…"
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

          {displayLayout === "list" && archiveCount > 0 && (
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

      {displayLayout === "month" ? (
        <div className="schedule-month-wrapper">
          <div className="schedule-month-bar">
            <div className="schedule-month-nav">
              <button
                type="button"
                className="schedule-month-nav-btn"
                onClick={() => shiftMonth(-1)}
                aria-label={pl ? "Poprzedni miesiąc" : "Previous month"}
              >
                <IconChevronLeft size={18} aria-hidden="true" />
              </button>
              <strong className="schedule-month-title">{monthTitle}</strong>
              <button
                type="button"
                className="schedule-month-nav-btn"
                onClick={() => shiftMonth(1)}
                aria-label={pl ? "Następny miesiąc" : "Next month"}
              >
                <IconChevronRight size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="schedule-month-actions">
              <button
                type="button"
                className="history-action-btn"
                onClick={jumpToToday}
              >
                {pl ? "Dzisiaj" : "Today"}
              </button>
              <button
                type="button"
                className="history-action-link is-primary"
                onClick={() => openNewDialogForDate(selectedDayIso)}
              >
                <IconPlus size={15} aria-hidden="true" />
                <span>
                  {pl
                    ? `Dodaj na ${formatDate(selectedDayIso)}`
                    : `Add on ${formatDate(selectedDayIso)}`}
                </span>
              </button>
            </div>
          </div>

          <div className="schedule-month-grid" role="grid">
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="schedule-weekday-header"
                role="columnheader"
              >
                {label}
              </div>
            ))}

            {monthCells.map((cell) => {
              const dayItems = entriesByDate.get(cell.iso) ?? [];
              const isToday = cell.iso === todayIso;
              const isSelected = cell.iso === selectedDayIso;

              return (
                <div
                  key={cell.iso}
                  role="gridcell"
                  tabIndex={0}
                  aria-selected={isSelected}
                  onClick={() => setSelectedDayIso(cell.iso)}
                  onDoubleClick={() => openNewDialogForDate(cell.iso)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDayIso(cell.iso);
                    }
                  }}
                  className={`schedule-day-cell${!cell.inCurrentMonth ? " is-outside" : ""}${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}`}
                >
                  <div className="schedule-day-top">
                    <span className="schedule-day-num">{cell.dayNumber}</span>
                    <button
                      type="button"
                      className="schedule-day-add"
                      title={
                        pl
                          ? `Zaplanuj termin na ${cell.iso}`
                          : `Schedule on ${cell.iso}`
                      }
                      aria-label={
                        pl
                          ? `Zaplanuj termin na ${cell.iso}`
                          : `Schedule on ${cell.iso}`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDayIso(cell.iso);
                        openNewDialogForDate(cell.iso);
                      }}
                    >
                      +
                    </button>
                  </div>

                  <div className="schedule-day-events">
                    {dayItems.slice(0, 3).map((ev) => {
                      const pName = petMap.get(ev.petId);
                      const isOverdue =
                        ev.status === "planned" && ev.date < todayIso;
                      return (
                        <button
                          key={ev.key}
                          type="button"
                          title={
                            pl
                              ? `${ev.title} — kliknij, aby przejść do szczegółów na liście`
                              : `${ev.title} — click to view details in list`
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            focusEntryInList(ev);
                          }}
                          className={`schedule-day-pill is-${ev.category}${ev.status === "completed" ? " is-completed" : ""}${isOverdue ? " is-overdue" : ""}`}
                        >
                          {ev.time ? `${ev.time} ` : ""}
                          {!fixedPetId && pName ? `${pName}: ` : ""}
                          {ev.title}
                        </button>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <small className="schedule-day-more">
                        +{dayItems.length - 3}{" "}
                        {pl ? "więcej" : "more"}
                      </small>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="schedule-selected-day-panel">
            <div className="schedule-selected-day-header">
              <h3>
                {pl
                  ? `Terminy w dniu ${formatDate(selectedDayIso)}`
                  : `Items on ${formatDate(selectedDayIso)}`}
              </h3>
              <button
                type="button"
                className="history-action-btn"
                onClick={() => openNewDialogForDate(selectedDayIso)}
              >
                <IconPlus size={15} aria-hidden="true" />
                <span>
                  {pl ? "Dodaj termin w tym dniu" : "Add item on this day"}
                </span>
              </button>
            </div>

            {selectedDayEntries.length === 0 ? (
              <p className="schedule-selected-day-empty">
                {pl
                  ? "Brak zaplanowanych wizyt ani przypomnień w tym dniu. Kliknij przycisk powyżej lub „+” w kratce dnia, aby dodać termin."
                  : "No scheduled visits or reminders on this day. Click the button above or “+” on the day cell to add one."}
              </p>
            ) : (
              <ul className="schedule-compact-list">
                {selectedDayEntries.map((entry) => renderCompactRow(entry))}
              </ul>
            )}
          </div>
        </div>
      ) : groupedByMonth.length === 0 ? (
        <div className="household-calendar-empty">
          <IconCalendar size={30} stroke={1.4} aria-hidden="true" />
          <div>
            <h3>
              {searchQuery.trim()
                ? pl
                  ? `Brak wyników dla „${searchQuery.trim()}”`
                  : `No matches for “${searchQuery.trim()}”`
                : viewMode === "upcoming"
                  ? pl
                    ? "Brak zaplanowanych terminów dla wybranych filtrów"
                    : "No scheduled items for selected filters"
                  : pl
                    ? "Brak zakończonych lub odwołanych pozycji"
                    : "No completed or cancelled items"}
            </h3>
            <p>
              {searchQuery.trim()
                ? pl
                  ? "Spróbuj wpisać inną nazwę miesiąca (np. „Październik 2026”), nazwę zabiegu lub imię zwierzaka."
                  : "Try another month name (e.g. “October 2026”), procedure title, or pet name."
                : pl
                  ? "Kliknij „Zaplanuj termin”, aby dodać wizytę weterynaryjną z notatkami przedwizytowymi lub przypomnienie o szczepieniu/leku."
                  : "Click “Schedule item” to add a vet visit with pre-visit notes or a vaccination/medication reminder."}
            </p>
          </div>
        </div>
      ) : (
        <div className="schedule-month-groups">
          {groupedByMonth.map((group) => {
            const isCollapsed = !!collapsedMonths[group.ym];
            return (
              <div key={group.ym} className="schedule-month-group">
                <button
                  type="button"
                  className="schedule-month-group-header"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsedMonths((prev) => ({
                      ...prev,
                      [group.ym]: !prev[group.ym],
                    }))
                  }
                >
                  <IconChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`schedule-group-chevron${isCollapsed ? " is-collapsed" : ""}`}
                  />
                  <strong>{group.label}</strong>
                  <span className="schedule-group-count">
                    {group.items.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <ul className="schedule-compact-list">
                    {group.items.map((entry) => renderCompactRow(entry))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
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
            categoryFilter === "all" ? "visit" : categoryFilter
          }
          onClose={() => {
            setDialogOpen(false);
            setEditingItem(null);
            setDialogDefaultDate(undefined);
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
    </section>
  );
}
