import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import {
  buildPilotWelcomeEmailContent,
  normalizePilotWelcomeEmails,
  resolveAppOrigin,
} from "../_shared/pilot-welcome.mjs";
import { escapeHtml } from "../_shared/recovery-crypto.mjs";
import { renderEmailCard } from "../_shared/recovery-email.ts";
import {
  createSmtpTransporter,
  sendSmtpEmail,
  type SmtpTransporter,
} from "../_shared/smtp.ts";
import { resolveAdminNotifyEmail } from "../_shared/smtp-config.mjs";

const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const vapidSubject =
  Deno.env.get("VAPID_SUBJECT") ||
  `mailto:${resolveAdminNotifyEmail((key) => Deno.env.get(key))}`;

type WebPushModule = typeof import("npm:web-push@3.6.7")["default"];

let cachedWebPush: WebPushModule | null = null;
let vapidInitialized = false;

async function getWebPush(): Promise<WebPushModule | null> {
  if (!vapidPublicKey || !vapidPrivateKey) return null;
  if (!cachedWebPush) {
    const mod = await import("npm:web-push@3.6.7");
    cachedWebPush = mod.default;
  }
  if (!vapidInitialized && cachedWebPush) {
    try {
      cachedWebPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      vapidInitialized = true;
    } catch (err) {
      console.warn("[VAPID Init Warning]", err);
      return null;
    }
  }
  return cachedWebPush;
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<{ ok: boolean; expired: boolean }> {
  const webpush = await getWebPush();
  if (!webpush) return { ok: false, expired: false };
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      },
      JSON.stringify(payload),
    );
    return { ok: true, expired: false };
  } catch (err: unknown) {
    const statusCode =
      typeof err === "object" && err !== null && "statusCode" in err
        ? Number((err as { statusCode?: unknown }).statusCode)
        : 0;
    const expired = statusCode === 404 || statusCode === 410;
    if (!expired) {
      console.warn("[WebPush Send Warning]", err);
    }
    return { ok: false, expired };
  }
}

function chunkArray<T>(items: T[], size = 200): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "private, no-store",
};

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });

function warsawDatePlusDays(days: number): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(shifted);
}

const uuidPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function isSafePushEndpoint(raw: string): boolean {
  if (!raw || raw.length > 1000) return false;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.startsWith("[")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function constantTimeEqualStrings(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function formatDatePl(iso: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

function formatDateTimeWarsaw(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(parsed);
}

interface WaitlistEntryRow {
  id: string;
  email: string;
  pets_count: number;
  notes: string | null;
  status: string;
  created_at: string;
}

function pluralizePl(
  n: number,
  one: string,
  few: string,
  many: string,
): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (abs === 1) return one;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

function buildWaitlistDigestEmail(
  entries: WaitlistEntryRow[],
  totalPending: number,
): { subject: string; html: string } {
  const count = entries.length;
  const subject =
    count === 1
      ? `Care My Pet — nowe zgłoszenie na waitlistę: ${entries[0].email}`
      : `Care My Pet — ${count} ${pluralizePl(count, "nowe zgłoszenie", "nowe zgłoszenia", "nowych zgłoszeń")} na listę oczekujących`;

  const rowsHtml = entries
    .map((entry) => {
      const petsLabel = `${entry.pets_count} ${pluralizePl(entry.pets_count, "pupil", "pupile", "pupili")}`;
      const createdAtPl = formatDateTimeWarsaw(entry.created_at);
      const safeEmail = escapeHtml(entry.email);
      const safeNotes = entry.notes?.trim() ? escapeHtml(entry.notes.trim()) : "";
      const approveCmd = escapeHtml(
        `node .agents/skills/pilot-manager/scripts/pilot.mjs approve ${entry.email}`,
      );

      return `
        <div style="border:1px solid #dfd7c8;border-radius:14px;padding:14px 16px;margin-bottom:12px;background:#ffffff;">
          <div style="margin-bottom:6px;">
            <span style="display:inline-block;background:#164d34;color:#ffffff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;letter-spacing:0.04em;">NOWE ZGŁOSZENIE</span>
            <span style="display:inline-block;background:#eef3ee;color:#164d34;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin-left:6px;">🐾 ${escapeHtml(petsLabel)}</span>
          </div>
          <div style="font-size:16px;font-weight:700;color:#1f241f;margin:4px 0;word-break:break-word;">
            ${safeEmail}
          </div>
          <div style="font-size:13px;color:#555046;margin-bottom:8px;">
            Zgłoszono: ${escapeHtml(createdAtPl)} (Europe/Warsaw)
          </div>
          ${
            safeNotes
              ? `<div style="font-size:13px;color:#555046;background:#f8f5ef;padding:8px 10px;border-radius:8px;margin-bottom:8px;">${safeNotes}</div>`
              : ""
          }
          <div style="font-size:12px;color:#4d6d5c;background:#f4faf6;border:1px solid #d5e6dc;padding:8px 10px;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;word-break:break-all;">
            ${approveCmd}
          </div>
        </div>
      `;
    })
    .join("");

  const html = `
    <!doctype html>
    <html lang="pl">
      <body style="margin:0;padding:24px;background:#f4efe6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f241f;">
        <div style="max-width:600px;margin:0 auto;background:#fbf8f3;border:1px solid #e3dacb;border-radius:20px;padding:28px;">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#164d34;margin-bottom:6px;">
            Care My Pet · Pilotaż (caremypet.pl)
          </div>
          <h1 style="font-size:22px;margin:0 0 10px 0;color:#1f241f;">
            ${count === 1 ? "Nowe zgłoszenie na listę oczekujących" : `Nowe zgłoszenia na listę oczekujących (${count})`}
          </h1>
          <p style="font-size:14px;line-height:1.55;color:#555046;margin:0 0 18px 0;">
            Łącznie na zatwierdzenie (status <strong>pending</strong>) czeka obecnie <strong>${totalPending}</strong> ${totalPending === 1 ? "osoba" : totalPending >= 2 && totalPending <= 4 ? "osoby" : "osób"}.
          </p>
          ${rowsHtml}
          <hr style="border:none;border-top:1px solid #e3dacb;margin:20px 0 14px 0;" />
          <p style="font-size:12px;color:#7a7367;margin:0;line-height:1.5;">
            Możesz zatwierdzić kandydata w Antigravity (np. „zatwierdź &lt;email&gt;”) albo z terminala komendą powyżej.
            Ten raport wysyłany jest automatycznie co godzinę przez Supabase tylko wtedy, gdy pojawiają się nowe zgłoszenia.
          </p>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
}

async function isAuthorizedCronRequest(
  req: Request,
  adminClient: SupabaseClient,
): Promise<boolean> {
  const providedSecret = (req.headers.get("x-cron-secret") ?? "").trim();
  if (providedSecret.length < 32) return false;

  const envCronSecret = (Deno.env.get("CRON_SECRET") ?? "").trim();
  if (envCronSecret && constantTimeEqualStrings(providedSecret, envCronSecret)) {
    return true;
  }

  const { data: dbVerified, error: verifyErr } = await adminClient.rpc(
    "verify_cron_dispatch_secret",
    { p_secret: providedSecret },
  );
  return !verifyErr && dbVerified === true;
}

function categoryBadgePl(category: string): string {
  if (category === "vaccination") return "Szczepienie";
  if (category === "prevention") return "Profilaktyka / leki";
  return "Wizyta / kontrola";
}

interface DueReminderItem {
  sourceKind: "schedule_item" | "health_event_due";
  sourceId: string;
  householdId: string;
  petId: string;
  petName: string;
  category: string;
  title: string;
  dueDate: string;
  dueTime: string;
  clinic: string;
  doctor: string;
  notes: string;
  offsetDays: -1 | 0 | 1 | 7;
  extraEmails?: string[];
}

function buildLogKey(
  householdId: string,
  sourceKind: string,
  sourceId: string,
  dueDate: string,
  offsetDays: number,
  recipient: string,
): string {
  return `${householdId}|${sourceKind}|${sourceId}|${dueDate}|${offsetDays}|${recipient.toLowerCase()}`;
}

function buildEmailHtml(
  items: DueReminderItem[],
  isTest: boolean,
  isExternalRecipient = false,
): { subject: string; html: string } {
  const first = items[0];
  const subject = isTest
    ? `Care My Pet — podsumowanie terminarza (${items.length} ${items.length === 1 ? "termin" : "terminów"})`
    : items.length === 1
      ? `Przypomnienie (${first.offsetDays === 0 ? "dzisiaj" : first.offsetDays === 1 ? "jutro" : "za 7 dni"}): ${first.petName} — ${first.title}`
      : `Care My Pet — przypomnienie o ${items.length} nadchodzących terminach`;

  const rowsHtml = items
    .map((it) => {
      const badgeLabel =
        it.offsetDays === 0
          ? "DZISIAJ"
          : it.offsetDays === 1
            ? "JUTRO"
            : it.offsetDays === 7
              ? "ZA 7 DNI"
              : "NADCHODZĄCY TERMIN";
      const badgeBg =
        it.offsetDays === 0 || it.offsetDays === 1 ? "#9b3b24" : "#254b37";

      const metaParts = [
        it.dueTime ? `Godz. ${escapeHtml(it.dueTime)}` : "",
        it.clinic ? escapeHtml(it.clinic) : "",
        it.doctor ? escapeHtml(it.doctor) : "",
      ].filter(Boolean);

      return `
        <div style="border:1px solid #dfd7c8;border-radius:14px;padding:16px 18px;margin-bottom:12px;background:#ffffff;">
          <div style="margin-bottom:6px;">
            <span style="display:inline-block;background:${badgeBg};color:#ffffff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;letter-spacing:0.04em;">${badgeLabel}</span>
            <span style="display:inline-block;background:#eef3ee;color:#254b37;font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;margin-left:6px;">🐾 ${escapeHtml(it.petName)}</span>
            <span style="display:inline-block;color:#625c52;font-size:12px;margin-left:6px;">${escapeHtml(categoryBadgePl(it.category))}</span>
          </div>
          <div style="font-size:16px;font-weight:700;color:#1f241f;margin:4px 0;">
            ${escapeHtml(it.title)}
          </div>
          <div style="font-size:14px;color:#254b37;font-weight:600;margin-bottom:4px;">
            📅 ${escapeHtml(formatDatePl(it.dueDate))}${metaParts.length ? ` · ${metaParts.join(" · ")}` : ""}
          </div>
          ${
            it.notes
              ? `<div style="font-size:13px;color:#555046;background:#f8f5ef;padding:8px 12px;border-radius:8px;margin-top:8px;">${escapeHtml(it.notes)}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  const emptyHtml = `
    <div style="border:1px solid #dfd7c8;border-radius:14px;padding:18px;background:#ffffff;color:#4a463f;font-size:14px;">
      Brak zaplanowanych wizyt lub przypomnień w najbliższych dniach. Twój system powiadomień e-mail Care My Pet działa prawidłowo!
    </div>
  `;

  const html = `
    <!doctype html>
    <html lang="pl">
      <body style="margin:0;padding:24px;background:#f4efe6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f241f;">
        <div style="max-width:600px;margin:0 auto;background:#fbf8f3;border:1px solid #e3dacb;border-radius:20px;padding:28px;">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#254b37;margin-bottom:6px;">
            Care My Pet · Terminarz domowy
          </div>
          <h1 style="font-size:22px;margin:0 0 12px 0;color:#1f241f;">
            ${isTest ? "Testowe podsumowanie terminarza" : "Przypomnienie o nadchodzących terminach"}
          </h1>
          <p style="font-size:14px;line-height:1.55;color:#555046;margin:0 0 20px 0;">
            ${
              isTest
                ? "To jest testowa wiadomość wywołana z poziomu Twojego terminarza Care My Pet. Poniżej znajdują się najbliższe zaplanowane wizyty i przypomnienia:"
                : isExternalRecipient
                  ? "Otrzymujesz to przypomnienie, ponieważ Twój adres e-mail został dopisany przy planowaniu poniższego terminu w aplikacji Care My Pet:"
                  : "Poniżej znajdziesz automatyczne zestawienie nadchodzących wizyt, szczepień i profilaktyki dla Twoich pupili:"
            }
          </p>
          ${items.length > 0 ? rowsHtml : emptyHtml}
          <hr style="border:none;border-top:1px solid #e3dacb;margin:22px 0 14px 0;" />
          <p style="font-size:12px;color:#7a7367;margin:0;">
            Wiadomość wygenerowana automatycznie przez Care My Pet. Ustawienia powiadomień możesz zmienić w zakładce Terminarz.
          </p>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
}

async function fetchInChunks<T>(
  ids: string[],
  fetcher: (chunk: string[]) => Promise<{ data: T[] | null }>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const results: T[] = [];
  for (const chunk of chunkArray(ids, 200)) {
    const { data } = await fetcher(chunk);
    if (Array.isArray(data) && data.length > 0) {
      results.push(...data);
    }
  }
  return results;
}

async function fetchPaginated<T>(
  fetcher: (from: number, to: number) => Promise<{ data: T[] | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await fetcher(offset, offset + pageSize - 1);
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function flushNotificationLogs(
  adminClient: SupabaseClient,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) return;
  for (const batch of chunkArray(rows, 200)) {
    const { error } = await adminClient
      .from("schedule_notification_log")
      .upsert(batch, {
        onConflict:
          "household_id,source_kind,source_id,due_date,offset_days,recipient_email",
        ignoreDuplicates: true,
      });
    if (error) {
      console.error("[NotificationLog Batch Error]", error);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return reply({ error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = typeof body.action === "string" ? body.action : "cron_dispatch";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Przypadek 1: Zalogowany użytkownik zapisuje ustawienia, rejestruje/wyrejestrowuje push lub wysyła test
  if (
    action === "save_settings" ||
    action === "send_test" ||
    action === "send_test_push" ||
    action === "register_push" ||
    action === "unregister_push"
  ) {
    const token = req.headers.get("Authorization");
    if (!token?.startsWith("Bearer ")) {
      return reply({ error: "unauthorized" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: token } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(token.slice(7));

    if (authError || !user || user.is_anonymous) {
      return reply({ error: "unauthorized" }, 401);
    }

    if (action === "register_push") {
      const endpoint =
        typeof body.endpoint === "string" ? body.endpoint.trim() : "";
      const p256dh =
        typeof body.p256dh === "string" ? body.p256dh.trim() : "";
      const authKey =
        typeof body.auth === "string" ? body.auth.trim() : "";
      const userAgent =
        typeof body.user_agent === "string"
          ? body.user_agent.slice(0, 300)
          : (req.headers.get("user-agent") ?? "").slice(0, 300);

      if (
        !isSafePushEndpoint(endpoint) ||
        !p256dh ||
        p256dh.length > 300 ||
        !authKey ||
        authKey.length > 300
      ) {
        return reply({ error: "invalid_subscription" }, 400);
      }

      let targetHouseholdId: string | null = null;
      const requestedHouseholdId =
        typeof body.household_id === "string" ? body.household_id.trim() : "";
      if (uuidPattern.test(requestedHouseholdId)) {
        const { data: hh } = await userClient
          .from("gospodarstwo")
          .select("id")
          .eq("id", requestedHouseholdId)
          .maybeSingle();
        if (!hh) {
          return reply({ error: "forbidden_household" }, 403);
        }
        targetHouseholdId = hh.id;
      } else {
        const { data: fallbackHh } = await userClient
          .from("gospodarstwo")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        targetHouseholdId = fallbackHh?.id ?? null;
      }

      if (!targetHouseholdId) {
        return reply({ error: "no_household" }, 404);
      }

      const { error: upsertErr } = await userClient
        .from("pet_push_subscription")
        .upsert(
          {
            user_id: user.id,
            household_id: targetHouseholdId,
            endpoint,
            p256dh,
            auth: authKey,
            user_agent: userAgent,
            last_used_at: new Date().toISOString(),
          },
          { onConflict: "user_id,endpoint" },
        );

      if (upsertErr) {
        console.error("[PWA Push] Upsert failed:", upsertErr);
        return reply({ error: "save_failed" }, 400);
      }

      return reply({ ok: true, household_id: targetHouseholdId });
    }

    if (action === "unregister_push") {
      const endpoint =
        typeof body.endpoint === "string" ? body.endpoint.trim() : "";
      if (!endpoint || endpoint.length > 1000) {
        return reply({ error: "invalid_input" }, 400);
      }

      const { error: delErr } = await userClient
        .from("pet_push_subscription")
        .delete()
        .eq("endpoint", endpoint);

      if (delErr) {
        console.error("[PWA Push] Delete failed:", delErr);
        return reply({ error: "delete_failed" }, 400);
      }

      return reply({ ok: true });
    }

    if (action === "save_settings") {
      const customEmail =
        typeof body.custom_email === "string"
          ? body.custom_email.trim().slice(0, 160)
          : "";

      const { data: saved, error: saveError } = await userClient.rpc(
        "save_household_notification_settings",
        {
          p_email_enabled: Boolean(body.email_enabled),
          p_notify_7_days_before: Boolean(body.notify_7_days_before),
          p_notify_1_day_before: Boolean(body.notify_1_day_before),
          p_notify_day_of: Boolean(body.notify_day_of),
          p_custom_email: customEmail,
        },
      );

      if (saveError || !saved) {
        return reply({ error: "save_failed" }, 400);
      }

      return reply({ settings: saved });
    }

    if (action === "send_test") {
      const requestedHouseholdId =
        typeof body.household_id === "string" ? body.household_id.trim() : "";
      const householdQuery = userClient.from("gospodarstwo").select("id");
      const { data: household } = uuidPattern.test(requestedHouseholdId)
        ? await householdQuery.eq("id", requestedHouseholdId).maybeSingle()
        : await householdQuery.limit(1).maybeSingle();

      if (!household) {
        return reply({ error: "no_household" }, 404);
      }

      // Rate-limit test digests: max 3 per hour per household
      const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentTestCount } = await adminClient
        .from("schedule_notification_log")
        .select("id", { count: "exact", head: true })
        .eq("household_id", household.id)
        .eq("source_kind", "test_digest")
        .gte("sent_at", oneHourAgoIso);

      if ((recentTestCount ?? 0) >= 3) {
        return reply({ error: "rate_limited" }, 429);
      }

      const { data: settings } = await userClient
        .from("household_notification_settings")
        .select("custom_email")
        .eq("household_id", household.id)
        .maybeSingle();

      const targetEmail = settings?.custom_email?.trim() || user.email;
      if (!targetEmail) {
        return reply({ error: "no_recipient_email" }, 400);
      }

      const todayIso = warsawDatePlusDays(0);

      const [{ data: pets }, { data: scheduleItems }, { data: healthEvents }] =
        await Promise.all([
          userClient
            .from("zwierze")
            .select("id,imie")
            .eq("gospodarstwo_id", household.id)
            .is("archived_at", null),
          userClient
            .from("pet_schedule_item")
            .select("id,pet_id,category,title,scheduled_date,scheduled_time,clinic,doctor,prep_notes")
            .eq("household_id", household.id)
            .eq("status", "planned")
            .gte("scheduled_date", todayIso)
            .order("scheduled_date", { ascending: true })
            .limit(8),
          userClient
            .from("pet_health_event")
            .select("id,pet_id,category,title,next_due_date,clinic,doctor,batch_or_product")
            .eq("household_id", household.id)
            .not("next_due_date", "is", null)
            .gte("next_due_date", todayIso)
            .order("next_due_date", { ascending: true })
            .limit(8),
        ]);

      const petMap = new Map<string, string>(
        (pets ?? []).map((p: { id: string; imie: string }) => [p.id, p.imie]),
      );

      const previewItems: DueReminderItem[] = [
        ...(scheduleItems ?? [])
          .filter((it: Record<string, unknown>) => petMap.has(String(it.pet_id)))
          .map((it: Record<string, unknown>) => ({
            sourceKind: "schedule_item" as const,
            sourceId: String(it.id),
            householdId: household.id,
            petId: String(it.pet_id),
            petName: petMap.get(String(it.pet_id)) ?? "Pupil",
            category: String(it.category),
            title: String(it.title),
            dueDate: String(it.scheduled_date),
            dueTime: String(it.scheduled_time ?? ""),
            clinic: String(it.clinic ?? ""),
            doctor: String(it.doctor ?? ""),
            notes: String(it.prep_notes ?? ""),
            offsetDays: -1 as const,
          })),
        ...(healthEvents ?? [])
          .filter((ev: Record<string, unknown>) => petMap.has(String(ev.pet_id)))
          .map((ev: Record<string, unknown>) => ({
            sourceKind: "health_event_due" as const,
            sourceId: String(ev.id),
            householdId: household.id,
            petId: String(ev.pet_id),
            petName: petMap.get(String(ev.pet_id)) ?? "Pupil",
            category: String(ev.category),
            title: String(ev.title),
            dueDate: String(ev.next_due_date),
            dueTime: "",
            clinic: String(ev.clinic ?? ""),
            doctor: String(ev.doctor ?? ""),
            notes: String(ev.batch_or_product ?? ""),
            offsetDays: -1 as const,
          })),
      ]
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 6);

      const { subject, html } = buildEmailHtml(previewItems, true);

      try {
        const { transporter, from } = await createSmtpTransporter({ pooled: false });
        await transporter.sendMail({
          from,
          to: targetEmail,
          subject,
          html,
        });

        const logId = crypto.randomUUID();
        await adminClient.from("schedule_notification_log").insert({
          household_id: household.id,
          pet_id: previewItems[0]?.petId ?? null,
          source_kind: "test_digest",
          source_id: logId,
          due_date: todayIso,
          offset_days: -1,
          recipient_email: targetEmail,
          subject,
          status: "sent",
        });

        return reply({
          sent: true,
          recipient: targetEmail,
          items_count: previewItems.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "smtp_error";
        return reply({ error: "send_failed", detail: message }, 500);
      }
    }

    if (action === "send_test_push") {
      const { data: subs, error: subsError } = await adminClient
        .from("pet_push_subscription")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", user.id);

      if (subsError) {
        return reply({ error: "database_error", detail: subsError.message }, 500);
      }

      if (!subs || subs.length === 0) {
        return reply(
          {
            error: "no_push_subscriptions",
            message: "Brak aktywnych subskrypcji push na tym koncie.",
          },
          404,
        );
      }

      let sent = 0;
      const expiredIds: string[] = [];
      for (const sub of subs) {
        if (!isSafePushEndpoint(sub.endpoint)) continue;
        const res = await sendWebPush(sub, {
          title: "Care My Pet — Test powiadomień Push",
          body: "Powiadomienia na Twoim telefonie działają prawidłowo! 🐾",
          url: "/app",
          tag: "test-push",
        });
        if (res.ok) sent++;
        if (res.expired) expiredIds.push(String(sub.id));
      }

      if (expiredIds.length > 0) {
        await adminClient
          .from("pet_push_subscription")
          .delete()
          .in("id", expiredIds);
      }

      return reply({
        ok: true,
        sent_count: sent,
        total_subscriptions: subs.length,
      });
    }
  }

  if (action === "waitlist_digest") {
    const cronAuthorized = await isAuthorizedCronRequest(req, adminClient);
    if (!cronAuthorized) {
      return reply({ error: "unauthorized" }, 401);
    }

    const dryRun = body.dry_run === true;
    const recipient = resolveAdminNotifyEmail((key) => Deno.env.get(key));

    const { data: unnotified, error: fetchErr } = await adminClient
      .from("waitlist")
      .select("id, email, pets_count, notes, status, created_at")
      .eq("status", "pending")
      .is("admin_notified_at", null)
      .order("created_at", { ascending: true })
      .limit(200);

    if (fetchErr) {
      console.error("[WaitlistDigest] Failed to load waitlist:", fetchErr);
      return reply({ error: "database_error", detail: fetchErr.message }, 500);
    }

    const entries = (unnotified ?? []) as WaitlistEntryRow[];
    if (entries.length === 0) {
      return reply({
        ok: true,
        sent: false,
        notified_count: 0,
        recipient,
      });
    }

    const { count: totalPending } = await adminClient
      .from("waitlist")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    const { subject, html } = buildWaitlistDigestEmail(
      entries,
      totalPending ?? entries.length,
    );

    if (dryRun) {
      return reply({
        ok: true,
        dry_run: true,
        sent: false,
        recipient,
        subject,
        notified_count: entries.length,
        total_pending: totalPending ?? entries.length,
        emails: entries.map((e) => e.email),
      });
    }

    const sent = await sendSmtpEmail({
      to: recipient,
      subject,
      html,
    });

    if (!sent) {
      return reply({ error: "smtp_send_failed" }, 500);
    }

    const ids = entries.map((e) => e.id);
    const { error: markErr } = await adminClient
      .from("waitlist")
      .update({ admin_notified_at: new Date().toISOString() })
      .in("id", ids)
      .is("admin_notified_at", null);

    if (markErr) {
      console.error("[WaitlistDigest] Failed to mark admin_notified_at:", markErr);
      return reply({
        ok: true,
        sent: true,
        warning: "mark_notified_failed",
        recipient,
        notified_count: entries.length,
        total_pending: totalPending ?? entries.length,
      });
    }

    return reply({
      ok: true,
      sent: true,
      recipient,
      notified_count: entries.length,
      total_pending: totalPending ?? entries.length,
    });
  }

  if (action === "pilot_welcome") {
    const cronAuthorized = await isAuthorizedCronRequest(req, adminClient);
    if (!cronAuthorized) {
      return reply({ error: "unauthorized" }, 401);
    }

    const dryRun = body.dry_run === true;
    const force = body.force === true;
    const locale = body.locale === "en" ? "en" : "pl";
    const rawEmails = body.emails !== undefined ? body.emails : body.email;
    const { valid, invalid, truncated } = normalizePilotWelcomeEmails(rawEmails);

    if (valid.length === 0) {
      return reply(
        {
          error: "no_valid_emails",
          invalid,
        },
        400,
      );
    }

    const { data: whitelistRows, error: wlErr } = await adminClient
      .from("pilot_whitelist")
      .select("email, welcome_sent_at")
      .in("email", valid);

    if (wlErr) {
      console.error("[PilotWelcome] Failed to load pilot_whitelist:", wlErr);
      return reply({ error: "database_error", detail: wlErr.message }, 500);
    }

    const whitelistMap = new Map<
      string,
      { email: string; welcome_sent_at: string | null }
    >();
    for (const row of whitelistRows ?? []) {
      const normalized = String(row.email).trim().toLowerCase();
      whitelistMap.set(normalized, {
        email: String(row.email),
        welcome_sent_at: row.welcome_sent_at ? String(row.welcome_sent_at) : null,
      });
    }

    const skipped: Array<{
      email: string;
      reason: "invalid_email" | "not_whitelisted" | "already_sent";
      welcome_sent_at?: string;
    }> = [];
    const targets: string[] = [];

    for (const bad of invalid) {
      skipped.push({ email: bad, reason: "invalid_email" });
    }

    for (const email of valid) {
      const entry = whitelistMap.get(email);
      if (!entry) {
        skipped.push({ email, reason: "not_whitelisted" });
        continue;
      }
      if (entry.welcome_sent_at && !force) {
        skipped.push({
          email,
          reason: "already_sent",
          welcome_sent_at: entry.welcome_sent_at,
        });
        continue;
      }
      targets.push(email);
    }

    const appOrigin = resolveAppOrigin(
      Deno.env.get("SITE_URL"),
      Deno.env.get("APP_URL"),
    );
    const preview = buildPilotWelcomeEmailContent({
      email: targets[0] ?? valid[0],
      locale,
      appOrigin,
    });

    if (dryRun) {
      return reply({
        ok: true,
        dry_run: true,
        locale,
        register_url: preview.registerUrl,
        subject: preview.subject,
        would_send: targets,
        skipped,
        truncated,
      });
    }

    if (targets.length === 0) {
      return reply({
        ok: true,
        dry_run: false,
        locale,
        register_url: preview.registerUrl,
        subject: preview.subject,
        sent: [],
        skipped,
        failed: [],
        truncated,
      });
    }

    let transporter: SmtpTransporter | null = null;
    let from = "";
    try {
      const smtp = await createSmtpTransporter({ pooled: targets.length > 1 });
      transporter = smtp.transporter;
      from = smtp.from;
    } catch (err) {
      const detail = err instanceof Error ? err.message : "smtp_not_configured";
      return reply({ error: "smtp_not_configured", detail }, 500);
    }

    const sent: string[] = [];
    const failed: Array<{ email: string; error: string }> = [];

    try {
      for (const email of targets) {
        const content = buildPilotWelcomeEmailContent({
          email,
          locale,
          appOrigin,
        });
        const html = renderEmailCard(content.card);
        try {
          await transporter.sendMail({
            from,
            to: email,
            subject: content.subject,
            html,
          });
          sent.push(email);
        } catch (err) {
          failed.push({
            email,
            error: err instanceof Error ? err.message : "smtp_send_failed",
          });
        }
      }
    } finally {
      transporter?.close?.();
    }

    let warning: string | undefined;
    if (sent.length > 0) {
      const dbEmails = sent.map((e) => whitelistMap.get(e)?.email ?? e);
      const { error: markErr } = await adminClient
        .from("pilot_whitelist")
        .update({ welcome_sent_at: new Date().toISOString() })
        .in("email", dbEmails);
      if (markErr) {
        console.error("[PilotWelcome] Failed to mark welcome_sent_at:", markErr);
        warning = "mark_welcome_sent_failed";
      }
    }

    const status = sent.length === 0 && failed.length > 0 ? 500 : 200;
    return reply(
      {
        ok: failed.length === 0,
        dry_run: false,
        locale,
        register_url: preview.registerUrl,
        subject: preview.subject,
        sent,
        skipped,
        failed,
        truncated,
        ...(warning ? { warning } : {}),
      },
      status,
    );
  }

  if (action !== "cron_dispatch") {
    return reply({ error: "unknown_action" }, 400);
  }

  // Przypadek 2: Automatyczna wysyłka z pg_cron / Vercel Cron — wymagany sekret x-cron-secret
  const cronAuthorized = await isAuthorizedCronRequest(req, adminClient);
  if (!cronAuthorized) {
    return reply({ error: "unauthorized" }, 401);
  }

  // Najpierw zatwierdź wnioski o współadministrację po upływie 14 dni bez weta
  try {
    const { data: approvedRequests } = await adminClient.rpc(
      "auto_approve_expired_admin_requests",
    );
    const appOrigin = (
      Deno.env.get("SITE_URL") ||
      Deno.env.get("APP_URL") ||
      "https://caremypet.pl"
    ).replace(/\/$/, "");
    for (const reqRow of Array.isArray(approvedRequests) ? approvedRequests : []) {
      if (reqRow?.requester_email) {
        await sendSmtpEmail({
          to: String(reqRow.requester_email),
          subject: `Automatycznie nadano uprawnienia współadministratora w „${reqRow.household_name}”`,
          html: renderEmailCard({
            badge: "Współadministracja aktywna",
            heading: `Masz już prawa współadministratora w „${String(reqRow.household_name)}”`,
            paragraphs: [
              `Minęło 14 dni od złożenia wniosku w domostwie <strong>${escapeHtml(String(reqRow.household_name))}</strong> i właściciel nie zgłosił sprzeciwu.`,
              `Możesz teraz zarządzać pupilami i ustawieniami tego domostwa.`,
            ],
            cta: {
              label: "Otwórz Care My Pet",
              url: `${appOrigin}/pl/app/household`,
            },
          }),
        });
      }
    }
  } catch (err) {
    console.warn("[AutoApproveAdminRequests Warning]", err);
  }

  const day0 = warsawDatePlusDays(0);
  const day1 = warsawDatePlusDays(1);
  const day7 = warsawDatePlusDays(7);
  const targetDates = [day0, day1, day7];

  // Krok 1: Pobierz wyłącznie terminy przypadające na day0/day1/day7 (paginowane, bez limitu 1000)
  const [scheduleRows, eventRows] = await Promise.all([
    fetchPaginated<Record<string, unknown>>((from, to) =>
      adminClient
        .from("pet_schedule_item")
        .select(
          "id,household_id,pet_id,category,title,scheduled_date,scheduled_time,clinic,doctor,prep_notes,notify_emails",
        )
        .eq("status", "planned")
        .in("scheduled_date", targetDates)
        .range(from, to),
    ),
    fetchPaginated<Record<string, unknown>>((from, to) =>
      adminClient
        .from("pet_health_event")
        .select(
          "id,household_id,pet_id,category,title,next_due_date,clinic,doctor,batch_or_product",
        )
        .in("next_due_date", targetDates)
        .range(from, to),
    ),
  ]);

  if (scheduleRows.length === 0 && eventRows.length === 0) {
    return reply({ ok: true, emails_sent: 0, pushes_sent: 0 });
  }

  // Krok 2: Zbierz unikalne ID pupili i domostw z faktycznych kandydatów i dociągnij powiązane dane hurtowo
  const petIdSet = new Set<string>();
  const householdIdSet = new Set<string>();
  for (const row of scheduleRows) {
    if (row.pet_id) petIdSet.add(String(row.pet_id));
    if (row.household_id) householdIdSet.add(String(row.household_id));
  }
  for (const row of eventRows) {
    if (row.pet_id) petIdSet.add(String(row.pet_id));
    if (row.household_id) householdIdSet.add(String(row.household_id));
  }

  const petIds = Array.from(petIdSet);
  const householdIds = Array.from(householdIdSet);

  const [activePets, matchedSettings, existingSentLogs, householdSubsAll] =
    await Promise.all([
      fetchInChunks<{ id: string; imie: string; gospodarstwo_id: string }>(
        petIds,
        (chunk) =>
          adminClient
            .from("zwierze")
            .select("id,imie,gospodarstwo_id")
            .in("id", chunk)
            .is("archived_at", null),
      ),
      fetchInChunks<Record<string, unknown>>(householdIds, (chunk) =>
        adminClient
          .from("household_notification_settings")
          .select(
            "household_id,email_enabled,notify_7_days_before,notify_1_day_before,notify_day_of,custom_email",
          )
          .in("household_id", chunk),
      ),
      fetchInChunks<{
        household_id: string;
        source_kind: string;
        source_id: string;
        due_date: string;
        offset_days: number;
        recipient_email: string;
      }>(householdIds, (chunk) =>
        adminClient
          .from("schedule_notification_log")
          .select(
            "household_id,source_kind,source_id,due_date,offset_days,recipient_email",
          )
          .in("household_id", chunk)
          .in("due_date", targetDates)
          .eq("status", "sent"),
      ),
      fetchInChunks<{
        id: string;
        household_id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
      }>(householdIds, (chunk) =>
        adminClient
          .from("pet_push_subscription")
          .select("id,household_id,endpoint,p256dh,auth")
          .in("household_id", chunk),
      ),
    ]);

  const petInfoMap = new Map<string, { name: string; householdId: string }>();
  for (const p of activePets) {
    petInfoMap.set(String(p.id), {
      name: String(p.imie),
      householdId: String(p.gospodarstwo_id),
    });
  }

  const settingsByHousehold = new Map<string, Record<string, unknown>>();
  for (const s of matchedSettings) {
    settingsByHousehold.set(String(s.household_id), s);
  }

  const sentLogKeys = new Set<string>();
  for (const log of existingSentLogs) {
    sentLogKeys.add(
      buildLogKey(
        String(log.household_id),
        String(log.source_kind),
        String(log.source_id),
        String(log.due_date),
        Number(log.offset_days),
        String(log.recipient_email),
      ),
    );
  }

  const subsByHousehold = new Map<
    string,
    Array<{ id: string; endpoint: string; p256dh: string; auth: string }>
  >();
  for (const sub of householdSubsAll) {
    const hId = String(sub.household_id);
    const list = subsByHousehold.get(hId) ?? [];
    list.push({
      id: String(sub.id),
      endpoint: String(sub.endpoint),
      p256dh: String(sub.p256dh),
      auth: String(sub.auth),
    });
    subsByHousehold.set(hId, list);
  }

  const byHousehold = new Map<string, DueReminderItem[]>();

  const pushCandidate = (item: DueReminderItem) => {
    const cfg = settingsByHousehold.get(item.householdId);
    const emailEnabled = cfg ? Boolean(cfg.email_enabled) : true;
    const hasPushSubs = (subsByHousehold.get(item.householdId)?.length ?? 0) > 0;
    if (!emailEnabled && !hasPushSubs) return;

    const allow7 = cfg ? Boolean(cfg.notify_7_days_before) : true;
    const allow1 = cfg ? Boolean(cfg.notify_1_day_before) : true;
    const allow0 = cfg ? Boolean(cfg.notify_day_of) : false;

    if (item.offsetDays === 7 && !allow7) return;
    if (item.offsetDays === 1 && !allow1) return;
    if (item.offsetDays === 0 && !allow0) return;

    const list = byHousehold.get(item.householdId) ?? [];
    list.push(item);
    byHousehold.set(item.householdId, list);
  };

  for (const row of scheduleRows) {
    const d = String(row.scheduled_date);
    const offset: 0 | 1 | 7 = d === day0 ? 0 : d === day1 ? 1 : 7;
    const petInfo = petInfoMap.get(String(row.pet_id));
    if (!petInfo) continue;
    pushCandidate({
      sourceKind: "schedule_item",
      sourceId: String(row.id),
      householdId: String(row.household_id),
      petId: String(row.pet_id),
      petName: petInfo.name,
      category: String(row.category),
      title: String(row.title),
      dueDate: d,
      dueTime: String(row.scheduled_time ?? ""),
      clinic: String(row.clinic ?? ""),
      doctor: String(row.doctor ?? ""),
      notes: String(row.prep_notes ?? ""),
      offsetDays: offset,
      extraEmails: Array.isArray(row.notify_emails)
        ? row.notify_emails
            .map((e: unknown) => String(e).trim().toLowerCase())
            .filter(Boolean)
        : [],
    });
  }

  for (const row of eventRows) {
    const d = String(row.next_due_date);
    const offset: 0 | 1 | 7 = d === day0 ? 0 : d === day1 ? 1 : 7;
    const petInfo = petInfoMap.get(String(row.pet_id));
    if (!petInfo) continue;
    pushCandidate({
      sourceKind: "health_event_due",
      sourceId: String(row.id),
      householdId: String(row.household_id),
      petId: String(row.pet_id),
      petName: petInfo.name,
      category: String(row.category),
      title: String(row.title),
      dueDate: d,
      dueTime: "",
      clinic: String(row.clinic ?? ""),
      doctor: String(row.doctor ?? ""),
      notes: String(row.batch_or_product ?? ""),
      offsetDays: offset,
    });
  }

  let pooledSmtp: { transporter: SmtpTransporter; from: string } | null = null;
  const ensurePooledSmtp = async () => {
    if (!pooledSmtp) {
      pooledSmtp = await createSmtpTransporter({ pooled: true });
    }
    return pooledSmtp;
  };

  const pendingLogs: Array<Record<string, unknown>> = [];
  const expiredPushSubIds: string[] = [];
  let emailsSent = 0;
  let pushesSent = 0;

  async function sendUnsentDigest(
    householdId: string,
    email: string,
    candidateItems: DueReminderItem[],
    isExternalRecipient: boolean,
  ): Promise<boolean> {
    const unsentItems = candidateItems.filter(
      (item) =>
        !sentLogKeys.has(
          buildLogKey(
            householdId,
            item.sourceKind,
            item.sourceId,
            item.dueDate,
            item.offsetDays,
            email,
          ),
        ),
    );

    if (unsentItems.length === 0) return false;

    const { subject, html } = buildEmailHtml(
      unsentItems,
      false,
      isExternalRecipient,
    );
    try {
      const { transporter, from } = await ensurePooledSmtp();
      await transporter.sendMail({
        from,
        to: email,
        subject,
        html,
      });
      for (const item of unsentItems) {
        const key = buildLogKey(
          householdId,
          item.sourceKind,
          item.sourceId,
          item.dueDate,
          item.offsetDays,
          email,
        );
        sentLogKeys.add(key);
        pendingLogs.push({
          household_id: householdId,
          pet_id: item.petId,
          source_kind: item.sourceKind,
          source_id: item.sourceId,
          due_date: item.dueDate,
          offset_days: item.offsetDays,
          recipient_email: email,
          subject,
          status: "sent",
        });
      }
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "smtp_error";
      for (const item of unsentItems) {
        pendingLogs.push({
          household_id: householdId,
          pet_id: item.petId,
          source_kind: item.sourceKind,
          source_id: item.sourceId,
          due_date: item.dueDate,
          offset_days: item.offsetDays,
          recipient_email: email,
          subject,
          status: "failed",
          error_message: msg,
        });
      }
      return false;
    }
  }

  try {
    for (const [householdId, items] of byHousehold.entries()) {
      const cfg = settingsByHousehold.get(householdId);
      const emailEnabled = cfg ? Boolean(cfg.email_enabled) : true;

      if (emailEnabled) {
        const customEmail =
          typeof cfg?.custom_email === "string" ? cfg.custom_email.trim() : "";

        const recipients = new Set<string>();
        if (customEmail) {
          recipients.add(customEmail);
        } else {
          const { data: recRows } = await adminClient.rpc(
            "get_household_notification_recipients",
            { p_household_id: householdId },
          );
          for (const r of recRows ?? []) {
            if (r.email) recipients.add(String(r.email));
          }
        }

        const householdEmailLowerSet = new Set(
          Array.from(recipients).map((r) => r.toLowerCase()),
        );

        for (const email of recipients) {
          if (await sendUnsentDigest(householdId, email, items, false)) {
            emailsSent += 1;
          }
        }

        // Dodatkowe adresy przypisane per konkretny termin (otrzymują wyłącznie własne pozycje)
        const extraByEmail = new Map<string, DueReminderItem[]>();
        for (const item of items) {
          for (const extraEmail of item.extraEmails ?? []) {
            if (!extraEmail || householdEmailLowerSet.has(extraEmail)) continue;
            const list = extraByEmail.get(extraEmail) ?? [];
            list.push(item);
            extraByEmail.set(extraEmail, list);
          }
        }

        for (const [extraEmail, assignedItems] of extraByEmail.entries()) {
          if (await sendUnsentDigest(householdId, extraEmail, assignedItems, true)) {
            emailsSent += 1;
          }
        }
      }

      // Web Push Notifications z deduplikacją i czyszczeniem wygasłych subskrypcji (404/410)
      const householdSubs = subsByHousehold.get(householdId) ?? [];
      if (householdSubs.length > 0 && items.length > 0) {
        for (const sub of householdSubs) {
          if (!isSafePushEndpoint(sub.endpoint)) continue;
          const pushRecipientKey = `webpush:${sub.id}`;
          const unsentForSub = items.filter(
            (item) =>
              !sentLogKeys.has(
                buildLogKey(
                  householdId,
                  item.sourceKind,
                  item.sourceId,
                  item.dueDate,
                  item.offsetDays,
                  pushRecipientKey,
                ),
              ),
          );
          if (unsentForSub.length === 0) continue;

          const first = unsentForSub[0];
          const pushTitle =
            unsentForSub.length === 1
              ? `🐾 ${first.petName}: ${first.title}`
              : `Care My Pet: ${unsentForSub.length} nadchodzących terminów`;
          const pushBody =
            unsentForSub.length === 1
              ? `${first.offsetDays === 0 ? "Dzisiaj" : first.offsetDays === 1 ? "Jutro" : "Za 7 dni"}: ${first.title}${first.dueTime ? ` (${first.dueTime})` : ""}`
              : "Sprawdź dzisiejszy terminarz opieki nad pupilami.";

          const res = await sendWebPush(sub, {
            title: pushTitle,
            body: pushBody,
            url: `/app/pets/${first.petId}`,
            tag: `due-${first.dueDate}-${first.sourceId}`,
          });

          if (res.ok) {
            pushesSent += 1;
            for (const item of unsentForSub) {
              sentLogKeys.add(
                buildLogKey(
                  householdId,
                  item.sourceKind,
                  item.sourceId,
                  item.dueDate,
                  item.offsetDays,
                  pushRecipientKey,
                ),
              );
              pendingLogs.push({
                household_id: householdId,
                pet_id: item.petId,
                source_kind: item.sourceKind,
                source_id: item.sourceId,
                due_date: item.dueDate,
                offset_days: item.offsetDays,
                recipient_email: pushRecipientKey,
                subject: pushTitle.slice(0, 200),
                status: "sent",
              });
            }
          } else if (res.expired) {
            expiredPushSubIds.push(sub.id);
          }
        }
      }
    }

    await flushNotificationLogs(adminClient, pendingLogs);

    if (expiredPushSubIds.length > 0) {
      for (const batch of chunkArray(expiredPushSubIds, 200)) {
        await adminClient.from("pet_push_subscription").delete().in("id", batch);
      }
    }
  } finally {
    pooledSmtp?.transporter.close?.();
  }

  return reply({
    ok: true,
    emails_sent: emailsSent,
    pushes_sent: pushesSent,
    expired_subscriptions_removed: expiredPushSubIds.length,
  });
});
