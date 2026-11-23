import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./lib/supabase/config";

const internationalize = createMiddleware(routing);

const HOME_ROUTE_PATTERN = /^\/(?:(?:pl|en)\/?)?$/;
const AUTH_ROUTE_PATTERN = /^\/(?:pl|en)\/(?:app|login|register|auth)(?:\/|$)/;
const TOKEN_ROUTE_PATTERN =
  /^\/(?:pl|en)\/(?:shared|archive|recover|invite)(?:\/|$)/;
const TOKEN_SESSION_ROUTE_PATTERN =
  /^\/(?:pl|en)\/(?:recover|invite)(?:\/|$)/;
const SUPABASE_AUTH_COOKIE_PATTERN =
  /^sb-[a-z0-9_-]+-auth-token(?:\.\d+)?$/i;

function applySensitiveHeaders(headers: Headers, isTokenRoute: boolean) {
  headers.set("Cache-Control", "private, no-store");
  if (isTokenRoute) {
    headers.set("Referrer-Policy", "no-referrer");
  }
}

function hasSupabaseAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => SUPABASE_AUTH_COOKIE_PATTERN.test(cookie.name));
}

function resolveHomeLocale(
  request: NextRequest,
  intlResponse: NextResponse,
): "pl" | "en" {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/en" || pathname === "/en/") return "en";
  if (pathname === "/pl" || pathname === "/pl/") return "pl";
  const location = intlResponse.headers.get("location");
  if (location) {
    try {
      const parsed = new URL(location, request.url);
      if (parsed.pathname === "/en" || parsed.pathname.startsWith("/en/")) {
        return "en";
      }
      if (parsed.pathname === "/pl" || parsed.pathname.startsWith("/pl/")) {
        return "pl";
      }
    } catch {
      // Fall back to NEXT_LOCALE cookie / default locale
    }
  }
  return request.cookies.get("NEXT_LOCALE")?.value === "en" ? "en" : "pl";
}

export default async function proxy(request: NextRequest) {
  let response = internationalize(request);
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = AUTH_ROUTE_PATTERN.test(pathname);
  const isTokenRoute = TOKEN_ROUTE_PATTERN.test(pathname);
  const isHomeRedirectCandidate =
    HOME_ROUTE_PATTERN.test(pathname) &&
    !request.nextUrl.searchParams.has("home") &&
    hasSupabaseAuthCookie(request);

  if (!isAuthRoute && !isTokenRoute && !isHomeRedirectCandidate) {
    return response;
  }

  if (isAuthRoute || isTokenRoute) {
    applySensitiveHeaders(response.headers, isTokenRoute);
  }

  const needsSessionCheck =
    isAuthRoute ||
    isHomeRedirectCandidate ||
    TOKEN_SESSION_ROUTE_PATTERN.test(pathname);
  if (!needsSessionCheck) return response;

  const config = getSupabaseConfig();
  if (!config) return response;

  let refreshedCookies: {
    name: string;
    value: string;
    options?: Parameters<typeof response.cookies.set>[2];
  }[] = [];

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        refreshedCookies = values;
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = internationalize(request);
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        if (isAuthRoute || isTokenRoute) {
          applySensitiveHeaders(response.headers, isTokenRoute);
        } else {
          response.headers.set("Cache-Control", "private, no-store");
        }
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  if (isHomeRedirectCandidate && data?.claims?.sub) {
    const targetLocale = resolveHomeLocale(request, response);
    const redirectResponse = NextResponse.redirect(
      new URL(`/${targetLocale}/app`, request.url),
    );
    for (const { name, value, options } of refreshedCookies) {
      redirectResponse.cookies.set(name, value, options);
    }
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }

  return response;
}
export const config = { matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"] };
