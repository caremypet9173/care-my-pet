import { createClient } from "@/lib/supabase/client";
import type { FluidLocation, FluidRoute } from "@/features/fluid-therapy/types";
import type {
  IntervalUnit,
  MedicationSchedule,
  MedicationScheduleCategory,
  MedicationScheduleType,
} from "./types";

export type SaveMedicationSchedulePayload = {
  id: string;
  pet_id: string;
  revision: number;
  item: {
    name: string;
    dosage: string;
    schedule_type: MedicationScheduleType;
    interval_value: number | null;
    interval_unit: IntervalUnit | null;
    start_date: string;
    end_date: string | null;
    scheduled_time: string;
    scheduled_times: string[];
    instructions: string;
    is_active: boolean;
    stock_quantity: number | null;
    low_stock_threshold: number;
    stock_unit: string;
    schedule_category: MedicationScheduleCategory;
    fluid_name: string;
    fluid_volume_ml: number | null;
    fluid_route: FluidRoute;
    fluid_location: FluidLocation;
  };
};

export async function saveMedicationScheduleClient(
  payload: SaveMedicationSchedulePayload,
): Promise<{
  schedule?: MedicationSchedule;
  error?: string;
  isConflict?: boolean;
}> {
  const client = createClient();

  try {
    const { data: fnData, error: fnError } = await client.functions.invoke(
      "pet-medications",
      { body: payload },
    );
    if (!fnError && fnData?.schedule) {
      return { schedule: fnData.schedule as MedicationSchedule };
    }
  } catch {
    // Fallback na bezpośrednie RPC, jeśli Edge Function chwilowo niedostępna
  }

  let res = await client.rpc("save_medication_schedule", {
    p_id: payload.id,
    p_pet_id: payload.pet_id,
    p_revision: payload.revision,
    p_name: payload.item.name,
    p_dosage: payload.item.dosage,
    p_schedule_type: payload.item.schedule_type,
    p_interval_value: payload.item.interval_value,
    p_interval_unit: payload.item.interval_unit,
    p_start_date: payload.item.start_date,
    p_end_date: payload.item.end_date,
    p_scheduled_time: payload.item.scheduled_time,
    p_instructions: payload.item.instructions,
    p_is_active: payload.item.is_active,
    p_scheduled_times: payload.item.scheduled_times,
    p_stock_quantity: payload.item.stock_quantity,
    p_low_stock_threshold: payload.item.low_stock_threshold,
    p_stock_unit: payload.item.stock_unit,
    p_schedule_category: payload.item.schedule_category,
    p_fluid_name: payload.item.fluid_name,
    p_fluid_volume_ml: payload.item.fluid_volume_ml,
    p_fluid_route: payload.item.fluid_route,
    p_fluid_location: payload.item.fluid_location,
  });

  if (
    res.error &&
    (res.error.message?.includes("parameter") ||
      res.error.message?.includes("function"))
  ) {
    res = await client.rpc("save_medication_schedule", {
      p_id: payload.id,
      p_pet_id: payload.pet_id,
      p_revision: payload.revision,
      p_name: payload.item.name,
      p_dosage: payload.item.dosage,
      p_schedule_type: payload.item.schedule_type,
      p_interval_value: payload.item.interval_value,
      p_interval_unit: payload.item.interval_unit,
      p_start_date: payload.item.start_date,
      p_end_date: payload.item.end_date,
      p_scheduled_time: payload.item.scheduled_time,
      p_instructions: payload.item.instructions,
      p_is_active: payload.item.is_active,
      p_scheduled_times: payload.item.scheduled_times,
      p_stock_quantity: payload.item.stock_quantity,
      p_low_stock_threshold: payload.item.low_stock_threshold,
      p_stock_unit: payload.item.stock_unit,
    });
  }

  if (res.error) {
    return {
      isConflict: res.error.code === "PT409",
      error: res.error.message || "save_failed",
    };
  }

  return { schedule: res.data as MedicationSchedule };
}
