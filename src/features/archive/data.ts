import "server-only";
import type { ArchiveMetaPayload, ArchiveMetaResult } from "./types";

export async function fetchPetArchiveMeta(token: string): Promise<ArchiveMetaResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) {
    return { status: "not_found" };
  }

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/pet-archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
      },
      body: JSON.stringify({
        action: "get_meta",
        token,
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
    if (!res.ok || !body?.pet_name) {
      return { status: "not_found" };
    }

    const payload = body as ArchiveMetaPayload;
    return {
      status: payload.status === "locked" ? "locked" : "active",
      data: payload,
    };
  } catch {
    return { status: "not_found" };
  }
}
