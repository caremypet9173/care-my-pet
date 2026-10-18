import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, context: { params: Promise<{ locale: string }> }) {
  const { locale: input } = await context.params;
  const locale = input === "en" ? "en" : "pl";
  const code = request.nextUrl.searchParams.get("code");
  let success = false;
  if (code && !request.nextUrl.searchParams.has("error")) {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      success = !error;
    }
  }
  // Fixed local destinations; callback input cannot choose a redirect target.
  // Preserve the browser origin; request.url can contain an internal hostname.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: `/${locale}/${success ? "app" : "login?error=callback"}` },
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
