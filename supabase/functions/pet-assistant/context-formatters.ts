export type WeightRow = {
  kg: number | string;
  measured_on: string;
  note?: string | null;
};

export type VitalRow = {
  metric_type: "blood_pressure" | "glucose" | "temperature";
  value_primary: number | string;
  value_secondary?: number | string | null;
  value_tertiary?: number | string | null;
  unit?: string | null;
  context?: string | null;
  measured_on: string;
  note?: string | null;
};

export type MedicationScheduleRow = {
  id: string;
  name: string;
  dosage: string;
  schedule_type: string;
  interval_value?: number | null;
  interval_unit?: string | null;
  start_date: string;
  end_date?: string | null;
  scheduled_time?: string | null;
  scheduled_times?: string[] | null;
  instructions?: string | null;
};

export type MedicationLogRow = {
  schedule_id?: string | null;
  dose_date: string;
  scheduled_time?: string | null;
  status: string;
  notes?: string | null;
};

export type FluidTherapyRow = {
  fluid_name: string;
  volume_ml: number | string;
  route: string;
  medications_added?: string | null;
  location: string;
  clinic_name?: string | null;
  catheter_status?: string | null;
  administered_on: string;
  notes?: string | null;
};

function cleanSnippet(value: string | null | undefined, maxLen = 120): string {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen - 1)}…` : trimmed;
}

export function formatWeightContext(rows: WeightRow[], recentLimit = 10): string {
  if (!rows || rows.length === 0) {
    return "Brak zapisanych pomiarów wagi.";
  }

  const lines = rows.slice(0, recentLimit).map((w) => {
    const note = cleanSnippet(w.note, 120);
    return `- ${w.measured_on}: ${w.kg} kg${note ? ` (${note})` : ""}`;
  });

  if (rows.length > 1) {
    let minRow = rows[0];
    let maxRow = rows[0];
    for (const row of rows) {
      if (Number(row.kg) < Number(minRow.kg)) minRow = row;
      if (Number(row.kg) > Number(maxRow.kg)) maxRow = row;
    }
    const latest = rows[0];
    const oldest = rows[rows.length - 1];
    const delta = Number(latest.kg) - Number(oldest.kg);
    const deltaText =
      Math.abs(delta) >= 0.005
        ? `, zmiana od ${oldest.measured_on}: ${delta > 0 ? "+" : ""}${delta.toFixed(2)} kg`
        : "";
    lines.push(
      `Podsumowanie historii (${rows.length} pomiarów): min ${minRow.kg} kg (${minRow.measured_on}), maks. ${maxRow.kg} kg (${maxRow.measured_on})${deltaText}.`,
    );
  }

  return lines.join("\n");
}

function formatVitalMeta(row: VitalRow): string {
  const ctx = cleanSnippet(row.context, 60);
  const note = cleanSnippet(row.note, 120);
  return `${ctx ? ` [${ctx}]` : ""}${note ? ` (${note})` : ""}`;
}

export function formatVitalsContext(
  bpRows: VitalRow[],
  glucoseRows: VitalRow[],
  tempRows: VitalRow[],
): string {
  const sections: string[] = [];

  if (bpRows.length > 0) {
    const items = bpRows.slice(0, 5).map((r) => {
      const sap = Math.round(Number(r.value_primary));
      const dap =
        r.value_secondary != null ? `/${Math.round(Number(r.value_secondary))}` : "";
      const hr =
        r.value_tertiary != null ? `, HR ${Math.round(Number(r.value_tertiary))} bpm` : "";
      return `  - ${r.measured_on}: ${sap}${dap} mmHg${hr}${formatVitalMeta(r)}`;
    });
    sections.push(`Ciśnienie krwi (ostatnie ${items.length}):\n${items.join("\n")}`);
  }

  if (glucoseRows.length > 0) {
    const items = glucoseRows.slice(0, 5).map((r) => {
      const mgDl = Math.round(Number(r.value_primary));
      const mmol = (Number(r.value_primary) / 18.0182).toFixed(1);
      return `  - ${r.measured_on}: ${mgDl} mg/dL (${mmol} mmol/L)${formatVitalMeta(r)}`;
    });
    sections.push(`Glukoza (ostatnie ${items.length}):\n${items.join("\n")}`);
  }

  if (tempRows.length > 0) {
    const items = tempRows.slice(0, 5).map((r) => {
      const temp = Number(r.value_primary).toFixed(1);
      return `  - ${r.measured_on}: ${temp} °C${formatVitalMeta(r)}`;
    });
    sections.push(`Temperatura ciała (ostatnie ${items.length}):\n${items.join("\n")}`);
  }

  if (sections.length === 0) {
    return "Brak zapisanych pomiarów ciśnienia, glukozy ani temperatury.";
  }

  return sections.join("\n");
}

function formatScheduleFrequency(s: MedicationScheduleRow): string {
  if (s.schedule_type === "daily") return "codziennie";
  if (s.schedule_type === "one_off") return "jednorazowo";
  const unitMap: Record<string, string> = {
    days: "dni",
    weeks: "tyg.",
    months: "mies.",
  };
  const unit = unitMap[s.interval_unit ?? "days"] ?? "dni";
  return `co ${s.interval_value ?? 1} ${unit}`;
}

export function formatMedicationsContext(
  schedules: MedicationScheduleRow[],
  logs: MedicationLogRow[],
): string {
  if (schedules.length === 0 && logs.length === 0) {
    return "Brak aktywnych harmonogramów leków.";
  }

  const lines: string[] = [];
  const nameById = new Map<string, string>();

  for (const s of schedules) {
    nameById.set(s.id, s.name);
    const freq = formatScheduleFrequency(s);
    const timesList =
      Array.isArray(s.scheduled_times) && s.scheduled_times.length > 0
        ? s.scheduled_times.map((t) => String(t).slice(0, 5))
        : s.scheduled_time
          ? [String(s.scheduled_time).slice(0, 5)]
          : [];
    const timesPart = timesList.length > 0 ? `, godz. ${timesList.join(", ")}` : "";
    const datesPart = `od ${s.start_date}${s.end_date ? ` do ${s.end_date}` : ""}`;
    const instr = cleanSnippet(s.instructions, 140);
    const instrPart = instr ? ` | Wskazówki: ${instr}` : "";
    lines.push(`- ${s.name} (${s.dosage}) — ${freq}${timesPart}, ${datesPart}${instrPart}`);
  }

  if (schedules.length === 0) {
    lines.push("- Brak aktywnych harmonogramów leków.");
  }

  if (logs.length > 0) {
    const takenCount = logs.filter((l) => l.status === "taken").length;
    const skippedLogs = logs.filter((l) => l.status === "skipped");
    const skippedDetails = skippedLogs
      .slice(0, 3)
      .map((l) => {
        const medName = (l.schedule_id && nameById.get(l.schedule_id)) || "lek";
        const note = cleanSnippet(l.notes, 80);
        return `${l.dose_date} ${medName}${note ? `: ${note}` : ""}`;
      })
      .join("; ");
    lines.push(
      `Podania z ostatnich 7 dni: ${takenCount} przyjętych, ${skippedLogs.length} pominiętych${skippedDetails ? ` (${skippedDetails})` : ""}.`,
    );
  }

  return lines.join("\n");
}

export function formatFluidTherapyContext(rows: FluidTherapyRow[]): string {
  if (!rows || rows.length === 0) {
    return "Brak zapisanych sesji płynoterapii.";
  }

  const routeMap: Record<string, string> = {
    sc: "podskórnie (SC)",
    iv: "dożylnie (IV)",
    io: "doszpikowo (IO)",
  };

  return rows
    .slice(0, 8)
    .map((f) => {
      const routeLabel = routeMap[f.route] ?? f.route;
      const clinic = cleanSnippet(f.clinic_name, 60);
      const locLabel =
        f.location === "home"
          ? "w domu"
          : clinic
            ? `w klinice: ${clinic}`
            : "w klinice";
      const meds = cleanSnippet(f.medications_added, 80);
      const catheter = cleanSnippet(f.catheter_status, 60);
      const note = cleanSnippet(f.notes, 140);
      return `- ${f.administered_on}: ${f.fluid_name}, ${Number(f.volume_ml)} ml, ${routeLabel} [${locLabel}]${meds ? `, dodatki: ${meds}` : ""}${catheter ? `, wenflon: ${catheter}` : ""}${note ? ` (${note})` : ""}`;
    })
    .join("\n");
}
