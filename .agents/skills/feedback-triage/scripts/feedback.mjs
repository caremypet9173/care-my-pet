#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = new Set([
  "new",
  "triaged",
  "planned",
  "resolved",
  "wontfix",
]);

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runQuery(sql) {
  const tmpFile = path.join(
    os.tmpdir(),
    `caremypet-feedback-query-${process.pid}-${Date.now()}.sql`,
  );
  fs.writeFileSync(tmpFile, sql, "utf8");
  try {
    const raw = execFileSync(
      "supabase",
      ["db", "query", "--linked", "-f", tmpFile],
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`Nie udało się sparsować wyniku SQL:\n${raw}`);
    }
    const parsed = JSON.parse(match[0]);
    return parsed.rows || [];
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // ignore temp cleanup errors
    }
  }
}

const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  "../../../..",
);

function downloadScreenshot(screenshotPath, feedbackId) {
  if (!screenshotPath) return null;
  const outDir = path.join(os.tmpdir(), "caremypet-feedback");
  fs.mkdirSync(outDir, { recursive: true });
  const ext = path.extname(screenshotPath) || ".jpg";
  const fileName = `${feedbackId}${ext}`;
  const localPath = path.join(outDir, fileName);
  try {
    // Use relative destination filename inside outDir + --workdir to avoid Windows "C:" URL-scheme parsing bug in supabase storage cp
    execFileSync(
      "supabase",
      [
        "storage",
        "cp",
        "--linked",
        "--experimental",
        "--workdir",
        REPO_ROOT,
        `ss:///pilot-feedback/${screenshotPath}`,
        fileName,
      ],
      {
        cwd: outDir,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    return fs.existsSync(localPath) ? localPath : null;
  } catch (err) {
    console.error(
      `⚠️ Nie udało się pobrać zrzutu ekranu (${screenshotPath}): ${err.message}`,
    );
    return null;
  }
}

const [, , action, arg1, arg2, ...restArgs] = process.argv;

try {
  switch (action) {
    case "list": {
      let whereClause = "where status in ('new', 'triaged', 'planned')";
      if (arg1 === "all") {
        whereClause = "";
      } else if (arg1 && VALID_STATUSES.has(arg1)) {
        whereClause = `where status = ${sqlQuote(arg1)}`;
      } else if (arg1) {
        console.error(
          `Nieznany filtr statusu "${arg1}". Dozwolone: all, new, triaged, planned, resolved, wontfix.`,
        );
        process.exit(1);
      }

      const rows = runQuery(`
        select
          id,
          category,
          status,
          route_template,
          active_tab,
          device_class,
          is_pwa,
          reporter_email,
          (screenshot_path is not null) as has_screenshot,
          left(replace(message, E'\n', ' '), 90) as preview,
          created_at
        from public.pilot_feedback
        ${whereClause}
        order by
          case status
            when 'new' then 1
            when 'triaged' then 2
            when 'planned' then 3
            when 'resolved' then 4
            else 5
          end,
          created_at desc
        limit 50;
      `);

      if (rows.length === 0) {
        console.log("Brak pasujących zgłoszeń w pilot_feedback.");
      } else {
        console.log(`\n📝 Zgłoszenia pilotażu (${rows.length}):\n`);
        console.table(
          rows.map((r) => ({
            ID: String(r.id).slice(0, 8),
            Status: r.status,
            Kat: r.category,
            Trasa: r.active_tab
              ? `${r.route_template}?tab=${r.active_tab}`
              : r.route_template,
            Urządzenie: `${r.device_class}${r.is_pwa ? "/PWA" : ""}`,
            Zrzut: r.has_screenshot ? "tak" : "nie",
            Zgłaszający: r.reporter_email || "—",
            Opis: r.preview,
            Data: r.created_at,
          })),
        );
        console.log("\nPełne UUID:");
        for (const r of rows) {
          console.log(`- ${r.id} [${r.status}/${r.category}] ${r.route_template}`);
        }
      }
      break;
    }

    case "summary": {
      const rows = runQuery(`
        select status, category, route_template, total_items, with_screenshot, last_reported_at
        from private.pilot_feedback_summary;
      `);
      if (rows.length === 0) {
        console.log("Brak zgłoszeń w pilot_feedback.");
      } else {
        console.table(rows);
      }
      break;
    }

    case "show": {
      if (!arg1 || !UUID_RE.test(arg1)) {
        console.error("Błąd: podaj pełny UUID zgłoszenia, np. show <uuid>");
        process.exit(1);
      }
      const rows = runQuery(`
        select *
        from public.pilot_feedback
        where id = ${sqlQuote(arg1)}::uuid
        limit 1;
      `);
      if (rows.length === 0) {
        console.error(`Nie znaleziono zgłoszenia o ID ${arg1}.`);
        process.exit(1);
      }
      const item = rows[0];
      const localScreenshot = item.screenshot_path
        ? downloadScreenshot(item.screenshot_path, item.id)
        : null;

      console.log(
        JSON.stringify(
          {
            ...item,
            local_screenshot_path: localScreenshot,
          },
          null,
          2,
        ),
      );
      break;
    }

    case "update": {
      if (!arg1 || !UUID_RE.test(arg1)) {
        console.error("Błąd: podaj pełny UUID zgłoszenia.");
        process.exit(1);
      }
      if (!arg2 || !VALID_STATUSES.has(arg2)) {
        console.error(
          "Błąd: podaj poprawny status: new | triaged | planned | resolved | wontfix",
        );
        process.exit(1);
      }
      const note = restArgs.join(" ").trim().slice(0, 4000);
      const rows = runQuery(`
        update public.pilot_feedback
        set
          status = ${sqlQuote(arg2)},
          triage_notes = case when ${sqlQuote(note)} <> '' then ${sqlQuote(note)} else triage_notes end,
          triaged_at = now(),
          updated_at = now()
        where id = ${sqlQuote(arg1)}::uuid
        returning id, status, triaged_at, triage_notes;
      `);
      if (rows.length === 0) {
        console.error(`Nie znaleziono zgłoszenia o ID ${arg1}.`);
        process.exit(1);
      }
      console.log("✅ Zaktualizowano zgłoszenie:", JSON.stringify(rows[0], null, 2));
      break;
    }

    default:
      console.log(`
Użycie: node .agents/skills/feedback-triage/scripts/feedback.mjs <komenda> [argumenty]

Komendy:
  list [all|new|triaged|planned|resolved|wontfix]  - lista zgłoszeń (domyślnie otwarte)
  summary                                          - podsumowanie wg statusu/kategorii/trasy
  show <uuid>                                      - pełny kontekst + pobranie zrzutu ekranu
  update <uuid> <status> [notatka]                 - aktualizacja statusu i notatki triage
`);
  }
} catch (err) {
  console.error("Błąd:", err.message);
  process.exit(1);
}
