import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";
import { getSupabaseConfig } from "./lib/supabase/config";

const internationalize = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  let response = internationalize(request);
  const isAuthRoute = /^\/(?:pl|en)\/(?:app|login|register|auth)(?:\/|$)/.test(request.nextUrl.pathname);
  if (!isAuthRoute) return response;
  response.headers.set("Cache-Control", "private, no-store");
  const config = getSupabaseConfig();
  if (!config) return response;
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = internationalize(request);
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
