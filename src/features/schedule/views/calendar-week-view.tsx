"use client";

import { IconCheck, IconPencil } from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import type { ScheduleItem } from "../types";
import type { CompleteTarget } from "../schedule-dialog";
import type { UnifiedScheduleEntry } from "../calendar-utils";

interface CalendarWeekViewProps {
  weekDays: Array<{
    iso: string;
    dayNum: number;
    isToday: boolean;
    weekdayName: string;
    weekdayFull: string;
  }>;
  entriesByDate: Map<string, UnifiedScheduleEntry[]>;
  todayIso: string;
  selectedDayIso: string;
  petMap: Map<string, string>;
  fixedPetId?: string;
  pl: boolean;
  busyKey: string | null;
  goToDayView: (iso: string) => void;
  setSelectedDayIso: (iso: string) => void;
  openNewDialogForDate: (iso: string) => void;
  onCompleteTarget: (target: CompleteTarget) => void;
  onEditItem: (item: ScheduleItem) => void;
}

export function CalendarWeekView({
  weekDays,
  entriesByDate,
  todayIso,
  selectedDayIso,
  petMap,
  fixedPetId,
  pl,
  busyKey,
  goToDayView,
  setSelectedDayIso,
  openNewDialogForDate,
  onCompleteTarget,
  onEditItem,
}: CalendarWeekViewProps) {
  return (
    <div className="schedule-week-wrapper">
      <div className="schedule-week-grid" role="grid">
        {weekDays.map((day) => {
          const dayEntries = entriesByDate.get(day.iso) ?? [];
          const isSelected = day.iso === selectedDayIso;

          return (
            <div
              key={day.iso}
              className={`schedule-week-col${day.isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""} cursor-pointer`}
              role="gridcell"
              onClick={() => goToDayView(day.iso)}
            >
              <div
                className="schedule-week-col-header"
                title={
                  pl
                    ? `Kliknij, aby otworzyć widok dnia dla ${day.weekdayFull}`
                    : `Click to open day view for ${day.weekdayFull}`
                }
                onClick={(e) => {
                  e.stopPropagation();
                  goToDayView(day.iso);
                }}
              >
                <div className="schedule-week-col-header-info">
                  <span className="schedule-week-weekday">
                    {day.weekdayName}
                  </span>
                  <span
                    className={`schedule-week-daynum${day.isToday ? " is-today" : ""}`}
                  >
                    {day.dayNum}
                  </span>
                </div>
                <button
                  type="button"
                  className="schedule-week-quick-add"
                  title={
                    pl
                      ? `Zaplanuj termin na ${day.iso}`
                      : `Schedule on ${day.iso}`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDayIso(day.iso);
                    openNewDialogForDate(day.iso);
                  }}
                >
                  +
                </button>
              </div>

              <div className="schedule-week-col-body">
                {dayEntries.length === 0 ? (
                  <div
                    className="schedule-week-empty-slot"
                    title={
                      pl
                        ? `Kliknij, aby dodać termin na ${day.iso}`
                        : `Click to add item on ${day.iso}`
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDayIso(day.iso);
                      openNewDialogForDate(day.iso);
                    }}
                  >
                    <span>+</span>
                  </div>
                ) : (
                  dayEntries.map((ev) => {
                    const pName = petMap.get(ev.petId);
                    const isOverdue =
                      ev.status === "planned" && ev.date < todayIso;

                    return (
                      <div
                        key={ev.key}
                        className={`schedule-week-card is-${ev.category}${ev.status === "completed" ? " is-completed" : ""}${isOverdue ? " is-overdue" : ""} cursor-pointer`}
                        onClick={(e) => {
                          e.stopPropagation();
                          goToDayView(day.iso);
                        }}
                      >
                        <div className="schedule-week-card-top">
                          {ev.time ? (
                            <span className="schedule-week-time">
                              {ev.time}
                            </span>
                          ) : (
                            <span className="schedule-week-category-pill">
                              {ev.category === "vaccination"
                                ? pl
                                  ? "Szczepienie"
                                  : "Vaccine"
                                : ev.category === "prevention"
                                  ? pl
                                    ? "Profilaktyka"
                                    : "Prevention"
                                  : ev.category === "lab"
                                    ? pl
                                      ? "Badanie"
                                      : "Lab"
                                    : pl
                                      ? "Wizyta"
                                      : "Visit"}
                            </span>
                          )}
                          {pName && !fixedPetId && (
                            <span className="schedule-week-pet">{pName}</span>
                          )}
                        </div>

                        <strong
                          className="schedule-week-title"
                          title={ev.title}
                        >
                          {ev.title}
                        </strong>

                        {(ev.clinic || ev.doctor) && (
                          <span className="schedule-week-place">
                            {[ev.clinic, ev.doctor].filter(Boolean).join(" · ")}
                          </span>
                        )}

                        <div className="schedule-week-card-actions">
                          {ev.kind === "medical_report" ? (
                            <Link
                              href={`/app/zwierzeta/${ev.petId}?tab=results&report=${ev.report.id}`}
                              className="schedule-week-action-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span>{pl ? "Wyniki →" : "Report →"}</span>
                            </Link>
                          ) : (ev.kind === "schedule_item" ||
                              ev.kind === "due_event") &&
                            ev.status === "planned" ? (
                            <button
                              type="button"
                              className="schedule-week-action-btn"
                              disabled={busyKey !== null}
                              title={
                                pl
                                  ? "Oznacz jako wykonane"
                                  : "Mark as done"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                onCompleteTarget({
                                  sourceKind: ev.kind,
                                  sourceId:
                                    ev.kind === "schedule_item"
                                      ? ev.item.id
                                      : ev.event.id,
                                  petId: ev.petId,
                                  petName: pName || (pl ? "Pupil" : "Pet"),
                                  category: ev.category,
                                  title: ev.title,
                                  clinic: ev.clinic,
                                  doctor: ev.doctor,
                                  batchOrProduct:
                                    ev.kind === "due_event"
                                      ? ev.batchOrProduct
                                      : "",
                                  prepNotes:
                                    ev.kind === "schedule_item"
                                      ? ev.prepNotes
                                      : "",
                                });
                              }}
                            >
                              <IconCheck size={12} aria-hidden="true" />
                              <span>{pl ? "Wykonane" : "Done"}</span>
                            </button>
                          ) : null}

                          {ev.kind === "schedule_item" &&
                            ev.status === "planned" && (
                              <button
                                type="button"
                                className="schedule-week-icon-btn"
                                title={pl ? "Edytuj termin" : "Edit item"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditItem(ev.item);
                                }}
                              >
                                <IconPencil size={12} aria-hidden="true" />
                              </button>
                            )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
