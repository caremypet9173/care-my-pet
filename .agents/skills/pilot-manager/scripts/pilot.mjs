#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const FALLBACK_PROJECT_REF = "lrlnqmciarjvngvquchu";

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function pluralizePetsPl(count) {
  const abs = Math.abs(Number(count) || 0);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (abs === 1) return "pupil";
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
    return "pupile";
  }
  return "pupili";
}

function resolveProjectRef() {
  const refPath = path.join(repoRoot, "supabase", ".temp", "project-ref");
  try {
    const raw = fs.readFileSync(refPath, "utf-8").trim();
    if (/^[a-z0-9]{10,40}$/.test(raw)) {
      return raw;
    }
  } catch {
    // fallback below
  }
  return FALLBACK_PROJECT_REF;
}

function runQuery(sql) {
  const raw = execFileSync("supabase", ["db", "query", "--linked", sql], {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Find json block between { and }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`Failed to parse query output: ${raw}`);
  }
  const parsed = JSON.parse(match[0]);
  return parsed.rows || [];
}

function parseArgs(rawArgs) {
  const positionals = [];
  const flags = {
    noEmail: false,
    dryRun: false,
    force: false,
    locale: "pl",
  };

  for (let i = 0; i < rawArgs.length; i += 1) {
    const arg = rawArgs[i];
    if (arg === "--no-email") {
      flags.noEmail = true;
    } else if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg === "--force") {
      flags.force = true;
    } else if (arg === "--locale" && i + 1 < rawArgs.length) {
      flags.locale = rawArgs[i + 1] === "en" ? "en" : "pl";
      i += 1;
    } else if (arg.startsWith("--locale=")) {
      flags.locale = arg.slice("--locale=".length) === "en" ? "en" : "pl";
    } else if (arg.startsWith("--")) {
      throw new Error(`Nieznana flaga: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flags };
}

function formatSkipReason(entry) {
  switch (entry.reason) {
    case "already_sent":
      return `mail powitalny został już wysłany (${entry.welcome_sent_at || "wcześniej"}; użyj --force, aby wysłać ponownie)`;
    case "not_whitelisted":
      return "adres nie znajduje się w public.pilot_whitelist";
    case "invalid_email":
      return "niepoprawny format adresu e-mail";
    default:
      return entry.reason || "pominięto";
  }
}

async function sendPilotWelcomeEmails(
  emails,
  { dryRun = false, force = false, locale = "pl" } = {},
) {
  const secretRows = runQuery(
    `select secret from private.cron_dispatch_secret where id = 1;`,
  );
  const cronSecret =
    typeof secretRows[0]?.secret === "string" ? secretRows[0].secret.trim() : "";
  if (!cronSecret) {
    throw new Error(
      "Brak sekretu w private.cron_dispatch_secret (id = 1) — nie można uwierzytelnić wywołania Edge Function.",
    );
  }

  const projectRef = resolveProjectRef();
  const endpoint = `https://${projectRef}.supabase.co/functions/v1/schedule-notifications`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
    body: JSON.stringify({
      action: "pilot_welcome",
      emails,
      dry_run: dryRun,
      force,
      locale,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload.detail || payload.error || `HTTP ${response.status}`;
    throw new Error(`Edge Function schedule-notifications zwróciła błąd: ${detail}`);
  }

  return payload;
}

function printWelcomeResult(result) {
  if (result.dry_run) {
    console.log(`\n🧪 Podgląd wysyłki (dry-run, locale=${result.locale}):`);
    console.log(`- Temat: ${result.subject}`);
    console.log(`- Link rejestracji: ${result.register_url}`);
    console.log(
      `- Do wysłania (${result.would_send?.length ?? 0}): ${
        result.would_send?.length ? result.would_send.join(", ") : "brak"
      }`,
    );
  } else {
    if (result.sent?.length) {
      console.log(
        `\n📧 Wysłano e-mail powitalny (${result.sent.length}): ${result.sent.join(", ")}`,
      );
      console.log(`- Temat: ${result.subject}`);
      console.log(`- Link rejestracji: ${result.register_url}`);
    } else {
      console.log(`\nℹ️ Nie wysłano żadnego nowego e-maila powitalnego.`);
    }
  }

  if (result.skipped?.length) {
    console.log(`- Pominięto (${result.skipped.length}):`);
    for (const item of result.skipped) {
      console.log(`  • ${item.email}: ${formatSkipReason(item)}`);
    }
  }

  if (result.failed?.length) {
    console.error(`- Błędy wysyłki (${result.failed.length}):`);
    for (const item of result.failed) {
      console.error(`  • ${item.email}: ${item.error}`);
    }
  }

  if (result.warning) {
    console.warn(`⚠️ Ostrzeżenie: ${result.warning}`);
  }

  console.log("");
}

const [, , action, ...rawRest] = process.argv;

try {
  const { positionals, flags } = parseArgs(rawRest);
  const [arg1, ...restPositionals] = positionals;
  const extraArg = restPositionals.join(" ");

  switch (action) {
    case "list":
    case "pending": {
      const rows = runQuery(
        `select id, email, pets_count, status, created_at from public.waitlist order by created_at desc;`,
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
          })),
        );
      }
      break;
    }

    case "whitelist": {
      const rows = runQuery(
        `select email, notes, created_at, welcome_sent_at from public.pilot_whitelist order by created_at desc;`,
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
            "Mail powitalny": r.welcome_sent_at || "—",
          })),
        );
      }
      break;
    }

    case "approve": {
      if (!arg1) {
        console.error(
          "Błąd: Podaj adres e-mail do zatwierdzenia, np. pilot.mjs approve user@example.com",
        );
        process.exit(1);
      }
      const targetEmail = arg1.trim().toLowerCase();
      const existing = runQuery(
        `select id, email, pets_count from public.waitlist where lower(email) = lower(${sqlLiteral(targetEmail)});`,
      );
      const petsCount = existing[0]?.pets_count ?? 1;
      const note = `Zatwierdzony z listy oczekujących (${petsCount} ${pluralizePetsPl(petsCount)})`;

      runQuery(
        `insert into public.pilot_whitelist (email, notes) values (${sqlLiteral(targetEmail)}, ${sqlLiteral(note)}) on conflict (email) do update set notes = excluded.notes; update public.waitlist set status = 'invited' where lower(email) = lower(${sqlLiteral(targetEmail)});`,
      );

      console.log(`\n✅ Pomyślnie zatwierdzono ${targetEmail} do pilotażu!`);
      console.log(`- Dodano do tabeli pilot_whitelist: "${note}"`);
      console.log(`- Zaktualizowano status w tabeli waitlist na: "invited"`);

      if (flags.noEmail) {
        console.log(`- Pominięto wysyłkę e-maila powitalnego (--no-email).\n`);
      } else {
        const result = await sendPilotWelcomeEmails([targetEmail], {
          dryRun: flags.dryRun,
          force: flags.force,
          locale: flags.locale,
        });
        printWelcomeResult(result);
        if (result.failed?.length) {
          process.exit(1);
        }
      }
      break;
    }

    case "reject": {
      if (!arg1) {
        console.error("Błąd: Podaj adres e-mail do odrzucenia.");
        process.exit(1);
      }
      const targetEmail = arg1.trim().toLowerCase();
      runQuery(
        `update public.waitlist set status = 'rejected' where lower(email) = lower(${sqlLiteral(targetEmail)});`,
      );
      console.log(
        `\n❌ Zgłoszenie ${targetEmail} zostało oznaczone jako 'rejected'.\n`,
      );
      break;
    }

    case "add": {
      if (!arg1) {
        console.error(
          "Błąd: Podaj adres e-mail, np. pilot.mjs add user@example.com [notatka]",
        );
        process.exit(1);
      }
      const targetEmail = arg1.trim().toLowerCase();
      const note = extraArg.trim() || "Dodany ręcznie";
      runQuery(
        `insert into public.pilot_whitelist (email, notes) values (${sqlLiteral(targetEmail)}, ${sqlLiteral(note)}) on conflict (email) do update set notes = excluded.notes;`,
      );
      console.log(
        `\n✅ Dodano ${targetEmail} do białej listy pilotażu (notatka: "${note}").`,
      );

      if (flags.noEmail) {
        console.log(`- Pominięto wysyłkę e-maila powitalnego (--no-email).\n`);
      } else {
        const result = await sendPilotWelcomeEmails([targetEmail], {
          dryRun: flags.dryRun,
          force: flags.force,
          locale: flags.locale,
        });
        printWelcomeResult(result);
        if (result.failed?.length) {
          process.exit(1);
        }
      }
      break;
    }

    case "welcome": {
      if (positionals.length === 0) {
        console.error(
          "Błąd: Podaj co najmniej jeden adres e-mail, np. pilot.mjs welcome user@example.com",
        );
        process.exit(1);
      }
      const emails = positionals
        .flatMap((item) => item.split(","))
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
      const result = await sendPilotWelcomeEmails(emails, {
        dryRun: flags.dryRun,
        force: flags.force,
        locale: flags.locale,
      });
      printWelcomeResult(result);
      if (result.failed?.length) {
        process.exit(1);
      }
      break;
    }

    case "remove": {
      if (!arg1) {
        console.error("Błąd: Podaj adres e-mail do usunięcia z białej listy.");
        process.exit(1);
      }
      const targetEmail = arg1.trim().toLowerCase();
      runQuery(
        `delete from public.pilot_whitelist where lower(email) = lower(${sqlLiteral(targetEmail)});`,
      );
      console.log(
        `\n🗑️ Usunięto ${targetEmail} z białej listy pilotażu.\n`,
      );
      break;
    }

    default:
      console.log(`
Użycie: node .agents/skills/pilot-manager/scripts/pilot.mjs <komenda> [argumenty] [flagi]

Dostępne komendy:
  list                                    - wyświetla listę zgłoszeń z waitlisty
  whitelist                               - wyświetla listę testerów z dostępem (pilot_whitelist) i datą maila powitalnego
  approve <email> [--no-email] [--force]  - zatwierdza zgłoszenie z waitlisty, dodaje do pilotażu i wysyła mail powitalny
  reject <email>                          - odrzuca zgłoszenie (oznacza status 'rejected')
  add <email> [note] [--no-email]         - bezpośrednio dodaje email do białej listy pilotażu i wysyła mail powitalny
  welcome <email...> [--dry-run] [--force]- wysyła e-mail powitalny do wybranych osób z białej listy
  remove <email>                          - usuwa email z białej listy pilotażu

Flagi opcjonalne:
  --no-email       - pomiń wysyłkę e-maila powitalnego przy approve/add
  --dry-run        - podgląd wysyłki bez wysyłania SMTP i zapisu welcome_sent_at
  --force          - wyślij ponownie nawet jeśli welcome_sent_at jest już ustawione
  --locale=pl|en   - język e-maila powitalnego (domyślnie pl)
`);
  }
} catch (err) {
  console.error("Błąd podczas wykonywania operacji:", err.message);
  process.exit(1);
}
