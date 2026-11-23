import "server-only";
import type { SharedPetRecordPayload } from "./types";

export type SharedFetchResult =
  | { status: "ok"; data: SharedPetRecordPayload }
  | { status: "expired"; expires_at?: string }
  | { status: "revoked"; revoked_at?: string }
  | { status: "not_found" };

export async function fetchSharedPetRecord(
  token: string,
  userAgent = "",
): Promise<SharedFetchResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) {
    return { status: "not_found" };
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/pet-share`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({
        action: "get_shared",
        token,
        user_agent: userAgent.slice(0, 240),
      }),
      cache: "no-store",
    });

    const body = await res.json().catch(() => ({}));
    if (res.status === 410 && body?.error === "expired") {
      return { status: "expired", expires_at: body.expires_at };
    }
    if (res.status === 410 && body?.error === "revoked") {
      return { status: "revoked", revoked_at: body.revoked_at };
    }
    if (!res.ok || !body?.pet) {
      return { status: "not_found" };
    }

    return { status: "ok", data: body as SharedPetRecordPayload };
  } catch {
    return { status: "not_found" };
  }
}
