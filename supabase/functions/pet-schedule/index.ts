import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import {
  formatHealthEventKnowledgeContent,
  indexPetKnowledgeChunk,
} from "../_shared/rag.ts";
import { parseNotifyEmailsInput } from "./validation.mjs";

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
const validCategories = new Set(["visit", "vaccination", "prevention"]);
const validStatuses = new Set(["planned", "completed", "cancelled"]);

function todayWarsaw(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

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
    const reader = req.body?.getReader();
    if (!reader) return reply({ error: "invalid_input" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 64 * 1024) {
        await reader.cancel();
        return reply({ error: "too_large" }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }

    const body = JSON.parse(new TextDecoder().decode(bytes));
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

    if (body.action === "delete") {
      if (
        !uuid.test(body.id ?? "") ||
        !Number.isInteger(body.revision) ||
        body.revision < 1
      ) {
        return reply({ error: "invalid_input" }, 400);
      }
      const { error } = await client.rpc("delete_pet_schedule_item", {
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

    if (body.action === "status") {
      if (
        !uuid.test(body.id ?? "") ||
        !Number.isInteger(body.revision) ||
        body.revision < 1 ||
        !validStatuses.has(body.status)
      ) {
        return reply({ error: "invalid_input" }, 400);
      }
      const { data: current } = await client
        .from("pet_schedule_item")
        .select("*")
        .eq("id", body.id)
        .eq("pet_id", pet.id)
        .maybeSingle();

      if (!current) return reply({ error: "not_found" }, 404);

      const { data: updated, error } = await client.rpc(
        "save_pet_schedule_item",
        {
          p_id: current.id,
          p_pet_id: pet.id,
          p_revision: body.revision,
          p_category: current.category,
          p_title: current.title,
          p_scheduled_date: current.scheduled_date,
          p_scheduled_time: current.scheduled_time,
          p_clinic: current.clinic,
          p_doctor: current.doctor,
          p_prep_notes: current.prep_notes,
          p_status: body.status,
          p_notify_emails: Array.isArray(current.notify_emails)
            ? current.notify_emails
            : [],
        },
      );
      if (error) {
        return reply(
          { error: error.code === "PT409" ? "conflict" : "save_failed" },
          error.code === "PT409" ? 409 : 400,
        );
      }
      return reply({ item: updated });
    }

    if (body.action === "complete") {
      // Mark either a planned schedule item OR a recurring due date from pet_health_event as completed
      const sourceKind =
        body.source_kind === "due_event" ? "due_event" : "schedule_item";
      const sourceId = typeof body.source_id === "string" ? body.source_id : "";
      const newEventId =
        typeof body.event_id === "string" && uuid.test(body.event_id)
          ? body.event_id
          : crypto.randomUUID();

      if (!uuid.test(sourceId)) {
        return reply({ error: "invalid_input" }, 400);
      }

      const category = String(body.category ?? "").trim();
      const title = String(body.title ?? "").trim();
      const eventDate = String(body.event_date ?? todayWarsaw()).trim();
      const nextDueDate =
        typeof body.next_due_date === "string" && body.next_due_date.trim()
          ? body.next_due_date.trim()
          : null;
      const clinic = String(body.clinic ?? "").trim();
      const doctor = String(body.doctor ?? "").trim();
      const batchOrProduct = String(body.batch_or_product ?? "").trim();
      const description = String(body.description ?? "").trim();

      if (
        !validCategories.has(category) ||
        title.length < 1 ||
        title.length > 120 ||
        !isoDate.test(eventDate) ||
        eventDate > todayWarsaw() ||
        (nextDueDate !== null &&
          (!isoDate.test(nextDueDate) || nextDueDate < eventDate)) ||
        clinic.length > 120 ||
        doctor.length > 120 ||
        batchOrProduct.length > 120 ||
        description.length > 2000
      ) {
        return reply({ error: "invalid_input" }, 400);
      }

      // 1. Create the completed health event on the pet's timeline
      const { data: createdEvent, error: eventError } = await client.rpc(
        "save_pet_health_event",
        {
          p_id: newEventId,
          p_pet_id: pet.id,
          p_revision: 0,
          p_category: category,
          p_title: title,
          p_event_date: eventDate,
          p_next_due_date: nextDueDate,
          p_clinic: clinic,
          p_doctor: doctor,
          p_batch_or_product: batchOrProduct,
          p_description: description,
          p_source_path: null,
          p_source_name: null,
          p_source_mime: null,
        },
      );

      if (eventError || !createdEvent) {
        return reply({ error: "save_failed" }, 400);
      }

      let updatedScheduleItem = null;
      let clearedDueEvent = null;

      if (sourceKind === "schedule_item") {
        const { data: updated } = await client
          .from("pet_schedule_item")
          .update({
            status: "completed",
            completed_event_id: createdEvent.id,
          })
          .eq("id", sourceId)
          .eq("pet_id", pet.id)
          .select("*")
          .maybeSingle();
        updatedScheduleItem = updated;
      } else {
        // Clear next_due_date on the previous health event so the old reminder doesn't stay active
        const { data: updatedEv } = await client
          .from("pet_health_event")
          .update({ next_due_date: null })
          .eq("id", sourceId)
          .eq("pet_id", pet.id)
          .select("*")
          .maybeSingle();
        clearedDueEvent = updatedEv;
      }

      await indexPetKnowledgeChunk(client, {
        petId: pet.id,
        sourceType: "health_event",
        sourceId: String(createdEvent.id),
        eventDate: createdEvent.event_date,
        title: createdEvent.title,
        content: formatHealthEventKnowledgeContent(createdEvent),
      });

      return reply({
        created_event: createdEvent,
        schedule_item: updatedScheduleItem,
        cleared_due_event: clearedDueEvent,
      });
    }

    // Default action: save (create or edit a schedule item)
    const raw = body.item ?? body;
    const id = typeof body.id === "string" ? body.id : "";
    const revision = body.revision;
    const category = String(raw?.category ?? "").trim();
    const title = String(raw?.title ?? "").trim();
    const scheduledDate = String(raw?.scheduled_date ?? "").trim();
    const scheduledTime = String(raw?.scheduled_time ?? "").trim();
    const clinic = String(raw?.clinic ?? "").trim();
    const doctor = String(raw?.doctor ?? "").trim();
    const prepNotes = String(raw?.prep_notes ?? "").trim();
    const status = validStatuses.has(raw?.status) ? raw.status : "planned";
    const parsedEmails = parseNotifyEmailsInput(raw?.notify_emails);

    if (!parsedEmails.ok) {
      return reply({ error: parsedEmails.error }, 400);
    }

    if (
      !uuid.test(id) ||
      !Number.isInteger(revision) ||
      revision < 0 ||
      !validCategories.has(category) ||
      title.length < 1 ||
      title.length > 120 ||
      !isoDate.test(scheduledDate) ||
      (scheduledTime !== "" && !hhMm.test(scheduledTime)) ||
      clinic.length > 120 ||
      doctor.length > 120 ||
      prepNotes.length > 2000
    ) {
      return reply({ error: "invalid_input" }, 400);
    }

    const { data: saved, error: saveError } = await client.rpc(
      "save_pet_schedule_item",
      {
        p_id: id,
        p_pet_id: pet.id,
        p_revision: revision,
        p_category: category,
        p_title: title,
        p_scheduled_date: scheduledDate,
        p_scheduled_time: scheduledTime,
        p_clinic: clinic,
        p_doctor: doctor,
        p_prep_notes: prepNotes,
        p_status: status,
        p_notify_emails: parsedEmails.emails,
      },
    );

    if (saveError) {
      return reply(
        { error: saveError.code === "PT409" ? "conflict" : "save_failed" },
        saveError.code === "PT409" ? 409 : 400,
      );
    }

    return reply({ item: saved });
  } catch {
    return reply({ error: "invalid_request" }, 400);
  }
});
