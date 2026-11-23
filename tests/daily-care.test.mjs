import test from "node:test";
import assert from "node:assert/strict";
import { projectMedicationDoses } from "../src/features/medications/projection.ts";

test("Daily care aggregates today doses correctly with completion status", () => {
  const todayIso = "2026-11-12";

  const schedules = [
    {
      id: "sch-1",
      pet_id: "pet-1",
      household_id: "home-1",
      name: "Semintra",
      dosage: "0.25 ml",
      schedule_type: "daily",
      interval_value: null,
      interval_unit: null,
      start_date: "2026-10-01",
      end_date: null,
      scheduled_time: "08:00",
      scheduled_times: ["08:00"],
      instructions: "Z karmą",
      is_active: true,
      revision: 1,
      created_by: "usr-1",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "sch-2",
      pet_id: "pet-1",
      household_id: "home-1",
      name: "Amodip",
      dosage: "1/4 tabl.",
      schedule_type: "daily",
      interval_value: null,
      interval_unit: null,
      start_date: "2026-10-01",
      end_date: null,
      scheduled_time: "20:00",
      scheduled_times: ["20:00"],
      instructions: "",
      is_active: true,
      revision: 1,
      created_by: "usr-1",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    },
    {
      id: "sch-old",
      pet_id: "pet-1",
      household_id: "home-1",
      name: "Antybiotyk",
      dosage: "1 tabl.",
      schedule_type: "daily",
      interval_value: null,
      interval_unit: null,
      start_date: "2026-10-01",
      end_date: "2026-10-10", // already ended
      scheduled_time: "12:00",
      scheduled_times: ["12:00"],
      instructions: "",
      is_active: true,
      revision: 1,
      created_by: "usr-1",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    },
  ];

  const logs = [
    {
      id: "log-1",
      schedule_id: "sch-1",
      pet_id: "pet-1",
      household_id: "home-1",
      dose_date: "2026-11-12",
      scheduled_time: "08:00",
      administered_at: "2026-11-12T08:05:00Z",
      status: "taken",
      administered_by: "usr-1",
      notes: "",
      revision: 1,
      created_by: "usr-1",
      created_at: "2026-11-12T08:05:00Z",
      updated_at: "2026-11-12T08:05:00Z",
    },
  ];

  const activeSchedules = schedules.filter(
    (s) => s.is_active && (!s.end_date || s.end_date >= todayIso),
  );

  const doses = projectMedicationDoses({
    schedules: activeSchedules,
    logs,
    rangeStart: todayIso,
    rangeEnd: todayIso,
  });

  assert.equal(doses.length, 2, "Only active non-expired schedules projected");

  const semintra = doses.find((d) => d.name === "Semintra");
  assert.ok(semintra);
  assert.equal(semintra.is_completed, true);
  assert.equal(semintra.is_skipped, false);

  const amodip = doses.find((d) => d.name === "Amodip");
  assert.ok(amodip);
  assert.equal(amodip.is_completed, false);
  assert.equal(amodip.is_skipped, false);
});
