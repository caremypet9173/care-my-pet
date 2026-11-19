import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Measurement, MedicalReport, MeasurementCorrection } from "./types";

const listReportsCached = cache(
  async (
    petId: string,
    requestedId: string | undefined,
    isFull: boolean,
  ): Promise<MedicalReport[]> => {
    const client = await createClient();
    if (!client) throw new Error("Supabase unavailable");

  if (!isFull) {
    const { data: reportsData, error: reportsErr } = await client
      .from("wynik_badania")
      .select(
        "id, gospodarstwo_id, zwierze_id, title, test_date, laboratory, doctor, notes, source_path, source_name, source_mime, created_by, confirmed_at",
      )
      .eq("zwierze_id", petId)
      .order("test_date", { ascending: false })
      .order("confirmed_at", { ascending: false })
      .limit(10);

    if (reportsErr) throw new Error("Could not load reports");

    const reportIds = (reportsData ?? []).map((r) => r.id);
    if (reportIds.length === 0) return [];

    // Pobieramy wyłącznie wiersze oznaczone jako kluczowe w measurement_correction
    const { data: keyRows } = await client
      .from("pomiar_parametru")
      .select("*, correction:measurement_correction!inner(*)")
      .in("wynik_id", reportIds)
      .eq("correction.is_key", true);

    const rowsByReportId = new Map<string, Measurement[]>();
    for (const row of keyRows ?? []) {
      const list = rowsByReportId.get(row.wynik_id) ?? [];
      const correction = row.correction as MeasurementCorrection | null;
      list.push({
        ...row,
        original: {
          value: row.value,
          unit: row.unit,
          reference: row.reference,
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
      });
      rowsByReportId.set(row.wynik_id, list);
    }

    return (reportsData ?? []).map((r) => ({
      ...r,
      rows: (rowsByReportId.get(r.id) ?? []).sort(
        (a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0),
      ),
    }));
  }

  const { data, error } = await client
    .from("wynik_badania")
    .select("*,rows:pomiar_parametru(*,correction:measurement_correction(*))")
    .eq("zwierze_id", petId)
    .order("test_date", { ascending: false })
    .order("confirmed_at", { ascending: false })
    .limit(100);

  if (error) throw new Error("Could not load reports");

  if (
    requestedId &&
    /^[0-9a-f-]{36}$/i.test(requestedId) &&
    !data.some((r) => r.id === requestedId)
  ) {
    const extra = await client
      .from("wynik_badania")
      .select("*,rows:pomiar_parametru(*,correction:measurement_correction(*))")
      .eq("zwierze_id", petId)
      .eq("id", requestedId)
      .maybeSingle();
    if (extra.error) throw new Error("Could not load report");
    if (extra.data) data.push(extra.data);
  }

  return (
    data as (Omit<MedicalReport, "rows"> & {
      rows: (MedicalReport["rows"][number] & {
        correction: MeasurementCorrection | null;
      })[];
    })[]
  ).map((report) => ({
    ...report,
    rows: report.rows
      .map(({ correction, ...row }) => ({
        ...row,
        original: {
          value: row.value,
          unit: row.unit,
          reference: row.reference,
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
      }))
      .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0)),
  }));
});

export async function listReports(
  petId: string,
  requestedId?: string,
  options?: { full?: boolean },
): Promise<MedicalReport[]> {
  return listReportsCached(petId, requestedId, options?.full ?? true);
}
