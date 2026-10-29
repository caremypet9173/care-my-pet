#!/usr/bin/env node

import { execSync } from "node:child_process";

function runQuery(sql) {
  // Use powershell / cmd to run npx supabase db query --linked
  const cleanSql = sql.replace(/"/g, '""');
  const cmd = `npx supabase db query --linked "${cleanSql}"`;
  const raw = execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  
  // Find json block between { and }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Failed to parse query output: ${raw}`);
  }
  const parsed = JSON.parse(match[0]);
  return parsed.rows || [];
}

const [,, action, arg1, ...restArgs] = process.argv;
const extraArg = restArgs.join(" ");

try {
  switch (action) {
    case "list":
    case "pending": {
      const rows = runQuery(
        `select id, email, pets_count, status, created_at from public.waitlist order by created_at desc;`
      );
      if (rows.length === 0) {
        console.log("Brak zgłoszeń na liście oczekujących.");
      } else {
        console.log(`\n📋 Zgłoszenia z listy oczekujących (${rows.length}):\n`);
        console.table(
          rows.map((r) => ({
            Email: r.email,
            Pupile: r.pets_count,
            Status: r.status,
            Zgłoszono: r.created_at,
          }))
        );
      }
      break;
    }

    case "whitelist": {
      const rows = runQuery(
        `select email, notes, created_at from public.pilot_whitelist order by created_at desc;`
      );
      if (rows.length === 0) {
        console.log("Biała lista pilotażu jest pusta.");
      } else {
        console.log(`\n🛡️ Uczestnicy z dostępem do pilotażu (${rows.length}):\n`);
        console.table(
          rows.map((r) => ({
            Email: r.email,
            Notatka: r.notes || "—",
            Dodano: r.created_at,
          }))
        );
      }
      break;
    }

    case "approve": {
      if (!arg1) {
        console.error("Błąd: Podaj adres e-mail do zatwierdzenia, np. pilot approve user@example.com");
        process.exit(1);
      }
      const targetEmail = arg1.trim().toLowerCase();
      // Fetch waitlist entry
      const existing = runQuery(
        `select id, email, pets_count from public.waitlist where lower(email) = lower('${targetEmail}');`
      );
      const petsCount = existing[0]?.pets_count ?? 1;
      const note = `Zatwierdzony z listy oczekujących (${petsCount} ${petsCount === 1 ? "pupil" : "pupili"})`;

      runQuery(
        `insert into public.pilot_whitelist (email, notes) values ('${targetEmail}', '${note}') on conflict (email) do update set notes = excluded.notes; update public.waitlist set status = 'invited' where lower(email) = lower('${targetEmail}');`
      );

      console.log(`\n✅ Pomyślnie zatwierdzono ${targetEmail} do pilotażu!`);
      console.log(`- Dodano do tabeli pilot_whitelist: "${note}"`);
      console.log(`- Zaktualizowano status w tabeli waitlist na: "invited"\n`);
      break;
    }

    case "reject": {
      if (!arg1) {
        console.error("Błąd: Podaj adres e-mail do odrzucenia.");
        process.exit(1);
      }
      const targetEmail = arg1.trim().toLowerCase();
      runQuery(
        `update public.waitlist set status = 'rejected' where lower(email) = lower('${targetEmail}');`
      );
      console.log(`\n❌ Zgłoszenie ${targetEmail} zostało oznaczone jako 'rejected'.\n`);
      break;
    }

    case "add": {
      if (!arg1) {
        console.error("Błąd: Podaj adres e-mail, np. pilot add user@example.com [notatka]");
        process.exit(1);
      }
      const targetEmail = arg1.trim().toLowerCase();
      const note = extraArg.trim() || "Dodany ręcznie";
      runQuery(
        `insert into public.pilot_whitelist (email, notes) values ('${targetEmail}', '${note}') on conflict (email) do update set notes = excluded.notes;`
      );
      console.log(`\n✅ Dodano ${targetEmail} do białej listy pilotażu (notatka: "${note}").\n`);
      break;
    }

    case "remove": {
      if (!arg1) {
        console.error("Błąd: Podaj adres e-mail do usunięcia z białej listy.");
        process.exit(1);
      }
      const targetEmail = arg1.trim().toLowerCase();
      runQuery(
        `delete from public.pilot_whitelist where lower(email) = lower('${targetEmail}');`
      );
      console.log(`\n🗑️ Usunięto ${targetEmail} z białej listy pilotażu.\n`);
      break;
    }

    default:
      console.log(`
Użycie: node .agents/skills/pilot-manager/scripts/pilot.mjs <komenda> [argumenty]

Dostępne komendy:
  list                 - wyświetla listę zgłoszeń z waitlisty
  whitelist            - wyświetla listę testerów z dostępem (pilot_whitelist)
  approve <email>      - zatwierdza zgłoszenie z waitlisty i dodaje do pilotażu
  reject <email>       - odrzuca zgłoszenie (oznacza status 'rejected')
  add <email> [note]   - bezpośrednio dodaje email do białej listy pilotażu
  remove <email>       - usuwa email z białej listy pilotażu
`);
  }
} catch (err) {
  console.error("Błąd podczas wykonywania operacji:", err.message);
  process.exit(1);
}
