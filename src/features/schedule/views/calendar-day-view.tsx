"use client";

import type React from "react";
import {
  IconArrowLeft,
  IconCalendar,
  IconPill,
  IconPlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { DisplayLayout, UnifiedScheduleEntry } from "../calendar-utils";

interface CalendarDayViewProps {
  previousLayout: DisplayLayout;
  pl: boolean;
  dayTitle: string;
  selectedDayIso: string;
  todayIso: string;
  selectedDayEntries: UnifiedScheduleEntry[];
  setDisplayLayout: (layout: DisplayLayout) => void;
  onAddMedication: (iso: string) => void;
  openNewDialogForDate: (iso: string) => void;
  formatDate: (iso: string) => string;
  renderDayDetailCard: (entry: UnifiedScheduleEntry) => React.ReactNode;
  readOnly?: boolean;
}

export function CalendarDayView({
  previousLayout,
  pl,
  dayTitle,
  selectedDayIso,
  todayIso,
  selectedDayEntries,
  setDisplayLayout,
  onAddMedication,
  openNewDialogForDate,
  formatDate,
  renderDayDetailCard,
  readOnly = false,
}: CalendarDayViewProps) {
  return (
    <div className="schedule-day-view-panel">
      <div className="schedule-day-view-header">
        <div className="schedule-day-view-title-block flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className="history-action-btn flex items-center gap-1.5 text-xs font-semibold py-1 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            onClick={() => setDisplayLayout(previousLayout)}
            title={
              previousLayout === "week"
                ? pl
                  ? "Wróć do widoku tygodnia"
                  : "Back to week view"
                : pl
                  ? "Wróć do widoku miesiąca"
                  : "Back to month view"
            }
          >
            <IconArrowLeft size={15} aria-hidden="true" />
            <span>
              {previousLayout === "week"
                ? pl
                  ? "Widok tygodnia"
                  : "Week view"
                : pl
                  ? "Widok miesiąca"
                  : "Month view"}
            </span>
          </button>
          <h3 className="m-0 text-base font-bold">{dayTitle}</h3>
          {selectedDayIso === todayIso && (
            <span className="schedule-gcal-today-badge">
              {pl ? "Dzisiaj" : "Today"}
            </span>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onAddMedication(selectedDayIso)}
            >
              <IconPill size={16} aria-hidden="true" />
              {pl ? "Dodaj lek" : "Add medication"}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => openNewDialogForDate(selectedDayIso)}
            >
              <IconPlus size={16} aria-hidden="true" />
              {pl ? "Dodaj termin" : "Add item on this day"}
            </Button>
          </div>
        )}
      </div>

      {selectedDayEntries.length === 0 ? (
        <div className="schedule-day-empty-state">
          <div className="schedule-day-empty-icon">
            <IconCalendar size={32} stroke={1.5} aria-hidden="true" />
          </div>
          <h4>
            {pl
              ? `Brak terminów na ${formatDate(selectedDayIso)}`
              : `No items scheduled on ${formatDate(selectedDayIso)}`}
          </h4>
          <p>
            {pl
              ? "Nie masz zaplanowanych wizyt u weterynarza, szczepień ani przypomnień na ten termin."
              : "You have no vet visits, vaccinations, or reminders scheduled for this date."}
          </p>
          {!readOnly && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => openNewDialogForDate(selectedDayIso)}
            >
              <IconPlus size={16} aria-hidden="true" />
              <span>
                {pl ? "Zaplanuj wizytę lub badanie" : "Schedule visit or test"}
              </span>
            </Button>
          )}
        </div>
      ) : (
        <div className="schedule-day-entries-timeline">
          <ul className="schedule-day-entries-list">
            {selectedDayEntries.map((entry) => renderDayDetailCard(entry))}
          </ul>
        </div>
      )}
    </div>
  );
}
