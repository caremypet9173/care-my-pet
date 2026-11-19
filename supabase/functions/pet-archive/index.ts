import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import {
  ARCHIVE_LOCK_MS,
  ARCHIVE_MAX_FAILED_ATTEMPTS,
  ARCHIVE_TTL_DAYS,
  ARCHIVE_TTL_MS,
  formatAccessCode,
  generateAccessCode,
  generateArchiveToken,
  generateSaltHex,
  hashAccessCode,
  isValidArchiveEmail,
  maskEmail,
  normalizeArchiveEmail,
  normalizeArchiveLabel,
  signArchiveSession,
  verifyAccessCode,
  verifyArchiveSession,
} from "./helpers.mjs";
import { resolveSafeOrigin } from "../_shared/safe-origin.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "private, no-store",
};

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });

const uuidPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{24,80}$/;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeDownloadFilename(raw: string, fallback = "dokument"): string {
  const cleaned = raw
    .replace(/[\\/:*?"<>|\r\n]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

async function sendArchiveEmail(params: {
  to: string;
  locale: "pl" | "en";
  petName: string;
  senderEmail: string;
  label: string;
  archiveUrl: string;
  formattedCode: string;
  expiresAtIso: string;
}): Promise<boolean> {
  const smtpUser = Deno.env.get("SMTP_USER") || "caremypet9173@gmail.com";
  const smtpPass = Deno.env.get("SMTP_PASS");
  if (!smtpPass) {
    console.warn("SMTP_PASS secret missing; cannot send archive email");
    return false;
  }

  const pl = params.locale === "pl";
  const formattedExpiry = new Intl.DateTimeFormat(pl ? "pl-PL" : "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Warsaw",
  }).format(new Date(params.expiresAtIso));

  const subject = pl
    ? `Archiwum kartoteki zdrowia: ${params.petName} — link i kod dostępu`
    : `Health record archive: ${params.petName} — download link and access code`;

  const html = pl
    ? `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fbf9f4;color:#1f241f;border-radius:16px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="color:#164d34;font-size:22px;margin:0 0 6px 0;">Care My Pet</h1>
          <p style="color:#526462;font-size:13px;margin:0;">Archiwum cyfrowej kartoteki zdrowia</p>
        </div>
        <div style="background:#ffffff;border:1px solid #dfd7c8;border-radius:12px;padding:24px;margin-bottom:20px;">
          <h2 style="font-size:18px;color:#1f241f;margin-top:0;">Udostępniono archiwum danych: ${escapeHtml(params.petName)}</h2>
          <p style="font-size:14px;line-height:1.55;color:#333c3a;">
            Użytkownik <strong>${escapeHtml(params.senderEmail)}</strong> przygotował dla Ciebie pakiet archiwum kartoteki medycznej pupila <strong>${escapeHtml(params.petName)}</strong>${params.label ? ` (${escapeHtml(params.label)})` : ""}.
          </p>
          <p style="font-size:14px;line-height:1.55;color:#526462;">
            Pod linkiem możesz pobrać pełny raport PDF z historią leczenia, badaniami, pomiarami i lekami oraz oryginalne załączniki badań.
          </p>
          <div style="margin:22px 0;padding:16px;background:#f4faf6;border:1px solid #b8d4c5;border-radius:10px;text-align:center;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#4d6d5c;margin-bottom:6px;">Kod dostępu</div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:26px;font-weight:700;letter-spacing:0.12em;color:#164d34;">
              ${escapeHtml(params.formattedCode)}
            </div>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${escapeHtml(params.archiveUrl)}" style="display:inline-block;background:#164d34;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">
              Otwórz archiwum danych →
            </a>
          </div>
          <p style="font-size:12px;color:#526462;line-height:1.5;margin-bottom:0;">
            Link i kod zachowują ważność przez <strong>${ARCHIVE_TTL_DAYS} dni</strong> (do ${escapeHtml(formattedExpiry)}).<br />
            Bezpośredni adres: <a href="${escapeHtml(params.archiveUrl)}" style="color:#164d34;word-break:break-all;">${escapeHtml(params.archiveUrl)}</a>
          </p>
        </div>
        <p style="text-align:center;font-size:11px;color:#718b80;margin:0;">
          Nie udostępniaj tego kodu osobom nieuprawnionym. Jeśli ta wiadomość trafiła do Ciebie omyłkowo, zignoruj ją.
        </p>
      </div>
    `
    : `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fbf9f4;color:#1f241f;border-radius:16px;">
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="color:#164d34;font-size:22px;margin:0 0 6px 0;">Care My Pet</h1>
          <p style="color:#526462;font-size:13px;margin:0;">Digital Pet Health Archive</p>
        </div>
        <div style="background:#ffffff;border:1px solid #dfd7c8;border-radius:12px;padding:24px;margin-bottom:20px;">
          <h2 style="font-size:18px;color:#1f241f;margin-top:0;">Health record archive for ${escapeHtml(params.petName)}</h2>
          <p style="font-size:14px;line-height:1.55;color:#333c3a;">
            <strong>${escapeHtml(params.senderEmail)}</strong> shared a downloadable medical archive for <strong>${escapeHtml(params.petName)}</strong>${params.label ? ` (${escapeHtml(params.label)})` : ""}.
          </p>
          <p style="font-size:14px;line-height:1.55;color:#526462;">
            Inside you can generate a full PDF medical summary and download original attached diagnostic files.
          </p>
          <div style="margin:22px 0;padding:16px;background:#f4faf6;border:1px solid #b8d4c5;border-radius:10px;text-align:center;">
            <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#4d6d5c;margin-bottom:6px;">Access code</div>
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:26px;font-weight:700;letter-spacing:0.12em;color:#164d34;">
              ${escapeHtml(params.formattedCode)}
            </div>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${escapeHtml(params.archiveUrl)}" style="display:inline-block;background:#164d34;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">
              Open archive portal →
            </a>
          </div>
          <p style="font-size:12px;color:#526462;line-height:1.5;margin-bottom:0;">
            Valid for <strong>${ARCHIVE_TTL_DAYS} days</strong> (until ${escapeHtml(formattedExpiry)}).<br />
            Direct link: <a href="${escapeHtml(params.archiveUrl)}" style="color:#164d34;word-break:break-all;">${escapeHtml(params.archiveUrl)}</a>
          </p>
        </div>
        <p style="text-align:center;font-size:11px;color:#718b80;margin:0;">
          Do not share this access code with unauthorized people.
        </p>
      </div>
    `;

  try {
    const { default: nodemailer } = await import("npm:nodemailer@6.9.16");
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
      to: params.to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send archive email via SMTP:", err);
    return false;
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
    return reply({ error: "invalid_input" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sessionSecret = Deno.env.get("ARCHIVE_SESSION_SECRET") || serviceKey;

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // =========================================================================
  // 1. Publiczne odczytanie metadanych lub odblokowanie archiwum
  // =========================================================================
  if (action === "get_meta" || action === "unlock") {
    const archiveToken = typeof body.token === "string" ? body.token.trim() : "";
    if (!tokenPattern.test(archiveToken)) {
      return reply({ error: "not_found" }, 404);
    }

    const { data: link, error: linkError } = await adminClient
      .from("pet_archive_link")
      .select("*")
      .eq("token", archiveToken)
      .maybeSingle();

    if (linkError || !link) {
      return reply({ error: "not_found" }, 404);
    }

    if (link.revoked_at) {
      return reply({ error: "revoked", revoked_at: link.revoked_at }, 410);
    }

    const nowMs = Date.now();
    const expMs = new Date(link.expires_at).getTime();
    if (!Number.isFinite(expMs) || nowMs > expMs) {
      return reply({ error: "expired", expires_at: link.expires_at }, 410);
    }

    const { data: petMeta } = await adminClient
      .from("zwierze")
      .select("id,imie")
      .eq("id", link.pet_id)
      .eq("gospodarstwo_id", link.household_id)
      .maybeSingle();

    if (!petMeta) {
      return reply({ error: "not_found" }, 404);
    }

    const lockedUntilMs = link.locked_until ? new Date(link.locked_until).getTime() : 0;
    const isLocked = Number.isFinite(lockedUntilMs) && lockedUntilMs > nowMs;

    if (action === "get_meta") {
      return reply({
        status: isLocked ? "locked" : "active",
        pet_name: petMeta.imie,
        label: link.label,
        recipient_hint: maskEmail(link.recipient_email),
        expires_at: link.expires_at,
        created_at: link.created_at,
        locked_until: isLocked ? link.locked_until : null,
      });
    }

    // action === "unlock"
    if (isLocked) {
      return reply(
        {
          error: "locked",
          locked_until: link.locked_until,
        },
        429,
      );
    }

    const codeValid = await verifyAccessCode(
      body.code,
      String(link.access_code_salt),
      String(link.access_code_hash),
    );

    if (!codeValid) {
      const nextFailed = Number(link.failed_attempts ?? 0) + 1;
      const shouldLock = nextFailed % ARCHIVE_MAX_FAILED_ATTEMPTS === 0;
      const nextLockedUntil = shouldLock
        ? new Date(nowMs + ARCHIVE_LOCK_MS).toISOString()
        : null;

      await adminClient
        .from("pet_archive_link")
        .update({
          failed_attempts: nextFailed,
          locked_until: nextLockedUntil,
        })
        .eq("id", link.id);

      if (shouldLock) {
        return reply(
          {
            error: "locked",
            locked_until: nextLockedUntil,
          },
          429,
        );
      }

      const remaining =
        ARCHIVE_MAX_FAILED_ATTEMPTS - (nextFailed % ARCHIVE_MAX_FAILED_ATTEMPTS);
      return reply(
        {
          error: "invalid_code",
          remaining_attempts: remaining,
        },
        401,
      );
    }

    const nowIso = new Date(nowMs).toISOString();
    await adminClient
      .from("pet_archive_link")
      .update({
        failed_attempts: 0,
        locked_until: null,
        unlocked_count: Number(link.unlocked_count ?? 0) + 1,
        last_accessed_at: nowIso,
      })
      .eq("id", link.id);

    const [
      { data: pet, error: petErr },
      { data: weights, error: weightsErr },
      { data: vitals, error: vitalsErr },
      { data: fluids, error: fluidsErr },
      { data: healthEvents, error: eventsErr },
      { data: rawReports, error: reportsErr },
      { data: medicationSchedules, error: medsErr },
    ] = await Promise.all([
      adminClient
        .from("zwierze")
        .select(
          "id,imie,gatunek,rasa,data_urodzenia,data_urodzenia_przyblizona,plec,kastracja,identyfikacja,numer_id,notatki,tagi,avatar_path,updated_at,archived_at,archive_reason,closed_on",
        )
        .eq("id", link.pet_id)
        .eq("gospodarstwo_id", link.household_id)
        .maybeSingle(),
      adminClient
        .from("pet_weight")
        .select("id,kg,measured_on,note")
        .eq("pet_id", link.pet_id)
        .eq("household_id", link.household_id)
        .order("measured_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000),
      adminClient
        .from("pet_vital_measurement")
        .select(
          "id,metric_type,value_primary,value_secondary,value_tertiary,unit,measured_on,measured_at,context,note",
        )
        .eq("pet_id", link.pet_id)
        .eq("household_id", link.household_id)
        .order("measured_on", { ascending: false })
        .order("measured_at", { ascending: false })
        .limit(1000),
      adminClient
        .from("pet_fluid_therapy")
        .select(
          "id,fluid_name,volume_ml,route,medications_added,location,administered_at,administered_on,notes",
        )
        .eq("pet_id", link.pet_id)
        .eq("household_id", link.household_id)
        .order("administered_on", { ascending: false })
        .order("administered_at", { ascending: false })
        .limit(1000),
      adminClient
        .from("pet_health_event")
        .select(
          "id,category,title,event_date,next_due_date,clinic,doctor,batch_or_product,description,source_path,source_name,source_mime",
        )
        .eq("pet_id", link.pet_id)
        .eq("household_id", link.household_id)
        .order("event_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1000),
      adminClient
        .from("wynik_badania")
        .select(
          "id,title,test_date,laboratory,doctor,notes,ai_interpretation,source_path,source_name,source_mime,rows:pomiar_parametru(id,ordinal,category,name,value,unit,reference,correction:measurement_correction(value,unit,reference,note,is_key,revision))",
        )
        .eq("zwierze_id", link.pet_id)
        .eq("gospodarstwo_id", link.household_id)
        .order("test_date", { ascending: false })
        .order("confirmed_at", { ascending: false })
        .limit(500),
      adminClient
        .from("medication_schedules")
        .select(
          "id,name,dosage,schedule_type,interval_value,interval_unit,start_date,end_date,scheduled_time,scheduled_times,instructions,is_active,schedule_category,fluid_name,fluid_volume_ml,fluid_route,fluid_location",
        )
        .eq("pet_id", link.pet_id)
        .eq("household_id", link.household_id)
        .order("is_active", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const queryErrors = [
      ["zwierze", petErr],
      ["pet_weight", weightsErr],
      ["pet_vital_measurement", vitalsErr],
      ["pet_fluid_therapy", fluidsErr],
      ["pet_health_event", eventsErr],
      ["wynik_badania", reportsErr],
      ["medication_schedules", medsErr],
    ].filter(([, err]) => Boolean(err));

    if (queryErrors.length > 0) {
      console.error("Archive unlock query errors:", queryErrors);
      return reply({ error: "load_failed" }, 500);
    }

    if (!pet) {
      return reply({ error: "not_found" }, 404);
    }

    let avatarUrl: string | null = null;
    if (pet.avatar_path) {
      const { data: avatarSigned } = await adminClient.storage
        .from("pet-avatars")
        .createSignedUrl(String(pet.avatar_path), 3600);
      avatarUrl = avatarSigned?.signedUrl ?? null;
    }

    const reports = (rawReports ?? []).map((report: Record<string, unknown>) => {
      const rawRows = Array.isArray(report.rows) ? report.rows : [];
      const rows = rawRows
        .map((r: Record<string, unknown>) => {
          const correction = r.correction as Record<string, unknown> | null;
          const rest = { ...r };
          delete rest.correction;
          return {
            ...rest,
            ...(correction
              ? {
                  value: correction.value,
                  unit: correction.unit,
                  reference: correction.reference,
                  note: correction.note,
                  is_key: correction.is_key,
                  revision: correction.revision,
                }
              : { revision: 0 }),
          };
        })
        .sort(
          (a: Record<string, unknown>, b: Record<string, unknown>) =>
            Number(a.ordinal ?? 0) - Number(b.ordinal ?? 0),
        );
      return { ...report, rows };
    });

    const attachmentsMap = new Map<
      string,
      {
        id: string;
        source_type: "report" | "health_event";
        source_path: string;
        source_name: string;
        source_mime: string;
        title: string;
        date: string;
      }
    >();

    for (const r of reports) {
      const sp = typeof r.source_path === "string" ? r.source_path : "";
      if (!sp || attachmentsMap.has(sp)) continue;
      attachmentsMap.set(sp, {
        id: String(r.id),
        source_type: "report",
        source_path: sp,
        source_name: String(r.source_name ?? "badanie.pdf"),
        source_mime: String(r.source_mime ?? "application/pdf"),
        title: String(r.title ?? ""),
        date: String(r.test_date ?? ""),
      });
    }

    for (const ev of healthEvents ?? []) {
      const sp = typeof ev.source_path === "string" ? ev.source_path : "";
      if (!sp || attachmentsMap.has(sp)) continue;
      attachmentsMap.set(sp, {
        id: String(ev.id),
        source_type: "health_event",
        source_path: sp,
        source_name: String(ev.source_name ?? "dokument"),
        source_mime: String(ev.source_mime ?? "application/pdf"),
        title: String(ev.title ?? ""),
        date: String(ev.event_date ?? ""),
      });
    }

    const attachments = Array.from(attachmentsMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    const sessionToken = await signArchiveSession(
      sessionSecret,
      { link_id: link.id, pet_id: link.pet_id },
      nowMs,
    );

    return reply({
      session_token: sessionToken,
      archive: {
        id: link.id,
        label: link.label,
        recipient_hint: maskEmail(link.recipient_email),
        created_at: link.created_at,
        expires_at: link.expires_at,
        unlocked_count: Number(link.unlocked_count ?? 0) + 1,
      },
      pet: {
        ...pet,
        avatar_url: avatarUrl,
      },
      weights: weights ?? [],
      vital_measurements: vitals ?? [],
      fluid_therapies: fluids ?? [],
      health_events: healthEvents ?? [],
      reports,
      medication_schedules: medicationSchedules ?? [],
      attachments,
    });
  }

  // =========================================================================
  // 2. Publiczne pobranie pojedynczego pliku lub rejestracja pobrania PDF
  // =========================================================================
  if (action === "get_document_url" || action === "track_pdf_download") {
    const archiveToken = typeof body.token === "string" ? body.token.trim() : "";
    const sessionToken =
      typeof body.session_token === "string" ? body.session_token.trim() : "";

    if (!tokenPattern.test(archiveToken) || !sessionToken) {
      return reply({ error: "unauthorized" }, 401);
    }

    const session = await verifyArchiveSession(sessionSecret, sessionToken);
    if (!session) {
      return reply({ error: "session_expired" }, 401);
    }

    const { data: link, error: linkErr } = await adminClient
      .from("pet_archive_link")
      .select("*")
      .eq("id", session.link_id)
      .eq("token", archiveToken)
      .maybeSingle();

    if (linkErr || !link) {
      return reply({ error: "not_found" }, 404);
    }
    if (link.revoked_at) {
      return reply({ error: "revoked" }, 410);
    }
    if (Date.now() > new Date(link.expires_at).getTime()) {
      return reply({ error: "expired" }, 410);
    }

    if (action === "track_pdf_download") {
      await adminClient
        .from("pet_archive_link")
        .update({
          pdf_download_count: Number(link.pdf_download_count ?? 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq("id", link.id);
      return reply({ ok: true });
    }

    const sourcePath =
      typeof body.source_path === "string" ? body.source_path.trim() : "";
    if (!sourcePath) {
      return reply({ error: "invalid_input" }, 400);
    }

    const [{ data: repMatch }, { data: evMatch }] = await Promise.all([
      adminClient
        .from("wynik_badania")
        .select("id,source_name")
        .eq("zwierze_id", link.pet_id)
        .eq("gospodarstwo_id", link.household_id)
        .eq("source_path", sourcePath)
        .limit(1)
        .maybeSingle(),
      adminClient
        .from("pet_health_event")
        .select("id,source_name")
        .eq("pet_id", link.pet_id)
        .eq("household_id", link.household_id)
        .eq("source_path", sourcePath)
        .limit(1)
        .maybeSingle(),
    ]);

    const matched = repMatch ?? evMatch;
    if (!matched) {
      return reply({ error: "forbidden_document" }, 403);
    }

    const safeFileName = sanitizeDownloadFilename(
      String(matched.source_name ?? "dokument"),
    );

    const { data: signed, error: signErr } = await adminClient.storage
      .from("medical-documents")
      .createSignedUrl(sourcePath, 900, { download: safeFileName });

    if (signErr || !signed?.signedUrl) {
      return reply({ error: "sign_failed" }, 500);
    }

    await adminClient
      .from("pet_archive_link")
      .update({
        file_download_count: Number(link.file_download_count ?? 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    return reply({ signed_url: signed.signedUrl, file_name: safeFileName });
  }

  // =========================================================================
  // 3. Akcje właściciela gospodarstwa (list, create, revoke)
  // =========================================================================
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return reply({ error: "unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(authHeader.slice(7));

  if (authError || !user || user.is_anonymous) {
    return reply({ error: "unauthorized" }, 401);
  }

  const petId = typeof body.pet_id === "string" ? body.pet_id : "";
  if (!uuidPattern.test(petId)) {
    return reply({ error: "invalid_input" }, 400);
  }

  const { data: pet, error: petError } = await userClient
    .from("zwierze")
    .select("id,gospodarstwo_id,imie")
    .eq("id", petId)
    .maybeSingle();

  if (petError || !pet) {
    return reply({ error: "not_found" }, 404);
  }

  // Tylko właściciel lub współadministrator gospodarstwa może zarządzać linkami archiwum
  const [{ data: ownerHousehold }, { data: adminMember }] = await Promise.all([
    userClient
      .from("gospodarstwo")
      .select("id")
      .eq("id", pet.gospodarstwo_id)
      .eq("owner_id", user.id)
      .maybeSingle(),
    userClient
      .from("czlonek_gospodarstwa")
      .select("user_id")
      .eq("gospodarstwo_id", pet.gospodarstwo_id)
      .eq("user_id", user.id)
      .eq("rola", "admin")
      .maybeSingle(),
  ]);

  if (!ownerHousehold && !adminMember) {
    return reply({ error: "forbidden" }, 403);
  }

  if (action === "list") {
    const { data: links, error: listErr } = await userClient
      .from("pet_archive_link")
      .select(
        "id,pet_id,household_id,token,recipient_email,label,expires_at,revoked_at,failed_attempts,locked_until,unlocked_count,pdf_download_count,file_download_count,last_accessed_at,email_sent_at,created_by,created_at",
      )
      .eq("pet_id", pet.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (listErr) {
      return reply({ error: "load_failed" }, 500);
    }

    return reply({ links: links ?? [] });
  }

  if (action === "create") {
    if (!isValidArchiveEmail(body.recipient_email)) {
      return reply({ error: "invalid_email" }, 400);
    }

    const recipientEmail = normalizeArchiveEmail(body.recipient_email);
    const label = normalizeArchiveLabel(body.label);
    const locale: "pl" | "en" = body.locale === "en" ? "en" : "pl";

    // Proste ograniczenie anty-spamowe: maks. 10 linków na godzinę dla pupila
    const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await adminClient
      .from("pet_archive_link")
      .select("id", { count: "exact", head: true })
      .eq("pet_id", pet.id)
      .gte("created_at", oneHourAgoIso);

    if ((recentCount ?? 0) >= 10) {
      return reply({ error: "rate_limited" }, 429);
    }

    const token = generateArchiveToken();
    const rawCode = generateAccessCode();
    const formattedCode = formatAccessCode(rawCode);
    const saltHex = generateSaltHex();
    const codeHash = await hashAccessCode(rawCode, saltHex);
    const expiresAt = new Date(Date.now() + ARCHIVE_TTL_MS).toISOString();

    const { data: created, error: insertErr } = await adminClient
      .from("pet_archive_link")
      .insert({
        pet_id: pet.id,
        household_id: pet.gospodarstwo_id,
        token,
        recipient_email: recipientEmail,
        label,
        access_code_hash: codeHash,
        access_code_salt: saltHex,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select(
        "id,pet_id,household_id,token,recipient_email,label,expires_at,revoked_at,failed_attempts,locked_until,unlocked_count,pdf_download_count,file_download_count,last_accessed_at,email_sent_at,created_by,created_at",
      )
      .single();

    if (insertErr || !created) {
      console.error("Failed to insert pet_archive_link:", insertErr);
      return reply({ error: "create_failed" }, 500);
    }

    const origin = resolveSafeOrigin(req);
    const archiveUrl = `${origin}/${locale}/archiwum/${token}`;

    const sent = await sendArchiveEmail({
      to: recipientEmail,
      locale,
      petName: String(pet.imie),
      senderEmail: user.email || (locale === "pl" ? "Opiekun" : "Pet owner"),
      label,
      archiveUrl,
      formattedCode,
      expiresAtIso: expiresAt,
    });

    if (!sent) {
      await adminClient.from("pet_archive_link").delete().eq("id", created.id);
      return reply({ error: "email_send_failed" }, 502);
    }

    const emailSentAt = new Date().toISOString();
    await adminClient
      .from("pet_archive_link")
      .update({ email_sent_at: emailSentAt })
      .eq("id", created.id);

    return reply(
      {
        link: { ...created, email_sent_at: emailSentAt },
        archive_url: archiveUrl,
      },
      201,
    );
  }

  if (action === "revoke") {
    const linkId = typeof body.link_id === "string" ? body.link_id : "";
    if (!uuidPattern.test(linkId)) {
      return reply({ error: "invalid_input" }, 400);
    }

    const { data: revoked, error: revErr } = await adminClient
      .from("pet_archive_link")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId)
      .eq("pet_id", pet.id)
      .eq("household_id", pet.gospodarstwo_id)
      .is("revoked_at", null)
      .select(
        "id,pet_id,household_id,token,recipient_email,label,expires_at,revoked_at,failed_attempts,locked_until,unlocked_count,pdf_download_count,file_download_count,last_accessed_at,email_sent_at,created_by,created_at",
      )
      .maybeSingle();

    if (revErr) {
      return reply({ error: "revoke_failed" }, 500);
    }
    if (!revoked) {
      return reply({ error: "not_found" }, 404);
    }

    return reply({ link: revoked });
  }

  return reply({ error: "invalid_action" }, 400);
});
