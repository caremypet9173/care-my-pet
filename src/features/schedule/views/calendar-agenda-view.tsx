"use client";

import type React from "react";
import { IconCalendar, IconChevronDown } from "@tabler/icons-react";
import type { UnifiedScheduleEntry, ViewMode } from "../calendar-utils";

interface CalendarAgendaViewProps {
  groupedByMonth: Array<{
    ym: string;
    label: string;
    items: UnifiedScheduleEntry[];
  }>;
  searchQuery: string;
  viewMode: ViewMode;
  pl: boolean;
  collapsedMonths: Record<string, boolean>;
  setCollapsedMonths: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  renderCompactRow: (entry: UnifiedScheduleEntry) => React.ReactNode;
}

export function CalendarAgendaView({
  groupedByMonth,
  searchQuery,
  viewMode,
  pl,
  collapsedMonths,
  setCollapsedMonths,
  renderCompactRow,
}: CalendarAgendaViewProps) {
  if (groupedByMonth.length === 0) {
    return (
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
    );
  }

  return (
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
  );
}
