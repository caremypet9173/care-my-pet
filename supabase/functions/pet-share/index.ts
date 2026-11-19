import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "private, no-store",
};

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers });

const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const tokenPattern = /^[A-Za-z0-9_-]{24,80}$/;

function generateSecureToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
  // 1. Publiczny odczyt kartoteki dla weterynarza po tokenie (read-only)
  // =========================================================================
  if (action === "get_shared" || action === "get_document_url") {
    const shareToken = typeof body.token === "string" ? body.token.trim() : "";
    if (!tokenPattern.test(shareToken)) {
      return reply({ error: "not_found" }, 404);
    }

    const { data: link, error: linkError } = await adminClient
      .from("pet_share_link")
      .select("*")
      .eq("token", shareToken)
      .maybeSingle();

    if (linkError || !link) {
      return reply({ error: "not_found" }, 404);
    }

    if (link.revoked_at) {
      return reply(
        { error: "revoked", revoked_at: link.revoked_at },
        410,
      );
    }

    const nowMs = Date.now();
    const expMs = new Date(link.expires_at).getTime();
    if (!Number.isFinite(expMs) || nowMs > expMs) {
      return reply(
        { error: "expired", expires_at: link.expires_at },
        410,
      );
    }

    if (action === "get_document_url") {
      const sourcePath =
        typeof body.source_path === "string" ? body.source_path.trim() : "";
      if (!sourcePath) {
        return reply({ error: "invalid_input" }, 400);
      }

      // Weryfikujemy, że żądany plik faktycznie należy do tego pupila i gospodarstwa
      const [{ data: repMatch }, { data: evMatch }] = await Promise.all([
        adminClient
          .from("wynik_badania")
          .select("id")
          .eq("zwierze_id", link.pet_id)
          .eq("gospodarstwo_id", link.household_id)
          .eq("source_path", sourcePath)
          .limit(1)
          .maybeSingle(),
        adminClient
          .from("pet_health_event")
          .select("id")
          .eq("pet_id", link.pet_id)
          .eq("household_id", link.household_id)
          .eq("source_path", sourcePath)
          .limit(1)
          .maybeSingle(),
      ]);

      if (!repMatch && !evMatch) {
        return reply({ error: "forbidden_document" }, 403);
      }

      const { data: signed, error: signErr } = await adminClient.storage
        .from("medical-documents")
        .createSignedUrl(sourcePath, 900);

      if (signErr || !signed?.signedUrl) {
        return reply({ error: "sign_failed" }, 500);
      }

      return reply({ signed_url: signed.signedUrl });
    }

    // action === "get_shared"
    const nowIso = new Date().toISOString();
    const userAgent =
      typeof body.user_agent === "string"
        ? body.user_agent.slice(0, 240)
        : (req.headers.get("user-agent") ?? "").slice(0, 240);

    // Zwiększ licznik otwarć i zapisz wpis w logu otwarć
    await Promise.all([
      adminClient
        .from("pet_share_link")
        .update({
          open_count: Number(link.open_count ?? 0) + 1,
          last_opened_at: nowIso,
        })
        .eq("id", link.id),
      adminClient.from("pet_share_open_log").insert({
        share_link_id: link.id,
        pet_id: link.pet_id,
        household_id: link.household_id,
        opened_at: nowIso,
        user_agent: userAgent,
      }),
    ]);

    const [
      { data: pet },
      { data: weights },
      { data: healthEvents },
      { data: rawReports },
      { data: scheduleItems },
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
        .select("id,pet_id,kg,measured_on,note,created_at,updated_at,revision")
        .eq("pet_id", link.pet_id)
        .eq("household_id", link.household_id)
        .order("measured_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      adminClient
        .from("pet_health_event")
        .select(
          "id,pet_id,category,title,event_date,next_due_date,clinic,doctor,batch_or_product,description,source_path,source_name,source_mime,created_at,updated_at,revision",
        )
        .eq("pet_id", link.pet_id)
        .eq("household_id", link.household_id)
        .order("event_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
      adminClient
        .from("wynik_badania")
        .select(
          "id,zwierze_id,title,test_date,laboratory,doctor,notes,ai_interpretation,source_path,source_name,source_mime,confirmed_at,rows:pomiar_parametru(id,wynik_id,ordinal,category,name,value,unit,reference,value_type,correction:measurement_correction(value,unit,reference,note,is_key,revision))",
        )
        .eq("zwierze_id", link.pet_id)
        .eq("gospodarstwo_id", link.household_id)
        .order("test_date", { ascending: false })
        .order("confirmed_at", { ascending: false })
        .limit(100),
      adminClient
        .from("pet_schedule_item")
        .select(
          "id,pet_id,category,title,scheduled_date,scheduled_time,clinic,doctor,prep_notes,status,completed_event_id,created_at,updated_at,revision",
        )
        .eq("pet_id", link.pet_id)
        .eq("household_id", link.household_id)
        .eq("status", "planned")
        .order("scheduled_date", { ascending: true })
        .limit(50),
    ]);

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
            original: {
              value: r.value,
              unit: r.unit,
              reference: r.reference,
            },
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

    return reply({
      share: {
        id: link.id,
        label: link.label,
        ttl_hours: link.ttl_hours,
        created_at: link.created_at,
        expires_at: link.expires_at,
        open_count: Number(link.open_count ?? 0) + 1,
      },
      pet: {
        ...pet,
        avatar_url: avatarUrl,
      },
      weights: weights ?? [],
      health_events: healthEvents ?? [],
      reports,
      schedule_items: scheduleItems ?? [],
    });
  }

  // =========================================================================
  // 2. Operacje właściciela (tworzenie linku, unieważnianie, lista z logami)
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
  if (!uuid.test(petId)) {
    return reply({ error: "invalid_input" }, 400);
  }

  const { data: pet, error: petError } = await userClient
    .from("zwierze")
    .select("id,gospodarstwo_id,imie,archived_at,gospodarstwo(recovery_key_set_at)")
    .eq("id", petId)
    .maybeSingle();

  if (petError || !pet) {
    return reply({ error: "not_found" }, 404);
  }

  const hhMeta = (
    pet as unknown as {
      gospodarstwo?:
        | { recovery_key_set_at?: string | null }
        | Array<{ recovery_key_set_at?: string | null }>;
    }
  ).gospodarstwo;
  const hasRecoveryKey = Boolean(
    Array.isArray(hhMeta)
      ? hhMeta[0]?.recovery_key_set_at
      : hhMeta?.recovery_key_set_at,
  );

  if (action === "list") {
    const [{ data: links }, { data: openLogs }] = await Promise.all([
      userClient
        .from("pet_share_link")
        .select("*")
        .eq("pet_id", pet.id)
        .order("created_at", { ascending: false })
        .limit(20),
      userClient
        .from("pet_share_open_log")
        .select("*")
        .eq("pet_id", pet.id)
        .order("opened_at", { ascending: false })
        .limit(50),
    ]);

    return reply({
      links: links ?? [],
      open_logs: openLogs ?? [],
    });
  }

  if (action === "create") {
    if (pet.archived_at) {
      return reply({ error: "pet_archived" }, 423);
    }
    if (!hasRecoveryKey) {
      return reply({ error: "recovery_key_required" }, 428);
    }
    const ttlHours =
      body.ttl_hours === 1 || body.ttl_hours === 24 || body.ttl_hours === 168
        ? Number(body.ttl_hours)
        : 24;
    const label =
      typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";

    const token = generateSecureToken();
    const expiresAt = new Date(
      Date.now() + ttlHours * 60 * 60 * 1000,
    ).toISOString();

    const { data: created, error: insertErr } = await userClient
      .from("pet_share_link")
      .insert({
        pet_id: pet.id,
        household_id: pet.gospodarstwo_id,
        token,
        label,
        ttl_hours: ttlHours,
        expires_at: expiresAt,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (insertErr || !created) {
      return reply({ error: "create_failed" }, 400);
    }

    return reply({ link: created });
  }

  if (action === "revoke") {
    const linkId = typeof body.link_id === "string" ? body.link_id : "";
    if (!uuid.test(linkId)) {
      return reply({ error: "invalid_input" }, 400);
    }

    const { data: updated, error: revErr } = await userClient
      .from("pet_share_link")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", linkId)
      .eq("pet_id", pet.id)
      .select("*")
      .single();

    if (revErr || !updated) {
      return reply({ error: "revoke_failed" }, 400);
    }

    return reply({ link: updated });
  }

  return reply({ error: "unknown_action" }, 400);
});
