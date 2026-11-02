import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectMedicationDoses } from '../src/features/medications/projection.ts';

test('scenariusz 1: jednorazowe (doraźne) podanie leku', () => {
  const schedules = [
    {
      id: 'sched-1',
      pet_id: 'pet-1',
      household_id: 'house-1',
      name: 'Lek przeciwbólowy',
      dosage: '1 tabletka',
      schedule_type: 'one_off',
      interval_value: null,
      interval_unit: null,
      start_date: '2026-11-05',
      end_date: null,
      scheduled_time: '14:30',
      instructions: 'Podać po zabiegu',
      is_active: true,
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-02T00:00:00Z',
      updated_at: '2026-11-02T00:00:00Z',
    },
  ];

  const doses = projectMedicationDoses({
    schedules,
    logs: [],
    rangeStart: '2026-11-01',
    rangeEnd: '2026-11-30',
  });

  assert.equal(doses.length, 1);
  assert.equal(doses[0].name, 'Lek przeciwbólowy');
  assert.equal(doses[0].dose_date, '2026-11-05');
  assert.equal(doses[0].scheduled_time, '14:30');
  assert.equal(doses[0].is_completed, false);
});

test('scenariusz 2: stałe, codzienne podawanie leku (np. Flora Balance codziennie o 16:00)', () => {
  const schedules = [
    {
      id: 'sched-flora',
      pet_id: 'pet-1',
      household_id: 'house-1',
      name: 'Flora Balance',
      dosage: '1 kapsułka',
      schedule_type: 'daily',
      interval_value: null,
      interval_unit: null,
      start_date: '2026-11-01',
      end_date: '2026-11-05', // 5 dni kuracji
      scheduled_time: '16:00',
      instructions: 'Wymieszać z karmą',
      is_active: true,
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
  ];

  // Symulacja zatwierdzonego podania w dniu 2026-11-02 o 16:00
  const logs = [
    {
      id: 'log-1',
      schedule_id: 'sched-flora',
      pet_id: 'pet-1',
      household_id: 'house-1',
      dose_date: '2026-11-02',
      scheduled_time: '16:00',
      administered_at: '2026-11-02T16:05:00Z',
      status: 'taken',
      administered_by: 'user-1',
      notes: 'Zjedzone ze smakiem',
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-02T16:05:00Z',
      updated_at: '2026-11-02T16:05:00Z',
    },
  ];

  const doses = projectMedicationDoses({
    schedules,
    logs,
    rangeStart: '2026-11-01',
    rangeEnd: '2026-11-10',
  });

  assert.equal(doses.length, 5); // 1, 2, 3, 4, 5 listopada
  assert.equal(doses[0].dose_date, '2026-11-01');
  assert.equal(doses[0].is_completed, false);

  assert.equal(doses[1].dose_date, '2026-11-02');
  assert.equal(doses[1].is_completed, true); // Zatwierdzone podanie!
  assert.equal(doses[1].log?.notes, 'Zjedzone ze smakiem');

  assert.equal(doses[4].dose_date, '2026-11-05');
  assert.equal(doses[4].is_completed, false);
});

test('scenariusz 3: cykliczne (interwałowe) podawanie (np. Wlew z ketaminy co 4 tygodnie)', () => {
  const schedules = [
    {
      id: 'sched-ketamine',
      pet_id: 'pet-1',
      household_id: 'house-1',
      name: 'Wlew z ketaminy',
      dosage: 'Wlew dożylny',
      schedule_type: 'interval',
      interval_value: 4,
      interval_unit: 'weeks', // co 4 tygodnie (28 dni)
      start_date: '2026-11-01',
      end_date: null,
      scheduled_time: '11:00',
      instructions: 'W klinice weterynaryjnej',
      is_active: true,
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
  ];

  const doses = projectMedicationDoses({
    schedules,
    logs: [],
    rangeStart: '2026-11-01',
    rangeEnd: '2027-01-31', // 3 miesiące
  });

  // Pierwsza dawka: 2026-11-01
  // Druga dawka: 2026-11-01 + 28 dni = 2026-11-29
  // Trzecia dawka: 2026-11-29 + 28 dni = 2026-12-27
  // Czwarta dawka: 2026-12-27 + 28 dni = 2027-01-24
  assert.equal(doses.length, 4);
  assert.equal(doses[0].dose_date, '2026-11-01');
  assert.equal(doses[1].dose_date, '2026-11-29');
  assert.equal(doses[2].dose_date, '2026-12-27');
  assert.equal(doses[3].dose_date, '2027-01-24');
});

test('scenariusz 4: ten sam lek podawany kilka razy dziennie (np. 2x dziennie: 08:00 i 20:00)', () => {
  const schedules = [
    {
      id: 'sched-antibiotic',
      pet_id: 'pet-1',
      household_id: 'house-1',
      name: 'Amotaks',
      dosage: '1 tabletka',
      schedule_type: 'daily',
      interval_value: null,
      interval_unit: null,
      start_date: '2026-11-02',
      end_date: '2026-11-02', // 1 dzień testowy
      scheduled_time: '08:00',
      scheduled_times: ['08:00', '20:00'],
      instructions: 'Po posiłku',
      is_active: true,
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-02T00:00:00Z',
      updated_at: '2026-11-02T00:00:00Z',
    },
  ];

  // Tylko poranna dawka (08:00) została zatwierdzona w logach
  const logs = [
    {
      id: 'log-morning',
      schedule_id: 'sched-antibiotic',
      pet_id: 'pet-1',
      household_id: 'house-1',
      dose_date: '2026-11-02',
      scheduled_time: '08:00',
      administered_at: '2026-11-02T08:05:00Z',
      status: 'taken',
      administered_by: 'user-1',
      notes: 'Podane bez problemu',
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-02T08:05:00Z',
      updated_at: '2026-11-02T08:05:00Z',
    },
  ];

  const doses = projectMedicationDoses({
    schedules,
    logs,
    rangeStart: '2026-11-02',
    rangeEnd: '2026-11-02',
  });

  // Powinny być wygenerowane 2 osobne dawki na ten dzień
  assert.equal(doses.length, 2);

  // Dawka 1: 08:00 - zatwierdzona
  assert.equal(doses[0].dose_date, '2026-11-02');
  assert.equal(doses[0].scheduled_time, '08:00');
  assert.equal(doses[0].is_completed, true);
  assert.equal(doses[0].key, 'med-sched-antibiotic-2026-11-02-08:00');

  // Dawka 2: 20:00 - oczekująca
  assert.equal(doses[1].dose_date, '2026-11-02');
  assert.equal(doses[1].scheduled_time, '20:00');
  assert.equal(doses[1].is_completed, false);
  assert.equal(doses[1].key, 'med-sched-antibiotic-2026-11-02-20:00');
});
