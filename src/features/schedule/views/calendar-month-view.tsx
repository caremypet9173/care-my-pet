"use client";

import type React from "react";
import { IconCalendarEvent, IconPill, IconPlus } from "@tabler/icons-react";
import type { DisplayLayout, UnifiedScheduleEntry } from "../calendar-utils";

type MobileDotType =
  | "overdue"
  | "visit"
  | "vaccination"
  | "lab"
  | "prevention"
  | "skipped"
  | "completed";

const DOT_PRIORITY: readonly MobileDotType[] = [
  "overdue",
  "visit",
  "vaccination",
  "lab",
  "prevention",
  "skipped",
  "completed",
];

/** Wybiera maksymalnie 4 unikalne znaczniki statusu/kategorii dla widoku kropkowego na mobile. */
function getMobileDotMarkers(
  dayItems: UnifiedScheduleEntry[],
  todayIso: string,
): MobileDotType[] {
  if (dayItems.length === 0) return [];
  const present = new Set<MobileDotType>();
  for (const ev of dayItems) {
    if (ev.status === "planned" && ev.date < todayIso) {
      present.add("overdue");
    } else if (ev.status === "completed") {
      present.add("completed");
    } else if (ev.status === "skipped") {
      present.add("skipped");
    } else {
      present.add(ev.category);
    }
  }
  return DOT_PRIORITY.filter((type) => present.has(type)).slice(0, 4);
}

interface CalendarMonthViewProps {
  weekdayLabels: string[];
  monthCells: Array<{
    iso: string;
    dayNumber: number;
    inCurrentMonth: boolean;
  }>;
  entriesByDate: Map<string, UnifiedScheduleEntry[]>;
  todayIso: string;
  selectedDayIso: string;
  selectedDayEntries: UnifiedScheduleEntry[];
  petMap: Map<string, string>;
  fixedPetId?: string;
  pl: boolean;
  goToDayView: (iso: string) => void;
  openNewDialogForDate: (iso: string) => void;
  setSelectedDayIso: (iso: string) => void;
  setDisplayLayout: (layout: DisplayLayout) => void;
  onAddMedication: (iso: string) => void;
  formatDate: (iso: string) => string;
  renderCompactRow: (entry: UnifiedScheduleEntry) => React.ReactNode;
  readOnly?: boolean;
}

export function CalendarMonthView({
  weekdayLabels,
  monthCells,
  entriesByDate,
  todayIso,
  selectedDayIso,
  selectedDayEntries,
  petMap,
  fixedPetId,
  pl,
  goToDayView,
  openNewDialogForDate,
  setSelectedDayIso,
  setDisplayLayout,
  onAddMedication,
  formatDate,
  renderCompactRow,
  readOnly = false,
}: CalendarMonthViewProps) {
  function handleCellSelect(iso: string) {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 48rem)").matches
    ) {
      setSelectedDayIso(iso);
    } else {
      goToDayView(iso);
    }
  }

  const monthWeeks: (typeof monthCells)[] = [];
  for (let i = 0; i < monthCells.length; i += 7) {
    monthWeeks.push(monthCells.slice(i, i + 7));
  }

  return (
    <div className="schedule-month-wrapper">
      <div
        className="schedule-month-grid"
        role="grid"
        aria-label={pl ? "Kalendarz miesiąca" : "Monthly calendar"}
      >
        <div role="row" style={{ display: "contents" }}>
          {weekdayLabels.map((label) => (
            <div
              key={label}
              className="schedule-weekday-header"
              role="columnheader"
            >
              {label}
            </div>
          ))}
        </div>

        {monthWeeks.map((week, weekIdx) => (
          <div key={week[0]?.iso ?? weekIdx} role="row" style={{ display: "contents" }}>
            {week.map((cell) => {
          const dayItems = entriesByDate.get(cell.iso) ?? [];
          const dayDots = getMobileDotMarkers(dayItems, todayIso);
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === selectedDayIso;

          return (
            <div
              key={cell.iso}
              role="gridcell"
              tabIndex={0}
              aria-selected={isSelected}
              onClick={() => handleCellSelect(cell.iso)}
              onDoubleClick={() => {
                if (!readOnly) openNewDialogForDate(cell.iso);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCellSelect(cell.iso);
                }
              }}
              className={`schedule-day-cell${!cell.inCurrentMonth ? " is-outside" : ""}${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""} cursor-pointer`}
            >
              <div className="schedule-day-top">
                <span className="schedule-day-num">{cell.dayNumber}</span>
                {!readOnly && (
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
                )}
              </div>

              {dayDots.length > 0 && (
                <div className="schedule-day-dots" aria-hidden="true">
                  {dayDots.map((dotType) => (
                    <span
                      key={dotType}
                      className={`schedule-day-dot is-${dotType}`}
                    />
                  ))}
                </div>
              )}

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
                          ? `${ev.title} — kliknij, aby otworzyć widok dnia`
                          : `${ev.title} — click to open day view`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        goToDayView(cell.iso);
                      }}
                      className={`schedule-day-pill is-${ev.category}${ev.status === "completed" ? " is-completed" : ""}${ev.status === "skipped" ? " is-skipped" : ""}${isOverdue ? " is-overdue" : ""}`}
                    >
                      {ev.time ? `${ev.time} ` : ""}
                      {!fixedPetId && pName ? `${pName}: ` : ""}
                      {ev.title}
                    </button>
                  );
                })}
                {dayItems.length > 3 && (
                  <small
                    className="schedule-day-more cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      goToDayView(cell.iso);
                    }}
                  >
                    +{dayItems.length - 3} {pl ? "więcej" : "more"}
                  </small>
                )}
              </div>
            </div>
          );
            })}
          </div>
        ))}
      </div>

      <div className="schedule-selected-day-panel">
        <div className="schedule-selected-day-header">
          <h3>
            {pl
              ? `Terminy w dniu ${formatDate(selectedDayIso)}`
              : `Items on ${formatDate(selectedDayIso)}`}
            {selectedDayIso === todayIso && (
              <span className="schedule-gcal-today-badge">
                {pl ? "Dzisiaj" : "Today"}
              </span>
            )}
          </h3>
          <div className="schedule-selected-day-actions">
            <button
              type="button"
              className="history-action-btn"
              onClick={() => setDisplayLayout("day")}
              title={pl ? "Przejdź do widoku dnia" : "Go to day view"}
            >
              <IconCalendarEvent size={15} aria-hidden="true" />
              <span>{pl ? "Widok dnia" : "Day view"}</span>
            </button>
            {!readOnly && (
              <>
                <button
                  type="button"
                  className="history-action-btn"
                  onClick={() => onAddMedication(selectedDayIso)}
                  title={
                    pl
                      ? "Zaplanuj lek w tym dniu"
                      : "Schedule medication on this day"
                  }
                >
                  <IconPill size={15} aria-hidden="true" />
                  <span>{pl ? "Dodaj lek" : "Add medication"}</span>
                </button>
                <button
                  type="button"
                  className="history-action-btn is-primary"
                  onClick={() => openNewDialogForDate(selectedDayIso)}
                >
                  <IconPlus size={15} aria-hidden="true" />
                  <span>{pl ? "Dodaj termin" : "Add item"}</span>
                </button>
              </>
            )}
          </div>
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
  );
}
