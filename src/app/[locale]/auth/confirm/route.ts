import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, context: { params: Promise<{ locale: string }> }) {
  const { locale: input } = await context.params;
  const locale = input === "en" ? "en" : "pl";
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let success = false;
  if (token_hash && type === "email") {
    const supabase = await createClient();
    if (supabase) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: "email" });
      success = !error;
    }
  }
  // A relative Location preserves the browser origin and its session cookies.
  // Next.js can normalize request.url from 127.0.0.1 to localhost.
  const response = new NextResponse(null, {
    status: 307,
    headers: { Location: `/${locale}/${success ? "app" : "login?error=confirmation"}` },
  });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
