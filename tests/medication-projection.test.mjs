import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectMedicationDoses } from '../src/features/medications/projection.ts';
import {
  addIsoDays,
  buildFluidScheduleInstructions,
  formatMedicationChips,
  normalizeScheduledTimes,
  parseMedicationChips,
} from '../src/features/medications/schedule-dates.ts';

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

test('scenariusz 5: pominięcie dawki leku (status: skipped)', () => {
  const schedules = [
    {
      id: 'sched-gabapentyna',
      pet_id: 'pet-1',
      household_id: 'house-1',
      name: 'Gabapentyna',
      dosage: '1 kapsułka',
      schedule_type: 'daily',
      interval_value: null,
      interval_unit: null,
      start_date: '2026-11-01',
      end_date: null,
      scheduled_time: '08:00',
      scheduled_times: ['08:00'],
      instructions: 'W kapsułce z przysmakiem',
      is_active: true,
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
  ];

  const logs = [
    {
      id: 'log-skip-1',
      schedule_id: 'sched-gabapentyna',
      pet_id: 'pet-1',
      household_id: 'house-1',
      dose_date: '2026-11-02',
      scheduled_time: '08:00',
      administered_at: '2026-11-02T08:10:00Z',
      status: 'skipped',
      administered_by: 'user-1',
      notes: 'Odmówił zjedzenia smaczka',
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-02T08:10:00Z',
      updated_at: '2026-11-02T08:10:00Z',
    },
  ];

  const doses = projectMedicationDoses({
    schedules,
    logs,
    rangeStart: '2026-11-02',
    rangeEnd: '2026-11-02',
  });

  assert.equal(doses.length, 1);
  assert.equal(doses[0].is_completed, false);
  assert.equal(doses[0].is_skipped, true);
  assert.equal(doses[0].log?.status, 'skipped');
  assert.equal(doses[0].log?.notes, 'Odmówił zjedzenia smaczka');
});

test('scenariusz 6: śledzenie zapasu i ewidencja podania przez domownika', () => {
  const schedules = [
    {
      id: 'sched-apoquel',
      pet_id: 'pet-1',
      household_id: 'house-1',
      name: 'Apoquel 16mg',
      dosage: '1 tabletka',
      schedule_type: 'daily',
      interval_value: null,
      interval_unit: null,
      start_date: '2026-11-01',
      end_date: null,
      scheduled_time: '08:00',
      scheduled_times: ['08:00'],
      instructions: 'Podać rano z jedzeniem',
      is_active: true,
      stock_quantity: 14,
      low_stock_threshold: 5,
      stock_unit: 'tabletek',
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
  ];

  const logs = [
    {
      id: 'log-taken-1',
      schedule_id: 'sched-apoquel',
      pet_id: 'pet-1',
      household_id: 'house-1',
      dose_date: '2026-11-02',
      scheduled_time: '08:00',
      administered_at: '2026-11-02T08:05:00Z',
      status: 'taken',
      administered_by: 'user-2',
      notes: '',
      revision: 1,
      created_by: 'user-2',
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

  assert.equal(doses.length, 1);
  assert.equal(doses[0].is_completed, true);
  assert.equal(doses[0].is_skipped, false);
  assert.equal(doses[0].log?.administered_by, 'user-2');
  assert.equal(schedules[0].stock_quantity, 14);
});

test('scenariusz 7: normalizacja godzin w formacie PostgreSQL array string ze zdarzeń Supabase Realtime', () => {
  const realtimePayload = {
    id: 'sched-rt',
    pet_id: 'pet-1',
    household_id: 'house-1',
    name: 'Gabapentyna',
    dosage: 'Kapsułka',
    schedule_type: 'daily',
    start_date: '2026-11-02',
    end_date: null,
    scheduled_time: '08:00',
    // Postgres Realtime wal2json często przekazuje typ text[] jako napis "{08:00,14:00,20:00}"
    scheduled_times: '{08:00,14:00,20:00}',
    is_active: true,
  };

  const doses = projectMedicationDoses({
    schedules: [realtimePayload],
    logs: [],
    rangeStart: '2026-11-02',
    rangeEnd: '2026-11-02',
  });

  assert.equal(doses.length, 3);
  assert.equal(doses[0].scheduled_time, '08:00');
  assert.equal(doses[1].scheduled_time, '14:00');
  assert.equal(doses[2].scheduled_time, '20:00');
});

test('scenariusz 8: stała kroplówka 2x dziennie (11:00, 22:00) + dodatkowy lek na 3 dni', () => {
  const schedules = [
    {
      id: 'sched-fluid',
      pet_id: 'pet-1',
      household_id: 'house-1',
      name: 'PWE (Płyn wieloelektrolitowy)',
      dosage: '150 ml · SC',
      schedule_type: 'daily',
      interval_value: null,
      interval_unit: null,
      start_date: '2026-11-12',
      end_date: null,
      scheduled_time: '11:00',
      scheduled_times: ['11:00', '22:00'],
      instructions: 'Podgrzać płyn przed podaniem',
      is_active: true,
      schedule_category: 'fluid_therapy',
      fluid_name: 'PWE (Płyn wieloelektrolitowy)',
      fluid_volume_ml: 150,
      fluid_route: 'sc',
      fluid_location: 'home',
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-12T00:00:00Z',
      updated_at: '2026-11-12T00:00:00Z',
    },
    {
      id: 'sched-addon-3d',
      pet_id: 'pet-1',
      household_id: 'house-1',
      name: 'Catosal',
      dosage: '1 ml',
      schedule_type: 'daily',
      interval_value: null,
      interval_unit: null,
      start_date: '2026-11-12',
      end_date: '2026-11-14', // 3 dni kuracji: 12, 13, 14 listopada
      scheduled_time: '11:00',
      scheduled_times: ['11:00'],
      instructions: 'Dodać do porannej kroplówki o 11:00',
      is_active: true,
      schedule_category: 'medication',
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-12T00:00:00Z',
      updated_at: '2026-11-12T00:00:00Z',
    },
  ];

  // Dni 12..15 listopada: 3 dni po 3 pozycje (9) + 15 listopada tylko 2 kroplówki = 11
  const doses = projectMedicationDoses({
    schedules,
    logs: [],
    rangeStart: '2026-11-12',
    rangeEnd: '2026-11-15',
  });

  const day12 = doses.filter((d) => d.dose_date === '2026-11-12');
  const day14 = doses.filter((d) => d.dose_date === '2026-11-14');
  const day15 = doses.filter((d) => d.dose_date === '2026-11-15');

  assert.equal(day12.length, 3);
  assert.equal(day14.length, 3);
  assert.equal(day15.length, 2);
  assert.ok(day15.every((d) => d.schedule_category === 'fluid_therapy'));

  const morningFluid = day12.find(
    (d) => d.schedule_category === 'fluid_therapy' && d.scheduled_time === '11:00',
  );
  assert.ok(morningFluid);
  assert.equal(morningFluid.fluid_name, 'PWE (Płyn wieloelektrolitowy)');
  assert.equal(morningFluid.fluid_volume_ml, 150);
  assert.equal(morningFluid.fluid_route, 'sc');
  assert.equal(morningFluid.fluid_location, 'home');
});

test('scenariusz 9: kroplówka cykliczna co 2 dni oraz helpery dat i instrukcji', () => {
  assert.equal(addIsoDays('2026-11-12', 2), '2026-11-14'); // kuracja 3 dni (12, 13, 14)
  assert.equal(addIsoDays('2026-12-30', 3), '2027-01-02');
  assert.deepEqual(
    normalizeScheduledTimes(['22:00', '11:00', '11:00', 'invalid']),
    ['11:00', '22:00'],
  );
  assert.equal(
    buildFluidScheduleInstructions({
      medicationsAdded: 'Duphalyte 10 ml',
      clinicName: 'Vetis',
      notes: 'Podgrzać',
    }),
    'Duphalyte 10 ml · Lecznica: Vetis · Podgrzać',
  );

  const schedules = [
    {
      id: 'sched-fluid-every-2d',
      pet_id: 'pet-1',
      household_id: 'house-1',
      name: 'NaCl 0.9%',
      dosage: '100 ml · SC',
      schedule_type: 'interval',
      interval_value: 2,
      interval_unit: 'days',
      start_date: '2026-11-12',
      end_date: '2026-11-16',
      scheduled_time: '11:00',
      scheduled_times: ['11:00'],
      instructions: 'Co 2 dni podskórnie',
      is_active: true,
      schedule_category: 'fluid_therapy',
      fluid_name: 'NaCl 0.9%',
      fluid_volume_ml: 100,
      fluid_route: 'sc',
      fluid_location: 'home',
      revision: 1,
      created_by: 'user-1',
      created_at: '2026-11-12T00:00:00Z',
      updated_at: '2026-11-12T00:00:00Z',
    },
  ];

  const doses = projectMedicationDoses({
    schedules,
    logs: [],
    rangeStart: '2026-11-12',
    rangeEnd: '2026-11-16',
  });

  assert.deepEqual(
    doses.map((d) => d.dose_date),
    ['2026-11-12', '2026-11-14', '2026-11-16'],
  );
  assert.ok(doses.every((d) => d.schedule_category === 'fluid_therapy'));
});

test('scenariusz 10: parsowanie i formatowanie chipsów leków we wlewie', () => {
  assert.deepEqual(parseMedicationChips(''), []);
  assert.deepEqual(parseMedicationChips('  , ; \n '), []);

  assert.deepEqual(
    parseMedicationChips('Duphalyte 10 ml, cerenia 0.4 ml; Duphalyte 10 ml\nWit. B12'),
    ['Duphalyte 10 ml', 'cerenia 0.4 ml', 'Wit. B12'],
  );

  assert.equal(
    formatMedicationChips(['  Duphalyte 10 ml ', 'Cerenia 0.4 ml', 'duphalyte 10 ml', '']),
    'Duphalyte 10 ml, Cerenia 0.4 ml',
  );
});
