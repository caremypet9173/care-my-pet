import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import nodemailer from "npm:nodemailer@6.9.16";

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

    // Dodaj użytkownika do członków (on conflict do nothing)
    const { error: insertErr } = await adminClient
      .from("czlonek_gospodarstwa")
      .upsert({
        gospodarstwo_id: invite.gospodarstwo_id,
        user_id: user.id,
        email: user.email || invite.email,
        rola: invite.rola || "member",
      });

    if (insertErr) {
      console.error("Error adding member to household:", insertErr);
      return reply({ error: "membership_failed" }, 500);
    }

    // Oznacz zaproszenie jako zaakceptowane
    await adminClient
      .from("zaproszenie_gospodarstwa")
      .update({
        status: "accepted",
        accepted_at: now.toISOString(),
        accepted_by: user.id,
      })
      .eq("id", invite.id);

    return reply({
      success: true,
      household_id: invite.gospodarstwo_id,
      household_name: targetHousehold.nazwa,
    });
  }

  // -------------------------------------------------------------------------
  // Ustal bieżące gospodarstwo użytkownika (najpierw własne, potem członkostwo)
  // -------------------------------------------------------------------------
  let requestedHouseholdId =
    typeof body.household_id === "string" && uuidPattern.test(body.household_id)
      ? body.household_id
      : null;

  // Znajdź gospodarstwo, do którego użytkownik ma dostęp
  const [{ data: ownedHouseholds }, { data: memberHouseholds }] = await Promise.all([
    adminClient
      .from("gospodarstwo")
      .select("id, nazwa, owner_id, created_at")
      .eq("owner_id", user.id),
    adminClient
      .from("czlonek_gospodarstwa")
      .select("gospodarstwo_id, rola, created_at, gospodarstwo(id, nazwa, owner_id, created_at)")
      .eq("user_id", user.id),
  ]);

  let activeHousehold = null;
  let isOwner = false;

  if (requestedHouseholdId) {
    const owned = (ownedHouseholds ?? []).find((h) => h.id === requestedHouseholdId);
    if (owned) {
      activeHousehold = owned;
      isOwner = true;
    } else {
      const member = (memberHouseholds ?? []).find(
        (m) => m.gospodarstwo_id === requestedHouseholdId,
      );
      if (member && member.gospodarstwo) {
        activeHousehold = member.gospodarstwo as unknown as {
          id: string;
          nazwa: string;
          owner_id: string;
          created_at: string;
        };
        isOwner = false;
      }
    }
  }

  // Domyślnie bierzemy własne gospodarstwo, lub pierwsze członkostwo
  if (!activeHousehold) {
    if (ownedHouseholds && ownedHouseholds.length > 0) {
      activeHousehold = ownedHouseholds[0];
      isOwner = true;
    } else if (memberHouseholds && memberHouseholds.length > 0 && memberHouseholds[0].gospodarstwo) {
      activeHousehold = memberHouseholds[0].gospodarstwo as unknown as {
        id: string;
        nazwa: string;
        owner_id: string;
        created_at: string;
      };
      isOwner = false;
    }
  }

  // Jeśli użytkownik nie ma jeszcze żadnego gospodarstwa, utwórz domyślne dla niego
  if (!activeHousehold) {
    const { data: newHome, error: homeErr } = await adminClient
      .from("gospodarstwo")
      .insert({ owner_id: user.id, nazwa: "Mój dom" })
      .select()
      .single();
    if (!homeErr && newHome) {
      activeHousehold = newHome;
      isOwner = true;
    } else {
      return reply({ error: "no_household" }, 404);
    }
  }

  // -------------------------------------------------------------------------
  // 2b. Pobranie danych gospodarstwa (get)
  // -------------------------------------------------------------------------
  if (action === "get") {
    const [ownerRes, membersRes, invitesRes, petsRes] = await Promise.all([
      adminClient.auth.admin.getUserById(activeHousehold.owner_id),
      adminClient
        .from("czlonek_gospodarstwa")
        .select("user_id, email, rola, created_at")
        .eq("gospodarstwo_id", activeHousehold.id)
        .order("created_at"),
      isOwner
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
    ]);

    const ownerEmail = ownerRes.data?.user?.email || "Właściciel";

    return reply({
      household: {
        id: activeHousehold.id,
        nazwa: activeHousehold.nazwa,
        created_at: activeHousehold.created_at,
        is_owner: isOwner,
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
    });
  }

  // -------------------------------------------------------------------------
  // 2c. Zmiana nazwy gospodarstwa (rename)
  // -------------------------------------------------------------------------
  if (action === "rename") {
    if (!isOwner) {
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
      .select()
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
    if (!isOwner) {
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

    const { data: newInvite, error: insertErr } = await adminClient
      .from("zaproszenie_gospodarstwa")
      .insert({
        gospodarstwo_id: activeHousehold.id,
        email,
        token,
        rola: "member",
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
    const origin =
      req.headers.get("origin") ||
      Deno.env.get("APP_URL") ||
      "https://caremypet.app";
    const inviteUrl = `${origin}/pl/zaproszenie/${token}`;

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
            <a href="${inviteUrl}" style="display:inline-block;background:#164d34;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;">
              Dołącz do gospodarstwa →
            </a>
          </div>
          <p style="font-size:12px;color:#718b80;line-height:1.4;margin-bottom:0;">
            Link do zaproszenia jest ważny przez 7 dni. Możesz go również skopiować bezpośrednio: <br />
            <a href="${inviteUrl}" style="color:#164d34;word-break:break-all;">${inviteUrl}</a>
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
    if (!isOwner) {
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

    // Dozwolone jeśli caller jest właścicielem LUB sam opuszcza gospodarstwo
    if (!isOwner && targetUserId !== user.id) {
      return reply({ error: "forbidden" }, 403);
    }

    const { error: deleteErr } = await adminClient
      .from("czlonek_gospodarstwa")
      .delete()
      .eq("gospodarstwo_id", activeHousehold.id)
      .eq("user_id", targetUserId);

    if (deleteErr) {
      return reply({ error: "remove_failed" }, 500);
    }

    return reply({ success: true, removed_user_id: targetUserId });
  }

  return reply({ error: "invalid_action" }, 400);
});
