import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";

function getServiceClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function logEmbeddingUsage(
  fallbackClient: SupabaseClient,
  payload: Record<string, unknown>,
  userId?: string,
): Promise<void> {
  const svc = getServiceClient();
  const target = svc ?? fallbackClient;
  const { error } = await target.rpc("log_ai_usage", {
    ...payload,
    ...(userId ? { p_user_id: userId } : {}),
  });
  if (error) {
    console.error("rag_log_ai_usage_failed", error);
  }
}

function normalizeVector(values: number[]): number[] {
  let sumSq = 0;
  for (const v of values) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  if (!norm || !Number.isFinite(norm)) return values;
  return values.map((v) => Number((v / norm).toFixed(7)));
}

export async function indexPetKnowledgeChunk(
  client: SupabaseClient,
  params: {
    petId: string;
    sourceType: "medical_report" | "health_event";
    sourceId: string;
    eventDate: string;
    title: string;
    content: string;
    userId?: string;
  },
): Promise<void> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return;

  const text = params.content.trim().slice(0, 10000);
  if (!text) return;

  const modelsToTry = ["gemini-embedding-2", "gemini-embedding-001"];
  for (const model of modelsToTry) {
    const startedAt = performance.now();
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify({
            content: {
              parts: [{ text: `${params.title}\n${text}` }],
            },
            outputDimensionality: 768,
          }),
        },
      );
      const durationMs = Math.round(performance.now() - startedAt);

      if (!response.ok) {
        if (model === modelsToTry[0] && (response.status === 404 || response.status === 400)) {
          continue;
        }
        await logEmbeddingUsage(
          client,
          {
            p_pet_id: params.petId,
            p_feature: "embedding",
            p_model: model,
            p_mime_type: "text/plain",
            p_file_size_bytes: new TextEncoder().encode(text).byteLength,
            p_prompt_tokens: 0,
            p_output_tokens: 0,
            p_thoughts_tokens: 0,
            p_total_tokens: 0,
            p_duration_ms: durationMs,
            p_status: "http_error",
            p_http_status: response.status,
          },
          params.userId,
        );
        return;
      }

      const result = await response.json();
      const rawValues: number[] | undefined =
        result?.embedding?.values ?? result?.embeddings?.[0]?.values;

      if (!Array.isArray(rawValues) || rawValues.length !== 768) {
        await logEmbeddingUsage(
          client,
          {
            p_pet_id: params.petId,
            p_feature: "embedding",
            p_model: model,
            p_mime_type: "text/plain",
            p_file_size_bytes: new TextEncoder().encode(text).byteLength,
            p_prompt_tokens: 0,
            p_output_tokens: 0,
            p_thoughts_tokens: 0,
            p_total_tokens: 0,
            p_duration_ms: durationMs,
            p_status: "invalid_output",
            p_http_status: 200,
          },
          params.userId,
        );
        return;
      }

      const vector = normalizeVector(rawValues);
      const vectorLiteral = `[${vector.join(",")}]`;
      const estimatedTokens = Math.max(
        1,
        Math.ceil((params.title.length + text.length) / 4),
      );

      await Promise.all([
        client.rpc("upsert_pet_knowledge_chunk", {
          p_pet_id: params.petId,
          p_source_type: params.sourceType,
          p_source_id: params.sourceId,
          p_event_date: params.eventDate,
          p_title: params.title,
          p_content: text,
          p_embedding: vectorLiteral,
        }),
        logEmbeddingUsage(
          client,
          {
            p_pet_id: params.petId,
            p_feature: "embedding",
            p_model: model,
            p_mime_type: "text/plain",
            p_file_size_bytes: new TextEncoder().encode(text).byteLength,
            p_prompt_tokens: estimatedTokens,
            p_output_tokens: 0,
            p_thoughts_tokens: 0,
            p_total_tokens: estimatedTokens,
            p_duration_ms: durationMs,
            p_status: "ok",
            p_http_status: 200,
          },
          params.userId,
        ),
      ]);
      return;
    } catch (err) {
      console.error("rag_embedding_failed", model, err);
    }
  }
}

export async function embedTextQuery(
  client: SupabaseClient,
  petId: string,
  text: string,
  userId?: string,
): Promise<string | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;

  const query = text.trim().slice(0, 1000);
  if (!query) return null;

  const modelsToTry = ["gemini-embedding-2", "gemini-embedding-001"];
  for (const model of modelsToTry) {
    const startedAt = performance.now();
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": key,
          },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            content: {
              parts: [{ text: query }],
            },
            outputDimensionality: 768,
          }),
        },
      );
      const durationMs = Math.round(performance.now() - startedAt);

      if (!response.ok) {
        if (model === modelsToTry[0] && (response.status === 404 || response.status === 400)) {
          continue;
        }
        return null;
      }

      const result = await response.json();
      const rawValues: number[] | undefined =
        result?.embedding?.values ?? result?.embeddings?.[0]?.values;

      if (!Array.isArray(rawValues) || rawValues.length !== 768) {
        return null;
      }

      const vector = normalizeVector(rawValues);
      const estimatedTokens = Math.max(1, Math.ceil(query.length / 4));
      await logEmbeddingUsage(
        client,
        {
          p_pet_id: petId,
          p_feature: "embedding",
          p_model: model,
          p_mime_type: "text/plain",
          p_file_size_bytes: new TextEncoder().encode(query).byteLength,
          p_prompt_tokens: estimatedTokens,
          p_output_tokens: 0,
          p_thoughts_tokens: 0,
          p_total_tokens: estimatedTokens,
          p_duration_ms: durationMs,
          p_status: "ok",
          p_http_status: 200,
        },
        userId,
      );

      return `[${vector.join(",")}]`;
    } catch {
      // Fallback to next embedding model or keyword context
    }
  }
  return null;
}

export function formatReportKnowledgeContent(report: {
  title: string | null;
  test_date: string;
  laboratory?: string | null;
  doctor?: string | null;
  notes?: string | null;
  ai_interpretation?: string | null;
  rows?: Array<{
    name: string | null;
    value: string | null;
    unit?: string | null;
    reference?: string | null;
    category?: string | null;
  }>;
}): string {
  const isDescriptive = !report.rows || report.rows.length === 0;
  const lines: string[] = [
    `${isDescriptive ? "Badanie obrazowe / opisowe" : "Badanie laboratoryjne"}: ${report.title ?? ""}`,
    `Data badania: ${report.test_date}`,
  ];
  if (report.laboratory) lines.push(`Laboratorium / klinika: ${report.laboratory}`);
  if (report.doctor) lines.push(`Lekarz weterynarii: ${report.doctor}`);
  if (report.rows && report.rows.length > 0) {
    lines.push("Wyniki parametrów:");
    for (const r of report.rows) {
      const unitPart = r.unit ? ` ${r.unit}` : "";
      const refPart = r.reference ? ` (norma: ${r.reference})` : "";
      lines.push(`- ${r.name ?? ""}: ${r.value ?? ""}${unitPart}${refPart}`);
    }
  }
  if (report.notes) {
    lines.push(`Uwagi i opis: ${report.notes}`);
  }
  if (report.ai_interpretation) {
    lines.push(`Wstępna analiza AI: ${report.ai_interpretation}`);
  }
  return lines.join("\n");
}

export function formatHealthEventKnowledgeContent(event: {
  category: string;
  title: string;
  event_date: string;
  next_due_date?: string | null;
  clinic?: string;
  doctor?: string;
  batch_or_product?: string;
  description?: string;
}): string {
  const catLabel =
    event.category === "vaccination"
      ? "Szczepienie"
      : event.category === "prevention"
        ? "Leki i profilaktyka"
        : "Wizyta weterynaryjna";
  const lines: string[] = [
    `${catLabel}: ${event.title}`,
    `Data zdarzenia: ${event.event_date}`,
  ];
  if (event.next_due_date) lines.push(`Kolejny termin / ważne do: ${event.next_due_date}`);
  if (event.clinic) lines.push(`Klinika / przychodnia: ${event.clinic}`);
  if (event.doctor) lines.push(`Lekarz weterynarii: ${event.doctor}`);
  if (event.batch_or_product) lines.push(`Preparat / seria: ${event.batch_or_product}`);
  if (event.description) lines.push(`Opis i zalecenia: ${event.description}`);
  return lines.join("\n");
}
