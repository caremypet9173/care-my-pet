import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, context: { params: Promise<{ locale: string }> }) {
  const { locale: input } = await context.params;
  const locale = input === "en" ? "en" : "pl";
  const code = request.nextUrl.searchParams.get("code");
  const returnTo = request.nextUrl.searchParams.get("returnTo");
  let success = false;
  let pilotRestricted = false;

  if (code && !request.nextUrl.searchParams.has("error")) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: check } = await supabase.rpc("check_pilot_access", { p_email: user.email });
          if (check && check.eligible === false) {
            await supabase.auth.signOut();
            pilotRestricted = true;
          } else {
            success = true;
          }
        } else {
          success = true;
        }
      }
    }
  }

  const destination = pilotRestricted
    ? "login?error=pilot_restricted"
    : success
      ? (returnTo && returnTo.startsWith("/") ? returnTo.slice(1) : "app")
      : "login?error=callback";

  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: `/${locale}/${destination}` },
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
