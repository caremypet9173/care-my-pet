import type {
  MedicationLog,
  MedicationSchedule,
  MedicationScheduleType,
  ProjectedMedicationDose,
} from "./types";

function buildProjectedDose(
  sched: MedicationSchedule,
  doseDate: string,
  time: string,
  scheduleType: MedicationScheduleType,
  matchingLog: MedicationLog | undefined,
): ProjectedMedicationDose {
  const category = sched.schedule_category ?? "medication";
  return {
    key: `med-${sched.id}-${doseDate}-${time || "0000"}`,
    schedule_id: sched.id,
    pet_id: sched.pet_id,
    name: sched.name,
    dosage: sched.dosage,
    schedule_type: scheduleType,
    dose_date: doseDate,
    scheduled_time: time,
    instructions: sched.instructions,
    is_completed: matchingLog?.status === "taken",
    is_skipped: matchingLog?.status === "skipped",
    schedule_category: category,
    ...(category === "fluid_therapy"
      ? {
          fluid_name: sched.fluid_name || sched.name,
          fluid_volume_ml: sched.fluid_volume_ml ?? null,
          fluid_route: sched.fluid_route ?? "sc",
          fluid_location: sched.fluid_location ?? "home",
        }
      : {}),
    log: matchingLog,
  };
}

function parseUtcDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const res = new Date(date.getTime());
  res.setUTCDate(res.getUTCDate() + days);
  return res;
}

function addMonths(date: Date, months: number): Date {
  const res = new Date(date.getTime());
  const origDay = res.getUTCDate();
  res.setUTCMonth(res.getUTCMonth() + months);
  // Obsługa miesięcy o różnej liczbie dni (np. 31 styczeń + 1 miesiąc -> 28/29 luty)
  if (res.getUTCDate() < origDay) {
    res.setUTCDate(0);
  }
  return res;
}

/**
 * Bezpiecznie parsuje godziny podawania leku.
 * Obsługuje format tablicy JS string[] oraz format tablicy PostgreSQL "{08:00,14:00}"
 * zwracany przez Supabase Realtime (wal2json).
 */
export function parseScheduledTimes(sched?: {
  scheduled_times?: string[] | string | null;
  scheduled_time?: string | null;
} | null): string[] {
  if (!sched) return [];
  const raw = sched.scheduled_times;
  if (Array.isArray(raw)) {
    const valid = raw.filter(
      (t): t is string => typeof t === "string" && !!t.trim(),
    );
    if (valid.length > 0) return valid;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const items = trimmed
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
      if (items.length > 0) return items;
    } else if (trimmed) {
      return [trimmed];
    }
  }
  if (sched.scheduled_time && typeof sched.scheduled_time === "string") {
    const trimmed = sched.scheduled_time.trim();
    if (trimmed) return [trimmed];
  }
  return [];
}

/**
 * Normalizuje obiekt harmonogramu leku otrzymany np. z Supabase Realtime
 */
export function normalizeMedicationSchedule(
  sched: MedicationSchedule | Record<string, unknown>,
): MedicationSchedule {
  return {
    ...(sched as MedicationSchedule),
    scheduled_times: parseScheduledTimes(
      sched as {
        scheduled_times?: string[] | string | null;
        scheduled_time?: string | null;
      },
    ),
  };
}

export function projectMedicationDoses({
  schedules,
  logs,
  rangeStart,
  rangeEnd,
}: {
  schedules: MedicationSchedule[];
  logs: MedicationLog[];
  rangeStart: string;
  rangeEnd: string;
}): ProjectedMedicationDose[] {
  // Mapa logów: klucz `${schedule_id}|${dose_date}|${scheduled_time}`
  const logMap = new Map<string, MedicationLog>();
  for (const log of logs) {
    if (log.schedule_id) {
      logMap.set(
        `${log.schedule_id}|${log.dose_date}|${log.scheduled_time}`,
        log,
      );
      // Fallback bez godziny jeśli log pasuje
      logMap.set(`${log.schedule_id}|${log.dose_date}|`, log);
    }
  }

  const doses: ProjectedMedicationDose[] = [];

  for (const sched of schedules) {
    if (!sched.is_active) continue;

    const schedStartIso = sched.start_date;
    const schedEndIso = sched.end_date ?? rangeEnd;

    // Jeśli cały harmonogram jest poza zakresem, pomijamy
    if (schedStartIso > rangeEnd) continue;
    if (sched.end_date && sched.end_date < rangeStart) continue;

    const parsedTimes = parseScheduledTimes(sched);
    const times: string[] = parsedTimes.length > 0 ? parsedTimes : [sched.scheduled_time || ""];

    if (sched.schedule_type === "one_off") {
      if (schedStartIso >= rangeStart && schedStartIso <= rangeEnd) {
        for (const time of times) {
          const matchingLog =
            logMap.get(`${sched.id}|${schedStartIso}|${time}`) ??
            (times.length === 1 ? logMap.get(`${sched.id}|${schedStartIso}|`) : undefined);
          doses.push(
            buildProjectedDose(sched, schedStartIso, time, "one_off", matchingLog),
          );
        }
      }
      continue;
    }

    if (sched.schedule_type === "daily") {
      const curStartIso = schedStartIso > rangeStart ? schedStartIso : rangeStart;
      const curEndIso = schedEndIso < rangeEnd ? schedEndIso : rangeEnd;

      let cur = parseUtcDate(curStartIso);
      const end = parseUtcDate(curEndIso);

      while (cur <= end) {
        const curIso = formatUtcDate(cur);
        for (const time of times) {
          const matchingLog =
            logMap.get(`${sched.id}|${curIso}|${time}`) ??
            (times.length === 1 ? logMap.get(`${sched.id}|${curIso}|`) : undefined);

          doses.push(
            buildProjectedDose(sched, curIso, time, "daily", matchingLog),
          );
        }

        cur = addDays(cur, 1);
      }
      continue;
    }

    if (sched.schedule_type === "interval") {
      const intervalVal = sched.interval_value && sched.interval_value > 0 ? sched.interval_value : 1;
      const intervalUnit = sched.interval_unit ?? "days";

      let cur = parseUtcDate(schedStartIso);
      const endLimit = parseUtcDate(schedEndIso < rangeEnd ? schedEndIso : rangeEnd);
      const rangeStartDate = parseUtcDate(rangeStart);

      // Bezpiecznik maksymalnej liczby iteracji
      let steps = 0;
      while (cur <= endLimit && steps < 1000) {
        steps++;
        if (cur >= rangeStartDate) {
          const curIso = formatUtcDate(cur);
          for (const time of times) {
            const matchingLog =
              logMap.get(`${sched.id}|${curIso}|${time}`) ??
              (times.length === 1 ? logMap.get(`${sched.id}|${curIso}|`) : undefined);

            doses.push(
              buildProjectedDose(sched, curIso, time, "interval", matchingLog),
            );
          }
        }

        if (intervalUnit === "days") {
          cur = addDays(cur, intervalVal);
        } else if (intervalUnit === "weeks") {
          cur = addDays(cur, intervalVal * 7);
        } else if (intervalUnit === "months") {
          cur = addMonths(cur, intervalVal);
        } else {
          cur = addDays(cur, intervalVal);
        }
      }
    }
  }

  // Sortowanie po dacie i godzinie
  return doses.sort(
    (a, b) =>
      a.dose_date.localeCompare(b.dose_date) ||
      (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99"),
  );
}
