import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import {
  formatRecoveryKeyHint,
  generateRecoveryKey,
  generateSaltHex,
  hashRecoveryKey,
  isValidEmail,
  normalizeEmail,
} from "../_shared/recovery-crypto.mjs";
import { renderEmailCard } from "../_shared/recovery-email.ts";
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
const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function generateSecureToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendEmailViaSmtp(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const smtpUser = Deno.env.get("SMTP_USER") || "caremypet9173@gmail.com";
  const smtpPass = Deno.env.get("SMTP_PASS");
  if (!smtpPass) {
    console.warn("SMTP_PASS secret missing; skipping email sending");
    return false;
  }

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
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("Failed to send email via SMTP:", err);
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

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // =========================================================================
  // 1. Publiczne sprawdzenie szczegółów zaproszenia po tokenie
  // =========================================================================
  if (action === "get_invite_details") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!tokenPattern.test(token)) {
      return reply({ error: "not_found" }, 404);
    }

    const { data: invite, error: inviteErr } = await adminClient
      .from("zaproszenie_gospodarstwa")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteErr || !invite) {
      return reply({ error: "not_found" }, 404);
    }

    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    const isExpired = now.getTime() > expiresAt.getTime();

    const [householdRes, inviterRes, petsRes] = await Promise.all([
      adminClient
        .from("gospodarstwo")
        .select("id, nazwa, owner_id")
        .eq("id", invite.gospodarstwo_id)
        .maybeSingle(),
      adminClient.auth.admin.getUserById(invite.created_by),
      adminClient
        .from("zwierze")
        .select("id, imie, gatunek")
        .eq("gospodarstwo_id", invite.gospodarstwo_id),
    ]);

    const household = householdRes.data;
    const inviterEmail = inviterRes.data?.user?.email || "Właściciel";

    return reply({
      invitation: {
        id: invite.id,
        email: invite.email,
        status: isExpired && invite.status === "pending" ? "expired" : invite.status,
        expires_at: invite.expires_at,
        created_at: invite.invited_at,
      },
      household: household
        ? { id: household.id, nazwa: household.nazwa }
        : null,
      inviter: {
        email: inviterEmail,
      },
      pets: petsRes.data ?? [],
    });
  }

  // -------------------------------------------------------------------------
  // 1b. Bezpośrednia rejestracja nowego konta i akceptacja zaproszenia w jednym kroku
  // -------------------------------------------------------------------------
  if (action === "register_and_accept") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!tokenPattern.test(token)) {
      return reply({ error: "invalid_token" }, 400);
    }
    if (!password || password.length < 8) {
      return reply({ error: "weak_password" }, 400);
    }

    const { data: invite, error: inviteErr } = await adminClient
      .from("zaproszenie_gospodarstwa")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteErr || !invite) {
      return reply({ error: "not_found" }, 404);
    }

    if (invite.status !== "pending") {
      return reply({ error: `invite_${invite.status}` }, 400);
    }

    const now = new Date();
    if (now.getTime() > new Date(invite.expires_at).getTime()) {
      await adminClient
        .from("zaproszenie_gospodarstwa")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return reply({ error: "invite_expired" }, 400);
    }

    const { data: targetHousehold } = await adminClient
      .from("gospodarstwo")
      .select("id, owner_id, nazwa")
      .eq("id", invite.gospodarstwo_id)
      .maybeSingle();

    if (!targetHousehold) {
      return reply({ error: "household_not_found" }, 404);
    }

    // Utwórz użytkownika w auth.users (z email_confirm: true, bo unikalny token
    // z wiadomości e-mail potwierdza posiadanie skrzynki pocztowej)
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    });

    let userId: string;

    if (createErr || !newUser?.user) {
      const errMsg = (createErr?.message || "").toLowerCase();
      if (
        errMsg.includes("already registered") ||
        errMsg.includes("already exists") ||
        createErr?.status === 422
      ) {
        return reply({ error: "user_already_exists" }, 409);
      }
      console.error("Failed to create user during invite acceptance:", createErr);
      return reply({ error: "user_creation_failed", details: createErr?.message }, 500);
    } else {
      userId = newUser.user.id;
    }

    // Dodaj użytkownika do członków gospodarstwa
    const { error: memberErr } = await adminClient
      .from("czlonek_gospodarstwa")
      .upsert({
        gospodarstwo_id: invite.gospodarstwo_id,
        user_id: userId,
        email: invite.email,
        rola: invite.rola || "member",
      });

    if (memberErr) {
      console.error("Failed to add member to household:", memberErr);
      return reply({ error: "membership_failed" }, 500);
    }

    // Oznacz zaproszenie jako zaakceptowane
    await adminClient
      .from("zaproszenie_gospodarstwa")
      .update({
        status: "accepted",
        accepted_at: now.toISOString(),
        accepted_by: userId,
      })
      .eq("id", invite.id);

    return reply({
      success: true,
      email: invite.email,
      household_id: invite.gospodarstwo_id,
      household_name: targetHousehold.nazwa,
    });
  }

  // =========================================================================
  // 2. Operacje wymagające zalogowanego użytkownika
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

  // -------------------------------------------------------------------------
  // 2a. Akceptacja zaproszenia (accept_invite)
  // -------------------------------------------------------------------------
  if (action === "accept_invite") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!tokenPattern.test(token)) {
      return reply({ error: "invalid_token" }, 400);
    }

    const { data: invite, error: inviteErr } = await adminClient
      .from("zaproszenie_gospodarstwa")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteErr || !invite) {
      return reply({ error: "not_found" }, 404);
    }

    if (invite.status !== "pending") {
      return reply({ error: `invite_${invite.status}` }, 400);
    }

    const now = new Date();
    if (now.getTime() > new Date(invite.expires_at).getTime()) {
      await adminClient
        .from("zaproszenie_gospodarstwa")
        .update({ status: "expired" })
        .eq("id", invite.id);
      return reply({ error: "invite_expired" }, 400);
    }

    // Sprawdź czy użytkownik nie jest już właścicielem tego gospodarstwa
    const { data: targetHousehold } = await adminClient
      .from("gospodarstwo")
      .select("id, owner_id, nazwa")
      .eq("id", invite.gospodarstwo_id)
      .maybeSingle();

    if (!targetHousehold) {
      return reply({ error: "household_not_found" }, 404);
    }

    if (targetHousehold.owner_id === user.id) {
      return reply({ error: "already_owner" }, 400);
    }

    const userEmailNorm = user.email ? normalizeEmail(user.email) : "";
    const inviteEmailNorm = invite.email ? normalizeEmail(String(invite.email)) : "";
    if (!userEmailNorm || !inviteEmailNorm || userEmailNorm !== inviteEmailNorm) {
      return reply({ error: "email_mismatch" }, 403);
    }

    // Atomowo oznacz zaproszenie jako zaakceptowane (chroni przed race condition i ponownym użyciem)
    const { data: claimedInvite, error: claimErr } = await adminClient
      .from("zaproszenie_gospodarstwa")
      .update({
        status: "accepted",
        accepted_at: now.toISOString(),
        accepted_by: user.id,
      })
      .eq("id", invite.id)
      .eq("status", "pending")
      .select("id, rola")
      .maybeSingle();

    if (claimErr || !claimedInvite) {
      return reply({ error: "invite_already_used" }, 409);
    }

    // Dodaj użytkownika do członków (zwalidowana rola z zaproszenia)
    const memberRole = claimedInvite.rola === "admin" ? "admin" : "member";
    const { error: insertErr } = await adminClient
      .from("czlonek_gospodarstwa")
      .upsert({
        gospodarstwo_id: invite.gospodarstwo_id,
        user_id: user.id,
        email: user.email || invite.email,
        rola: memberRole,
      });

    if (insertErr) {
      console.error("Error adding member to household:", insertErr);
      return reply({ error: "membership_failed" }, 500);
    }

    return reply({
      success: true,
      household_id: invite.gospodarstwo_id,
      household_name: targetHousehold.nazwa,
    });
  }

  // -------------------------------------------------------------------------
  // 2b. Utworzenie własnego gospodarstwa (create_household)
  // -------------------------------------------------------------------------
  if (action === "create_household") {
    const allowMultiple = body.allow_multiple === true;
    if (!allowMultiple) {
      const { data: existingOwnedRows } = await adminClient
        .from("gospodarstwo")
        .select(
          "id, nazwa, owner_id, created_at, recovery_email, recovery_key_hint, recovery_key_set_at, recovery_key_set_by",
        )
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);

      const existingOwned = (existingOwnedRows ?? [])[0] ?? null;
      if (existingOwned) {
        return reply({
          success: true,
          household: existingOwned,
          already_existed: true,
        });
      }
    }

    const rawName = typeof body.nazwa === "string" ? body.nazwa.trim() : "";
    const name = rawName || (user.email ? `Dom ${user.email.split("@")[0]}` : "Mój dom");

    const { data: newHome, error: createErr } = await adminClient
      .from("gospodarstwo")
      .insert({
        owner_id: user.id,
        nazwa: name.slice(0, 100),
      })
      .select(
        "id, nazwa, owner_id, created_at, recovery_email, recovery_key_hint, recovery_key_set_at, recovery_key_set_by",
      )
      .single();

    if (createErr || !newHome) {
      console.error("Create household error:", createErr);
      return reply({ error: "create_failed" }, 500);
    }

    return reply({
      success: true,
      household: newHome,
    });
  }

  // -------------------------------------------------------------------------
  // Ustal bieżące gospodarstwo użytkownika (najpierw własne, potem członkostwo)
  // -------------------------------------------------------------------------
  type ActiveHouseholdRow = {
    id: string;
    nazwa: string;
    owner_id: string;
    created_at: string;
    recovery_email: string | null;
    recovery_key_hint: string | null;
    recovery_key_set_at: string | null;
    recovery_key_set_by: string | null;
  };

  const householdSelect =
    "id, nazwa, owner_id, created_at, recovery_email, recovery_key_hint, recovery_key_set_at, recovery_key_set_by";

  const requestedHouseholdId =
    typeof body.household_id === "string" && uuidPattern.test(body.household_id)
      ? body.household_id
      : null;

  // Znajdź gospodarstwo, do którego użytkownik ma dostęp
  const [{ data: ownedHouseholds }, { data: memberHouseholds }] = await Promise.all([
    adminClient
      .from("gospodarstwo")
      .select(householdSelect)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true }),
    adminClient
      .from("czlonek_gospodarstwa")
      .select(
        `gospodarstwo_id, rola, created_at, gospodarstwo(${householdSelect})`,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  let activeHousehold: ActiveHouseholdRow | null = null;
  let isOwner = false;
  let memberRole: "admin" | "member" | null = null;

  if (requestedHouseholdId) {
    const owned = (ownedHouseholds ?? []).find((h) => h.id === requestedHouseholdId);
    if (owned) {
      activeHousehold = owned as ActiveHouseholdRow;
      isOwner = true;
    } else {
      const member = (memberHouseholds ?? []).find(
        (m) => m.gospodarstwo_id === requestedHouseholdId,
      );
      if (member && member.gospodarstwo) {
        activeHousehold = member.gospodarstwo as unknown as ActiveHouseholdRow;
        isOwner = false;
        memberRole = member.rola === "admin" ? "admin" : "member";
      }
    }
  }

  // Domyślnie bierzemy własne gospodarstwo, lub pierwsze członkostwo
  if (!activeHousehold) {
    if (ownedHouseholds && ownedHouseholds.length > 0) {
      activeHousehold = ownedHouseholds[0] as ActiveHouseholdRow;
      isOwner = true;
    } else if (memberHouseholds && memberHouseholds.length > 0 && memberHouseholds[0].gospodarstwo) {
      activeHousehold = memberHouseholds[0].gospodarstwo as unknown as ActiveHouseholdRow;
      isOwner = false;
      memberRole = memberHouseholds[0].rola === "admin" ? "admin" : "member";
    }
  }

  // Jeśli użytkownik nie ma jeszcze żadnego gospodarstwa, utwórz domyślne dla niego
  if (!activeHousehold) {
    const { data: newHome, error: homeErr } = await adminClient
      .from("gospodarstwo")
      .insert({ owner_id: user.id, nazwa: "Mój dom" })
      .select(householdSelect)
      .single();
    if (!homeErr && newHome) {
      activeHousehold = newHome as ActiveHouseholdRow;
      isOwner = true;
    } else {
      return reply({ error: "no_household" }, 404);
    }
  }

  // Automatycznie zatwierdź przeterminowane 14-dniowe wnioski o współadministrację
  const { data: autoApprovedRows } = await adminClient.rpc(
    "auto_approve_expired_admin_requests",
    { p_household_id: activeHousehold.id },
  );
  if (Array.isArray(autoApprovedRows) && autoApprovedRows.length > 0) {
    for (const row of autoApprovedRows) {
      if (row.requester_user_id === user.id && !isOwner) {
        memberRole = "admin";
      }
    }
  }

  const myRole: "owner" | "admin" | "member" = isOwner
    ? "owner"
    : memberRole === "admin"
      ? "admin"
      : "member";
  const canManage = myRole === "owner" || myRole === "admin";
  const origin = resolveSafeOrigin(req);

  // -------------------------------------------------------------------------
  // 2b. Pobranie danych gospodarstwa (get)
  // -------------------------------------------------------------------------
  if (action === "get") {
    const [ownerRes, membersRes, invitesRes, petsRes, adminReqRes] =
      await Promise.all([
        isOwner
          ? Promise.resolve({ data: { user: { email: user.email ?? null } } })
          : adminClient.auth.admin.getUserById(activeHousehold.owner_id),
        adminClient
          .from("czlonek_gospodarstwa")
          .select("user_id, email, rola, created_at")
          .eq("gospodarstwo_id", activeHousehold.id)
          .order("created_at"),
        canManage
          ? adminClient
              .from("zaproszenie_gospodarstwa")
              .select("id, email, token, rola, status, invited_at, expires_at")
              .eq("gospodarstwo_id", activeHousehold.id)
              .eq("status", "pending")
              .order("invited_at", { ascending: false })
          : Promise.resolve({ data: [] }),
        adminClient
          .from("zwierze")
          .select("id, imie, gatunek, rasa, avatar_path")
          .eq("gospodarstwo_id", activeHousehold.id)
          .order("created_at"),
        adminClient
          .from("household_admin_request")
          .select(
            "id, household_id, requester_user_id, requester_email, status, requested_at, resolves_at, resolved_at, resolved_by",
          )
          .eq("household_id", activeHousehold.id)
          .order("requested_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const ownerEmail = ownerRes.data?.user?.email || "Właściciel";
    const latestReq = adminReqRes.data ?? null;
    const recentCutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const adminRequest =
      latestReq &&
      (latestReq.status === "pending" ||
        (latestReq.resolved_at &&
          new Date(latestReq.resolved_at).getTime() >= recentCutoffMs))
        ? latestReq
        : null;

    return reply({
      household: {
        id: activeHousehold.id,
        nazwa: activeHousehold.nazwa,
        created_at: activeHousehold.created_at,
        is_owner: isOwner,
        can_manage: canManage,
        my_role: myRole,
        has_recovery_key: Boolean(activeHousehold.recovery_key_set_at),
        recovery_key_hint: canManage ? activeHousehold.recovery_key_hint ?? null : null,
        recovery_key_set_at: activeHousehold.recovery_key_set_at ?? null,
        recovery_email: canManage ? activeHousehold.recovery_email ?? null : null,
      },
      owner: {
        user_id: activeHousehold.owner_id,
        email: ownerEmail,
        rola: "owner",
        is_self: activeHousehold.owner_id === user.id,
      },
      members: (membersRes.data ?? []).map((m) => ({
        ...m,
        is_self: m.user_id === user.id,
      })),
      invitations: invitesRes.data ?? [],
      pets: petsRes.data ?? [],
      admin_request: adminRequest,
    });
  }

  // -------------------------------------------------------------------------
  // 2c. Zmiana nazwy gospodarstwa (rename)
  // -------------------------------------------------------------------------
  if (action === "rename") {
    if (!canManage) {
      return reply({ error: "forbidden" }, 403);
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 100) {
      return reply({ error: "invalid_name" }, 400);
    }

    const { data: updated, error: updateErr } = await adminClient
      .from("gospodarstwo")
      .update({ nazwa: name })
      .eq("id", activeHousehold.id)
      .select(householdSelect)
      .single();

    if (updateErr) {
      return reply({ error: "update_failed" }, 500);
    }

    return reply({ household: updated });
  }

  // -------------------------------------------------------------------------
  // 2d. Wysłanie zaproszenia (invite)
  // -------------------------------------------------------------------------
  if (action === "invite") {
    if (!canManage) {
      return reply({ error: "forbidden" }, 403);
    }
    const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
    const email = emailRaw.toLowerCase();

    if (!emailPattern.test(email)) {
      return reply({ error: "invalid_email" }, 400);
    }

    // Nie można zaprosić samego siebie
    if (user.email && user.email.toLowerCase() === email) {
      return reply({ error: "cannot_invite_self" }, 400);
    }

    // Sprawdź czy użytkownik o tym emailu nie jest już członkiem
    const { data: existingMember } = await adminClient
      .from("czlonek_gospodarstwa")
      .select("user_id")
      .eq("gospodarstwo_id", activeHousehold.id)
      .eq("email", email)
      .maybeSingle();

    if (existingMember) {
      return reply({ error: "already_member" }, 400);
    }

    // Anuluj dotychczasowe oczekujące zaproszenia na ten adres w tym gospodarstwie
    await adminClient
      .from("zaproszenie_gospodarstwa")
      .update({ status: "cancelled" })
      .eq("gospodarstwo_id", activeHousehold.id)
      .eq("email", email)
      .eq("status", "pending");

    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const inviteRole = isOwner && body.rola === "admin" ? "admin" : "member";
    const { data: newInvite, error: insertErr } = await adminClient
      .from("zaproszenie_gospodarstwa")
      .insert({
        gospodarstwo_id: activeHousehold.id,
        email,
        token,
        rola: inviteRole,
        status: "pending",
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertErr || !newInvite) {
      console.error("Failed to insert invitation:", insertErr);
      return reply({ error: "invite_failed" }, 500);
    }

    // Budowanie URL zaproszenia
    const inviteOrigin = origin.replace(/\/$/, "");
    const locale = body.locale === "en" ? "en" : "pl";
    const inviteUrl = `${inviteOrigin}/${locale}/zaproszenie/${token}`;

    // Wysłanie wiadomości e-mail z zaproszeniem
    const inviterName = user.email || "Właściciel gospodarstwa";
    const subject = `Zaproszenie do wspólnej opieki nad pupilami w Care My Pet (${activeHousehold.nazwa})`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fbf9f4;color:#1f241f;border-radius:16px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="color:#164d34;font-size:22px;margin:0 0 8px 0;">Care My Pet</h1>
          <p style="color:#526462;font-size:14px;margin:0;">Wspólna opieka nad zdrowiem zwierząt</p>
        </div>
        <div style="background:#ffffff;border:1px solid #dfd7c8;border-radius:12px;padding:24px;margin-bottom:24px;">
          <h2 style="font-size:18px;color:#1f241f;margin-top:0;">Zostałeś zaproszony do gospodarstwa!</h2>
          <p style="font-size:14px;line-height:1.5;color:#333c3a;">
            <strong>${escapeHtml(inviterName)}</strong> zaprasza Cię do wspólnej opieki nad pupilami w gospodarstwie <strong>${escapeHtml(activeHousehold.nazwa)}</strong>.
          </p>
          <p style="font-size:14px;line-height:1.5;color:#526462;">
            Po dołączeniu zyskasz pełen wgląd w profile zwierzaków, ich historię medyczną, wyniki badań, szczepienia oraz terminarz przypomnień.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background:#164d34;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">
              Dołącz do gospodarstwa →
            </a>
          </div>
          <p style="font-size:12px;color:#718b80;line-height:1.4;margin-bottom:0;">
            Link do zaproszenia jest ważny przez 7 dni. Możesz go również skopiować bezpośrednio: <br />
            <a href="${escapeHtml(inviteUrl)}" style="color:#164d34;word-break:break-all;">${escapeHtml(inviteUrl)}</a>
          </p>
        </div>
        <p style="text-align:center;font-size:11px;color:#718b80;margin:0;">
          Jeśli nie spodziewałeś się tego zaproszenia, możesz zignorować tę wiadomość.
        </p>
      </div>
    `;

    const emailSent = await sendEmailViaSmtp(email, subject, html);

    return reply({
      invitation: newInvite,
      invite_url: inviteUrl,
      email_sent: emailSent,
    });
  }

  // -------------------------------------------------------------------------
  // 2e. Anulowanie zaproszenia (cancel_invite)
  // -------------------------------------------------------------------------
  if (action === "cancel_invite") {
    if (!canManage) {
      return reply({ error: "forbidden" }, 403);
    }
    const inviteId = typeof body.invite_id === "string" ? body.invite_id : "";
    if (!uuidPattern.test(inviteId)) {
      return reply({ error: "invalid_input" }, 400);
    }

    const { error: cancelErr } = await adminClient
      .from("zaproszenie_gospodarstwa")
      .update({ status: "cancelled" })
      .eq("id", inviteId)
      .eq("gospodarstwo_id", activeHousehold.id);

    if (cancelErr) {
      return reply({ error: "cancel_failed" }, 500);
    }

    return reply({ success: true });
  }

  // -------------------------------------------------------------------------
  // 2f. Usunięcie członka lub opuszczenie gospodarstwa (remove_member)
  // -------------------------------------------------------------------------
  if (action === "remove_member") {
    const targetUserId =
      typeof body.user_id === "string" ? body.user_id : "";
    if (!uuidPattern.test(targetUserId)) {
      return reply({ error: "invalid_input" }, 400);
    }

    // Nie można usunąć właściciela
    if (targetUserId === activeHousehold.owner_id) {
      return reply({ error: "cannot_remove_owner" }, 400);
    }

    // Dozwolone jeśli caller ma prawo zarządzania LUB sam opuszcza gospodarstwo
    if (!canManage && targetUserId !== user.id) {
      return reply({ error: "forbidden" }, 403);
    }

    // Współadministrator nie może usunąć innego współadministratora — tylko właściciel
    if (!isOwner && targetUserId !== user.id) {
      const { data: targetMember } = await adminClient
        .from("czlonek_gospodarstwa")
        .select("rola")
        .eq("gospodarstwo_id", activeHousehold.id)
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (targetMember?.rola === "admin") {
        return reply({ error: "owner_required" }, 403);
      }
    }

    const { error: deleteErr } = await adminClient
      .from("czlonek_gospodarstwa")
      .delete()
      .eq("gospodarstwo_id", activeHousehold.id)
      .eq("user_id", targetUserId);

    if (deleteErr) {
      return reply({ error: "remove_failed" }, 500);
    }

    // Anuluj ewentualny wniosek o przejęcie złożony przez tego członka
    await adminClient
      .from("household_admin_request")
      .update({
        status: "cancelled",
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("household_id", activeHousehold.id)
      .eq("requester_user_id", targetUserId)
      .eq("status", "pending");

    return reply({ success: true, removed_user_id: targetUserId });
  }

  // -------------------------------------------------------------------------
  // 2g. Wygenerowanie lub rotacja jednorazowego klucza odzyskania (generate_recovery_key)
  // -------------------------------------------------------------------------
  if (action === "generate_recovery_key") {
    const hasExistingKey = Boolean(activeHousehold.recovery_key_set_at);
    if (!isOwner) {
      return reply(
        {
          error: hasExistingKey ? "owner_required_to_rotate" : "owner_required",
        },
        403,
      );
    }

    const rawKey = generateRecoveryKey();
    const saltHex = generateSaltHex();
    const keyHash = await hashRecoveryKey(rawKey, saltHex);
    const keyHint = formatRecoveryKeyHint(rawKey);

    const { data: setAt, error: setErr } = await adminClient.rpc(
      "recovery_set_household_secret",
      {
        p_household_id: activeHousehold.id,
        p_key_hash: keyHash,
        p_key_salt: saltHex,
        p_key_hint: keyHint,
        p_set_by: user.id,
      },
    );

    if (setErr) {
      console.error("recovery_set_household_secret failed:", setErr);
      return reply({ error: "recovery_key_failed" }, 500);
    }

    const locale = body.locale === "en" ? "en" : "pl";
    const sendToBackup =
      body.send_to_recovery_email === true &&
      Boolean(activeHousehold.recovery_email);
    let sentToRecoveryEmail = false;

    if (sendToBackup && activeHousehold.recovery_email) {
      const subject =
        locale === "pl"
          ? `Jednorazowy klucz odzyskania dla domostwa "${activeHousehold.nazwa}"`
          : `One-time recovery key for household "${activeHousehold.nazwa}"`;
      const html = renderEmailCard({
        locale,
        badge: locale === "pl" ? "Klucz odzyskania" : "Recovery key",
        heading:
          locale === "pl"
            ? `Klucz odzyskania dla „${activeHousehold.nazwa}”`
            : `Recovery key for "${activeHousehold.nazwa}"`,
        paragraphs:
          locale === "pl"
            ? [
                `Na prośbę opiekuna przesyłamy kopię nowego jednorazowego klucza odzyskania dostępu do domostwa <strong>${escapeHtml(activeHousehold.nazwa)}</strong>.`,
                `Przechowuj ten klucz w bezpiecznym miejscu (wydruk lub zaufana osoba). Po jednorazowym użyciu klucz przestaje działać.`,
              ]
            : [
                `As requested, here is a copy of the new one-time recovery key for <strong>${escapeHtml(activeHousehold.nazwa)}</strong>.`,
                `Store it safely. Once used, this key becomes invalid immediately.`,
              ],
        highlightBox: {
          label: locale === "pl" ? "Jednorazowy klucz odzyskania" : "One-time recovery key",
          value: rawKey,
          monospace: true,
        },
        cta: {
          label: locale === "pl" ? "Formularz odzyskania dostępu" : "Recovery portal",
          url: `${origin.replace(/\/$/, "")}/${locale}/odzyskaj`,
        },
        footerNote:
          locale === "pl"
            ? "Ostatnie znaki klucza to: " + keyHint
            : "Key ends with: " + keyHint,
      });

      sentToRecoveryEmail = await sendEmailViaSmtp(
        activeHousehold.recovery_email,
        subject,
        html,
      );
    }

    // Powiadomienie bezpieczeństwa na adres właściciela (bez samego klucza!)
    const ownerRes = await adminClient.auth.admin.getUserById(
      activeHousehold.owner_id,
    );
    const ownerEmail = ownerRes.data?.user?.email;
    if (ownerEmail) {
      const subject =
        locale === "pl"
          ? `Ustawiono nowy klucz odzyskania (${keyHint}) dla „${activeHousehold.nazwa}”`
          : `New recovery key generated (${keyHint}) for "${activeHousehold.nazwa}"`;
      const html = renderEmailCard({
        locale,
        badge: locale === "pl" ? "Bezpieczeństwo konta" : "Account security",
        heading:
          locale === "pl"
            ? `Wygenerowano nowy klucz odzyskania dla „${activeHousehold.nazwa}”`
            : `New recovery key generated for "${activeHousehold.nazwa}"`,
        paragraphs:
          locale === "pl"
            ? [
                `Konto <strong>${escapeHtml(user.email || "Właściciel")}</strong> wygenerowało nowy jednorazowy klucz odzyskania dla domostwa <strong>${escapeHtml(activeHousehold.nazwa)}</strong>. Poprzedni klucz oraz ewentualne oczekujące linki przejęcia zostały unieważnione.`,
                `Domostwo ma teraz aktywny pełny tryb zapisu i edycji kartotek pupili.`,
              ]
            : [
                `Account <strong>${escapeHtml(user.email || "Owner")}</strong> generated a new one-time recovery key for <strong>${escapeHtml(activeHousehold.nazwa)}</strong>. Any previous key or pending claim was invalidated.`,
                `Full write and edit mode is now active for this household.`,
              ],
        highlightBox: {
          label:
            locale === "pl"
              ? "Identyfikator końcowy aktywnego klucza"
              : "Active recovery key hint",
          value: keyHint,
          monospace: true,
        },
        cta: {
          label:
            locale === "pl"
              ? "Zarządzaj bezpieczeństwem domostwa →"
              : "Manage household security →",
          url: `${origin.replace(/\/$/, "")}/${locale}/app/gospodarstwo`,
        },
        footerNote:
          locale === "pl"
            ? "Jeśli to nie Ty wygenerowałeś(-aś) ten klucz, zaloguj się natychmiast, zmień hasło i wygeneruj nowy klucz odzyskania."
            : "If you did not generate this key, sign in immediately, change your password, and rotate your recovery key.",
      });
      await sendEmailViaSmtp(ownerEmail, subject, html);
    }

    return reply({
      recovery_key: rawKey,
      recovery_key_hint: keyHint,
      recovery_key_set_at: setAt,
      sent_to_recovery_email: sentToRecoveryEmail,
      owner_email: ownerEmail ?? null,
    });
  }

  // -------------------------------------------------------------------------
  // 2h. Ustawienie pomocniczego e-maila odzyskania (update_recovery_email)
  // -------------------------------------------------------------------------
  if (action === "update_recovery_email") {
    if (!isOwner) {
      return reply({ error: "owner_required" }, 403);
    }

    const rawEmail =
      typeof body.recovery_email === "string" ? body.recovery_email : "";
    const normalized = rawEmail.trim() === "" ? null : normalizeEmail(rawEmail);

    if (normalized !== null && !isValidEmail(normalized)) {
      return reply({ error: "invalid_email" }, 400);
    }

    const { error: updateErr } = await adminClient
      .from("gospodarstwo")
      .update({ recovery_email: normalized })
      .eq("id", activeHousehold.id);

    if (updateErr) {
      console.error("update_recovery_email failed:", updateErr);
      return reply({ error: "update_failed" }, 500);
    }

    const locale = body.locale === "en" ? "en" : "pl";
    if (normalized) {
      const subject =
        locale === "pl"
          ? `Ustawiono adres pomocniczy dla domostwa "${activeHousehold.nazwa}"`
          : `Backup email set for household "${activeHousehold.nazwa}"`;
      const html = renderEmailCard({
        locale,
        badge: locale === "pl" ? "E-mail pomocniczy" : "Backup email",
        heading:
          locale === "pl"
            ? `Ten adres został zapisany jako pomocniczy dla „${activeHousehold.nazwa}”`
            : `This address is now the backup email for "${activeHousehold.nazwa}"`,
        paragraphs:
          locale === "pl"
            ? [
                `Adres <strong>${escapeHtml(normalized)}</strong> został przypisany jako pomocniczy e-mail bezpieczeństwa domostwa <strong>${escapeHtml(activeHousehold.nazwa)}</strong>.`,
                `Otrzyma powiadomienia bezpieczeństwa przy użyciu klucza odzyskania lub złożeniu wniosku o współadministrację, a także opcjonalną kopię klucza odzyskania.`,
              ]
            : [
                `<strong>${escapeHtml(normalized)}</strong> is now configured as the backup security email for <strong>${escapeHtml(activeHousehold.nazwa)}</strong>.`,
              ],
      });
      await sendEmailViaSmtp(normalized, subject, html);
    }

    return reply({ success: true, recovery_email: normalized });
  }

  // -------------------------------------------------------------------------
  // 2i. Zmiana roli członka gospodarstwa (set_member_role)
  // -------------------------------------------------------------------------
  if (action === "set_member_role") {
    if (!isOwner) {
      return reply({ error: "forbidden" }, 403);
    }

    const targetUserId = typeof body.user_id === "string" ? body.user_id : "";
    const newRole = body.rola === "admin" ? "admin" : body.rola === "member" ? "member" : "";
    if (!uuidPattern.test(targetUserId) || !newRole) {
      return reply({ error: "invalid_input" }, 400);
    }

    if (targetUserId === activeHousehold.owner_id) {
      return reply({ error: "cannot_modify_owner" }, 400);
    }

    const { data: updatedMember, error: roleErr } = await adminClient
      .from("czlonek_gospodarstwa")
      .update({ rola: newRole })
      .eq("gospodarstwo_id", activeHousehold.id)
      .eq("user_id", targetUserId)
      .select("user_id, email, rola")
      .maybeSingle();

    if (roleErr || !updatedMember) {
      return reply({ error: "member_not_found" }, 404);
    }

    if (newRole === "admin") {
      await adminClient
        .from("household_admin_request")
        .update({
          status: "approved",
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("household_id", activeHousehold.id)
        .eq("requester_user_id", targetUserId)
        .eq("status", "pending");
    }

    return reply({ success: true, member: updatedMember });
  }

  // -------------------------------------------------------------------------
  // 2j. Wniosek o przejęcie współadministracji po 14 dniach (request_admin_takeover)
  // -------------------------------------------------------------------------
  if (action === "request_admin_takeover") {
    if (isOwner || myRole !== "member") {
      return reply({ error: "forbidden" }, 403);
    }

    const { data: existingPending } = await adminClient
      .from("household_admin_request")
      .select("id, status, resolves_at")
      .eq("household_id", activeHousehold.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingPending) {
      return reply(
        { error: "request_already_pending", admin_request: existingPending },
        409,
      );
    }

    const resolvesAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: createdReq, error: insertErr } = await adminClient
      .from("household_admin_request")
      .insert({
        household_id: activeHousehold.id,
        requester_user_id: user.id,
        requester_email: user.email || "",
        status: "pending",
        resolves_at: resolvesAt,
      })
      .select(
        "id, household_id, requester_user_id, requester_email, status, requested_at, resolves_at, resolved_at, resolved_by",
      )
      .single();

    if (insertErr || !createdReq) {
      console.error("request_admin_takeover failed:", insertErr);
      return reply({ error: "request_failed" }, 500);
    }

    const locale = body.locale === "en" ? "en" : "pl";
    const ownerRes = await adminClient.auth.admin.getUserById(
      activeHousehold.owner_id,
    );
    const alertRecipients = Array.from(
      new Set(
        [
          ownerRes.data?.user?.email ? normalizeEmail(ownerRes.data.user.email) : "",
          activeHousehold.recovery_email
            ? normalizeEmail(activeHousehold.recovery_email)
            : "",
        ].filter(Boolean),
      ),
    );

    const formattedDeadline = new Intl.DateTimeFormat(
      locale === "pl" ? "pl-PL" : "en-GB",
      { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Warsaw" },
    ).format(new Date(resolvesAt));

    if (alertRecipients.length > 0) {
      const subject =
        locale === "pl"
          ? `Wniosek o rolę współadministratora w „${activeHousehold.nazwa}” (14 dni na reakcję)`
          : `Co-admin request in "${activeHousehold.nazwa}" (14 days to respond)`;
      const html = renderEmailCard({
        locale,
        tone: "warning",
        badge: locale === "pl" ? "Wniosek o współadministrację" : "Co-admin request",
        heading:
          locale === "pl"
            ? `${escapeHtml(user.email || "Opiekun")} wnioskuje o uprawnienia administratora`
            : `${escapeHtml(user.email || "Caregiver")} requested co-admin rights`,
        paragraphs:
          locale === "pl"
            ? [
                `Członek domostwa <strong>${escapeHtml(activeHousehold.nazwa)}</strong> (<strong>${escapeHtml(user.email || "opiekun")}</strong>) złożył wniosek o nadanie roli współadministratora.`,
                `Jeśli nie odrzucisz wniosku do <strong>${escapeHtml(formattedDeadline)}</strong> (14 dni), uprawnienia współadministratora zostaną nadane automatycznie, aby domostwo zachowało ciągłość zarządzania.`,
                `Możesz w każdej chwili zatwierdzić lub odrzucić wniosek w ustawieniach domostwa.`,
              ]
            : [
                `Member <strong>${escapeHtml(user.email || "caregiver")}</strong> of <strong>${escapeHtml(activeHousehold.nazwa)}</strong> requested co-admin permissions.`,
                `Unless rejected by <strong>${escapeHtml(formattedDeadline)}</strong> (14 days), co-admin access will be granted automatically.`,
              ],
        cta: {
          label: locale === "pl" ? "Zatwierdź lub odrzuć wniosek" : "Review request",
          url: `${origin.replace(/\/$/, "")}/${locale}/app/gospodarstwo`,
        },
      });
      await Promise.all(
        alertRecipients.map((to) => sendEmailViaSmtp(to, subject, html)),
      );
    }

    return reply({ success: true, admin_request: createdReq }, 201);
  }

  // -------------------------------------------------------------------------
  // 2k. Rozpatrzenie lub wycofanie wniosku (respond_admin_request)
  // -------------------------------------------------------------------------
  if (action === "respond_admin_request") {
    const requestId = typeof body.request_id === "string" ? body.request_id : "";
    const decision =
      body.decision === "approve" ||
      body.decision === "reject" ||
      body.decision === "cancel"
        ? body.decision
        : "";

    if (!uuidPattern.test(requestId) || !decision) {
      return reply({ error: "invalid_input" }, 400);
    }

    const { data: reqRow, error: reqErr } = await adminClient
      .from("household_admin_request")
      .select("*")
      .eq("id", requestId)
      .eq("household_id", activeHousehold.id)
      .maybeSingle();

    if (reqErr || !reqRow) {
      return reply({ error: "not_found" }, 404);
    }
    if (reqRow.status !== "pending") {
      return reply({ error: "already_resolved" }, 409);
    }

    if (decision === "cancel") {
      if (reqRow.requester_user_id !== user.id && !isOwner) {
        return reply({ error: "forbidden" }, 403);
      }
      const { data: cancelled, error: updErr } = await adminClient
        .from("household_admin_request")
        .update({
          status: "cancelled",
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("id", reqRow.id)
        .select()
        .single();

      if (updErr) return reply({ error: "update_failed" }, 500);
      return reply({ success: true, admin_request: cancelled });
    }

    if (!isOwner) {
      return reply({ error: "forbidden" }, 403);
    }

    if (decision === "approve") {
      const { error: memberErr } = await adminClient
        .from("czlonek_gospodarstwa")
        .update({ rola: "admin" })
        .eq("gospodarstwo_id", activeHousehold.id)
        .eq("user_id", reqRow.requester_user_id);

      if (memberErr) {
        return reply({ error: "member_update_failed" }, 500);
      }
    }

    const nextStatus = decision === "approve" ? "approved" : "rejected";
    const { data: updatedReq, error: updErr } = await adminClient
      .from("household_admin_request")
      .update({
        status: nextStatus,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq("id", reqRow.id)
      .select()
      .single();

    if (updErr) return reply({ error: "update_failed" }, 500);

    const locale = body.locale === "en" ? "en" : "pl";
    if (reqRow.requester_email) {
      const approved = decision === "approve";
      const subject =
        locale === "pl"
          ? approved
            ? `Wniosek o współadministrację w „${activeHousehold.nazwa}” został zatwierdzony`
            : `Wniosek o współadministrację w „${activeHousehold.nazwa}” został odrzucony`
          : approved
            ? `Co-admin request approved in "${activeHousehold.nazwa}"`
            : `Co-admin request rejected in "${activeHousehold.nazwa}"`;
      const html = renderEmailCard({
        locale,
        tone: approved ? "default" : "warning",
        badge:
          locale === "pl"
            ? approved
              ? "Współadministracja aktywna"
              : "Wniosek odrzucony"
            : approved
              ? "Co-admin granted"
              : "Request rejected",
        heading: subject,
        paragraphs: [
          locale === "pl"
            ? approved
              ? `Właściciel domostwa <strong>${escapeHtml(activeHousehold.nazwa)}</strong> nadał Ci uprawnienia współadministratora.`
              : `Właściciel domostwa <strong>${escapeHtml(activeHousehold.nazwa)}</strong> odrzucił Twój wniosek o uprawnienia współadministratora.`
            : approved
              ? `The owner of <strong>${escapeHtml(activeHousehold.nazwa)}</strong> approved your co-admin request.`
              : `The owner of <strong>${escapeHtml(activeHousehold.nazwa)}</strong> rejected your co-admin request.`,
        ],
        cta: {
          label:
            locale === "pl"
              ? "Przejdź do ustawień domostwa →"
              : "Open household settings →",
          url: `${origin.replace(/\/$/, "")}/${locale}/app/gospodarstwo`,
        },
      });
      await sendEmailViaSmtp(reqRow.requester_email, subject, html);
    }

    return reply({ success: true, admin_request: updatedReq });
  }

  return reply({ error: "invalid_action" }, 400);
});
