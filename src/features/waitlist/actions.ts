"use server";

import { createClient } from "@/lib/supabase/server";

export interface WaitlistResult {
  ok: boolean;
  error?: string;
  alreadyJoined?: boolean;
}

export async function joinWaitlist(formData: FormData): Promise<WaitlistResult> {
  const honeypot = String(formData.get("website") ?? "").trim();
  // Honeypot: jeśli bot wypełnił ukryte pole, udajemy sukces
  if (honeypot) {
    return { ok: true };
  }

  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  const rawPetsCount = Number(formData.get("pets_count") ?? 1);

  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (!rawEmail || !emailRegex.test(rawEmail) || rawEmail.length > 254) {
    return { ok: false, error: "invalid_email" };
  }

  const petsCount =
    Number.isFinite(rawPetsCount) && rawPetsCount >= 1 && rawPetsCount <= 50
      ? Math.floor(rawPetsCount)
      : 1;

  try {
    const supabase = await createClient();
    if (!supabase) {
      return { ok: false, error: "service_unavailable" };
    }

    // Bezpieczny zapis do waitlist z normalizacją i walidacją
    const { error } = await supabase.rpc("add_waitlist_entry", {
      p_email: rawEmail,
      p_pets_count: petsCount,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "unexpected_error" };
  }
}
