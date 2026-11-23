import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRelativePath } from "@/lib/safe-redirect";

export async function GET(request: NextRequest, context: { params: Promise<{ locale: string }> }) {
  const { locale: input } = await context.params;
  const locale = input === "en" ? "en" : "pl";
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const next = request.nextUrl.searchParams.get("next");
  let success = false;
  let pilotRestricted = false;

  const validTypes = ["email", "magiclink", "signup", "invite", "recovery"];
  if (token_hash && validTypes.includes(type ?? "")) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as "email" | "magiclink" | "signup" | "invite" | "recovery",
      });
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
            if (check?.eligible === false) {
              try {
                await supabase.rpc("cleanup_unauthorized_pilot_user");
              } catch {
                // Best-effort cleanup of newly created unauthorized user
              }
              pilotRestricted = true;
            }
            await supabase.auth.signOut();
          } else {
            success = true;
          }
        }
      }
    }
  }

  const safeNextPath = sanitizeRelativePath(next, "/app");
  const destination = pilotRestricted
    ? "login?error=pilot_restricted"
    : success
      ? safeNextPath.slice(1)
      : "login?error=confirmation";

  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: `/${locale}/${destination}` },
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
