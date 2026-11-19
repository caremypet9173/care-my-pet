import { createClient } from "@/lib/supabase/client";
import type { VitalMeasurement } from "./types";

export interface SaveVitalParams {
  id?: string;
  petId: string;
  revision?: number;
  metricType: "blood_pressure" | "glucose" | "temperature";
  valuePrimary: number;
  valueSecondary?: number | null;
  valueTertiary?: number | null;
  unit: "mmHg" | "mg/dL" | "°C";
  context?: string;
  measuredAt?: string;
  measuredOn: string;
  note?: string;
  locale?: "pl" | "en";
}

function resolveActionLocale(explicit?: "pl" | "en"): "pl" | "en" {
  if (explicit) return explicit;
  if (typeof document !== "undefined" && document.documentElement.lang === "en") {
    return "en";
  }
  return "pl";
}

export async function saveVitalMeasurement(params: SaveVitalParams): Promise<{
  data?: VitalMeasurement;
  error?: string;
  isConflict?: boolean;
}> {
  const client = createClient();
  const id = params.id || crypto.randomUUID();
  const revision = params.revision ?? 0;

  const { data, error } = await client.rpc("save_pet_vital_measurement", {
    p_id: id,
    p_pet_id: params.petId,
    p_revision: revision,
    p_metric_type: params.metricType,
    p_value_primary: params.valuePrimary,
    p_value_secondary: params.valueSecondary ?? null,
    p_value_tertiary: params.valueTertiary ?? null,
    p_unit: params.unit,
    p_context: params.context || "",
    p_measured_at: params.measuredAt || new Date().toISOString(),
    p_measured_on: params.measuredOn,
    p_note: params.note || "",
  });

  if (error) {
    const isConflict = error.code === "PT409";
    const en = resolveActionLocale(params.locale) === "en";
    return {
      error:
        error.code === "PT428"
          ? en
            ? "This household requires a recovery key before making changes (read-only mode)."
            : "Domostwo wymaga najpierw wygenerowania klucza odzyskania dostępu (tryb tylko do odczytu)."
          : error.message || (en ? "Failed to save measurement" : "Błąd zapisu pomiaru"),
      isConflict,
    };
  }

  return { data: data as VitalMeasurement };
}

export async function deleteVitalMeasurement(params: {
  id: string;
  petId: string;
  revision: number;
  locale?: "pl" | "en";
}): Promise<{
  success: boolean;
  error?: string;
  isConflict?: boolean;
}> {
  const client = createClient();
  const { error } = await client.rpc("delete_pet_vital_measurement", {
    p_id: params.id,
    p_pet_id: params.petId,
    p_revision: params.revision,
  });

  if (error) {
    const isConflict = error.code === "PT409";
    const en = resolveActionLocale(params.locale) === "en";
    return {
      success: false,
      error:
        error.code === "PT428"
          ? en
            ? "This household requires a recovery key before making changes (read-only mode)."
            : "Domostwo wymaga najpierw wygenerowania klucza odzyskania dostępu (tryb tylko do odczytu)."
          : error.message || (en ? "Failed to delete measurement" : "Nie udało się usunąć pomiaru"),
      isConflict,
    };
  }

  return { success: true };
}
