import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";
import { getSupabaseConfig } from "./lib/supabase/config";

const internationalize = createMiddleware(routing);

const AUTH_ROUTE_PATTERN = /^\/(?:pl|en)\/(?:app|login|register|auth)(?:\/|$)/;
const TOKEN_ROUTE_PATTERN =
  /^\/(?:pl|en)\/(?:shared|archive|recover|invite)(?:\/|$)/;
const TOKEN_SESSION_ROUTE_PATTERN =
  /^\/(?:pl|en)\/(?:recover|invite)(?:\/|$)/;

function applySensitiveHeaders(headers: Headers, isTokenRoute: boolean) {
  headers.set("Cache-Control", "private, no-store");
  if (isTokenRoute) {
    headers.set("Referrer-Policy", "no-referrer");
  }
}

export default async function proxy(request: NextRequest) {
  let response = internationalize(request);
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTE_PATTERN.test(pathname);
  const isTokenRoute = TOKEN_ROUTE_PATTERN.test(pathname);

  if (!isAuthRoute && !isTokenRoute) return response;
  applySensitiveHeaders(response.headers, isTokenRoute);

  const needsSessionRefresh =
    isAuthRoute || TOKEN_SESSION_ROUTE_PATTERN.test(pathname);
  if (!needsSessionRefresh) return response;

  const config = getSupabaseConfig();
  if (!config) return response;

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = internationalize(request);
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        applySensitiveHeaders(response.headers, isTokenRoute);
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
