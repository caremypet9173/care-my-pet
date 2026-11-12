"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  IconBolt,
  IconCalendarPlus,
  IconCheck,
  IconChevronDown,
  IconDroplet,
  IconFileUpload,
  IconFlask,
  IconHeartRateMonitor,
  IconPill,
  IconPlus,
  IconScale,
  IconSparkles,
  IconStethoscope,
  IconTemperature,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Pet } from "./types";
import type { MetricType } from "@/features/measurements/types";
import { HistoryDialog } from "@/features/history/history-dialog";
import { DischargeImportDialog } from "@/features/medical/discharge-import-dialog";
import { WeightDialog } from "@/features/weight/weight-dialog";
import { BloodPressureDialog } from "@/features/measurements/blood-pressure-dialog";
import { GlucoseDialog } from "@/features/measurements/glucose-dialog";
import { TemperatureDialog } from "@/features/measurements/temperature-dialog";
import { MedicationDialog } from "@/features/medications/medication-dialog";
import { ScheduleDialog } from "@/features/schedule/schedule-dialog";
import "@/styles/weight.css";
import "@/styles/measurements.css";

export type QuickAddAction =
  | "history_manual"
  | "history_ai_file"
  | "discharge_import"
  | "weight"
  | "blood_pressure"
  | "glucose"
  | "temperature"
  | "medication"
  | "schedule";

export type QuickNavTarget = {
  tab: number;
  metric?: MetricType;
  seq: number;
};

type ToastState = {
  id: number;
  message: string;
  targetTab?: number;
  targetMetric?: MetricType;
  targetLabel?: string;
};

type PetQuickAddContextValue = {
  petId: string;
  petName: string;
  openAction: (action: QuickAddAction) => void;
  navTarget: QuickNavTarget | null;
  navigateTo: (tab: number, metric?: MetricType) => void;
};

type MenuIcon = ComponentType<{
  size?: number;
  "aria-hidden"?: boolean | "true" | "false";
}>;

type MenuItem =
  | {
      key: string;
      kind: "action";
      action: QuickAddAction;
      label: string;
      hint: string;
      icon: MenuIcon;
      badge?: string;
      tone?: "default" | "ai";
    }
  | {
      key: string;
      kind: "link";
      href: string;
      label: string;
      hint: string;
      icon: MenuIcon;
      tone?: "default" | "ai";
    };

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const PetQuickAddContext = createContext<PetQuickAddContextValue | null>(null);

export function usePetQuickAddOptional(): PetQuickAddContextValue | null {
  return useContext(PetQuickAddContext);
}

function usePetQuickAdd(): PetQuickAddContextValue {
  const ctx = useContext(PetQuickAddContext);
  if (!ctx) {
    throw new Error("usePetQuickAdd must be used inside PetQuickAddProvider");
  }
  return ctx;
}

function buildQuickMenuGroups(petId: string, pl: boolean): {
  listGroups: MenuGroup[];
  vitals: MenuItem[];
} {
  return {
    listGroups: [
      {
        title: pl ? "Wizyta, leki i kalendarz" : "Visits, meds & schedule",
        items: [
          {
            key: "history_manual",
            kind: "action",
            action: "history_manual",
            label: pl ? "Wpis w historii / wizyta" : "Visit / history entry",
            hint: pl
              ? "Wizyta, szczepienie lub profilaktyka"
              : "Check-up, vaccination or prevention",
            icon: IconStethoscope,
          },
          {
            key: "history_ai_file",
            kind: "action",
            action: "history_ai_file",
            label: pl ? "Wczytaj wizytę z pliku (AI)" : "Import visit from file (AI)",
            hint: pl
              ? "Karta wizyty PDF / zdjęcie — AI wypełni wpis"
              : "PDF or photo visit card — AI pre-fills fields",
            icon: IconSparkles,
            badge: "AI",
            tone: "ai",
          },
          {
            key: "fluid",
            kind: "link",
            href: `/app/zwierzeta/${petId}/plynoterapia/nowa`,
            label: pl ? "Kroplówka / płynoterapia" : "Fluid therapy / infusion",
            hint: pl
              ? "Wlew dożylny (IV), podskórny (SC) lub IO"
              : "IV, subcutaneous (SC) or IO infusion",
            icon: IconDroplet,
          },
          {
            key: "medication",
            kind: "action",
            action: "medication",
            label: pl ? "Harmonogram leku / kroplówki" : "Medication or fluid schedule",
            hint: pl
              ? "Stałe leki, krótkie kuracje lub cykliczne kroplówki"
              : "Dosing schedule, cyclical fluids and reminders",
            icon: IconPill,
          },
          {
            key: "schedule",
            kind: "action",
            action: "schedule",
            label: pl ? "Termin w kalendarzu" : "Schedule event",
            hint: pl
              ? "Planowana wizyta, badanie lub zabieg"
              : "Planned visit, lab or procedure",
            icon: IconCalendarPlus,
          },
        ],
      },
      {
        title: pl ? "Badania i dokumenty" : "Labs & documents",
        items: [
          {
            key: "lab",
            kind: "link",
            href: `/app/zwierzeta/${petId}/badania/nowe`,
            label: pl ? "Wynik badania" : "Lab or imaging report",
            hint: pl
              ? "Morfologia, biochemia, USG lub opis z pliku"
              : "Lab panel, imaging or report upload",
            icon: IconFlask,
          },
          {
            key: "discharge_import",
            kind: "action",
            action: "discharge_import",
            label: pl
              ? "Import wypisu / kartoteki PDF (AI)"
              : "Import clinic discharge PDF (AI)",
            hint: pl
              ? "Wielostronicowy wyciąg z lecznicy — rozbija na badania, wizyty i leki"
              : "Multi-page clinic file — extracts labs, visits & meds",
            icon: IconFileUpload,
            badge: "AI",
            tone: "ai",
          },
        ],
      },
    ],
    vitals: [
      {
        key: "weight",
        kind: "action",
        action: "weight",
        label: pl ? "Masa ciała" : "Weight",
        hint: "kg",
        icon: IconScale,
      },
      {
        key: "blood_pressure",
        kind: "action",
        action: "blood_pressure",
        label: pl ? "Ciśnienie krwi" : "Blood pressure",
        hint: "mmHg",
        icon: IconHeartRateMonitor,
      },
      {
        key: "glucose",
        kind: "action",
        action: "glucose",
        label: pl ? "Glukoza" : "Glucose",
        hint: "mg/dL",
        icon: IconDroplet,
      },
      {
        key: "temperature",
        kind: "action",
        action: "temperature",
        label: pl ? "Temperatura" : "Temperature",
        hint: "°C",
        icon: IconTemperature,
      },
    ],
  };
}

/** Provides shared quick-add dialogs, confirmation feedback, and tab navigation across the pet record. */
export function PetQuickAddProvider({
  pet,
  householdId,
  children,
}: {
  pet: Pick<Pet, "id" | "imie"> & { gospodarstwo_id?: string };
  householdId: string;
  children: ReactNode;
}) {
  const pl = useLocale() === "pl";
  const router = useRouter();
  const [activeDialog, setActiveDialog] = useState<QuickAddAction | null>(null);
  const [navTarget, setNavTarget] = useState<QuickNavTarget | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigateTo = useCallback((tab: number, metric?: MetricType) => {
    setNavTarget((prev) => ({
      tab,
      metric,
      seq: (prev?.seq ?? 0) + 1,
    }));
  }, []);

  const finishSave = useCallback(
    (message: string, targetTab?: number, targetMetric?: MetricType, targetLabel?: string) => {
      setActiveDialog(null);
      router.refresh();
      setToast({
        id: Date.now(),
        message,
        targetTab,
        targetMetric,
        targetLabel,
      });
    },
    [router],
  );

  const openAction = useCallback((action: QuickAddAction) => {
    setActiveDialog(action);
  }, []);

  const petOption = [{ id: pet.id, imie: pet.imie }];

  return (
    <PetQuickAddContext.Provider
      value={{
        petId: pet.id,
        petName: pet.imie,
        openAction,
        navTarget,
        navigateTo,
      }}
    >
      {children}

      {(activeDialog === "history_manual" || activeDialog === "history_ai_file") && (
        <HistoryDialog
          petId={pet.id}
          householdId={householdId}
          petName={pet.imie}
          event={null}
          focusAiUpload={activeDialog === "history_ai_file"}
          onClose={() => setActiveDialog(null)}
          onSave={() =>
            finishSave(
              pl ? "Dodano wpis do historii zdrowia." : "Health history entry saved.",
              1,
              undefined,
              pl ? "Otwórz Historię →" : "View History →",
            )
          }
        />
      )}

      {activeDialog === "discharge_import" && (
        <DischargeImportDialog
          pet={pet}
          householdId={householdId || pet.gospodarstwo_id}
          open
          onClose={() => setActiveDialog(null)}
          onSuccess={() => router.refresh()}
        />
      )}

      {activeDialog === "weight" && (
        <WeightDialog
          petId={pet.id}
          petName={pet.imie}
          measurement={null}
          onClose={() => setActiveDialog(null)}
          onSave={() =>
            finishSave(
              pl ? "Zapisano pomiar masy ciała." : "Weight measurement saved.",
              4,
              "weight",
              pl ? "Zobacz w Pomiarach →" : "View Measurements →",
            )
          }
        />
      )}

      {activeDialog === "blood_pressure" && (
        <BloodPressureDialog
          petId={pet.id}
          petName={pet.imie}
          measurement={null}
          onClose={() => setActiveDialog(null)}
          onSave={() =>
            finishSave(
              pl ? "Zapisano pomiar ciśnienia krwi." : "Blood pressure reading saved.",
              4,
              "blood_pressure",
              pl ? "Zobacz w Pomiarach →" : "View Measurements →",
            )
          }
        />
      )}

      {activeDialog === "glucose" && (
        <GlucoseDialog
          petId={pet.id}
          petName={pet.imie}
          measurement={null}
          onClose={() => setActiveDialog(null)}
          onSave={() =>
            finishSave(
              pl ? "Zapisano pomiar glukozy." : "Glucose reading saved.",
              4,
              "glucose",
              pl ? "Zobacz w Pomiarach →" : "View Measurements →",
            )
          }
        />
      )}

      {activeDialog === "temperature" && (
        <TemperatureDialog
          petId={pet.id}
          petName={pet.imie}
          measurement={null}
          onClose={() => setActiveDialog(null)}
          onSave={() =>
            finishSave(
              pl ? "Zapisano pomiar temperatury ciała." : "Body temperature saved.",
              4,
              "temperature",
              pl ? "Zobacz w Pomiarach →" : "View Measurements →",
            )
          }
        />
      )}

      {activeDialog === "medication" && (
        <MedicationDialog
          pets={petOption}
          defaultPetId={pet.id}
          schedule={null}
          onClose={() => setActiveDialog(null)}
          onSave={(saved) =>
            finishSave(
              saved.schedule_category === "fluid_therapy"
                ? pl
                  ? "Dodano harmonogram kroplówki."
                  : "Fluid schedule saved."
                : pl
                  ? "Dodano lek lub kurację."
                  : "Medication schedule saved.",
              0,
              undefined,
              pl ? "Pokaż Podsumowanie →" : "View Summary →",
            )
          }
        />
      )}

      {activeDialog === "schedule" && (
        <ScheduleDialog
          pets={petOption}
          defaultPetId={pet.id}
          item={null}
          onClose={() => setActiveDialog(null)}
          onSave={() =>
            finishSave(
              pl ? "Dodano termin do kalendarza." : "Schedule item saved.",
              0,
              undefined,
              pl ? "Pokaż Terminarz →" : "View Schedule →",
            )
          }
          onOpenMedicationSchedule={() => setActiveDialog("medication")}
        />
      )}

      {toast && (
        <div key={toast.id} className="household-quick-toast" role="status" aria-live="polite">
          <span className="household-quick-toast-icon" aria-hidden="true">
            <IconCheck size={16} />
          </span>
          <div className="household-quick-toast-body">
            <span>{toast.message}</span>
            {toast.targetTab !== undefined && toast.targetLabel && (
              <button
                type="button"
                className="household-quick-toast-link"
                onClick={() => {
                  navigateTo(toast.targetTab!, toast.targetMetric);
                  setToast(null);
                }}
              >
                {toast.targetLabel}
              </button>
            )}
          </div>
          <button
            type="button"
            className="household-quick-toast-close"
            aria-label={pl ? "Zamknij powiadomienie" : "Dismiss notification"}
            onClick={() => setToast(null)}
          >
            <IconX size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </PetQuickAddContext.Provider>
  );
}

/** Global "+ Dodaj" dropdown (desktop) / bottom sheet (mobile) in the pet record toolbar. */
export function PetQuickAddToolbarButton() {
  const pl = useLocale() === "pl";
  const { petId, petName, openAction } = usePetQuickAdd();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const { listGroups, vitals } = buildQuickMenuGroups(petId, pl);

  const renderGroup = (group: MenuGroup) => (
    <section key={group.title} className="household-quick-group">
      <h3>{group.title}</h3>
      <ul>
        {group.items.map((item) => {
          const Icon = item.icon;
          const isAi = item.tone === "ai";
          const content = (
            <>
              <span className={`household-quick-item-icon${isAi ? " is-ai" : ""}`} aria-hidden="true">
                <Icon size={17} />
              </span>
              <span className="household-quick-item-text">
                <strong>
                  {item.label}
                  {item.kind === "action" && item.badge && (
                    <span className="household-quick-ai-badge">{item.badge}</span>
                  )}
                </strong>
                <small>{item.hint}</small>
              </span>
            </>
          );

          return (
            <li key={item.key}>
              {item.kind === "link" ? (
                <Link
                  href={item.href}
                  className="household-quick-item"
                  onClick={() => setOpen(false)}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  className={`household-quick-item${isAi ? " is-ai" : ""}`}
                  onClick={() => {
                    setOpen(false);
                    openAction(item.action);
                  }}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <div ref={rootRef} className="household-quick-anchor">
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        variant="primary"
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        onClick={() => setOpen((prev) => !prev)}
      >
        <IconPlus size={16} aria-hidden="true" />
        <span>{pl ? "Dodaj" : "Add"}</span>
        <IconChevronDown
          size={14}
          aria-hidden="true"
          className={`household-quick-chevron${open ? " is-open" : ""}`}
        />
      </Button>

      {open && (
        <>
          <div
            className="household-quick-backdrop"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            role="dialog"
            aria-modal="false"
            aria-label={pl ? `Szybki dostęp — ${petName}` : `Quick add — ${petName}`}
            className="household-quick-popover"
          >
            <header className="household-quick-popover-head">
              <div>
                <strong>{pl ? "Szybki dostęp" : "Quick add"}</strong>
                <small>{petName}</small>
              </div>
              <button
                type="button"
                className="household-quick-popover-close"
                aria-label={pl ? "Zamknij menu" : "Close menu"}
                onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              >
                <IconX size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="household-quick-popover-body">
              {listGroups[0] && renderGroup(listGroups[0])}

              <div className="household-quick-popover-col">
                {listGroups[1] && renderGroup(listGroups[1])}

                <section className="household-quick-group">
                  <h3>{pl ? "Pomiary domowe" : "Home measurements"}</h3>
                  <div className="household-quick-vitals-grid">
                    {vitals.map((item) => {
                      const Icon = item.icon;
                      if (item.kind !== "action") return null;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          className="household-quick-vital-tile"
                          onClick={() => {
                            setOpen(false);
                            openAction(item.action);
                          }}
                        >
                          <Icon size={16} aria-hidden="true" />
                          <span>
                            <strong>{item.label}</strong>
                            <small>{item.hint}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Slim quick-access action strip displayed at the top of the Summary tab (#record-panel-0). */
export function PetQuickAccessStrip() {
  const pl = useLocale() === "pl";
  const { petId, openAction } = usePetQuickAdd();
  const [tray, setTray] = useState<"vitals" | "more" | null>(null);
  const stripRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!tray) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTray(null);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (stripRef.current && !stripRef.current.contains(event.target as Node)) {
        setTray(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [tray]);

  const { vitals } = buildQuickMenuGroups(petId, pl);

  return (
    <section
      ref={stripRef}
      className="pet-panel household-quick-strip"
      aria-label={pl ? "Szybki dostęp do dodawania" : "Quick actions"}
    >
      <div className="household-quick-strip-row">
        <div className="household-quick-strip-label">
          <span className="household-quick-strip-badge" aria-hidden="true">
            <IconBolt size={14} />
          </span>
          <span>{pl ? "Szybki dostęp" : "Quick actions"}</span>
        </div>

        <div className="household-quick-strip-pills">
          <button
            type="button"
            className="household-quick-pill"
            onClick={() => {
              setTray(null);
              openAction("history_manual");
            }}
          >
            <IconStethoscope size={15} aria-hidden="true" />
            <span>{pl ? "Wpis / wizyta" : "Visit / entry"}</span>
          </button>

          <button
            type="button"
            className="household-quick-pill is-ai"
            title={
              pl
                ? "Wczytaj kartę wizyty z pliku PDF lub zdjęcia (AI)"
                : "Import visit document from PDF or photo (AI)"
            }
            onClick={() => {
              setTray(null);
              openAction("history_ai_file");
            }}
          >
            <IconSparkles size={15} aria-hidden="true" />
            <span>{pl ? "Z pliku (AI)" : "From file (AI)"}</span>
          </button>

          <Link
            href={`/app/zwierzeta/${petId}/badania/nowe`}
            className="household-quick-pill"
            onClick={() => setTray(null)}
          >
            <IconFlask size={15} aria-hidden="true" />
            <span>{pl ? "Badanie" : "Lab report"}</span>
          </Link>

          <Link
            href={`/app/zwierzeta/${petId}/plynoterapia/nowa`}
            className="household-quick-pill"
            onClick={() => setTray(null)}
          >
            <IconDroplet size={15} aria-hidden="true" />
            <span>{pl ? "Kroplówka" : "Infusion"}</span>
          </Link>

          <button
            type="button"
            className={`household-quick-pill${tray === "vitals" ? " is-active" : ""}`}
            aria-expanded={tray === "vitals"}
            onClick={() => setTray((prev) => (prev === "vitals" ? null : "vitals"))}
          >
            <IconScale size={15} aria-hidden="true" />
            <span>{pl ? "Pomiar" : "Measure"}</span>
            <IconChevronDown
              size={13}
              aria-hidden="true"
              className={`household-quick-chevron${tray === "vitals" ? " is-open" : ""}`}
            />
          </button>

          <button
            type="button"
            className={`household-quick-pill${tray === "more" ? " is-active" : ""}`}
            aria-expanded={tray === "more"}
            onClick={() => setTray((prev) => (prev === "more" ? null : "more"))}
          >
            <IconPlus size={15} aria-hidden="true" />
            <span>{pl ? "Więcej" : "More"}</span>
            <IconChevronDown
              size={13}
              aria-hidden="true"
              className={`household-quick-chevron${tray === "more" ? " is-open" : ""}`}
            />
          </button>
        </div>
      </div>

      {tray === "vitals" && (
        <div className="household-quick-tray" role="group" aria-label={pl ? "Wybierz pomiar" : "Select measurement"}>
          {vitals.map((item) => {
            if (item.kind !== "action") return null;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className="household-quick-tray-btn"
                onClick={() => {
                  setTray(null);
                  openAction(item.action);
                }}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{item.label}</span>
                <small>{item.hint}</small>
              </button>
            );
          })}
        </div>
      )}

      {tray === "more" && (
        <div className="household-quick-tray" role="group" aria-label={pl ? "Więcej opcji dodawania" : "More add options"}>
          <button
            type="button"
            className="household-quick-tray-btn"
            onClick={() => {
              setTray(null);
              openAction("medication");
            }}
          >
            <IconPill size={15} aria-hidden="true" />
            <span>{pl ? "Lek lub kuracja" : "Medication"}</span>
          </button>
          <button
            type="button"
            className="household-quick-tray-btn"
            onClick={() => {
              setTray(null);
              openAction("schedule");
            }}
          >
            <IconCalendarPlus size={15} aria-hidden="true" />
            <span>{pl ? "Termin w kalendarzu" : "Calendar event"}</span>
          </button>
          <button
            type="button"
            className="household-quick-tray-btn is-ai"
            onClick={() => {
              setTray(null);
              openAction("discharge_import");
            }}
          >
            <IconFileUpload size={15} aria-hidden="true" />
            <span>{pl ? "Import wypisu / kartoteki PDF (AI)" : "Import clinic PDF (AI)"}</span>
          </button>
        </div>
      )}
    </section>
  );
}
