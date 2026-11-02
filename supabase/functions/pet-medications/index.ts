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
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const hhMm = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const validScheduleTypes = new Set(["one_off", "daily", "interval"]);
const validIntervalUnits = new Set(["days", "weeks", "months"]);
const validDoseStatuses = new Set(["taken", "skipped"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") {
    return reply({ error: "method_not_allowed" }, 405);
  }

  const token = req.headers.get("Authorization");
  if (!token?.startsWith("Bearer ")) {
    return reply({ error: "unauthorized" }, 401);
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: token } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser(token.slice(7));
  if (authError || !user || user.is_anonymous) {
    return reply({ error: "unauthorized" }, 401);
  }

  try {
    const body = await req.json();
    const petId = typeof body?.pet_id === "string" ? body.pet_id : "";
    if (!uuid.test(petId)) {
      return reply({ error: "invalid_input" }, 400);
    }

    const { data: pet, error: petError } = await client
      .from("zwierze")
      .select("id,gospodarstwo_id")
      .eq("id", petId)
      .maybeSingle();

    if (petError) return reply({ error: "load_failed" }, 500);
    if (!pet) return reply({ error: "not_found" }, 404);

    // 1. Delete schedule
    if (body.action === "delete") {
      if (
        !uuid.test(body.id ?? "") ||
        !Number.isInteger(body.revision) ||
        body.revision < 1
      ) {
        return reply({ error: "invalid_input" }, 400);
      }
      const { error } = await client.rpc("delete_medication_schedule", {
        p_id: body.id,
        p_pet_id: pet.id,
        p_revision: body.revision,
      });
      if (error) {
        return reply(
          { error: error.code === "PT409" ? "conflict" : "delete_failed" },
          error.code === "PT409" ? 409 : 400,
        );
      }
      return reply({ deleted: true });
    }

    // 2. Record or update dose log (Zatwierdzenie / odnotowanie podania)
    if (body.action === "record_dose") {
      const scheduleId =
        typeof body.schedule_id === "string" && uuid.test(body.schedule_id)
          ? body.schedule_id
          : null;
      const doseDate = typeof body.dose_date === "string" ? body.dose_date : "";
      const scheduledTime =
        typeof body.scheduled_time === "string" ? body.scheduled_time : "";
      const status = typeof body.status === "string" ? body.status : "taken";
      const notes = typeof body.notes === "string" ? body.notes.slice(0, 1000) : "";

      if (
        !isoDate.test(doseDate) ||
        (scheduledTime && !hhMm.test(scheduledTime)) ||
        !validDoseStatuses.has(status)
      ) {
        return reply({ error: "invalid_input" }, 400);
      }

      const nowIso = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Warsaw",
      }).format(new Date());

      if (doseDate > nowIso) {
        return reply({ error: "future_dose_not_allowed" }, 400);
      }

      const { data: log, error } = await client.rpc("record_medication_dose", {
        p_schedule_id: scheduleId,
        p_pet_id: pet.id,
        p_dose_date: doseDate,
        p_scheduled_time: scheduledTime,
        p_status: status,
        p_notes: notes,
      });

      if (error) {
        console.error("record_medication_dose error:", error);
        return reply({ error: "save_dose_failed", details: error.message }, 400);
      }
      return reply({ log });
    }

    // 3. Delete dose log (Cofnięcie zatwierdzenia dawki)
    if (body.action === "delete_dose_log") {
      const logId = typeof body.log_id === "string" ? body.log_id : "";
      if (!uuid.test(logId)) {
        return reply({ error: "invalid_input" }, 400);
      }
      const { error } = await client.rpc("delete_medication_dose_log", {
        p_log_id: logId,
      });
      if (error) {
        return reply({ error: "delete_dose_failed" }, 400);
      }
      return reply({ deleted: true });
    }

    // 4. Save or update medication schedule
    const id =
      typeof body.id === "string" && uuid.test(body.id)
        ? body.id
        : crypto.randomUUID();
    const revision = Number.isInteger(body.revision) ? body.revision : 0;
    const item = body.item ?? body;

    const name = String(item.name ?? "").trim();
    const dosage = String(item.dosage ?? "").trim();
    const scheduleType = String(item.schedule_type ?? "one_off").trim();
    const intervalValue =
      item.interval_value != null && Number.isInteger(Number(item.interval_value))
        ? Number(item.interval_value)
        : null;
    const intervalUnit =
      typeof item.interval_unit === "string" && item.interval_unit.trim()
        ? item.interval_unit.trim()
        : null;
    const startDate = String(item.start_date ?? "").trim();
    const endDate =
      typeof item.end_date === "string" && item.end_date.trim()
        ? item.end_date.trim()
        : null;
    const scheduledTimesRaw = Array.isArray(item.scheduled_times) ? item.scheduled_times : [];
    const scheduledTimes = Array.from(new Set(
      scheduledTimesRaw
        .map((t: unknown) => String(t ?? "").trim())
        .filter((t: string) => hhMm.test(t))
    )).sort();

    const scheduledTime = String(
      item.scheduled_time ?? scheduledTimes[0] ?? "",
    ).trim();
    const instructions = String(item.instructions ?? "").trim();
    const isActive = item.is_active !== false;

    const stockQuantity =
      item.stock_quantity != null && item.stock_quantity !== "" && !Number.isNaN(Number(item.stock_quantity))
        ? Math.max(0, Number(item.stock_quantity))
        : null;
    const lowStockThreshold =
      item.low_stock_threshold != null && item.low_stock_threshold !== "" && !Number.isNaN(Number(item.low_stock_threshold))
        ? Math.max(0, Number(item.low_stock_threshold))
        : 5;
    const stockUnit =
      typeof item.stock_unit === "string" && item.stock_unit.trim()
        ? item.stock_unit.trim().slice(0, 30)
        : "dawek";

    if (
      name.length < 1 ||
      name.length > 120 ||
      dosage.length > 120 ||
      !validScheduleTypes.has(scheduleType) ||
      !isoDate.test(startDate) ||
      (endDate !== null && (!isoDate.test(endDate) || endDate < startDate)) ||
      (scheduledTime && !hhMm.test(scheduledTime)) ||
      instructions.length > 2000
    ) {
      return reply({ error: "invalid_input" }, 400);
    }

    if (scheduleType === "interval") {
      if (
        intervalValue === null ||
        intervalValue < 1 ||
        intervalValue > 365 ||
        !intervalUnit ||
        !validIntervalUnits.has(intervalUnit)
      ) {
        return reply({ error: "invalid_interval_input" }, 400);
      }
    }

    const { data: saved, error: rpcError } = await client.rpc(
      "save_medication_schedule",
      {
        p_id: id,
        p_pet_id: pet.id,
        p_revision: revision,
        p_name: name,
        p_dosage: dosage,
        p_schedule_type: scheduleType,
        p_interval_value: intervalValue,
        p_interval_unit: intervalUnit,
        p_start_date: startDate,
        p_end_date: endDate,
        p_scheduled_time: scheduledTime,
        p_instructions: instructions,
        p_is_active: isActive,
        p_scheduled_times: scheduledTimes.length > 0 ? scheduledTimes : (scheduledTime ? [scheduledTime] : []),
        p_stock_quantity: stockQuantity,
        p_low_stock_threshold: lowStockThreshold,
        p_stock_unit: stockUnit,
      },
    );

    if (rpcError) {
      return reply(
        { error: rpcError.code === "PT409" ? "conflict" : "save_failed" },
        rpcError.code === "PT409" ? 409 : 400,
      );
    }

    return reply({ schedule: saved });
  } catch (_e) {
    return reply({ error: "server_error" }, 500);
  }
});
