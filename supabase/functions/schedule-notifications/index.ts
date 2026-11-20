import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";
import { escapeHtml } from "../_shared/recovery-crypto.mjs";
import { renderEmailCard, sendSmtpEmail } from "../_shared/recovery-email.ts";

const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const vapidSubject =
  Deno.env.get("VAPID_SUBJECT") || "mailto:caremypet9173@gmail.com";

type WebPushModule = typeof import("npm:web-push@3.6.7")["default"];
type SmtpTransporter = {
  sendMail: (opts: {
    from: string;
    to: string;
    subject: string;
    html: string;
  }) => Promise<unknown>;
  close?: () => void;
};

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

async function createSmtpTransporter(pooled: boolean): Promise<{
  transporter: SmtpTransporter;
  smtpUser: string;
}> {
  const smtpUser = Deno.env.get("SMTP_USER") || "caremypet9173@gmail.com";
  const smtpPass = Deno.env.get("SMTP_PASS");
  if (!smtpPass) {
    throw new Error("Missing SMTP_PASS secret");
  }
  const { default: nodemailer } = await import("npm:nodemailer@6.9.16");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    ...(pooled ? { pool: true, maxConnections: 3, maxMessages: 50 } : {}),
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  }) as unknown as SmtpTransporter;

  return { transporter, smtpUser };
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
        const { transporter, smtpUser } = await createSmtpTransporter(false);
        await transporter.sendMail({
          from: `"Care My Pet" <${smtpUser}>`,
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

  if (action !== "cron_dispatch") {
    return reply({ error: "unknown_action" }, 400);
  }

  // Przypadek 2: Automatyczna wysyłka z pg_cron / Vercel Cron — wymagany sekret x-cron-secret
  const providedSecret = (req.headers.get("x-cron-secret") ?? "").trim();
  const envCronSecret = (Deno.env.get("CRON_SECRET") ?? "").trim();
  let cronAuthorized = false;

  if (providedSecret.length >= 32) {
    if (envCronSecret && constantTimeEqualStrings(providedSecret, envCronSecret)) {
      cronAuthorized = true;
    } else {
      const { data: dbVerified, error: verifyErr } = await adminClient.rpc(
        "verify_cron_dispatch_secret",
        { p_secret: providedSecret },
      );
      if (!verifyErr && dbVerified === true) {
        cronAuthorized = true;
      }
    }
  }

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
      "https://caremypet.app"
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

  let pooledSmtp: { transporter: SmtpTransporter; smtpUser: string } | null = null;
  const ensurePooledSmtp = async () => {
    if (!pooledSmtp) {
      pooledSmtp = await createSmtpTransporter(true);
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
      const { transporter, smtpUser } = await ensurePooledSmtp();
      await transporter.sendMail({
        from: `"Care My Pet" <${smtpUser}>`,
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
