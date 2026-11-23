import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRelativePath } from "@/lib/safe-redirect";

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
        if (!user?.email) {
          await supabase.auth.signOut();
          pilotRestricted = true;
        } else {
          const { data: check, error: checkError } = await supabase.rpc("check_pilot_access", {
            p_email: user.email,
          });
          if (checkError || !check || check.eligible !== true) {
            let cleanedUp = false;
            if (check?.eligible === false) {
              try {
                const { data: deleted } = await supabase.rpc("cleanup_unauthorized_pilot_user");
                cleanedUp = deleted === true;
              } catch {
                // Best-effort cleanup of newly created unauthorized OAuth user
              }
              pilotRestricted = true;
            }
            try {
              await supabase.auth.signOut(cleanedUp ? { scope: "local" } : undefined);
            } catch {
              // Ensure redirect still happens if server logout fails for removed user
            }
          } else {
            success = true;
          }
        }
      }
    }
  }

  const safeReturnPath = sanitizeRelativePath(returnTo, "/app");
  const destination = pilotRestricted
    ? "login?error=pilot_restricted"
    : success
      ? safeReturnPath.slice(1)
      : "login?error=callback";

  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: `/${locale}/${destination}` },
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
