import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

export const createClient = cache(async () => {
  const config = getSupabaseConfig();
  if (!config) return null;
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Proxy handles session refresh.
        }
      },
    },
  });
});

export const getCurrentUser = cache(async () => {
  const client = await createClient();
  if (!client) return { user: null, error: null };
  const { data, error } = await client.auth.getUser();
  return { user: data.user ?? null, error };
});

/**
 * Cryptographically verifies the session JWT via JWKS (in-memory, ~0-1 ms for
 * asymmetric keys) without a network round-trip to /auth/v1/user. Use for read-only
 * SSR views where PostgreSQL RLS already enforces authorization on every query.
 */
export const getCurrentUserClaims = cache(async () => {
  const client = await createClient();
  if (!client) return { user: null, error: null };
  const { data, error } = await client.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) {
    return { user: null, error };
  }
  return {
    user: {
      id: String(claims.sub),
      email: typeof claims.email === "string" ? claims.email : null,
    },
    error: null,
  };
});
