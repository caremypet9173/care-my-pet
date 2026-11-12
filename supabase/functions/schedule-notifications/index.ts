import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import nodemailer from "npm:nodemailer@6.9.16";
import webpush from "npm:web-push@3.6.7";

const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const vapidSubject =
  Deno.env.get("VAPID_SUBJECT") || "mailto:caremypet9173@gmail.com";

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.warn("[VAPID Init Warning]", err);
  }
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<boolean> {
  if (!vapidPublicKey || !vapidPrivateKey) return false;
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err: unknown) {
    console.warn("[WebPush Send Warning]", err);
    return false;
  }
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

async function sendEmailViaSmtp(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const smtpUser = Deno.env.get("SMTP_USER") || "caremypet9173@gmail.com";
  const smtpPass = Deno.env.get("SMTP_PASS");
  if (!smtpPass) {
    throw new Error("Missing SMTP_PASS secret");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  await transporter.sendMail({
    from: `"Care My Pet" <${smtpUser}>`,
    to,
    subject,
    html,
  });
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

  // Przypadek 1: Zalogowany użytkownik zapisuje ustawienia, wysyła testowego maila lub testowy push
  if (action === "save_settings" || action === "send_test" || action === "send_test_push") {
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
      const { data: household } = await userClient
        .from("gospodarstwo")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (!household) {
        return reply({ error: "no_household" }, 404);
      }

      const { data: settings } = await userClient
        .from("household_notification_settings")
        .select("custom_email")
        .eq("household_id", household.id)
        .maybeSingle();

      const targetEmail =
        (typeof body.recipient_email === "string" &&
          body.recipient_email.trim()) ||
        settings?.custom_email?.trim() ||
        user.email;

      if (!targetEmail) {
        return reply({ error: "no_recipient_email" }, 400);
      }

      const todayIso = warsawDatePlusDays(0);

      const [{ data: pets }, { data: scheduleItems }, { data: healthEvents }] =
        await Promise.all([
          userClient.from("zwierze").select("id,imie"),
          userClient
            .from("pet_schedule_item")
            .select("*")
            .eq("status", "planned")
            .gte("scheduled_date", todayIso)
            .order("scheduled_date", { ascending: true })
            .limit(8),
          userClient
            .from("pet_health_event")
            .select("*")
            .not("next_due_date", "is", null)
            .gte("next_due_date", todayIso)
            .order("next_due_date", { ascending: true })
            .limit(8),
        ]);

      const petMap = new Map<string, string>(
        (pets ?? []).map((p: { id: string; imie: string }) => [p.id, p.imie]),
      );

      const previewItems: DueReminderItem[] = [
        ...(scheduleItems ?? []).map((it: Record<string, unknown>) => ({
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
        ...(healthEvents ?? []).map((ev: Record<string, unknown>) => ({
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
        await sendEmailViaSmtp(targetEmail, subject, html);

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
        return reply({ error: "no_push_subscriptions", message: "Brak aktywnych subskrypcji push na tym koncie." }, 404);
      }

      let sent = 0;
      for (const sub of subs) {
        const ok = await sendWebPush(sub, {
          title: "Care My Pet — Test powiadomień Push",
          body: "Powiadomienia na Twoim telefonie działają prawidłowo! 🐾",
          url: "/app",
          tag: "test-push",
        });
        if (ok) sent++;
      }

      return reply({ ok: true, sent_count: sent, total_subscriptions: subs.length });
    }
  }

  // Przypadek 2: Automatyczna wysyłka z pg_cron (lub ręczny dispatch)
  const day0 = warsawDatePlusDays(0);
  const day1 = warsawDatePlusDays(1);
  const day7 = warsawDatePlusDays(7);
  const targetDates = [day0, day1, day7];

  const [
    { data: scheduleRows },
    { data: eventRows },
    { data: allPets },
    { data: allSettings },
  ] = await Promise.all([
    adminClient
      .from("pet_schedule_item")
      .select("*")
      .eq("status", "planned")
      .in("scheduled_date", targetDates),
    adminClient
      .from("pet_health_event")
      .select("*")
      .in("next_due_date", targetDates),
    adminClient.from("zwierze").select("id,imie,gospodarstwo_id"),
    adminClient.from("household_notification_settings").select("*"),
  ]);

  const petInfoMap = new Map<string, { name: string; householdId: string }>();
  for (const p of allPets ?? []) {
    petInfoMap.set(String(p.id), {
      name: String(p.imie),
      householdId: String(p.gospodarstwo_id),
    });
  }

  const settingsByHousehold = new Map<string, Record<string, unknown>>();
  for (const s of allSettings ?? []) {
    settingsByHousehold.set(String(s.household_id), s);
  }

  const byHousehold = new Map<string, DueReminderItem[]>();

  const pushCandidate = (item: DueReminderItem) => {
    const cfg = settingsByHousehold.get(item.householdId);
    const emailEnabled = cfg ? Boolean(cfg.email_enabled) : true;
    if (!emailEnabled) return;

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

  for (const row of scheduleRows ?? []) {
    const d = String(row.scheduled_date);
    const offset: 0 | 1 | 7 = d === day0 ? 0 : d === day1 ? 1 : 7;
    const petInfo = petInfoMap.get(String(row.pet_id));
    pushCandidate({
      sourceKind: "schedule_item",
      sourceId: String(row.id),
      householdId: String(row.household_id),
      petId: String(row.pet_id),
      petName: petInfo?.name ?? "Pupil",
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

  for (const row of eventRows ?? []) {
    const d = String(row.next_due_date);
    const offset: 0 | 1 | 7 = d === day0 ? 0 : d === day1 ? 1 : 7;
    const petInfo = petInfoMap.get(String(row.pet_id));
    pushCandidate({
      sourceKind: "health_event_due",
      sourceId: String(row.id),
      householdId: String(row.household_id),
      petId: String(row.pet_id),
      petName: petInfo?.name ?? "Pupil",
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

  async function sendUnsentDigest(
    householdId: string,
    email: string,
    candidateItems: DueReminderItem[],
    isExternalRecipient: boolean,
  ): Promise<boolean> {
    const unsentItems: DueReminderItem[] = [];
    for (const item of candidateItems) {
      const { data: existing } = await adminClient
        .from("schedule_notification_log")
        .select("id")
        .eq("household_id", householdId)
        .eq("source_kind", item.sourceKind)
        .eq("source_id", item.sourceId)
        .eq("due_date", item.dueDate)
        .eq("offset_days", item.offsetDays)
        .eq("recipient_email", email)
        .eq("status", "sent")
        .maybeSingle();

      if (!existing) {
        unsentItems.push(item);
      }
    }

    if (unsentItems.length === 0) return false;

    const { subject, html } = buildEmailHtml(
      unsentItems,
      false,
      isExternalRecipient,
    );
    try {
      await sendEmailViaSmtp(email, subject, html);
      for (const item of unsentItems) {
        await adminClient.from("schedule_notification_log").insert({
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
        await adminClient.from("schedule_notification_log").insert({
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

  let emailsSent = 0;

  for (const [householdId, items] of byHousehold.entries()) {
    const cfg = settingsByHousehold.get(householdId);
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

    // Web Push Notifications for household devices
    try {
      const { data: householdSubs } = await adminClient
        .from("pet_push_subscription")
        .select("id, endpoint, p256dh, auth")
        .eq("household_id", householdId);

      if (householdSubs && householdSubs.length > 0 && items.length > 0) {
        const first = items[0];
        const pushTitle =
          items.length === 1
            ? `🐾 ${first.petName}: ${first.title}`
            : `Care My Pet: ${items.length} nadchodzących terminów`;
        const pushBody =
          items.length === 1
            ? `${first.offsetDays === 0 ? "Dzisiaj" : first.offsetDays === 1 ? "Jutro" : "Za 7 dni"}: ${first.title}${first.dueTime ? ` (${first.dueTime})` : ""}`
            : "Sprawdź dzisiejszy terminarz opieki nad pupilami.";

        for (const sub of householdSubs) {
          await sendWebPush(sub, {
            title: pushTitle,
            body: pushBody,
            url: `/app/zwierzeta/${first.petId}`,
            tag: `due-${first.dueDate}-${first.sourceId}`,
          });
        }
      }
    } catch (pushErr) {
      console.warn("[WebPush Cron Warning]", pushErr);
    }
  }

  return reply({ ok: true, emails_sent: emailsSent });
});
