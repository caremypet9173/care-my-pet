import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import {
  formatRecoveryKey,
  generateSaltHex,
  generateSecureToken,
  isValidEmail,
  isValidRecoveryKeyFormat,
  maskEmail,
  normalizeEmail,
  RECOVERY_CLAIM_TTL_HOURS,
  RECOVERY_LOCK_MINUTES,
  RECOVERY_MAX_FAILED_ATTEMPTS,
  verifyRecoveryKey,
  escapeHtml,
} from "../_shared/recovery-crypto.mjs";
import { renderEmailCard, sendSmtpEmail } from "../_shared/recovery-email.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "private, no-store",
};

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });

const tokenPattern = /^[A-Za-z0-9_-]{24,80}$/;

function resolveOrigin(req: Request): string {
  const reqOrigin = req.headers.get("origin");
  if (reqOrigin && /^https?:\/\/.+/.test(reqOrigin)) {
    return reqOrigin.replace(/\/$/, "");
  }
  const envOrigin = Deno.env.get("SITE_URL") || Deno.env.get("APP_URL") || "https://caremypet.app";
  return envOrigin.replace(/\/$/, "");
}

function getClaimStatus(claim: {
  confirmed_at: string | null;
  revoked_at: string | null;
  expires_at: string;
}): "pending" | "confirmed" | "revoked" | "expired" {
  if (claim.confirmed_at) return "confirmed";
  if (claim.revoked_at) return "revoked";
  if (Date.now() > new Date(claim.expires_at).getTime()) return "expired";
  return "pending";
}

function mapExecuteClaimError(err: { code?: string; message?: string } | null) {
  const code = err?.code || "";
  const msg = (err?.message || "").toLowerCase();
  if (code === "P0002") return reply({ error: "not_found" }, 404);
  if (code === "PT409" || msg.includes("already confirmed")) {
    return reply({ error: "already_confirmed" }, 409);
  }
  if (code === "PT410" || msg.includes("expired") || msg.includes("revoked")) {
    return reply({ error: msg.includes("revoked") ? "claim_revoked" : "claim_expired" }, 410);
  }
  if (code === "42501" || msg.includes("email mismatch")) {
    return reply({ error: "email_mismatch" }, 403);
  }
  console.error("recovery_execute_claim failed:", err);
  return reply({ error: "claim_failed" }, 500);
}

async function sendCompletionEmail(params: {
  to: string;
  locale: "pl" | "en";
  householdName: string;
  appUrl: string;
}) {
  const pl = params.locale === "pl";
  const subject = pl
    ? `Przekazano własność domostwa "${params.householdName}" — wymagany nowy klucz odzyskania`
    : `Ownership transferred for "${params.householdName}" — new Recovery Key required`;

  const html = renderEmailCard({
    locale: params.locale,
    badge: pl ? "Odzyskiwanie dostępu zakończone" : "Access recovery completed",
    heading: pl
      ? `Przejąłeś własność domostwa „${params.householdName}”`
      : `You are now the owner of "${params.householdName}"`,
    paragraphs: pl
      ? [
          `Jednorazowy klucz odzyskania został użyty i trwale usunięty.`,
          `Ze względów bezpieczeństwa kartoteki tego domostwa działają teraz w trybie <strong>tylko do odczytu</strong>. Aby odblokować dodawanie i edycję danych, zaloguj się i wygeneruj nowy klucz odzyskania w ustawieniach domostwa.`,
        ]
      : [
          `The one-time recovery key has been consumed and permanently invalidated.`,
          `For safety, this household's records are now in <strong>read-only</strong> mode. Sign in and generate a new recovery key in household settings to re-enable edits.`,
        ],
    cta: {
      label: pl ? "Przejdź do ustawień domostwa" : "Open household settings",
      url: `${params.appUrl}/${params.locale}/app/gospodarstwo`,
    },
    footerNote: pl
      ? "Wiadomość wysłana automatycznie przez Care My Pet."
      : "Sent automatically by Care My Pet.",
  });

  await sendSmtpEmail({ to: params.to, subject, html });
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
    return reply({ error: "invalid_json" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return reply({ error: "server_misconfigured" }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const action = typeof body.action === "string" ? body.action : "";
  const locale: "pl" | "en" = body.locale === "en" ? "en" : "pl";
  const origin = resolveOrigin(req);

  // -------------------------------------------------------------------------
  // 1. Publiczna inicjacja odzyskiwania dostępu kluczem jednorazowym
  // -------------------------------------------------------------------------
  if (action === "initiate") {
    const ownerEmail = normalizeEmail(body.owner_email);
    const targetEmail = normalizeEmail(body.target_email);
    const rawKey = typeof body.recovery_key === "string" ? body.recovery_key : "";

    if (!isValidEmail(ownerEmail) || !isValidEmail(targetEmail)) {
      return reply({ error: "invalid_email" }, 400);
    }
    if (!isValidRecoveryKeyFormat(rawKey)) {
      return reply({ error: "invalid_key_format" }, 400);
    }

    const lookupKey = `owner:${ownerEmail}`;
    const { data: rateRows, error: rateErr } = await adminClient.rpc(
      "recovery_get_rate_limit",
      { p_lookup_key: lookupKey },
    );
    if (rateErr) {
      console.error("recovery_get_rate_limit failed:", rateErr);
      return reply({ error: "recovery_failed" }, 500);
    }

    const rateRow = Array.isArray(rateRows) ? rateRows[0] : rateRows;
    if (
      rateRow?.locked_until &&
      new Date(rateRow.locked_until).getTime() > Date.now()
    ) {
      return reply(
        { error: "rate_limited", locked_until: rateRow.locked_until },
        429,
      );
    }

    const { data: secrets, error: secretsErr } = await adminClient.rpc(
      "recovery_get_owner_household_secrets",
      { p_owner_email: ownerEmail },
    );

    if (secretsErr) {
      console.error("recovery_get_owner_household_secrets failed:", secretsErr);
      return reply({ error: "recovery_failed" }, 500);
    }

    const secretList = Array.isArray(secrets) ? secrets : [];
    let matched: {
      household_id: string;
      household_name: string;
      owner_id: string;
      owner_email: string;
      recovery_email: string | null;
      key_hash: string;
      key_salt: string;
    } | null = null;

    for (const row of secretList) {
      const ok = await verifyRecoveryKey(rawKey, row.key_salt, row.key_hash);
      if (ok) {
        matched = row;
        break;
      }
    }

    // Jeśli żaden klucz nie pasuje — wykonaj spowolnienie stałoczasowe przy pustym koncie i zlicz nieudaną próbę
    if (!matched) {
      if (secretList.length === 0) {
        // Wyrównaj czas odpowiedzi względem PBKDF2 (~kilkadziesiąt ms)
        await verifyRecoveryKey(
          rawKey,
          generateSaltHex(),
          "0".repeat(64),
        );
      }

      const { data: attemptRows } = await adminClient.rpc(
        "recovery_record_failed_attempt",
        {
          p_lookup_key: lookupKey,
          p_max_attempts: RECOVERY_MAX_FAILED_ATTEMPTS,
          p_lock_minutes: RECOVERY_LOCK_MINUTES,
        },
      );
      const attempt = Array.isArray(attemptRows) ? attemptRows[0] : attemptRows;
      if (
        attempt?.locked_until &&
        new Date(attempt.locked_until).getTime() > Date.now()
      ) {
        return reply(
          { error: "rate_limited", locked_until: attempt.locked_until },
          429,
        );
      }
      return reply({ error: "invalid_credentials" }, 400);
    }

    await adminClient.rpc("recovery_clear_rate_limit", {
      p_lookup_key: lookupKey,
    });

    const token = generateSecureToken();
    const expiresAt = new Date(
      Date.now() + RECOVERY_CLAIM_TTL_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { error: claimErr } = await adminClient.rpc("recovery_create_claim", {
      p_household_id: matched.household_id,
      p_previous_owner_id: matched.owner_id,
      p_target_email: targetEmail,
      p_token: token,
      p_expires_at: expiresAt,
    });

    if (claimErr) {
      console.error("recovery_create_claim failed:", claimErr);
      return reply({ error: "recovery_failed" }, 500);
    }

    const confirmUrl = `${origin}/${locale}/odzyskaj/potwierdz/${token}`;
    const formattedExpiry = new Intl.DateTimeFormat(
      locale === "pl" ? "pl-PL" : "en-GB",
      { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Warsaw" },
    ).format(new Date(expiresAt));

    const confirmSubject =
      locale === "pl"
        ? `Potwierdź przejęcie dostępu do domostwa "${matched.household_name}"`
        : `Confirm access recovery for household "${matched.household_name}"`;

    const confirmHtml = renderEmailCard({
      locale,
      badge: locale === "pl" ? "Krok 2 z 2 — potwierdzenie" : "Step 2 of 2 — confirmation",
      heading:
        locale === "pl"
          ? `Potwierdź odzyskanie dostępu do „${matched.household_name}”`
          : `Confirm access recovery for "${matched.household_name}"`,
      paragraphs:
        locale === "pl"
          ? [
              `Rozpoczęto procedurę odzyskania dostępu do domostwa <strong>${escapeHtml(matched.household_name)}</strong> przy użyciu jednorazowego klucza odzyskania.`,
              `Kliknij poniższy przycisk, aby zalogować się na konto powiązane z adresem <strong>${escapeHtml(targetEmail)}</strong> (lub utworzyć nowe konto dla tego adresu) i sfinalizować przekazanie własności. Po potwierdzeniu poprzedni klucz odzyskania wygaśnie, a poprzedni właściciel utraci dostęp.`,
              `Link jest ważny przez 24 godziny (do: <strong>${escapeHtml(formattedExpiry)}</strong>).`,
            ]
          : [
              `A household recovery request was initiated for <strong>${escapeHtml(matched.household_name)}</strong> using its one-time recovery key.`,
              `Click below to sign in to <strong>${escapeHtml(targetEmail)}</strong> (or create an account with that email) and complete the ownership transfer. The one-time key will be invalidated and the previous owner removed.`,
              `This link expires in 24 hours (${escapeHtml(formattedExpiry)}).`,
            ],
      cta: {
        label: locale === "pl" ? "Potwierdź przejęcie domostwa" : "Confirm household recovery",
        url: confirmUrl,
      },
      footerNote:
        locale === "pl"
          ? "Jeśli nie inicjowałeś tej operacji, zignoruj tę wiadomość."
          : "If you did not request this, you can safely ignore this message.",
    });

    const targetEmailSent = await sendSmtpEmail({
      to: targetEmail,
      subject: confirmSubject,
      html: confirmHtml,
    });

    if (!targetEmailSent) {
      return reply({ error: "email_send_failed" }, 502);
    }

    // Powiadomienie bezpieczeństwa na adres dotychczasowego właściciela i e-mail pomocniczy
    const alertRecipients = Array.from(
      new Set(
        [
          normalizeEmail(matched.owner_email),
          matched.recovery_email ? normalizeEmail(matched.recovery_email) : "",
        ].filter((addr) => addr && addr !== targetEmail),
      ),
    );

    if (alertRecipients.length > 0) {
      const maskedTarget = maskEmail(targetEmail);
      const alertSubject =
        locale === "pl"
          ? `Alert bezpieczeństwa: użyto klucza odzyskania dla domostwa "${matched.household_name}"`
          : `Security alert: recovery key used for household "${matched.household_name}"`;

      const alertHtml = renderEmailCard({
        locale,
        tone: "warning",
        badge: locale === "pl" ? "Alert bezpieczeństwa" : "Security alert",
        heading:
          locale === "pl"
            ? `Użyto klucza odzyskania domostwa „${matched.household_name}”`
            : `Recovery key used for "${matched.household_name}"`,
        paragraphs:
          locale === "pl"
            ? [
                `Wysłano link potwierdzający przejęcie domostwa na adres <strong>${escapeHtml(maskedTarget)}</strong>.`,
                `Jeśli to <strong>nie Ty</strong> przekazałeś klucz ani nie zlecałeś odzyskania, zaloguj się natychmiast i wygeneruj nowy klucz odzyskania w ustawieniach domostwa — spowoduje to natychmiastowe unieważnienie tego linku zanim dojdzie do przejęcia.`,
              ]
            : [
                `A recovery confirmation link was sent to <strong>${escapeHtml(maskedTarget)}</strong>.`,
                `If you did <strong>not</strong> authorize this recovery, sign in immediately and generate a new recovery key in household settings to revoke the pending link.`,
              ],
        cta: {
          label: locale === "pl" ? "Przejdź do ustawień i unieważnij" : "Open settings to revoke",
          url: `${origin}/${locale}/app/gospodarstwo`,
        },
      });

      await Promise.all(
        alertRecipients.map((to) =>
          sendSmtpEmail({ to, subject: alertSubject, html: alertHtml }),
        ),
      );
    }

    return reply({
      ok: true,
      household_name: matched.household_name,
      target_email_masked: maskEmail(targetEmail),
      expires_at: expiresAt,
    });
  }

  // -------------------------------------------------------------------------
  // 2. Odczyt żądania po tokenie (publiczne dla posiadacza linku z e-maila)
  // -------------------------------------------------------------------------
  if (action === "get_claim") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!tokenPattern.test(token)) {
      return reply({ error: "not_found" }, 404);
    }

    const { data: claimRows, error: claimErr } = await adminClient.rpc(
      "recovery_get_claim_by_token",
      { p_token: token },
    );
    if (claimErr) {
      console.error("recovery_get_claim_by_token failed:", claimErr);
      return reply({ error: "load_failed" }, 500);
    }

    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    if (!claim) {
      return reply({ error: "not_found" }, 404);
    }

    const status = getClaimStatus(claim);
    const [{ data: pets }, { data: existingUserRows }] = await Promise.all([
      adminClient
        .from("zwierze")
        .select("id, imie, gatunek")
        .eq("gospodarstwo_id", claim.household_id)
        .order("created_at"),
      adminClient.rpc("recovery_find_user_by_email", {
        p_email: claim.target_email,
      }),
    ]);

    const existingUser = Array.isArray(existingUserRows)
      ? existingUserRows[0]
      : existingUserRows;

    return reply({
      claim: {
        status,
        household_id: claim.household_id,
        household_name: claim.household_name,
        target_email: claim.target_email,
        expires_at: claim.expires_at,
        confirmed_at: claim.confirmed_at,
        revoked_at: claim.revoked_at,
        created_at: claim.created_at,
      },
      target_has_account: Boolean(existingUser?.user_id),
      pets: pets ?? [],
    });
  }

  // -------------------------------------------------------------------------
  // 3. Rejestracja nowego konta dla target_email + atomowe przejęcie domostwa
  // -------------------------------------------------------------------------
  if (action === "register_and_confirm") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!tokenPattern.test(token)) {
      return reply({ error: "invalid_token" }, 400);
    }
    if (!password || password.length < 12) {
      return reply({ error: "weak_password" }, 400);
    }

    const { data: claimRows, error: claimErr } = await adminClient.rpc(
      "recovery_get_claim_by_token",
      { p_token: token },
    );
    if (claimErr) {
      console.error("recovery_get_claim_by_token failed:", claimErr);
      return reply({ error: "load_failed" }, 500);
    }
    const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
    if (!claim) {
      return reply({ error: "not_found" }, 404);
    }

    const status = getClaimStatus(claim);
    if (status === "confirmed") return reply({ error: "already_confirmed" }, 409);
    if (status === "revoked") return reply({ error: "claim_revoked" }, 410);
    if (status === "expired") return reply({ error: "claim_expired" }, 410);

    const { data: existingRows } = await adminClient.rpc(
      "recovery_find_user_by_email",
      { p_email: claim.target_email },
    );
    const existing = Array.isArray(existingRows) ? existingRows[0] : existingRows;
    if (existing?.user_id) {
      return reply({ error: "account_exists" }, 409);
    }

    const { data: createdData, error: createUserErr } =
      await adminClient.auth.admin.createUser({
        email: claim.target_email,
        password,
        email_confirm: true,
      });

    if (createUserErr || !createdData?.user) {
      console.error("createUser in recovery failed:", createUserErr);
      return reply({ error: "create_user_failed" }, 400);
    }

    const newOwnerId = createdData.user.id;
    const { data: execRows, error: execErr } = await adminClient.rpc(
      "recovery_execute_claim",
      { p_token: token, p_new_owner_id: newOwnerId },
    );

    if (execErr) {
      // Usuń nowo utworzone puste konto, jeśli w międzyczasie claim wygasł/został unieważniony
      await adminClient.auth.admin.deleteUser(newOwnerId).catch(() => {});
      return mapExecuteClaimError(execErr);
    }

    const execRow = Array.isArray(execRows) ? execRows[0] : execRows;
    await sendCompletionEmail({
      to: claim.target_email,
      locale,
      householdName: execRow?.household_name ?? claim.household_name,
      appUrl: origin,
    });

    return reply({
      ok: true,
      household_id: execRow?.household_id ?? claim.household_id,
      household_name: execRow?.household_name ?? claim.household_name,
      email: claim.target_email,
      needs_login: true,
    });
  }

  // -------------------------------------------------------------------------
  // 4. Potwierdzenie przejęcia przez zalogowanego użytkownika o adresie target_email
  // -------------------------------------------------------------------------
  if (action === "confirm_claim") {
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
      error: authErr,
    } = await userClient.auth.getUser(authHeader.slice(7));

    if (authErr || !user || user.is_anonymous) {
      return reply({ error: "unauthorized" }, 401);
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!tokenPattern.test(token)) {
      return reply({ error: "invalid_token" }, 400);
    }

    const { data: execRows, error: execErr } = await adminClient.rpc(
      "recovery_execute_claim",
      { p_token: token, p_new_owner_id: user.id },
    );

    if (execErr) {
      return mapExecuteClaimError(execErr);
    }

    const execRow = Array.isArray(execRows) ? execRows[0] : execRows;
    const recipientEmail = user.email || execRow?.target_email;
    if (recipientEmail) {
      await sendCompletionEmail({
        to: recipientEmail,
        locale,
        householdName: execRow?.household_name ?? "",
        appUrl: origin,
      });
    }

    // Pomocniczo: przypisz wartość klucza na pewno sformatowaną w pamięci — tutaj tylko potwierdzenie
    void formatRecoveryKey;

    return reply({
      ok: true,
      household_id: execRow?.household_id,
      household_name: execRow?.household_name,
      email: recipientEmail,
    });
  }

  return reply({ error: "unknown_action" }, 400);
});
