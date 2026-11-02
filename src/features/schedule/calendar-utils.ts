import type { HealthEvent } from "@/features/history/types";
import type {
  MedicationScheduleType,
  ProjectedMedicationDose,
} from "@/features/medications/types";
import type {
  CalendarReportSummary,
  ScheduleCategory,
  ScheduleItem,
} from "./types";

export type FilterCategory = "all" | ScheduleCategory | "lab";
export type ViewMode = "upcoming" | "archive";
export type DisplayLayout = "month" | "week" | "day" | "agenda";

export type UnifiedScheduleEntry =
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
    }
  | {
      kind: "history_event";
      key: string;
      petId: string;
      category: ScheduleCategory;
      title: string;
      date: string;
      time: string;
      clinic: string;
      doctor: string;
      batchOrProduct: string;
      description: string;
      status: "completed";
      event: HealthEvent;
    }
  | {
      kind: "medical_report";
      key: string;
      petId: string;
      category: "lab";
      title: string;
      date: string;
      time: string;
      clinic: string;
      doctor: string;
      status: "completed";
      report: CalendarReportSummary;
    }
  | {
      kind: "medication_dose";
      key: string;
      petId: string;
      category: "prevention";
      title: string;
      date: string;
      time: string;
      clinic: string;
      doctor: string;
      prepNotes: string;
      status: "planned" | "completed" | "skipped";
      dosage: string;
      scheduleType: MedicationScheduleType;
      instructions: string;
      dose: ProjectedMedicationDose;
    };

export const PL_MONTH_ALIASES: Record<string, string> = {
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

export function foldText(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

export function buildSearchHaystack(
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
        : entry.category === "lab"
          ? "badanie badania wyniki krew mocz usg rtg lab results report"
          : "wizyta kontrola badanie visit checkup";

  let weekdayAliases = "";
  const yearNum = Number.parseInt(y, 10);
  const monthNum = Number.parseInt(m, 10);
  const dayNum = Number.parseInt(d, 10);
  if (
    Number.isFinite(yearNum) &&
    Number.isFinite(monthNum) &&
    Number.isFinite(dayNum)
  ) {
    const dow = new Date(Date.UTC(yearNum, monthNum - 1, dayNum)).getUTCDay();
    const weekdayMap: Record<number, string> = {
      0: "niedziela niedziele niedz sunday sun",
      1: "poniedzialek pon monday mon",
      2: "wtorek wt tuesday tue",
      3: "sroda srode sr wednesday wed",
      4: "czwartek czw thursday thu",
      5: "piatek pt friday fri",
      6: "sobota sobote sob saturday sat",
    };
    weekdayAliases = weekdayMap[dow] ?? "";
  }

  let timeAliases = "";
  if (entry.time) {
    const cleanTime = entry.time.slice(0, 5);
    const [hh = "", mm = ""] = cleanTime.split(":");
    const hourNum = Number.parseInt(hh, 10);
    const unpaddedHour = Number.isFinite(hourNum) ? String(hourNum) : hh;
    const timeOfDay =
      !Number.isFinite(hourNum)
        ? ""
        : hourNum < 12
          ? "rano poranek morning"
          : hourNum < 17
            ? "popoludniu popoludnie afternoon"
            : "wieczorem wieczor evening";

    timeAliases = [
      cleanTime,
      `${hh}.${mm}`,
      `${unpaddedHour}:${mm}`,
      `${unpaddedHour}.${mm}`,
      `godz ${hh}`,
      `godz ${unpaddedHour}`,
      `godzina ${hh}`,
      `godzina ${unpaddedHour}`,
      timeOfDay,
    ].join(" ");
  }

  const extra =
    entry.kind === "schedule_item"
      ? entry.prepNotes
      : entry.kind === "due_event"
        ? `${entry.batchOrProduct} ${entry.lastEventDate}`
        : entry.kind === "history_event"
          ? `${entry.batchOrProduct} ${entry.description}`
          : entry.kind === "medication_dose"
            ? `${entry.dosage} ${entry.instructions} ${entry.scheduleType}`
            : "";

  return foldText(
    [
      entry.title,
      petName,
      entry.clinic,
      entry.doctor,
      entry.date,
      `${d}.${m}.${y}`,
      `${d}/${m}/${y}`,
      `${Number.parseInt(d, 10)}.${m}.${y}`,
      `${m}.${y}`,
      y,
      monthAliases,
      weekdayAliases,
      timeAliases,
      categoryAliases,
      extra,
    ].join(" "),
  );
}

export function buildMonthGrid(year: number, monthIndex: number) {
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
