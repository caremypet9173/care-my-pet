import test from "node:test";
import assert from "node:assert/strict";
import {
  formatWeightContext,
  formatVitalsContext,
  formatMedicationsContext,
  formatFluidTherapyContext,
} from "../supabase/functions/pet-assistant/context-formatters.ts";

test("formatWeightContext handles empty, single and multi-entry trends", () => {
  assert.equal(formatWeightContext([]), "Brak zapisanych pomiarów wagi.");

  const single = formatWeightContext([{ kg: 4.25, measured_on: "2026-11-10", note: "rano" }]);
  assert.match(single, /2026-11-10: 4.25 kg \(rano\)/);
  assert.doesNotMatch(single, /Podsumowanie historii/);

  const multiple = formatWeightContext([
    { kg: 4.15, measured_on: "2026-11-10" },
    { kg: 4.4, measured_on: "2026-10-01" },
    { kg: 4.05, measured_on: "2026-08-15" },
  ]);
  assert.match(multiple, /- 2026-11-10: 4.15 kg/);
  assert.match(multiple, /Podsumowanie historii \(3 pomiarów\): min 4.05 kg \(2026-08-15\), maks. 4.4 kg \(2026-10-01\), zmiana od 2026-08-15: \+0.10 kg/);
});

test("formatVitalsContext formats blood pressure, glucose and temperature", () => {
  assert.equal(
    formatVitalsContext([], [], []),
    "Brak zapisanych pomiarów ciśnienia, glukozy ani temperatury.",
  );

  const out = formatVitalsContext(
    [
      {
        metric_type: "blood_pressure",
        value_primary: 138,
        value_secondary: 85,
        value_tertiary: 142,
        measured_on: "2026-11-10",
        context: "dom",
        note: "spokojny",
      },
    ],
    [
      {
        metric_type: "glucose",
        value_primary: 108,
        measured_on: "2026-11-09",
        context: "na czczo",
      },
    ],
    [
      {
        metric_type: "temperature",
        value_primary: 38.6,
        measured_on: "2026-11-08",
      },
    ],
  );

  assert.match(out, /Ciśnienie krwi \(ostatnie 1\):/);
  assert.match(out, /- 2026-11-10: 138\/85 mmHg, HR 142 bpm \[dom\] \(spokojny\)/);
  assert.match(out, /Glukoza \(ostatnie 1\):/);
  assert.match(out, /- 2026-11-09: 108 mg\/dL \(6.0 mmol\/L\) \[na czczo\]/);
  assert.match(out, /Temperatura ciała \(ostatnie 1\):/);
  assert.match(out, /- 2026-11-08: 38.6 °C/);
});

test("formatMedicationsContext formats schedules and adherence summary", () => {
  assert.equal(
    formatMedicationsContext([], []),
    "Brak aktywnych harmonogramów leków.",
  );

  const schedules = [
    {
      id: "sch-1",
      name: "Semintra",
      dosage: "1 mg/ml - 0.25 ml",
      schedule_type: "daily",
      start_date: "2026-10-01",
      scheduled_time: "08:00",
      instructions: "Z jedzeniem rano",
    },
    {
      id: "sch-2",
      name: "Amodip",
      dosage: "1/4 tabletki",
      schedule_type: "interval",
      interval_value: 2,
      interval_unit: "days",
      start_date: "2026-11-01",
      end_date: "2026-12-01",
      scheduled_times: ["08:00", "20:00"],
    },
  ];

  const logs = [
    { schedule_id: "sch-1", dose_date: "2026-11-11", status: "taken" },
    { schedule_id: "sch-1", dose_date: "2026-11-10", status: "taken" },
    {
      schedule_id: "sch-2",
      dose_date: "2026-11-09",
      status: "skipped",
      notes: "wypluł tabletkę",
    },
  ];

  const out = formatMedicationsContext(schedules, logs);
  assert.match(out, /- Semintra \(1 mg\/ml - 0.25 ml\) — codziennie, godz. 08:00, od 2026-10-01 \| Wskazówki: Z jedzeniem rano/);
  assert.match(out, /- Amodip \(1\/4 tabletki\) — co 2 dni, godz. 08:00, 20:00, od 2026-11-01 do 2026-12-01/);
  assert.match(out, /Podania z ostatnich 7 dni: 2 przyjętych, 1 pominiętych \(2026-11-09 Amodip: wypluł tabletkę\)\./);
});

test("formatFluidTherapyContext formats therapy sessions with route and additives", () => {
  assert.equal(formatFluidTherapyContext([]), "Brak zapisanych sesji płynoterapii.");

  const out = formatFluidTherapyContext([
    {
      fluid_name: "PWE (Płyn wieloelektrolitowy)",
      volume_ml: 120,
      route: "sc",
      location: "home",
      administered_on: "2026-11-11",
      medications_added: "Duphalyte 5ml",
      catheter_status: null,
      notes: "kot spokojny, podane powoli",
    },
    {
      fluid_name: "NaCl 0.9%",
      volume_ml: 250,
      route: "iv",
      location: "clinic",
      clinic_name: "Klinika Weterynaryjna Pod Żabką",
      administered_on: "2026-11-05",
      catheter_status: "drożny, łapa prawa",
    },
  ]);

  assert.match(out, /- 2026-11-11: PWE \(Płyn wieloelektrolitowy\), 120 ml, podskórnie \(SC\) \[w domu\], dodatki: Duphalyte 5ml \(kot spokojny, podane powoli\)/);
  assert.match(out, /- 2026-11-05: NaCl 0.9%, 250 ml, dożylnie \(IV\) \[w klinice: Klinika Weterynaryjna Pod Żabką\], wenflon: drożny, łapa prawa/);
});
