import { createClient } from "@/lib/supabase/client";
import type {
  DischargeParsedState,
  DischargeLabReport,
  DischargeClinicalEvent,
  DischargeMeasurement,
  DischargeMedication,
  RawDischargeExtraction,
  LabCategory,
} from "./discharge-types";

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function extractClinicalDischarge(
  petId: string,
  file: File,
): Promise<{
  discharge: DischargeParsedState;
  sha256: string;
}> {
  const sha256 = await computeFileSha256(file);
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const client = createClient();
  const { data, error } = await client.functions.invoke("medical-reports", {
    body: {
      action: "extract_discharge",
      pet_id: petId,
      mime: file.type,
      file: base64,
    },
  });

  if (error) {
    const details = await error.context?.json?.().catch(() => null);
    const errCode = details?.error || error.message || "extraction_failed";
    let message = errCode;
    if (errCode === "extraction_failed") {
      message = "Nie udało się wyodrębnić danych z dokumentu. Upewnij się, że plik PDF jest czytelnym wypisem z lecznicy.";
    } else if (errCode === "page_limit_exceeded") {
      message = details?.message || "Plik ma zbyt wiele stron. Maksymalny dopuszczalny limit pojedynczej analizy to 10 stron. Wybierz zakres stron w oknie importu.";
    } else if (errCode === "ai_unavailable") {
      message = "Usługa analizy AI jest chwilowo niedostępna. Spróbuj ponownie za chwilę.";
    } else if (errCode === "daily_limit" || errCode === "provider_limit") {
      message = "Osiągnięto limit zapytań analizy dokumentów. Spróbuj ponownie później.";
    } else if (errCode === "too_large" || errCode === "invalid_file") {
      message = "Plik jest uszkodzony lub przekracza dopuszczalny rozmiar (maks. 12 MB).";
    }
    throw new Error(message);
  }

  const raw: RawDischargeExtraction = data?.discharge || {};

  const validCategories: LabCategory[] = ["blood", "renal", "liver", "other"];

  const lab_reports: DischargeLabReport[] = (raw.lab_reports || []).map(
    (r) => ({
      id: crypto.randomUUID(),
      date: r.date || new Date().toISOString().slice(0, 10),
      category: r.category || "blood",
      title: r.title || "Badanie diagnostyczne",
      laboratory: r.laboratory || "",
      doctor: r.doctor || "",
      notes: r.notes || "",
      ai_interpretation: r.ai_interpretation || "",
      selected: true,
      parameters: (r.parameters || []).map((p) => ({
        name: p.name || "",
        value: p.value || "-",
        unit: p.unit || "",
        reference: p.reference || "",
        category: (validCategories.includes(p.category as LabCategory)
          ? p.category
          : "other") as LabCategory,
      })),
    }),
  );

  const clinical_events: DischargeClinicalEvent[] = (
    raw.clinical_events || []
  ).map((e) => ({
    id: crypto.randomUUID(),
    date: e.date || new Date().toISOString().slice(0, 10),
    category:
      e.category === "vaccination" || e.category === "prevention"
        ? e.category
        : "visit",
    title: e.title || "Wizyta w lecznicy",
    clinic: e.clinic || "",
    doctor: e.doctor || "",
    description: e.description || "",
    batch_or_product: e.batch_or_product || "",
    selected: true,
  }));

  const measurements: DischargeMeasurement[] = (raw.measurements || []).map(
    (m) => ({
      id: crypto.randomUUID(),
      date: m.date || new Date().toISOString().slice(0, 10),
      type:
        m.type === "weight" ||
        m.type === "blood_pressure" ||
        m.type === "temperature"
          ? m.type
          : "weight",
      value: Number(m.value) || 0,
      raw_value: m.raw_value || String(m.value || ""),
      note: m.note || "",
      selected: true,
    }),
  );

  const medications: DischargeMedication[] = (raw.medications || []).map(
    (med) => ({
      name: med.name || "",
      dosage: med.dosage || "",
      frequency: med.frequency || "",
      instructions: med.instructions || "",
      selected: false,
    }),
  );

  return {
    discharge: {
      clinic_name: raw.clinic_name || "",
      patient_name: raw.patient_name || "",
      species: raw.species || "",
      summary: raw.summary || "",
      boundary_alert: raw.boundary_alert,
      lab_reports,
      clinical_events,
      measurements,
      medications,
    },
    sha256,
  };
}

export async function commitDischargeBatchImport(params: {
  petId: string;
  householdId?: string;
  file: File;
  sha256: string;
  state: DischargeParsedState;
}): Promise<{
  success: boolean;
  reports_count: number;
  events_count: number;
  weights_count: number;
}> {
  const { petId, householdId, file, sha256, state } = params;
  const client = createClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error("Wymagane uwierzytelnienie.");
  }

  let effectiveHouseholdId = householdId;
  if (!effectiveHouseholdId) {
    const { data: petRow } = await client
      .from("zwierze")
      .select("gospodarstwo_id")
      .eq("id", petId)
      .maybeSingle();
    effectiveHouseholdId = petRow?.gospodarstwo_id || "";
  }

  if (!effectiveHouseholdId) {
    throw new Error("Brak identyfikatora gospodarstwa domowego.");
  }

  const dischargeFileId = crypto.randomUUID();
  const rawExt = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const ext = file.type === "application/pdf" ? "pdf" : rawExt === "jpeg" ? "jpg" : rawExt;
  const sourcePath = `${effectiveHouseholdId}/${user.id}/${dischargeFileId}.${ext}`;

  // 1. Zapis pliku PDF w Supabase Storage
  const { error: uploadError } = await client.storage
    .from("medical-documents")
    .upload(sourcePath, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "31536000",
    });

  if (uploadError) {
    throw new Error(`Nie udało się zapisać pliku w magazynie: ${uploadError.message}`);
  }

  // 2. Przygotowanie danych do zapisu
  const payloadData = {
    lab_reports: state.lab_reports
      .filter((r) => r.selected)
      .map((r) => ({
        id: r.id,
        date: r.date,
        title: r.title,
        laboratory: r.laboratory,
        doctor: r.doctor,
        notes: r.notes,
        ai_interpretation: r.ai_interpretation,
        parameters: r.parameters,
      })),
    clinical_events: state.clinical_events
      .filter((e) => e.selected)
      .map((e) => ({
        id: e.id,
        date: e.date,
        category: e.category,
        title: e.title,
        clinic: e.clinic,
        doctor: e.doctor,
        batch_or_product: e.batch_or_product,
        description: e.description,
      })),
    weights: state.measurements
      .filter((m) => m.selected && m.type === "weight" && m.value > 0)
      .map((m) => ({
        id: m.id,
        date: m.date,
        value: m.value,
        note: m.note || "Wypis z lecznicy",
      })),
  };

  // 3. Atomowe wywołanie RPC
  const { data: result, error: rpcError } = await client.rpc(
    "import_clinical_discharge_batch",
    {
      p_pet_id: petId,
      p_source_path: sourcePath,
      p_source_name: file.name.slice(0, 180),
      p_source_mime: file.type,
      p_source_sha256: sha256,
      p_data: payloadData,
    },
  );

  if (rpcError) {
    // Sprzątanie pliku w przypadku błędu bazy
    await client.storage.from("medical-documents").remove([sourcePath]);
    throw new Error(rpcError.message || "Błąd zapisu danych do bazy.");
  }

  return {
    success: true,
    reports_count: result?.reports_count ?? 0,
    events_count: result?.events_count ?? 0,
    weights_count: result?.weights_count ?? 0,
  };
}
