import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SUPABASE_AUTH_COOKIE_PATTERN =
  /^sb-[a-z0-9_-]+-auth-token(?:\.\d+)?$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ locale: string }> },
) {
  const { locale: input } = await context.params;
  const locale = input === "en" ? "en" : "pl";

  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Prevent Logout-CSRF: never sign out an account that is still valid on the Auth server
    if (user && !error) {
      const activeResponse = new NextResponse(null, {
        status: 307,
        headers: { Location: `/${locale}/app` },
      });
      activeResponse.headers.set("Cache-Control", "private, no-store");
      activeResponse.headers.set("Referrer-Policy", "no-referrer");
      return activeResponse;
    }

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Fall through to explicit cookie clearing below
    }
  }

  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: `/${locale}/login` },
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");

  for (const cookie of request.cookies.getAll()) {
    if (
      SUPABASE_AUTH_COOKIE_PATTERN.test(cookie.name) ||
      cookie.name === "care_active_household_id"
    ) {
      response.cookies.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
      });
    }
  }

  return response;
}
